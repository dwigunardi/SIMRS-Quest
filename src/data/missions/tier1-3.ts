/**
 * Kurikulum inti SIMRS SQL Quest: Tier 1–3 (15 misi SQL + 7 misi "Perbaiki Query" / "Tebak Hasil").
 * Setiap solutionSql diverifikasi oleh `npm run verify` (scripts/verify-missions.ts).
 */
import type { PredictMission, SqlMission, TierInfo } from '../../types';

export const TIERS_CORE: TierInfo[] = [
  {
    tier: 1,
    name: 'Dasar Query',
    description: 'Mengambil data dari satu tabel: memilih kolom, menyaring baris, mengurutkan, dan menghilangkan duplikat.',
  },
  {
    tier: 2,
    name: 'Relasi & Agregasi',
    description: 'Menggabungkan beberapa tabel dengan JOIN dan merangkum data dengan COUNT, SUM, AVG, GROUP BY, serta HAVING.',
  },
  {
    tier: 3,
    name: 'Kasus Nyata SIMRS',
    description: 'Laporan yang benar-benar dibutuhkan rumah sakit: rekap BPJS, risiko klaim, kinerja dokter, dan analisis tagihan.',
  },
];

const STARTER = '-- Tulis query kamu di sini\nSELECT ';

export const MISSIONS_CORE: Array<SqlMission | PredictMission> = [
  /* ------------------------------------------------------------------ */
  /* Tier 1 – Dasar Query                                                */
  /* ------------------------------------------------------------------ */
  {
    id: 't1-select',
    kind: 'sql',
    tier: 1,
    order: 1,
    title: 'Hari Pertama di Unit IT',
    concept: 'SELECT',
    story:
      'Selamat datang di tim IT rumah sakit! Bagian SDM Medis meminta daftar dokter yang praktik untuk dicetak di papan informasi lobi.',
    task:
      'Tampilkan kolom nama_dokter dan spesialisasi dari tabel dokter untuk SEMUA dokter. Urutan baris bebas.',
    hint: [
      'Gunakan pola dasar: SELECT kolom1, kolom2 FROM nama_tabel;',
      'Kolom yang diminta hanya dua: nama_dokter dan spesialisasi. Pisahkan dengan koma.',
      'Tabel sumbernya adalah dokter, jadi akhiri query dengan FROM dokter.',
    ],
    solutionSql: `SELECT
  nama_dokter,
  spesialisasi
FROM dokter;`,
    xpReward: 50,
    orderMatters: false,
    starterSql: '-- Tulis query kamu di sini\n-- Buka tab Schema Explorer untuk melihat kolom tabel dokter\nSELECT ',
  },
  {
    id: 't1-where',
    kind: 'sql',
    tier: 1,
    order: 2,
    title: 'Pasien BPJS Jabodetabek',
    concept: 'WHERE + AND/OR',
    story:
      'Petugas pendaftaran sedang menyiapkan sosialisasi program JKN. Ia butuh daftar pasien BPJS yang berdomisili di Jakarta atau Bogor.',
    task:
      "Dari tabel pasien, tampilkan kolom no_rm, nama, dan kota untuk pasien dengan penjamin 'BPJS' yang kotanya 'Jakarta' ATAU 'Bogor'. Urutan baris bebas.",
    hint: [
      'Saring baris dengan WHERE. Kamu butuh dua syarat sekaligus: penjamin dan kota.',
      "Hati-hati: AND dievaluasi lebih dulu daripada OR. Bungkus syarat kota dengan tanda kurung: (kota = 'Jakarta' OR kota = 'Bogor').",
      "Bentuknya: WHERE penjamin = 'BPJS' AND (... OR ...). Nilai teks ditulis dengan tanda kutip tunggal.",
    ],
    solutionSql: `SELECT
  no_rm,
  nama,
  kota
FROM pasien
WHERE penjamin = 'BPJS'
  AND (kota = 'Jakarta' OR kota = 'Bogor');`,
    xpReward: 50,
    orderMatters: false,
    starterSql: STARTER,
  },
  {
    id: 't1-like',
    kind: 'sql',
    tier: 1,
    order: 3,
    title: 'Pelacakan Penyakit Jantung & Pembuluh Darah',
    concept: 'LIKE',
    story:
      "Kepala Rekam Medis menyusun laporan penyakit sistem sirkulasi. Dalam ICD-10, semua penyakit jantung dan pembuluh darah berkode diawali huruf 'I'.",
    task:
      "Dari tabel diagnosa, tampilkan kolom no_rawat, kode_icd10, dan nama_penyakit untuk semua diagnosa yang kode_icd10-nya diawali huruf 'I'. Urutan baris bebas.",
    hint: [
      'Untuk mencocokkan pola teks, gunakan operator LIKE di dalam WHERE.',
      "Wildcard % berarti 'nol atau lebih karakter apa pun'. Pola 'I%' artinya diawali huruf I.",
      "Catatan: di SQLite, LIKE tidak membedakan huruf besar/kecil untuk huruf A–Z. Tulis WHERE kode_icd10 LIKE 'I%'.",
    ],
    solutionSql: `SELECT
  no_rawat,
  kode_icd10,
  nama_penyakit
FROM diagnosa
WHERE kode_icd10 LIKE 'I%';`,
    xpReward: 50,
    orderMatters: false,
    starterSql: STARTER,
  },
  {
    id: 't1-order-limit',
    kind: 'sql',
    tier: 1,
    order: 4,
    title: 'Lima Tagihan Terbesar',
    concept: 'ORDER BY + LIMIT',
    story:
      'Manajer Keuangan ingin melihat lima tagihan pasien dengan nominal terbesar untuk dipantau secara khusus dalam rapat mingguan.',
    task:
      'Dari tabel billing, tampilkan kolom no_rawat, total_biaya, dan status_bayar. Urutkan berdasarkan total_biaya dari yang TERBESAR; jika ada nominal yang sama, urutkan berdasarkan no_rawat dari A ke Z. Tampilkan hanya 5 baris teratas.',
    hint: [
      'Pengurutan dilakukan dengan ORDER BY, sedangkan pembatasan jumlah baris dengan LIMIT.',
      'DESC berarti urut menurun (besar ke kecil), ASC menaik. Kamu bisa mengurutkan dengan lebih dari satu kolom: ORDER BY kolom1 DESC, kolom2 ASC.',
      'Urutan klausa: SELECT ... FROM billing ORDER BY total_biaya DESC, no_rawat ASC LIMIT ...;',
    ],
    solutionSql: `SELECT
  no_rawat,
  total_biaya,
  status_bayar
FROM billing
ORDER BY total_biaya DESC, no_rawat ASC
LIMIT 5;`,
    xpReward: 50,
    orderMatters: true,
    starterSql: STARTER,
  },
  {
    id: 't1-distinct',
    kind: 'sql',
    tier: 1,
    order: 5,
    title: 'Peta Asal Pasien',
    concept: 'DISTINCT',
    story:
      'Tim Humas ingin tahu dari kota mana saja pasien rumah sakit berasal, untuk merencanakan lokasi baliho promosi layanan.',
    task:
      'Dari tabel pasien, tampilkan kolom kota TANPA duplikat (setiap kota cukup muncul satu kali). Urutan baris bebas.',
    hint: [
      'Jika kamu hanya SELECT kota FROM pasien, kota yang sama akan muncul berkali-kali.',
      'Tambahkan kata kunci DISTINCT tepat setelah SELECT untuk menghapus baris duplikat.',
    ],
    solutionSql: `SELECT DISTINCT
  kota
FROM pasien;`,
    xpReward: 50,
    orderMatters: false,
    starterSql: STARTER,
  },
  {
    id: 't1-predict-distinct',
    kind: 'predict',
    tier: 1,
    order: 6,
    title: 'Tebak: DISTINCT Dua Kolom',
    concept: 'Tebak Hasil: DISTINCT',
    story:
      'Rekan di Humas menjalankan query DISTINCT untuk dua kota sekaligus, lalu bingung kenapa Bogor dan Bandung muncul lebih dari sekali. Sebelum menjalankannya sendiri, coba tebak dulu hasilnya.',
    task:
      'Baca query di panel kanan TANPA menjalankannya, lalu pilih tabel yang benar-benar dihasilkan query itu. Perhatikan: DISTINCT bekerja pada kolom apa saja?',
    hint: [
      'DISTINCT ditulis sekali setelah SELECT, tetapi berlaku untuk SELURUH kolom yang dipilih, bukan hanya kolom pertama.',
      'Baris dianggap duplikat hanya jika kombinasi kota DAN penjamin sama persis. Pasien Bogor ada yang BPJS dan ada yang Umum; pasien Bandung ada yang BPJS dan ada yang Asuransi.',
    ],
    query: `SELECT DISTINCT
  kota,
  penjamin
FROM pasien
WHERE kota IN ('Bogor', 'Bandung')
ORDER BY kota, penjamin;`,
    explanation:
      'DISTINCT membuang baris yang SELURUH kolomnya kembar. Di Bogor ada pasien BPJS (2 orang) dan Umum (1 orang); di Bandung ada BPJS (2 orang) dan Asuransi (1 orang). Pasangan (kota, penjamin) yang unik ada 4, jadi hasilnya 4 baris: kota memang muncul dua kali, tetapi pasangannya selalu berbeda.',
    distractors: [
      {
        sql: `SELECT DISTINCT
  kota
FROM pasien
WHERE kota IN ('Bogor', 'Bandung')
ORDER BY kota;`,
        misconception:
          'Mengira DISTINCT hanya melihat kolom pertama (kota), sehingga setiap kota cukup muncul sekali. Padahal kolom penjamin ikut menentukan apakah sebuah baris duplikat.',
      },
      {
        sql: `SELECT
  kota,
  penjamin
FROM pasien
WHERE kota IN ('Bogor', 'Bandung')
ORDER BY kota, penjamin;`,
        misconception:
          'Mengira DISTINCT tidak berpengaruh karena nilai kota berulang. Tanpa DISTINCT, kedua pasien Bogor-BPJS (dan Bandung-BPJS) tetap tampil sebagai baris kembar.',
      },
    ],
    xpReward: 50,
    orderMatters: true,
  },
  {
    id: 't1-fix-tagihan',
    kind: 'sql',
    tier: 1,
    order: 7,
    title: 'Laporan Tunggakan yang Kosong',
    concept: 'Debug: WHERE teks + ORDER BY DESC',
    story:
      'Rekan di Unit IT membuat query untuk Manajer Keuangan: tiga tagihan BELUM LUNAS dengan nominal terbesar. Saat dijalankan, hasilnya malah kosong. Ia minta tolong kamu memeriksanya sebelum rapat.',
    task:
      "Perbaiki query di editor (mengandung 2 bug). Hasil yang diminta: kolom no_rawat dan total_biaya dari tabel billing untuk tagihan dengan status_bayar 'Belum Lunas', diurutkan dari total_biaya TERBESAR, hanya 3 baris teratas.",
    hint: [
      'Jalankan dulu query aslinya. Hasil kosong biasanya berarti syarat WHERE tidak pernah terpenuhi. Bandingkan teks di WHERE dengan isi kolom status_bayar di Schema Explorer.',
      "Perbandingan teks dengan = membedakan huruf besar/kecil: 'Belum lunas' tidak sama dengan 'Belum Lunas'.",
      'ORDER BY tanpa arah mengurutkan dari yang TERKECIL (ASC). Untuk nominal terbesar, tambahkan DESC.',
    ],
    solutionSql: `SELECT
  no_rawat,
  total_biaya
FROM billing
WHERE status_bayar = 'Belum Lunas'
ORDER BY total_biaya DESC
LIMIT 3;`,
    xpReward: 50,
    orderMatters: true,
    starterSql: `-- Query dari rekan: 3 tunggakan terbesar (hasilnya keliru)
SELECT
  no_rawat,
  total_biaya
FROM billing
WHERE status_bayar = 'Belum lunas'
ORDER BY total_biaya
LIMIT 3;`,
    fix: { bugCount: 2 },
  },

  /* ------------------------------------------------------------------ */
  /* Tier 2 – Relasi & Agregasi                                          */
  /* ------------------------------------------------------------------ */
  {
    id: 't2-inner-join',
    kind: 'sql',
    tier: 2,
    order: 9,
    title: 'Daftar Kunjungan November',
    concept: 'INNER JOIN',
    story:
      'Kepala Instalasi Rawat Jalan butuh daftar kunjungan bulan November 2026 lengkap dengan nama pasien dan nama poliklinik, bukan sekadar kode.',
    task:
      "Gabungkan tabel kunjungan, pasien, dan poliklinik. Tampilkan kolom no_rawat, nama, nama_poli, dan tgl_kunjungan untuk semua kunjungan dengan tgl_kunjungan mulai '2026-11-01' (semua status, termasuk 'Batal'). Urutan baris bebas.",
    hint: [
      'kunjungan menyimpan no_rm (relasi ke pasien) dan id_poli (relasi ke poliklinik). Gunakan JOIN ... ON untuk menghubungkannya.',
      'Beri alias tabel agar ringkas: FROM kunjungan k JOIN pasien p ON k.no_rm = p.no_rm JOIN poliklinik pl ON ...',
      "Tanggal disimpan sebagai teks berformat YYYY-MM-DD, jadi bisa dibandingkan langsung: WHERE k.tgl_kunjungan >= '2026-11-01'.",
    ],
    solutionSql: `SELECT
  k.no_rawat,
  p.nama,
  pl.nama_poli,
  k.tgl_kunjungan
FROM kunjungan k
INNER JOIN pasien p ON k.no_rm = p.no_rm
INNER JOIN poliklinik pl ON k.id_poli = pl.id_poli
WHERE k.tgl_kunjungan >= '2026-11-01';`,
    xpReward: 100,
    orderMatters: false,
    starterSql: '-- Tulis query kamu di sini\nSELECT\n  \nFROM kunjungan k\n',
  },
  {
    id: 't2-left-join',
    kind: 'sql',
    tier: 2,
    order: 10,
    title: 'Pasien yang Belum Pernah Berobat',
    concept: 'LEFT JOIN + IS NULL',
    story:
      'Unit Rekam Medis melakukan audit data master: ada pasien yang sudah terdaftar tetapi belum pernah tercatat berkunjung sama sekali. Mereka perlu dihubungi untuk verifikasi data.',
    task:
      'Tampilkan kolom no_rm, nama, dan penjamin dari tabel pasien untuk pasien yang TIDAK memiliki satu pun data di tabel kunjungan. Urutan baris bebas.',
    hint: [
      'INNER JOIN hanya mengembalikan pasien yang punya kunjungan. Kamu butuh LEFT JOIN agar semua pasien tetap muncul.',
      'Pada LEFT JOIN, kolom dari tabel kanan bernilai NULL jika tidak ada pasangannya.',
      'FROM pasien p LEFT JOIN kunjungan k ON p.no_rm = k.no_rm, lalu saring dengan WHERE k.no_rawat IS NULL (ingat: pakai IS NULL, bukan = NULL).',
    ],
    solutionSql: `SELECT
  p.no_rm,
  p.nama,
  p.penjamin
FROM pasien p
LEFT JOIN kunjungan k ON p.no_rm = k.no_rm
WHERE k.no_rawat IS NULL;`,
    xpReward: 100,
    orderMatters: false,
    starterSql: STARTER,
  },
  {
    id: 't2-count-group',
    kind: 'sql',
    tier: 2,
    order: 11,
    title: 'Komposisi Penjamin Pasien',
    concept: 'COUNT + GROUP BY',
    story:
      'Direktur Pelayanan ingin tahu komposisi pasien berdasarkan jenis penjamin (BPJS, Umum, Asuransi) untuk bahan negosiasi kerja sama asuransi.',
    task:
      'Dari tabel pasien, tampilkan kolom penjamin dan jumlah_pasien (banyaknya pasien untuk tiap penjamin). Urutan baris bebas.',
    hint: [
      'Fungsi agregat COUNT(*) menghitung jumlah baris. Agar dihitung per penjamin, kelompokkan dengan GROUP BY.',
      'Beri nama kolom hasil dengan alias: COUNT(*) AS jumlah_pasien.',
      'Bentuknya: SELECT penjamin, COUNT(*) AS ... FROM pasien GROUP BY penjamin;',
    ],
    solutionSql: `SELECT
  penjamin,
  COUNT(*) AS jumlah_pasien
FROM pasien
GROUP BY penjamin;`,
    xpReward: 100,
    orderMatters: false,
    starterSql: STARTER,
  },
  {
    id: 't2-sum-avg',
    kind: 'sql',
    tier: 2,
    order: 12,
    title: 'Pendapatan per Poliklinik',
    concept: 'SUM + AVG',
    story:
      'Bagian Keuangan menyusun laporan pendapatan rawat jalan. Mereka butuh total tagihan dan rata-rata tagihan untuk setiap poliklinik.',
    task:
      'Gabungkan billing, kunjungan, dan poliklinik. Untuk setiap poliklinik, tampilkan kolom nama_poli, total_pendapatan (jumlah total_biaya), dan rata_rata_tagihan (rata-rata total_biaya, dibulatkan 2 angka desimal dengan ROUND). Hanya kunjungan yang memiliki tagihan yang dihitung. Urutan baris bebas.',
    hint: [
      'billing terhubung ke kunjungan lewat no_rawat, dan kunjungan terhubung ke poliklinik lewat id_poli.',
      'Gunakan SUM(b.total_biaya) dan AVG(b.total_biaya), lalu GROUP BY nama_poli (atau id_poli dan nama_poli).',
      'Pembulatan: ROUND(AVG(b.total_biaya), 2) AS rata_rata_tagihan.',
    ],
    solutionSql: `SELECT
  pl.nama_poli,
  SUM(b.total_biaya) AS total_pendapatan,
  ROUND(AVG(b.total_biaya), 2) AS rata_rata_tagihan
FROM billing b
INNER JOIN kunjungan k ON b.no_rawat = k.no_rawat
INNER JOIN poliklinik pl ON k.id_poli = pl.id_poli
GROUP BY pl.id_poli, pl.nama_poli;`,
    xpReward: 100,
    orderMatters: false,
    starterSql: STARTER,
  },
  {
    id: 't2-having',
    kind: 'sql',
    tier: 2,
    order: 13,
    title: 'Diagnosa yang Sering Muncul',
    concept: 'HAVING',
    story:
      'Komite Medik ingin menyusun clinical pathway untuk penyakit yang sering ditangani. Mereka meminta daftar diagnosa yang tercatat minimal 2 kali.',
    task:
      'Dari tabel diagnosa, tampilkan kolom kode_icd10, nama_penyakit, dan jumlah_kasus (banyaknya baris diagnosa per kode) hanya untuk diagnosa dengan jumlah_kasus minimal 2. Hitung semua jenis diagnosa (Primer maupun Sekunder). Urutan baris bebas.',
    hint: [
      'Kelompokkan dengan GROUP BY kode_icd10, nama_penyakit lalu hitung dengan COUNT(*).',
      'WHERE tidak bisa dipakai untuk menyaring hasil fungsi agregat. Gunakan HAVING yang dijalankan SETELAH pengelompokan.',
      'Tambahkan HAVING COUNT(*) >= 2 setelah GROUP BY.',
    ],
    solutionSql: `SELECT
  kode_icd10,
  nama_penyakit,
  COUNT(*) AS jumlah_kasus
FROM diagnosa
GROUP BY kode_icd10, nama_penyakit
HAVING COUNT(*) >= 2;`,
    xpReward: 100,
    orderMatters: false,
    starterSql: STARTER,
  },
  {
    id: 't2-predict-having',
    kind: 'predict',
    tier: 2,
    order: 14,
    title: 'Tebak: WHERE Dulu, Baru HAVING',
    concept: 'Tebak Hasil: WHERE vs HAVING',
    story:
      'Bagian Pemasaran ingin tahu jenis penjamin apa yang dipakai lebih dari satu pasien di Jakarta. Rekanmu sudah menulis query-nya. Sebelum dijalankan, tebak dulu hasilnya.',
    task:
      'Baca query di panel kanan TANPA menjalankannya, lalu pilih tabel yang benar-benar dihasilkan. Kuncinya: urutan WHERE → GROUP BY → HAVING.',
    hint: [
      'SQL menjalankan WHERE lebih dulu: hanya pasien Jakarta yang masuk ke tahap pengelompokan.',
      'Pasien Jakarta: 4 BPJS, 1 Umum, 1 Asuransi. COUNT(*) di HAVING menghitung baris DI DALAM tiap grup setelah WHERE, lalu HAVING membuang grup yang jumlahnya tidak lebih dari 1.',
    ],
    query: `SELECT
  penjamin,
  COUNT(*) AS jumlah
FROM pasien
WHERE kota = 'Jakarta'
GROUP BY penjamin
HAVING COUNT(*) > 1
ORDER BY penjamin;`,
    explanation:
      'Urutan eksekusinya: FROM pasien → WHERE kota = \'Jakarta\' (tersisa 6 pasien) → GROUP BY penjamin (BPJS 4, Umum 1, Asuransi 1) → HAVING COUNT(*) > 1 (hanya BPJS yang lolos) → SELECT → ORDER BY. Jadi hasilnya satu baris: BPJS dengan jumlah 4.',
    distractors: [
      {
        sql: `SELECT
  penjamin,
  COUNT(*) AS jumlah
FROM pasien
WHERE kota = 'Jakarta'
GROUP BY penjamin
ORDER BY penjamin;`,
        misconception:
          'Mengabaikan HAVING, seolah-olah HAVING hanya hiasan. Padahal HAVING menyaring GRUP setelah dihitung: grup Umum dan Asuransi (masing-masing 1 pasien) dibuang.',
      },
      {
        sql: `SELECT
  penjamin,
  COUNT(*) AS jumlah
FROM pasien
GROUP BY penjamin
HAVING COUNT(*) > 1
ORDER BY penjamin;`,
        misconception:
          'Mengira COUNT(*) di HAVING menghitung semua pasien di tabel (sebelum WHERE). Padahal WHERE dijalankan lebih dulu, jadi COUNT(*) hanya menghitung pasien Jakarta.',
      },
    ],
    xpReward: 100,
    orderMatters: true,
  },
  {
    id: 't2-fix-left-join',
    kind: 'sql',
    tier: 2,
    order: 15,
    title: 'Dokter yang Hilang dari Rekap',
    concept: 'Debug: LEFT JOIN + COUNT',
    story:
      'Bagian SDM Medis meminta rekap jumlah kunjungan November 2026 untuk SETIAP dokter, termasuk dokter yang belum menangani pasien sama sekali bulan itu. Query buatan rekanmu sudah memakai LEFT JOIN, tetapi satu dokter justru hilang dari hasil.',
    task:
      "Perbaiki query di editor (mengandung 2 bug). Hasil yang diminta: kolom nama_dokter dan jumlah_kunjungan untuk SEMUA 10 dokter, dengan jumlah_kunjungan = banyaknya kunjungan dokter itu dengan tgl_kunjungan mulai '2026-11-01'. Dokter tanpa kunjungan November tetap tampil dengan jumlah_kunjungan 0. Urutan baris bebas.",
    hint: [
      'Syarat pada tabel kanan LEFT JOIN yang ditaruh di WHERE membuang baris dokter tanpa pasangan, karena untuk baris itu k.tgl_kunjungan bernilai NULL. Pindahkan syarat tanggal ke ON.',
      'Setelah dokter tanpa kunjungan muncul, lihat angkanya: COUNT(*) menghitung BARIS, termasuk baris hasil LEFT JOIN yang kolom kunjungannya NULL semua, jadi hasilnya 1, bukan 0.',
      'Gunakan COUNT(k.no_rawat): COUNT(kolom) melewati nilai NULL.',
    ],
    solutionSql: `SELECT
  d.nama_dokter,
  COUNT(k.no_rawat) AS jumlah_kunjungan
FROM dokter d
LEFT JOIN kunjungan k
  ON k.id_dokter = d.id_dokter
 AND k.tgl_kunjungan >= '2026-11-01'
GROUP BY d.id_dokter, d.nama_dokter;`,
    xpReward: 100,
    orderMatters: false,
    starterSql: `-- Query dari rekan: rekap kunjungan November per dokter (hasilnya keliru)
SELECT
  d.nama_dokter,
  COUNT(*) AS jumlah_kunjungan
FROM dokter d
LEFT JOIN kunjungan k ON k.id_dokter = d.id_dokter
WHERE k.tgl_kunjungan >= '2026-11-01'
GROUP BY d.id_dokter, d.nama_dokter;`,
    fix: { bugCount: 2 },
  },

  /* ------------------------------------------------------------------ */
  /* Tier 3 – Kasus Nyata SIMRS                                          */
  /* ------------------------------------------------------------------ */
  {
    id: 't3-bpjs-per-poli',
    kind: 'sql',
    tier: 3,
    order: 17,
    title: 'Rekap Kunjungan BPJS per Poli',
    concept: 'JOIN + GROUP BY + ORDER BY',
    story:
      'Tim Casemix menyiapkan laporan bulanan untuk BPJS Kesehatan. Mereka perlu tahu poliklinik mana yang paling banyak melayani pasien BPJS.',
    task:
      "Hitung jumlah kunjungan pasien dengan penjamin 'BPJS' per poliklinik, TIDAK termasuk kunjungan berstatus 'Batal'. Tampilkan kolom nama_poli dan jumlah_kunjungan. Urutkan berdasarkan jumlah_kunjungan dari yang terbanyak; jika sama, urutkan nama_poli dari A ke Z.",
    hint: [
      'Penjamin ada di tabel pasien, nama poli di tabel poliklinik, dan data kunjungan di tabel kunjungan. Ketiganya perlu di-JOIN.',
      "Saring dulu dengan WHERE p.penjamin = 'BPJS' AND k.status <> 'Batal', baru kelompokkan per poli.",
      'Akhiri dengan GROUP BY pl.id_poli, pl.nama_poli ORDER BY jumlah_kunjungan DESC, pl.nama_poli ASC.',
    ],
    solutionSql: `SELECT
  pl.nama_poli,
  COUNT(*) AS jumlah_kunjungan
FROM kunjungan k
INNER JOIN pasien p ON k.no_rm = p.no_rm
INNER JOIN poliklinik pl ON k.id_poli = pl.id_poli
WHERE p.penjamin = 'BPJS'
  AND k.status <> 'Batal'
GROUP BY pl.id_poli, pl.nama_poli
ORDER BY jumlah_kunjungan DESC, pl.nama_poli ASC;`,
    xpReward: 150,
    orderMatters: true,
    starterSql: STARTER,
  },
  {
    id: 't3-sep-kosong',
    kind: 'sql',
    tier: 3,
    order: 18,
    title: 'Risiko Klaim: SEP Belum Terbit',
    concept: 'JOIN + IS NULL',
    story:
      'Verifikator BPJS mengingatkan: kunjungan pasien BPJS yang sudah selesai tetapi tidak punya nomor SEP tidak bisa diklaim dan berisiko menjadi kerugian rumah sakit. Temukan kasus-kasus itu sebelum batas pengajuan klaim!',
    task:
      "Tampilkan kolom no_rawat, nama, nama_poli, dan tgl_kunjungan untuk kunjungan pasien dengan penjamin 'BPJS' yang status kunjungannya 'Selesai' tetapi no_sep masih kosong (NULL). Kunjungan 'Dirawat' belum bisa diklaim karena pasien masih dirawat, jadi saring dengan status = 'Selesai' (bukan sekadar status <> 'Batal'). Urutan baris bebas.",
    hint: [
      'Kamu butuh tiga tabel: kunjungan (status, no_sep), pasien (penjamin, nama), dan poliklinik (nama_poli).',
      "Ada tiga syarat di WHERE yang digabung dengan AND: penjamin, status, dan no_sep. Untuk status, pakai k.status = 'Selesai' — kunjungan 'Dirawat' maupun 'Batal' sama-sama belum bisa diklaim.",
      "Nilai kosong diperiksa dengan k.no_sep IS NULL — perbandingan k.no_sep = NULL selalu menghasilkan tidak ada baris.",
    ],
    solutionSql: `SELECT
  k.no_rawat,
  p.nama,
  pl.nama_poli,
  k.tgl_kunjungan
FROM kunjungan k
INNER JOIN pasien p ON k.no_rm = p.no_rm
INNER JOIN poliklinik pl ON k.id_poli = pl.id_poli
WHERE p.penjamin = 'BPJS'
  AND k.status = 'Selesai'
  AND k.no_sep IS NULL;`,
    xpReward: 150,
    orderMatters: false,
    starterSql: STARTER,
  },
  {
    id: 't3-kinerja-dokter',
    kind: 'sql',
    tier: 3,
    order: 19,
    title: 'Kinerja & Pendapatan Dokter',
    concept: 'LEFT JOIN + Agregasi',
    story:
      'Direktur rumah sakit sedang menyusun skema insentif jasa medis. Ia meminta peringkat dokter berdasarkan seluruh pendaftaran pasien ke dokter tersebut (termasuk yang akhirnya batal), berapa kunjungan yang sudah ditagih, dan total pendapatan yang dihasilkan.',
    task:
      "Untuk setiap dokter yang pernah punya kunjungan, tampilkan kolom nama_dokter, spesialisasi, jumlah_kunjungan (SEMUA kunjungan dokter itu, termasuk yang berstatus 'Batal'), kunjungan_ditagih (banyaknya kunjungan yang punya baris di tabel billing), dan total_pendapatan (jumlah total_biaya dari billing; gunakan 0 jika tidak ada tagihan). Urutkan berdasarkan jumlah_kunjungan terbanyak, lalu total_pendapatan terbesar, lalu nama_dokter dari A ke Z.",
    hint: [
      "Hubungkan dokter → kunjungan (id_dokter) → billing (no_rawat). Kunjungan 'Batal' tidak punya tagihan, tetapi tetap harus ikut dihitung di jumlah_kunjungan — jadi jangan disaring dengan WHERE.",
      'INNER JOIN ke billing membuang kunjungan tanpa tagihan (dr. Sari Wulandari jadi 1 kunjungan, padahal 3). Pakai LEFT JOIN billing: kolom b.* bernilai NULL untuk kunjungan tanpa tagihan, sehingga COUNT(k.no_rawat) menghitung semua kunjungan, sedangkan COUNT(b.no_rawat) hanya yang punya tagihan. Bungkus SUM dengan COALESCE(..., 0) sebagai pengaman jika seorang dokter belum punya tagihan sama sekali.',
      'GROUP BY d.id_dokter, d.nama_dokter, d.spesialisasi lalu ORDER BY jumlah_kunjungan DESC, total_pendapatan DESC, d.nama_dokter ASC.',
    ],
    solutionSql: `SELECT
  d.nama_dokter,
  d.spesialisasi,
  COUNT(k.no_rawat) AS jumlah_kunjungan,
  COUNT(b.no_rawat) AS kunjungan_ditagih,
  COALESCE(SUM(b.total_biaya), 0) AS total_pendapatan
FROM dokter d
INNER JOIN kunjungan k ON d.id_dokter = k.id_dokter
LEFT JOIN billing b ON k.no_rawat = b.no_rawat
GROUP BY d.id_dokter, d.nama_dokter, d.spesialisasi
ORDER BY jumlah_kunjungan DESC, total_pendapatan DESC, d.nama_dokter ASC;`,
    xpReward: 150,
    orderMatters: true,
    starterSql: STARTER,
  },
  {
    id: 't3-kategori-piutang',
    kind: 'sql',
    tier: 3,
    order: 20,
    title: 'Klasifikasi Piutang Pasien',
    concept: 'CASE WHEN',
    story:
      'Manajer Keuangan ingin memprioritaskan penagihan piutang. Tagihan yang belum lunas perlu diberi label besar-kecilnya agar tim penagihan tahu mana yang harus didahulukan.',
    task:
      "Untuk tagihan dengan status_bayar 'Belum Lunas', tampilkan kolom no_rawat, nama (nama pasien), total_biaya, dan kategori. Aturan kategori: total_biaya di bawah 500000 → 'Kecil'; 500000 sampai 5000000 (kedua batas termasuk Sedang) → 'Sedang'; di atas 5000000 → 'Besar'. Urutan baris bebas.",
    hint: [
      'Nama pasien ada di tabel pasien, jadi hubungkan billing → kunjungan (no_rawat) → pasien (no_rm).',
      "CASE WHEN dievaluasi berurutan dari atas: CASE WHEN kondisi1 THEN 'A' WHEN kondisi2 THEN 'B' ELSE 'C' END AS kategori.",
      "Contoh kerangka: CASE WHEN b.total_biaya < 500000 THEN 'Kecil' WHEN b.total_biaya <= 5000000 THEN ... ELSE ... END AS kategori.",
    ],
    solutionSql: `SELECT
  b.no_rawat,
  p.nama,
  b.total_biaya,
  CASE
    WHEN b.total_biaya < 500000 THEN 'Kecil'
    WHEN b.total_biaya <= 5000000 THEN 'Sedang'
    ELSE 'Besar'
  END AS kategori
FROM billing b
INNER JOIN kunjungan k ON b.no_rawat = k.no_rawat
INNER JOIN pasien p ON k.no_rm = p.no_rm
WHERE b.status_bayar = 'Belum Lunas';`,
    xpReward: 150,
    orderMatters: false,
    starterSql: STARTER,
  },
  {
    id: 't3-subquery-tagihan',
    kind: 'sql',
    tier: 3,
    order: 21,
    title: 'Pasien dengan Tagihan di Atas Rata-rata',
    concept: 'Subquery',
    story:
      'Tim Case Manager ingin memantau pasien dengan beban biaya tinggi. Patokannya: total tagihan pasien lebih besar dari rata-rata nilai satu tagihan di rumah sakit.',
    task:
      'Hitung total_tagihan per pasien = jumlah total_biaya dari seluruh kunjungannya. Tampilkan kolom no_rm, nama, dan total_tagihan hanya untuk pasien yang total_tagihan-nya LEBIH BESAR dari rata-rata total_biaya seluruh baris di tabel billing. Urutan baris bebas.',
    hint: [
      'Rata-rata seluruh tagihan bisa dihitung dengan subquery: (SELECT AVG(total_biaya) FROM billing).',
      'Total per pasien: JOIN pasien → kunjungan → billing, lalu GROUP BY p.no_rm, p.nama dengan SUM(b.total_biaya) AS total_tagihan.',
      'Karena yang dibandingkan adalah hasil SUM, letakkan perbandingannya di HAVING: HAVING SUM(b.total_biaya) > (subquery).',
    ],
    solutionSql: `SELECT
  p.no_rm,
  p.nama,
  SUM(b.total_biaya) AS total_tagihan
FROM pasien p
INNER JOIN kunjungan k ON p.no_rm = k.no_rm
INNER JOIN billing b ON k.no_rawat = b.no_rawat
GROUP BY p.no_rm, p.nama
HAVING SUM(b.total_biaya) > (SELECT AVG(total_biaya) FROM billing);`,
    xpReward: 150,
    orderMatters: false,
    starterSql: STARTER,
  },
  {
    id: 't3-predict-count',
    kind: 'predict',
    tier: 3,
    order: 22,
    title: 'Tebak: Tiga Wajah COUNT',
    concept: 'Tebak Hasil: COUNT(*) vs COUNT(kolom)',
    story:
      'Koordinator Casemix ingin satu tabel ringkas per status kunjungan: jumlah kunjungan, jumlah yang SEP-nya sudah terbit, dan jumlah pasien berbeda. Ketiganya ditulis dengan COUNT, tetapi hasilnya tidak sama. Tebak dulu sebelum menjalankan.',
    task:
      'Baca query di panel kanan TANPA menjalankannya, lalu pilih tabel yang benar-benar dihasilkan. Perhatikan beda COUNT(*), COUNT(no_sep), dan COUNT(DISTINCT no_rm).',
    hint: [
      'COUNT(*) menghitung baris, apa pun isinya. COUNT(kolom) hanya menghitung baris yang kolomnya TIDAK NULL. no_sep bernilai NULL jika SEP belum terbit.',
      'COUNT(DISTINCT no_rm) menghitung pasien yang berbeda: pasien yang datang dua kali dengan status sama hanya dihitung sekali. Di status Selesai ada 25 kunjungan, tetapi beberapa pasien datang lebih dari sekali.',
    ],
    query: `SELECT
  status,
  COUNT(*) AS semua,
  COUNT(no_sep) AS ada_sep,
  COUNT(DISTINCT no_rm) AS pasien
FROM kunjungan
GROUP BY status
ORDER BY status;`,
    explanation:
      'COUNT(*) menghitung semua baris tiap grup (Batal 4, Dirawat 3, Selesai 25). COUNT(no_sep) melewati baris yang no_sep-nya NULL, jadi hanya kunjungan ber-SEP yang dihitung (0, 1, 15). COUNT(DISTINCT no_rm) menghitung pasien unik: 25 kunjungan Selesai berasal dari 16 pasien berbeda karena beberapa pasien datang berulang.',
    distractors: [
      {
        sql: `SELECT
  status,
  COUNT(*) AS semua,
  COUNT(*) AS ada_sep,
  COUNT(DISTINCT no_rm) AS pasien
FROM kunjungan
GROUP BY status
ORDER BY status;`,
        misconception:
          'Mengira COUNT(no_sep) sama dengan COUNT(*). Padahal COUNT(kolom) melewati NULL: kunjungan tanpa SEP tidak ikut dihitung.',
      },
      {
        sql: `SELECT
  status,
  COUNT(*) AS semua,
  COUNT(no_sep) AS ada_sep,
  COUNT(no_rm) AS pasien
FROM kunjungan
GROUP BY status
ORDER BY status;`,
        misconception:
          'Mengira DISTINCT di dalam COUNT tidak berpengaruh. Pasien yang datang lebih dari sekali dengan status yang sama hanya dihitung satu kali oleh COUNT(DISTINCT no_rm).',
      },
      {
        sql: `SELECT
  status,
  COUNT(no_sep) AS semua,
  COUNT(no_sep) AS ada_sep,
  COUNT(DISTINCT no_rm) AS pasien
FROM kunjungan
GROUP BY status
ORDER BY status;`,
        misconception:
          'Mengira COUNT(*) juga melewati baris yang punya NULL. COUNT(*) menghitung baris apa adanya, NULL atau tidak.',
      },
    ],
    xpReward: 150,
    orderMatters: true,
  },
  {
    id: 't3-fix-persen',
    kind: 'sql',
    tier: 3,
    order: 23,
    title: 'Persentase SEP yang Selalu Nol',
    concept: 'Debug: Pembagian Bilangan Bulat',
    story:
      'Koordinator Klaim BPJS meminta persentase kunjungan yang SEP-nya sudah terbit di setiap poliklinik. Query rekanmu berjalan tanpa error, tetapi hampir semua poli menunjukkan 0%, padahal jelas ada SEP yang terbit.',
    task:
      'Perbaiki query di editor (mengandung 1 bug). Hasil yang diminta per poliklinik: kolom nama_poli, total_kunjungan (banyaknya kunjungan di poli itu), dan persen_sep = jumlah kunjungan yang no_sep-nya terisi dibagi total_kunjungan dikali 100, dibulatkan 1 angka desimal (mis. 14.3). Urutan baris bebas.',
    hint: [
      'Di SQLite, bilangan bulat dibagi bilangan bulat menghasilkan bilangan bulat (dibulatkan ke bawah): 1 / 7 = 0, sehingga 0 * 100 tetap 0.',
      'Jadikan salah satu operan desimal SEBELUM dibagi, mis. COUNT(k.no_sep) * 100.0 / COUNT(*). Urutan juga penting: kalikan 100.0 dulu, baru bagi.',
      'Bulatkan dengan ROUND(nilai, 1) agar sesuai permintaan 1 angka desimal.',
    ],
    solutionSql: `SELECT
  p.nama_poli,
  COUNT(*) AS total_kunjungan,
  ROUND(COUNT(k.no_sep) * 100.0 / COUNT(*), 1) AS persen_sep
FROM kunjungan k
INNER JOIN poliklinik p ON p.id_poli = k.id_poli
GROUP BY p.id_poli, p.nama_poli;`,
    xpReward: 150,
    orderMatters: false,
    starterSql: `-- Query dari rekan: persentase SEP terbit per poli (hasilnya keliru)
SELECT
  p.nama_poli,
  COUNT(*) AS total_kunjungan,
  ROUND(COUNT(k.no_sep) / COUNT(*) * 100, 1) AS persen_sep
FROM kunjungan k
INNER JOIN poliklinik p ON p.id_poli = k.id_poli
GROUP BY p.id_poli, p.nama_poli;`,
    fix: { bugCount: 1 },
  },
  {
    id: 't3-fix-fan-out',
    kind: 'sql',
    tier: 3,
    order: 24,
    title: 'Tagihan yang Membengkak Sendiri',
    concept: 'Debug: JOIN Fan-out',
    story:
      'Program Pengelolaan Penyakit Kronis ingin tahu beban biaya pasien hipertensi (I10) dan diabetes (E11.9). Bagian Keuangan protes: total tagihan beberapa pasien di laporan rekanmu lebih besar daripada jumlah tagihan aslinya.',
    task:
      "Perbaiki query di editor (mengandung 1 bug). Hasil yang diminta per pasien: kolom no_rm, jumlah_kunjungan, dan total_tagihan, dengan hanya menghitung kunjungan yang memiliki minimal satu diagnosa berkode 'I10' atau 'E11.9' (dan punya tagihan). SETIAP kunjungan dihitung SEKALI, walaupun kunjungan itu memiliki kedua diagnosa. jumlah_kunjungan = banyaknya kunjungan tersebut, total_tagihan = jumlah total_biaya-nya. Urutan baris bebas.",
    hint: [
      'Coba lihat isi diagnosa untuk no_rawat 2026/10/01/000001: kunjungan itu punya DUA diagnosa yang cocok (I10 dan E11.9). JOIN ke diagnosa membuat baris tagihannya muncul dua kali, sehingga SUM dan COUNT ikut terhitung dua kali.',
      'Jangan JOIN ke diagnosa untuk menyaring. Gunakan k.no_rawat IN (SELECT no_rawat FROM diagnosa WHERE kode_icd10 IN (...)) atau EXISTS, sehingga setiap kunjungan tetap satu baris.',
      'Jebakan: SUM(DISTINCT b.total_biaya) kebetulan memberi angka yang benar di data ini, tetapi salah bila seorang pasien punya dua kunjungan dengan nominal tagihan yang sama. Perbaiki sumber duplikasinya, bukan gejalanya.',
    ],
    solutionSql: `SELECT
  k.no_rm,
  COUNT(*) AS jumlah_kunjungan,
  SUM(b.total_biaya) AS total_tagihan
FROM kunjungan k
INNER JOIN billing b ON b.no_rawat = k.no_rawat
WHERE EXISTS (
  SELECT 1
  FROM diagnosa d
  WHERE d.no_rawat = k.no_rawat
    AND d.kode_icd10 IN ('I10', 'E11.9')
)
GROUP BY k.no_rm;`,
    xpReward: 150,
    orderMatters: false,
    starterSql: `-- Query dari rekan: tagihan pasien hipertensi/diabetes (angkanya membengkak)
SELECT
  k.no_rm,
  COUNT(*) AS jumlah_kunjungan,
  SUM(b.total_biaya) AS total_tagihan
FROM kunjungan k
INNER JOIN billing b ON b.no_rawat = k.no_rawat
INNER JOIN diagnosa d ON d.no_rawat = k.no_rawat
WHERE d.kode_icd10 IN ('I10', 'E11.9')
GROUP BY k.no_rm;`,
    fix: { bugCount: 1 },
  },
];
