/**
 * Test case Tier 7 (Optimasi). Hasil plan diverifikasi empiris pada SQLite 3.54.1 (sql.js):
 * - diagnosa tanpa index → "SCAN diagnosa"; setelah index kode_icd10 → "SEARCH diagnosa USING INDEX ... (kode_icd10=?)".
 * - COLLATE NOCASE / partial index → index ada tetapi planner tetap SCAN (plan-scan).
 * - index komposit (no_rawat, kode_icd10) / index ekspresi lower(...) → kolom pertama bukan kode_icd10 (index-missing).
 * - kunjungan: strftime/substr/date()/LIKE → "SCAN kunjungan"; rentang >=/< , BETWEEN, GLOB → "SEARCH ... USING INDEX idx_kunjungan_tgl".
 * Lab injection (#42/#43): `answer` = payload form, dijalankan pada mode RENTAN.
 */
import type { MissionTestCases } from './types';

const SARGABLE_COLUMNS = 'SELECT no_rawat, no_rm, id_poli, tgl_kunjungan, status FROM kunjungan';

export const TEST_CASES_TIER7: Record<string, MissionTestCases> = {
  't7-index': {
    wrong: [
      { label: 'hanya SELECT, tidak membuat index', answer: "SELECT * FROM diagnosa WHERE kode_icd10 = 'I10';", reason: 'index-missing' },
      {
        label: 'index pada kolom lain',
        answer: 'CREATE INDEX idx_diagnosa_nama ON diagnosa (nama_penyakit);',
        reason: 'index-missing',
      },
      {
        label: 'komposit dengan kolom pertama salah',
        answer: 'CREATE INDEX idx_diag_rawat_icd ON diagnosa (no_rawat, kode_icd10);',
        reason: 'index-missing',
      },
      {
        label: 'index ekspresi lower()',
        answer: 'CREATE INDEX idx_diag_lower ON diagnosa (lower(kode_icd10));',
        reason: 'index-missing',
      },
      {
        label: 'COLLATE NOCASE (tidak cocok untuk = biasa)',
        answer: 'CREATE INDEX idx_diag_nocase ON diagnosa (kode_icd10 COLLATE NOCASE);',
        reason: 'plan-scan',
      },
      {
        label: 'partial index (WHERE jenis = Primer)',
        answer: "CREATE INDEX idx_diag_primer ON diagnosa (kode_icd10) WHERE jenis = 'Primer';",
        reason: 'index-missing',
      },
      {
        label: "partial index khusus 'I10' (cocok untuk query uji saja)",
        answer: "CREATE INDEX ix ON diagnosa (kode_icd10) WHERE kode_icd10 = 'I10';",
        reason: 'index-missing',
      },
      {
        label: 'index benar + DELETE FROM diagnosa (data hilang)',
        answer: 'CREATE INDEX ix ON diagnosa (kode_icd10);\nDELETE FROM diagnosa;',
        reason: 'row-count',
      },
      { label: 'UNIQUE index (kode berulang)', answer: 'CREATE UNIQUE INDEX idx_diag_u ON diagnosa (kode_icd10);' },
      { label: 'nama index bentrok dengan yang sudah ada', answer: 'CREATE INDEX idx_kunjungan_tgl ON diagnosa (kode_icd10);' },
    ],
    correct: [
      { label: 'IF NOT EXISTS + nama lain, huruf kecil', answer: 'create index if not exists ix_icd on diagnosa(kode_icd10)' },
      {
        label: 'komposit diawali kode_icd10',
        answer: 'CREATE INDEX idx_diagnosa_icd10_rawat ON diagnosa (kode_icd10, no_rawat);',
      },
      {
        label: 'index + EXPLAIN QUERY PLAN pengecekan',
        answer:
          "CREATE INDEX idx_diagnosa_icd10 ON diagnosa (kode_icd10);\nEXPLAIN QUERY PLAN SELECT no_rawat, nama_penyakit FROM diagnosa WHERE kode_icd10 = 'I10';",
      },
    ],
  },
  't7-sargable': {
    wrong: [
      {
        label: 'setengah sargable: batas bawah + strftime (rentang satu sisi)',
        answer: `${SARGABLE_COLUMNS} WHERE tgl_kunjungan >= '2026-10-01' AND strftime('%Y-%m', tgl_kunjungan) = '2026-10';`,
        reason: 'plan-scan',
      },
      {
        label: "tgl_kunjungan > '' + strftime",
        answer: `${SARGABLE_COLUMNS} WHERE tgl_kunjungan > '' AND strftime('%Y-%m', tgl_kunjungan) = '2026-10';`,
        reason: 'plan-scan',
      },
      {
        label: 'index lain (no_rm IN subquery) + strftime',
        answer: `${SARGABLE_COLUMNS} WHERE no_rm IN (SELECT no_rm FROM pasien) AND strftime('%Y-%m', tgl_kunjungan) = '2026-10';`,
        reason: 'plan-scan',
      },
      {
        label: "autoindex PK (no_rawat > '') + strftime",
        answer: `${SARGABLE_COLUMNS} WHERE no_rawat > '' AND strftime('%Y-%m', tgl_kunjungan) = '2026-10';`,
        reason: 'plan-scan',
      },
      {
        label: 'rentang terlalu lebar + filter bulan dengan fungsi',
        answer: `${SARGABLE_COLUMNS} WHERE tgl_kunjungan BETWEEN '2026-01-01' AND '2026-12-31' AND substr(tgl_kunjungan, 6, 2) = '10';`,
        reason: 'plan-scan',
      },
      {
        label: 'strftime (hasil benar, tapi SCAN)',
        answer: `${SARGABLE_COLUMNS} WHERE strftime('%Y-%m', tgl_kunjungan) = '2026-10';`,
        reason: 'plan-scan',
      },
      {
        label: 'substr (hasil benar, tapi SCAN)',
        answer: `${SARGABLE_COLUMNS} WHERE substr(tgl_kunjungan, 1, 7) = '2026-10';`,
        reason: 'plan-scan',
      },
      {
        label: "LIKE '2026-10%' (LIKE case-insensitive → SCAN)",
        answer: `${SARGABLE_COLUMNS} WHERE tgl_kunjungan LIKE '2026-10%';`,
        reason: 'plan-scan',
      },
      {
        label: 'date() membungkus kolom',
        answer: `${SARGABLE_COLUMNS} WHERE date(tgl_kunjungan) BETWEEN '2026-10-01' AND '2026-10-31';`,
        reason: 'plan-scan',
      },
      {
        label: 'lupa batas atas (November ikut terbawa)',
        answer: `${SARGABLE_COLUMNS} WHERE tgl_kunjungan >= '2026-10-01';`,
        reason: 'row-count',
      },
      {
        label: 'kolom kurang',
        answer: "SELECT no_rawat, tgl_kunjungan FROM kunjungan WHERE tgl_kunjungan >= '2026-10-01' AND tgl_kunjungan < '2026-11-01';",
        reason: 'column-count',
      },
    ],
    correct: [
      {
        label: 'rentang + ORDER BY no_rawat (tetap memakai index)',
        answer: `${SARGABLE_COLUMNS} WHERE tgl_kunjungan >= '2026-10-01' AND tgl_kunjungan < '2026-11-01' ORDER BY no_rawat;`,
      },
      {
        label: 'alias tabel + ORDER BY tgl_kunjungan',
        answer:
          "SELECT k.no_rawat, k.no_rm, k.id_poli, k.tgl_kunjungan, k.status FROM kunjungan AS k WHERE k.tgl_kunjungan >= '2026-10-01' AND k.tgl_kunjungan < '2026-11-01' ORDER BY k.tgl_kunjungan;",
      },
      { label: 'BETWEEN', answer: `${SARGABLE_COLUMNS} WHERE tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31';` },
      {
        label: 'urutan syarat dibalik, huruf kecil',
        answer:
          "select no_rawat, no_rm, id_poli, tgl_kunjungan, status from kunjungan where tgl_kunjungan < '2026-11-01' and tgl_kunjungan >= '2026-10-01'",
      },
      { label: 'GLOB (case-sensitive, memakai index)', answer: `${SARGABLE_COLUMNS} WHERE tgl_kunjungan GLOB '2026-10*';` },
    ],
  },
  't7-injection-bypass': {
    wrong: [
      { label: 'UNION ke tabel kunjungan (30 baris, bukan data pasien)', answer: "' UNION SELECT no_rawat, no_rm, status FROM kunjungan --", reason: 'goal-not-met' },
      { label: 'input normal', answer: 'RM-0001', reason: 'goal-not-met' },
      { label: 'menutup string + komentar saja (1 pasien)', answer: "RM-0001' --", reason: 'goal-not-met' },
      { label: 'kondisi selalu salah', answer: "' OR '1'='2", reason: 'goal-not-met' },
      { label: 'AND alih-alih OR', answer: "' AND '1'='1", reason: 'goal-not-met' },
      { label: 'tanda kutip tidak seimbang (syntax error)', answer: "' OR 1=1" },
      { label: 'tanpa menutup string (dianggap teks biasa)', answer: 'OR 1=1', reason: 'goal-not-met' },
    ],
    correct: [
      { label: 'UNION SELECT dari tabel pasien sendiri', answer: "x' UNION SELECT no_rm, nama, kota FROM pasien --" },
      { label: 'tautologi klasik', answer: "' OR '1'='1" },
      { label: 'tautologi angka + komentar', answer: "' OR 1=1 --" },
      { label: 'tautologi dengan LIKE', answer: "x' OR no_rm LIKE 'RM%' --" },
      { label: 'karakter $ di input tidak dirusak', answer: "' OR '$&'='$&" },
    ],
  },
  't7-injection-union': {
    wrong: [
      { label: 'angka diketik sendiri (tidak membaca billing)', answer: "%' UNION SELECT 1, 18750000 --", reason: 'goal-not-met' },
      { label: "literal 'x', 18750000", answer: "%' UNION SELECT 'x', 18750000 --", reason: 'goal-not-met' },
      { label: 'input normal', answer: 'Siti', reason: 'goal-not-met' },
      { label: 'tautologi saja (semua pasien, tanpa billing)', answer: "%' OR '1'='1", reason: 'goal-not-met' },
      { label: 'UNION dengan jumlah kolom berbeda', answer: "%' UNION SELECT total_biaya FROM billing --" },
      { label: 'UNION ke kolom yang salah', answer: "%' UNION SELECT no_rawat, status_bayar FROM billing --", reason: 'goal-not-met' },
      { label: 'lupa komentar (sisa template merusak sintaks)', answer: "%' UNION SELECT no_rawat, total_biaya FROM billing" },
    ],
    correct: [
      { label: 'UNION SELECT seluruh billing', answer: "%' UNION SELECT no_rawat, total_biaya FROM billing --" },
      { label: 'UNION ALL dengan filter', answer: "x' UNION ALL SELECT id_billing, total_biaya FROM billing WHERE total_biaya > 10000000 --" },
      { label: 'stacked query (result set terakhir = billing)', answer: "x'; SELECT no_rawat, total_biaya FROM billing; --" },
    ],
  },
};
