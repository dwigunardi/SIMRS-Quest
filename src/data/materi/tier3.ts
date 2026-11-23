/**
 * Materi untuk konsep yang diperkenalkan di Tier 3.
 */
import type { Article } from '../../types';

export const ARTICLES_TIER3: Article[] = [
  {
    id: 'case-when',
    title: 'CASE WHEN: Logika If-Else di SQL',
    summary: 'CASE WHEN memberi label atau nilai berbeda per baris berdasarkan syarat, dan bisa dipakai di dalam SUM/COUNT untuk menghitung bersyarat.',
    tier: 3,
    missions: ['t3-kategori-piutang'],
    sections: [
      {
        heading: 'Bentuk dasar & urutan cabang',
        body: `\`CASE\` adalah "if-else" milik SQL. Ia menghasilkan SATU nilai untuk setiap baris:

\`CASE WHEN syarat1 THEN nilai1 WHEN syarat2 THEN nilai2 ELSE nilai_lain END\`

Aturan pentingnya:

- Cabang \`WHEN\` diperiksa **dari atas ke bawah**, dan **cabang pertama yang TRUE menang**. Cabang di bawahnya tidak diperiksa lagi.
- Kalau tidak ada cabang yang cocok dan tidak ada \`ELSE\`, hasilnya **NULL**.
- Karena berurutan, cabang yang lebih sempit harus ditulis lebih dulu. Cabang di bawahnya otomatis hanya berlaku untuk baris yang lolos dari cabang sebelumnya.
- Perhatikan batas: \`>\` dan \`>=\` berbeda tepat di nilai batasnya. Tentukan dulu nilai batas masuk kelompok mana, lalu pilih operatornya.

Tanggal di database ini disimpan sebagai teks ISO (\`YYYY-MM-DD\`), sehingga bisa dibandingkan langsung dengan \`>\` atau \`<\`.`,
        examples: [
          {
            title: 'Kelompok usia pasien (per 30 November 2026)',
            sql: `SELECT
  nama,
  tgl_lahir,
  CASE
    WHEN tgl_lahir > '2008-11-30' THEN 'Anak'
    WHEN tgl_lahir > '1966-11-30' THEN 'Dewasa'
    ELSE 'Lansia'
  END AS kelompok_usia
FROM pasien
ORDER BY tgl_lahir;`,
            note: "Cabang kedua tidak perlu menulis `tgl_lahir <= '2008-11-30'`: baris anak sudah \"diambil\" cabang pertama. Hasilnya 3 lansia, 15 dewasa, 2 anak.",
          },
          {
            title: 'Urutan WHEN yang keliru',
            sql: `SELECT
  nama,
  tgl_lahir,
  CASE
    WHEN tgl_lahir > '1966-11-30' THEN 'Dewasa'
    WHEN tgl_lahir > '2008-11-30' THEN 'Anak'
    ELSE 'Lansia'
  END AS kelompok_usia
FROM pasien
ORDER BY tgl_lahir;`,
            note: 'Cabang yang lebih luas ditulis duluan, sehingga Muhammad Alif dan Aisyah Zahra (lahir 2018 & 2020) ikut berlabel **Dewasa**. Cabang `Anak` tidak pernah tercapai.',
          },
        ],
      },
      {
        heading: 'CASE di dalam agregat: menghitung bersyarat',
        body: `CASE bisa ditaruh di dalam \`SUM\` untuk menghitung baris yang memenuhi syarat tertentu, sambil tetap memakai satu GROUP BY:

\`SUM(CASE WHEN syarat THEN 1 ELSE 0 END)\`

Setiap baris menyumbang 1 bila syaratnya terpenuhi dan 0 bila tidak. Hasilnya beberapa "kolom hitungan" berdampingan dalam satu query, tanpa perlu query terpisah per kategori.`,
        examples: [
          {
            title: 'Komposisi penjamin per kota dalam satu tabel',
            sql: `SELECT
  kota,
  COUNT(*) AS jumlah_pasien,
  SUM(CASE WHEN penjamin = 'BPJS' THEN 1 ELSE 0 END) AS pasien_bpjs,
  SUM(CASE WHEN penjamin <> 'BPJS' THEN 1 ELSE 0 END) AS non_bpjs
FROM pasien
GROUP BY kota
ORDER BY kota;`,
            note: 'Di setiap baris, `pasien_bpjs + non_bpjs = jumlah_pasien`. Contoh: Jakarta punya 6 pasien, 4 di antaranya BPJS.',
          },
        ],
      },
    ],
    pitfalls: [
      'Menulis cabang yang lebih luas di atas cabang yang lebih sempit, sehingga cabang sempit tidak pernah tercapai.',
      'Lupa ELSE: baris yang tidak cocok dengan cabang mana pun mendapat NULL, bukan label "lainnya".',
      'Salah memilih `>` atau `>=` di nilai batas. Baca lagi aturan soal: apakah nilai batas termasuk kelompok bawah atau atas?',
      'Mencampur tipe hasil antar cabang (mis. angka di satu cabang, teks di cabang lain) — DBMS lain bisa menolaknya.',
    ],
    dialects: [
      {
        label: 'CASE WHEN … END',
        syntax: {
          sqlite: 'CASE WHEN … THEN … ELSE … END',
          sqlServer: 'CASE WHEN … THEN … ELSE … END',
          mysql: 'CASE WHEN … THEN … ELSE … END',
          postgresql: 'CASE WHEN … THEN … ELSE … END',
          oracle: 'CASE WHEN … THEN … ELSE … END',
        },
        note: 'Bagian dari standar SQL, sama persis di semua DBMS. Pakai ini bila ingin portabel.',
      },
      {
        label: 'If-else ringkas',
        syntax: {
          sqlite: "IIF(x > 0, 'ya', 'tidak')",
          sqlServer: "IIF(x > 0, 'ya', 'tidak')",
          mysql: "IF(x > 0, 'ya', 'tidak')",
          postgresql: 'tidak ada — pakai CASE',
          oracle: "DECODE(jk, 'L', 'Laki-laki', 'Perempuan')",
        },
        note: 'IIF ada di SQLite 3.32+ dan SQL Server 2012+. DECODE di Oracle hanya untuk perbandingan kesamaan (=).',
      },
      {
        label: 'Hitung bersyarat',
        syntax: {
          sqlite: "COUNT(*) FILTER (WHERE penjamin = 'BPJS')",
          sqlServer: "SUM(CASE WHEN penjamin = 'BPJS' THEN 1 ELSE 0 END)",
          mysql: "SUM(penjamin = 'BPJS')",
          postgresql: "COUNT(*) FILTER (WHERE penjamin = 'BPJS')",
          oracle: "SUM(CASE WHEN penjamin = 'BPJS' THEN 1 ELSE 0 END)",
        },
        note: 'Pola SUM(CASE …) berjalan di semua DBMS. FILTER didukung SQLite 3.30+ dan PostgreSQL; MySQL & SQLite juga menganggap perbandingan bernilai 1/0.',
      },
    ],
  },
  {
    id: 'subquery',
    title: 'Subquery: Query di Dalam Query',
    summary: 'Subquery menghitung sesuatu lebih dulu (rata-rata, daftar id, ada/tidaknya baris terkait) lalu hasilnya dipakai oleh query luar.',
    tier: 3,
    missions: ['t3-subquery-tagihan', 't4-fix-not-in'],
    sections: [
      {
        heading: 'Subquery skalar: satu nilai',
        body: `Subquery adalah SELECT yang ditulis di dalam tanda kurung di dalam query lain. Bentuk paling sederhana adalah **subquery skalar**: hasilnya tepat satu baris dan satu kolom, sehingga bisa dipakai seperti angka biasa.

\`WHERE total_biaya < (SELECT AVG(total_biaya) FROM billing)\`

Subquery ini tidak bergantung pada query luar, jadi cukup dihitung sekali. Cara membacanya dari dalam ke luar: hitung dulu rata-rata seluruh tagihan, lalu bandingkan setiap baris dengan angka itu.

Subquery skalar **harus** menghasilkan paling banyak satu baris. DBMS lain langsung error bila hasilnya lebih dari satu baris, sedangkan SQLite diam-diam mengambil baris pertama — kesalahan yang mudah lolos tanpa disadari.`,
        examples: [
          {
            title: 'Tagihan belum lunas yang nilainya di bawah rata-rata',
            sql: `SELECT no_rawat, total_biaya, status_bayar
FROM billing
WHERE status_bayar = 'Belum Lunas'
  AND total_biaya < (SELECT AVG(total_biaya) FROM billing)
ORDER BY total_biaya;`,
            note: 'Rata-rata seluruh tagihan ≈ 1.928.393, jadi hanya 2 tagihan belum lunas yang berada di bawahnya. Tagihan besar (12,5 juta, 18,75 juta, 5 juta) ikut menarik rata-rata ke atas.',
          },
        ],
      },
      {
        heading: 'IN, EXISTS, dan NOT EXISTS',
        body: `Subquery juga bisa mengembalikan **daftar** nilai:

- \`kolom IN (SELECT …)\`: baris lolos jika nilainya ada di daftar hasil subquery.
- \`EXISTS (SELECT 1 FROM … WHERE …)\`: baris lolos jika subquery menemukan **minimal satu** baris. Nilai yang di-SELECT tidak penting, karena itu lazim ditulis \`SELECT 1\`.
- \`NOT EXISTS (…)\`: kebalikannya — lolos jika subquery **tidak** menemukan baris apa pun.

Subquery di dalam EXISTS biasanya **berkorelasi**: ia merujuk kolom query luar (mis. \`k.id_dokter = d.id_dokter\`), sehingga dijalankan ulang untuk setiap baris luar. Bacanya seperti kalimat: "tampilkan dokter yang TIDAK ADA kunjungan batal yang ditanganinya".`,
        examples: [
          {
            title: 'IN: poliklinik yang punya pasien sedang dirawat',
            sql: `SELECT nama_poli, gedung
FROM poliklinik
WHERE id_poli IN (
  SELECT id_poli
  FROM kunjungan
  WHERE status = 'Dirawat'
)
ORDER BY nama_poli;`,
            note: 'Ada 3 kunjungan berstatus Dirawat (2 di Poli Jantung, 1 di Poli Saraf), tetapi setiap poli hanya muncul sekali — IN hanya memeriksa keanggotaan, tidak menggandakan baris.',
          },
          {
            title: 'NOT EXISTS: dokter yang tidak pernah punya kunjungan batal',
            sql: `SELECT d.nama_dokter, d.spesialisasi
FROM dokter d
WHERE NOT EXISTS (
  SELECT 1
  FROM kunjungan k
  WHERE k.id_dokter = d.id_dokter
    AND k.status = 'Batal'
)
ORDER BY d.nama_dokter;`,
            note: 'Dari 10 dokter, 7 lolos. Tiga dokter (dr. Sari Wulandari, dr. Hendra Gunawan, dan dr. Fitri Handayani) punya minimal satu kunjungan Batal, sehingga subquery-nya menemukan baris dan mereka terbuang.',
          },
        ],
      },
      {
        heading: 'Jebakan NOT IN + NULL',
        body: `\`x NOT IN (a, b, c)\` sebenarnya berarti \`x <> a AND x <> b AND x <> c\`. Jika salah satu nilai di daftar itu **NULL**, perbandingan \`x <> NULL\` menghasilkan UNKNOWN (bukan TRUE). Akibatnya seluruh syarat tidak pernah TRUE, dan **semua baris terbuang** — query berjalan tanpa error, tetapi hasilnya kosong.

Coba di Playground: \`SELECT nama_poli FROM poliklinik WHERE id_poli NOT IN ('P01', NULL);\` tidak menghasilkan satu baris pun, padahal jelas ada poli selain P01.

Bahaya terbesarnya ketika daftar itu berasal dari subquery atas kolom yang **boleh NULL**: cukup satu baris NULL di subquery untuk mengosongkan hasil. Dua cara aman:

- Pastikan subquery tidak mengembalikan NULL (saring dengan \`IS NOT NULL\`).
- Gunakan \`NOT EXISTS\`, yang hanya bertanya "ada baris yang cocok atau tidak" sehingga kebal terhadap NULL.

\`IN\` (tanpa NOT) tidak terkena masalah ini: nilai NULL di daftar hanya tidak pernah cocok.`,
      },
    ],
    pitfalls: [
      'Memakai NOT IN pada subquery yang kolomnya bisa NULL — hasilnya diam-diam kosong.',
      'Subquery skalar yang ternyata mengembalikan lebih dari satu baris: SQLite mengambil baris pertama tanpa peringatan, DBMS lain error.',
      'Lupa korelasi di EXISTS (tidak menulis `k.id_dokter = d.id_dokter`), sehingga subquery selalu menemukan baris dan semua baris luar lolos (atau terbuang semua untuk NOT EXISTS).',
      'Membandingkan dengan subquery yang menghasilkan beberapa kolom, mis. `WHERE x = (SELECT a, b FROM …)`.',
    ],
    dialects: [
      {
        label: 'Subquery skalar menghasilkan > 1 baris',
        syntax: {
          sqlite: 'tidak error — baris pertama dipakai',
          sqlServer: 'error: Subquery returned more than 1 value',
          mysql: 'error: Subquery returns more than 1 row',
          postgresql: 'error: more than one row returned by a subquery',
          oracle: 'ORA-01427: single-row subquery returns more than one row',
        },
      },
      {
        label: 'Alias untuk subquery di FROM',
        syntax: {
          sqlite: 'FROM (SELECT …) t   -- alias opsional',
          sqlServer: 'FROM (SELECT …) AS t   -- wajib',
          mysql: 'FROM (SELECT …) AS t   -- wajib',
          postgresql: 'FROM (SELECT …) AS t   -- wajib sebelum v16',
          oracle: 'FROM (SELECT …) t   -- tanpa kata AS',
        },
        note: 'Selalu beri alias agar query bisa dipindah ke DBMS mana pun. Oracle tidak menerima kata AS untuk alias tabel.',
      },
      {
        label: 'x NOT IN (…, NULL)',
        syntax: {
          sqlite: 'UNKNOWN → baris terbuang',
          sqlServer: 'UNKNOWN → baris terbuang',
          mysql: 'UNKNOWN → baris terbuang',
          postgresql: 'UNKNOWN → baris terbuang',
          oracle: 'UNKNOWN → baris terbuang',
        },
        note: "Perilaku standar SQL, sama di semua DBMS. Di Oracle, string kosong '' juga dianggap NULL, jadi jebakan ini lebih mudah terjadi.",
      },
    ],
  },
  {
    id: 'angka-pembagian',
    title: 'Angka, Pembagian & Persentase',
    summary: 'Bilangan bulat dibagi bilangan bulat menghasilkan bilangan bulat di SQLite — pahami ini sebelum menghitung rasio, rata-rata manual, atau persentase.',
    tier: 3,
    missions: ['t3-fix-persen'],
    sections: [
      {
        heading: 'Pembagian bilangan bulat',
        body: `SQLite (juga SQL Server dan PostgreSQL) memperlakukan \`7 / 2\` sebagai pembagian **bilangan bulat**: hasilnya \`3\`, bukan \`3.5\`. Bagian pecahannya dibuang (dibulatkan ke arah nol), bukan dibulatkan ke terdekat.

Hasil \`COUNT(*)\`, \`SUM\` atas kolom INTEGER, dan literal tanpa titik desimal semuanya bilangan bulat. Jadi rasio seperti \`jumlah_sebagian / jumlah_total\` hampir selalu menghasilkan 0 (atau 1) jika kedua operan bulat.

Agar hasilnya desimal, salah satu operan harus desimal **sebelum** pembagian terjadi:

- Kalikan dengan literal desimal: \`x * 1.0 / y\` atau \`100.0 * x / y\`
- Atau ubah tipenya: \`CAST(x AS REAL) / y\`

Urutan operasi penting. \`a / b * 100\` membagi dulu (hasil bulat, pecahan sudah hilang), baru mengalikan. Mengalikan dengan 100 setelahnya tidak bisa mengembalikan pecahan yang sudah terbuang.`,
        examples: [
          {
            title: 'Bulat vs desimal dalam satu baris',
            sql: `SELECT
  7 / 2 AS bagi_bulat,
  7 / 2.0 AS bagi_desimal,
  CAST(7 AS REAL) / 2 AS pakai_cast,
  ROUND(10 / 3, 1) AS bulatkan_hasil_bulat,
  ROUND(10 / 3.0, 1) AS bulatkan_hasil_desimal;`,
            note: '`ROUND(10 / 3, 1)` tetap 3: pembagian bulat terjadi lebih dulu, jadi ROUND tidak punya pecahan untuk dibulatkan. `ROUND(10 / 3.0, 1)` memberi 3.3.',
          },
        ],
      },
      {
        heading: 'Persentase & pembulatan',
        body: `Pola umum persentase: **bagian × 100 ÷ keseluruhan**, dengan memastikan perhitungannya desimal, lalu dibulatkan dengan \`ROUND(nilai, jumlah_desimal)\`.

- \`ROUND(x, 1)\` → satu angka di belakang koma, \`ROUND(x)\` → bilangan bulat terdekat.
- Bulatkan di **akhir**, setelah semua perkalian/pembagian. Membulatkan di tengah perhitungan menumpuk galat.
- Penyebut bisa berasal dari subquery skalar, mis. total pasien \`(SELECT COUNT(*) FROM pasien)\`.
- Waspadai pembagian dengan nol: di SQLite hasilnya NULL, di beberapa DBMS lain error. \`NULLIF(penyebut, 0)\` mengubah penyebut 0 menjadi NULL agar aman.`,
        examples: [
          {
            title: 'Persentase pasien per penjamin: versi keliru vs benar',
            sql: `SELECT
  penjamin,
  COUNT(*) AS jumlah_pasien,
  COUNT(*) / (SELECT COUNT(*) FROM pasien) * 100 AS persen_keliru,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM pasien), 1) AS persen
FROM pasien
GROUP BY penjamin
ORDER BY jumlah_pasien DESC, penjamin;`,
            note: '12 dari 20 pasien adalah BPJS. `persen_keliru` = 12 / 20 → 0 (bulat), × 100 tetap 0. Versi `persen` dimulai dengan 100.0 sehingga seluruh perhitungannya desimal: 60, 20, 20.',
          },
        ],
      },
    ],
    pitfalls: [
      'Membagi COUNT dengan COUNT lalu mendapat 0 — kedua operan bilangan bulat.',
      'Menaruh `* 100.0` SETELAH pembagian: pecahan sudah hilang sebelum dikalikan.',
      'Membulatkan terlalu awal, atau mengira ROUND bisa memulihkan pecahan yang sudah terbuang.',
      'Lupa menangani penyebut 0 saat memindahkan query ke DBMS yang melempar error untuk pembagian dengan nol.',
    ],
    dialects: [
      {
        label: '7 / 2',
        syntax: {
          sqlite: '3',
          sqlServer: '3',
          mysql: '3.5000   (7 DIV 2 = 3)',
          postgresql: '3',
          oracle: '3.5',
        },
        note: 'MySQL dan Oracle memberi desimal untuk operator /. Pakai pola desimal eksplisit (100.0 * x / y) agar hasilnya sama di mana pun.',
      },
      {
        label: 'Ubah ke desimal',
        syntax: {
          sqlite: 'CAST(x AS REAL)',
          sqlServer: 'CAST(x AS DECIMAL(10,2))',
          mysql: 'CAST(x AS DECIMAL(10,2))',
          postgresql: 'x::numeric  /  CAST(x AS NUMERIC)',
          oracle: 'CAST(x AS NUMBER(10,2))',
        },
        note: 'Mengalikan dengan 1.0 juga berhasil di semua DBMS di atas.',
      },
      {
        label: 'Pembulatan',
        syntax: {
          sqlite: 'ROUND(x, 1)',
          sqlServer: 'ROUND(x, 1)',
          mysql: 'ROUND(x, 1)',
          postgresql: 'ROUND(x::numeric, 1)',
          oracle: 'ROUND(x, 1)',
        },
        note: 'SQL Server mempertahankan tipe input (hasil DECIMAL tetap menampilkan nol di belakang). PostgreSQL hanya menerima ROUND(x, n) untuk tipe numeric.',
      },
      {
        label: 'Pembagian dengan nol',
        syntax: {
          sqlite: 'NULL',
          sqlServer: 'error: Divide by zero error encountered',
          mysql: 'NULL (+ warning)',
          postgresql: 'error: division by zero',
          oracle: 'ORA-01476: divisor is equal to zero',
        },
        note: 'x / NULLIF(y, 0) menghasilkan NULL alih-alih error di semua DBMS.',
      },
    ],
  },
  {
    id: 'join-fan-out',
    title: 'JOIN yang Menggandakan Baris (Fan-out)',
    summary: 'JOIN ke tabel "satu-ke-banyak" membuat baris di sisi "satu" muncul berulang, sehingga SUM dan COUNT ikut terhitung berkali-kali.',
    tier: 3,
    missions: ['t3-fix-fan-out'],
    sections: [
      {
        heading: 'Dari mana duplikasi datang',
        body: `Satu kunjungan bisa punya **beberapa** diagnosa (Primer dan Sekunder). Ketika \`billing\` di-JOIN ke \`diagnosa\`, setiap baris tagihan dipasangkan dengan SETIAP diagnosa kunjungannya. Kunjungan dengan 2 diagnosa → tagihannya muncul 2 kali.

Ini bukan bug JOIN; memang begitulah JOIN bekerja. Masalahnya baru muncul ketika hasil JOIN itu dijumlahkan: \`SUM(total_biaya)\` dan \`COUNT(*)\` menghitung setiap salinan, sehingga angkanya **membengkak** tanpa ada error apa pun. Gejala khasnya: total yang lebih besar dari jumlah data aslinya.

Pertanyaan yang selalu perlu diajukan sebelum agregasi: **"satu baris hasil JOIN ini mewakili apa?"** Kalau jawabannya "satu pasangan tagihan–diagnosa", bukan "satu tagihan", maka SUM atas tagihan pasti salah.`,
        examples: [
          {
            title: 'Tagihan muncul berulang setelah JOIN ke diagnosa',
            sql: `SELECT b.no_rawat, b.total_biaya, d.kode_icd10
FROM billing b
INNER JOIN diagnosa d ON d.no_rawat = b.no_rawat
WHERE b.no_rawat LIKE '2026/10/0%'
ORDER BY b.no_rawat, d.kode_icd10;`,
            note: '9 kunjungan bertagihan berubah menjadi 13 baris. Jika `total_biaya` di sini dijumlahkan, hasilnya 65.720.000, padahal total tagihan asli kesembilan kunjungan itu hanya 33.500.000.',
          },
        ],
      },
      {
        heading: 'Strategi menghindarinya',
        body: `- **Agregasi dulu, baru JOIN.** Ringkas tabel "banyak" per kunci (mis. jumlah diagnosa per no_rawat) di subquery/CTE, sehingga hasilnya tinggal satu baris per kunjungan, lalu JOIN-kan.
- **Pakai EXISTS / IN untuk menyaring.** Kalau tabel "banyak" hanya dipakai sebagai syarat ("kunjungan yang punya diagnosa X"), jangan di-JOIN. \`EXISTS\` hanya bertanya ada/tidak, sehingga tidak pernah menggandakan baris.
- **COUNT(DISTINCT kunci)** aman untuk menghitung entitas unik (mis. \`COUNT(DISTINCT no_rawat)\`), karena kunci memang unik per entitas.
- **Jangan menambal dengan SUM(DISTINCT nilai).** SUM(DISTINCT) membuang **nilai** yang kembar, bukan baris yang kembar. Dua tagihan berbeda yang kebetulan nominalnya sama ikut dilebur jadi satu. Angkanya bisa "kebetulan benar" di data uji, lalu salah di data produksi.`,
        examples: [
          {
            title: 'Agregasi dulu lewat CTE: satu baris per kunjungan',
            sql: `WITH dx AS (
  SELECT no_rawat, COUNT(*) AS jumlah_diagnosa
  FROM diagnosa
  GROUP BY no_rawat
)
SELECT b.no_rawat, b.total_biaya, dx.jumlah_diagnosa
FROM billing b
INNER JOIN dx ON dx.no_rawat = b.no_rawat
WHERE dx.jumlah_diagnosa > 1
ORDER BY b.no_rawat;`,
            note: 'CTE `dx` sudah satu baris per kunjungan, jadi setiap tagihan muncul tepat sekali walaupun kunjungannya punya 2 diagnosa. Ada 7 kunjungan seperti itu.',
          },
          {
            title: 'Mengapa SUM(DISTINCT) bukan solusi',
            sql: `WITH tagihan (no_rawat, biaya) AS (
  VALUES ('A-001', 150000), ('A-002', 150000), ('A-003', 275000)
)
SELECT
  SUM(biaya) AS sum_biasa,
  SUM(DISTINCT biaya) AS sum_distinct,
  COUNT(*) AS jumlah_tagihan
FROM tagihan;`,
            note: 'Tiga tagihan berbeda, total sebenarnya 575.000. SUM(DISTINCT) memberi 425.000 karena dua tagihan bernilai 150.000 dianggap satu.',
          },
        ],
      },
    ],
    pitfalls: [
      'Menjumlahkan kolom tabel "satu" setelah JOIN ke tabel "banyak" — total membengkak tanpa error.',
      'Memakai JOIN hanya untuk menyaring ("yang punya diagnosa X"), padahal EXISTS lebih aman.',
      'Menambal angka yang membengkak dengan SUM(DISTINCT), yang ikut melebur nilai kembar yang sah.',
      'Tidak mengecek hasil dengan angka pembanding (mis. total tagihan langsung dari tabel billing).',
    ],
    dialects: [
      {
        label: 'Agregasi dulu lewat CTE',
        syntax: {
          sqlite: 'WITH dx AS (SELECT …) SELECT …',
          sqlServer: 'WITH dx AS (SELECT …) SELECT …',
          mysql: 'WITH dx AS (SELECT …) SELECT …',
          postgresql: 'WITH dx AS (SELECT …) SELECT …',
          oracle: 'WITH dx AS (SELECT …) SELECT …',
        },
        note: 'CTE tersedia di SQLite 3.8.3+, SQL Server 2005+, MySQL 8.0+, PostgreSQL, dan Oracle 9i+. Di MySQL 5.7 gunakan subquery di FROM.',
      },
      {
        label: 'Menyaring tanpa menggandakan',
        syntax: {
          sqlite: 'WHERE EXISTS (SELECT 1 FROM … WHERE …)',
          sqlServer: 'WHERE EXISTS (SELECT 1 FROM … WHERE …)',
          mysql: 'WHERE EXISTS (SELECT 1 FROM … WHERE …)',
          postgresql: 'WHERE EXISTS (SELECT 1 FROM … WHERE …)',
          oracle: 'WHERE EXISTS (SELECT 1 FROM … WHERE …)',
        },
        note: 'EXISTS adalah standar SQL dan dioptimalkan sebagai semi-join di semua DBMS besar.',
      },
      {
        label: 'Hitung entitas unik',
        syntax: {
          sqlite: 'COUNT(DISTINCT no_rawat)',
          sqlServer: 'COUNT(DISTINCT no_rawat)',
          mysql: 'COUNT(DISTINCT no_rawat)',
          postgresql: 'COUNT(DISTINCT no_rawat)',
          oracle: 'COUNT(DISTINCT no_rawat)',
        },
      },
    ],
  },
];
