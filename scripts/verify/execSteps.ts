/**
 * Verifikasi visualisasi urutan eksekusi (src/lib/execSteps.ts).
 *
 * 1. Kasus unit: urutan langkah, alias SELECT di WHERE/GROUP BY, GROUP BY posisi, agregat tanpa GROUP BY,
 *    DISTINCT, CTE, komentar, query gabungan/non-SELECT ditolak dengan pesan.
 * 2. Korpus kurikulum: setiap SELECT di solusi, query misi tebak-hasil, contoh Materi, dan kasus uji yang valid harus
 *    tervisualisasi tanpa langkah error, langkah terakhirnya identik dengan hasil query asli, dan angka
 *    antar-langkah konsisten (WHERE: lolos + dibuang = masuk; grup ≤ baris; LIMIT ≤ masuk).
 */
import type { Database, SqlJsStatic } from 'sql.js';
import { ARTICLES } from '../../src/data/materi';
import { MISSIONS } from '../../src/data/missions';
import { compareResults } from '../../src/lib/compare';
import { DISPLAY_ROWS, planExecution, type ExecPlan, type StepKind } from '../../src/lib/execSteps';
import { createSeededDatabase, executeSql } from '../../src/lib/sqlEngine';
import { MISSION_TEST_CASES } from '../test-cases';
import { assert } from './report';

interface UnitCase {
  label: string;
  sql: string;
  kinds?: StepKind[];
  fails?: 'not-select' | 'compound' | 'error' | 'empty' | 'unsupported';
  check?: (plan: Extract<ExecPlan, { ok: true }>) => string | null;
}

const UNIT_CASES: readonly UnitCase[] = [
  {
    label: 'urutan lengkap',
    sql: "SELECT penjamin, COUNT(*) AS jumlah FROM pasien WHERE kota = 'Jakarta' GROUP BY penjamin HAVING COUNT(*) > 1 ORDER BY jumlah DESC LIMIT 5",
    kinds: ['from', 'where', 'group', 'having', 'select', 'order', 'limit'],
    check: (p) => {
      const written = p.written.map((w) => `${w.label}:${w.order}`).join(' ');
      return written === 'SELECT:5 FROM:1 WHERE:2 GROUP BY:3 HAVING:4 ORDER BY:6 LIMIT:7' ? null : `urutan tulis ${written}`;
    },
  },
  {
    label: 'JOIN bertahap + kolom baru disorot',
    sql: 'SELECT p.nama, k.no_rawat, b.total_biaya FROM pasien p JOIN kunjungan k ON k.no_rm = p.no_rm LEFT JOIN billing b ON b.no_rawat = k.no_rawat',
    kinds: ['from', 'join', 'join', 'select'],
    check: (p) => {
      const join = p.steps[2];
      return join?.table?.columns[join.highlight[0] ?? -1] === 'b.id_billing' ? null : 'kolom billing tidak disorot di langkah LEFT JOIN';
    },
  },
  {
    label: 'koma di FROM = CROSS JOIN',
    sql: 'SELECT COUNT(*) FROM poliklinik, dokter',
    kinds: ['from', 'join', 'group', 'select'],
    check: (p) => (p.steps[1]?.rowsOut === 70 ? null : `CROSS JOIN 7×10 seharusnya 70 baris, didapat ${p.steps[1]?.rowsOut ?? '-'}`),
  },
  {
    label: 'alias SELECT di WHERE → catatan portabilitas',
    sql: "SELECT kota AS k FROM pasien WHERE k = 'Bogor'",
    kinds: ['from', 'where', 'select'],
    check: (p) => (p.steps[1]?.notes.some((n) => n.includes('alias')) && p.steps[1]?.rowsOut === 3 ? null : 'alias di WHERE tidak ditangani'),
  },
  {
    label: 'kolom tabel lebih diutamakan daripada alias bernama sama',
    sql: "SELECT nama AS kota FROM pasien WHERE kota = 'Bogor'",
    check: (p) => (p.steps[1]?.rowsOut === 3 && p.steps[1].notes.length === 0 ? null : 'WHERE kota seharusnya merujuk kolom pasien.kota'),
  },
  {
    label: 'GROUP BY alias CASE',
    sql: "SELECT CASE WHEN total_biaya >= 1000000 THEN 'besar' ELSE 'kecil' END kategori, COUNT(*) FROM billing GROUP BY kategori",
    check: (p) => (p.steps.find((s) => s.kind === 'group')?.rowsOut === 2 ? null : 'GROUP BY alias seharusnya 2 grup'),
  },
  {
    label: 'GROUP BY posisi',
    sql: 'SELECT id_poli, COUNT(*) FROM kunjungan GROUP BY 1',
    check: (p) => (p.steps.find((s) => s.kind === 'group')?.rowsOut === 7 ? null : 'GROUP BY 1 seharusnya 7 grup'),
  },
  {
    label: 'agregat tanpa GROUP BY → satu grup',
    sql: "SELECT COUNT(*), SUM(total_biaya) FROM billing WHERE status_bayar = 'Belum Lunas'",
    kinds: ['from', 'where', 'group', 'select'],
    check: (p) => (p.steps[2]?.rowsOut === 1 && p.steps[2].title.includes('tanpa GROUP BY') ? null : 'agregasi tanpa GROUP BY tidak terdeteksi'),
  },
  {
    label: 'window function bukan agregasi',
    sql: 'SELECT no_rawat, SUM(total_biaya) OVER (ORDER BY no_rawat) AS kumulatif FROM billing',
    kinds: ['from', 'select'],
    check: (p) => (p.steps[1]?.notes.some((n) => n.includes('Window')) ? null : 'catatan window function hilang'),
  },
  { label: 'DISTINCT terpisah dari SELECT', sql: 'SELECT DISTINCT kota FROM pasien', kinds: ['from', 'select', 'distinct'] },
  {
    label: 'CTE dihitung lebih dulu',
    sql: 'WITH r AS (SELECT no_rm, COUNT(*) AS c FROM kunjungan GROUP BY no_rm) SELECT p.nama, r.c FROM r JOIN pasien p ON p.no_rm = r.no_rm WHERE r.c > 1',
    kinds: ['with', 'from', 'join', 'where', 'select'],
  },
  {
    label: 'komentar di tengah klausa tidak memotong langkah berikutnya',
    sql: "SELECT kota -- kolom\nFROM pasien -- sumber\nWHERE penjamin = 'BPJS' -- filter\nGROUP BY kota",
    kinds: ['from', 'where', 'group', 'select'],
  },
  {
    label: 'subquery di WHERE tetap utuh',
    sql: 'SELECT no_rawat FROM billing WHERE total_biaya > (SELECT AVG(total_biaya) FROM billing)',
    kinds: ['from', 'where', 'select'],
  },
  { label: 'tabel turunan di FROM', sql: 'SELECT s.n FROM (SELECT COUNT(*) AS n FROM pasien) s', kinds: ['from', 'select'] },
  {
    label: 'skrip: SELECT terakhir yang dipakai',
    sql: 'SELECT 1; SELECT nama_dokter FROM dokter LIMIT 2;',
    kinds: ['from', 'select', 'limit'],
    check: (p) => (p.notes.length > 0 ? null : 'catatan multi-statement hilang'),
  },
  {
    label: 'alias string & kata kunci + GROUP BY posisi',
    sql: "SELECT kota AS 'Kota', jenis_kelamin AS last, COUNT(*) FROM pasien GROUP BY 1, 2",
    check: (p) => (p.steps.find((s) => s.kind === 'group')?.rowsOut === 8 && p.steps.every((s) => !s.error) ? null : 'alias string/kata kunci tidak dikenali'),
  },
  { label: 'GROUP BY posisi setelah * ditolak dengan pesan', sql: 'SELECT p.*, COUNT(*) n FROM pasien p GROUP BY 2', fails: 'unsupported' },
  {
    label: 'HAVING tanpa GROUP BY (agregat seluruh tabel)',
    sql: 'SELECT COUNT(*) FROM pasien HAVING COUNT(*) > 5',
    kinds: ['from', 'group', 'having', 'select'],
    check: (p) => (p.steps[2]?.rowsOut === 1 && !p.steps[2].error ? null : 'HAVING tanpa GROUP BY gagal'),
  },
  { label: 'tanpa FROM + WHERE', sql: 'SELECT 1 AS x WHERE 1 = 1', kinds: ['where', 'select'] },
  { label: 'WITH … INSERT … SELECT ditolak (bukan query SELECT)', sql: "WITH x AS (SELECT no_rawat FROM kunjungan) INSERT INTO diagnosa (no_rawat, kode_icd10, nama_penyakit, jenis) SELECT no_rawat, 'X', 'Y', 'Primer' FROM x ORDER BY 1 LIMIT 5", fails: 'not-select' },
  { label: 'UNION ditolak', sql: 'SELECT kota FROM pasien UNION SELECT gedung FROM poliklinik', fails: 'compound' },
  { label: 'UPDATE ditolak', sql: "UPDATE pasien SET kota = 'X'", fails: 'not-select' },
  { label: 'error SQL diteruskan', sql: 'SELECT * FROM tabel_tidak_ada', fails: 'error' },
  { label: 'statement terakhir error → error, bukan SELECT sebelumnya', sql: 'SELECT 1; SELECT nama FROM dokter;', fails: 'error' },
  { label: 'kosong', sql: '  -- hanya komentar\n', fails: 'empty' },
];

function rowCount(db: Database, table: string): number {
  const stmt = db.prepare(`SELECT COUNT(*) FROM ${table}`);
  try {
    return stmt.step() ? Number(stmt.get()[0]) : -1;
  } finally {
    stmt.free();
  }
}

/** Visualisasi tidak boleh mengubah database apa pun isinya, dan koneksi kembali bisa ditulis sesudahnya. */
function verifyReadOnly(db: Database): void {
  const before = rowCount(db, 'diagnosa');
  planExecution(db, "WITH x AS (SELECT 1) INSERT INTO diagnosa (no_rawat, kode_icd10, nama_penyakit, jenis) SELECT '2026/10/01/000001', 'X', 'Y', 'Primer' FROM x");
  planExecution(db, "SELECT * FROM diagnosa WHERE kode_icd10 = 'I10'");
  assert(rowCount(db, 'diagnosa') === before, 'urutan eksekusi: database berubah setelah visualisasi');
  db.run("UPDATE pasien SET kota = kota WHERE no_rm = 'RM-0001'"); // query_only sudah dimatikan lagi → tidak error
}

function verifyUnits(db: Database): number {
  for (const c of UNIT_CASES) {
    const plan = planExecution(db, c.sql);
    const where = `urutan eksekusi "${c.label}"`;
    if (c.fails) {
      assert(!plan.ok && plan.reason === c.fails, `${where}: seharusnya gagal '${c.fails}', didapat ${plan.ok ? 'ok' : plan.reason}`);
      continue;
    }
    if (!plan.ok) {
      assert(false, `${where}: gagal (${plan.reason}) ${plan.message}`);
      continue;
    }
    if (c.kinds) {
      const kinds = plan.steps.map((s) => s.kind).join(',');
      assert(kinds === c.kinds.join(','), `${where}: langkah ${kinds}, seharusnya ${c.kinds.join(',')}`);
    }
    const problem = c.check?.(plan) ?? null;
    assert(problem === null, `${where}: ${problem ?? ''}`);
  }
  return UNIT_CASES.length;
}

/** Semua SELECT di kurikulum: solusi, query tebak-hasil (+ pengecoh), dan jawaban kasus uji. */
function corpus(): Array<{ label: string; sql: string }> {
  const out: Array<{ label: string; sql: string }> = [];
  for (const mission of MISSIONS) {
    if (mission.kind === 'sql' && (mission.grading?.type ?? 'result') === 'result') {
      out.push({ label: `${mission.id} solusi`, sql: mission.solutionSql });
      if (mission.fix) out.push({ label: `${mission.id} query bermasalah`, sql: mission.starterSql });
    }
    if (mission.kind === 'predict') {
      out.push({ label: `${mission.id} query`, sql: mission.query });
      mission.distractors.forEach((d, i) => out.push({ label: `${mission.id} pengecoh ${i + 1}`, sql: d.sql }));
    }
    const cases = MISSION_TEST_CASES[mission.id];
    if (mission.kind !== 'sql' || (mission.grading?.type ?? 'result') !== 'result') continue;
    for (const c of [...(cases?.correct ?? []), ...(cases?.wrong ?? [])]) out.push({ label: `${mission.id} [${c.label}]`, sql: c.answer });
  }
  // Contoh Materi punya tombol "Urutan Eksekusi" sendiri.
  for (const article of ARTICLES) {
    for (const example of article.sections.flatMap((section) => section.examples ?? []).filter((e) => e.run !== 'playground')) {
      out.push({ label: `materi ${article.id} "${example.title}"`, sql: example.sql });
    }
  }
  return out;
}

function verifyCorpus(SQL: SqlJsStatic): { checked: number; skipped: number } {
  const db = createSeededDatabase(SQL);
  let checked = 0;
  let skipped = 0;
  try {
    for (const { label, sql } of corpus()) {
      const outcome = executeSql(db, sql);
      const expected = outcome.ok ? outcome.results[outcome.results.length - 1] : undefined;
      const plan = planExecution(db, sql);
      if (!outcome.ok || !expected || !plan.ok) {
        // Query error / non-SELECT / UNION: cukup pastikan tidak ada exception dan pesannya ada.
        assert(plan.ok || plan.message.length > 0, `urutan eksekusi ${label}: gagal tanpa pesan`);
        skipped += 1;
        continue;
      }
      checked += 1;
      const where = `urutan eksekusi ${label}`;
      for (const step of plan.steps) {
        assert(step.error === null, `${where}: langkah ${step.order} ${step.title} error: ${step.error?.raw ?? ''}`);
        if (step.kind === 'where' && step.removed && step.rowsIn !== null && step.rowsOut !== null) {
          assert(step.rowsOut + step.removed.total === step.rowsIn, `${where}: WHERE lolos ${step.rowsOut} + dibuang ${step.removed.total} ≠ masuk ${step.rowsIn}`);
        }
        if ((step.kind === 'group' || step.kind === 'limit' || step.kind === 'distinct' || step.kind === 'having') && step.rowsIn !== null && step.rowsOut !== null) {
          assert(step.rowsOut <= Math.max(step.rowsIn, 1), `${where}: ${step.title} menghasilkan ${step.rowsOut} dari ${step.rowsIn}`);
        }
      }
      const last = plan.steps[plan.steps.length - 1]?.table;
      if (!last) continue;
      const shown = { columns: expected.columns, rows: expected.rows.slice(0, DISPLAY_ROWS) };
      assert(last.total === expected.rows.length, `${where}: langkah terakhir ${last.total} baris, query asli ${expected.rows.length}`);
      assert(compareResults(shown, { columns: last.columns, rows: last.rows }, true).match, `${where}: tabel langkah terakhir berbeda dari hasil query asli`);
    }
  } finally {
    db.close();
  }
  return { checked, skipped };
}

export function verifyExecSteps(SQL: SqlJsStatic): void {
  const db = createSeededDatabase(SQL);
  let units = 0;
  try {
    units = verifyUnits(db);
    verifyReadOnly(db);
  } finally {
    db.close();
  }
  const { checked, skipped } = verifyCorpus(SQL);
  console.log(`  ${units} kasus unit, ${checked} query kurikulum tervisualisasi konsisten (${skipped} non-SELECT/error dilewati) ✓`);
}
