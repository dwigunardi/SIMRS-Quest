/**
 * Protokol pesan antara thread utama dan worker SQL (src/workers/sqlWorker.ts).
 * Semua nilai yang dikirim harus bisa di-structured-clone (objek polos, array, Uint8Array).
 */
import type { LabResult } from '../lib/perfLab';
import type { CheckResult, ExecOutcome, InjectionRun } from '../types';

/** Salinan database sesi Playground. `bytes` null = worker diharapkan sudah memegang versi ini. */
export interface SessionSnapshot {
  version: number;
  bytes: Uint8Array | null;
}

export type WorkerRequest =
  /** Run & Check misi SQL (selalu di DB seed segar). */
  | { type: 'check'; missionId: string; sql: string }
  /** Kirim input lab injection (selalu di DB seed segar). */
  | { type: 'inject'; missionId: string; input: string; safeMode: boolean }
  /** Jalankan SQL bebas: di salinan DB sesi (`session`), atau di DB seed segar bila `session` null. */
  | { type: 'exec'; sql: string; session: SessionSnapshot | null }
  /** Lab Performa: jalankan & ukur SQL di database besar milik worker (dibangkitkan saat pertama dipakai). */
  | { type: 'lab'; sql: string }
  /** Lab Performa: buang database besar (index/perubahan buatan user hilang; dibangkitkan lagi saat dipakai). */
  | { type: 'lab-reset' };

/** Hasil satu run lab. `buildMs` terisi bila database besar baru dibangkitkan pada permintaan ini. */
export interface LabReply {
  buildMs: number | null;
  run: LabResult;
}

export interface WorkerResultMap {
  check: CheckResult;
  inject: InjectionRun;
  exec: ExecOutcome;
  lab: LabReply;
  'lab-reset': { reset: true };
}

export type WorkerMessage = { id: number; request: WorkerRequest };

export type WorkerReply = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string };

/** Error khusus: worker tidak memegang salinan DB sesi versi yang diminta → kirim ulang dengan bytes. */
export const SNAPSHOT_MISSING = 'snapshot-missing';
/** Awalan error: mesin SQL gagal dimuat di worker → worker tidak bisa dipakai, jalankan langsung di thread utama. */
export const INIT_FAILED = 'init-failed';
