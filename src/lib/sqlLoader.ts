/**
 * Loader sql.js khusus browser. WASM di-bundle oleh Vite via import `?url`.
 */
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let sqlPromise: Promise<SqlJsStatic> | null = null;

export function loadSqlJs(): Promise<SqlJsStatic> {
  if (sqlPromise) return sqlPromise;

  sqlPromise = initSqlJs({
    locateFile: () => wasmUrl,
    // Wajib menurut typings; true = perilaku default sql.js.
    useOldExtensionFunctions: true,
  }).catch((err: unknown) => {
    // Izinkan percobaan ulang jika gagal memuat (mis. jaringan/dev server).
    sqlPromise = null;
    throw err;
  });
  return sqlPromise;
}
