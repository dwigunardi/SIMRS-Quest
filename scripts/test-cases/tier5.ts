/**
 * Kasus uji Tier 5 – Window Functions.
 * Setiap misi punya minimal satu kasus 'missing-construct': hasilnya identik dengan
 * expected output, tetapi dibuat tanpa window function (GROUP BY + JOIN balik, subquery berkorelasi).
 * Kasus yang hasilnya salah SEKALIGUS tidak memakai konstruksi wajib sengaja tidak diberi `reason`,
 * karena alasan yang dilaporkan bergantung pada urutan pemeriksaan di validator.
 */
import type { MissionTestCases } from './types';

export const TEST_CASES_TIER5: Record<string, MissionTestCases> = {
  't5-row-number': {
    wrong: [
      {
        label: "status 'Batal' disaring SETELAH penomoran (RM-0006 hilang)",
        answer: `WITH urut AS (
  SELECT k.*, ROW_NUMBER() OVER (PARTITION BY k.no_rm ORDER BY k.tgl_kunjungan DESC, k.no_rawat DESC) AS rn
  FROM kunjungan k
)
SELECT u.no_rm, p.nama, u.no_rawat, u.tgl_kunjungan, pl.nama_poli
FROM urut u JOIN pasien p ON p.no_rm = u.no_rm JOIN poliklinik pl ON pl.id_poli = u.id_poli
WHERE u.rn = 1 AND u.status <> 'Batal'
ORDER BY u.no_rm;`,
        reason: 'row-count',
      },
      {
        label: 'tanpa PARTITION BY (hanya 1 baris untuk seluruh RS)',
        answer: `WITH urut AS (
  SELECT k.*, ROW_NUMBER() OVER (ORDER BY k.tgl_kunjungan DESC, k.no_rawat DESC) AS rn
  FROM kunjungan k WHERE k.status <> 'Batal'
)
SELECT u.no_rm, p.nama, u.no_rawat, u.tgl_kunjungan, pl.nama_poli
FROM urut u JOIN pasien p ON p.no_rm = u.no_rm JOIN poliklinik pl ON pl.id_poli = u.id_poli
WHERE u.rn = 1
ORDER BY u.no_rm;`,
        reason: 'row-count',
      },
      {
        label: 'ORDER BY menaik → kunjungan PERTAMA, bukan terakhir',
        answer: `WITH urut AS (
  SELECT k.*, ROW_NUMBER() OVER (PARTITION BY k.no_rm ORDER BY k.tgl_kunjungan ASC, k.no_rawat ASC) AS rn
  FROM kunjungan k WHERE k.status <> 'Batal'
)
SELECT u.no_rm, p.nama, u.no_rawat, u.tgl_kunjungan, pl.nama_poli
FROM urut u JOIN pasien p ON p.no_rm = u.no_rm JOIN poliklinik pl ON pl.id_poli = u.id_poli
WHERE u.rn = 1
ORDER BY u.no_rm;`,
        reason: 'cell-values',
      },
      {
        label: 'hasil benar via GROUP BY + MAX lalu JOIN balik (tanpa window function)',
        answer: `SELECT k.no_rm, p.nama, k.no_rawat, k.tgl_kunjungan, pl.nama_poli
FROM kunjungan k
JOIN (
  SELECT no_rm, MAX(tgl_kunjungan) AS tgl_terakhir FROM kunjungan WHERE status <> 'Batal' GROUP BY no_rm
) t ON t.no_rm = k.no_rm AND t.tgl_terakhir = k.tgl_kunjungan
JOIN pasien p ON p.no_rm = k.no_rm
JOIN poliklinik pl ON pl.id_poli = k.id_poli
WHERE k.status <> 'Batal'
ORDER BY k.no_rm;`,
        reason: 'missing-construct',
      },
      {
        label: 'hasil benar dengan RANK() (bukan ROW_NUMBER)',
        answer: `WITH urut AS (
  SELECT k.*, RANK() OVER (PARTITION BY k.no_rm ORDER BY k.tgl_kunjungan DESC, k.no_rawat DESC) AS rn
  FROM kunjungan k WHERE k.status <> 'Batal'
)
SELECT u.no_rm, p.nama, u.no_rawat, u.tgl_kunjungan, pl.nama_poli
FROM urut u JOIN pasien p ON p.no_rm = u.no_rm JOIN poliklinik pl ON pl.id_poli = u.id_poli
WHERE u.rn = 1
ORDER BY u.no_rm;`,
        reason: 'missing-construct',
      },
    ],
    correct: [
      {
        label: 'named window (OVER w ... WINDOW w AS (...))',
        answer: `WITH urut AS (
  SELECT k.no_rm, k.no_rawat, k.tgl_kunjungan, k.id_poli, ROW_NUMBER() OVER w AS rn
  FROM kunjungan k
  WHERE k.status <> 'Batal'
  WINDOW w AS (PARTITION BY k.no_rm ORDER BY k.tgl_kunjungan DESC, k.no_rawat DESC)
)
SELECT u.no_rm, p.nama, u.no_rawat, u.tgl_kunjungan, pl.nama_poli
FROM urut u JOIN pasien p ON p.no_rm = u.no_rm JOIN poliklinik pl ON pl.id_poli = u.id_poli
WHERE u.rn = 1
ORDER BY u.no_rm;`,
      },
      {
        label: 'subquery di FROM, JOIN di dalam, huruf kecil',
        answer: `select no_rm as NO_RM, nama, no_rawat, tgl_kunjungan as Tgl_Kunjungan, nama_poli
from (
  select k.no_rm, p.nama, k.no_rawat, k.tgl_kunjungan, pl.nama_poli,
    row_number() over (partition by k.no_rm order by k.tgl_kunjungan desc, k.no_rawat desc) as urutan
  from kunjungan k
  join pasien p on p.no_rm = k.no_rm
  join poliklinik pl on pl.id_poli = k.id_poli
  where k.status in ('Selesai', 'Dirawat')
) x
where urutan = 1
order by no_rm`,
      },
      {
        label: 'CTE dengan rn < 2',
        answer: `WITH terbaru AS (
  SELECT no_rm, no_rawat, tgl_kunjungan, id_poli,
         ROW_NUMBER() OVER (PARTITION BY no_rm ORDER BY tgl_kunjungan DESC, no_rawat DESC) AS nomor
  FROM kunjungan
  WHERE status != 'Batal'
)
SELECT t.no_rm, p.nama, t.no_rawat, t.tgl_kunjungan, pl.nama_poli
FROM terbaru t
JOIN poliklinik pl ON pl.id_poli = t.id_poli
JOIN pasien p ON p.no_rm = t.no_rm
WHERE t.nomor < 2
ORDER BY t.no_rm ASC;`,
      },
    ],
  },

  't5-rank': {
    wrong: [
      {
        label: 'DENSE_RANK tidak melompat (1, 1, 1, 2 …)',
        answer: `SELECT jenis, kode_icd10, nama_penyakit, COUNT(*) AS jumlah_kasus,
  DENSE_RANK() OVER (PARTITION BY jenis ORDER BY COUNT(*) DESC) AS peringkat
FROM diagnosa GROUP BY jenis, kode_icd10, nama_penyakit
ORDER BY jenis, peringkat, kode_icd10;`,
        reason: 'cell-values',
      },
      {
        label: 'ROW_NUMBER memberi nomor berbeda untuk yang seri',
        answer: `SELECT jenis, kode_icd10, nama_penyakit, COUNT(*) AS jumlah_kasus,
  ROW_NUMBER() OVER (PARTITION BY jenis ORDER BY COUNT(*) DESC, kode_icd10) AS peringkat
FROM diagnosa GROUP BY jenis, kode_icd10, nama_penyakit
ORDER BY jenis, peringkat, kode_icd10;`,
      },
      {
        label: 'tanpa PARTITION BY (Primer & Sekunder diperingkat bersama)',
        answer: `SELECT jenis, kode_icd10, nama_penyakit, COUNT(*) AS jumlah_kasus,
  RANK() OVER (ORDER BY COUNT(*) DESC) AS peringkat
FROM diagnosa GROUP BY jenis, kode_icd10, nama_penyakit
ORDER BY jenis, peringkat, kode_icd10;`,
        reason: 'cell-values',
      },
      {
        label: 'urutan di OVER menaik (kasus paling sedikit jadi peringkat 1)',
        answer: `SELECT jenis, kode_icd10, nama_penyakit, COUNT(*) AS jumlah_kasus,
  RANK() OVER (PARTITION BY jenis ORDER BY COUNT(*) ASC) AS peringkat
FROM diagnosa GROUP BY jenis, kode_icd10, nama_penyakit
ORDER BY jenis, peringkat, kode_icd10;`,
        reason: 'cell-values',
      },
      {
        label: 'hasil benar via subquery berkorelasi (tanpa window function)',
        answer: `WITH g AS (
  SELECT jenis, kode_icd10, nama_penyakit, COUNT(*) AS jumlah_kasus
  FROM diagnosa GROUP BY jenis, kode_icd10, nama_penyakit
)
SELECT g.jenis, g.kode_icd10, g.nama_penyakit, g.jumlah_kasus,
  1 + (SELECT COUNT(*) FROM g g2 WHERE g2.jenis = g.jenis AND g2.jumlah_kasus > g.jumlah_kasus) AS peringkat
FROM g
ORDER BY g.jenis, peringkat, g.kode_icd10;`,
        reason: 'missing-construct',
      },
    ],
    correct: [
      {
        label: 'named window untuk RANK()',
        answer: `SELECT jenis, kode_icd10, nama_penyakit, COUNT(*) AS jumlah_kasus, RANK() OVER w AS peringkat
FROM diagnosa
GROUP BY jenis, kode_icd10, nama_penyakit
WINDOW w AS (PARTITION BY jenis ORDER BY COUNT(*) DESC)
ORDER BY jenis, peringkat, kode_icd10;`,
      },
      {
        label: 'agregasi di CTE, RANK di query luar, huruf kecil',
        answer: `with kasus as (
  select jenis, kode_icd10, nama_penyakit, count(*) as jumlah_kasus
  from diagnosa group by jenis, kode_icd10, nama_penyakit
)
select JENIS, kode_icd10, nama_penyakit, jumlah_kasus,
  rank() over (partition by jenis order by jumlah_kasus desc) as Peringkat
from kasus
order by jenis, peringkat, kode_icd10`,
      },
      {
        label: 'ORDER BY memakai alias kolom & posisi',
        answer: `SELECT jenis, kode_icd10, nama_penyakit, COUNT(id_diagnosa) AS jumlah_kasus,
  RANK() OVER (PARTITION BY jenis ORDER BY COUNT(id_diagnosa) DESC) AS peringkat
FROM diagnosa
GROUP BY 1, 2, 3
ORDER BY 1 ASC, 5 ASC, 2 ASC;`,
      },
    ],
  },

  't5-running-total': {
    wrong: [
      {
        label: 'per baris tagihan tanpa rekap harian (tanggal ganda muncul 2×)',
        answer: `SELECT k.tgl_kunjungan, b.total_biaya AS pendapatan_harian,
  SUM(b.total_biaya) OVER (ORDER BY k.tgl_kunjungan, b.no_rawat ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS pendapatan_kumulatif
FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat
WHERE k.tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31'
ORDER BY k.tgl_kunjungan, b.no_rawat;`,
        reason: 'row-count',
      },
      {
        label: 'SUM() OVER () tanpa ORDER BY → total sebulan di setiap baris',
        answer: `WITH harian AS (
  SELECT k.tgl_kunjungan, SUM(b.total_biaya) AS pendapatan_harian
  FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat
  WHERE k.tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31' GROUP BY k.tgl_kunjungan
)
SELECT tgl_kunjungan, pendapatan_harian, SUM(pendapatan_harian) OVER () AS pendapatan_kumulatif
FROM harian ORDER BY tgl_kunjungan;`,
        reason: 'cell-values',
      },
      {
        label: 'tanpa filter Oktober (November ikut)',
        answer: `WITH harian AS (
  SELECT k.tgl_kunjungan, SUM(b.total_biaya) AS pendapatan_harian
  FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat GROUP BY k.tgl_kunjungan
)
SELECT tgl_kunjungan, pendapatan_harian, SUM(pendapatan_harian) OVER (ORDER BY tgl_kunjungan) AS pendapatan_kumulatif
FROM harian ORDER BY tgl_kunjungan;`,
        reason: 'row-count',
      },
      {
        label: 'kumulatif dari tanggal terbaru ke belakang',
        answer: `WITH harian AS (
  SELECT k.tgl_kunjungan, SUM(b.total_biaya) AS pendapatan_harian
  FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat
  WHERE k.tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31' GROUP BY k.tgl_kunjungan
)
SELECT tgl_kunjungan, pendapatan_harian, SUM(pendapatan_harian) OVER (ORDER BY tgl_kunjungan DESC) AS pendapatan_kumulatif
FROM harian ORDER BY tgl_kunjungan;`,
        reason: 'cell-values',
      },
      {
        label: 'hasil benar via subquery berkorelasi (tanpa window function)',
        answer: `WITH harian AS (
  SELECT k.tgl_kunjungan, SUM(b.total_biaya) AS pendapatan_harian
  FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat
  WHERE k.tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31' GROUP BY k.tgl_kunjungan
)
SELECT h.tgl_kunjungan, h.pendapatan_harian,
  (SELECT SUM(h2.pendapatan_harian) FROM harian h2 WHERE h2.tgl_kunjungan <= h.tgl_kunjungan) AS pendapatan_kumulatif
FROM harian h ORDER BY h.tgl_kunjungan;`,
        reason: 'missing-construct',
      },
    ],
    correct: [
      {
        label: 'SUM(SUM(...)) OVER dalam satu query GROUP BY, huruf kecil',
        answer: `select k.tgl_kunjungan as TGL_KUNJUNGAN,
  sum(b.total_biaya) as pendapatan_harian,
  sum(sum(b.total_biaya)) over (order by k.tgl_kunjungan) as Pendapatan_Kumulatif
from kunjungan k join billing b on b.no_rawat = k.no_rawat
where k.tgl_kunjungan >= '2026-10-01' and k.tgl_kunjungan < '2026-11-01'
group by k.tgl_kunjungan
order by k.tgl_kunjungan`,
      },
      {
        label: 'CTE + frame default (RANGE) aman karena tanggal sudah unik',
        answer: `WITH harian AS (
  SELECT k.tgl_kunjungan, SUM(b.total_biaya) AS pendapatan_harian
  FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat
  WHERE strftime('%Y-%m', k.tgl_kunjungan) = '2026-10'
  GROUP BY k.tgl_kunjungan
)
SELECT tgl_kunjungan, pendapatan_harian,
  SUM(pendapatan_harian) OVER (ORDER BY tgl_kunjungan RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS pendapatan_kumulatif
FROM harian
ORDER BY tgl_kunjungan ASC;`,
      },
    ],
  },

  't5-lag': {
    wrong: [
      {
        label: 'tanpa PARTITION BY (tanggal pasien lain dianggap kunjungan sebelumnya)',
        answer: `WITH r AS (
  SELECT no_rm, tgl_kunjungan, LAG(tgl_kunjungan) OVER (ORDER BY tgl_kunjungan, no_rawat) AS kunjungan_sebelumnya
  FROM kunjungan WHERE status <> 'Batal'
)
SELECT r.no_rm, p.nama, r.tgl_kunjungan, r.kunjungan_sebelumnya,
  CAST(julianday(r.tgl_kunjungan) - julianday(r.kunjungan_sebelumnya) AS INTEGER) AS selisih_hari
FROM r JOIN pasien p ON p.no_rm = r.no_rm
WHERE r.kunjungan_sebelumnya IS NOT NULL
ORDER BY r.no_rm, r.tgl_kunjungan;`,
        reason: 'row-count',
      },
      {
        label: "status 'Batal' disaring SETELAH LAG (kunjungan batal jadi 'sebelumnya')",
        answer: `WITH r AS (
  SELECT no_rm, tgl_kunjungan, status,
    LAG(tgl_kunjungan) OVER (PARTITION BY no_rm ORDER BY tgl_kunjungan) AS kunjungan_sebelumnya
  FROM kunjungan
)
SELECT r.no_rm, p.nama, r.tgl_kunjungan, r.kunjungan_sebelumnya,
  CAST(julianday(r.tgl_kunjungan) - julianday(r.kunjungan_sebelumnya) AS INTEGER) AS selisih_hari
FROM r JOIN pasien p ON p.no_rm = r.no_rm
WHERE r.kunjungan_sebelumnya IS NOT NULL AND r.status <> 'Batal'
ORDER BY r.no_rm, r.tgl_kunjungan;`,
        reason: 'row-count',
      },
      {
        label: 'kunjungan pertama (NULL) tidak dibuang',
        answer: `WITH r AS (
  SELECT no_rm, tgl_kunjungan, LAG(tgl_kunjungan) OVER (PARTITION BY no_rm ORDER BY tgl_kunjungan) AS kunjungan_sebelumnya
  FROM kunjungan WHERE status <> 'Batal'
)
SELECT r.no_rm, p.nama, r.tgl_kunjungan, r.kunjungan_sebelumnya,
  CAST(julianday(r.tgl_kunjungan) - julianday(r.kunjungan_sebelumnya) AS INTEGER) AS selisih_hari
FROM r JOIN pasien p ON p.no_rm = r.no_rm
ORDER BY r.no_rm, r.tgl_kunjungan;`,
        reason: 'row-count',
      },
      {
        label: 'LEAD tertukar dengan LAG (mengambil kunjungan BERIKUTNYA)',
        answer: `WITH r AS (
  SELECT no_rm, tgl_kunjungan, LEAD(tgl_kunjungan) OVER (PARTITION BY no_rm ORDER BY tgl_kunjungan) AS kunjungan_sebelumnya
  FROM kunjungan WHERE status <> 'Batal'
)
SELECT r.no_rm, p.nama, r.tgl_kunjungan, r.kunjungan_sebelumnya,
  CAST(julianday(r.tgl_kunjungan) - julianday(r.kunjungan_sebelumnya) AS INTEGER) AS selisih_hari
FROM r JOIN pasien p ON p.no_rm = r.no_rm
WHERE r.kunjungan_sebelumnya IS NOT NULL
ORDER BY r.no_rm, r.tgl_kunjungan;`,
        reason: 'cell-values',
      },
      {
        label: 'selisih terbalik (hasil negatif)',
        answer: `WITH r AS (
  SELECT no_rm, tgl_kunjungan, LAG(tgl_kunjungan) OVER (PARTITION BY no_rm ORDER BY tgl_kunjungan) AS kunjungan_sebelumnya
  FROM kunjungan WHERE status <> 'Batal'
)
SELECT r.no_rm, p.nama, r.tgl_kunjungan, r.kunjungan_sebelumnya,
  CAST(julianday(r.kunjungan_sebelumnya) - julianday(r.tgl_kunjungan) AS INTEGER) AS selisih_hari
FROM r JOIN pasien p ON p.no_rm = r.no_rm
WHERE r.kunjungan_sebelumnya IS NOT NULL
ORDER BY r.no_rm, r.tgl_kunjungan;`,
        reason: 'cell-values',
      },
      {
        label: 'hasil benar via subquery berkorelasi MAX() (tanpa LAG)',
        answer: `WITH r AS (
  SELECT k.no_rm, k.tgl_kunjungan,
    (SELECT MAX(k2.tgl_kunjungan) FROM kunjungan k2
     WHERE k2.no_rm = k.no_rm AND k2.status <> 'Batal' AND k2.tgl_kunjungan < k.tgl_kunjungan) AS kunjungan_sebelumnya
  FROM kunjungan k WHERE k.status <> 'Batal'
)
SELECT r.no_rm, p.nama, r.tgl_kunjungan, r.kunjungan_sebelumnya,
  CAST(julianday(r.tgl_kunjungan) - julianday(r.kunjungan_sebelumnya) AS INTEGER) AS selisih_hari
FROM r JOIN pasien p ON p.no_rm = r.no_rm
WHERE r.kunjungan_sebelumnya IS NOT NULL
ORDER BY r.no_rm, r.tgl_kunjungan;`,
        reason: 'missing-construct',
      },
    ],
    correct: [
      {
        label: 'named window untuk LAG()',
        answer: `WITH riwayat AS (
  SELECT k.no_rm, k.tgl_kunjungan, LAG(k.tgl_kunjungan) OVER w AS kunjungan_sebelumnya
  FROM kunjungan k
  WHERE k.status <> 'Batal'
  WINDOW w AS (PARTITION BY k.no_rm ORDER BY k.tgl_kunjungan, k.no_rawat)
)
SELECT r.no_rm, p.nama, r.tgl_kunjungan, r.kunjungan_sebelumnya,
  CAST(julianday(r.tgl_kunjungan) - julianday(r.kunjungan_sebelumnya) AS INTEGER) AS selisih_hari
FROM riwayat r JOIN pasien p ON p.no_rm = r.no_rm
WHERE r.kunjungan_sebelumnya IS NOT NULL
ORDER BY r.no_rm, r.tgl_kunjungan;`,
      },
      {
        label: 'tanpa CAST (julianday menghasilkan 17.0, setara 17) + subquery',
        answer: `select x.no_rm, p.nama, x.tgl_kunjungan, x.kunjungan_sebelumnya,
  julianday(x.tgl_kunjungan) - julianday(x.kunjungan_sebelumnya) as SELISIH_HARI
from (
  select no_rm, tgl_kunjungan, lag(tgl_kunjungan, 1) over (partition by no_rm order by tgl_kunjungan) as kunjungan_sebelumnya
  from kunjungan where status in ('Selesai', 'Dirawat')
) x join pasien p on p.no_rm = x.no_rm
where x.kunjungan_sebelumnya is not null
order by x.no_rm, x.tgl_kunjungan`,
      },
      {
        label: 'LEAD dengan urutan menurun (setara LAG menaik) + ROUND',
        answer: `WITH riwayat AS (
  SELECT no_rm, tgl_kunjungan,
    LEAD(tgl_kunjungan) OVER (PARTITION BY no_rm ORDER BY tgl_kunjungan DESC) AS kunjungan_sebelumnya
  FROM kunjungan WHERE status <> 'Batal'
)
SELECT r.no_rm, p.nama, r.tgl_kunjungan, r.kunjungan_sebelumnya,
  ROUND(julianday(r.tgl_kunjungan) - julianday(r.kunjungan_sebelumnya)) AS selisih_hari
FROM riwayat r JOIN pasien p ON p.no_rm = r.no_rm
WHERE r.kunjungan_sebelumnya IS NOT NULL
ORDER BY r.no_rm ASC, r.tgl_kunjungan ASC;`,
      },
    ],
  },
};
