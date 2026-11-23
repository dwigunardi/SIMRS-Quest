/**
 * Kasus uji Tier 4 – CTE, JOIN Lanjutan & Rekursif.
 * Setiap misi (kecuali misi Perbaiki Query t4-fix-not-in) punya minimal satu kasus 'missing-construct': hasilnya identik dengan
 * expected output, tetapi tidak memakai konstruksi yang diwajibkan requiredPatterns.
 * Kasus yang hasilnya salah SEKALIGUS tidak memakai konstruksi wajib sengaja tidak diberi `reason`,
 * karena alasan yang dilaporkan bergantung pada urutan pemeriksaan di validator.
 */
import type { MissionTestCases } from './types';

export const TEST_CASES_TIER4: Record<string, MissionTestCases> = {
  't4-min-max': {
    wrong: [
      {
        label: 'MIN/MAX tagihan tertukar',
        answer: `SELECT pl.nama_poli, MIN(k.tgl_kunjungan) AS kunjungan_pertama, MAX(k.tgl_kunjungan) AS kunjungan_terakhir,
  MAX(b.total_biaya) AS tagihan_terkecil, MIN(b.total_biaya) AS tagihan_terbesar
FROM kunjungan k JOIN poliklinik pl ON k.id_poli = pl.id_poli LEFT JOIN billing b ON k.no_rawat = b.no_rawat
GROUP BY pl.id_poli, pl.nama_poli ORDER BY pl.nama_poli;`,
        reason: 'cell-values',
      },
      {
        label: 'lupa GROUP BY (hanya 1 baris)',
        answer: `SELECT MIN(pl.nama_poli) AS nama_poli, MIN(k.tgl_kunjungan) AS kunjungan_pertama, MAX(k.tgl_kunjungan) AS kunjungan_terakhir,
  MIN(b.total_biaya) AS tagihan_terkecil, MAX(b.total_biaya) AS tagihan_terbesar
FROM kunjungan k JOIN poliklinik pl ON k.id_poli = pl.id_poli LEFT JOIN billing b ON k.no_rawat = b.no_rawat;`,
        reason: 'row-count',
      },
      {
        label: 'dikelompokkan per gedung, bukan per poli',
        answer: `SELECT pl.gedung AS nama_poli, MIN(k.tgl_kunjungan) AS kunjungan_pertama, MAX(k.tgl_kunjungan) AS kunjungan_terakhir,
  MIN(b.total_biaya) AS tagihan_terkecil, MAX(b.total_biaya) AS tagihan_terbesar
FROM kunjungan k JOIN poliklinik pl ON k.id_poli = pl.id_poli LEFT JOIN billing b ON k.no_rawat = b.no_rawat
GROUP BY pl.gedung ORDER BY pl.gedung;`,
        reason: 'row-count',
      },
      {
        label: 'hasil benar via ORDER BY ... LIMIT 1 tanpa MIN/MAX',
        answer: `SELECT pl.nama_poli,
  (SELECT k.tgl_kunjungan FROM kunjungan k WHERE k.id_poli = pl.id_poli ORDER BY k.tgl_kunjungan LIMIT 1) AS kunjungan_pertama,
  (SELECT k.tgl_kunjungan FROM kunjungan k WHERE k.id_poli = pl.id_poli ORDER BY k.tgl_kunjungan DESC LIMIT 1) AS kunjungan_terakhir,
  (SELECT b.total_biaya FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat WHERE k.id_poli = pl.id_poli ORDER BY b.total_biaya LIMIT 1) AS tagihan_terkecil,
  (SELECT b.total_biaya FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat WHERE k.id_poli = pl.id_poli ORDER BY b.total_biaya DESC LIMIT 1) AS tagihan_terbesar
FROM poliklinik pl ORDER BY pl.nama_poli;`,
        reason: 'missing-construct',
      },
    ],
    correct: [
      {
        label: 'huruf kecil + alias kapital',
        answer: `select pl.nama_poli AS NAMA_POLI, min(k.tgl_kunjungan) as Kunjungan_Pertama, max(k.tgl_kunjungan) as KUNJUNGAN_TERAKHIR,
  min(b.total_biaya) as tagihan_terkecil, max(b.total_biaya) as tagihan_terbesar
from poliklinik pl join kunjungan k on k.id_poli = pl.id_poli left join billing b on b.no_rawat = k.no_rawat
group by pl.nama_poli order by 1`,
      },
      {
        label: 'tanggal dan tagihan direkap terpisah lalu digabung',
        answer: `WITH tgl AS (
  SELECT id_poli, MIN(tgl_kunjungan) AS pertama, MAX(tgl_kunjungan) AS terakhir FROM kunjungan GROUP BY id_poli
), tagihan AS (
  SELECT k.id_poli, MIN(b.total_biaya) AS kecil, MAX(b.total_biaya) AS besar
  FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat GROUP BY k.id_poli
)
SELECT pl.nama_poli, t.pertama AS kunjungan_pertama, t.terakhir AS kunjungan_terakhir,
  g.kecil AS tagihan_terkecil, g.besar AS tagihan_terbesar
FROM poliklinik pl JOIN tgl t ON t.id_poli = pl.id_poli LEFT JOIN tagihan g ON g.id_poli = pl.id_poli
ORDER BY pl.nama_poli ASC;`,
      },
    ],
  },

  't4-cte': {
    wrong: [
      {
        label: 'pembagian integer (100 * a / b): Poli Kandungan 2,13% terbaca 2 sehingga tersaring',
        answer: `WITH rekap AS (
  SELECT k.id_poli, COUNT(*) AS jumlah_tagihan, SUM(b.total_biaya) AS total_pendapatan
  FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat GROUP BY k.id_poli
)
SELECT pl.nama_poli, r.jumlah_tagihan, r.total_pendapatan,
  ROUND(100 * r.total_pendapatan / (SELECT SUM(total_pendapatan) FROM rekap), 2) AS kontribusi_persen
FROM rekap r JOIN poliklinik pl ON pl.id_poli = r.id_poli
WHERE 100 * r.total_pendapatan / (SELECT SUM(total_pendapatan) FROM rekap) > 2
ORDER BY r.total_pendapatan DESC;`,
        reason: 'row-count',
      },
      {
        label: 'lupa menyaring kontribusi > 2',
        answer: `WITH rekap AS (
  SELECT k.id_poli, COUNT(*) AS jumlah_tagihan, SUM(b.total_biaya) AS total_pendapatan
  FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat GROUP BY k.id_poli
)
SELECT pl.nama_poli, r.jumlah_tagihan, r.total_pendapatan,
  ROUND(100.0 * r.total_pendapatan / (SELECT SUM(total_pendapatan) FROM rekap), 2) AS kontribusi_persen
FROM rekap r JOIN poliklinik pl ON pl.id_poli = r.id_poli
ORDER BY r.total_pendapatan DESC;`,
        reason: 'row-count',
      },
      {
        label: 'hanya tagihan Lunas',
        answer: `WITH rekap AS (
  SELECT k.id_poli, COUNT(*) AS jumlah_tagihan, SUM(b.total_biaya) AS total_pendapatan
  FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat WHERE b.status_bayar = 'Lunas' GROUP BY k.id_poli
)
SELECT pl.nama_poli, r.jumlah_tagihan, r.total_pendapatan,
  ROUND(100.0 * r.total_pendapatan / (SELECT SUM(total_pendapatan) FROM rekap), 2) AS kontribusi_persen
FROM rekap r JOIN poliklinik pl ON pl.id_poli = r.id_poli
WHERE 100.0 * r.total_pendapatan / (SELECT SUM(total_pendapatan) FROM rekap) > 2
ORDER BY r.total_pendapatan DESC;`,
      },
      {
        label: 'urutan terbalik (terkecil dulu)',
        answer: `WITH rekap AS (
  SELECT k.id_poli, COUNT(*) AS jumlah_tagihan, SUM(b.total_biaya) AS total_pendapatan
  FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat GROUP BY k.id_poli
)
SELECT pl.nama_poli, r.jumlah_tagihan, r.total_pendapatan,
  ROUND(100.0 * r.total_pendapatan / (SELECT SUM(total_pendapatan) FROM rekap), 2) AS kontribusi_persen
FROM rekap r JOIN poliklinik pl ON pl.id_poli = r.id_poli
WHERE 100.0 * r.total_pendapatan / (SELECT SUM(total_pendapatan) FROM rekap) > 2
ORDER BY r.total_pendapatan ASC;`,
        reason: 'row-order',
      },
      {
        label: 'hasil benar dengan subquery bertumpuk tanpa CTE',
        answer: `SELECT pl.nama_poli, r.jumlah_tagihan, r.total_pendapatan,
  ROUND(100.0 * r.total_pendapatan / (SELECT SUM(total_biaya) FROM billing), 2) AS kontribusi_persen
FROM (
  SELECT k.id_poli, COUNT(*) AS jumlah_tagihan, SUM(b.total_biaya) AS total_pendapatan
  FROM billing b JOIN kunjungan k ON b.no_rawat = k.no_rawat GROUP BY k.id_poli
) r JOIN poliklinik pl ON pl.id_poli = r.id_poli
WHERE 100.0 * r.total_pendapatan / (SELECT SUM(total_biaya) FROM billing) > 2
ORDER BY r.total_pendapatan DESC;`,
        reason: 'missing-construct',
      },
    ],
    correct: [
      {
        label: 'satu CTE dibaca dua kali + CTE pembungkus untuk filter alias',
        answer: `with rekap as (
  select k.id_poli, count(*) as jumlah_tagihan, sum(b.total_biaya) as total_pendapatan
  from billing b join kunjungan k on b.no_rawat = k.no_rawat group by k.id_poli
), hasil as (
  select pl.nama_poli, r.jumlah_tagihan, r.total_pendapatan,
    round(100.0 * r.total_pendapatan / (select sum(total_pendapatan) from rekap), 2) as kontribusi_persen
  from rekap r join poliklinik pl on pl.id_poli = r.id_poli
)
select NAMA_POLI, Jumlah_Tagihan, total_pendapatan, KONTRIBUSI_PERSEN from hasil
where kontribusi_persen > 2 order by total_pendapatan desc`,
      },
      {
        label: 'CTE berisi nama poli, total dari window SUM() OVER ()',
        answer: `WITH rekap AS (
  SELECT pl.nama_poli, COUNT(*) AS jumlah_tagihan, SUM(b.total_biaya) AS total_pendapatan
  FROM billing b
  JOIN kunjungan k ON b.no_rawat = k.no_rawat
  JOIN poliklinik pl ON pl.id_poli = k.id_poli
  GROUP BY pl.id_poli, pl.nama_poli
), persen AS (
  SELECT nama_poli, jumlah_tagihan, total_pendapatan,
    ROUND(total_pendapatan * 100.0 / SUM(total_pendapatan) OVER (), 2) AS kontribusi_persen
  FROM rekap
)
SELECT * FROM persen WHERE kontribusi_persen > 2 ORDER BY total_pendapatan DESC;`,
      },
    ],
  },

  't4-full-outer-join': {
    wrong: [
      {
        label: 'INNER JOIN membuang Poli Kandungan & Poli Gigi',
        answer: `WITH okt AS (
  SELECT id_poli, COUNT(*) AS jumlah FROM kunjungan
  WHERE status <> 'Batal' AND tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31' GROUP BY id_poli
), nov AS (
  SELECT id_poli, COUNT(*) AS jumlah FROM kunjungan
  WHERE status <> 'Batal' AND tgl_kunjungan BETWEEN '2026-11-01' AND '2026-11-30' GROUP BY id_poli
)
SELECT pl.nama_poli, COALESCE(okt.jumlah, 0) AS kunjungan_oktober, COALESCE(nov.jumlah, 0) AS kunjungan_november,
  COALESCE(nov.jumlah, 0) - COALESCE(okt.jumlah, 0) AS selisih
FROM okt INNER JOIN nov ON okt.id_poli = nov.id_poli
JOIN poliklinik pl ON pl.id_poli = okt.id_poli
ORDER BY pl.nama_poli;`,
      },
      {
        label: 'LEFT JOIN Oktober → November membuang Poli Gigi',
        answer: `WITH okt AS (
  SELECT id_poli, COUNT(*) AS jumlah FROM kunjungan
  WHERE status <> 'Batal' AND tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31' GROUP BY id_poli
), nov AS (
  SELECT id_poli, COUNT(*) AS jumlah FROM kunjungan
  WHERE status <> 'Batal' AND tgl_kunjungan BETWEEN '2026-11-01' AND '2026-11-30' GROUP BY id_poli
)
SELECT pl.nama_poli, COALESCE(okt.jumlah, 0) AS kunjungan_oktober, COALESCE(nov.jumlah, 0) AS kunjungan_november,
  COALESCE(nov.jumlah, 0) - COALESCE(okt.jumlah, 0) AS selisih
FROM okt LEFT JOIN nov ON okt.id_poli = nov.id_poli
JOIN poliklinik pl ON pl.id_poli = okt.id_poli
ORDER BY pl.nama_poli;`,
      },
      {
        label: 'tanpa COALESCE (NULL, bukan 0)',
        answer: `WITH okt AS (
  SELECT id_poli, COUNT(*) AS jumlah FROM kunjungan
  WHERE status <> 'Batal' AND tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31' GROUP BY id_poli
), nov AS (
  SELECT id_poli, COUNT(*) AS jumlah FROM kunjungan
  WHERE status <> 'Batal' AND tgl_kunjungan BETWEEN '2026-11-01' AND '2026-11-30' GROUP BY id_poli
)
SELECT pl.nama_poli, okt.jumlah AS kunjungan_oktober, nov.jumlah AS kunjungan_november,
  nov.jumlah - okt.jumlah AS selisih
FROM okt FULL OUTER JOIN nov ON okt.id_poli = nov.id_poli
JOIN poliklinik pl ON pl.id_poli = COALESCE(okt.id_poli, nov.id_poli)
ORDER BY pl.nama_poli;`,
        reason: 'cell-values',
      },
      {
        label: "kunjungan 'Batal' ikut dihitung",
        answer: `WITH okt AS (
  SELECT id_poli, COUNT(*) AS jumlah FROM kunjungan
  WHERE tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31' GROUP BY id_poli
), nov AS (
  SELECT id_poli, COUNT(*) AS jumlah FROM kunjungan
  WHERE tgl_kunjungan BETWEEN '2026-11-01' AND '2026-11-30' GROUP BY id_poli
)
SELECT pl.nama_poli, COALESCE(okt.jumlah, 0) AS kunjungan_oktober, COALESCE(nov.jumlah, 0) AS kunjungan_november,
  COALESCE(nov.jumlah, 0) - COALESCE(okt.jumlah, 0) AS selisih
FROM okt FULL OUTER JOIN nov ON okt.id_poli = nov.id_poli
JOIN poliklinik pl ON pl.id_poli = COALESCE(okt.id_poli, nov.id_poli)
ORDER BY pl.nama_poli;`,
        reason: 'cell-values',
      },
      {
        label: 'hasil benar via LEFT JOIN + SUM(CASE) tanpa FULL OUTER JOIN',
        answer: `SELECT pl.nama_poli,
  SUM(CASE WHEN k.tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31' THEN 1 ELSE 0 END) AS kunjungan_oktober,
  SUM(CASE WHEN k.tgl_kunjungan BETWEEN '2026-11-01' AND '2026-11-30' THEN 1 ELSE 0 END) AS kunjungan_november,
  SUM(CASE WHEN k.tgl_kunjungan BETWEEN '2026-11-01' AND '2026-11-30' THEN 1 ELSE 0 END)
    - SUM(CASE WHEN k.tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31' THEN 1 ELSE 0 END) AS selisih
FROM poliklinik pl
LEFT JOIN kunjungan k ON k.id_poli = pl.id_poli AND k.status <> 'Batal'
GROUP BY pl.id_poli, pl.nama_poli
ORDER BY pl.nama_poli;`,
        reason: 'missing-construct',
      },
    ],
    correct: [
      {
        label: 'subquery + FULL JOIN (tanpa kata OUTER), sisi ditukar',
        answer: `select pl.nama_poli,
  coalesce(o.jml, 0) as Kunjungan_Oktober,
  coalesce(n.jml, 0) as KUNJUNGAN_NOVEMBER,
  coalesce(n.jml, 0) - coalesce(o.jml, 0) as selisih
from (select id_poli, count(*) jml from kunjungan where status != 'Batal' and tgl_kunjungan like '2026-11-%' group by id_poli) n
full join (select id_poli, count(*) jml from kunjungan where status != 'Batal' and tgl_kunjungan like '2026-10-%' group by id_poli) o
  on o.id_poli = n.id_poli
join poliklinik pl on pl.id_poli = coalesce(n.id_poli, o.id_poli)
order by pl.nama_poli asc`,
      },
      {
        label: 'CTE dengan nama poli, COALESCE pada nama',
        answer: `WITH okt AS (
  SELECT pl.nama_poli, COUNT(*) AS jumlah FROM kunjungan k JOIN poliklinik pl ON pl.id_poli = k.id_poli
  WHERE k.status IN ('Selesai', 'Dirawat') AND k.tgl_kunjungan >= '2026-10-01' AND k.tgl_kunjungan < '2026-11-01'
  GROUP BY pl.nama_poli
), nov AS (
  SELECT pl.nama_poli, COUNT(*) AS jumlah FROM kunjungan k JOIN poliklinik pl ON pl.id_poli = k.id_poli
  WHERE k.status IN ('Selesai', 'Dirawat') AND k.tgl_kunjungan >= '2026-11-01' AND k.tgl_kunjungan < '2026-12-01'
  GROUP BY pl.nama_poli
)
SELECT COALESCE(okt.nama_poli, nov.nama_poli) AS nama_poli,
  COALESCE(okt.jumlah, 0) AS kunjungan_oktober,
  COALESCE(nov.jumlah, 0) AS kunjungan_november,
  COALESCE(nov.jumlah, 0) - COALESCE(okt.jumlah, 0) AS selisih
FROM okt FULL OUTER JOIN nov ON okt.nama_poli = nov.nama_poli
ORDER BY 1;`,
      },
    ],
  },

  't4-cross-join': {
    wrong: [
      {
        label: 'GROUP BY langsung dari kunjungan (kombinasi nol hilang)',
        answer: `SELECT pl.nama_poli, k.status, COUNT(*) AS jumlah_kunjungan
FROM kunjungan k JOIN poliklinik pl ON pl.id_poli = k.id_poli
GROUP BY pl.nama_poli, k.status ORDER BY pl.nama_poli, k.status;`,
      },
      {
        label: 'COUNT(*) menghitung baris kosong LEFT JOIN sebagai 1',
        answer: `WITH s(status) AS (VALUES ('Batal'), ('Dirawat'), ('Selesai'))
SELECT pl.nama_poli, s.status, COUNT(*) AS jumlah_kunjungan
FROM poliklinik pl CROSS JOIN s
LEFT JOIN kunjungan k ON k.id_poli = pl.id_poli AND k.status = s.status
GROUP BY pl.nama_poli, s.status ORDER BY pl.nama_poli, s.status;`,
        reason: 'cell-values',
      },
      {
        label: 'syarat status di WHERE (LEFT JOIN berubah jadi INNER)',
        answer: `WITH s(status) AS (VALUES ('Batal'), ('Dirawat'), ('Selesai'))
SELECT pl.nama_poli, s.status, COUNT(k.no_rawat) AS jumlah_kunjungan
FROM poliklinik pl CROSS JOIN s
LEFT JOIN kunjungan k ON k.id_poli = pl.id_poli
WHERE k.status = s.status
GROUP BY pl.nama_poli, s.status ORDER BY pl.nama_poli, s.status;`,
        reason: 'row-count',
      },
      {
        label: 'urutan status tidak A–Z',
        answer: `WITH s(status) AS (VALUES ('Batal'), ('Dirawat'), ('Selesai'))
SELECT pl.nama_poli, s.status, COUNT(k.no_rawat) AS jumlah_kunjungan
FROM poliklinik pl CROSS JOIN s
LEFT JOIN kunjungan k ON k.id_poli = pl.id_poli AND k.status = s.status
GROUP BY pl.nama_poli, s.status ORDER BY pl.nama_poli, s.status DESC;`,
        reason: 'row-order',
      },
      {
        label: 'hasil benar tetapi perkalian ditulis dengan koma (tanpa CROSS JOIN)',
        answer: `SELECT pl.nama_poli, s.status, COUNT(k.no_rawat) AS jumlah_kunjungan
FROM poliklinik pl, (SELECT DISTINCT status FROM kunjungan) s
LEFT JOIN kunjungan k ON k.id_poli = pl.id_poli AND k.status = s.status
GROUP BY pl.nama_poli, s.status ORDER BY pl.nama_poli, s.status;`,
        reason: 'missing-construct',
      },
    ],
    correct: [
      {
        label: 'status dari SELECT DISTINCT + huruf kecil',
        answer: `select pl.nama_poli, s.status AS STATUS, count(k.no_rawat) as Jumlah_Kunjungan
from poliklinik pl
cross join (select distinct status from kunjungan) s
left join kunjungan k on k.id_poli = pl.id_poli and k.status = s.status
group by pl.id_poli, s.status
order by pl.nama_poli, s.status`,
      },
      {
        label: 'CROSS JOIN + subquery berkorelasi untuk menghitung',
        answer: `WITH daftar_status(status) AS (SELECT 'Selesai' UNION SELECT 'Dirawat' UNION SELECT 'Batal')
SELECT pl.nama_poli, ds.status,
  (SELECT COUNT(*) FROM kunjungan k WHERE k.id_poli = pl.id_poli AND k.status = ds.status) AS jumlah_kunjungan
FROM poliklinik pl CROSS JOIN daftar_status ds
ORDER BY pl.nama_poli ASC, ds.status ASC;`,
      },
    ],
  },

  't4-recursive-org': {
    wrong: [
      {
        label: 'level dimulai dari 0',
        answer: `WITH RECURSIVE h AS (
  SELECT id_jabatan, nama_jabatan, 0 AS level, nama_jabatan AS jalur FROM struktur_organisasi WHERE id_atasan IS NULL
  UNION ALL
  SELECT s.id_jabatan, s.nama_jabatan, h.level + 1, h.jalur || ' > ' || s.nama_jabatan
  FROM struktur_organisasi s JOIN h ON s.id_atasan = h.id_jabatan
)
SELECT id_jabatan, nama_jabatan, level, jalur FROM h ORDER BY jalur;`,
        reason: 'cell-values',
      },
      {
        label: 'rekursi dibatasi level < 4 (berhenti terlalu cepat)',
        answer: `WITH RECURSIVE h AS (
  SELECT id_jabatan, nama_jabatan, 1 AS level, nama_jabatan AS jalur FROM struktur_organisasi WHERE id_atasan IS NULL
  UNION ALL
  SELECT s.id_jabatan, s.nama_jabatan, h.level + 1, h.jalur || ' > ' || s.nama_jabatan
  FROM struktur_organisasi s JOIN h ON s.id_atasan = h.id_jabatan
  WHERE h.level < 3
)
SELECT id_jabatan, nama_jabatan, level, jalur FROM h ORDER BY jalur;`,
        reason: 'row-count',
      },
      {
        label: 'pemisah jalur tanpa spasi',
        answer: `WITH RECURSIVE h AS (
  SELECT id_jabatan, nama_jabatan, 1 AS level, nama_jabatan AS jalur FROM struktur_organisasi WHERE id_atasan IS NULL
  UNION ALL
  SELECT s.id_jabatan, s.nama_jabatan, h.level + 1, h.jalur || '>' || s.nama_jabatan
  FROM struktur_organisasi s JOIN h ON s.id_atasan = h.id_jabatan
)
SELECT id_jabatan, nama_jabatan, level, jalur FROM h ORDER BY jalur;`,
        reason: 'cell-values',
      },
      {
        label: 'diurutkan per level, bukan per jalur',
        answer: `WITH RECURSIVE h AS (
  SELECT id_jabatan, nama_jabatan, 1 AS level, nama_jabatan AS jalur FROM struktur_organisasi WHERE id_atasan IS NULL
  UNION ALL
  SELECT s.id_jabatan, s.nama_jabatan, h.level + 1, h.jalur || ' > ' || s.nama_jabatan
  FROM struktur_organisasi s JOIN h ON s.id_atasan = h.id_jabatan
)
SELECT id_jabatan, nama_jabatan, level, jalur FROM h ORDER BY level, id_jabatan;`,
        reason: 'row-order',
      },
      {
        label: 'anchor tanpa filter id_atasan IS NULL (setiap jabatan jadi akar)',
        answer: `WITH RECURSIVE h AS (
  SELECT id_jabatan, nama_jabatan, 1 AS level, nama_jabatan AS jalur FROM struktur_organisasi
  UNION ALL
  SELECT s.id_jabatan, s.nama_jabatan, h.level + 1, h.jalur || ' > ' || s.nama_jabatan
  FROM struktur_organisasi s JOIN h ON s.id_atasan = h.id_jabatan
)
SELECT id_jabatan, nama_jabatan, level, jalur FROM h ORDER BY jalur;`,
        reason: 'row-count',
      },
      {
        label: 'hasil benar tetapi tanpa kata RECURSIVE (lolos di SQLite saja)',
        answer: `WITH h AS (
  SELECT id_jabatan, nama_jabatan, 1 AS level, nama_jabatan AS jalur FROM struktur_organisasi WHERE id_atasan IS NULL
  UNION ALL
  SELECT s.id_jabatan, s.nama_jabatan, h.level + 1, h.jalur || ' > ' || s.nama_jabatan
  FROM struktur_organisasi s JOIN h ON s.id_atasan = h.id_jabatan
)
SELECT id_jabatan, nama_jabatan, level, jalur FROM h ORDER BY jalur;`,
        reason: 'missing-construct',
      },
    ],
    correct: [
      {
        label: 'huruf kecil, nama kolom CTE di header, printf untuk jalur',
        answer: `with recursive bagan(id_jabatan, nama_jabatan, level, jalur) as (
  select id_jabatan, nama_jabatan, 1, nama_jabatan from struktur_organisasi where id_atasan is null
  union all
  select s.id_jabatan, s.nama_jabatan, b.level + 1, printf('%s > %s', b.jalur, s.nama_jabatan)
  from bagan b join struktur_organisasi s on s.id_atasan = b.id_jabatan
)
select ID_JABATAN, Nama_Jabatan, LEVEL, JALUR from bagan order by jalur asc`,
      },
      {
        label: 'anchor memakai id J01 + UNION (bukan UNION ALL)',
        answer: `WITH RECURSIVE hirarki AS (
  SELECT id_jabatan, nama_jabatan, 1 AS level, nama_jabatan AS jalur
  FROM struktur_organisasi WHERE id_jabatan = 'J01'
  UNION
  SELECT anak.id_jabatan, anak.nama_jabatan, induk.level + 1, induk.jalur || ' > ' || anak.nama_jabatan
  FROM hirarki induk JOIN struktur_organisasi anak ON anak.id_atasan = induk.id_jabatan
)
SELECT * FROM hirarki ORDER BY jalur;`,
      },
    ],
  },

  't4-recursive-dates': {
    wrong: [
      {
        label: "syarat 'Batal' di WHERE (tanggal kosong hilang lagi)",
        answer: `WITH RECURSIVE kalender(tanggal) AS (
  SELECT '2026-10-01' UNION ALL SELECT date(tanggal, '+1 day') FROM kalender WHERE tanggal < '2026-10-15'
)
SELECT c.tanggal, COUNT(k.no_rawat) AS jumlah_kunjungan
FROM kalender c LEFT JOIN kunjungan k ON k.tgl_kunjungan = c.tanggal
WHERE k.status <> 'Batal'
GROUP BY c.tanggal ORDER BY c.tanggal;`,
        reason: 'row-count',
      },
      {
        label: 'COUNT(*) menghitung hari kosong sebagai 1',
        answer: `WITH RECURSIVE kalender(tanggal) AS (
  SELECT '2026-10-01' UNION ALL SELECT date(tanggal, '+1 day') FROM kalender WHERE tanggal < '2026-10-15'
)
SELECT c.tanggal, COUNT(*) AS jumlah_kunjungan
FROM kalender c LEFT JOIN kunjungan k ON k.tgl_kunjungan = c.tanggal AND k.status <> 'Batal'
GROUP BY c.tanggal ORDER BY c.tanggal;`,
        reason: 'cell-values',
      },
      {
        label: "off-by-one: berhenti di '2026-10-14'",
        answer: `WITH RECURSIVE kalender(tanggal) AS (
  SELECT '2026-10-01' UNION ALL SELECT date(tanggal, '+1 day') FROM kalender WHERE tanggal < '2026-10-14'
)
SELECT c.tanggal, COUNT(k.no_rawat) AS jumlah_kunjungan
FROM kalender c LEFT JOIN kunjungan k ON k.tgl_kunjungan = c.tanggal AND k.status <> 'Batal'
GROUP BY c.tanggal ORDER BY c.tanggal;`,
        reason: 'row-count',
      },
      {
        label: "kunjungan 'Batal' ikut dihitung",
        answer: `WITH RECURSIVE kalender(tanggal) AS (
  SELECT '2026-10-01' UNION ALL SELECT date(tanggal, '+1 day') FROM kalender WHERE tanggal < '2026-10-15'
)
SELECT c.tanggal, COUNT(k.no_rawat) AS jumlah_kunjungan
FROM kalender c LEFT JOIN kunjungan k ON k.tgl_kunjungan = c.tanggal
GROUP BY c.tanggal ORDER BY c.tanggal;`,
        reason: 'cell-values',
      },
      {
        label: 'hanya GROUP BY tgl_kunjungan (tanpa deret tanggal)',
        answer: `SELECT tgl_kunjungan AS tanggal, COUNT(*) AS jumlah_kunjungan FROM kunjungan
WHERE status <> 'Batal' AND tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-15'
GROUP BY tgl_kunjungan ORDER BY tgl_kunjungan;`,
      },
      {
        label: 'hasil benar dengan daftar tanggal VALUES manual (tanpa rekursi)',
        answer: `WITH kalender(tanggal) AS (VALUES
  ('2026-10-01'), ('2026-10-02'), ('2026-10-03'), ('2026-10-04'), ('2026-10-05'),
  ('2026-10-06'), ('2026-10-07'), ('2026-10-08'), ('2026-10-09'), ('2026-10-10'),
  ('2026-10-11'), ('2026-10-12'), ('2026-10-13'), ('2026-10-14'), ('2026-10-15'))
SELECT c.tanggal, COUNT(k.no_rawat) AS jumlah_kunjungan
FROM kalender c LEFT JOIN kunjungan k ON k.tgl_kunjungan = c.tanggal AND k.status <> 'Batal'
GROUP BY c.tanggal ORDER BY c.tanggal;`,
        reason: 'missing-construct',
      },
    ],
    correct: [
      {
        label: 'deret dari angka 0..14 + subquery berkorelasi',
        answer: `with recursive n(i) as (select 0 union all select i + 1 from n where i < 14)
select date('2026-10-01', '+' || i || ' day') as TANGGAL,
  (select count(*) from kunjungan k where k.tgl_kunjungan = date('2026-10-01', '+' || n.i || ' day') and k.status != 'Batal') as Jumlah_Kunjungan
from n order by i`,
      },
      {
        label: 'julianday sebagai batas + SUM(CASE)',
        answer: `WITH RECURSIVE hari(tanggal) AS (
  SELECT date('2026-10-01')
  UNION ALL
  SELECT date(julianday(tanggal) + 1) FROM hari WHERE julianday(tanggal) < julianday('2026-10-15')
)
SELECT h.tanggal, COALESCE(SUM(CASE WHEN k.status <> 'Batal' THEN 1 ELSE 0 END), 0) AS jumlah_kunjungan
FROM hari h LEFT JOIN kunjungan k ON k.tgl_kunjungan = h.tanggal
GROUP BY h.tanggal ORDER BY h.tanggal ASC;`,
      },
    ],
  },
  /** Misi "Perbaiki Query" (tanpa requiredPatterns, jadi tidak ada kasus 'missing-construct'). */
  't4-fix-not-in': {
    wrong: [
      {
        label: 'IN (kebalikan: jabatan yang punya bawahan)',
        answer: `SELECT id_jabatan, nama_jabatan FROM struktur_organisasi
WHERE id_jabatan IN (SELECT id_atasan FROM struktur_organisasi);`,
        reason: 'row-count',
      },
      {
        label: 'mengira jabatan ujung = jabatan yang punya atasan',
        answer: 'SELECT id_jabatan, nama_jabatan FROM struktur_organisasi WHERE id_atasan IS NOT NULL;',
        reason: 'row-count',
      },
      {
        label: 'IS NOT NULL diletakkan di query luar (subquery masih memuat NULL)',
        answer: `SELECT id_jabatan, nama_jabatan FROM struktur_organisasi
WHERE id_atasan IS NOT NULL AND id_jabatan NOT IN (SELECT id_atasan FROM struktur_organisasi);`,
        reason: 'row-count',
      },
    ],
    correct: [
      {
        label: 'NOT IN + IS NOT NULL di subquery',
        answer: `select id_jabatan, nama_jabatan from struktur_organisasi
where id_jabatan not in (select id_atasan from struktur_organisasi where id_atasan is not null)`,
      },
      {
        label: 'LEFT JOIN anti-join',
        answer: `SELECT s.id_jabatan, s.nama_jabatan
FROM struktur_organisasi s
LEFT JOIN struktur_organisasi b ON b.id_atasan = s.id_jabatan
WHERE b.id_jabatan IS NULL;`,
      },
      {
        label: 'NOT IN dengan COALESCE',
        answer: `SELECT id_jabatan, nama_jabatan FROM struktur_organisasi
WHERE id_jabatan NOT IN (SELECT COALESCE(id_atasan, '') FROM struktur_organisasi);`,
      },
    ],
  },
};
