/**
 * Test case Boss Challenge. Setiap boss wajib menolak jebakan khas tier-nya (≥3 jawaban salah) dan menerima
 * cara pengerjaan lain yang sah (≥2 formulasi setara) — boss tanpa hint tidak boleh menuntut satu bentuk query.
 */
import type { MissionTestCases } from './types';

const T6_INSERTS = `INSERT INTO kunjungan (no_rawat, no_rm, id_poli, id_dokter, tgl_kunjungan, no_sep, status)
VALUES ('2026/11/16/000001', 'RM-0019', 'P06', 'D008', '2026-11-16', '0301R0011126V000131', 'Selesai');
INSERT INTO billing (no_rawat, total_biaya, status_bayar) VALUES ('2026/11/16/000001', 400000, 'Belum Lunas');`;
const T6_UPDATE = `UPDATE billing SET status_bayar = 'Lunas'
WHERE status_bayar = 'Belum Lunas'
  AND no_rawat IN (SELECT k.no_rawat FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm WHERE p.penjamin = 'Asuransi');`;
const T6_DELETE = `DELETE FROM kunjungan WHERE status = 'Batal'
  AND no_rawat NOT IN (SELECT no_rawat FROM diagnosa) AND no_rawat NOT IN (SELECT no_rawat FROM billing);`;

const T7_SELECT = `SELECT p.no_rm, p.nama, k.tgl_kunjungan, d.kode_icd10, d.nama_penyakit
FROM diagnosa d JOIN kunjungan k ON k.no_rawat = d.no_rawat JOIN pasien p ON p.no_rm = k.no_rm`;

export const TEST_CASES_BOSS: Record<string, MissionTestCases> = {
  'boss-t1-skrining': {
    wrong: [
      {
        label: 'OR tanpa kurung (BPJS lolos tanpa filter usia & kota)',
        answer:
          "SELECT nama, kota, tgl_lahir FROM pasien WHERE penjamin = 'BPJS' OR penjamin = 'Umum' AND tgl_lahir < '1991-01-01' AND kota NOT LIKE 'B%' ORDER BY kota, tgl_lahir LIMIT 5;",
        reason: 'cell-values',
      },
      {
        label: 'lupa LIMIT 5',
        answer:
          "SELECT nama, kota, tgl_lahir FROM pasien WHERE penjamin IN ('BPJS', 'Umum') AND tgl_lahir < '1991-01-01' AND kota NOT LIKE 'B%' ORDER BY kota, tgl_lahir;",
        reason: 'row-count',
      },
      {
        label: 'hanya urut tgl_lahir (lupa urut kota)',
        answer:
          "SELECT nama, kota, tgl_lahir FROM pasien WHERE penjamin IN ('BPJS', 'Umum') AND tgl_lahir < '1991-01-01' AND kota NOT LIKE 'B%' ORDER BY tgl_lahir LIMIT 5;",
      },
      {
        label: 'tertua dibalik (DESC)',
        answer:
          "SELECT nama, kota, tgl_lahir FROM pasien WHERE penjamin IN ('BPJS', 'Umum') AND tgl_lahir < '1991-01-01' AND kota NOT LIKE 'B%' ORDER BY kota, tgl_lahir DESC LIMIT 5;",
      },
    ],
    correct: [
      {
        label: 'IN + substr',
        answer:
          "SELECT nama, kota, tgl_lahir FROM pasien WHERE penjamin IN ('BPJS', 'Umum') AND tgl_lahir < '1991-01-01' AND substr(kota, 1, 1) <> 'B' ORDER BY kota, tgl_lahir LIMIT 5;",
      },
      {
        label: "NOT (kota LIKE 'b%') + penjamin <> 'Asuransi'",
        answer:
          "SELECT nama, kota, tgl_lahir FROM pasien WHERE penjamin <> 'Asuransi' AND tgl_lahir < '1991-01-01' AND NOT (kota LIKE 'b%') ORDER BY kota ASC, tgl_lahir ASC LIMIT 5 OFFSET 0;",
      },
    ],
  },

  'boss-t2-kontrol': {
    wrong: [
      {
        label: "filter Batal di WHERE (pasien tanpa kunjungan hilang)",
        answer: `SELECT p.no_rm, p.nama, COUNT(k.no_rawat) AS jumlah_kunjungan, SUM(b.total_biaya) AS total_tagihan
FROM pasien p LEFT JOIN kunjungan k ON k.no_rm = p.no_rm LEFT JOIN billing b ON b.no_rawat = k.no_rawat
WHERE p.penjamin = 'BPJS' AND k.status <> 'Batal' GROUP BY p.no_rm, p.nama HAVING COUNT(k.no_rawat) < 2;`,
        reason: 'row-count',
      },
      {
        label: 'COUNT(*) (pasien tanpa kunjungan terhitung 1)',
        answer: `SELECT p.no_rm, p.nama, COUNT(*) AS jumlah_kunjungan, SUM(b.total_biaya) AS total_tagihan
FROM pasien p LEFT JOIN kunjungan k ON k.no_rm = p.no_rm AND k.status <> 'Batal' LEFT JOIN billing b ON b.no_rawat = k.no_rawat
WHERE p.penjamin = 'BPJS' GROUP BY p.no_rm, p.nama HAVING COUNT(*) < 2;`,
        reason: 'cell-values',
      },
      {
        label: 'INNER JOIN',
        answer: `SELECT p.no_rm, p.nama, COUNT(k.no_rawat) AS jumlah_kunjungan, SUM(b.total_biaya) AS total_tagihan
FROM pasien p JOIN kunjungan k ON k.no_rm = p.no_rm AND k.status <> 'Batal' JOIN billing b ON b.no_rawat = k.no_rawat
WHERE p.penjamin = 'BPJS' GROUP BY p.no_rm, p.nama HAVING COUNT(k.no_rawat) < 2;`,
        reason: 'row-count',
      },
      {
        label: 'Batal ikut dihitung',
        answer: `SELECT p.no_rm, p.nama, COUNT(k.no_rawat) AS jumlah_kunjungan, SUM(b.total_biaya) AS total_tagihan
FROM pasien p LEFT JOIN kunjungan k ON k.no_rm = p.no_rm LEFT JOIN billing b ON b.no_rawat = k.no_rawat
WHERE p.penjamin = 'BPJS' GROUP BY p.no_rm, p.nama HAVING COUNT(k.no_rawat) < 2;`,
        reason: 'row-count',
      },
    ],
    correct: [
      {
        label: 'subquery terfilter di FROM',
        answer: `SELECT p.no_rm, p.nama, COUNT(k.no_rawat) AS jumlah_kunjungan, SUM(b.total_biaya) AS total_tagihan
FROM pasien p
LEFT JOIN (SELECT * FROM kunjungan WHERE status <> 'Batal') k ON k.no_rm = p.no_rm
LEFT JOIN billing b ON b.no_rawat = k.no_rawat
WHERE p.penjamin = 'BPJS'
GROUP BY p.no_rm
HAVING jumlah_kunjungan < 2;`,
      },
      {
        label: 'subquery berkorelasi',
        answer: `SELECT * FROM (
  SELECT p.no_rm, p.nama,
    (SELECT COUNT(*) FROM kunjungan k WHERE k.no_rm = p.no_rm AND k.status <> 'Batal') AS jumlah_kunjungan,
    (SELECT SUM(b.total_biaya) FROM kunjungan k JOIN billing b ON b.no_rawat = k.no_rawat WHERE k.no_rm = p.no_rm AND k.status <> 'Batal') AS total_tagihan
  FROM pasien p WHERE p.penjamin = 'BPJS'
) WHERE jumlah_kunjungan < 2;`,
      },
    ],
  },

  'boss-t3-beban-dokter': {
    wrong: [
      {
        label: 'JOIN diagnosa & billing sekaligus (fan-out tagihan)',
        answer: `SELECT d.nama_dokter, COUNT(DISTINCT k.no_rawat) AS jumlah_kunjungan, COUNT(x.id_diagnosa) AS jumlah_diagnosa,
  SUM(b.total_biaya) AS total_tagihan,
  CASE WHEN SUM(b.total_biaya) >= 5000000 THEN 'Tinggi' WHEN SUM(b.total_biaya) >= 1000000 THEN 'Sedang' ELSE 'Rendah' END AS kategori_beban
FROM dokter d JOIN kunjungan k ON k.id_dokter = d.id_dokter AND k.status <> 'Batal'
LEFT JOIN billing b ON b.no_rawat = k.no_rawat LEFT JOIN diagnosa x ON x.no_rawat = k.no_rawat
GROUP BY d.id_dokter ORDER BY total_tagihan DESC;`,
        reason: 'cell-values',
      },
      {
        label: 'SUM(DISTINCT) menambal gejala, COUNT(*) kunjungan ikut membengkak',
        answer: `SELECT d.nama_dokter, COUNT(*) AS jumlah_kunjungan, COUNT(x.id_diagnosa) AS jumlah_diagnosa,
  SUM(DISTINCT b.total_biaya) AS total_tagihan,
  CASE WHEN SUM(DISTINCT b.total_biaya) >= 5000000 THEN 'Tinggi' WHEN SUM(DISTINCT b.total_biaya) >= 1000000 THEN 'Sedang' ELSE 'Rendah' END AS kategori_beban
FROM dokter d JOIN kunjungan k ON k.id_dokter = d.id_dokter AND k.status <> 'Batal'
LEFT JOIN billing b ON b.no_rawat = k.no_rawat LEFT JOIN diagnosa x ON x.no_rawat = k.no_rawat
GROUP BY d.id_dokter ORDER BY total_tagihan DESC;`,
      },
      {
        label: 'Batal ikut dihitung',
        answer: `SELECT d.nama_dokter, COUNT(*) AS jumlah_kunjungan,
  SUM((SELECT COUNT(*) FROM diagnosa x WHERE x.no_rawat = k.no_rawat)) AS jumlah_diagnosa,
  SUM(b.total_biaya) AS total_tagihan,
  CASE WHEN SUM(b.total_biaya) >= 5000000 THEN 'Tinggi' WHEN SUM(b.total_biaya) >= 1000000 THEN 'Sedang' ELSE 'Rendah' END AS kategori_beban
FROM dokter d JOIN kunjungan k ON k.id_dokter = d.id_dokter
LEFT JOIN billing b ON b.no_rawat = k.no_rawat
GROUP BY d.id_dokter ORDER BY total_tagihan DESC;`,
        reason: 'cell-values',
      },
      {
        label: 'INNER JOIN diagnosa (dokter tanpa diagnosa hilang)',
        answer: `WITH dx AS (SELECT k.id_dokter, COUNT(*) AS n FROM kunjungan k JOIN diagnosa x ON x.no_rawat = k.no_rawat WHERE k.status <> 'Batal' GROUP BY k.id_dokter),
tg AS (SELECT k.id_dokter, COUNT(*) AS n, SUM(b.total_biaya) AS total FROM kunjungan k LEFT JOIN billing b ON b.no_rawat = k.no_rawat WHERE k.status <> 'Batal' GROUP BY k.id_dokter)
SELECT d.nama_dokter, tg.n AS jumlah_kunjungan, dx.n AS jumlah_diagnosa, tg.total AS total_tagihan,
  CASE WHEN tg.total >= 5000000 THEN 'Tinggi' WHEN tg.total >= 1000000 THEN 'Sedang' ELSE 'Rendah' END AS kategori_beban
FROM dokter d JOIN tg ON tg.id_dokter = d.id_dokter JOIN dx ON dx.id_dokter = d.id_dokter ORDER BY tg.total DESC;`,
        reason: 'row-count',
      },
    ],
    correct: [
      {
        label: 'subquery berkorelasi per kunjungan',
        answer: `SELECT d.nama_dokter, COUNT(*) AS jumlah_kunjungan,
  SUM((SELECT COUNT(*) FROM diagnosa x WHERE x.no_rawat = k.no_rawat)) AS jumlah_diagnosa,
  SUM(b.total_biaya) AS total_tagihan,
  CASE WHEN SUM(b.total_biaya) >= 5000000 THEN 'Tinggi' WHEN SUM(b.total_biaya) >= 1000000 THEN 'Sedang' ELSE 'Rendah' END AS kategori_beban
FROM dokter d JOIN kunjungan k ON k.id_dokter = d.id_dokter AND k.status <> 'Batal'
LEFT JOIN billing b ON b.no_rawat = k.no_rawat
GROUP BY d.id_dokter, d.nama_dokter ORDER BY total_tagihan DESC;`,
      },
      {
        label: 'dua CTE pra-agregasi + LEFT JOIN + COALESCE',
        answer: `WITH dx AS (SELECT k.id_dokter, COUNT(*) AS n FROM kunjungan k JOIN diagnosa x ON x.no_rawat = k.no_rawat WHERE k.status <> 'Batal' GROUP BY k.id_dokter),
tg AS (SELECT k.id_dokter, COUNT(*) AS n, SUM(b.total_biaya) AS total FROM kunjungan k LEFT JOIN billing b ON b.no_rawat = k.no_rawat WHERE k.status <> 'Batal' GROUP BY k.id_dokter)
SELECT d.nama_dokter, tg.n AS jumlah_kunjungan, COALESCE(dx.n, 0) AS jumlah_diagnosa, tg.total AS total_tagihan,
  CASE WHEN tg.total >= 5000000 THEN 'Tinggi' WHEN tg.total >= 1000000 THEN 'Sedang' ELSE 'Rendah' END AS kategori_beban
FROM tg JOIN dokter d ON d.id_dokter = tg.id_dokter LEFT JOIN dx ON dx.id_dokter = tg.id_dokter ORDER BY total_tagihan DESC;`,
      },
    ],
  },

  'boss-t4-matriks-gedung': {
    wrong: [
      {
        label: 'tanpa CROSS JOIN (hari/gedung kosong hilang)',
        answer: `SELECT k.tgl_kunjungan AS tanggal, p.gedung, COUNT(*) AS jumlah_kunjungan
FROM kunjungan k JOIN poliklinik p ON p.id_poli = k.id_poli
WHERE k.status <> 'Batal' AND k.tgl_kunjungan BETWEEN '2026-11-01' AND '2026-11-07'
GROUP BY k.tgl_kunjungan, p.gedung ORDER BY 1, 2;`,
        reason: 'row-count',
      },
      {
        label: 'NULL, bukan 0',
        answer: `WITH RECURSIVE t(tgl) AS (SELECT '2026-11-01' UNION ALL SELECT date(tgl, '+1 day') FROM t WHERE tgl < '2026-11-07'),
g AS (SELECT DISTINCT gedung FROM poliklinik),
h AS (SELECT k.tgl_kunjungan, p.gedung, COUNT(*) AS n FROM kunjungan k JOIN poliklinik p ON p.id_poli = k.id_poli WHERE k.status <> 'Batal' GROUP BY 1, 2)
SELECT t.tgl AS tanggal, g.gedung, h.n AS jumlah_kunjungan FROM t CROSS JOIN g LEFT JOIN h ON h.tgl_kunjungan = t.tgl AND h.gedung = g.gedung ORDER BY 1, 2;`,
        reason: 'cell-values',
      },
      {
        label: 'Batal ikut dihitung (5 November)',
        answer: `WITH RECURSIVE t(tgl) AS (SELECT '2026-11-01' UNION ALL SELECT date(tgl, '+1 day') FROM t WHERE tgl < '2026-11-07'),
g AS (SELECT DISTINCT gedung FROM poliklinik)
SELECT t.tgl AS tanggal, g.gedung,
  (SELECT COUNT(*) FROM kunjungan k JOIN poliklinik p ON p.id_poli = k.id_poli WHERE k.tgl_kunjungan = t.tgl AND p.gedung = g.gedung) AS jumlah_kunjungan
FROM t CROSS JOIN g ORDER BY 1, 2;`,
        reason: 'cell-values',
      },
      {
        label: 'deret tanggal kelebihan satu hari',
        answer: `WITH RECURSIVE t(tgl) AS (SELECT '2026-11-01' UNION ALL SELECT date(tgl, '+1 day') FROM t WHERE tgl <= '2026-11-07'),
g AS (SELECT DISTINCT gedung FROM poliklinik)
SELECT t.tgl AS tanggal, g.gedung,
  (SELECT COUNT(*) FROM kunjungan k JOIN poliklinik p ON p.id_poli = k.id_poli WHERE k.tgl_kunjungan = t.tgl AND p.gedung = g.gedung AND k.status <> 'Batal') AS jumlah_kunjungan
FROM t CROSS JOIN g ORDER BY 1, 2;`,
        reason: 'row-count',
      },
    ],
    correct: [
      {
        label: 'subquery berkorelasi per sel',
        answer: `WITH RECURSIVE t(tgl) AS (SELECT '2026-11-01' UNION ALL SELECT date(tgl, '+1 day') FROM t WHERE tgl < '2026-11-07'),
g AS (SELECT DISTINCT gedung FROM poliklinik)
SELECT t.tgl AS tanggal, g.gedung,
  (SELECT COUNT(*) FROM kunjungan k JOIN poliklinik p ON p.id_poli = k.id_poli WHERE k.tgl_kunjungan = t.tgl AND p.gedung = g.gedung AND k.status <> 'Batal') AS jumlah_kunjungan
FROM t, g ORDER BY tanggal, gedung;`,
      },
      {
        label: 'LEFT JOIN langsung + COUNT(kolom), deret dari angka',
        answer: `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < 6),
t AS (SELECT date('2026-11-01', '+' || i || ' day') AS tgl FROM n)
SELECT t.tgl AS tanggal, g.gedung, COUNT(k.no_rawat) AS jumlah_kunjungan
FROM t CROSS JOIN (SELECT gedung FROM poliklinik GROUP BY gedung) g
LEFT JOIN poliklinik p ON p.gedung = g.gedung
LEFT JOIN kunjungan k ON k.id_poli = p.id_poli AND k.tgl_kunjungan = t.tgl AND k.status <> 'Batal'
GROUP BY t.tgl, g.gedung ORDER BY t.tgl, g.gedung;`,
      },
    ],
  },

  'boss-t5-tagihan-teratas': {
    wrong: [
      {
        label: 'selisih terbalik (baris ini − sebelumnya)',
        answer: `SELECT * FROM (
  SELECT p.nama_poli, k.no_rawat, b.total_biaya,
    RANK() OVER w AS peringkat,
    b.total_biaya - LAG(b.total_biaya) OVER w AS selisih_dari_atas,
    ROUND(100.0 * b.total_biaya / SUM(b.total_biaya) OVER (PARTITION BY p.id_poli), 1) AS persen_dari_poli
  FROM billing b JOIN kunjungan k ON k.no_rawat = b.no_rawat JOIN poliklinik p ON p.id_poli = k.id_poli
  WINDOW w AS (PARTITION BY p.id_poli ORDER BY b.total_biaya DESC)
) WHERE peringkat <= 2 ORDER BY nama_poli, peringkat;`,
        reason: 'cell-values',
      },
      {
        label: 'pembagian bilangan bulat (100 tanpa .0)',
        answer: `SELECT * FROM (
  SELECT p.nama_poli, k.no_rawat, b.total_biaya,
    RANK() OVER w AS peringkat,
    LAG(b.total_biaya) OVER w - b.total_biaya AS selisih_dari_atas,
    ROUND(100 * b.total_biaya / SUM(b.total_biaya) OVER (PARTITION BY p.id_poli), 1) AS persen_dari_poli
  FROM billing b JOIN kunjungan k ON k.no_rawat = b.no_rawat JOIN poliklinik p ON p.id_poli = k.id_poli
  WINDOW w AS (PARTITION BY p.id_poli ORDER BY b.total_biaya DESC)
) WHERE peringkat <= 2 ORDER BY nama_poli, peringkat;`,
        reason: 'cell-values',
      },
      {
        label: 'persen dihitung setelah difilter ke 2 teratas',
        answer: `WITH r AS (
  SELECT p.id_poli, p.nama_poli, k.no_rawat, b.total_biaya,
    RANK() OVER (PARTITION BY p.id_poli ORDER BY b.total_biaya DESC) AS peringkat,
    LAG(b.total_biaya) OVER (PARTITION BY p.id_poli ORDER BY b.total_biaya DESC) - b.total_biaya AS selisih_dari_atas
  FROM billing b JOIN kunjungan k ON k.no_rawat = b.no_rawat JOIN poliklinik p ON p.id_poli = k.id_poli
)
SELECT nama_poli, no_rawat, total_biaya, peringkat, selisih_dari_atas,
  ROUND(100.0 * total_biaya / SUM(total_biaya) OVER (PARTITION BY id_poli), 1) AS persen_dari_poli
FROM r WHERE peringkat <= 2 ORDER BY nama_poli, peringkat;`,
        reason: 'cell-values',
      },
      {
        label: 'peringkat dari tagihan terkecil',
        answer: `SELECT * FROM (
  SELECT p.nama_poli, k.no_rawat, b.total_biaya,
    RANK() OVER w AS peringkat,
    LAG(b.total_biaya) OVER w - b.total_biaya AS selisih_dari_atas,
    ROUND(100.0 * b.total_biaya / SUM(b.total_biaya) OVER (PARTITION BY p.id_poli), 1) AS persen_dari_poli
  FROM billing b JOIN kunjungan k ON k.no_rawat = b.no_rawat JOIN poliklinik p ON p.id_poli = k.id_poli
  WINDOW w AS (PARTITION BY p.id_poli ORDER BY b.total_biaya)
) WHERE peringkat <= 2 ORDER BY nama_poli, peringkat;`,
      },
    ],
    correct: [
      {
        label: 'WINDOW bernama + PARTITION BY nama_poli',
        answer: `SELECT * FROM (
  SELECT p.nama_poli, k.no_rawat, b.total_biaya,
    RANK() OVER w AS peringkat,
    LAG(b.total_biaya) OVER w - b.total_biaya AS selisih_dari_atas,
    ROUND(b.total_biaya * 100.0 / SUM(b.total_biaya) OVER (PARTITION BY p.nama_poli), 1) AS persen_dari_poli
  FROM billing b JOIN kunjungan k ON k.no_rawat = b.no_rawat JOIN poliklinik p ON p.id_poli = k.id_poli
  WINDOW w AS (PARTITION BY p.nama_poli ORDER BY b.total_biaya DESC)
) WHERE peringkat <= 2 ORDER BY nama_poli, peringkat;`,
      },
      {
        label: 'total poli dari CTE terpisah (tanpa SUM OVER)',
        answer: `WITH total_poli AS (
  SELECT k.id_poli, SUM(b.total_biaya) AS total FROM billing b JOIN kunjungan k ON k.no_rawat = b.no_rawat GROUP BY k.id_poli
),
r AS (
  SELECT p.nama_poli, k.no_rawat, b.total_biaya,
    RANK() OVER (PARTITION BY k.id_poli ORDER BY b.total_biaya DESC) AS peringkat,
    LAG(b.total_biaya) OVER (PARTITION BY k.id_poli ORDER BY b.total_biaya DESC) - b.total_biaya AS selisih_dari_atas,
    ROUND(100.0 * b.total_biaya / tp.total, 1) AS persen_dari_poli
  FROM billing b JOIN kunjungan k ON k.no_rawat = b.no_rawat JOIN poliklinik p ON p.id_poli = k.id_poli JOIN total_poli tp ON tp.id_poli = k.id_poli
)
SELECT * FROM r WHERE peringkat < 3 ORDER BY nama_poli ASC, peringkat ASC;`,
      },
    ],
  },

  'boss-t6-tutup-shift': {
    wrong: [
      {
        label: 'transaksi dibiarkan terbuka',
        answer: `BEGIN;\n${T6_INSERTS}\n${T6_UPDATE}\n${T6_DELETE}\n-- COMMIT;`,
        reason: 'open-transaction',
      },
      {
        label: 'billing dimasukkan sebelum kunjungan (FOREIGN KEY)',
        answer: `BEGIN;
INSERT INTO billing (no_rawat, total_biaya, status_bayar) VALUES ('2026/11/16/000001', 400000, 'Belum Lunas');
INSERT INTO kunjungan (no_rawat, no_rm, id_poli, id_dokter, tgl_kunjungan, no_sep, status)
VALUES ('2026/11/16/000001', 'RM-0019', 'P06', 'D008', '2026-11-16', '0301R0011126V000131', 'Selesai');
${T6_UPDATE}\n${T6_DELETE}\nCOMMIT;`,
      },
      {
        label: 'UPDATE tanpa WHERE (semua tagihan jadi Lunas)',
        answer: `BEGIN;\n${T6_INSERTS}\nUPDATE billing SET status_bayar = 'Lunas';\n${T6_DELETE}\nCOMMIT;`,
        reason: 'cell-values',
      },
      {
        label: 'pelunasan tanpa filter penjamin Asuransi',
        answer: `BEGIN;\n${T6_INSERTS}\nUPDATE billing SET status_bayar = 'Lunas' WHERE status_bayar = 'Belum Lunas';\n${T6_DELETE}\nCOMMIT;`,
        reason: 'cell-values',
      },
      {
        label: 'perubahan di luar transaksi',
        answer: `${T6_INSERTS}\nBEGIN;\n${T6_UPDATE}\n${T6_DELETE}\nCOMMIT;`,
        reason: 'transaction-flow',
      },
    ],
    correct: [
      {
        label: 'DELETE sederhana + EXISTS + id_billing eksplisit',
        answer: `BEGIN;
INSERT INTO kunjungan VALUES ('2026/11/16/000001', 'RM-0019', 'P06', 'D008', '2026-11-16', '0301R0011126V000131', 'Selesai');
INSERT INTO billing (id_billing, no_rawat, total_biaya, status_bayar) VALUES (29, '2026/11/16/000001', 400000, 'Belum Lunas');
UPDATE billing SET status_bayar = 'Lunas'
WHERE status_bayar = 'Belum Lunas'
  AND EXISTS (SELECT 1 FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm WHERE k.no_rawat = billing.no_rawat AND p.penjamin = 'Asuransi');
DELETE FROM kunjungan WHERE status = 'Batal'
  AND NOT EXISTS (SELECT 1 FROM diagnosa d WHERE d.no_rawat = kunjungan.no_rawat)
  AND NOT EXISTS (SELECT 1 FROM billing b WHERE b.no_rawat = kunjungan.no_rawat);
COMMIT;`,
      },
      {
        label: 'urutan langkah berbeda (bersih-bersih dulu)',
        answer: `BEGIN TRANSACTION;\n${T6_DELETE}\n${T6_UPDATE}\n${T6_INSERTS}\nCOMMIT;`,
      },
    ],
  },

  'boss-t7-registri-jantung': {
    wrong: [
      {
        label: 'hasil benar tanpa index (SCAN diagnosa)',
        answer: `${T7_SELECT}\nWHERE d.kode_icd10 >= 'I20' AND d.kode_icd10 < 'I26' ORDER BY k.tgl_kunjungan;`,
        reason: 'missing-construct',
      },
      {
        label: "index dibuat, tapi LIKE 'I2%' (tidak sargable di SQLite)",
        answer: `CREATE INDEX idx_dx_icd ON diagnosa (kode_icd10);\n${T7_SELECT}\nWHERE d.kode_icd10 LIKE 'I2%' ORDER BY k.tgl_kunjungan;`,
        reason: 'plan-scan',
      },
      {
        label: 'index dibuat, kolom dibungkus substr()',
        answer: `CREATE INDEX idx_dx_icd ON diagnosa (kode_icd10);\n${T7_SELECT}\nWHERE substr(d.kode_icd10, 1, 3) BETWEEN 'I20' AND 'I25' ORDER BY k.tgl_kunjungan;`,
        reason: 'plan-scan',
      },
      {
        label: 'batas atas kelewatan (I50 & I63 ikut)',
        answer: `CREATE INDEX idx_dx_icd ON diagnosa (kode_icd10);\n${T7_SELECT}\nWHERE d.kode_icd10 >= 'I20' AND d.kode_icd10 < 'I99' ORDER BY k.tgl_kunjungan;`,
        reason: 'row-count',
      },
    ],
    correct: [
      {
        label: 'BETWEEN + urutan JOIN dari pasien',
        answer: `CREATE INDEX idx_diagnosa_kode ON diagnosa (kode_icd10);
SELECT p.no_rm, p.nama, k.tgl_kunjungan, d.kode_icd10, d.nama_penyakit
FROM pasien p JOIN kunjungan k ON k.no_rm = p.no_rm JOIN diagnosa d ON d.no_rawat = k.no_rawat
WHERE d.kode_icd10 BETWEEN 'I20' AND 'I25.99'
ORDER BY k.tgl_kunjungan;`,
      },
      {
        label: 'index komposit (kode_icd10, no_rawat)',
        answer: `CREATE INDEX idx_dx_kode_rawat ON diagnosa (kode_icd10, no_rawat);\n${T7_SELECT}\nWHERE d.kode_icd10 >= 'I20' AND d.kode_icd10 < 'I26' ORDER BY k.tgl_kunjungan ASC;`,
      },
    ],
  },

  'boss-t8-final': {
    wrong: [
      {
        label: 'pasien tanpa kunjungan ulang ikut tampil',
        answer: `WITH r AS (
  SELECT k.no_rm, b.total_biaya,
    julianday(k.tgl_kunjungan) - julianday(LAG(k.tgl_kunjungan) OVER (PARTITION BY k.no_rm ORDER BY k.tgl_kunjungan)) AS jarak
  FROM kunjungan k LEFT JOIN billing b ON b.no_rawat = k.no_rawat WHERE k.status <> 'Batal'
)
SELECT p.no_rm, p.nama, COUNT(*) AS jumlah_kunjungan, SUM(CASE WHEN jarak <= 30 THEN 1 ELSE 0 END) AS kunjungan_ulang_30hari, SUM(total_biaya) AS total_tagihan
FROM r JOIN pasien p ON p.no_rm = r.no_rm GROUP BY p.no_rm ORDER BY total_tagihan DESC;`,
        reason: 'row-count',
      },
      {
        label: 'LAG tanpa PARTITION BY (jarak lintas pasien)',
        answer: `WITH r AS (
  SELECT k.no_rm, b.total_biaya,
    julianday(k.tgl_kunjungan) - julianday(LAG(k.tgl_kunjungan) OVER (ORDER BY k.no_rm, k.tgl_kunjungan)) AS jarak
  FROM kunjungan k LEFT JOIN billing b ON b.no_rawat = k.no_rawat WHERE k.status <> 'Batal'
)
SELECT p.no_rm, p.nama, COUNT(*) AS jumlah_kunjungan, SUM(CASE WHEN jarak BETWEEN 0 AND 30 THEN 1 ELSE 0 END) AS kunjungan_ulang_30hari, SUM(total_biaya) AS total_tagihan
FROM r JOIN pasien p ON p.no_rm = r.no_rm GROUP BY p.no_rm HAVING kunjungan_ulang_30hari >= 1 ORDER BY total_tagihan DESC;`,
      },
      {
        label: 'jarak dihitung dari kunjungan PERTAMA, bukan kunjungan sebelumnya',
        answer: `WITH r AS (
  SELECT k.no_rm, b.total_biaya,
    CASE WHEN ROW_NUMBER() OVER (PARTITION BY k.no_rm ORDER BY k.tgl_kunjungan) > 1
      THEN julianday(k.tgl_kunjungan) - julianday(MIN(k.tgl_kunjungan) OVER (PARTITION BY k.no_rm)) END AS jarak
  FROM kunjungan k LEFT JOIN billing b ON b.no_rawat = k.no_rawat WHERE k.status <> 'Batal'
)
SELECT p.no_rm, p.nama, COUNT(*) AS jumlah_kunjungan, SUM(CASE WHEN jarak <= 30 THEN 1 ELSE 0 END) AS kunjungan_ulang_30hari, SUM(total_biaya) AS total_tagihan
FROM r JOIN pasien p ON p.no_rm = r.no_rm GROUP BY p.no_rm HAVING kunjungan_ulang_30hari >= 1 ORDER BY total_tagihan DESC;`,
      },
      {
        label: 'Batal ikut dihitung (Joko Susilo jadi kunjungan ulang)',
        answer: `WITH r AS (
  SELECT k.no_rm, b.total_biaya,
    julianday(k.tgl_kunjungan) - julianday(LAG(k.tgl_kunjungan) OVER (PARTITION BY k.no_rm ORDER BY k.tgl_kunjungan)) AS jarak
  FROM kunjungan k LEFT JOIN billing b ON b.no_rawat = k.no_rawat
)
SELECT p.no_rm, p.nama, COUNT(*) AS jumlah_kunjungan, SUM(CASE WHEN jarak <= 30 THEN 1 ELSE 0 END) AS kunjungan_ulang_30hari, SUM(total_biaya) AS total_tagihan
FROM r JOIN pasien p ON p.no_rm = r.no_rm GROUP BY p.no_rm HAVING kunjungan_ulang_30hari >= 1 ORDER BY total_tagihan DESC;`,
        reason: 'row-count',
      },
      {
        label: '< 30, bukan <= 30 (kontrol tepat 30 hari terlewat)',
        answer: `WITH r AS (
  SELECT k.no_rm, b.total_biaya,
    julianday(k.tgl_kunjungan) - julianday(LAG(k.tgl_kunjungan) OVER (PARTITION BY k.no_rm ORDER BY k.tgl_kunjungan)) AS jarak
  FROM kunjungan k LEFT JOIN billing b ON b.no_rawat = k.no_rawat WHERE k.status <> 'Batal'
)
SELECT p.no_rm, p.nama, COUNT(*) AS jumlah_kunjungan, SUM(CASE WHEN jarak < 30 THEN 1 ELSE 0 END) AS kunjungan_ulang_30hari, SUM(total_biaya) AS total_tagihan
FROM r JOIN pasien p ON p.no_rm = r.no_rm GROUP BY p.no_rm HAVING kunjungan_ulang_30hari >= 1 ORDER BY total_tagihan DESC;`,
        reason: 'row-count',
      },
      {
        label: 'total tagihan hanya dari kunjungan ulang',
        answer: `WITH r AS (
  SELECT k.no_rm, b.total_biaya,
    julianday(k.tgl_kunjungan) - julianday(LAG(k.tgl_kunjungan) OVER (PARTITION BY k.no_rm ORDER BY k.tgl_kunjungan)) AS jarak
  FROM kunjungan k LEFT JOIN billing b ON b.no_rawat = k.no_rawat WHERE k.status <> 'Batal'
)
SELECT p.no_rm, p.nama, COUNT(*) AS jumlah_kunjungan, SUM(CASE WHEN jarak <= 30 THEN 1 ELSE 0 END) AS kunjungan_ulang_30hari,
  SUM(CASE WHEN jarak <= 30 THEN total_biaya ELSE 0 END) AS total_tagihan
FROM r JOIN pasien p ON p.no_rm = r.no_rm GROUP BY p.no_rm HAVING kunjungan_ulang_30hari >= 1 ORDER BY total_tagihan DESC;`,
        reason: 'cell-values',
      },
    ],
    correct: [
      {
        label: 'EXISTS kunjungan sebelumnya ≤ 30 hari (tanpa window function)',
        answer: `SELECT p.no_rm, p.nama, COUNT(*) AS jumlah_kunjungan,
  SUM(CASE WHEN EXISTS (
    SELECT 1 FROM kunjungan s
    WHERE s.no_rm = k.no_rm AND s.status <> 'Batal' AND s.tgl_kunjungan < k.tgl_kunjungan
      AND julianday(k.tgl_kunjungan) - julianday(s.tgl_kunjungan) <= 30
  ) THEN 1 ELSE 0 END) AS kunjungan_ulang_30hari,
  SUM(b.total_biaya) AS total_tagihan
FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm LEFT JOIN billing b ON b.no_rawat = k.no_rawat
WHERE k.status <> 'Batal'
GROUP BY p.no_rm, p.nama
HAVING kunjungan_ulang_30hari > 0
ORDER BY total_tagihan DESC;`,
      },
      {
        label: 'ROW_NUMBER + self-join ke kunjungan sebelumnya',
        answer: `WITH urut AS (
  SELECT k.no_rm, k.tgl_kunjungan, b.total_biaya,
    ROW_NUMBER() OVER (PARTITION BY k.no_rm ORDER BY k.tgl_kunjungan) AS ke
  FROM kunjungan k LEFT JOIN billing b ON b.no_rawat = k.no_rawat WHERE k.status <> 'Batal'
),
rekap AS (
  SELECT a.no_rm, COUNT(*) AS jumlah_kunjungan,
    SUM(CASE WHEN julianday(a.tgl_kunjungan) - julianday(s.tgl_kunjungan) <= 30 THEN 1 ELSE 0 END) AS kunjungan_ulang_30hari,
    SUM(a.total_biaya) AS total_tagihan
  FROM urut a LEFT JOIN urut s ON s.no_rm = a.no_rm AND s.ke = a.ke - 1
  GROUP BY a.no_rm
)
SELECT r.no_rm, p.nama, r.jumlah_kunjungan, r.kunjungan_ulang_30hari, r.total_tagihan
FROM rekap r JOIN pasien p USING (no_rm)
WHERE r.kunjungan_ulang_30hari >= 1
ORDER BY r.total_tagihan DESC;`,
      },
    ],
  },
};
