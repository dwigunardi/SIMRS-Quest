/**
 * Verifikasi eksekusi terlindungi (opsi batas baris + worker SQL).
 *
 * Web Worker tidak tersedia di Node, jadi yang diuji adalah logika di baliknya:
 * - handleRequest (src/workers/handleRequest.ts): hasil 'check'/'inject' identik dengan pemanggilan langsung dan bisa
 *   di-structured-clone; 'exec' di salinan DB sesi melihat isi sesi, tidak menumpuk perubahan antar-permintaan, memakai
 *   foreign_keys, dan meminta bytes ulang bila versinya tidak dipegang.
 * - snapshotDatabase: menolak saat transaksi terbuka / ada objek TEMP, dan koneksi tetap utuh (foreign_keys aktif).
 * - batas baris: rekursi tanpa syarat berhenti dihentikan cepat dengan pesan yang jelas.
 * - isReadOnlyScript: hanya skrip yang benar-benar membaca boleh memakai hasil salinan.
 */
import type { SqlJsStatic } from 'sql.js';
import { getMissionById } from '../../src/data/missions';
import { runInjection } from '../../src/lib/injection';
import { classifyCheck } from '../../src/lib/mistakes';
import { createSeededDatabase, executeSql, isReadOnlyScript, RESULT_TOO_LARGE, snapshotDatabase, stoppedFailure } from '../../src/lib/sqlEngine';
import { checkMission } from '../../src/lib/validator';
import { createWorkerState, fatalErrorIn, handleRequest } from '../../src/workers/handleRequest';
import { SNAPSHOT_MISSING } from '../../src/workers/protocol';
import type { ExecOutcome } from '../../src/types';
import { assert } from './report';

function same(a: unknown, b: unknown): boolean {
  // elapsedMs berbeda antar-eksekusi; bandingkan sisanya.
  const strip = (v: unknown) => JSON.stringify(v, (key, value: unknown) => (key === 'elapsedMs' ? 0 : value));
  return strip(a) === strip(b);
}

function rows(outcome: unknown): number {
  const o = outcome as ExecOutcome;
  return o.ok ? (o.results[o.results.length - 1]?.rows[0]?.[0] as number) : -1;
}

function verifyHandler(SQL: SqlJsStatic): number {
  const state = createWorkerState();
  const sqlMission = getMissionById('t2-left-join');
  const lab = getMissionById('t7-injection-bypass');
  if (sqlMission?.kind !== 'sql' || lab?.kind !== 'injection') throw new Error('misi uji tidak ditemukan');

  const answer = 'SELECT p.no_rm, p.nama FROM pasien p LEFT JOIN kunjungan k ON k.no_rm = p.no_rm WHERE k.no_rawat IS NULL';
  const viaWorker = handleRequest(SQL, state, { type: 'check', missionId: sqlMission.id, sql: answer });
  assert(same(viaWorker, checkMission(SQL, sqlMission, answer)), 'worker: hasil check berbeda dari checkMission langsung');
  assert(same(structuredClone(viaWorker), viaWorker), 'worker: hasil check tidak bisa di-structured-clone');
  const injected = handleRequest(SQL, state, { type: 'inject', missionId: lab.id, input: lab.solutionPayload, safeMode: false });
  assert(same(injected, runInjection(SQL, lab, lab.solutionPayload, false)), 'worker: hasil inject berbeda dari runInjection langsung');

  // Salinan DB sesi: tabel buatan user terlihat; perubahan uji coba tidak menumpuk; FK tetap ditegakkan.
  const session = createSeededDatabase(SQL);
  session.run('CREATE TABLE catatan (id INTEGER PRIMARY KEY, isi TEXT); INSERT INTO catatan (isi) VALUES (\'a\'), (\'b\');');
  const bytes = snapshotDatabase(session);
  assert(bytes !== null, 'snapshot: seharusnya berhasil tanpa transaksi terbuka');
  if (!bytes) return 3;
  const count = { type: 'exec', sql: 'SELECT COUNT(*) FROM catatan', session: { version: 7, bytes: null } } as const;
  assert(rows(handleRequest(SQL, state, { ...count, session: { version: 7, bytes } })) === 2, 'worker: salinan sesi tidak melihat tabel buatan user');
  handleRequest(SQL, state, { type: 'exec', sql: "INSERT INTO catatan (isi) VALUES ('c')", session: { version: 7, bytes: null } });
  assert(rows(handleRequest(SQL, state, count)) === 2, 'worker: perubahan uji coba tidak boleh menumpuk di salinan');
  const fk = handleRequest(SQL, state, { type: 'exec', sql: "INSERT INTO dokter VALUES ('D99', 'x', 'y', 'P99')", session: { version: 7, bytes: null } }) as ExecOutcome;
  assert(!fk.ok && /FOREIGN KEY/i.test(fk.rawError), 'worker: foreign_keys harus aktif di salinan sesi');
  let missing = '';
  try {
    handleRequest(SQL, state, { ...count, session: { version: 8, bytes: null } });
  } catch (err) {
    missing = err instanceof Error ? err.message : '';
  }
  assert(missing === SNAPSHOT_MISSING, 'worker: versi yang tidak dipegang harus meminta bytes ulang');
  assert(rows(handleRequest(SQL, state, { type: 'exec', sql: 'SELECT COUNT(*) FROM pasien', session: null })) === 20, 'worker: exec tanpa sesi harus memakai DB seed');

  // Koneksi sesi tetap utuh setelah snapshot (export menutup & membuka ulang koneksi).
  const pragma = executeSql(session, 'PRAGMA foreign_keys');
  assert(pragma.ok && pragma.results[0]?.rows[0]?.[0] === 1, 'snapshot: foreign_keys harus aktif lagi setelah export');
  assert(rows(executeSql(session, 'SELECT COUNT(*) FROM catatan')) === 2, 'snapshot: DB sesi harus tetap utuh');
  session.run('BEGIN');
  assert(snapshotDatabase(session) === null, 'snapshot: harus ditolak saat transaksi terbuka (export akan me-rollback)');
  session.run('ROLLBACK');
  session.run('CREATE TEMP TABLE sementara (x)');
  assert(snapshotDatabase(session) === null, 'snapshot: harus ditolak bila ada objek TEMP');
  session.close();

  // Error fatal mesin SQL (memori habis) dikenali di bentuk hasil apa pun; error SQL biasa tidak.
  assert(fatalErrorIn({ ok: false, rawError: 'out of memory', friendlyError: '' }) === 'out of memory', 'worker: out of memory harus dianggap fatal');
  assert(fatalErrorIn({ executedSql: '', check: { kind: 'error', rawError: 'Aborted(OOM)', friendlyError: '' } }) !== null, 'worker: Aborted di InjectionRun harus dianggap fatal');
  assert(fatalErrorIn({ kind: 'error', rawError: 'no such table: x', friendlyError: '' }) === null, 'worker: error SQL biasa bukan fatal');
  return 15;
}

function verifyRowCap(SQL: SqlJsStatic): number {
  const db = createSeededDatabase(SQL);
  try {
    const start = performance.now();
    const outcome = executeSql(db, 'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n) SELECT x FROM n');
    const ms = performance.now() - start;
    assert(!outcome.ok && outcome.rawError.startsWith(RESULT_TOO_LARGE), 'batas baris: rekursi tanpa henti harus dihentikan');
    assert(ms < 5000, `batas baris: penghentian terlalu lambat (${Math.round(ms)} ms)`);
    assert(!outcome.ok && outcome.friendlyError.includes('syarat berhenti'), 'batas baris: pesan harus menjelaskan penyebab');
    const mission = getMissionById('t4-recursive-dates');
    if (mission && !outcome.ok) {
      assert(classifyCheck(mission, { kind: 'error', rawError: outcome.rawError, friendlyError: outcome.friendlyError }) === 'rows-extra', 'batas baris: dicatat sebagai baris berlebih');
    }
    const timeout = stoppedFailure('timeout');
    assert(timeout.friendlyError.includes('terlalu lama'), 'timeout: pesan ramah harus ada');
    const cancelled = stoppedFailure('cancelled');
    assert(mission !== undefined && classifyCheck(mission, { kind: 'error', rawError: cancelled.rawError, friendlyError: cancelled.friendlyError }) === null, 'dibatalkan: tidak dicatat sebagai kesalahan');
  } finally {
    db.close();
  }
  return 6;
}

const READ_ONLY_CASES: ReadonlyArray<[string, boolean]> = [
  ['SELECT * FROM pasien', true],
  ['-- komentar\nWITH x AS (SELECT 1) SELECT * FROM x;', true],
  ['SELECT 1; SELECT 2;', true],
  ['EXPLAIN QUERY PLAN SELECT * FROM pasien', true],
  ["SELECT 'DELETE FROM pasien'", true],
  ['DELETE FROM pasien', false],
  ['WITH x AS (SELECT 1) INSERT INTO t SELECT * FROM x', false],
  ['SELECT 1; UPDATE pasien SET kota = kota', false],
  ['PRAGMA foreign_keys = OFF', false],
  ['BEGIN; SELECT 1;', false],
  ['   ', false],
];

export function verifyWorker(SQL: SqlJsStatic): void {
  const handler = verifyHandler(SQL);
  const cap = verifyRowCap(SQL);
  for (const [sql, expected] of READ_ONLY_CASES) {
    assert(isReadOnlyScript(sql) === expected, `isReadOnlyScript(${JSON.stringify(sql)}) seharusnya ${String(expected)}`);
  }
  console.log(`  ${handler} pemeriksaan worker & snapshot, ${cap} batas baris/timeout, ${READ_ONLY_CASES.length} kasus skrip read-only ✓`);
}
