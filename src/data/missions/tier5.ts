/**
 * Tier 5 – Window Functions (order 34–38, 200 XP per misi; boss di order 39).
 * Misi 'sql' dinilai dengan 'result' dan wajib memakai ... OVER (...); t5-predict-rank adalah misi Tebak Hasil.
 */
import type { PredictMission, RequiredPattern, SqlMission, TierInfo } from '../../types';

export const TIER5: TierInfo = {
  tier: 5,
  name: 'Window Functions',
  description:
    'Menghitung peringkat, deduplikasi, total kumulatif, dan perbandingan dengan baris sebelumnya tanpa kehilangan baris detail, sesuatu yang tidak bisa dilakukan GROUP BY.',
};

const XP = 200;

const OVER_PATTERN: RequiredPattern = {
  // OVER diikuti "(" (window inline) atau nama window (OVER w ... WINDOW w AS (...)).
  pattern: String.raw`\bOVER\s*(\(|[A-Za-z_])`,
  message:
    'Misi ini melatih window function: tulis memakai fungsi ... OVER (PARTITION BY ... ORDER BY ...) alih-alih GROUP BY + JOIN balik atau subquery berkorelasi.',
};

export const MISSIONS_TIER5: Array<SqlMission | PredictMission> = [
  {
    id: 't5-row-number',
    kind: 'sql',
    tier: 5,
    order: 34,
    title: 'Kunjungan Terakhir Setiap Pasien',
    concept: 'ROW_NUMBER() + PARTITION BY',
    story:
      "Petugas Customer Care akan menelepon setiap pasien untuk survei kepuasan, dan yang ditanyakan adalah kunjungan TERAKHIR yang benar-benar dilayani. GROUP BY no_rm dengan MAX(tgl_kunjungan) hanya memberi tanggalnya; kolom lain seperti no_rawat dan nama poli harus dicari lagi dengan JOIN balik yang rawan duplikat. Window function ROW_NUMBER() memberi nomor urut 1, 2, 3, … di dalam setiap kelompok (PARTITION BY) TANPA meringkas baris, sehingga kita cukup mengambil baris bernomor 1. Pola ini dipakai sehari-hari untuk deduplikasi data.",
    task:
      "Untuk setiap pasien, ambil SATU kunjungan terakhirnya di antara kunjungan yang statusnya BUKAN 'Batal'. Terakhir = tgl_kunjungan paling baru; jika ada dua kunjungan pada tanggal yang sama, pilih no_rawat yang lebih besar. Pasien yang tidak punya kunjungan selain 'Batal' tidak ditampilkan. Tampilkan kolom no_rm, nama, no_rawat, tgl_kunjungan, dan nama_poli. Urutkan berdasarkan no_rm dari A ke Z.",
    hint: [
      'Beri nomor urut per pasien: ROW_NUMBER() OVER (PARTITION BY k.no_rm ORDER BY ...) AS rn. Urutan di dalam OVER menentukan baris mana yang mendapat nomor 1 (terbaru = DESC, plus no_rawat sebagai pemecah seri).',
      "Window function tidak boleh dipakai langsung di WHERE. Hitung rn di dalam CTE/subquery, lalu saring WHERE rn = 1 di query luar.",
      "Letakkan syarat status <> 'Batal' DI DALAM CTE (sebelum penomoran). Jika disaring setelah penomoran, pasien yang kunjungan terbarunya 'Batal' akan hilang seluruhnya, padahal kunjungan sebelumnya valid.",
    ],
    solutionSql: `WITH urut AS (
  SELECT
    k.no_rm,
    k.no_rawat,
    k.tgl_kunjungan,
    k.id_poli,
    ROW_NUMBER() OVER (
      PARTITION BY k.no_rm
      ORDER BY k.tgl_kunjungan DESC, k.no_rawat DESC
    ) AS rn
  FROM kunjungan k
  WHERE k.status <> 'Batal'
)
SELECT
  u.no_rm,
  p.nama,
  u.no_rawat,
  u.tgl_kunjungan,
  pl.nama_poli
FROM urut u
INNER JOIN pasien p ON u.no_rm = p.no_rm
INNER JOIN poliklinik pl ON u.id_poli = pl.id_poli
WHERE u.rn = 1
ORDER BY u.no_rm ASC;`,
    xpReward: XP,
    orderMatters: true,
    starterSql:
      "-- Beri nomor urut kunjungan per pasien, lalu ambil nomor 1\nWITH urut AS (\n  SELECT\n    k.no_rm,\n    k.no_rawat,\n    k.tgl_kunjungan,\n    k.id_poli,\n    -- ROW_NUMBER() OVER (...) AS rn\n  FROM kunjungan k\n)\nSELECT\n  \nFROM urut u\n",
    requiredPatterns: [
      OVER_PATTERN,
      {
        pattern: '\\bROW_NUMBER\\s*\\(',
        message: 'Misi ini melatih ROW_NUMBER(): beri nomor urut kunjungan per pasien, lalu ambil baris bernomor 1.',
      },
    ],
  },
  {
    id: 't5-rank',
    kind: 'sql',
    tier: 5,
    order: 35,
    title: 'Peringkat Penyakit Terbanyak',
    concept: 'RANK() + PARTITION BY',
    story:
      "Unit Rekam Medis menyusun laporan \"Penyakit Terbanyak\" untuk Dinas Kesehatan, terpisah untuk diagnosa Primer dan Sekunder. Beberapa penyakit punya jumlah kasus yang sama, sehingga peringkatnya harus SAMA juga, seperti klasemen olahraga: tiga penyakit seri di posisi 1, lalu posisi berikutnya adalah 4 (bukan 2). Inilah perilaku RANK(). DENSE_RANK() tidak melompat (1, 1, 1, 2), sedangkan ROW_NUMBER() memberi nomor berbeda untuk yang seri. Window function bisa dihitung di atas hasil GROUP BY, karena ia dievaluasi setelah agregasi.",
    task:
      "Dari tabel diagnosa, hitung jumlah_kasus (banyaknya baris diagnosa) untuk setiap kombinasi jenis, kode_icd10, dan nama_penyakit. Beri peringkat per jenis (Primer dan Sekunder diperingkat terpisah) berdasarkan jumlah_kasus terbanyak dengan aturan RANK(): kasus yang sama mendapat peringkat sama, dan peringkat berikutnya melompat sesuai jumlah yang seri. Tampilkan kolom jenis, kode_icd10, nama_penyakit, jumlah_kasus, dan peringkat untuk semua kombinasi. Urutkan berdasarkan jenis A–Z, lalu peringkat dari yang terkecil, lalu kode_icd10 A–Z.",
    hint: [
      'Mulai dari agregasi biasa: SELECT jenis, kode_icd10, nama_penyakit, COUNT(*) AS jumlah_kasus FROM diagnosa GROUP BY jenis, kode_icd10, nama_penyakit.',
      'Tambahkan kolom RANK() OVER (...) AS peringkat di SELECT yang sama. Di dalam OVER, ORDER BY boleh memakai fungsi agregat, mis. ORDER BY COUNT(*) DESC.',
      'PARTITION BY jenis membuat penomoran dimulai ulang dari 1 untuk setiap jenis. Tanpa PARTITION BY, Primer dan Sekunder akan diperingkat bersama.',
    ],
    solutionSql: `SELECT
  jenis,
  kode_icd10,
  nama_penyakit,
  COUNT(*) AS jumlah_kasus,
  RANK() OVER (
    PARTITION BY jenis
    ORDER BY COUNT(*) DESC
  ) AS peringkat
FROM diagnosa
GROUP BY jenis, kode_icd10, nama_penyakit
ORDER BY jenis ASC, peringkat ASC, kode_icd10 ASC;`,
    xpReward: XP,
    orderMatters: true,
    starterSql:
      '-- Hitung jumlah kasus per penyakit, lalu beri peringkat per jenis diagnosa\nSELECT\n  jenis,\n  kode_icd10,\n  nama_penyakit,\n  COUNT(*) AS jumlah_kasus\n  -- , RANK() OVER (...) AS peringkat\nFROM diagnosa\nGROUP BY jenis, kode_icd10, nama_penyakit\n',
    requiredPatterns: [
      OVER_PATTERN,
      {
        pattern: 'RANK\\s*\\(',
        message: 'Misi ini melatih fungsi peringkat RANK(): penyakit dengan jumlah kasus sama harus mendapat peringkat yang sama.',
      },
    ],
  },
  {
    id: 't5-predict-rank',
    kind: 'predict',
    tier: 5,
    order: 36,
    title: 'Tebak: RANK, DENSE_RANK, atau ROW_NUMBER?',
    concept: 'Tebak Hasil: Fungsi Peringkat',
    story:
      'Untuk laporan penyakit jantung (kode I…) dan metabolik (kode E…), rekanmu memberi peringkat berdasarkan jumlah kasus. Beberapa penyakit seri. Sebelum laporan dikirim, tebak dulu angka apa yang muncul di kolom peringkat.',
    task:
      'Baca query di panel kanan TANPA menjalankannya, lalu pilih tabel yang benar-benar dihasilkan. Fokus pada kolom peringkat: bagaimana RANK() memperlakukan nilai yang seri?',
    hint: [
      'Jumlah kasusnya: I10 = 6, E11.9 = 5, E78.5 dan I50.9 masing-masing 2, lalu empat kode lain masing-masing 1.',
      'RANK() memberi peringkat sama untuk nilai seri, lalu MELOMPATI nomor sebanyak baris yang seri (seperti klasemen olahraga). DENSE_RANK() tidak melompat; ROW_NUMBER() tidak pernah memberi nomor sama.',
    ],
    query: `SELECT
  kode_icd10,
  COUNT(*) AS jumlah,
  RANK() OVER (ORDER BY COUNT(*) DESC) AS peringkat
FROM diagnosa
WHERE kode_icd10 LIKE 'I%' OR kode_icd10 LIKE 'E%'
GROUP BY kode_icd10
ORDER BY jumlah DESC, kode_icd10;`,
    explanation:
      'RANK() = 1 + banyaknya baris dengan jumlah LEBIH BESAR. I10 (6) peringkat 1, E11.9 (5) peringkat 2, E78.5 dan I50.9 (2) sama-sama peringkat 3. Empat kode dengan jumlah 1 didahului 4 baris, sehingga peringkatnya 5 (nomor 4 dilompati). Window function dihitung setelah GROUP BY, jadi COUNT(*) di dalam OVER adalah jumlah per kode.',
    distractors: [
      {
        sql: `SELECT
  kode_icd10,
  COUNT(*) AS jumlah,
  DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS peringkat
FROM diagnosa
WHERE kode_icd10 LIKE 'I%' OR kode_icd10 LIKE 'E%'
GROUP BY kode_icd10
ORDER BY jumlah DESC, kode_icd10;`,
        misconception:
          'Mengira RANK() tidak melompat setelah nilai seri (1, 2, 3, 3, 4, …). Itu perilaku DENSE_RANK(). RANK() melompat ke 5 karena sudah ada 4 baris di atasnya.',
      },
      {
        sql: `SELECT
  kode_icd10,
  COUNT(*) AS jumlah,
  ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, kode_icd10) AS peringkat
FROM diagnosa
WHERE kode_icd10 LIKE 'I%' OR kode_icd10 LIKE 'E%'
GROUP BY kode_icd10
ORDER BY jumlah DESC, kode_icd10;`,
        misconception:
          'Mengira RANK() memberi nomor urut berbeda untuk setiap baris (1 sampai 8). Itu perilaku ROW_NUMBER(). RANK() memberi nomor yang sama untuk jumlah yang seri.',
      },
    ],
    xpReward: XP,
    orderMatters: true,
  },
  {
    id: 't5-running-total',
    kind: 'sql',
    tier: 5,
    order: 37,
    title: 'Pendapatan Kumulatif Oktober',
    concept: 'Running Total (SUM OVER)',
    story:
      'Manajer Keuangan memantau target pendapatan bulanan setiap hari: "Sampai tanggal ini, sudah berapa total tagihan yang tercipta bulan ini?" Itu adalah running total (total berjalan). SUM(...) OVER (ORDER BY ...) menjumlahkan semua baris dari awal sampai baris saat ini, tanpa meringkas baris seperti GROUP BY. Ada jebakan: jika ada beberapa tagihan pada tanggal yang sama, frame default (RANGE) memperlakukan baris bertanggal sama sebagai satu kelompok. Paling aman, rekap dulu per tanggal, baru hitung kumulatifnya.',
    task:
      "Untuk tagihan (tabel billing, baik 'Lunas' maupun 'Belum Lunas') dari kunjungan dengan tgl_kunjungan bulan Oktober 2026 ('2026-10-01' s.d. '2026-10-31'), tampilkan SATU baris per tgl_kunjungan yang punya tagihan, dengan kolom tgl_kunjungan, pendapatan_harian (jumlah total_biaya pada tanggal itu), dan pendapatan_kumulatif (jumlah pendapatan_harian dari awal Oktober sampai tanggal itu, termasuk tanggal itu). Urutkan berdasarkan tgl_kunjungan dari yang paling awal.",
    hint: [
      'Langkah 1: rekap per tanggal di CTE: JOIN billing → kunjungan, saring bulan Oktober, lalu GROUP BY k.tgl_kunjungan dengan SUM(b.total_biaya) AS pendapatan_harian.',
      'Langkah 2: di query utama, SUM(pendapatan_harian) OVER (ORDER BY tgl_kunjungan) AS pendapatan_kumulatif. ORDER BY di dalam OVER-lah yang membuat jumlahnya "berjalan"; tanpa ORDER BY, setiap baris mendapat total sebulan.',
      'Jika langsung memakai SUM OVER per baris tagihan tanpa rekap, tanggal dengan dua tagihan akan muncul dua kali. Kamu juga bisa menulis frame-nya secara eksplisit: ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW.',
    ],
    solutionSql: `WITH harian AS (
  SELECT
    k.tgl_kunjungan,
    SUM(b.total_biaya) AS pendapatan_harian
  FROM billing b
  INNER JOIN kunjungan k ON b.no_rawat = k.no_rawat
  WHERE k.tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31'
  GROUP BY k.tgl_kunjungan
)
SELECT
  tgl_kunjungan,
  pendapatan_harian,
  SUM(pendapatan_harian) OVER (
    ORDER BY tgl_kunjungan
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS pendapatan_kumulatif
FROM harian
ORDER BY tgl_kunjungan ASC;`,
    xpReward: XP,
    orderMatters: true,
    starterSql:
      "-- Langkah 1: pendapatan per tanggal (Oktober 2026)\nWITH harian AS (\n  SELECT\n    k.tgl_kunjungan,\n    SUM(b.total_biaya) AS pendapatan_harian\n  FROM billing b\n  INNER JOIN kunjungan k ON b.no_rawat = k.no_rawat\n  WHERE k.tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31'\n  GROUP BY k.tgl_kunjungan\n)\n-- Langkah 2: total berjalan dengan SUM(...) OVER (...)\nSELECT\n  \nFROM harian\n",
    requiredPatterns: [OVER_PATTERN],
  },
  {
    id: 't5-lag',
    kind: 'sql',
    tier: 5,
    order: 38,
    title: 'Jarak Antar-Kunjungan Pasien',
    concept: 'LAG() / LEAD()',
    story:
      "Komite Mutu memantau indikator kunjungan ulang: pasien yang kembali dalam waktu singkat bisa menandakan penanganan sebelumnya kurang tuntas. Untuk itu, setiap kunjungan perlu dibandingkan dengan kunjungan SEBELUMNYA dari pasien yang sama. LAG(kolom) mengambil nilai dari baris sebelumnya di dalam partisi (LEAD dari baris sesudahnya) tanpa self-join. Selisih hari dihitung dengan julianday(tanggal_baru) - julianday(tanggal_lama).",
    task:
      "Hanya pertimbangkan kunjungan yang statusnya BUKAN 'Batal'. Untuk setiap kunjungan seorang pasien yang punya kunjungan sebelumnya (kunjungan non-Batal pasien yang sama dengan tgl_kunjungan lebih awal), tampilkan kolom no_rm, nama, tgl_kunjungan, kunjungan_sebelumnya (tgl_kunjungan dari kunjungan non-Batal tepat sebelumnya milik pasien yang sama), dan selisih_hari (jarak hari antara keduanya sebagai bilangan bulat: CAST(julianday(tgl_kunjungan) - julianday(kunjungan_sebelumnya) AS INTEGER)). Kunjungan pertama setiap pasien tidak ditampilkan. Urutkan berdasarkan no_rm A–Z, lalu tgl_kunjungan dari yang paling awal.",
    hint: [
      'LAG(k.tgl_kunjungan) OVER (PARTITION BY k.no_rm ORDER BY k.tgl_kunjungan) memberi tanggal kunjungan sebelumnya milik pasien yang sama; untuk kunjungan pertama hasilnya NULL.',
      "Saring status <> 'Batal' SEBELUM LAG dihitung (di WHERE pada CTE yang sama), supaya kunjungan batal tidak dianggap sebagai \"kunjungan sebelumnya\".",
      'Window function tidak bisa dipakai di WHERE, jadi hitung LAG di CTE/subquery, lalu di query luar saring WHERE kunjungan_sebelumnya IS NOT NULL dan hitung selisih_hari dengan CAST(julianday(...) - julianday(...) AS INTEGER).',
    ],
    solutionSql: `WITH riwayat AS (
  SELECT
    k.no_rm,
    k.tgl_kunjungan,
    LAG(k.tgl_kunjungan) OVER (
      PARTITION BY k.no_rm
      ORDER BY k.tgl_kunjungan, k.no_rawat
    ) AS kunjungan_sebelumnya
  FROM kunjungan k
  WHERE k.status <> 'Batal'
)
SELECT
  r.no_rm,
  p.nama,
  r.tgl_kunjungan,
  r.kunjungan_sebelumnya,
  CAST(julianday(r.tgl_kunjungan) - julianday(r.kunjungan_sebelumnya) AS INTEGER) AS selisih_hari
FROM riwayat r
INNER JOIN pasien p ON r.no_rm = p.no_rm
WHERE r.kunjungan_sebelumnya IS NOT NULL
ORDER BY r.no_rm ASC, r.tgl_kunjungan ASC;`,
    xpReward: XP,
    orderMatters: true,
    starterSql:
      "-- Ambil tanggal kunjungan sebelumnya milik pasien yang sama\nWITH riwayat AS (\n  SELECT\n    k.no_rm,\n    k.tgl_kunjungan\n    -- , LAG(...) OVER (...) AS kunjungan_sebelumnya\n  FROM kunjungan k\n  -- saring kunjungan yang tidak dihitung\n)\nSELECT\n  \nFROM riwayat r\n",
    requiredPatterns: [
      OVER_PATTERN,
      {
        pattern: '\\b(LAG|LEAD)\\s*\\(',
        message: 'Misi ini melatih LAG() atau LEAD(): ambil tanggal kunjungan sebelumnya dari baris lain di partisi yang sama, bukan dengan self-join atau subquery.',
      },
    ],
  },
];
