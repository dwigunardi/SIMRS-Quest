/**
 * Materi untuk konsep yang diperkenalkan di Tier 2: JOIN, LEFT JOIN, agregasi, GROUP BY, HAVING.
 * Contoh sengaja memakai tabel/filter yang berbeda dari soal misi agar tidak membocorkan jawaban.
 */
import type { Article } from '../../types';

export const ARTICLES_TIER2: Article[] = [
  {
    id: 'inner-join',
    title: 'INNER JOIN: Menggabungkan Tabel',
    summary: 'JOIN menyambungkan baris dari dua tabel lewat kolom kunci (mis. no_rm), sehingga kode bisa diganti nama yang mudah dibaca.',
    tier: 2,
    missions: ['t2-inner-join', 't3-bpjs-per-poli'],
    sections: [
      {
        heading: 'Kenapa perlu JOIN?',
        body: `Data rumah sakit sengaja dipecah ke beberapa tabel: \`kunjungan\` hanya menyimpan kode \`no_rm\`, \`id_poli\`, dan \`id_dokter\`, sedangkan nama pasien ada di \`pasien\` dan nama dokter ada di \`dokter\`. **JOIN** menyambungkan baris-baris itu kembali berdasarkan kolom yang nilainya sama.

Bentuk dasarnya:

- \`FROM kunjungan k JOIN pasien p ON k.no_rm = p.no_rm\`
- \`k\` dan \`p\` adalah **alias tabel**: nama pendek agar query ringkas
- \`ON\` berisi syarat pasangan: baris kunjungan dipasangkan dengan baris pasien yang \`no_rm\`-nya sama

\`JOIN\` dan \`INNER JOIN\` artinya sama. Baris yang **tidak punya pasangan** di tabel lain **hilang** dari hasil. Contoh: ada 32 kunjungan tetapi hanya 28 tagihan, jadi \`kunjungan JOIN billing\` menghasilkan 28 baris — empat kunjungan yang batal tidak punya tagihan dan ikut terbuang.`,
        examples: [
          {
            title: 'Pasien dengan diagnosa diabetes (3 tabel)',
            sql: `SELECT p.nama, k.tgl_kunjungan, d.nama_penyakit
FROM diagnosa d
JOIN kunjungan k ON k.no_rawat = d.no_rawat
JOIN pasien p ON p.no_rm = k.no_rm
WHERE d.kode_icd10 = 'E11.9'
ORDER BY k.tgl_kunjungan;`,
            note: 'Rantai relasinya: diagnosa → kunjungan (no_rawat) → pasien (no_rm). Ahmad Fauzi muncul dua kali karena punya dua kunjungan dengan diagnosa itu.',
          },
        ],
      },
      {
        heading: 'Kolom ambigu & rentang tanggal',
        body: `Jika nama kolom ada di dua tabel (mis. \`no_rm\` di \`kunjungan\` dan \`pasien\`), tulis **dengan alias**: \`k.no_rm\`. Tanpa alias SQLite menolak dengan pesan \`ambiguous column name\`. Kebiasaan baik: selalu awali kolom dengan alias begitu query memakai lebih dari satu tabel.

Di database ini tanggal disimpan sebagai **teks berformat** \`YYYY-MM-DD\`. Format ini bisa dibandingkan langsung karena urutan teksnya sama dengan urutan waktunya:

- \`tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-07'\` — kedua ujung ikut (inklusif)
- \`tgl_kunjungan >= '2026-10-01' AND tgl_kunjungan < '2026-10-08'\` — bentuk "setengah terbuka" yang aman juga untuk kolom yang menyimpan jam`,
        examples: [
          {
            title: 'Kunjungan minggu pertama Oktober beserta dokternya',
            sql: `SELECT k.no_rawat, k.tgl_kunjungan, dr.nama_dokter
FROM kunjungan k
JOIN dokter dr ON dr.id_dokter = k.id_dokter
WHERE k.tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-07'
ORDER BY k.tgl_kunjungan, k.no_rawat;`,
            note: '8 kunjungan, termasuk yang tepat tanggal 7 Oktober — BETWEEN mengikutkan kedua batas.',
          },
        ],
      },
    ],
    pitfalls: [
      'Lupa syarat `ON` (atau salah kolom, mis. `k.no_rm = p.nik`): hasilnya kosong atau malah setiap baris dipasangkan dengan semua baris.',
      'Menulis `no_rm` tanpa alias saat dua tabel sama-sama punya kolom itu → error `ambiguous column name`.',
      'Mengira INNER JOIN mempertahankan semua baris tabel kiri — baris tanpa pasangan hilang; pakai LEFT JOIN bila semua baris harus tetap ada.',
      "Membandingkan tanggal yang formatnya bukan `YYYY-MM-DD` (mis. '7/10/2026') sebagai teks: urutannya jadi kacau.",
    ],
    dialects: [
      {
        label: 'Literal tanggal',
        syntax: {
          sqlite: "'2026-11-01' (teks ISO)",
          sqlServer: "'2026-11-01' atau CAST('2026-11-01' AS date)",
          mysql: "'2026-11-01' atau DATE '2026-11-01'",
          postgresql: "DATE '2026-11-01'",
          oracle: "DATE '2026-11-01' atau TO_DATE('2026-11-01', 'YYYY-MM-DD')",
        },
        note: 'SQLite tidak punya tipe DATE: tanggal hanyalah teks, jadi formatnya harus konsisten YYYY-MM-DD.',
      },
      {
        label: 'Satu bulan penuh (aman untuk kolom berisi jam)',
        syntax: {
          sqlite: "tgl >= '2026-11-01' AND tgl < '2026-12-01'",
          sqlServer: "tgl >= '2026-11-01' AND tgl < '2026-12-01'",
          mysql: "tgl >= '2026-11-01' AND tgl < '2026-12-01'",
          postgresql: "tgl >= DATE '2026-11-01' AND tgl < DATE '2026-12-01'",
          oracle: "tgl >= DATE '2026-11-01' AND tgl < DATE '2026-12-01'",
        },
        note: "BETWEEN '2026-11-01' AND '2026-11-30' melewatkan kejadian pada 30 November setelah pukul 00:00 jika kolomnya bertipe datetime.",
      },
      {
        label: 'Alias tabel',
        syntax: {
          sqlite: 'FROM pasien AS p / FROM pasien p',
          sqlServer: 'FROM pasien AS p / FROM pasien p',
          mysql: 'FROM pasien AS p / FROM pasien p',
          postgresql: 'FROM pasien AS p / FROM pasien p',
          oracle: 'FROM pasien p (AS tidak diizinkan untuk alias tabel)',
        },
      },
    ],
  },
  {
    id: 'left-join',
    title: 'LEFT JOIN: Pertahankan Semua Baris Kiri',
    summary: 'LEFT JOIN menyimpan SEMUA baris tabel kiri; kolom tabel kanan diisi NULL bila tidak ada pasangannya — dasar untuk mencari data yang "tidak punya".',
    tier: 2,
    missions: ['t2-left-join', 't2-fix-left-join', 't3-kinerja-dokter'],
    sections: [
      {
        heading: 'Baris tanpa pasangan tidak dibuang',
        body: `\`A LEFT JOIN B ON …\` mengembalikan setiap baris \`A\`. Jika baris itu punya pasangan di \`B\`, kolom \`B\` terisi; jika tidak, semua kolom \`B\` bernilai **NULL**. Satu baris \`A\` yang punya beberapa pasangan muncul beberapa kali (satu per pasangan).

Pola paling berguna adalah **anti-join**: mencari baris yang TIDAK punya pasangan, dengan menyaring kolom tabel kanan yang \`IS NULL\`. Pilih kolom yang di tabel aslinya tidak pernah NULL (mis. primary key), agar NULL yang terlihat pasti berarti "tidak ada pasangan".`,
        examples: [
          {
            title: 'Kunjungan yang tidak punya tagihan',
            sql: `SELECT k.no_rawat, k.status
FROM kunjungan k
LEFT JOIN billing b ON b.no_rawat = k.no_rawat
WHERE b.id_billing IS NULL
ORDER BY k.no_rawat;`,
            note: '4 kunjungan, semuanya berstatus Batal. `b.id_billing` adalah primary key billing, jadi NULL di sini pasti berarti tidak ada tagihan.',
          },
        ],
      },
      {
        heading: 'Syarat tabel kanan: di ON atau di WHERE?',
        body: `Ini sumber bug LEFT JOIN yang paling sering:

- Syarat di **ON** ikut menentukan pasangan. Baris kiri tetap muncul; jika tidak ada baris kanan yang memenuhi syarat, kolom kanannya NULL.
- Syarat di **WHERE** dijalankan SETELAH join. Untuk baris kiri tanpa pasangan, kolom kanannya NULL, sehingga syarat seperti \`kolom_kanan = 'x'\` bernilai UNKNOWN (bukan TRUE) dan barisnya **ikut dibuang**. Hasilnya diam-diam berubah menjadi INNER JOIN.

Hal yang sama berlaku saat menghitung: \`COUNT(*)\` menghitung baris, termasuk baris hasil LEFT JOIN yang kolom kanannya NULL semua, sehingga baris kiri tanpa pasangan terhitung 1. \`COUNT(kolom_kanan)\` melewati NULL, sehingga hasilnya 0.`,
        examples: [
          {
            title: 'Semua poli beserta kunjungan batalnya (syarat di ON)',
            sql: `SELECT pl.nama_poli, k.no_rawat AS kunjungan_batal
FROM poliklinik pl
LEFT JOIN kunjungan k
  ON k.id_poli = pl.id_poli
 AND k.status = 'Batal'
ORDER BY pl.id_poli, k.no_rawat;`,
            note: "Ketujuh poli tetap tampil (8 baris, karena Poli Umum punya 2 kunjungan batal); poli tanpa kunjungan batal berisi NULL. Coba pindahkan `k.status = 'Batal'` ke WHERE: hanya 4 baris yang tersisa.",
          },
        ],
      },
    ],
    pitfalls: [
      "Menaruh syarat kolom tabel kanan (mis. `k.status = 'Batal'`) di WHERE: baris kiri tanpa pasangan terbuang dan LEFT JOIN berubah menjadi INNER JOIN.",
      'Memakai `COUNT(*)` setelah LEFT JOIN untuk menghitung pasangan: baris tanpa pasangan terhitung 1, bukan 0.',
      'Menulis `= NULL` untuk mencari baris tanpa pasangan — hasilnya selalu kosong; gunakan `IS NULL`.',
      'Memeriksa `IS NULL` pada kolom kanan yang memang boleh NULL (mis. `no_sep`): baris yang punya pasangan pun ikut terambil.',
    ],
    dialects: [
      {
        label: 'Ganti NULL hasil LEFT JOIN',
        syntax: {
          sqlite: 'COALESCE(x, 0) atau IFNULL(x, 0)',
          sqlServer: 'COALESCE(x, 0) atau ISNULL(x, 0)',
          mysql: 'COALESCE(x, 0) atau IFNULL(x, 0)',
          postgresql: 'COALESCE(x, 0)',
          oracle: 'COALESCE(x, 0) atau NVL(x, 0)',
        },
        note: 'COALESCE adalah standar SQL dan ada di semua DBMS — pilihan paling portabel.',
      },
      {
        label: 'RIGHT JOIN / FULL OUTER JOIN',
        syntax: {
          sqlite: 'keduanya didukung sejak 3.39',
          sqlServer: 'keduanya didukung',
          mysql: 'RIGHT JOIN ada, FULL OUTER JOIN tidak ada (gabungkan LEFT + RIGHT dengan UNION)',
          postgresql: 'keduanya didukung',
          oracle: 'keduanya didukung',
        },
      },
      {
        label: 'Outer join gaya lama',
        syntax: {
          sqlite: 'tidak ada',
          sqlServer: '*= (sudah tidak didukung)',
          mysql: 'tidak ada',
          postgresql: 'tidak ada',
          oracle: 'WHERE a.id = b.id(+) — masih jalan, tetapi sebaiknya pakai LEFT JOIN',
        },
      },
    ],
  },
  {
    id: 'agregasi',
    title: 'Fungsi Agregat: COUNT, SUM, AVG, MIN, MAX',
    summary: 'Fungsi agregat merangkum banyak baris menjadi satu nilai; perhatikan bedanya COUNT(*), COUNT(kolom), dan COUNT(DISTINCT kolom).',
    tier: 2,
    missions: ['t2-sum-avg', 't2-count-group', 't3-predict-count', 't3-kinerja-dokter', 't4-min-max'],
    sections: [
      {
        heading: 'Merangkum banyak baris',
        body: `Fungsi agregat mengubah sekumpulan baris menjadi **satu nilai**:

- \`COUNT(*)\` — banyaknya baris
- \`SUM(kolom)\` — jumlah, \`AVG(kolom)\` — rata-rata
- \`MIN(kolom)\` / \`MAX(kolom)\` — nilai terkecil / terbesar (juga bekerja untuk teks dan tanggal)

Tanpa GROUP BY, seluruh baris yang lolos WHERE dianggap **satu grup**, jadi hasilnya tepat satu baris. Untuk membulatkan, bungkus dengan \`ROUND(nilai, jumlah_desimal)\`.`,
        examples: [
          {
            title: 'Ringkasan tagihan yang sudah lunas',
            sql: `SELECT COUNT(*) AS jumlah_tagihan,
       SUM(total_biaya) AS total,
       MIN(total_biaya) AS terkecil,
       MAX(total_biaya) AS terbesar,
       ROUND(AVG(total_biaya), 0) AS rata_rata
FROM billing
WHERE status_bayar = 'Lunas';`,
            note: '23 tagihan lunas dirangkum menjadi satu baris. WHERE berjalan dulu, baru agregat dihitung dari baris yang tersisa.',
          },
        ],
      },
      {
        heading: 'Tiga wajah COUNT dan perlakuan NULL',
        body: `- \`COUNT(*)\` menghitung **baris**, apa pun isinya.
- \`COUNT(kolom)\` hanya menghitung baris yang kolomnya **tidak NULL**.
- \`COUNT(DISTINCT kolom)\` menghitung **nilai berbeda** (NULL tidak dihitung).

Semua agregat selain \`COUNT(*)\` **melewati NULL**. Artinya \`AVG(x)\` = jumlah nilai yang ada ÷ banyaknya nilai yang ada — NULL tidak dianggap 0. Jika semua nilainya NULL (atau tidak ada baris), \`SUM\` dan \`AVG\` menghasilkan NULL, sedangkan \`COUNT\` menghasilkan 0.`,
        examples: [
          {
            title: 'COUNT pada struktur organisasi',
            sql: `SELECT COUNT(*) AS semua_jabatan,
       COUNT(id_atasan) AS punya_atasan,
       COUNT(DISTINCT id_atasan) AS jumlah_atasan
FROM struktur_organisasi;`,
            note: '19 jabatan; hanya Direktur Utama yang id_atasan-nya NULL, jadi 18 punya atasan; dan atasan-atasan itu hanya 9 jabatan berbeda.',
          },
        ],
      },
    ],
    pitfalls: [
      'Memakai `COUNT(kolom)` padahal yang ingin dihitung semua baris — baris yang kolomnya NULL tidak ikut terhitung.',
      'Mengira `AVG` menganggap NULL sebagai 0: NULL dilewati, sehingga rata-ratanya bisa lebih besar dari perkiraan.',
      'Lupa bahwa `SUM` dari nol baris adalah NULL, bukan 0 — bungkus dengan `COALESCE(SUM(x), 0)` bila perlu angka.',
      'Menaruh fungsi agregat di WHERE (`WHERE SUM(x) > …`): agregat belum dihitung saat WHERE berjalan; pakai HAVING.',
    ],
    dialects: [
      {
        label: 'AVG kolom bilangan bulat',
        syntax: {
          sqlite: 'REAL (ada pecahan)',
          sqlServer: 'int — pecahan DIPOTONG!',
          mysql: 'DECIMAL (ada pecahan)',
          postgresql: 'numeric (ada pecahan)',
          oracle: 'NUMBER (ada pecahan)',
        },
        note: 'Di SQL Server, ubah dulu tipenya: AVG(CAST(total_biaya AS decimal(14,2))) atau AVG(total_biaya * 1.0).',
      },
      {
        label: 'Membulatkan 2 desimal',
        syntax: {
          sqlite: 'ROUND(x, 2)',
          sqlServer: 'ROUND(x, 2)',
          mysql: 'ROUND(x, 2)',
          postgresql: 'ROUND(x::numeric, 2)',
          oracle: 'ROUND(x, 2)',
        },
        note: 'PostgreSQL tidak punya ROUND(double precision, integer); ubah ke numeric dulu.',
      },
      {
        label: 'Gabungkan teks per grup',
        syntax: {
          sqlite: "GROUP_CONCAT(nama, ', ')",
          sqlServer: "STRING_AGG(nama, ', ') (sejak 2017)",
          mysql: "GROUP_CONCAT(nama SEPARATOR ', ')",
          postgresql: "STRING_AGG(nama, ', ')",
          oracle: "LISTAGG(nama, ', ') WITHIN GROUP (ORDER BY nama)",
        },
      },
    ],
  },
  {
    id: 'group-by',
    title: 'GROUP BY: Satu Baris per Kelompok',
    summary: 'GROUP BY mengumpulkan baris yang nilainya sama ke dalam grup, lalu fungsi agregat dihitung per grup.',
    tier: 2,
    missions: ['t2-count-group', 't3-bpjs-per-poli'],
    sections: [
      {
        heading: 'Agregat per kelompok',
        body: `Tanpa GROUP BY, \`COUNT(*)\` menghitung seluruh tabel. Dengan \`GROUP BY kolom\`, baris yang nilai \`kolom\`-nya sama dikumpulkan ke dalam satu grup, dan setiap grup menghasilkan **satu baris** di hasil.

Aturan emasnya: setiap kolom di SELECT harus **ada di GROUP BY** atau **dibungkus fungsi agregat**. Kolom lain tidak punya satu nilai yang jelas per grup — grup "L" berisi 10 pasien, nama siapa yang mau ditampilkan?`,
        examples: [
          {
            title: 'Jumlah pasien per jenis kelamin',
            sql: `SELECT jenis_kelamin, COUNT(*) AS jumlah
FROM pasien
GROUP BY jenis_kelamin;`,
            note: '20 baris pasien menjadi 2 baris: satu untuk L, satu untuk P.',
          },
        ],
      },
      {
        heading: 'Mengelompokkan dengan beberapa kolom',
        body: `\`GROUP BY a, b\` membuat satu grup untuk setiap **kombinasi** nilai \`a\` dan \`b\` yang muncul. Kolom pengelompok juga boleh berupa ekspresi, mis. \`substr(tgl_kunjungan, 1, 7)\` untuk mengambil bagian "tahun-bulan" dari tanggal.

Agar portabel, tulis ulang ekspresinya di GROUP BY (jangan memakai alias SELECT) — SQL Server tidak mengenali alias di GROUP BY.`,
        examples: [
          {
            title: 'Kunjungan per bulan dan status',
            sql: `SELECT substr(tgl_kunjungan, 1, 7) AS bulan, status, COUNT(*) AS jumlah
FROM kunjungan
GROUP BY substr(tgl_kunjungan, 1, 7), status
ORDER BY bulan, status;`,
            note: '6 kombinasi bulan × status. Oktober: 16 Selesai, 2 Dirawat, 3 Batal.',
          },
        ],
      },
    ],
    pitfalls: [
      'Menampilkan kolom yang tidak ada di GROUP BY dan tidak diagregasi: SQLite tetap menjalankannya dengan nilai dari baris sembarang (diam-diam salah), DBMS lain menolak.',
      'Mengelompokkan berdasarkan nama yang bisa kembar (mis. nama dokter) — lebih aman ikut sertakan kuncinya: `GROUP BY d.id_dokter, d.nama_dokter`.',
      'Mengira GROUP BY mengurutkan hasil. Urutan grup tidak dijamin; tambahkan ORDER BY bila urutan penting.',
    ],
    dialects: [
      {
        label: 'Kolom di luar GROUP BY tanpa agregat',
        syntax: {
          sqlite: 'diizinkan (nilai dari baris sembarang)',
          sqlServer: 'error: not contained in aggregate function or GROUP BY',
          mysql: 'error jika ONLY_FULL_GROUP_BY aktif (default sejak 5.7)',
          postgresql: 'error — kecuali tabelnya dikelompokkan berdasarkan primary key',
          oracle: 'error: ORA-00979 not a GROUP BY expression',
        },
      },
      {
        label: 'Subtotal & total keseluruhan',
        syntax: {
          sqlite: 'tidak ada (gabungkan dua query dengan UNION ALL)',
          sqlServer: 'GROUP BY ROLLUP(a, b)',
          mysql: 'GROUP BY a, b WITH ROLLUP',
          postgresql: 'GROUP BY ROLLUP(a, b)',
          oracle: 'GROUP BY ROLLUP(a, b)',
        },
      },
    ],
  },
  {
    id: 'having',
    title: 'HAVING: Menyaring Grup',
    summary: 'WHERE menyaring baris SEBELUM pengelompokan; HAVING menyaring grup SESUDAH agregat dihitung.',
    tier: 2,
    missions: ['t2-having', 't2-predict-having'],
    sections: [
      {
        heading: 'WHERE untuk baris, HAVING untuk grup',
        body: `Urutan eksekusinya: \`FROM → WHERE → GROUP BY → HAVING → SELECT\`.

- **WHERE** memeriksa baris satu per satu sebelum grup terbentuk, jadi tidak bisa memakai \`COUNT\`/\`SUM\`/\`AVG\`.
- **HAVING** memeriksa setiap grup setelah agregatnya dihitung, jadi syarat seperti \`COUNT(*) >= 2\` atau \`SUM(x) > 1000000\` ditulis di sini.

Kalau syaratnya tentang satu baris (mis. status, kota, tanggal), tulis di WHERE — lebih jelas dan lebih cepat karena barisnya dibuang sebelum dikelompokkan.`,
        examples: [
          {
            title: 'Pasien yang berkunjung lebih dari sekali',
            sql: `SELECT no_rm, COUNT(*) AS jumlah_kunjungan
FROM kunjungan
GROUP BY no_rm
HAVING COUNT(*) >= 2
ORDER BY jumlah_kunjungan DESC, no_rm;`,
            note: '14 pasien. RM-0001 paling sering (3 kunjungan). Pasien yang hanya datang sekali dibuang oleh HAVING, setelah dihitung.',
          },
        ],
      },
      {
        heading: 'Memakai WHERE dan HAVING sekaligus',
        body: `Keduanya sering dipakai bersama: WHERE memilih baris yang ikut dihitung, HAVING memilih grup yang ditampilkan.

Pada contoh di bawah, WHERE membuang tagihan yang belum lunas **sebelum** dijumlahkan, lalu HAVING hanya menyisakan dokter yang total tagihan lunasnya lebih dari 2 juta. Syarat \`status_bayar\` harus di WHERE: setelah dikelompokkan per dokter, satu grup berisi banyak status bayar sekaligus. Jika dipindah ke HAVING, SQLite tetap menjalankannya tetapi mengambil status dari satu baris sembarang per grup (hasilnya diam-diam salah), sedangkan DBMS lain menolak query itu.`,
        examples: [
          {
            title: 'Dokter dengan tagihan lunas di atas 2 juta',
            sql: `SELECT dr.nama_dokter, SUM(b.total_biaya) AS total_lunas
FROM kunjungan k
JOIN dokter dr ON dr.id_dokter = k.id_dokter
JOIN billing b ON b.no_rawat = k.no_rawat
WHERE b.status_bayar = 'Lunas'
GROUP BY dr.id_dokter, dr.nama_dokter
HAVING SUM(b.total_biaya) > 2000000
ORDER BY total_lunas DESC;`,
            note: 'Dari 23 tagihan lunas milik 10 dokter, hanya 2 dokter yang totalnya melewati 2 juta.',
          },
        ],
      },
    ],
    pitfalls: [
      'Menulis `WHERE COUNT(*) >= 2` → error "misuse of aggregate": agregat belum ada saat WHERE berjalan.',
      'Menaruh syarat per baris (mis. `kota = \'Jakarta\'`) di HAVING: kadang jalan di SQLite, tetapi maknanya kabur dan DBMS lain menolak bila kolomnya tidak ada di GROUP BY.',
      'Mengira COUNT(*) di HAVING menghitung seluruh tabel — yang dihitung hanya baris di dalam grup, setelah WHERE.',
    ],
    dialects: [
      {
        label: 'Alias SELECT di HAVING',
        syntax: {
          sqlite: 'diizinkan: HAVING jumlah >= 2',
          sqlServer: 'tidak: tulis ulang HAVING COUNT(*) >= 2',
          mysql: 'diizinkan: HAVING jumlah >= 2',
          postgresql: 'tidak: tulis ulang HAVING COUNT(*) >= 2',
          oracle: 'tidak sebelum 23ai (tulis ulang HAVING COUNT(*) >= 2); 23ai: diizinkan',
        },
        note: 'Menulis ulang ekspresi agregatnya di HAVING berlaku di semua DBMS.',
      },
      {
        label: 'HAVING tanpa GROUP BY',
        syntax: {
          sqlite: 'diizinkan sejak 3.39 (seluruh tabel = 1 grup)',
          sqlServer: 'diizinkan (seluruh tabel = 1 grup)',
          mysql: 'diizinkan',
          postgresql: 'diizinkan (seluruh tabel = 1 grup)',
          oracle: 'diizinkan (seluruh tabel = 1 grup)',
        },
      },
    ],
  },
];
