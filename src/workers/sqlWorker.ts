/**
 * Worker SQL: menjalankan query ketikan user di thread terpisah, sehingga query yang tidak pernah selesai bisa
 * dihentikan (worker di-terminate oleh src/lib/sqlGuard.ts) tanpa membuat halaman macet.
 */
import { loadSqlJs } from '../lib/sqlLoader';
import { createWorkerState, fatalErrorIn, handleRequest } from './handleRequest';
import { INIT_FAILED, type WorkerMessage, type WorkerReply } from './protocol';

/** Bagian API DedicatedWorkerGlobalScope yang dipakai (tsconfig memakai lib DOM, bukan WebWorker). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  postMessage: (message: WorkerReply) => void;
}

const scope = self as unknown as WorkerScope;
const state = createWorkerState();
const sqlReady = loadSqlJs();

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

scope.onmessage = (event) => {
  const { id, request } = event.data;
  sqlReady.then(
    (SQL) => {
      try {
        const value = handleRequest(SQL, state, request);
        const fatal = fatalErrorIn(value);
        // Memori WASM habis dsb.: laporkan sebagai crash agar thread utama membuang worker ini.
        scope.postMessage(fatal ? { id, ok: false, error: fatal } : { id, ok: true, value });
      } catch (err) {
        // Error SQL biasa sudah ditangani di dalam handleRequest; yang sampai sini = permintaan tidak valid atau
        // mesin SQL rusak (mis. kehabisan memori). Thread utama akan membuang worker ini.
        scope.postMessage({ id, ok: false, error: message(err) });
      }
    },
    (err: unknown) => scope.postMessage({ id, ok: false, error: `${INIT_FAILED}: ${message(err)}` }),
  );
};
