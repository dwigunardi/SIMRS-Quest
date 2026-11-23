/**
 * Materi untuk konsep yang diperkenalkan di Tier 5 (window function).
 */
import type { Article } from '../../types';

export const ARTICLES_TIER5: Article[] = [
  {
    id: 'window-peringkat',
    title: 'Window Function: Nomor Urut & Peringkat',
    summary: 'ROW_NUMBER, RANK, dan DENSE_RANK memberi nomor/peringkat per kelompok TANPA meringkas baris — dasar pola "baris teratas per kelompok".',
    tier: 5,
    missions: ['t5-row-number', 't5-rank', 't5-predict-rank'],
    sections: [
      {
        heading: 'OVER: menghitung tanpa meringkas',
        body: `GROUP BY meringkas banyak baris menjadi satu baris per grup. **Window function** berbeda: setiap baris tetap ada, lalu diberi nilai tambahan yang dihitung dari "jendela" baris di sekitarnya. Penandanya kata kunci \`OVER (…)\`.

Di dalam \`OVER\` ada dua bagian yang sering dipakai:

- \`PARTITION BY kolom\`: membagi baris ke kelompok-kelompok. Penomoran **dimulai ulang** di setiap kelompok. Tanpa PARTITION BY, seluruh hasil dianggap satu kelompok.
- \`ORDER BY kolom\`: urutan baris di dalam kelompok — inilah yang menentukan siapa nomor 1. ORDER BY ini tidak sama dengan ORDER BY di akhir query (yang mengatur urutan tampilan).

\`ROW_NUMBER()\` memberi nomor 1, 2, 3, … di setiap kelompok.`,
        examples: [
          {
            title: 'Nomor urut dokter di setiap poli',
            sql: `SELECT
  id_poli,
  nama_dokter,
  ROW_NUMBER() OVER (PARTITION BY id_poli ORDER BY nama_dokter) AS no_urut
FROM dokter
ORDER BY id_poli, no_urut;`,
            note: 'Ke-10 dokter tetap tampil (tidak diringkas). Nomor dimulai lagi dari 1 setiap kali `id_poli` berganti: P01, P02, dan P05 punya dokter nomor 2.',
          },
        ],
      },
      {
        heading: 'ROW_NUMBER vs RANK vs DENSE_RANK',
        body: `Ketiganya hanya berbeda saat ada nilai **seri** (sama) pada kolom urutannya:

- \`ROW_NUMBER()\`: selalu nomor berbeda (1, 2, 3, 4). Untuk nilai seri, siapa yang duluan tidak dijamin — tambahkan kolom pemecah seri di ORDER BY agar hasilnya stabil.
- \`RANK()\`: nilai seri mendapat peringkat sama, lalu nomor berikutnya **melompat** sebanyak baris yang seri (1, 2, 2, 4) — seperti klasemen olahraga.
- \`DENSE_RANK()\`: nilai seri mendapat peringkat sama, nomor berikutnya **tidak melompat** (1, 2, 2, 3).

Window function dihitung setelah GROUP BY, jadi \`ORDER BY COUNT(*) DESC\` di dalam OVER boleh dipakai untuk memberi peringkat hasil agregasi.`,
        examples: [
          {
            title: 'Tiga fungsi peringkat berdampingan: poli tersibuk',
            sql: `SELECT
  p.nama_poli,
  COUNT(*) AS jumlah_kunjungan,
  ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, p.nama_poli) AS pakai_row_number,
  RANK()       OVER (ORDER BY COUNT(*) DESC) AS pakai_rank,
  DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS pakai_dense_rank
FROM kunjungan k
JOIN poliklinik p ON p.id_poli = k.id_poli
GROUP BY p.id_poli, p.nama_poli
ORDER BY jumlah_kunjungan DESC, p.nama_poli;`,
            note: 'Poli Jantung dan Poli Umum seri di puncak (7 kunjungan): RANK dan DENSE_RANK memberi keduanya 1, sedangkan ROW_NUMBER tetap 1 dan 2 (dipecah oleh nama poli). Sesudahnya RANK melompat ke 3 untuk Poli Penyakit Dalam, DENSE_RANK lanjut ke 2. Seri kedua: Poli Anak dan Poli Saraf (4 kunjungan).',
          },
          {
            title: 'Pola "baris teratas per kelompok": tagihan terbesar per status bayar',
            sql: `WITH berperingkat AS (
  SELECT
    no_rawat,
    status_bayar,
    total_biaya,
    ROW_NUMBER() OVER (PARTITION BY status_bayar ORDER BY total_biaya DESC) AS rn
  FROM billing
)
SELECT status_bayar, no_rawat, total_biaya
FROM berperingkat
WHERE rn = 1
ORDER BY status_bayar;`,
            note: 'Window function tidak boleh dipakai di WHERE pada query yang sama (ia baru dihitung di tahap SELECT). Karena itu nomor dihitung di CTE, lalu disaring `rn = 1` di query luar. Hasil: satu tagihan terbesar untuk "Belum Lunas" dan satu untuk "Lunas".',
          },
        ],
      },
    ],
    pitfalls: [
      'Menulis `WHERE ROW_NUMBER() OVER (…) = 1` atau `WHERE rn = 1` di query yang sama — window function dihitung setelah WHERE; bungkus dengan CTE/subquery.',
      'ROW_NUMBER tanpa pemecah seri di ORDER BY: baris yang seri bisa bertukar nomor setiap kali query dijalankan.',
      'Menaruh syarat penyaring di query luar padahal seharusnya sebelum penomoran (atau sebaliknya) — hasil "baris teratas" bisa berbeda total.',
      'Lupa PARTITION BY, sehingga semua kelompok diberi nomor dalam satu urutan panjang.',
    ],
    dialects: [
      {
        label: 'Ketersediaan ROW_NUMBER / RANK / DENSE_RANK',
        syntax: {
          sqlite: 'sejak 3.25 (2018)',
          sqlServer: 'sejak SQL Server 2005',
          mysql: 'sejak 8.0 (tidak ada di 5.7)',
          postgresql: 'sejak 8.4',
          oracle: 'sejak 8i (analytic function)',
        },
      },
      {
        label: 'Menyaring hasil window function',
        syntax: {
          sqlite: 'CTE/subquery lalu WHERE rn = 1',
          sqlServer: 'CTE/subquery lalu WHERE rn = 1',
          mysql: 'CTE/subquery lalu WHERE rn = 1',
          postgresql: 'CTE/subquery lalu WHERE rn = 1',
          oracle: 'CTE/subquery lalu WHERE rn = 1',
        },
        note: 'Klausa `QUALIFY` (menyaring window function langsung) hanya ada di DBMS lain seperti Snowflake, BigQuery, Teradata, dan DuckDB — tidak di kelima DBMS ini.',
      },
      {
        label: 'Klausa WINDOW bernama',
        syntax: {
          sqlite: 'WINDOW w AS (PARTITION BY …)',
          sqlServer: 'sejak SQL Server 2022',
          mysql: 'ada (8.0+)',
          postgresql: 'ada',
          oracle: 'sejak 21c',
        },
        note: 'Berguna bila beberapa kolom memakai definisi OVER yang sama: `… OVER w … WINDOW w AS (ORDER BY tgl)`.',
      },
    ],
  },
  {
    id: 'window-agregat',
    title: 'Window Function: SUM/AVG/COUNT OVER & Frame',
    summary: 'Fungsi agregat dengan OVER menghasilkan total berjalan, total per kelompok, persentase dari total, dan rata-rata bergerak — tanpa kehilangan baris detail.',
    tier: 5,
    missions: ['t5-running-total'],
    sections: [
      {
        heading: 'Total berjalan & persentase dari total',
        body: `Fungsi agregat biasa (\`SUM\`, \`AVG\`, \`COUNT\`, \`MIN\`, \`MAX\`) bisa dipakai sebagai window function dengan menambahkan \`OVER (…)\`:

- \`SUM(x) OVER ()\` — kurung kosong: total **seluruh** hasil, ditempel di setiap baris. Cocok untuk menghitung persentase dari total.
- \`SUM(x) OVER (PARTITION BY k)\` — total per kelompok, ditempel di setiap baris kelompok itu.
- \`SUM(x) OVER (ORDER BY t)\` — begitu ada ORDER BY, jumlahnya menjadi **berjalan**: dari baris pertama sampai baris saat ini.

Agregat window boleh membungkus agregat biasa, misalnya \`SUM(COUNT(*)) OVER ()\` = jumlah semua COUNT per grup.`,
        examples: [
          {
            title: 'Piutang berjalan (tagihan Belum Lunas)',
            sql: `SELECT
  id_billing,
  no_rawat,
  total_biaya,
  SUM(total_biaya) OVER (ORDER BY id_billing) AS piutang_berjalan
FROM billing
WHERE status_bayar = 'Belum Lunas'
ORDER BY id_billing;`,
            note: 'Setiap baris menambahkan tagihannya ke total sebelumnya: 12.500.000 → 31.250.000 → … → 36.975.000 di baris terakhir (= total semua piutang).',
          },
          {
            title: 'Persentase kunjungan per poli',
            sql: `SELECT
  p.nama_poli,
  COUNT(*) AS jumlah,
  SUM(COUNT(*)) OVER () AS total_semua,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS persen
FROM kunjungan k
JOIN poliklinik p ON p.id_poli = k.id_poli
GROUP BY p.id_poli, p.nama_poli
ORDER BY jumlah DESC, p.nama_poli;`,
            note: '`OVER ()` tanpa isi = seluruh 32 kunjungan. Poli Umum 7 dari 32 = 21,9%. Perhatikan `100.0` agar pembagiannya desimal.',
          },
        ],
      },
      {
        heading: 'Frame: ROWS vs RANGE (jebakan nilai seri)',
        body: `Baris mana saja yang ikut dihitung ditentukan oleh **frame**. Jika OVER punya ORDER BY tetapi frame tidak ditulis, defaultnya:

\`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`

Kata kuncinya **RANGE**: semua baris yang nilai ORDER BY-nya **sama** dengan baris saat ini dianggap "baris saat ini" juga. Akibatnya, baris-baris yang seri mendapat total yang sama — total berjalan "melompat".

Menulis \`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\` membuat frame dihitung per **baris fisik**, sehingga setiap baris bertambah satu per satu. Solusi lain: rekap dulu sampai nilai ORDER BY-nya unik, baru hitung total berjalannya.

Frame juga dipakai untuk **rata-rata bergerak**: \`AVG(x) OVER (ORDER BY t ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)\` = rata-rata baris ini dan dua baris sebelumnya.`,
        examples: [
          {
            title: 'RANGE default vs ROWS pada tanggal yang seri',
            sql: `SELECT
  no_rawat,
  tgl_kunjungan,
  COUNT(*) OVER (ORDER BY tgl_kunjungan) AS default_range,
  COUNT(*) OVER (
    ORDER BY tgl_kunjungan, no_rawat
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS frame_rows
FROM kunjungan
WHERE tgl_kunjungan <= '2026-10-06'
ORDER BY tgl_kunjungan, no_rawat;`,
            note: 'Ada dua kunjungan pada 1 Oktober dan dua pada 3 Oktober. Di kolom `default_range`, kedua baris tanggal itu langsung bernilai 2 dan 5; di kolom `frame_rows` angkanya naik satu per satu (1, 2, 3, 4, 5, 6, 7).',
          },
          {
            title: 'Rata-rata bergerak 3 tagihan',
            sql: `SELECT
  id_billing,
  total_biaya,
  ROUND(AVG(total_biaya) OVER (
    ORDER BY id_billing
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  )) AS rata_3_terakhir
FROM billing
WHERE id_billing <= 6
ORDER BY id_billing;`,
            note: 'Dua baris pertama belum punya dua pendahulu, jadi rata-ratanya dari 1 dan 2 baris saja. Tagihan 12.500.000 (id 4) membuat rata-rata melonjak dan tetap tinggi selama ia masih di dalam jendela 3 baris.',
          },
        ],
      },
    ],
    pitfalls: [
      'Lupa ORDER BY di dalam OVER: `SUM(x) OVER ()` memberi total keseluruhan di setiap baris, bukan total berjalan.',
      'Mengandalkan frame default (RANGE) saat nilai ORDER BY bisa seri — total berjalan melompat untuk baris-baris yang seri.',
      'Menulis ORDER BY hanya di akhir query dan mengira itu mengatur urutan perhitungan window — urutan window diatur oleh ORDER BY di dalam OVER.',
      'Pembagian `COUNT(*) / SUM(COUNT(*)) OVER ()` tanpa `100.0` atau CAST menghasilkan 0 karena pembagian bilangan bulat.',
    ],
    dialects: [
      {
        label: 'Total berjalan',
        syntax: {
          sqlite: 'SUM(x) OVER (ORDER BY t) — sejak 3.25',
          sqlServer: 'SUM(x) OVER (ORDER BY t) — sejak 2012',
          mysql: 'SUM(x) OVER (ORDER BY t) — sejak 8.0',
          postgresql: 'SUM(x) OVER (ORDER BY t)',
          oracle: 'SUM(x) OVER (ORDER BY t)',
        },
        note: 'SQL Server 2005–2008 R2 hanya mengizinkan PARTITION BY pada agregat OVER (tanpa ORDER BY), sehingga total berjalan belum bisa ditulis begini.',
      },
      {
        label: 'Frame default bila OVER berisi ORDER BY',
        syntax: {
          sqlite: 'RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW',
          sqlServer: 'RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW',
          mysql: 'RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW',
          postgresql: 'RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW',
          oracle: 'RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW',
        },
        note: 'Sama di semua DBMS (aturan standar SQL) — jebakan nilai seri berlaku di mana-mana. Tulis ROWS secara eksplisit bila perlu.',
      },
      {
        label: 'Frame RANGE dengan jarak nilai (mis. "7 hari terakhir")',
        syntax: {
          sqlite: 'RANGE BETWEEN 6 PRECEDING AND CURRENT ROW (angka, sejak 3.28)',
          sqlServer: 'tidak ada: RANGE hanya UNBOUNDED / CURRENT ROW',
          mysql: "RANGE BETWEEN INTERVAL 6 DAY PRECEDING AND CURRENT ROW",
          postgresql: "RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW (sejak 11)",
          oracle: "RANGE BETWEEN INTERVAL '6' DAY PRECEDING AND CURRENT ROW",
        },
        note: 'Di SQLite tanggal disimpan sebagai teks, jadi urutkan dengan angka, mis. `ORDER BY julianday(tgl)`.',
      },
    ],
  },
  {
    id: 'lag-lead',
    title: 'LAG, LEAD, FIRST_VALUE & LAST_VALUE',
    summary: 'Mengambil nilai dari baris sebelumnya, sesudahnya, pertama, atau terakhir di dalam kelompok — tanpa self-join — misalnya untuk menghitung jeda antar-kejadian.',
    tier: 5,
    missions: ['t5-lag'],
    sections: [
      {
        heading: 'LAG dan LEAD',
        body: `- \`LAG(kolom)\` mengambil nilai kolom dari baris **sebelumnya** (menurut ORDER BY di dalam OVER).
- \`LEAD(kolom)\` mengambil nilai dari baris **sesudahnya**.
- Bentuk lengkapnya \`LAG(kolom, jarak, nilai_default)\`: \`jarak\` = berapa baris ke belakang (default 1), \`nilai_default\` = pengganti bila baris itu tidak ada (default NULL).

Baris pertama tidak punya baris sebelumnya, jadi \`LAG\` menghasilkan NULL (atau nilai default). Dengan \`PARTITION BY\`, "sebelumnya" hanya dicari di kelompok yang sama.

Selisih dua tanggal teks di SQLite dihitung dengan \`julianday(baru) - julianday(lama)\` (hasilnya jumlah hari).`,
        examples: [
          {
            title: 'Jeda hari antar-kunjungan di Poli Jantung',
            sql: `SELECT
  tgl_kunjungan,
  no_rm,
  LAG(tgl_kunjungan) OVER (ORDER BY tgl_kunjungan) AS kunjungan_sebelumnya,
  julianday(tgl_kunjungan)
    - julianday(LAG(tgl_kunjungan) OVER (ORDER BY tgl_kunjungan)) AS jeda_hari
FROM kunjungan
WHERE id_poli = 'P05'
ORDER BY tgl_kunjungan;`,
            note: 'Kunjungan pertama (3 Oktober) tidak punya pendahulu, jadi kolomnya NULL. Jeda terpanjang 15 hari: dari 18 Oktober ke 2 November.',
          },
          {
            title: 'Nilai default & LEAD: tagihan sebelum/sesudahnya',
            sql: `SELECT
  id_billing,
  total_biaya,
  LAG(total_biaya, 1, 0) OVER (ORDER BY id_billing) AS tagihan_sebelumnya,
  LEAD(total_biaya) OVER (ORDER BY id_billing) AS tagihan_berikutnya
FROM billing
WHERE status_bayar = 'Belum Lunas'
ORDER BY id_billing;`,
            note: 'Baris pertama mendapat 0 (bukan NULL) karena nilai default `LAG(…, 1, 0)`. LEAD tanpa default memberi NULL di baris terakhir.',
          },
        ],
      },
      {
        heading: 'FIRST_VALUE, LAST_VALUE, dan jebakan frame',
        body: `\`FIRST_VALUE(kolom)\` dan \`LAST_VALUE(kolom)\` mengambil nilai baris pertama/terakhir **di dalam frame**.

Jebakannya ada pada frame default saat OVER memakai ORDER BY: frame berhenti di **baris saat ini beserta baris lain yang nilai ORDER BY-nya sama** (RANGE … CURRENT ROW). Jadi \`LAST_VALUE\` dengan frame default mengembalikan nilai baris itu sendiri — atau baris seri terakhirnya bila ada nilai kembar — bukan baris terakhir kelompok.

Agar benar-benar mendapat baris terakhir, perluas frame-nya: \`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING\`. Alternatif yang sering lebih sederhana: \`FIRST_VALUE\` dengan ORDER BY dibalik (DESC).`,
        examples: [
          {
            title: 'LAST_VALUE dengan frame default vs frame penuh',
            sql: `SELECT
  id_poli,
  nama_dokter,
  FIRST_VALUE(nama_dokter) OVER (PARTITION BY id_poli ORDER BY nama_dokter) AS pertama,
  LAST_VALUE(nama_dokter) OVER (PARTITION BY id_poli ORDER BY nama_dokter) AS last_default,
  LAST_VALUE(nama_dokter) OVER (
    PARTITION BY id_poli ORDER BY nama_dokter
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS last_frame_penuh
FROM dokter
WHERE id_poli IN ('P01', 'P02', 'P05')
ORDER BY id_poli, nama_dokter;`,
            note: 'Kolom `last_default` selalu sama dengan `nama_dokter` di baris itu (frame berhenti di baris saat ini; di sini tidak ada nama dokter yang kembar, jadi tidak ada baris seri). Hanya `last_frame_penuh` yang benar menunjukkan dokter terakhir (abjad) di setiap poli.',
          },
        ],
      },
    ],
    pitfalls: [
      'Lupa PARTITION BY, sehingga LAG mengambil baris milik kelompok lain (mis. pasien atau poli lain) sebagai "sebelumnya".',
      'Menyaring baris di query luar setelah LAG dihitung, padahal baris yang dibuang itu ikut dianggap sebagai "baris sebelumnya" — saring sebelum window dihitung bila memang tidak boleh dihitung.',
      'Memakai LAST_VALUE dengan frame default dan heran hasilnya sama dengan baris itu sendiri.',
      "Mengurangkan dua tanggal teks langsung (`tgl_b - tgl_a`) di SQLite — teks diubah jadi angka tahunnya saja, jadi `'2026-11-02' - '2026-10-18'` = 0; pakai julianday().",
    ],
    dialects: [
      {
        label: 'LAG / LEAD',
        syntax: {
          sqlite: 'LAG(x, 1, 0) OVER (…) — sejak 3.25',
          sqlServer: 'LAG(x, 1, 0) OVER (…) — sejak 2012',
          mysql: 'LAG(x, 1, 0) OVER (…) — sejak 8.0',
          postgresql: 'LAG(x, 1, 0) OVER (…)',
          oracle: 'LAG(x, 1, 0) OVER (…)',
        },
      },
      {
        label: 'Selisih hari antara dua tanggal',
        syntax: {
          sqlite: 'julianday(b) - julianday(a)',
          sqlServer: 'DATEDIFF(day, a, b)',
          mysql: 'DATEDIFF(b, a)',
          postgresql: 'b - a  (DATE − DATE = integer hari)',
          oracle: 'b - a  (DATE − DATE = jumlah hari, bisa pecahan)',
        },
        note: 'Perhatikan urutan argumen DATEDIFF yang berbeda antara SQL Server (satuan, awal, akhir) dan MySQL (akhir, awal).',
      },
      {
        label: 'IGNORE NULLS (lewati NULL saat mencari nilai)',
        syntax: {
          sqlite: 'tidak ada',
          sqlServer: 'sejak SQL Server 2022',
          mysql: 'tidak didukung',
          postgresql: 'tidak ada (setidaknya hingga PostgreSQL 18)',
          oracle: 'LAG(x IGNORE NULLS) / LAST_VALUE(x IGNORE NULLS)',
        },
      },
    ],
  },
];
