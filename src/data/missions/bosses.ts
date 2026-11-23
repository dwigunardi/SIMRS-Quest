/**
 * Boss Challenge: satu soal gabungan di akhir setiap tier (order 8, 16, 25, 33, 39, 45, 51, 55, 63, 72).
 *
 * Aturan (lihat src/lib/boss.ts & isMissionUnlocked):
 * - terbuka setelah SEMUA misi lain di tier-nya selesai, dan tidak mengunci tier berikutnya;
 * - tanpa hint (`hint: []`) dan tanpa materi khusus; solusi baru bisa dibuka setelah 3 percobaan;
 * - XP besar (BOSS_XP), dinilai dengan mesin yang sama seperti misi SQL biasa.
 * Setiap soal sengaja menggabungkan jebakan dari misi-misi tier itu (mis. OR tanpa kurung, filter LEFT JOIN di
 * WHERE, JOIN fan-out, LIKE yang tidak memakai index). Jawaban salah & formulasi setara diuji di
 * scripts/test-cases/bosses.ts.
 */
import type { SqlMission, Tier } from '../../types';

export const BOSS_XP: Record<Tier, number> = { 1: 100, 2: 200, 3: 300, 4: 350, 5: 400, 6: 400, 7: 450, 8: 500, 9: 600, 10: 650 };

const STARTER = (tier: Tier) =>
  `-- Boss Tier ${tier}: tanpa hint. Baca tugasnya pelan-pelan, pecah jadi langkah kecil,\n-- dan cek hasil antara dengan tombol Urutan Eksekusi.\n`;

const STARTER_DML =
  '-- Boss Tier 6: tanpa hint. Coba tiap langkah dulu di Free Playground (cek isinya dengan SELECT),\n-- lalu satukan di sini sebagai satu transaksi.\n';

export const MISSIONS_BOSS: SqlMission[] = [
  /* ------------------------------------------------------------------ */
  /* Tier 1 – Dasar Query                                                */
  /* ------------------------------------------------------------------ */
  {
    id: 'boss-t1-skrining',
    kind: 'sql',
    tier: 1,
    order: 8,
    title: 'Boss: Undangan Skrining Hipertensi',
    concept: 'Boss Tier 1',
    story:
      'Dinas Kesehatan membuka program skrining hipertensi gratis untuk warga berusia 35 tahun ke atas. Program ini hanya menanggung pasien BPJS dan Umum. Tim lapangan sudah mendatangi semua kota berawalan huruf B minggu lalu, dan kuota undangan gelombang pertama hanya 5 orang. Undangan dicetak per kota, dan di dalam satu kota yang tertua diundang lebih dulu.',
    task:
      "Tampilkan kolom nama, kota, dan tgl_lahir dari tabel pasien untuk pasien yang penjaminnya 'BPJS' atau 'Umum', lahir sebelum 1 Januari 1991 (tgl_lahir < '1991-01-01'), dan kotanya TIDAK berawalan huruf B. Urutkan berdasarkan kota (A→Z), lalu tgl_lahir dari yang paling tua. Ambil 5 baris pertama saja.",
    hint: [],
    solutionSql: `SELECT
  nama,
  kota,
  tgl_lahir
FROM pasien
WHERE (penjamin = 'BPJS' OR penjamin = 'Umum')
  AND tgl_lahir < '1991-01-01'
  AND kota NOT LIKE 'B%'
ORDER BY kota ASC, tgl_lahir ASC
LIMIT 5;`,
    starterSql: `${STARTER(1)}SELECT `,
    xpReward: BOSS_XP[1],
    orderMatters: true,
    boss: { combines: ['t1-where', 't1-like', 't1-order-limit'] },
  },

  /* ------------------------------------------------------------------ */
  /* Tier 2 – Relasi & Agregasi                                          */
  /* ------------------------------------------------------------------ */
  {
    id: 'boss-t2-kontrol',
    kind: 'sql',
    tier: 2,
    order: 16,
    title: 'Boss: Pasien BPJS yang Jarang Kontrol',
    concept: 'Boss Tier 2',
    story:
      'Program Rujuk Balik BPJS meminta rumah sakit menelepon peserta yang jarang datang kontrol. Kunjungan berstatus Batal tidak dihitung karena pasiennya tidak benar-benar diperiksa. Peserta yang belum pernah datang sama sekali justru paling penting untuk dihubungi, jadi jangan sampai hilang dari daftar.',
    task:
      "Untuk setiap pasien dengan penjamin 'BPJS', tampilkan no_rm, nama, jumlah_kunjungan (banyaknya kunjungan yang statusnya BUKAN 'Batal'), dan total_tagihan (jumlah total_biaya dari kunjungan-kunjungan itu; biarkan NULL bila tidak ada tagihan). Tampilkan hanya pasien dengan jumlah_kunjungan kurang dari 2, TERMASUK pasien yang belum pernah berkunjung (jumlah_kunjungan 0). Urutan baris bebas.",
    hint: [],
    solutionSql: `SELECT
  p.no_rm,
  p.nama,
  COUNT(k.no_rawat) AS jumlah_kunjungan,
  SUM(b.total_biaya) AS total_tagihan
FROM pasien p
LEFT JOIN kunjungan k
  ON k.no_rm = p.no_rm
 AND k.status <> 'Batal'
LEFT JOIN billing b ON b.no_rawat = k.no_rawat
WHERE p.penjamin = 'BPJS'
GROUP BY p.no_rm, p.nama
HAVING COUNT(k.no_rawat) < 2;`,
    starterSql: `${STARTER(2)}SELECT `,
    xpReward: BOSS_XP[2],
    orderMatters: false,
    boss: { combines: ['t2-left-join', 't2-count-group', 't2-sum-avg', 't2-having', 't2-fix-left-join'] },
  },

  /* ------------------------------------------------------------------ */
  /* Tier 3 – Kasus Nyata SIMRS                                          */
  /* ------------------------------------------------------------------ */
  {
    id: 'boss-t3-beban-dokter',
    kind: 'sql',
    tier: 3,
    order: 25,
    title: 'Boss: Rapor Beban Kerja Dokter',
    concept: 'Boss Tier 3',
    story:
      'Komite Medik menyusun rapor beban kerja dokter untuk rapat bulanan: berapa pasien yang ditangani, berapa diagnosa yang ditegakkan, dan berapa nilai layanannya. Tahun lalu laporan serupa ditolak Direksi karena total tagihan beberapa dokter tercatat dua kali lipat dari nilai aslinya. Jangan sampai terulang.',
    task:
      "Untuk setiap dokter yang punya minimal satu kunjungan berstatus BUKAN 'Batal', tampilkan: nama_dokter; jumlah_kunjungan (banyaknya kunjungan non-Batal); jumlah_diagnosa (banyaknya baris diagnosa milik kunjungan-kunjungan itu, 0 bila tidak ada); total_tagihan (jumlah total_biaya kunjungan-kunjungan itu, setiap tagihan dihitung SEKALI); dan kategori_beban: 'Tinggi' bila total_tagihan ≥ 5.000.000, 'Sedang' bila ≥ 1.000.000, selain itu 'Rendah'. Urutkan dari total_tagihan terbesar.",
    hint: [],
    solutionSql: `WITH kunjungan_aktif AS (
  SELECT no_rawat, id_dokter
  FROM kunjungan
  WHERE status <> 'Batal'
),
per_dokter AS (
  SELECT
    k.id_dokter,
    COUNT(*) AS jumlah_kunjungan,
    SUM(b.total_biaya) AS total_tagihan
  FROM kunjungan_aktif k
  LEFT JOIN billing b ON b.no_rawat = k.no_rawat
  GROUP BY k.id_dokter
)
SELECT
  d.nama_dokter,
  pd.jumlah_kunjungan,
  (
    SELECT COUNT(*)
    FROM diagnosa dx
    INNER JOIN kunjungan_aktif k ON k.no_rawat = dx.no_rawat
    WHERE k.id_dokter = d.id_dokter
  ) AS jumlah_diagnosa,
  pd.total_tagihan,
  CASE
    WHEN pd.total_tagihan >= 5000000 THEN 'Tinggi'
    WHEN pd.total_tagihan >= 1000000 THEN 'Sedang'
    ELSE 'Rendah'
  END AS kategori_beban
FROM dokter d
INNER JOIN per_dokter pd ON pd.id_dokter = d.id_dokter
ORDER BY pd.total_tagihan DESC;`,
    starterSql: `${STARTER(3)}SELECT `,
    xpReward: BOSS_XP[3],
    orderMatters: true,
    boss: { combines: ['t3-kinerja-dokter', 't3-kategori-piutang', 't3-subquery-tagihan', 't3-fix-fan-out'] },
  },

  /* ------------------------------------------------------------------ */
  /* Tier 4 – CTE, JOIN Lanjutan & Rekursif                              */
  /* ------------------------------------------------------------------ */
  {
    id: 'boss-t4-matriks-gedung',
    kind: 'sql',
    tier: 4,
    order: 33,
    title: 'Boss: Matriks Kepadatan Gedung',
    concept: 'Boss Tier 4',
    story:
      'Bagian Umum merencanakan jadwal petugas kebersihan dan satpam per gedung untuk minggu pertama November. Mereka butuh tabel lengkap: SETIAP tanggal dari 1 sampai 7 November 2026 untuk SETIAP gedung, walaupun pada hari itu gedungnya kosong. Baris yang hilang akan dibaca sebagai "tidak perlu petugas", padahal datanya memang nol.',
    task:
      "Tampilkan kolom tanggal, gedung, dan jumlah_kunjungan untuk setiap kombinasi tanggal '2026-11-01' sampai '2026-11-07' (7 tanggal) dan setiap gedung yang ada di tabel poliklinik. jumlah_kunjungan = banyaknya kunjungan berstatus BUKAN 'Batal' pada tanggal itu di poliklinik yang berada di gedung itu; tulis 0 (bukan NULL) bila tidak ada. Hasilnya harus 21 baris, diurutkan berdasarkan tanggal lalu gedung.",
    hint: [],
    solutionSql: `WITH RECURSIVE tanggal (tgl) AS (
  SELECT '2026-11-01'
  UNION ALL
  SELECT date(tgl, '+1 day') FROM tanggal WHERE tgl < '2026-11-07'
),
daftar_gedung AS (
  SELECT DISTINCT gedung FROM poliklinik
),
harian AS (
  SELECT k.tgl_kunjungan, p.gedung, COUNT(*) AS jumlah
  FROM kunjungan k
  INNER JOIN poliklinik p ON p.id_poli = k.id_poli
  WHERE k.status <> 'Batal'
  GROUP BY k.tgl_kunjungan, p.gedung
)
SELECT
  t.tgl AS tanggal,
  g.gedung,
  COALESCE(h.jumlah, 0) AS jumlah_kunjungan
FROM tanggal t
CROSS JOIN daftar_gedung g
LEFT JOIN harian h
  ON h.tgl_kunjungan = t.tgl
 AND h.gedung = g.gedung
ORDER BY t.tgl, g.gedung;`,
    starterSql: `${STARTER(4)}WITH `,
    xpReward: BOSS_XP[4],
    orderMatters: true,
    boss: { combines: ['t4-cte', 't4-cross-join', 't4-recursive-dates'] },
  },

  /* ------------------------------------------------------------------ */
  /* Tier 5 – Window Functions                                           */
  /* ------------------------------------------------------------------ */
  {
    id: 'boss-t5-tagihan-teratas',
    kind: 'sql',
    tier: 5,
    order: 39,
    title: 'Boss: Dua Tagihan Teratas per Poli',
    concept: 'Boss Tier 5',
    story:
      'Tim Audit Internal memeriksa tagihan terbesar di setiap poliklinik. Untuk setiap poli mereka ingin melihat dua tagihan teratas, seberapa jauh tagihan kedua tertinggal dari yang pertama, dan berapa persen porsi masing-masing terhadap seluruh tagihan poli itu. Porsi dihitung dari SEMUA tagihan poli, bukan hanya dari dua yang ditampilkan.',
    task:
      'Untuk setiap tagihan (billing beserta kunjungannya), hitung per poliklinik: peringkat (RANK berdasarkan total_biaya terbesar), selisih_dari_atas (total_biaya baris sebelumnya dalam urutan peringkat yang sama dikurangi total_biaya baris ini; NULL untuk peringkat 1), dan persen_dari_poli (100 × total_biaya ÷ jumlah seluruh total_biaya poli itu, dibulatkan 1 desimal). Tampilkan hanya baris dengan peringkat ≤ 2, dengan kolom nama_poli, no_rawat, total_biaya, peringkat, selisih_dari_atas, persen_dari_poli. Urutkan berdasarkan nama_poli lalu peringkat.',
    hint: [],
    solutionSql: `WITH tagihan_poli AS (
  SELECT
    p.nama_poli,
    k.no_rawat,
    b.total_biaya,
    RANK() OVER (PARTITION BY p.id_poli ORDER BY b.total_biaya DESC) AS peringkat,
    LAG(b.total_biaya) OVER (PARTITION BY p.id_poli ORDER BY b.total_biaya DESC) - b.total_biaya AS selisih_dari_atas,
    ROUND(100.0 * b.total_biaya / SUM(b.total_biaya) OVER (PARTITION BY p.id_poli), 1) AS persen_dari_poli
  FROM billing b
  INNER JOIN kunjungan k ON k.no_rawat = b.no_rawat
  INNER JOIN poliklinik p ON p.id_poli = k.id_poli
)
SELECT nama_poli, no_rawat, total_biaya, peringkat, selisih_dari_atas, persen_dari_poli
FROM tagihan_poli
WHERE peringkat <= 2
ORDER BY nama_poli, peringkat;`,
    starterSql: `${STARTER(5)}WITH `,
    xpReward: BOSS_XP[5],
    orderMatters: true,
    boss: { combines: ['t5-rank', 't5-running-total', 't5-lag'] },
  },

  /* ------------------------------------------------------------------ */
  /* Tier 6 – DML & Transaksi                                            */
  /* ------------------------------------------------------------------ */
  {
    id: 'boss-t6-tutup-shift',
    kind: 'sql',
    tier: 6,
    order: 45,
    title: 'Boss: Tutup Shift Malam',
    concept: 'Boss Tier 6',
    story:
      'Menjelang pergantian shift, petugas IT jaga malam harus menyelesaikan tiga pekerjaan sebagai SATU paket: kalau salah satu gagal, semuanya harus batal agar data tidak setengah jadi. Tabel kunjungan dan billing saling terhubung lewat FOREIGN KEY, jadi urutan langkah juga menentukan.',
    task:
      "Kerjakan dalam SATU transaksi (BEGIN … COMMIT):\n1. Registrasi kunjungan baru: no_rawat '2026/11/16/000001', no_rm 'RM-0019', id_poli 'P06', id_dokter 'D008', tgl_kunjungan '2026-11-16', no_sep '0301R0011126V000131', status 'Selesai'; beserta tagihannya: total_biaya 400000, status_bayar 'Belum Lunas' (id_billing boleh dibiarkan otomatis).\n2. Pelunasan dari perusahaan asuransi: ubah status_bayar menjadi 'Lunas' untuk SEMUA tagihan 'Belum Lunas' milik pasien yang penjaminnya 'Asuransi'. Tagihan pasien lain tidak boleh berubah.\n3. Bersih-bersih: hapus kunjungan berstatus 'Batal' yang tidak punya diagnosa maupun tagihan.\nPenilaian membaca isi SEMUA tabel setelah skripmu selesai.",
    hint: [],
    solutionSql: `BEGIN;

INSERT INTO kunjungan (no_rawat, no_rm, id_poli, id_dokter, tgl_kunjungan, no_sep, status)
VALUES ('2026/11/16/000001', 'RM-0019', 'P06', 'D008', '2026-11-16', '0301R0011126V000131', 'Selesai');

INSERT INTO billing (no_rawat, total_biaya, status_bayar)
VALUES ('2026/11/16/000001', 400000, 'Belum Lunas');

UPDATE billing
SET status_bayar = 'Lunas'
WHERE status_bayar = 'Belum Lunas'
  AND no_rawat IN (
    SELECT k.no_rawat
    FROM kunjungan k
    INNER JOIN pasien p ON p.no_rm = k.no_rm
    WHERE p.penjamin = 'Asuransi'
  );

DELETE FROM kunjungan
WHERE status = 'Batal'
  AND no_rawat NOT IN (SELECT no_rawat FROM diagnosa)
  AND no_rawat NOT IN (SELECT no_rawat FROM billing);

COMMIT;`,
    starterSql: STARTER_DML,
    xpReward: BOSS_XP[6],
    orderMatters: true,
    grading: {
      type: 'state',
      verifySql: `SELECT
  k.no_rawat, k.no_rm, k.id_poli, k.id_dokter, k.tgl_kunjungan, k.no_sep, k.status,
  b.id_billing, b.total_biaya, b.status_bayar
FROM kunjungan AS k
LEFT JOIN billing AS b ON b.no_rawat = k.no_rawat
ORDER BY k.no_rawat;`,
      label: 'Kunjungan + billing',
      transaction: { requireRolledBackChange: false },
    },
    requiredPatterns: [
      { pattern: String.raw`\bBEGIN\b`, message: 'Ketiga pekerjaan harus menjadi satu paket: mulai dengan BEGIN;.' },
      { pattern: String.raw`\bCOMMIT\b`, message: 'Akhiri paket pekerjaan dengan COMMIT; agar perubahannya tersimpan permanen.' },
    ],
    boss: { combines: ['t6-insert', 't6-update', 't6-delete', 't6-transaction-commit'] },
  },

  /* ------------------------------------------------------------------ */
  /* Tier 7 – Optimasi & Keamanan                                        */
  /* ------------------------------------------------------------------ */
  {
    id: 'boss-t7-registri-jantung',
    kind: 'sql',
    tier: 7,
    order: 51,
    title: 'Boss: Registri Penyakit Jantung Koroner',
    concept: 'Boss Tier 7',
    story:
      'Registri penyakit jantung koroner nasional meminta data pasien dengan diagnosa ICD-10 I20 sampai I25 (I20.0, I21.9, I25.1, dan seterusnya). Query ini akan dipanggil aplikasi registri setiap jam pada tabel diagnosa yang di RS sungguhan berisi jutaan baris, jadi Tim Database hanya mau menerimanya bila benar-benar memakai index, bukan membaca seluruh tabel.',
    task:
      "Dalam satu skrip: (1) buat index yang dibutuhkan pada tabel diagnosa, lalu (2) tampilkan no_rm, nama, tgl_kunjungan, kode_icd10, dan nama_penyakit untuk setiap diagnosa dengan kode_icd10 dari 'I20' sampai sebelum 'I26' (semua kode berawalan I20–I25), diurutkan berdasarkan tgl_kunjungan. Hasil harus benar DAN query plan statement terakhir harus mencari tabel diagnosa lewat index pada kode_icd10 dengan batas bawah dan batas atas (SEARCH, bukan SCAN). Kolom kode_icd10 tidak boleh dibungkus fungsi.",
    hint: [],
    solutionSql: `CREATE INDEX idx_diagnosa_icd10 ON diagnosa (kode_icd10);

SELECT
  p.no_rm,
  p.nama,
  k.tgl_kunjungan,
  d.kode_icd10,
  d.nama_penyakit
FROM diagnosa d
INNER JOIN kunjungan k ON k.no_rawat = d.no_rawat
INNER JOIN pasien p ON p.no_rm = k.no_rm
WHERE d.kode_icd10 >= 'I20'
  AND d.kode_icd10 < 'I26'
ORDER BY k.tgl_kunjungan;`,
    starterSql: STARTER(7),
    xpReward: BOSS_XP[7],
    orderMatters: true,
    grading: { type: 'result', requireIndexOn: { table: 'diagnosa', column: 'kode_icd10' } },
    requiredPatterns: [
      { pattern: String.raw`CREATE\s+INDEX`, message: 'Tabel diagnosa belum punya index pada kode_icd10: buat dulu dengan CREATE INDEX di skrip yang sama.' },
    ],
    boss: { combines: ['t7-index', 't7-sargable'] },
  },

  /* ------------------------------------------------------------------ */
  /* Tier 8 – Konsep Prosedural & Skala Besar                           */
  /* ------------------------------------------------------------------ */
  {
    id: 'boss-t8-final',
    kind: 'sql',
    tier: 8,
    order: 55,
    title: 'Boss: Pensiunkan Cursor Lama',
    concept: 'Boss Tier 8',
    story:
      'SIMRS lama punya prosedur malam yang memakai CURSOR untuk menghitung pasien yang kembali berobat dalam 30 hari (indikator mutu "kunjungan ulang"). Prosedur itu membaca kunjungan satu per satu, sangat lambat, dan tidak bisa dipindahkan ke SIMRS baru. Kepala Instalasi SIMRS menugaskanmu menggantinya dengan SATU query set-based yang hasilnya persis sama. Kode lamanya ada di editor.',
    task:
      "Tulis ulang logika cursor di editor menjadi satu query (tanpa loop). Hanya kunjungan berstatus BUKAN 'Batal' yang dihitung. Sebuah kunjungan disebut kunjungan ulang bila pasien yang sama punya kunjungan non-Batal sebelumnya dan jaraknya paling lama 30 hari. Untuk setiap pasien yang punya minimal SATU kunjungan ulang, tampilkan no_rm, nama, jumlah_kunjungan (semua kunjungan non-Batal pasien itu), kunjungan_ulang_30hari, dan total_tagihan (jumlah total_biaya semua kunjungan non-Batal pasien itu). Urutkan dari total_tagihan terbesar.",
    hint: [],
    solutionSql: `WITH riwayat AS (
  SELECT
    k.no_rm,
    b.total_biaya,
    julianday(k.tgl_kunjungan)
      - julianday(LAG(k.tgl_kunjungan) OVER (PARTITION BY k.no_rm ORDER BY k.tgl_kunjungan)) AS jarak_hari
  FROM kunjungan k
  LEFT JOIN billing b ON b.no_rawat = k.no_rawat
  WHERE k.status <> 'Batal'
),
rekap AS (
  SELECT
    no_rm,
    COUNT(*) AS jumlah_kunjungan,
    SUM(CASE WHEN jarak_hari <= 30 THEN 1 ELSE 0 END) AS kunjungan_ulang_30hari,
    SUM(total_biaya) AS total_tagihan
  FROM riwayat
  GROUP BY no_rm
)
SELECT p.no_rm, p.nama, r.jumlah_kunjungan, r.kunjungan_ulang_30hari, r.total_tagihan
FROM rekap r
INNER JOIN pasien p ON p.no_rm = r.no_rm
WHERE r.kunjungan_ulang_30hari >= 1
ORDER BY r.total_tagihan DESC;`,
    starterSql: `-- Boss Tier 8: tanpa hint. Prosedur lama (T-SQL, SQL Server) yang harus dipensiunkan:
--
-- CREATE TABLE #rekap (no_rm VARCHAR(10) PRIMARY KEY, jumlah_kunjungan INT, kunjungan_ulang_30hari INT, total_tagihan BIGINT);
-- DECLARE @no_rm VARCHAR(10), @tgl DATE, @biaya BIGINT, @prev_rm VARCHAR(10) = NULL, @prev_tgl DATE = NULL;
-- DECLARE c CURSOR FOR
--   SELECT k.no_rm, k.tgl_kunjungan, b.total_biaya
--   FROM kunjungan k LEFT JOIN billing b ON b.no_rawat = k.no_rawat
--   WHERE k.status <> 'Batal'
--   ORDER BY k.no_rm, k.tgl_kunjungan;
-- OPEN c;
-- FETCH NEXT FROM c INTO @no_rm, @tgl, @biaya;
-- WHILE @@FETCH_STATUS = 0
-- BEGIN
--   IF @no_rm <> ISNULL(@prev_rm, '')
--     INSERT INTO #rekap VALUES (@no_rm, 0, 0, 0);
--   UPDATE #rekap
--   SET jumlah_kunjungan = jumlah_kunjungan + 1,
--       total_tagihan = total_tagihan + ISNULL(@biaya, 0),
--       kunjungan_ulang_30hari = kunjungan_ulang_30hari
--         + CASE WHEN @no_rm = @prev_rm AND DATEDIFF(DAY, @prev_tgl, @tgl) <= 30 THEN 1 ELSE 0 END
--   WHERE no_rm = @no_rm;
--   SELECT @prev_rm = @no_rm, @prev_tgl = @tgl;
--   FETCH NEXT FROM c INTO @no_rm, @tgl, @biaya;
-- END;
-- CLOSE c; DEALLOCATE c;
--
-- SELECT r.no_rm, p.nama, r.jumlah_kunjungan, r.kunjungan_ulang_30hari, r.total_tagihan
-- FROM #rekap r JOIN pasien p ON p.no_rm = r.no_rm
-- WHERE r.kunjungan_ulang_30hari >= 1
-- ORDER BY r.total_tagihan DESC;

`,
    xpReward: BOSS_XP[8],
    orderMatters: true,
    boss: { combines: ['t8-cursor', 't5-lag', 't4-cte', 't3-kategori-piutang', 't2-having'] },
  },
  /* ------------------------------------------------------------------ */
  /* Tier 9 – Desain Tabel & DDL                                         */
  /* ------------------------------------------------------------------ */
  {
    id: 'boss-t9-rawat-inap',
    kind: 'sql',
    tier: 9,
    order: 63,
    title: 'Boss: Modul Rawat Inap',
    concept: 'Boss Tier 9',
    story:
      'Status kunjungan "Dirawat" selama ini satu-satunya petunjuk bahwa pasien menginap — tidak ada catatan kamar, tanggal masuk, atau tanggal pulang. Direksi meminta modul rawat inap dibuat sekarang. Kamu yang merancang tabelnya, mengisi data awal untuk tiga pasien yang sedang/pernah dirawat, dan menyiapkan view untuk papan informasi perawat. Aturan bisnisnya harus dijaga database, karena modul ini akan dipakai banyak aplikasi.',
    task:
      "1. Tabel kamar: kode_kamar TEXT PRIMARY KEY; nama_ruang TEXT wajib; kelas TEXT wajib, hanya 'VIP', '1', '2', atau '3'; tarif_per_malam INTEGER wajib dan harus lebih dari 0.\n2. Tabel rawat_inap: id_rawat_inap INTEGER PRIMARY KEY; no_rawat TEXT wajib, merujuk ke kunjungan(no_rawat), dan satu kunjungan hanya boleh dirawat inap SEKALI; kode_kamar TEXT wajib, merujuk ke kamar(kode_kamar); tgl_masuk TEXT wajib; tgl_keluar TEXT boleh kosong (masih dirawat), tetapi bila diisi tidak boleh sebelum tgl_masuk.\n3. Data kamar: ('MLT-01', 'Melati', '1', 750000), ('MLT-02', 'Melati', '2', 450000), ('ANG-01', 'Anggrek', 'VIP', 1500000).\n4. Data rawat inap, berurutan: kunjungan 2026/10/03/000001 di ANG-01 masuk 2026-10-03 keluar 2026-10-08; kunjungan 2026/10/08/000001 di MLT-01 masuk 2026-10-08 (masih dirawat); kunjungan 2026/11/06/000001 di MLT-02 masuk 2026-11-06 (masih dirawat).\n5. View v_pasien_dirawat: pasien yang MASIH dirawat (tgl_keluar kosong) dengan kolom no_rawat, nama (nama pasien), nama_ruang, kelas, tgl_masuk.\nPenilai akan menjalankan INSERT/UPDATE/DELETE uji, lalu membaca view.",
    hint: [],
    solutionSql: `CREATE TABLE kamar (
  kode_kamar       TEXT    PRIMARY KEY,
  nama_ruang       TEXT    NOT NULL,
  kelas            TEXT    NOT NULL CHECK (kelas IN ('VIP', '1', '2', '3')),
  tarif_per_malam  INTEGER NOT NULL CHECK (tarif_per_malam > 0)
);

CREATE TABLE rawat_inap (
  id_rawat_inap  INTEGER PRIMARY KEY,
  no_rawat       TEXT    NOT NULL UNIQUE REFERENCES kunjungan (no_rawat),
  kode_kamar     TEXT    NOT NULL REFERENCES kamar (kode_kamar),
  tgl_masuk      TEXT    NOT NULL,
  tgl_keluar     TEXT,
  CHECK (tgl_keluar IS NULL OR tgl_keluar >= tgl_masuk)
);

INSERT INTO kamar (kode_kamar, nama_ruang, kelas, tarif_per_malam) VALUES
  ('MLT-01', 'Melati', '1', 750000),
  ('MLT-02', 'Melati', '2', 450000),
  ('ANG-01', 'Anggrek', 'VIP', 1500000);

INSERT INTO rawat_inap (no_rawat, kode_kamar, tgl_masuk, tgl_keluar) VALUES
  ('2026/10/03/000001', 'ANG-01', '2026-10-03', '2026-10-08'),
  ('2026/10/08/000001', 'MLT-01', '2026-10-08', NULL),
  ('2026/11/06/000001', 'MLT-02', '2026-11-06', NULL);

CREATE VIEW v_pasien_dirawat AS
SELECT
  r.no_rawat,
  p.nama,
  km.nama_ruang,
  km.kelas,
  r.tgl_masuk
FROM rawat_inap r
INNER JOIN kunjungan k ON k.no_rawat = r.no_rawat
INNER JOIN pasien p ON p.no_rm = k.no_rm
INNER JOIN kamar km ON km.kode_kamar = r.kode_kamar
WHERE r.tgl_keluar IS NULL;`,
    starterSql: '-- Boss Tier 9: tanpa hint. Rancang, isi, lalu sajikan. Uji aturanmu dulu di Free Playground.\n',
    xpReward: BOSS_XP[9],
    orderMatters: true,
    grading: {
      type: 'schema',
      objects: [
        { name: 'kamar', type: 'table' },
        { name: 'rawat_inap', type: 'table' },
        { name: 'v_pasien_dirawat', type: 'view' },
      ],
      probes: [
        { description: "Kamar kelas 'Presiden'", sql: "INSERT INTO kamar (kode_kamar, nama_ruang, kelas, tarif_per_malam) VALUES ('PRS-01', 'Presiden', 'Presiden', 5000000)" },
        { description: 'Kamar dengan tarif 0', sql: "INSERT INTO kamar (kode_kamar, nama_ruang, kelas, tarif_per_malam) VALUES ('MLT-03', 'Melati', '3', 0)" },
        { description: 'Kunjungan 2026/10/08/000001 dirawat inap untuk kedua kalinya', sql: "INSERT INTO rawat_inap (no_rawat, kode_kamar, tgl_masuk) VALUES ('2026/10/08/000001', 'MLT-02', '2026-10-09')" },
        { description: 'Kamar yang tidak ada (XXX-99)', sql: "INSERT INTO rawat_inap (no_rawat, kode_kamar, tgl_masuk) VALUES ('2026/11/02/000001', 'XXX-99', '2026-11-02')" },
        { description: 'Tanggal keluar sebelum tanggal masuk', sql: "INSERT INTO rawat_inap (no_rawat, kode_kamar, tgl_masuk, tgl_keluar) VALUES ('2026/11/02/000001', 'MLT-02', '2026-11-02', '2026-11-01')" },
        { description: 'Rawat inap singkat yang sah di ANG-01 (sudah pulang)', sql: "INSERT INTO rawat_inap (no_rawat, kode_kamar, tgl_masuk, tgl_keluar) VALUES ('2026/11/02/000001', 'ANG-01', '2026-11-02', '2026-11-04')" },
        { description: 'Kunjungan yang tidak ada', sql: "INSERT INTO rawat_inap (no_rawat, kode_kamar, tgl_masuk) VALUES ('2026/12/31/000009', 'MLT-01', '2026-12-31')" },
        { description: 'Menghapus kamar MLT-01 yang masih terisi', sql: "DELETE FROM kamar WHERE kode_kamar = 'MLT-01'" },
      ],
      verifySql: 'SELECT * FROM v_pasien_dirawat ORDER BY no_rawat;',
      label: 'Isi v_pasien_dirawat setelah uji',
    },
    requiredPatterns: [{ pattern: String.raw`CREATE\s+VIEW`, message: 'Papan informasi perawat harus membaca VIEW v_pasien_dirawat (CREATE VIEW … AS SELECT …).' }],
    boss: { combines: ['t9-create-table', 't9-fix-resep', 't9-view', 't9-normalisasi'] },
  },
  /* ------------------------------------------------------------------ */
  /* Tier 10 – Final Boss                                                */
  /* ------------------------------------------------------------------ */
  {
    id: 'boss-t10-diabetes',
    kind: 'sql',
    tier: 10,
    order: 72,
    title: 'Final Boss: Dashboard Pasien Diabetes',
    concept: 'Final Boss',
    story:
      'Program Pengelolaan Penyakit Kronis (Prolanis) meminta dashboard pasien diabetes untuk rapat bulanan 30 November 2026: siapa saja pasiennya, berapa umurnya, seberapa rajin kontrol, poli mana saja yang didatangi, dan apakah gula darah jangka panjangnya (HbA1c) terkendali. Nilai HbA1c tidak ada di tabel mana pun — hanya di payload JSON log SATUSEHAT.',
    task:
      "Untuk setiap pasien yang pernah didiagnosa kode ICD-10 'E11.9', tampilkan:\n• no_rm, nama\n• umur: umur dalam tahun penuh per tanggal 2026-11-30\n• jumlah_kunjungan: banyaknya kunjungan pasien itu yang statusnya BUKAN 'Batal'\n• hba1c_terakhir: valueQuantity.value dari Observation HbA1c (LOINC 4548-4 di code.coding[0].code, log yang statusnya bukan 'Gagal') dengan effectiveDateTime paling baru; NULL bila belum pernah diperiksa\n• tgl_hba1c: tanggal (YYYY-MM-DD) dari effectiveDateTime pemeriksaan itu\n• status_kontrol: 'Belum diperiksa' bila hba1c_terakhir NULL, 'Terkontrol' bila < 7, selain itu 'Belum terkontrol'\n• poli_dikunjungi: nama poli yang pernah dikunjungi (kunjungan bukan 'Batal'), tanpa duplikat, urut A–Z, dipisah ', '\nUrutkan berdasarkan no_rm.",
    hint: [],
    solutionSql: `WITH pasien_diabetes AS (
  SELECT DISTINCT k.no_rm
  FROM kunjungan k
  INNER JOIN diagnosa d ON d.no_rawat = k.no_rawat
  WHERE d.kode_icd10 = 'E11.9'
),
hba1c AS (
  SELECT
    k.no_rm,
    l.payload ->> '$.valueQuantity.value' AS nilai,
    date(l.payload ->> '$.effectiveDateTime') AS tgl,
    ROW_NUMBER() OVER (PARTITION BY k.no_rm ORDER BY l.payload ->> '$.effectiveDateTime' DESC) AS urutan
  FROM satusehat_log l
  INNER JOIN kunjungan k ON k.no_rawat = l.no_rawat
  WHERE l.payload ->> '$.code.coding[0].code' = '4548-4'
    AND l.status_kirim <> 'Gagal'
),
poli AS (
  SELECT no_rm, group_concat(nama_poli, ', ' ORDER BY nama_poli) AS daftar
  FROM (
    SELECT DISTINCT k.no_rm, pl.nama_poli
    FROM kunjungan k
    INNER JOIN poliklinik pl ON pl.id_poli = k.id_poli
    WHERE k.status <> 'Batal'
  )
  GROUP BY no_rm
)
SELECT
  p.no_rm,
  p.nama,
  2026 - CAST(strftime('%Y', p.tgl_lahir) AS INTEGER) - ('11-30' < strftime('%m-%d', p.tgl_lahir)) AS umur,
  (SELECT COUNT(*) FROM kunjungan k WHERE k.no_rm = p.no_rm AND k.status <> 'Batal') AS jumlah_kunjungan,
  h.nilai AS hba1c_terakhir,
  h.tgl AS tgl_hba1c,
  CASE
    WHEN h.nilai IS NULL THEN 'Belum diperiksa'
    WHEN h.nilai < 7 THEN 'Terkontrol'
    ELSE 'Belum terkontrol'
  END AS status_kontrol,
  po.daftar AS poli_dikunjungi
FROM pasien_diabetes pd
INNER JOIN pasien p ON p.no_rm = pd.no_rm
LEFT JOIN hba1c h ON h.no_rm = p.no_rm AND h.urutan = 1
LEFT JOIN poli po ON po.no_rm = p.no_rm
ORDER BY p.no_rm;`,
    starterSql: '-- Final Boss: tanpa hint. Pecah jadi beberapa CTE: pasien diabetes, HbA1c terakhir, daftar poli — lalu gabungkan.\n',
    xpReward: BOSS_XP[10],
    orderMatters: true,
    boss: { combines: ['t10-umur', 't10-group-concat', 't10-json-lab', 't5-row-number', 't4-cte'] },
  },
];
