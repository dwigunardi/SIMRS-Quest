/**
 * Penjaga eksekusi query ketikan user: menjalankannya di Web Worker dengan batas waktu.
 * Melewati batas waktu (atau dibatalkan user) → worker di-terminate dan dibuat ulang saat dibutuhkan;
 * halaman tetap responsif dan database utama tidak tersentuh.
 *
 * Bila Worker tidak tersedia/gagal dimuat, hasilnya `unavailable` — pemanggil menjalankan query secara langsung
 * (perilaku lama, tanpa batas waktu).
 */
import { INIT_FAILED, SNAPSHOT_MISSING, type SessionSnapshot, type WorkerMessage, type WorkerReply, type WorkerRequest, type WorkerResultMap } from '../workers/protocol';

/** Batas waktu satu permintaan (termasuk memuat mesin SQL di worker pada permintaan pertama). */
export const GUARD_TIMEOUT_MS = 8000;
/** Lab Performa: membangkitkan data besar (beberapa detik) + query berat butuh batas yang lebih longgar. */
export const LAB_TIMEOUT_MS = 30_000;

export type GuardOutcome<T> =
  | { status: 'done'; value: T }
  | { status: 'timeout' }
  | { status: 'cancelled' }
  /**
   * Mesin SQL di worker berhenti saat menjalankan query ini (mis. kehabisan memori). JANGAN diulang di thread utama —
   * query yang sama akan membuat halaman macet.
   */
  | { status: 'crashed'; message: string }
  /** Worker tidak tersedia / gagal dimuat → jalankan langsung di thread utama (tanpa batas waktu). */
  | { status: 'unavailable' };

/** Status internal: worker tidak memegang salinan DB sesi yang diminta (kirim ulang dengan bytes). */
type RawOutcome<T> = GuardOutcome<T> | { status: 'snapshot-missing' };

interface Pending {
  resolve: (outcome: RawOutcome<unknown>) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Sumber salinan DB sesi: versi (naik setiap DB berubah) + cara mengambil bytes-nya (mahal, hanya bila perlu). */
export interface SessionSource {
  version: number;
  bytes: () => Uint8Array;
}

class SqlGuard {
  private worker: Worker | null = null;
  private broken = false;
  private seq = 0;
  private readonly pending = new Map<number, Pending>();
  /** Versi DB sesi yang salinannya sudah dipegang worker. */
  private sessionVersion: number | null = null;

  /** Muat worker lebih awal agar Run pertama tidak menunggu mesin SQL dimuat. */
  warmUp(): void {
    this.ensure();
  }

  private ensure(): Worker | null {
    if (this.broken) return null;
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') {
      this.broken = true;
      return null;
    }
    try {
      const worker = new Worker(new URL('../workers/sqlWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<WorkerReply>) => this.onReply(event.data);
      worker.onerror = () => {
        // Worker gagal dimuat/crash: jangan coba lagi di sesi ini, kembalikan ke eksekusi langsung.
        this.broken = true;
        this.kill('unavailable');
      };
      this.worker = worker;
      return worker;
    } catch {
      this.broken = true;
      return null;
    }
  }

  private onReply(reply: WorkerReply): void {
    const pending = this.pending.get(reply.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(reply.id);
    if (reply.ok) {
      pending.resolve({ status: 'done', value: reply.value });
    } else if (reply.error === SNAPSHOT_MISSING) {
      pending.resolve({ status: 'snapshot-missing' });
    } else if (reply.error.startsWith(INIT_FAILED)) {
      this.broken = true;
      pending.resolve({ status: 'unavailable' });
      this.kill('unavailable');
    } else {
      pending.resolve({ status: 'crashed', message: reply.error });
      // Mesin SQL mungkin rusak (memori habis) — buang worker, buat baru pada permintaan berikutnya.
      this.kill('cancelled');
    }
  }

  /** Hentikan worker; semua permintaan yang masih menunggu diselesaikan dengan status `status`. */
  private kill(status: 'timeout' | 'cancelled' | 'unavailable'): void {
    this.worker?.terminate();
    this.worker = null;
    this.sessionVersion = null;
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.resolve({ status });
      this.pending.delete(id);
    }
  }

  private sendRaw<K extends WorkerRequest['type']>(
    request: Extract<WorkerRequest, { type: K }>,
    transfer: Transferable[] = [],
    timeoutMs: number = GUARD_TIMEOUT_MS,
  ): Promise<RawOutcome<WorkerResultMap[K]>> {
    const worker = this.ensure();
    if (!worker) return Promise.resolve({ status: 'unavailable' });
    this.seq += 1;
    const id = this.seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.kill('timeout'), timeoutMs);
      this.pending.set(id, { resolve: resolve as (outcome: RawOutcome<unknown>) => void, timer });
      const message: WorkerMessage = { id, request };
      worker.postMessage(message, transfer);
    });
  }

  private async send<K extends WorkerRequest['type']>(
    request: Extract<WorkerRequest, { type: K }>,
    timeoutMs: number = GUARD_TIMEOUT_MS,
  ): Promise<GuardOutcome<WorkerResultMap[K]>> {
    const outcome = await this.sendRaw<K>(request, [], timeoutMs);
    return outcome.status === 'snapshot-missing' ? { status: 'unavailable' } : outcome;
  }

  /** Batalkan semua query yang sedang berjalan (tombol "Hentikan"). */
  cancel(): void {
    if (this.pending.size > 0) this.kill('cancelled');
  }

  check(missionId: string, sql: string) {
    return this.send<'check'>({ type: 'check', missionId, sql });
  }

  inject(missionId: string, input: string, safeMode: boolean) {
    return this.send<'inject'>({ type: 'inject', missionId, input, safeMode });
  }

  /** Jalankan SQL di DB seed segar (mis. uji coba sebelum Urutan Eksekusi di misi). */
  execOnSeed(sql: string) {
    return this.send<'exec'>({ type: 'exec', sql, session: null });
  }

  /** Lab Performa: jalankan & ukur di database besar milik worker ini. */
  lab(sql: string) {
    return this.send<'lab'>({ type: 'lab', sql }, LAB_TIMEOUT_MS);
  }

  /** Lab Performa: buang database besar (dibangkitkan lagi saat dipakai). */
  labReset() {
    return this.send<'lab-reset'>({ type: 'lab-reset' });
  }

  /** Jalankan SQL di SALINAN DB sesi Playground. Bytes hanya dikirim bila versinya belum dipegang worker. */
  async execOnSession(sql: string, source: SessionSource): Promise<GuardOutcome<WorkerResultMap['exec']>> {
    const attempt = (withBytes: boolean) => {
      const bytes = withBytes ? source.bytes() : null;
      const session: SessionSnapshot = { version: source.version, bytes };
      const outcome = this.sendRaw<'exec'>({ type: 'exec', sql, session }, bytes ? [bytes.buffer] : []);
      if (bytes) this.sessionVersion = source.version;
      return outcome;
    };
    const first = await attempt(this.sessionVersion !== source.version);
    // Worker dibuat ulang / salinan hilang → kirim ulang sekali dengan bytes.
    const outcome = first.status === 'snapshot-missing' ? await attempt(true) : first;
    return outcome.status === 'snapshot-missing' ? { status: 'unavailable' } : outcome;
  }
}

/** Worker utama: penilaian misi, Playground, ujian. */
export const sqlGuard = new SqlGuard();

/**
 * Worker TERPISAH untuk Lab Performa: database besarnya (puluhan MB) dan query beratnya tidak berbagi memori maupun
 * nasib dengan worker penilaian — batas waktu di salah satunya tidak mematikan yang lain.
 */
export const labGuard = new SqlGuard();
