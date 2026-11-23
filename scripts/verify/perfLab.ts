/**
 * Verifikasi Lab Performa: dataset besar (src/lib/bigData.ts) deterministik & relasinya utuh, pengukuran
 * (src/lib/perfLab.ts) menghitung semua baris tetapi hanya menyimpan cuplikan, dan setiap pasangan percobaan bawaan
 * benar-benar berubah dari SCAN menjadi SEARCH dengan hasil yang sama dan waktu yang lebih cepat.
 */
import type { SqlJsStatic } from 'sql.js';
import { BIG_PATIENTS, BIG_VISITS, createBigDatabase } from '../../src/lib/bigData';
import { LAB_PRESETS, LAB_PREVIEW_ROWS, LAB_TIMED_RUNS, classifyPlanLine, planSummary, runLab, type LabSuccess } from '../../src/lib/perfLab';
import { createWorkerState, fatalErrorIn, handleRequest } from '../../src/workers/handleRequest';
import type { LabReply } from '../../src/workers/protocol';
import { assert } from './report';

/** Pasangan (sebelum, sesudah) percobaan bawaan: plan harus berubah scan → search dan nilai hasilnya sama. */
const PAIRS: ReadonlyArray<[string, string]> = [
  ['sep-scan', 'sep-index'],
  ['bulan-fungsi', 'bulan-rentang'],
  ['icd-like', 'icd-rentang'],
];

export function verifyPerfLab(SQL: SqlJsStatic): void {
  let checks = 0;
  const ok = (cond: boolean, msg: string) => {
    checks += 1;
    assert(cond, `lab performa: ${msg}`);
  };
  const preset = (id: string) => {
    const p = LAB_PRESETS.find((x) => x.id === id);
    if (!p) throw new Error(`preset ${id} tidak ada`);
    return p.sql;
  };

  const start = performance.now();
  const db = createBigDatabase(SQL);
  const buildMs = performance.now() - start;
  try {
    const count = (sql: string) => Number(db.exec(sql)[0]?.values[0]?.[0] ?? -1);
    ok(buildMs < 30_000, `data besar harus selesai dibangkitkan di bawah batas waktu lab (${Math.round(buildMs)} ms)`);
    ok(count("SELECT COUNT(*) FROM kunjungan WHERE no_rawat LIKE '%/B%'") === BIG_VISITS, `harus ada ${BIG_VISITS} kunjungan sintetis`);
    ok(count("SELECT COUNT(*) FROM pasien WHERE no_rm LIKE 'RB-%'") === BIG_PATIENTS, `harus ada ${BIG_PATIENTS} pasien sintetis`);
    ok(count('SELECT COUNT(*) FROM pasien WHERE no_rm LIKE \'RM-%\'') === 20, 'data seed asli tetap ada (20 pasien RM-…)');
    ok((db.exec('PRAGMA foreign_key_check')[0]?.values.length ?? 0) === 0, 'tidak boleh ada pelanggaran FOREIGN KEY di data besar');
    ok(count('SELECT COUNT(*) FROM diagnosa') > BIG_VISITS && count('SELECT COUNT(*) FROM billing') > BIG_VISITS * 0.9, 'diagnosa & billing ikut dibangkitkan');
    ok(count("SELECT COUNT(DISTINCT tgl_kunjungan) FROM kunjungan WHERE no_rawat LIKE '%/B%'") === 730, 'kunjungan tersebar di 730 tanggal (2025–2026)');
    ok(count("SELECT COUNT(*) FROM kunjungan k JOIN billing b ON b.no_rawat = k.no_rawat WHERE k.status = 'Batal' AND k.no_rawat LIKE '%/B%'") === 0, 'kunjungan Batal sintetis tidak punya tagihan');
    ok(count('SELECT COUNT(*) FROM (SELECT no_rawat FROM kunjungan GROUP BY no_rawat HAVING COUNT(*) > 1)') === 0, 'no_rawat unik');

    // --- Pengukuran ---
    const all = runLab(db, 'SELECT * FROM kunjungan');
    ok(all.ok && all.rowCount === BIG_VISITS + 32 && all.rows.length === LAB_PREVIEW_ROWS && all.runs === LAB_TIMED_RUNS, 'semua baris dihitung, hanya cuplikan yang disimpan, skrip baca diukur beberapa kali');
    ok(all.ok && all.plan.length === 1 && all.plan[0]?.access === 'scan', 'SELECT * tanpa filter = SCAN');
    const bad = runLab(db, 'SELECT tidak_ada FROM kunjungan');
    ok(!bad.ok && bad.friendlyError.length > 0, 'error SQL dikembalikan sebagai kegagalan beserta pesan ramah');
    ok(!runLab(db, '   ').ok, 'skrip kosong ditolak');
    ok(classifyPlanLine('SCAN k USING INDEX idx_kunjungan_tgl') === 'scan' && classifyPlanLine('SEARCH d USING INDEX x (a=?)') === 'search' && classifyPlanLine('USE TEMP B-TREE FOR ORDER BY') === 'other', 'klasifikasi baris plan');

    // --- Percobaan bawaan: scan → search, hasil sama, lebih cepat ---
    for (const [beforeId, afterId] of PAIRS) {
      const before = runLab(db, preset(beforeId));
      const after = runLab(db, preset(afterId));
      ok(before.ok && after.ok, `${beforeId}/${afterId}: kedua percobaan harus berjalan`);
      if (!before.ok || !after.ok) continue;
      ok(planSummary(before.plan) === 'scan', `${beforeId}: seharusnya SCAN (${before.plan.map((p) => p.detail).join(' | ')})`);
      ok(planSummary(after.plan) === 'search', `${afterId}: seharusnya SEARCH (${after.plan.map((p) => p.detail).join(' | ')})`);
      ok(JSON.stringify(before.rows) === JSON.stringify(after.rows) && before.rowCount === after.rowCount, `${beforeId}/${afterId}: hasilnya harus sama`);
      // Skrip "CREATE INDEX + SELECT": yang dilaporkan adalah waktu SELECT-nya; pembuatan index dipisah ke setupMs.
      const withIndex: LabSuccess = after;
      ok(withIndex.elapsedMs < before.elapsedMs, `${afterId} (${withIndex.elapsedMs.toFixed(2)} ms) harus lebih cepat dari ${beforeId} (${before.elapsedMs.toFixed(2)} ms)`);
      if (/CREATE INDEX/i.test(preset(afterId))) {
        ok(withIndex.setupMs !== null && withIndex.setupMs > withIndex.elapsedMs && withIndex.runs === 3, `${afterId}: waktu membuat index (${withIndex.setupMs?.toFixed(1)} ms) dipisah dari waktu SELECT`);
      } else {
        ok(withIndex.setupMs === null, `${afterId}: skrip baca murni tidak punya waktu persiapan`);
      }
      console.log(`    ${beforeId}: ${before.elapsedMs.toFixed(1)} ms (SCAN) → ${afterId}: ${withIndex.elapsedMs.toFixed(2)} ms (SEARCH)${withIndex.setupMs !== null ? `, buat index ${withIndex.setupMs.toFixed(0)} ms` : ''}`);
    }
    const created = runLab(db, 'CREATE INDEX idx_uji ON billing (status_bayar)');
    ok(created.ok && created.mutated && created.runs === 1 && created.setupMs === null && created.columns.length === 0, 'skrip pengubah tanpa SELECT dijalankan sekali dan tanpa tabel hasil');
  } finally {
    db.close();
  }

  // --- Lewat worker (handleRequest): bangun saat pertama dipakai, bertahan antar-permintaan, reset membuang ---
  const state = createWorkerState();
  const first = handleRequest(SQL, state, { type: 'lab', sql: 'CREATE INDEX idx_lab ON kunjungan (no_sep)' }) as LabReply;
  ok(first.buildMs !== null && first.run.ok, 'permintaan pertama membangkitkan data besar');
  const second = handleRequest(SQL, state, { type: 'lab', sql: "SELECT name FROM sqlite_schema WHERE name = 'idx_lab'" }) as LabReply;
  ok(second.buildMs === null && second.run.ok && second.run.rowCount === 1, 'database besar (dan index buatan user) bertahan antar-permintaan');
  ok(JSON.stringify(structuredClone(second)) === JSON.stringify(second), 'hasil lab bisa di-structured-clone');
  handleRequest(SQL, state, { type: 'lab-reset' });
  ok(state.big === null, 'reset membuang database besar');
  const third = handleRequest(SQL, state, { type: 'lab', sql: "SELECT name FROM sqlite_schema WHERE name = 'idx_lab'" }) as LabReply;
  ok(third.buildMs !== null && third.run.ok && third.run.rowCount === 0, 'setelah reset, index buatan user hilang');
  ok(fatalErrorIn({ buildMs: null, run: { ok: false, rawError: 'out of memory', friendlyError: '' } }) !== null, 'kehabisan memori di lab dikenali sebagai fatal');
  state.big?.close();

  console.log(`  data besar dibangkitkan ${Math.round(buildMs)} ms, ${LAB_PRESETS.length} percobaan bawaan, ${checks} pemeriksaan ✓`);
}
