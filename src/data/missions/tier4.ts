/**
 * Tier 4 – CTE, JOIN Lanjutan & Rekursif (order 26–32, 175 XP per misi; boss di order 33).
 * Misi 'sql' dinilai dengan 'result' + requiredPatterns (kecuali misi Perbaiki Query t4-fix-not-in),
 * sehingga hasil yang benar tetap harus ditulis memakai konstruksi yang sedang dilatih.
 */
import type { RequiredPattern, SqlMission, TierInfo } from '../../types';

export const TIER4: TierInfo = {
  tier: 4,
  name: 'CTE, JOIN Lanjutan & Rekursif',
  description:
    'Laporan bertingkat yang mudah dibaca dengan CTE, perbandingan antarperiode dengan FULL OUTER JOIN, matriks lengkap dengan CROSS JOIN, serta penelusuran hierarki dan deret tanggal dengan WITH RECURSIVE.',
};

const XP = 175;

const MIN_PATTERN: RequiredPattern = {
  pattern: '\\bMIN\\s*\\(',
  message: 'Misi ini melatih fungsi agregat MIN(). Ambil nilai terkecil dengan MIN(kolom), bukan dengan ORDER BY ... LIMIT 1.',
};

const MAX_PATTERN: RequiredPattern = {
  pattern: '\\bMAX\\s*\\(',
  message: 'Misi ini melatih fungsi agregat MAX(). Ambil nilai terbesar dengan MAX(kolom), bukan dengan ORDER BY ... DESC LIMIT 1.',
};

const WITH_PATTERN: RequiredPattern = {
  pattern: '\\bWITH\\b',
  message:
    'Misi ini melatih CTE: pindahkan subquery rekap ke blok WITH nama_cte AS (...) lalu baca dari nama_cte di query utama.',
};

const FULL_JOIN_PATTERN: RequiredPattern = {
  pattern: '\\bFULL\\s+(OUTER\\s+)?JOIN\\b',
  message:
    'Misi ini melatih FULL OUTER JOIN: gabungkan rekap Oktober dan rekap November dengan FULL OUTER JOIN agar poli yang hanya ada di salah satu bulan tetap muncul.',
};

const CROSS_JOIN_PATTERN: RequiredPattern = {
  pattern: '\\bCROSS\\s+JOIN\\b',
  message:
    'Tulis perkalian kombinasinya secara eksplisit dengan CROSS JOIN (bukan koma di FROM) agar maksud query jelas bagi pembaca berikutnya.',
};

const RECURSIVE_PATTERN: RequiredPattern = {
  pattern: '\\bWITH\\s+RECURSIVE\\b',
  message:
    'Misi ini wajib memakai WITH RECURSIVE. Catatan: SQLite memang mengizinkan CTE rekursif tanpa kata RECURSIVE, tetapi standar SQL dan PostgreSQL/MySQL mewajibkannya, jadi biasakan menulis WITH RECURSIVE.',
};

export const MISSIONS_TIER4: SqlMission[] = [
  {
    id: 't4-min-max',
    kind: 'sql',
    tier: 4,
    order: 26,
    title: 'Rentang Layanan per Poliklinik',
    concept: 'MIN & MAX',
    story:
      'Komite Mutu sedang mengevaluasi setiap poliklinik: kapan pasien pertama dan terakhir tercatat dalam periode data, dan berapa rentang nilai tagihannya (termurah sampai termahal). Rentang tarif yang terlalu lebar bisa menandakan salah input tarif atau tindakan mahal yang perlu ditinjau. MIN dan MAX adalah fungsi agregat: keduanya bekerja untuk angka maupun teks (tanggal berformat YYYY-MM-DD terurut benar sebagai teks) dan mengabaikan nilai NULL.',
    task:
      "Untuk setiap poliklinik, tampilkan kolom nama_poli, kunjungan_pertama (tgl_kunjungan paling awal), kunjungan_terakhir (tgl_kunjungan paling akhir), tagihan_terkecil (total_biaya terkecil), dan tagihan_terbesar (total_biaya terbesar). Tanggal dihitung dari SEMUA kunjungan poli itu (termasuk yang berstatus 'Batal'); tagihan diambil dari tabel billing (kunjungan tanpa tagihan diabaikan). Urutkan berdasarkan nama_poli dari A ke Z.",
    hint: [
      'MIN() dan MAX() adalah fungsi agregat seperti SUM(): pakai bersama GROUP BY agar dihitung per poliklinik.',
      'Hubungkan kunjungan → poliklinik (id_poli), lalu LEFT JOIN billing (no_rawat). Kunjungan tanpa tagihan menghasilkan b.total_biaya = NULL, dan MIN/MAX otomatis mengabaikan NULL.',
      'Kerangka: SELECT pl.nama_poli, MIN(k.tgl_kunjungan) AS kunjungan_pertama, ... GROUP BY pl.id_poli, pl.nama_poli ORDER BY pl.nama_poli;',
    ],
    solutionSql: `SELECT
  pl.nama_poli,
  MIN(k.tgl_kunjungan) AS kunjungan_pertama,
  MAX(k.tgl_kunjungan) AS kunjungan_terakhir,
  MIN(b.total_biaya)   AS tagihan_terkecil,
  MAX(b.total_biaya)   AS tagihan_terbesar
FROM kunjungan k
INNER JOIN poliklinik pl ON k.id_poli = pl.id_poli
LEFT JOIN billing b ON k.no_rawat = b.no_rawat
GROUP BY pl.id_poli, pl.nama_poli
ORDER BY pl.nama_poli ASC;`,
    xpReward: XP,
    orderMatters: true,
    starterSql:
      '-- Rentang tanggal kunjungan & nilai tagihan per poliklinik\nSELECT\n  pl.nama_poli,\n  \nFROM kunjungan k\nINNER JOIN poliklinik pl ON k.id_poli = pl.id_poli\n',
    requiredPatterns: [MIN_PATTERN, MAX_PATTERN],
  },
  {
    id: 't4-cte',
    kind: 'sql',
    tier: 4,
    order: 27,
    title: 'Kontribusi Pendapatan per Poli',
    concept: 'CTE (WITH)',
    story:
      'Direktur Keuangan bertanya: poli mana yang menyumbang lebih dari 2% pendapatan rumah sakit? Laporan ini butuh dua langkah: rekap per poli dulu, baru dibandingkan dengan total seluruh poli. Kalau ditulis dengan subquery bertumpuk, query cepat sulit dibaca dan rekap yang sama harus ditulis dua kali. CTE (Common Table Expression) memberi nama pada langkah pertama, sehingga query utama tinggal membaca "tabel sementara" itu, bahkan berkali-kali, seperti menyusun laporan langkah demi langkah.',
    task:
      "Gunakan CTE (WITH nama_cte AS (...)). Langkah 1 (di dalam CTE): rekap per poliklinik dari tabel billing yang di-JOIN ke kunjungan, berisi jumlah_tagihan (banyaknya baris tagihan) dan total_pendapatan (SUM total_biaya, baik 'Lunas' maupun 'Belum Lunas'). Langkah 2 (query utama): hitung kontribusi_persen = total_pendapatan poli ÷ total pendapatan SELURUH poli × 100, dibulatkan 2 angka desimal dengan ROUND(..., 2). Tampilkan kolom nama_poli, jumlah_tagihan, total_pendapatan, dan kontribusi_persen hanya untuk poli dengan kontribusi_persen LEBIH DARI 2. Urutkan berdasarkan total_pendapatan dari yang terbesar.",
    hint: [
      'Bentuk umum CTE: WITH rekap AS (SELECT ... GROUP BY ...) SELECT ... FROM rekap ...; Di dalam CTE, JOIN billing ke kunjungan lalu GROUP BY k.id_poli.',
      'Total seluruh poli bisa dibaca ulang dari CTE yang sama: (SELECT SUM(total_pendapatan) FROM rekap). Bisa juga membuat CTE kedua: WITH rekap AS (...), total_rs AS (SELECT SUM(...) AS total FROM rekap).',
      'Awas pembagian bilangan bulat! 100 * a / b pada dua INTEGER hasilnya dibulatkan ke bawah. Pakai 100.0 agar hasilnya desimal, lalu ROUND(..., 2). Karena alias belum bisa dipakai di WHERE pada level yang sama, ulangi ekspresinya di WHERE atau bungkus lagi dengan CTE.',
    ],
    solutionSql: `WITH rekap_poli AS (
  SELECT
    k.id_poli,
    COUNT(*)           AS jumlah_tagihan,
    SUM(b.total_biaya) AS total_pendapatan
  FROM billing b
  INNER JOIN kunjungan k ON b.no_rawat = k.no_rawat
  GROUP BY k.id_poli
),
total_rs AS (
  SELECT SUM(total_pendapatan) AS total FROM rekap_poli
)
SELECT
  pl.nama_poli,
  r.jumlah_tagihan,
  r.total_pendapatan,
  ROUND(100.0 * r.total_pendapatan / t.total, 2) AS kontribusi_persen
FROM rekap_poli r
INNER JOIN poliklinik pl ON r.id_poli = pl.id_poli
CROSS JOIN total_rs t
WHERE 100.0 * r.total_pendapatan / t.total > 2
ORDER BY r.total_pendapatan DESC;`,
    xpReward: XP,
    orderMatters: true,
    starterSql:
      '-- Langkah 1: rekap per poli di dalam CTE\nWITH rekap_poli AS (\n  SELECT\n    k.id_poli,\n    \n  FROM billing b\n  INNER JOIN kunjungan k ON b.no_rawat = k.no_rawat\n  GROUP BY k.id_poli\n)\n-- Langkah 2: hitung kontribusi & saring di query utama\nSELECT\n  \nFROM rekap_poli r\n',
    requiredPatterns: [WITH_PATTERN],
  },
  {
    id: 't4-full-outer-join',
    kind: 'sql',
    tier: 4,
    order: 28,
    title: 'Perbandingan Kunjungan Oktober vs November',
    concept: 'FULL OUTER JOIN',
    story:
      'Tim Analis Data menyimpan rekap kunjungan bulanan sebagai dua hasil terpisah dan diminta membandingkannya. Masalahnya, Poli Kandungan hanya punya kunjungan di Oktober (dokternya cuti di November), sedangkan Poli Gigi baru mulai melayani di November. INNER JOIN akan membuang keduanya dan LEFT JOIN membuang salah satunya. FULL OUTER JOIN (didukung SQLite sejak versi 3.39) mempertahankan baris dari KEDUA sisi; sisi yang tidak punya pasangan bernilai NULL.',
    task:
      "Buat dua rekap jumlah kunjungan per id_poli, keduanya TANPA kunjungan berstatus 'Batal': rekap Oktober 2026 (tgl_kunjungan '2026-10-01' s.d. '2026-10-31') dan rekap November 2026 ('2026-11-01' s.d. '2026-11-30'). Gabungkan kedua rekap dengan FULL OUTER JOIN pada id_poli, lalu ambil nama poli dari tabel poliklinik. Tampilkan kolom nama_poli, kunjungan_oktober, kunjungan_november, dan selisih (kunjungan_november dikurangi kunjungan_oktober). Jika poli tidak punya kunjungan di suatu bulan, tampilkan 0, bukan NULL (gunakan COALESCE). Urutkan berdasarkan nama_poli dari A ke Z.",
    hint: [
      'Siapkan dua rekap (CTE atau subquery), misalnya okt dan nov, masing-masing: SELECT id_poli, COUNT(*) AS jumlah FROM kunjungan WHERE status <> \'Batal\' AND tgl_kunjungan BETWEEN ... GROUP BY id_poli.',
      'FROM okt FULL OUTER JOIN nov ON okt.id_poli = nov.id_poli. Pada baris yang hanya ada di satu sisi, id_poli sisi lainnya NULL, jadi JOIN ke poliklinik memakai COALESCE(okt.id_poli, nov.id_poli).',
      'Ubah NULL menjadi 0 dengan COALESCE(okt.jumlah, 0) sebelum dipakai di kolom maupun di selisih, karena angka dikurangi NULL hasilnya NULL.',
    ],
    solutionSql: `WITH okt AS (
  SELECT id_poli, COUNT(*) AS jumlah
  FROM kunjungan
  WHERE status <> 'Batal'
    AND tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31'
  GROUP BY id_poli
),
nov AS (
  SELECT id_poli, COUNT(*) AS jumlah
  FROM kunjungan
  WHERE status <> 'Batal'
    AND tgl_kunjungan BETWEEN '2026-11-01' AND '2026-11-30'
  GROUP BY id_poli
)
SELECT
  pl.nama_poli,
  COALESCE(okt.jumlah, 0) AS kunjungan_oktober,
  COALESCE(nov.jumlah, 0) AS kunjungan_november,
  COALESCE(nov.jumlah, 0) - COALESCE(okt.jumlah, 0) AS selisih
FROM okt
FULL OUTER JOIN nov ON okt.id_poli = nov.id_poli
INNER JOIN poliklinik pl ON pl.id_poli = COALESCE(okt.id_poli, nov.id_poli)
ORDER BY pl.nama_poli ASC;`,
    xpReward: XP,
    orderMatters: true,
    starterSql:
      "-- Rekap Oktober & November, lalu gabungkan dengan FULL OUTER JOIN\nWITH okt AS (\n  SELECT id_poli, COUNT(*) AS jumlah\n  FROM kunjungan\n  WHERE status <> 'Batal'\n    AND tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31'\n  GROUP BY id_poli\n),\nnov AS (\n  -- lengkapi rekap November\n)\nSELECT\n  \nFROM okt\n",
    requiredPatterns: [FULL_JOIN_PATTERN],
  },
  {
    id: 't4-cross-join',
    kind: 'sql',
    tier: 4,
    order: 29,
    title: 'Matriks Poli × Status Kunjungan',
    concept: 'CROSS JOIN',
    story:
      'Dashboard manajemen menampilkan heatmap jumlah kunjungan per poliklinik dan status. Jika query hanya mengelompokkan tabel kunjungan, kombinasi yang jumlahnya nol (mis. poli yang tidak punya pasien Dirawat) tidak muncul sama sekali, dan sel heatmap jadi bolong. Solusinya: buat dulu SEMUA kombinasi dengan CROSS JOIN (setiap baris kiri dipasangkan dengan setiap baris kanan), baru tempelkan datanya dengan LEFT JOIN.',
    task:
      "Buat matriks SEMUA kombinasi poliklinik × status kunjungan ('Batal', 'Dirawat', 'Selesai'). Tampilkan kolom nama_poli, status, dan jumlah_kunjungan (banyaknya kunjungan poli tersebut dengan status itu; 0 jika tidak ada). Hasilnya harus tepat 7 × 3 = 21 baris. Urutkan berdasarkan nama_poli dari A ke Z, lalu status dari A ke Z.",
    hint: [
      "Daftar status bisa diambil dari (SELECT DISTINCT status FROM kunjungan) atau dibuat sendiri dengan CTE: WITH daftar_status(status) AS (VALUES ('Batal'), ('Dirawat'), ('Selesai')).",
      'FROM poliklinik pl CROSS JOIN daftar_status s menghasilkan 21 pasangan. Lalu LEFT JOIN kunjungan k dengan DUA syarat di ON: poli yang sama DAN status yang sama.',
      'Hitung dengan COUNT(k.no_rawat), bukan COUNT(*): COUNT(*) menghitung baris hasil LEFT JOIN yang kosong sebagai 1, padahal seharusnya 0. Jangan lupa GROUP BY pl.id_poli, pl.nama_poli, s.status.',
    ],
    solutionSql: `WITH daftar_status(status) AS (
  VALUES ('Batal'), ('Dirawat'), ('Selesai')
)
SELECT
  pl.nama_poli,
  s.status,
  COUNT(k.no_rawat) AS jumlah_kunjungan
FROM poliklinik pl
CROSS JOIN daftar_status s
LEFT JOIN kunjungan k
  ON k.id_poli = pl.id_poli
 AND k.status = s.status
GROUP BY pl.id_poli, pl.nama_poli, s.status
ORDER BY pl.nama_poli ASC, s.status ASC;`,
    xpReward: XP,
    orderMatters: true,
    starterSql:
      "-- Semua kombinasi poli × status, termasuk yang jumlahnya 0\nWITH daftar_status(status) AS (\n  VALUES ('Batal'), ('Dirawat'), ('Selesai')\n)\nSELECT\n  pl.nama_poli,\n  s.status,\n  \nFROM poliklinik pl\n",
    requiredPatterns: [CROSS_JOIN_PATTERN],
  },
  {
    id: 't4-recursive-org',
    kind: 'sql',
    tier: 4,
    order: 30,
    title: 'Bagan Organisasi Rumah Sakit',
    concept: 'WITH RECURSIVE (hierarki)',
    story:
      'Bagian SDM ingin menampilkan bagan organisasi di SIMRS. Tabel struktur_organisasi hanya menyimpan atasan langsung (id_atasan), sedangkan kedalaman hierarkinya bisa berubah sewaktu-waktu. Self-join biasa hanya menjangkau satu tingkat per JOIN, jadi kamu harus menebak berapa tingkat yang ada. Recursive CTE menyelesaikannya: mulai dari pucuk pimpinan (anchor), lalu berulang kali mencari bawahan dari baris yang baru ditemukan sampai tidak ada lagi.',
    task:
      "Dengan WITH RECURSIVE, telusuri tabel struktur_organisasi mulai dari pucuk pimpinan (id_atasan IS NULL, yaitu Direktur Utama) ke bawah. Tampilkan kolom id_jabatan, nama_jabatan, level, dan jalur. level: Direktur Utama = 1, bawahan langsungnya = 2, dan seterusnya. jalur: rangkaian nama_jabatan dari Direktur Utama sampai jabatan tersebut, dipisahkan ' > ' (spasi, tanda >, spasi), misalnya 'Direktur Utama > Wakil Direktur Pelayanan Medis'; untuk Direktur Utama sendiri jalur = 'Direktur Utama'. Urutkan berdasarkan jalur dari A ke Z, sehingga setiap atasan langsung diikuti bawahannya seperti bagan organisasi.",
    hint: [
      'Recursive CTE terdiri dari dua bagian yang digabung UNION ALL: anchor (baris awal) dan bagian rekursif yang JOIN ke CTE itu sendiri. Kerangka: WITH RECURSIVE hirarki AS (anchor UNION ALL rekursif) SELECT ... FROM hirarki;',
      'Di bagian rekursif, JOIN struktur_organisasi s ke CTE hirarki h dengan syarat bawahan menunjuk atasannya: s.id_atasan = h.id_jabatan (bukan sebaliknya; kalau terbalik kamu malah berjalan ke atas).',
      "Untuk baris bawahan: level = level atasannya + 1, dan jalur = jalur atasan disambung ' > ' lalu nama_jabatan bawahan (operator || di SQLite). Rekursi berhenti sendiri saat tidak ada bawahan lagi.",
    ],
    solutionSql: `WITH RECURSIVE hirarki AS (
  SELECT
    id_jabatan,
    nama_jabatan,
    1 AS level,
    nama_jabatan AS jalur
  FROM struktur_organisasi
  WHERE id_atasan IS NULL

  UNION ALL

  SELECT
    s.id_jabatan,
    s.nama_jabatan,
    h.level + 1,
    h.jalur || ' > ' || s.nama_jabatan
  FROM struktur_organisasi s
  INNER JOIN hirarki h ON s.id_atasan = h.id_jabatan
)
SELECT
  id_jabatan,
  nama_jabatan,
  level,
  jalur
FROM hirarki
ORDER BY jalur ASC;`,
    xpReward: XP,
    orderMatters: true,
    starterSql:
      '-- Telusuri hierarki dari Direktur Utama ke bawah\nWITH RECURSIVE hirarki AS (\n  -- anchor: pucuk pimpinan\n  SELECT id_jabatan, nama_jabatan, 1 AS level, nama_jabatan AS jalur\n  FROM struktur_organisasi\n  WHERE id_atasan IS NULL\n\n  UNION ALL\n\n  -- bagian rekursif: cari bawahan dari baris yang sudah ditemukan\n  \n)\nSELECT id_jabatan, nama_jabatan, level, jalur\nFROM hirarki\n',
    requiredPatterns: [RECURSIVE_PATTERN],
  },
  {
    id: 't4-recursive-dates',
    kind: 'sql',
    tier: 4,
    order: 31,
    title: 'Kalender Kunjungan Tanpa Bolong',
    concept: 'WITH RECURSIVE (deret tanggal)',
    story:
      "Kepala Instalasi Rawat Jalan ingin grafik kunjungan harian 1–15 Oktober 2026. Jika hanya GROUP BY tgl_kunjungan, hari tanpa kunjungan (misalnya hari Minggu) hilang dari hasil sehingga grafik terlihat menipu. Database tidak punya tabel kalender, tapi recursive CTE bisa membuatnya: mulai dari satu tanggal, lalu tambah 1 hari berulang-ulang sampai tanggal akhir. Kunjungan 'Batal' tidak dihitung karena pasien tidak benar-benar dilayani.",
    task:
      "Dengan WITH RECURSIVE, buat deret tanggal dari '2026-10-01' sampai '2026-10-15' (kedua tanggal termasuk, 15 baris). Untuk setiap tanggal, tampilkan kolom tanggal dan jumlah_kunjungan: banyaknya kunjungan pada tanggal itu yang statusnya BUKAN 'Batal'. Tanggal tanpa kunjungan tetap tampil dengan jumlah_kunjungan 0. Urutkan berdasarkan tanggal dari yang paling awal.",
    hint: [
      "Bagian rekursif membaca CTE kalender itu sendiri dan menambah satu hari dengan date(tanggal, '+1 day'). Beri syarat berhenti di WHERE agar deret selesai tepat di '2026-10-15'. Pikirkan: < atau <=? Hitung barisnya, harus 15.",
      'Tempelkan kunjungan dengan LEFT JOIN kunjungan k ON k.tgl_kunjungan = kalender.tanggal, lalu GROUP BY tanggal dan hitung COUNT(k.no_rawat), bukan COUNT(*).',
      "Syarat status <> 'Batal' harus diletakkan di ON, bukan di WHERE. Jika di WHERE, baris hasil LEFT JOIN yang kosong (k.status = NULL) ikut terbuang dan tanggal dengan 0 kunjungan hilang lagi.",
    ],
    solutionSql: `WITH RECURSIVE kalender(tanggal) AS (
  SELECT '2026-10-01'
  UNION ALL
  SELECT date(tanggal, '+1 day')
  FROM kalender
  WHERE tanggal < '2026-10-15'
)
SELECT
  c.tanggal,
  COUNT(k.no_rawat) AS jumlah_kunjungan
FROM kalender c
LEFT JOIN kunjungan k
  ON k.tgl_kunjungan = c.tanggal
 AND k.status <> 'Batal'
GROUP BY c.tanggal
ORDER BY c.tanggal ASC;`,
    xpReward: XP,
    orderMatters: true,
    starterSql:
      "-- Deret tanggal 1–15 Oktober 2026 + jumlah kunjungan per hari\nWITH RECURSIVE kalender(tanggal) AS (\n  SELECT '2026-10-01'\n  UNION ALL\n  -- tambah 1 hari sampai '2026-10-15'\n  \n)\nSELECT\n  c.tanggal,\n  \nFROM kalender c\n",
    requiredPatterns: [RECURSIVE_PATTERN],
  },
  {
    id: 't4-fix-not-in',
    kind: 'sql',
    tier: 4,
    order: 32,
    title: 'Jebakan NULL di NOT IN',
    concept: 'Debug: NOT IN + NULL',
    story:
      'Bagian SDM ingin daftar jabatan "ujung" di bagan organisasi, yaitu jabatan yang tidak membawahi siapa pun, untuk program pelatihan staf pelaksana. Query rekanmu terlihat logis, tetapi hasilnya selalu kosong.',
    task:
      'Perbaiki query di editor (mengandung 1 bug). Hasil yang diminta: kolom id_jabatan dan nama_jabatan dari tabel struktur_organisasi untuk setiap jabatan yang TIDAK menjadi atasan jabatan mana pun (id_jabatan-nya tidak pernah muncul di kolom id_atasan). Urutan baris bebas.',
    hint: [
      'Lihat isi kolom id_atasan: Direktur Utama tidak punya atasan, jadi id_atasan-nya NULL. Subquery di dalam NOT IN ikut mengembalikan NULL itu.',
      "x NOT IN (a, b, NULL) berarti x <> a AND x <> b AND x <> NULL. Perbandingan dengan NULL hasilnya UNKNOWN (bukan TRUE), sehingga seluruh syarat tidak pernah TRUE dan semua baris terbuang.",
      'Buang NULL di subquery (WHERE id_atasan IS NOT NULL), atau ganti dengan NOT EXISTS (SELECT 1 FROM struktur_organisasi b WHERE b.id_atasan = s.id_jabatan), yang kebal terhadap NULL.',
    ],
    solutionSql: `SELECT
  s.id_jabatan,
  s.nama_jabatan
FROM struktur_organisasi s
WHERE NOT EXISTS (
  SELECT 1
  FROM struktur_organisasi b
  WHERE b.id_atasan = s.id_jabatan
);`,
    xpReward: XP,
    orderMatters: false,
    starterSql: `-- Query dari rekan: jabatan yang tidak membawahi siapa pun (hasilnya selalu kosong)
SELECT
  id_jabatan,
  nama_jabatan
FROM struktur_organisasi
WHERE id_jabatan NOT IN (
  SELECT id_atasan
  FROM struktur_organisasi
);`,
    fix: { bugCount: 1 },
  },
];
