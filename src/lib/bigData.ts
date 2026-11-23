/**
 * Dataset besar untuk Lab Performa: database seed yang sama (skema & index identik) + data sintetis deterministik
 * dalam jumlah besar, dibangkitkan langsung di SQLite dengan CTE rekursif. Tujuannya membuat selisih SCAN vs SEARCH
 * terasa dalam milidetik — di data seed (puluhan baris) keduanya sama-sama instan.
 *
 * Data dibuat di dalam worker dan TIDAK pernah menyentuh database Playground maupun penilaian misi.
 * Nilai "acak" berasal dari perkalian bilangan prima (i * p % m), jadi isinya selalu sama di setiap perangkat.
 */
import type { Database, SqlJsStatic } from 'sql.js';
import { createSeededDatabase } from './sqlEngine';

export const BIG_PATIENTS = 5_000;
export const BIG_VISITS = 200_000;
/** Rentang tanggal kunjungan sintetis: 2025-01-01 s.d. 2026-12-31 (730 hari). */
export const BIG_DAYS = 730;

/** Kode ICD-10 untuk diagnosa sintetis (30 kode; beberapa sengaja jauh lebih sering). */
const ICD: ReadonlyArray<[string, string]> = [
  ['I10', 'Hipertensi esensial'],
  ['E11.9', 'Diabetes melitus tipe 2 tanpa komplikasi'],
  ['J06.9', 'Infeksi saluran pernapasan atas akut'],
  ['A09', 'Diare dan gastroenteritis'],
  ['K29.7', 'Gastritis'],
  ['E78.5', 'Hiperlipidemia'],
  ['Z34.9', 'Pemeriksaan kehamilan normal'],
  ['I50.9', 'Gagal jantung'],
  ['G43.9', 'Migrain'],
  ['A90', 'Demam dengue'],
  ['I20.9', 'Angina pektoris'],
  ['I21.9', 'Infark miokard akut'],
  ['I25.1', 'Penyakit jantung aterosklerotik'],
  ['I63.9', 'Infark serebral (stroke iskemik)'],
  ['G44.2', 'Nyeri kepala tipe tegang'],
  ['O21.0', 'Hiperemesis gravidarum ringan'],
  ['J18.9', 'Pneumonia'],
  ['J45.9', 'Asma'],
  ['N39.0', 'Infeksi saluran kemih'],
  ['M54.5', 'Nyeri punggung bawah'],
  ['L20.9', 'Dermatitis atopik'],
  ['H10.9', 'Konjungtivitis'],
  ['K02.9', 'Karies gigi'],
  ['K04.0', 'Pulpitis'],
  ['B34.9', 'Infeksi virus'],
  ['R50.9', 'Demam'],
  ['R51', 'Sakit kepala'],
  ['E66.9', 'Obesitas'],
  ['D64.9', 'Anemia'],
  ['F41.9', 'Gangguan cemas'],
];

const KOTA = ['Jakarta', 'Bogor', 'Depok', 'Tangerang', 'Bekasi', 'Bandung', 'Surabaya'];

function caseList(expr: string, values: readonly string[]): string {
  return `CASE ${expr} ${values.map((v, i) => `WHEN ${i} THEN '${v}'`).join(' ')} END`;
}

/** SQL pembangkit data besar (dijalankan setelah skema + seed biasa). */
export const BIG_DATA_SQL = `
PRAGMA foreign_keys = OFF;
BEGIN;

CREATE TEMP TABLE _icd (idx INTEGER PRIMARY KEY, kode TEXT, nama TEXT);
INSERT INTO _icd (idx, kode, nama) VALUES ${ICD.map(([kode, nama], i) => `(${i}, '${kode}', '${nama.replace(/'/g, "''")}')`).join(', ')};

WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${BIG_PATIENTS})
INSERT INTO pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin)
SELECT
  printf('RB-%05d', i),
  printf('99%014d', i),
  'Pasien ' || printf('%05d', i),
  CASE WHEN i % 2 = 0 THEN 'L' ELSE 'P' END,
  date('1950-01-01', '+' || ((i * 7919) % 25000) || ' days'),
  ${caseList(`(i * 31) % ${KOTA.length}`, KOTA)},
  CASE WHEN (i * 17) % 10 < 6 THEN 'BPJS' WHEN (i * 17) % 10 < 8 THEN 'Umum' ELSE 'Asuransi' END
FROM n;

WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${BIG_VISITS}),
v AS (
  SELECT i, date('2025-01-01', '+' || ((i * 48271) % ${BIG_DAYS}) || ' days') AS tgl FROM n
)
INSERT INTO kunjungan (no_rawat, no_rm, id_poli, id_dokter, tgl_kunjungan, no_sep, status)
SELECT
  replace(v.tgl, '-', '/') || '/B' || printf('%06d', v.i),
  printf('RB-%05d', 1 + (v.i * 7907) % ${BIG_PATIENTS}),
  dk.id_poli,
  dk.id_dokter,
  v.tgl,
  CASE WHEN (v.i * 37) % 10 < 5 THEN printf('0301R001%011d', v.i) END,
  CASE (v.i * 29) % 20 WHEN 0 THEN 'Batal' WHEN 1 THEN 'Dirawat' ELSE 'Selesai' END
FROM v
JOIN dokter dk ON dk.id_dokter = printf('D%03d', 1 + (v.i * 13) % 10);

-- Diagnosa primer untuk setiap kunjungan besar. Kode 0–4 (hipertensi, diabetes, ISPA, diare, gastritis) muncul jauh lebih sering.
INSERT INTO diagnosa (no_rawat, kode_icd10, nama_penyakit, jenis)
SELECT k.no_rawat, c.kode, c.nama, 'Primer'
FROM (SELECT no_rawat, CAST(substr(no_rawat, 13) AS INTEGER) AS i FROM kunjungan WHERE no_rawat LIKE '%/B%') k
JOIN _icd c ON c.idx = CASE WHEN (k.i * 101) % 10 < 5 THEN (k.i * 7) % 5 ELSE (k.i * 211) % ${ICD.length} END;

-- Diagnosa sekunder untuk separuh kunjungan.
INSERT INTO diagnosa (no_rawat, kode_icd10, nama_penyakit, jenis)
SELECT k.no_rawat, c.kode, c.nama, 'Sekunder'
FROM (SELECT no_rawat, CAST(substr(no_rawat, 13) AS INTEGER) AS i FROM kunjungan WHERE no_rawat LIKE '%/B%') k
JOIN _icd c ON c.idx = (k.i * 157 + 3) % ${ICD.length}
WHERE k.i % 2 = 0;

INSERT INTO billing (no_rawat, total_biaya, status_bayar)
SELECT
  no_rawat,
  75000 + ((i * 6151) % 240) * 12500 + CASE WHEN status = 'Dirawat' THEN 4000000 + ((i * 97) % 60) * 250000 ELSE 0 END,
  CASE WHEN (i * 43) % 20 < 17 THEN 'Lunas' ELSE 'Belum Lunas' END
FROM (SELECT no_rawat, status, CAST(substr(no_rawat, 13) AS INTEGER) AS i FROM kunjungan WHERE no_rawat LIKE '%/B%')
WHERE status <> 'Batal';

DROP TABLE _icd;
COMMIT;
PRAGMA foreign_keys = ON;
`;

/** Database seed + data besar. Butuh beberapa detik; panggil di worker. */
export function createBigDatabase(SQL: SqlJsStatic): Database {
  const db = createSeededDatabase(SQL);
  try {
    db.exec(BIG_DATA_SQL);
    return db;
  } catch (err) {
    db.close();
    throw err;
  }
}
