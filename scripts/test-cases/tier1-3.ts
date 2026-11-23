/**
 * Kasus uji penilaian per misi untuk `npm run verify`.
 *
 * - `wrong`: query yang masuk akal tetapi SALAH → harus dinilai 'wrong' atau 'error'.
 *   `reason` (opsional) mengunci alasan mismatch yang diharapkan.
 * - `correct`: formulasi lain yang setara (huruf kecil, alias beda kapitalisasi,
 *   urutan JOIN ditukar, urutan baris berbeda untuk misi tanpa ORDER BY, dsb.)
 *   → harus dinilai 'correct'.
 * - Data seed sengaja memuat kasus batas (tagihan tepat 500000 & 5000000, kunjungan
 *   BPJS 'Dirawat' tanpa SEP) agar query yang menyimpang dari teks task benar-benar
 *   bisa dibedakan dan ditolak.
 */
import type { MissionTestCases } from './types';

export const TEST_CASES_CORE: Record<string, MissionTestCases> = {
  't1-select': {
    wrong: [
      { label: 'kolom kurang', answer: 'SELECT nama_dokter FROM dokter;', reason: 'column-count' },
      { label: 'urutan kolom tertukar', answer: 'SELECT spesialisasi, nama_dokter FROM dokter;', reason: 'column-names' },
      { label: 'typo nama tabel', answer: 'SELECT nama_dokter, spesialisasi FROM doktor;' },
    ],
    correct: [
      { label: 'huruf kecil + kolom kapital', answer: 'select NAMA_DOKTER, Spesialisasi from DOKTER' },
      { label: 'urutan baris berbeda', answer: 'SELECT nama_dokter, spesialisasi FROM dokter ORDER BY nama_dokter DESC;' },
    ],
  },
  't1-where': {
    wrong: [
      {
        label: 'tanpa tanda kurung (AND/OR)',
        answer: "SELECT no_rm, nama, kota FROM pasien WHERE penjamin = 'BPJS' AND kota = 'Jakarta' OR kota = 'Bogor';",
        reason: 'row-count',
      },
      { label: 'hanya Jakarta', answer: "SELECT no_rm, nama, kota FROM pasien WHERE penjamin = 'BPJS' AND kota = 'Jakarta';" },
    ],
    correct: [
      {
        label: 'IN + urutan bebas',
        answer: "select no_rm, nama, kota from pasien where kota in ('Bogor', 'Jakarta') and penjamin = 'BPJS' order by nama desc",
      },
    ],
  },
  't1-like': {
    wrong: [
      { label: "pola terlalu sempit 'I1%'", answer: "SELECT no_rawat, kode_icd10, nama_penyakit FROM diagnosa WHERE kode_icd10 LIKE 'I1%';" },
      { label: 'tanpa filter', answer: 'SELECT no_rawat, kode_icd10, nama_penyakit FROM diagnosa;', reason: 'row-count' },
    ],
    correct: [
      {
        label: 'SUBSTR setara LIKE',
        answer: "SELECT no_rawat, kode_icd10, nama_penyakit FROM diagnosa WHERE substr(kode_icd10, 1, 1) = 'I' ORDER BY id_diagnosa DESC;",
      },
      { label: "LIKE huruf kecil 'i%'", answer: "select no_rawat, kode_icd10, nama_penyakit from diagnosa where kode_icd10 like 'i%'" },
    ],
  },
  't1-order-limit': {
    wrong: [
      {
        label: 'urut menaik (data berbeda)',
        answer: 'SELECT no_rawat, total_biaya, status_bayar FROM billing ORDER BY total_biaya ASC LIMIT 5;',
        reason: 'cell-values',
      },
      {
        label: 'data benar tetapi urutan terbalik',
        answer: 'SELECT * FROM (SELECT no_rawat, total_biaya, status_bayar FROM billing ORDER BY total_biaya DESC, no_rawat LIMIT 5) ORDER BY total_biaya ASC;',
        reason: 'row-order',
      },
      { label: 'tanpa LIMIT', answer: 'SELECT no_rawat, total_biaya, status_bayar FROM billing ORDER BY total_biaya DESC;', reason: 'row-count' },
    ],
    correct: [
      { label: 'huruf kecil', answer: 'select no_rawat, total_biaya, status_bayar from billing order by total_biaya desc, no_rawat limit 5' },
      { label: 'ORDER BY nomor kolom', answer: 'SELECT b.no_rawat, b.total_biaya, b.status_bayar FROM billing AS b ORDER BY 2 DESC, 1 ASC LIMIT 5;' },
    ],
  },
  't1-distinct': {
    wrong: [{ label: 'tanpa DISTINCT', answer: 'SELECT kota FROM pasien;', reason: 'row-count' }],
    correct: [
      { label: 'GROUP BY setara DISTINCT', answer: 'SELECT kota FROM pasien GROUP BY kota ORDER BY kota DESC;' },
      { label: 'alias kapital', answer: 'select distinct p.kota AS KOTA from pasien p' },
    ],
  },
  't2-inner-join': {
    wrong: [
      {
        label: "membuang status 'Batal'",
        answer: `SELECT k.no_rawat, p.nama, pl.nama_poli, k.tgl_kunjungan
FROM kunjungan k JOIN pasien p ON k.no_rm = p.no_rm JOIN poliklinik pl ON k.id_poli = pl.id_poli
WHERE k.tgl_kunjungan >= '2026-11-01' AND k.status <> 'Batal';`,
        reason: 'row-count',
      },
      {
        label: 'kolom ambigu tanpa alias',
        answer: `SELECT no_rawat, nama, nama_poli, tgl_kunjungan
FROM kunjungan k JOIN pasien p ON k.no_rm = p.no_rm JOIN poliklinik pl ON k.id_poli = pl.id_poli
WHERE tgl_kunjungan >= '2026-11-01' AND id_poli IS NOT NULL;`,
      },
    ],
    correct: [
      {
        label: 'urutan JOIN ditukar + huruf kecil',
        answer: `select k.no_rawat, p.nama, pl.nama_poli, k.tgl_kunjungan
from pasien p
join kunjungan k on p.no_rm = k.no_rm
join poliklinik pl on pl.id_poli = k.id_poli
where k.tgl_kunjungan between '2026-11-01' and '2026-11-30'
order by k.tgl_kunjungan desc`,
      },
    ],
  },
  't2-left-join': {
    wrong: [
      {
        label: 'INNER JOIN (0 baris)',
        answer: 'SELECT p.no_rm, p.nama, p.penjamin FROM pasien p JOIN kunjungan k ON p.no_rm = k.no_rm WHERE k.no_rawat IS NULL;',
        reason: 'row-count',
      },
      {
        label: '= NULL bukan IS NULL',
        answer: 'SELECT p.no_rm, p.nama, p.penjamin FROM pasien p LEFT JOIN kunjungan k ON p.no_rm = k.no_rm WHERE k.no_rawat = NULL;',
        reason: 'row-count',
      },
    ],
    correct: [
      { label: 'NOT IN subquery', answer: 'SELECT no_rm, nama, penjamin FROM pasien WHERE no_rm NOT IN (SELECT no_rm FROM kunjungan) ORDER BY nama;' },
      {
        label: 'NOT EXISTS',
        answer: 'select p.no_rm, p.nama, p.penjamin from pasien p where not exists (select 1 from kunjungan k where k.no_rm = p.no_rm)',
      },
    ],
  },
  't2-count-group': {
    wrong: [
      { label: 'tanpa alias', answer: 'SELECT penjamin, COUNT(*) FROM pasien GROUP BY penjamin;', reason: 'column-names' },
      { label: 'tanpa GROUP BY', answer: 'SELECT penjamin, COUNT(*) AS jumlah_pasien FROM pasien;', reason: 'row-count' },
    ],
    correct: [{ label: 'COUNT(kolom) + alias kapital', answer: 'select penjamin, count(no_rm) as JUMLAH_PASIEN from pasien group by 1 order by 2' }],
  },
  't2-sum-avg': {
    wrong: [
      {
        label: 'tanpa GROUP BY',
        answer: `SELECT pl.nama_poli, SUM(b.total_biaya) AS total_pendapatan, ROUND(AVG(b.total_biaya), 2) AS rata_rata_tagihan
FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat JOIN poliklinik pl ON k.id_poli = pl.id_poli;`,
        reason: 'row-count',
      },
      {
        label: 'AVG dihitung dari COUNT yang salah (SUM/7)',
        answer: `SELECT pl.nama_poli, SUM(b.total_biaya) AS total_pendapatan, ROUND(SUM(b.total_biaya) / 7.0, 2) AS rata_rata_tagihan
FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat JOIN poliklinik pl ON k.id_poli = pl.id_poli
GROUP BY pl.nama_poli;`,
        reason: 'cell-values',
      },
    ],
    correct: [
      {
        label: 'mulai dari poliklinik, JOIN ditukar',
        answer: `select pl.nama_poli, sum(b.total_biaya) as Total_Pendapatan, round(avg(b.total_biaya), 2) as Rata_Rata_Tagihan
from poliklinik pl
join kunjungan k on k.id_poli = pl.id_poli
join billing b on b.no_rawat = k.no_rawat
group by pl.nama_poli
order by total_pendapatan desc`,
      },
    ],
  },
  't2-having': {
    wrong: [
      {
        label: 'HAVING > 2',
        answer: 'SELECT kode_icd10, nama_penyakit, COUNT(*) AS jumlah_kasus FROM diagnosa GROUP BY kode_icd10, nama_penyakit HAVING COUNT(*) > 2;',
        reason: 'row-count',
      },
      {
        label: 'agregat di WHERE',
        answer: 'SELECT kode_icd10, nama_penyakit, COUNT(*) AS jumlah_kasus FROM diagnosa WHERE COUNT(*) >= 2 GROUP BY kode_icd10, nama_penyakit;',
      },
    ],
    correct: [
      {
        label: 'subquery di FROM',
        answer: `SELECT kode_icd10, nama_penyakit, jumlah_kasus
FROM (SELECT kode_icd10, nama_penyakit, COUNT(*) AS jumlah_kasus FROM diagnosa GROUP BY kode_icd10, nama_penyakit)
WHERE jumlah_kasus >= 2
ORDER BY jumlah_kasus DESC;`,
      },
      {
        label: 'HAVING memakai alias',
        answer: 'select kode_icd10, nama_penyakit, count(id_diagnosa) as jumlah_kasus from diagnosa group by kode_icd10 having jumlah_kasus > 1',
      },
    ],
  },
  't3-bpjs-per-poli': {
    wrong: [
      {
        label: 'urutan terbalik (ASC)',
        answer: `SELECT pl.nama_poli, COUNT(*) AS jumlah_kunjungan
FROM kunjungan k JOIN pasien p ON k.no_rm = p.no_rm JOIN poliklinik pl ON k.id_poli = pl.id_poli
WHERE p.penjamin = 'BPJS' AND k.status <> 'Batal'
GROUP BY pl.nama_poli
ORDER BY jumlah_kunjungan ASC, pl.nama_poli DESC;`,
        reason: 'row-order',
      },
      {
        label: "tidak membuang 'Batal'",
        answer: `SELECT pl.nama_poli, COUNT(*) AS jumlah_kunjungan
FROM kunjungan k JOIN pasien p ON k.no_rm = p.no_rm JOIN poliklinik pl ON k.id_poli = pl.id_poli
WHERE p.penjamin = 'BPJS'
GROUP BY pl.nama_poli
ORDER BY jumlah_kunjungan DESC, pl.nama_poli ASC;`,
      },
    ],
    correct: [
      {
        label: 'huruf kecil, alias beda kapital, ORDER BY nomor',
        answer: `select pl.nama_poli as Nama_Poli, count(k.no_rawat) as Jumlah_Kunjungan
from poliklinik pl
join kunjungan k on k.id_poli = pl.id_poli
join pasien p on p.no_rm = k.no_rm
where p.penjamin = 'BPJS' and k.status != 'Batal'
group by pl.nama_poli
order by 2 desc, 1 asc`,
      },
    ],
  },
  't3-sep-kosong': {
    wrong: [
      {
        label: 'no_sep = NULL',
        answer: `SELECT k.no_rawat, p.nama, pl.nama_poli, k.tgl_kunjungan
FROM kunjungan k JOIN pasien p ON k.no_rm = p.no_rm JOIN poliklinik pl ON k.id_poli = pl.id_poli
WHERE p.penjamin = 'BPJS' AND k.status = 'Selesai' AND k.no_sep = NULL;`,
        reason: 'row-count',
      },
      {
        label: 'lupa syarat status',
        answer: `SELECT k.no_rawat, p.nama, pl.nama_poli, k.tgl_kunjungan
FROM kunjungan k JOIN pasien p ON k.no_rm = p.no_rm JOIN poliklinik pl ON k.id_poli = pl.id_poli
WHERE p.penjamin = 'BPJS' AND k.no_sep IS NULL;`,
        reason: 'row-count',
      },
      {
        label: "status <> 'Batal' (kunjungan BPJS 'Dirawat' tanpa SEP ikut terbawa)",
        answer: `SELECT k.no_rawat, p.nama, pl.nama_poli, k.tgl_kunjungan
FROM kunjungan k JOIN pasien p ON k.no_rm = p.no_rm JOIN poliklinik pl ON k.id_poli = pl.id_poli
WHERE p.penjamin = 'BPJS' AND k.status <> 'Batal' AND k.no_sep IS NULL;`,
        reason: 'row-count',
      },
    ],
    correct: [
      {
        label: 'urutan JOIN ditukar',
        answer: `SELECT k.no_rawat, p.nama, pl.nama_poli, k.tgl_kunjungan
FROM poliklinik pl
JOIN kunjungan k ON pl.id_poli = k.id_poli
JOIN pasien p ON p.no_rm = k.no_rm
WHERE k.no_sep IS NULL AND k.status = 'Selesai' AND p.penjamin = 'BPJS'
ORDER BY k.tgl_kunjungan DESC;`,
      },
    ],
  },
  't3-kinerja-dokter': {
    wrong: [
      {
        label: 'INNER JOIN ke billing (kunjungan Batal hilang)',
        answer: `SELECT d.nama_dokter, d.spesialisasi, COUNT(*) AS jumlah_kunjungan, COUNT(b.no_rawat) AS kunjungan_ditagih, SUM(b.total_biaya) AS total_pendapatan
FROM dokter d JOIN kunjungan k ON d.id_dokter = k.id_dokter JOIN billing b ON b.no_rawat = k.no_rawat
GROUP BY d.id_dokter
ORDER BY 3 DESC, 5 DESC, 1;`,
        reason: 'cell-values',
      },
      {
        label: "membuang 'Batal' dengan WHERE",
        answer: `SELECT d.nama_dokter, d.spesialisasi, COUNT(k.no_rawat) AS jumlah_kunjungan, COUNT(b.no_rawat) AS kunjungan_ditagih, COALESCE(SUM(b.total_biaya), 0) AS total_pendapatan
FROM dokter d JOIN kunjungan k ON d.id_dokter = k.id_dokter LEFT JOIN billing b ON k.no_rawat = b.no_rawat
WHERE k.status <> 'Batal'
GROUP BY d.id_dokter
ORDER BY jumlah_kunjungan DESC, total_pendapatan DESC, d.nama_dokter ASC;`,
        reason: 'cell-values',
      },
      {
        label: 'COUNT(*) untuk kunjungan_ditagih (NULL dari LEFT JOIN ikut terhitung)',
        answer: `SELECT d.nama_dokter, d.spesialisasi, COUNT(*) AS jumlah_kunjungan, COUNT(*) AS kunjungan_ditagih, COALESCE(SUM(b.total_biaya), 0) AS total_pendapatan
FROM dokter d JOIN kunjungan k ON d.id_dokter = k.id_dokter LEFT JOIN billing b ON k.no_rawat = b.no_rawat
GROUP BY d.id_dokter
ORDER BY jumlah_kunjungan DESC, total_pendapatan DESC, d.nama_dokter ASC;`,
        reason: 'cell-values',
      },
      {
        label: 'tanpa tie-break total_pendapatan',
        answer: `SELECT d.nama_dokter, d.spesialisasi, COUNT(*) AS jumlah_kunjungan, COUNT(b.no_rawat) AS kunjungan_ditagih, COALESCE(SUM(b.total_biaya), 0) AS total_pendapatan
FROM dokter d JOIN kunjungan k ON d.id_dokter = k.id_dokter LEFT JOIN billing b ON k.no_rawat = b.no_rawat
GROUP BY d.id_dokter
ORDER BY jumlah_kunjungan DESC;`,
        reason: 'row-order',
      },
      {
        label: 'tie-break nama_dokter sebelum total_pendapatan',
        answer: `SELECT d.nama_dokter, d.spesialisasi, COUNT(*) AS jumlah_kunjungan, COUNT(b.no_rawat) AS kunjungan_ditagih, COALESCE(SUM(b.total_biaya), 0) AS total_pendapatan
FROM dokter d JOIN kunjungan k ON d.id_dokter = k.id_dokter LEFT JOIN billing b ON k.no_rawat = b.no_rawat
GROUP BY d.id_dokter
ORDER BY jumlah_kunjungan DESC, d.nama_dokter ASC;`,
        reason: 'row-order',
      },
      {
        label: 'urut berdasarkan pendapatan dulu',
        answer: `SELECT d.nama_dokter, d.spesialisasi, COUNT(k.no_rawat) AS jumlah_kunjungan, COUNT(b.no_rawat) AS kunjungan_ditagih, COALESCE(SUM(b.total_biaya), 0) AS total_pendapatan
FROM dokter d JOIN kunjungan k ON d.id_dokter = k.id_dokter LEFT JOIN billing b ON k.no_rawat = b.no_rawat
GROUP BY d.id_dokter
ORDER BY total_pendapatan DESC, jumlah_kunjungan DESC, d.nama_dokter ASC;`,
        reason: 'row-order',
      },
    ],
    correct: [
      {
        label: 'huruf kecil, IFNULL, COUNT(id_billing), alias beda kapital',
        answer: `select d.nama_dokter, d.spesialisasi, count(*) as JUMLAH_KUNJUNGAN, count(b.id_billing) as Kunjungan_Ditagih, ifnull(sum(b.total_biaya), 0) as Total_Pendapatan
from kunjungan k
join dokter d on d.id_dokter = k.id_dokter
left join billing b on b.no_rawat = k.no_rawat
group by d.id_dokter
order by jumlah_kunjungan desc, total_pendapatan desc, d.nama_dokter`,
      },
      {
        label: 'subquery berkorelasi per dokter',
        answer: `SELECT d.nama_dokter, d.spesialisasi,
  (SELECT COUNT(*) FROM kunjungan k WHERE k.id_dokter = d.id_dokter) AS jumlah_kunjungan,
  (SELECT COUNT(*) FROM kunjungan k JOIN billing b ON b.no_rawat = k.no_rawat WHERE k.id_dokter = d.id_dokter) AS kunjungan_ditagih,
  (SELECT COALESCE(SUM(b.total_biaya), 0) FROM kunjungan k JOIN billing b ON b.no_rawat = k.no_rawat WHERE k.id_dokter = d.id_dokter) AS total_pendapatan
FROM dokter d
ORDER BY 3 DESC, 5 DESC, 1;`,
      },
    ],
  },
  't3-kategori-piutang': {
    wrong: [
      {
        label: 'urutan WHEN salah',
        answer: `SELECT b.no_rawat, p.nama, b.total_biaya,
  CASE WHEN b.total_biaya <= 5000000 THEN 'Sedang' WHEN b.total_biaya < 500000 THEN 'Kecil' ELSE 'Besar' END AS kategori
FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat JOIN pasien p ON k.no_rm = p.no_rm
WHERE b.status_bayar = 'Belum Lunas';`,
        reason: 'cell-values',
      },
      {
        label: 'tanpa filter status_bayar',
        answer: `SELECT b.no_rawat, p.nama, b.total_biaya,
  CASE WHEN b.total_biaya < 500000 THEN 'Kecil' WHEN b.total_biaya <= 5000000 THEN 'Sedang' ELSE 'Besar' END AS kategori
FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat JOIN pasien p ON k.no_rm = p.no_rm;`,
        reason: 'row-count',
      },
      {
        label: 'label huruf kecil',
        answer: `SELECT b.no_rawat, p.nama, b.total_biaya,
  CASE WHEN b.total_biaya < 500000 THEN 'kecil' WHEN b.total_biaya <= 5000000 THEN 'sedang' ELSE 'besar' END AS kategori
FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat JOIN pasien p ON k.no_rm = p.no_rm
WHERE b.status_bayar = 'Belum Lunas';`,
        reason: 'cell-values',
      },
      {
        label: 'batas 500000 salah masuk Kecil (<=) dan 5000000 salah masuk Besar (<)',
        answer: `SELECT b.no_rawat, p.nama, b.total_biaya,
  CASE WHEN b.total_biaya <= 500000 THEN 'Kecil' WHEN b.total_biaya < 5000000 THEN 'Sedang' ELSE 'Besar' END AS kategori
FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat JOIN pasien p ON k.no_rm = p.no_rm
WHERE b.status_bayar = 'Belum Lunas';`,
        reason: 'cell-values',
      },
      {
        label: 'BETWEEN untuk Sedang tapi Besar memakai >= 5000000 (urutan WHEN salah)',
        answer: `SELECT b.no_rawat, p.nama, b.total_biaya,
  CASE WHEN b.total_biaya >= 5000000 THEN 'Besar' WHEN b.total_biaya BETWEEN 500000 AND 5000000 THEN 'Sedang' ELSE 'Kecil' END AS kategori
FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat JOIN pasien p ON k.no_rm = p.no_rm
WHERE b.status_bayar = 'Belum Lunas';`,
        reason: 'cell-values',
      },
    ],
    correct: [
      {
        label: 'BETWEEN untuk Sedang',
        answer: `SELECT b.no_rawat, p.nama, b.total_biaya,
  CASE WHEN b.total_biaya < 500000 THEN 'Kecil' WHEN b.total_biaya BETWEEN 500000 AND 5000000 THEN 'Sedang' ELSE 'Besar' END AS kategori
FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat JOIN pasien p ON k.no_rm = p.no_rm
WHERE b.status_bayar = 'Belum Lunas';`,
      },
      {
        label: 'CASE dibalik (dari terbesar)',
        answer: `select b.no_rawat, p.nama, b.total_biaya,
  case when b.total_biaya > 5000000 then 'Besar' when b.total_biaya >= 500000 then 'Sedang' else 'Kecil' end as Kategori
from pasien p
join kunjungan k on k.no_rm = p.no_rm
join billing b on b.no_rawat = k.no_rawat
where b.status_bayar = 'Belum Lunas'
order by b.total_biaya desc`,
      },
    ],
  },
  't3-subquery-tagihan': {
    wrong: [
      {
        label: 'filter per tagihan di WHERE (sebelum SUM)',
        answer: `SELECT p.no_rm, p.nama, SUM(b.total_biaya) AS total_tagihan
FROM pasien p JOIN kunjungan k ON p.no_rm = k.no_rm JOIN billing b ON k.no_rawat = b.no_rawat
WHERE b.total_biaya > (SELECT AVG(total_biaya) FROM billing)
GROUP BY p.no_rm, p.nama;`,
      },
      {
        label: 'subquery mengembalikan 2 kolom',
        answer: `SELECT p.no_rm, p.nama, SUM(b.total_biaya) AS total_tagihan
FROM pasien p JOIN kunjungan k ON p.no_rm = k.no_rm JOIN billing b ON k.no_rawat = b.no_rawat
GROUP BY p.no_rm, p.nama
HAVING SUM(b.total_biaya) > (SELECT AVG(total_biaya), COUNT(*) FROM billing);`,
      },
    ],
    correct: [
      {
        label: 'CTE + WHERE',
        answer: `with per_pasien as (
  select p.no_rm, p.nama, sum(b.total_biaya) as total_tagihan
  from billing b
  join kunjungan k on k.no_rawat = b.no_rawat
  join pasien p on p.no_rm = k.no_rm
  group by p.no_rm, p.nama
)
select no_rm, nama, total_tagihan
from per_pasien
where total_tagihan > (select avg(total_biaya) from billing)
order by total_tagihan desc`,
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* Misi "Perbaiki Query" — starterSql (query bermasalah) juga diuji     */
  /* otomatis harus dinilai salah (scripts/verify/testCases.ts).          */
  /* ------------------------------------------------------------------ */
  't1-fix-tagihan': {
    wrong: [
      {
        label: 'hanya huruf kapital diperbaiki (masih ASC)',
        answer: "SELECT no_rawat, total_biaya FROM billing WHERE status_bayar = 'Belum Lunas' ORDER BY total_biaya LIMIT 3;",
      },
      {
        label: 'hanya DESC ditambahkan (masih kosong)',
        answer: "SELECT no_rawat, total_biaya FROM billing WHERE status_bayar = 'Belum lunas' ORDER BY total_biaya DESC LIMIT 3;",
        reason: 'row-count',
      },
      {
        label: 'LIMIT ikut diubah jadi 5',
        answer: "SELECT no_rawat, total_biaya FROM billing WHERE status_bayar = 'Belum Lunas' ORDER BY total_biaya DESC LIMIT 5;",
        reason: 'row-count',
      },
    ],
    correct: [
      {
        label: 'LIKE (tidak peka huruf besar/kecil)',
        answer: "select no_rawat, total_biaya from billing where status_bayar like 'belum lunas' order by total_biaya desc limit 3",
      },
      {
        label: 'LOWER(...) = ...',
        answer: "SELECT no_rawat, total_biaya FROM billing WHERE LOWER(status_bayar) = 'belum lunas' ORDER BY total_biaya DESC LIMIT 3;",
      },
    ],
  },
  't2-fix-left-join': {
    wrong: [
      {
        label: 'hanya syarat dipindah ke ON (masih COUNT(*))',
        answer: `SELECT d.nama_dokter, COUNT(*) AS jumlah_kunjungan
FROM dokter d
LEFT JOIN kunjungan k ON k.id_dokter = d.id_dokter AND k.tgl_kunjungan >= '2026-11-01'
GROUP BY d.id_dokter, d.nama_dokter;`,
        reason: 'cell-values',
      },
      {
        label: 'hanya COUNT diperbaiki (syarat masih di WHERE)',
        answer: `SELECT d.nama_dokter, COUNT(k.no_rawat) AS jumlah_kunjungan
FROM dokter d
LEFT JOIN kunjungan k ON k.id_dokter = d.id_dokter
WHERE k.tgl_kunjungan >= '2026-11-01'
GROUP BY d.id_dokter, d.nama_dokter;`,
        reason: 'row-count',
      },
      {
        label: 'WHERE ... OR k.no_rawat IS NULL (dokter dengan kunjungan Oktober tetap hilang)',
        answer: `SELECT d.nama_dokter, COUNT(k.no_rawat) AS jumlah_kunjungan
FROM dokter d
LEFT JOIN kunjungan k ON k.id_dokter = d.id_dokter
WHERE k.tgl_kunjungan >= '2026-11-01' OR k.no_rawat IS NULL
GROUP BY d.id_dokter, d.nama_dokter;`,
        reason: 'row-count',
      },
    ],
    correct: [
      {
        label: 'subquery berkorelasi',
        answer: `select d.nama_dokter,
  (select count(*) from kunjungan k where k.id_dokter = d.id_dokter and k.tgl_kunjungan >= '2026-11-01') as jumlah_kunjungan
from dokter d`,
      },
      {
        label: 'SUM(CASE ...) tanpa filter di JOIN',
        answer: `SELECT d.nama_dokter, SUM(CASE WHEN k.tgl_kunjungan >= '2026-11-01' THEN 1 ELSE 0 END) AS jumlah_kunjungan
FROM dokter d LEFT JOIN kunjungan k ON k.id_dokter = d.id_dokter
GROUP BY d.id_dokter, d.nama_dokter;`,
      },
    ],
  },
  't3-fix-persen': {
    wrong: [
      {
        label: 'kali 100 dulu tapi masih bilangan bulat',
        answer: `SELECT p.nama_poli, COUNT(*) AS total_kunjungan, COUNT(k.no_sep) * 100 / COUNT(*) AS persen_sep
FROM kunjungan k JOIN poliklinik p ON p.id_poli = k.id_poli GROUP BY p.id_poli, p.nama_poli;`,
        reason: 'cell-values',
      },
      {
        label: '100.0 dikalikan SETELAH pembagian bulat',
        answer: `SELECT p.nama_poli, COUNT(*) AS total_kunjungan, ROUND(COUNT(k.no_sep) / COUNT(*) * 100.0, 1) AS persen_sep
FROM kunjungan k JOIN poliklinik p ON p.id_poli = k.id_poli GROUP BY p.id_poli, p.nama_poli;`,
        reason: 'cell-values',
      },
      {
        label: 'dibulatkan tanpa desimal',
        answer: `SELECT p.nama_poli, COUNT(*) AS total_kunjungan, ROUND(COUNT(k.no_sep) * 100.0 / COUNT(*)) AS persen_sep
FROM kunjungan k JOIN poliklinik p ON p.id_poli = k.id_poli GROUP BY p.id_poli, p.nama_poli;`,
        reason: 'cell-values',
      },
    ],
    correct: [
      {
        label: '100.0 di depan',
        answer: `select p.nama_poli, count(*) as total_kunjungan, round(100.0 * count(k.no_sep) / count(*), 1) as persen_sep
from kunjungan k join poliklinik p on p.id_poli = k.id_poli group by p.id_poli, p.nama_poli`,
      },
      {
        label: 'CAST ... AS REAL',
        answer: `SELECT p.nama_poli, COUNT(*) AS total_kunjungan, ROUND(CAST(COUNT(k.no_sep) AS REAL) / COUNT(*) * 100, 1) AS persen_sep
FROM kunjungan k JOIN poliklinik p ON p.id_poli = k.id_poli GROUP BY p.id_poli, p.nama_poli;`,
      },
    ],
  },
  't3-fix-fan-out': {
    wrong: [
      {
        label: 'SUM(DISTINCT) tetapi COUNT masih ganda',
        answer: `SELECT k.no_rm, COUNT(*) AS jumlah_kunjungan, SUM(DISTINCT b.total_biaya) AS total_tagihan
FROM kunjungan k
JOIN billing b ON b.no_rawat = k.no_rawat
JOIN diagnosa d ON d.no_rawat = k.no_rawat
WHERE d.kode_icd10 IN ('I10', 'E11.9')
GROUP BY k.no_rm;`,
        reason: 'cell-values',
      },
      {
        label: 'hanya I10',
        answer: `SELECT k.no_rm, COUNT(*) AS jumlah_kunjungan, SUM(b.total_biaya) AS total_tagihan
FROM kunjungan k JOIN billing b ON b.no_rawat = k.no_rawat
WHERE EXISTS (SELECT 1 FROM diagnosa d WHERE d.no_rawat = k.no_rawat AND d.kode_icd10 = 'I10')
GROUP BY k.no_rm;`,
      },
    ],
    correct: [
      {
        label: 'EXISTS huruf kecil',
        answer: `select k.no_rm, count(*) as jumlah_kunjungan, sum(b.total_biaya) as total_tagihan
from kunjungan k join billing b on b.no_rawat = k.no_rawat
where exists (select 1 from diagnosa d where d.no_rawat = k.no_rawat and d.kode_icd10 in ('I10', 'E11.9'))
group by k.no_rm`,
      },
      {
        label: 'CTE kunjungan unik',
        answer: `WITH kronis AS (
  SELECT DISTINCT no_rawat FROM diagnosa WHERE kode_icd10 IN ('I10', 'E11.9')
)
SELECT k.no_rm, COUNT(*) AS jumlah_kunjungan, SUM(b.total_biaya) AS total_tagihan
FROM kronis c
JOIN kunjungan k ON k.no_rawat = c.no_rawat
JOIN billing b ON b.no_rawat = k.no_rawat
GROUP BY k.no_rm;`,
      },
    ],
  },
};
