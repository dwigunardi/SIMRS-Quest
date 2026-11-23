/**
 * Materi untuk konsep yang diperkenalkan di Tier 1 (plus NULL, yang dipakai sejak Tier 2).
 * Contoh sengaja memakai tabel/filter berbeda dari soal misi agar tidak membocorkan jawaban.
 */
import type { Article } from '../../types';

export const ARTICLES_TIER1: Article[] = [
  {
    id: 'select',
    title: 'SELECT & FROM: Memilih Kolom',
    summary: 'Dasar setiap query: FROM menentukan tabel sumber, SELECT menentukan kolom (atau ekspresi) yang ditampilkan.',
    tier: 1,
    missions: ['t1-select'],
    sections: [
      {
        heading: 'Bentuk paling dasar',
        body: `\`SELECT kolom1, kolom2 FROM nama_tabel;\` artinya: ambil semua baris dari \`nama_tabel\`, lalu tampilkan hanya kolom yang disebut, dengan urutan kolom persis seperti yang ditulis.

- Pisahkan kolom dengan **koma**; jangan ada koma setelah kolom terakhir.
- \`SELECT *\` menampilkan **semua** kolom. Praktis untuk mengintip isi tabel, tetapi hindari di aplikasi: kolom yang tidak perlu ikut terbaca, dan query bisa "berubah diam-diam" saat ada kolom baru ditambahkan ke tabel.
- Nama tabel dan kolom di SQLite tidak peka huruf besar/kecil (\`POLIKLINIK\` = \`poliklinik\`), tetapi biasakan menulisnya persis seperti di Schema Explorer.`,
        examples: [
          {
            title: 'Daftar poliklinik dan gedungnya',
            sql: `SELECT nama_poli, gedung
FROM poliklinik;`,
            note: 'Hanya 2 dari 3 kolom tabel `poliklinik` yang tampil — `id_poli` tidak disebut di SELECT, jadi tidak ikut.',
          },
        ],
      },
      {
        heading: 'Alias dan ekspresi',
        body: `SELECT tidak hanya menampilkan kolom apa adanya. Kamu bisa menghitung **ekspresi** dan memberinya nama baru dengan **alias** \`AS\`:

- Aritmetika: \`total_biaya * 11 / 100 AS ppn\`
- Menyambung teks (di SQLite): \`nama || ' (' || kota || ')'\`
- Alias hanya mengganti **judul kolom di hasil**; isi tabel tidak berubah sama sekali.

Alias yang berisi spasi harus dikutip, mis. \`AS "total biaya"\`. Lebih aman memakai garis bawah: \`AS total_biaya\`.`,
        examples: [
          {
            title: 'Menyambung teks + alias',
            sql: `SELECT
  nama || ' (' || kota || ')' AS pasien_kota,
  tgl_lahir
FROM pasien
WHERE penjamin = 'Asuransi';`,
            note: 'Kolom `pasien_kota` tidak ada di tabel — ia dibuat saat query dijalankan dari gabungan `nama` dan `kota`.',
          },
          {
            title: 'Menghitung PPN 11% dari tagihan besar',
            sql: `SELECT
  no_rawat,
  total_biaya,
  total_biaya * 11 / 100 AS ppn_11_persen
FROM billing
WHERE total_biaya >= 3000000;`,
            note: 'Perhatikan urutan `* 11 / 100`: dikali dulu baru dibagi (mis. 12.500.000 → 1.375.000). Jika ditulis `total_biaya * (11 / 100)`, hasilnya 0 karena `11 / 100` pada bilangan bulat = 0 (lihat materi Angka & Pembagian). Pembagian bulat juga membuang sisa — hasil di sini tepat hanya karena nominalnya kelipatan 100.',
          },
        ],
      },
    ],
    pitfalls: [
      'Lupa koma di antara kolom: `SELECT nama kota` dibaca sebagai kolom `nama` dengan alias `kota`, bukan dua kolom.',
      'Koma berlebih sebelum FROM (`SELECT nama, kota, FROM pasien`) membuat syntax error.',
      'Mengira alias mengubah nama kolom di tabel — alias hanya berlaku di hasil query itu.',
      'Memakai `SELECT *` di kode aplikasi lalu kaget saat urutan/jumlah kolom berubah setelah tabel diubah.',
    ],
    dialects: [
      {
        label: 'Menyambung teks',
        syntax: {
          sqlite: "nama || ' ' || kota",
          sqlServer: "nama + ' ' + kota  /  CONCAT(nama, ' ', kota)",
          mysql: "CONCAT(nama, ' ', kota)",
          postgresql: "nama || ' ' || kota",
          oracle: "nama || ' ' || kota",
        },
        note: 'Di MySQL, `||` secara default berarti OR (logika), bukan penyambung teks.',
      },
      {
        label: 'Alias yang berisi spasi',
        syntax: {
          sqlite: 'AS "total biaya"',
          sqlServer: 'AS [total biaya]',
          mysql: 'AS `total biaya`',
          postgresql: 'AS "total biaya"',
          oracle: 'AS "total biaya"',
        },
      },
      {
        label: 'SELECT tanpa tabel',
        syntax: {
          sqlite: 'SELECT 1 + 1;',
          sqlServer: 'SELECT 1 + 1;',
          mysql: 'SELECT 1 + 1;',
          postgresql: 'SELECT 1 + 1;',
          oracle: 'SELECT 1 + 1 FROM dual;',
        },
        note: 'Oracle 23ai sudah mengizinkan SELECT tanpa FROM; versi sebelumnya wajib memakai tabel bayangan `dual`.',
      },
    ],
  },
  {
    id: 'where',
    title: 'WHERE: Menyaring Baris',
    summary: 'WHERE memeriksa setiap baris dan hanya meloloskan yang kondisinya TRUE — termasuk aturan AND/OR, IN, BETWEEN, dan perbandingan teks.',
    tier: 1,
    missions: ['t1-where', 't1-fix-tagihan'],
    sections: [
      {
        heading: 'Operator perbandingan, IN, dan BETWEEN',
        body: `WHERE berisi kondisi yang dicek untuk **setiap baris**. Baris yang kondisinya TRUE lolos; FALSE (atau NULL) dibuang.

- Perbandingan: \`=\`, \`<>\` (tidak sama, boleh juga \`!=\`), \`<\`, \`<=\`, \`>\`, \`>=\`
- \`kolom IN ('A', 'B', 'C')\` = singkatan dari \`kolom = 'A' OR kolom = 'B' OR kolom = 'C'\`
- \`kolom BETWEEN 400000 AND 600000\` = \`kolom >= 400000 AND kolom <= 600000\` (**kedua batas ikut**)
- Teks dan tanggal ditulis dengan **kutip tunggal**: \`'Lunas'\`, \`'2026-11-01'\`. Angka tanpa kutip.`,
        examples: [
          {
            title: 'Tagihan antara 400 ribu dan 600 ribu',
            sql: `SELECT no_rawat, total_biaya, status_bayar
FROM billing
WHERE total_biaya BETWEEN 400000 AND 600000;`,
            note: 'Tagihan tepat 500.000 ikut tampil — BETWEEN mencakup kedua batasnya. Ada 8 baris.',
          },
        ],
      },
      {
        heading: 'AND, OR, NOT, dan tanda kurung',
        body: `Saat beberapa kondisi digabung, **AND dievaluasi lebih dulu daripada OR** (seperti perkalian sebelum penjumlahan). Akibatnya:

\`a OR b AND c\` dibaca sebagai \`a OR (b AND c)\`, **bukan** \`(a OR b) AND c\`.

Jadi setiap kali mencampur AND dan OR, tulis tanda kurung secara eksplisit agar maksudmu jelas — bagi database maupun bagi rekan yang membaca query-mu. \`NOT\` membalik kondisi: \`NOT (status = 'Batal')\` sama dengan \`status <> 'Batal'\`.`,
        examples: [
          {
            title: 'Tanpa kurung: hasilnya melebar',
            sql: `SELECT no_rawat, id_poli, status
FROM kunjungan
WHERE status = 'Batal' OR status = 'Dirawat' AND id_poli = 'P05';`,
            note: 'Hasilnya 6 baris: SEMUA kunjungan Batal (dari poli mana pun) ditambah kunjungan Dirawat di P05. Coba tambahkan kurung `(status = \'Batal\' OR status = \'Dirawat\') AND id_poli = \'P05\'` — hasilnya tinggal 2 baris.',
          },
        ],
      },
      {
        heading: 'Teks dibandingkan huruf demi huruf',
        body: `Di SQLite, operator \`=\` pada teks **peka huruf besar/kecil**: \`'Selesai'\` dan \`'selesai'\` dianggap berbeda. Nilai yang salah ketik satu huruf tidak menghasilkan error — query tetap berjalan, hanya saja **tidak ada baris yang cocok**. Hasil kosong yang tidak terduga sering kali berarti ada salah ketik di nilai teks.

Cek nilai yang benar dengan Schema Explorer (contoh baris), atau dengan \`SELECT DISTINCT kolom FROM tabel\`.`,
        examples: [
          {
            title: 'Satu huruf beda, hasil jauh berbeda',
            sql: `SELECT
  (SELECT COUNT(*) FROM kunjungan WHERE status = 'Selesai') AS ditulis_tepat,
  (SELECT COUNT(*) FROM kunjungan WHERE status = 'selesai') AS huruf_kecil;`,
            note: "`'Selesai'` cocok dengan 25 kunjungan, sedangkan `'selesai'` (huruf kecil) cocok dengan 0 — tanpa pesan error apa pun.",
          },
        ],
      },
    ],
    pitfalls: [
      'Mencampur AND dan OR tanpa tanda kurung, sehingga OR "membocorkan" baris yang seharusnya tersaring.',
      "Salah kapitalisasi nilai teks (`'bpjs'` vs `'BPJS'`): query tidak error, tetapi hasilnya kosong atau kurang.",
      'Menulis teks dengan kutip ganda (`"Lunas"`) — di SQL standar kutip ganda untuk nama kolom, bukan teks. SQLite "memaafkan" dan menganggapnya teks bila tidak ada kolom bernama itu, tetapi DBMS lain error, dan begitu ada kolom bernama sama maknanya berubah diam-diam.',
      'Mengira BETWEEN tidak mencakup batasnya, lalu menambah/mengurangi 1 tanpa perlu.',
    ],
    dialects: [
      {
        label: "Apakah 'selesai' = 'Selesai'?",
        syntax: {
          sqlite: 'tidak (peka huruf)',
          sqlServer: 'ya, pada collation default (*_CI_*)',
          mysql: 'ya, pada collation default (*_ci)',
          postgresql: 'tidak (peka huruf)',
          oracle: 'tidak (peka huruf)',
        },
        note: 'Query yang "benar" di SQL Server/MySQL bisa menghasilkan 0 baris di SQLite/PostgreSQL/Oracle karena beda kapitalisasi.',
      },
      {
        label: 'Bandingkan tanpa peduli huruf besar/kecil',
        syntax: {
          sqlite: "status = 'selesai' COLLATE NOCASE",
          sqlServer: "status = 'selesai' COLLATE Latin1_General_CI_AS",
          mysql: "status = 'selesai'  -- sudah CI secara default",
          postgresql: "LOWER(status) = 'selesai'",
          oracle: "UPPER(status) = 'SELESAI'",
        },
        note: '`LOWER(kolom) = \'nilai\'` bekerja di semua DBMS, tetapi bisa membuat index pada kolom itu tidak terpakai.',
      },
    ],
  },
  {
    id: 'like',
    title: 'LIKE: Mencari Pola Teks',
    summary: 'LIKE mencocokkan teks dengan pola: % untuk "karakter apa saja", _ untuk "tepat satu karakter".',
    tier: 1,
    missions: ['t1-like'],
    sections: [
      {
        heading: 'Wildcard % dan _',
        body: `\`=\` mencari nilai yang sama persis. Untuk mencari berdasarkan **pola**, pakai \`LIKE\`:

- \`%\` = nol atau lebih karakter apa saja. \`'A%'\` diawali A, \`'%a'\` diakhiri a, \`'%sari%'\` mengandung "sari".
- \`_\` = **tepat satu** karakter apa saja. \`'RM-001_'\` cocok dengan RM-0010 sampai RM-0019.
- Tanpa wildcard, \`LIKE 'Bogor'\` berperilaku seperti \`= 'Bogor'\` (kecuali soal huruf besar/kecil, lihat bawah).
- \`NOT LIKE\` membalik hasilnya.`,
        examples: [
          {
            title: 'Nomor RM berpola RM-001_',
            sql: `SELECT no_rm, nama
FROM pasien
WHERE no_rm LIKE 'RM-001_';`,
            note: '`_` menggantikan tepat satu karakter, jadi hasilnya 10 pasien: RM-0010 sampai RM-0019.',
          },
          {
            title: 'Dokter yang namanya tidak diawali "dr."',
            sql: `SELECT nama_dokter, spesialisasi
FROM dokter
WHERE nama_dokter NOT LIKE 'dr.%';`,
            note: 'Hanya drg. Lestari Putri: "drg." diawali "dr" lalu huruf "g", bukan titik, jadi tidak cocok dengan pola `dr.%`.',
          },
        ],
      },
      {
        heading: 'Huruf besar/kecil dan karakter khusus',
        body: `Di SQLite, LIKE **tidak** membedakan huruf besar/kecil untuk huruf A–Z: \`'%sari%'\` menemukan "Wulan **S**ari" dan "Indah Permata**sari**" sekaligus. Ini berbeda dengan \`=\`, yang peka huruf.

Untuk mencari tanda \`%\` atau \`_\` itu sendiri (bukan sebagai wildcard), tandai dengan karakter escape, mis. \`LIKE '%10\\%%' ESCAPE '\\'\` untuk teks yang mengandung "10%".`,
        examples: [
          {
            title: 'LIKE mengabaikan huruf besar/kecil',
            sql: `SELECT nama, kota
FROM pasien
WHERE nama LIKE '%sari%';`,
            note: '"Wulan Sari" (S besar) dan "Indah Permatasari" (s kecil) sama-sama cocok dengan pola huruf kecil `%sari%`.',
          },
        ],
      },
    ],
    pitfalls: [
      "Memakai `=` dengan wildcard (`WHERE kode = 'I%'`): tanda % diperlakukan sebagai huruf biasa, hasilnya kosong.",
      "Lupa % di salah satu sisi: `'%sari'` hanya menemukan nama yang DIAKHIRI \"sari\".",
      'Mengira LIKE peka huruf seperti `=` (di SQLite tidak; di PostgreSQL dan Oracle justru peka).',
      'Pola yang diawali % (`\'%abc\'`) tidak bisa memakai index biasa, sehingga lambat pada tabel besar.',
    ],
    dialects: [
      {
        label: 'Pencarian tanpa peduli huruf besar/kecil',
        syntax: {
          sqlite: "nama LIKE '%sari%'  -- sudah CI untuk A–Z",
          sqlServer: "nama LIKE '%sari%'  -- ikut collation (default CI)",
          mysql: "nama LIKE '%sari%'  -- ikut collation (default CI)",
          postgresql: "nama ILIKE '%sari%'",
          oracle: "UPPER(nama) LIKE '%SARI%'",
        },
        note: 'Di PostgreSQL dan Oracle, LIKE peka huruf besar/kecil.',
      },
      {
        label: 'Mencari tanda % secara harfiah',
        syntax: {
          sqlite: "LIKE '%10\\%%' ESCAPE '\\'",
          sqlServer: "LIKE '%10[%]%'",
          mysql: "LIKE '%10\\%%'  -- backslash escape default",
          postgresql: "LIKE '%10\\%%'  -- backslash escape default",
          oracle: "LIKE '%10\\%%' ESCAPE '\\'",
        },
      },
    ],
  },
  {
    id: 'order-limit',
    title: 'ORDER BY & LIMIT: Mengurutkan dan Membatasi',
    summary: 'ORDER BY menentukan urutan baris (default dari kecil ke besar), LIMIT mengambil sebagian baris teratas — kombinasi untuk laporan "Top N".',
    tier: 1,
    missions: ['t1-order-limit', 't1-fix-tagihan'],
    sections: [
      {
        heading: 'ASC, DESC, dan beberapa kunci urutan',
        body: `Tanpa ORDER BY, urutan baris hasil **tidak dijamin** — bisa berubah kapan saja.

- \`ORDER BY kolom\` = \`ORDER BY kolom ASC\`: dari kecil ke besar (A→Z, tanggal lama→baru). **ASC adalah default.**
- \`ORDER BY kolom DESC\`: dari besar ke kecil.
- Beberapa kunci: \`ORDER BY kota, tgl_lahir DESC\` — urut kota dulu; untuk kota yang sama, urut tanggal lahir terbaru. Arah ASC/DESC berlaku **per kolom**, bukan untuk semuanya.
- Kunci kedua disebut **tie-breaker**: menentukan urutan baris yang nilai kunci pertamanya sama.`,
        examples: [
          {
            title: 'Urut kota, lalu pasien termuda dulu',
            sql: `SELECT nama, kota, tgl_lahir
FROM pasien
ORDER BY kota, tgl_lahir DESC;`,
            note: 'Kota urut A→Z (ASC default), tetapi di dalam setiap kota, tanggal lahir urut dari yang terbaru (DESC hanya berlaku untuk `tgl_lahir`).',
          },
        ],
      },
      {
        heading: 'LIMIT, OFFSET, dan laporan "Top N"',
        body: `\`LIMIT n\` mengambil **n baris pertama** dari hasil yang sudah diurutkan. \`LIMIT 5 OFFSET 10\` melewati 10 baris pertama lalu mengambil 5 (berguna untuk halaman ke-3 dengan 5 baris per halaman).

Untuk "N terbesar/terbaru", urutannya harus **DESC**. Dengan ASC (default), LIMIT justru mengambil N yang **terkecil**.

LIMIT adalah tahap terakhir eksekusi: database mengurutkan dulu, baru memotong. Tanpa ORDER BY, LIMIT mengambil baris "yang kebetulan pertama".`,
        examples: [
          {
            title: '3 pasien termuda',
            sql: `SELECT nama, tgl_lahir
FROM pasien
ORDER BY tgl_lahir DESC
LIMIT 3;`,
            note: 'Termuda = tanggal lahir paling BARU, jadi DESC. Coba hapus `DESC`: hasilnya berubah menjadi 3 pasien tertua.',
          },
          {
            title: 'Di mana NULL diletakkan?',
            sql: `SELECT no_rawat, no_sep
FROM kunjungan
WHERE id_poli = 'P05'
ORDER BY no_sep;`,
            note: 'Di SQLite, NULL dianggap lebih kecil dari nilai apa pun, sehingga 4 kunjungan tanpa SEP muncul paling atas pada urutan ASC.',
          },
        ],
      },
    ],
    pitfalls: [
      'Lupa DESC pada laporan "terbesar/terbaru" — LIMIT lalu mengambil yang terkecil.',
      'Menulis `ORDER BY a, b DESC` dan mengira keduanya DESC; padahal `a` tetap ASC.',
      'Tidak memberi tie-breaker, sehingga baris dengan nilai sama bisa muncul dalam urutan berbeda di setiap eksekusi.',
      'Memakai LIMIT tanpa ORDER BY dan menganggap hasilnya "N teratas".',
    ],
    dialects: [
      {
        label: 'Ambil 5 baris teratas',
        syntax: {
          sqlite: 'ORDER BY x DESC LIMIT 5',
          sqlServer: 'SELECT TOP 5 … ORDER BY x DESC',
          mysql: 'ORDER BY x DESC LIMIT 5',
          postgresql: 'ORDER BY x DESC LIMIT 5',
          oracle: 'ORDER BY x DESC FETCH FIRST 5 ROWS ONLY',
        },
        note: 'Oracle sebelum 12c memakai `ROWNUM`. PostgreSQL juga mendukung `FETCH FIRST 5 ROWS ONLY`.',
      },
      {
        label: 'Lewati 10 baris, ambil 5 (halaman berikutnya)',
        syntax: {
          sqlite: 'LIMIT 5 OFFSET 10',
          sqlServer: 'ORDER BY x OFFSET 10 ROWS FETCH NEXT 5 ROWS ONLY',
          mysql: 'LIMIT 5 OFFSET 10  /  LIMIT 10, 5',
          postgresql: 'LIMIT 5 OFFSET 10',
          oracle: 'OFFSET 10 ROWS FETCH NEXT 5 ROWS ONLY',
        },
        note: 'Di SQL Server (2012+), OFFSET … FETCH wajib didahului ORDER BY.',
      },
      {
        label: 'Posisi NULL pada ORDER BY … ASC',
        syntax: {
          sqlite: 'paling awal  (bisa NULLS LAST)',
          sqlServer: 'paling awal',
          mysql: 'paling awal',
          postgresql: 'paling akhir  (bisa NULLS FIRST)',
          oracle: 'paling akhir  (bisa NULLS FIRST)',
        },
        note: '`NULLS FIRST/LAST` didukung SQLite 3.30+, PostgreSQL, dan Oracle; SQL Server dan MySQL tidak punya sintaks ini.',
      },
    ],
  },
  {
    id: 'distinct',
    title: 'DISTINCT: Menghilangkan Duplikat',
    summary: 'DISTINCT membuang baris hasil yang kembar — dan "kembar" berarti SELURUH kolom yang dipilih bernilai sama.',
    tier: 1,
    missions: ['t1-distinct', 't1-predict-distinct'],
    sections: [
      {
        heading: 'Nilai unik dari satu kolom',
        body: `\`SELECT DISTINCT kolom FROM tabel\` menampilkan setiap nilai **satu kali saja**. Berguna untuk melihat "nilai apa saja yang ada", mis. daftar spesialisasi atau status yang pernah dipakai.

DISTINCT ditulis **tepat setelah SELECT**, satu kali saja, dan berlaku untuk seluruh baris hasil — bukan untuk satu kolom tertentu.`,
        examples: [
          {
            title: 'Spesialisasi yang ada di rumah sakit',
            sql: `SELECT DISTINCT spesialisasi
FROM dokter;`,
            note: 'Tabel dokter berisi 10 baris, tetapi hanya 7 spesialisasi berbeda — "Dokter Umum" dan dua spesialisasi lain dimiliki lebih dari satu dokter.',
          },
        ],
      },
      {
        heading: 'DISTINCT pada beberapa kolom',
        body: `Dengan lebih dari satu kolom, DISTINCT melihat **kombinasinya**. Dua baris dianggap duplikat hanya bila **semua** kolom yang dipilih sama persis.

Jadi \`SELECT DISTINCT id_poli, status\` boleh menampilkan \`P01\` lebih dari sekali — selama pasangan \`(id_poli, status)\`-nya berbeda.

DISTINCT mirip \`GROUP BY\` tanpa fungsi agregat: \`SELECT DISTINCT a, b\` memberi hasil yang sama dengan \`SELECT a, b … GROUP BY a, b\`. Bedanya, GROUP BY bisa sekaligus menghitung (COUNT, SUM, …) per kombinasi.`,
        examples: [
          {
            title: 'Kombinasi poli dan status kunjungan',
            sql: `SELECT DISTINCT id_poli, status
FROM kunjungan
ORDER BY id_poli, status;`,
            note: 'P01 muncul dua kali (Batal dan Selesai) karena yang dibuat unik adalah PASANGAN kolomnya. Hasilnya 12 kombinasi dari 32 kunjungan.',
          },
        ],
      },
    ],
    pitfalls: [
      'Mengira `SELECT DISTINCT a, b` hanya membuat kolom `a` unik — padahal kombinasi `a` dan `b` yang dibuat unik.',
      'Menulis DISTINCT di tengah daftar kolom (`SELECT a, DISTINCT b`) — itu syntax error.',
      'Menambal duplikat akibat JOIN yang keliru dengan DISTINCT, sehingga masalah aslinya (syarat JOIN salah) tersembunyi.',
    ],
    dialects: [
      {
        label: 'Kombinasi unik beberapa kolom',
        syntax: {
          sqlite: 'SELECT DISTINCT a, b FROM t',
          sqlServer: 'SELECT DISTINCT a, b FROM t',
          mysql: 'SELECT DISTINCT a, b FROM t',
          postgresql: 'SELECT DISTINCT a, b FROM t',
          oracle: 'SELECT DISTINCT a, b FROM t  (atau UNIQUE)',
        },
        note: 'Sintaks dasarnya sama di semua DBMS populer.',
      },
      {
        label: 'Satu baris per nilai kolom tertentu',
        syntax: {
          sqlite: 'tidak ada — pakai ROW_NUMBER() OVER (PARTITION BY …)',
          sqlServer: 'tidak ada — pakai ROW_NUMBER() OVER (PARTITION BY …)',
          mysql: 'tidak ada — pakai ROW_NUMBER() OVER (PARTITION BY …) (8.0+)',
          postgresql: 'SELECT DISTINCT ON (kota) … ORDER BY kota, …',
          oracle: 'tidak ada — pakai ROW_NUMBER() OVER (PARTITION BY …)',
        },
        note: '`DISTINCT ON` khusus PostgreSQL. Teknik ROW_NUMBER dipelajari di Tier 5.',
      },
    ],
  },
  {
    id: 'null',
    title: 'NULL: Nilai yang Tidak Diketahui',
    summary: 'NULL berarti "tidak ada nilai/tidak diketahui" — bukan 0, bukan teks kosong — dan punya aturan perbandingan sendiri.',
    tier: 1,
    missions: ['t3-sep-kosong', 't2-left-join', 't4-fix-not-in'],
    sections: [
      {
        heading: 'IS NULL, bukan = NULL',
        body: `NULL menandakan nilai yang **belum ada atau tidak diketahui**, mis. \`no_sep\` kunjungan yang SEP-nya belum terbit. NULL tidak sama dengan 0 atau teks kosong \`''\`.

Perbandingan apa pun dengan NULL (\`=\`, \`<>\`, \`<\`, …) hasilnya **UNKNOWN** (tidak diketahui; di SQLite ditampilkan sebagai NULL), bukan TRUE atau FALSE. Inilah *logika tiga nilai* SQL: TRUE, FALSE, dan UNKNOWN. Karena WHERE hanya meloloskan baris yang TRUE, \`WHERE no_sep = NULL\` **tidak pernah** menemukan apa pun — bahkan baris yang memang NULL.

Cara yang benar: \`kolom IS NULL\` dan \`kolom IS NOT NULL\`.`,
        examples: [
          {
            title: '= NULL vs IS NULL',
            sql: `SELECT
  (SELECT COUNT(*) FROM kunjungan WHERE no_sep = NULL) AS pakai_sama_dengan,
  (SELECT COUNT(*) FROM kunjungan WHERE no_sep IS NULL) AS pakai_is_null;`,
            note: '`= NULL` menemukan 0 baris tanpa error, padahal ada 16 kunjungan yang `no_sep`-nya NULL.',
          },
        ],
      },
      {
        heading: 'Mengganti NULL dan jebakan NOT IN',
        body: `Untuk menampilkan pengganti NULL, pakai \`COALESCE(kolom, pengganti)\`: hasilnya nilai non-NULL pertama dari daftar argumennya. SQLite juga punya \`IFNULL(kolom, pengganti)\` untuk dua argumen.

Jebakan yang sering terjadi: \`x NOT IN (daftar)\` ketika **daftar itu memuat NULL**. \`x NOT IN ('P01', NULL)\` berarti \`x <> 'P01' AND x <> NULL\`; bagian \`x <> NULL\` selalu NULL, sehingga seluruh kondisi tidak pernah TRUE dan hasilnya **selalu kosong**. Hal yang sama terjadi bila daftar itu berasal dari subquery yang kolomnya berisi NULL. Solusinya: saring NULL dari daftar, atau pakai \`NOT EXISTS\`.`,
        examples: [
          {
            title: 'Menampilkan pengganti NULL dengan COALESCE',
            sql: `SELECT
  no_rawat,
  status,
  COALESCE(no_sep, '(belum terbit)') AS sep
FROM kunjungan
WHERE id_poli = 'P01';`,
            note: 'Isi tabel tidak berubah; COALESCE hanya mengganti tampilan NULL di hasil query.',
          },
          {
            title: 'Satu NULL di dalam NOT IN',
            sql: `SELECT
  (SELECT COUNT(*) FROM poliklinik WHERE id_poli NOT IN ('P01', 'P02')) AS tanpa_null,
  (SELECT COUNT(*) FROM poliklinik WHERE id_poli NOT IN ('P01', 'P02', NULL)) AS ada_null;`,
            note: 'Tanpa NULL ada 5 poli yang lolos; begitu daftar memuat satu NULL, hasilnya langsung 0.',
          },
        ],
      },
    ],
    pitfalls: [
      'Menulis `= NULL` atau `<> NULL` — selalu menghasilkan 0 baris. Pakai `IS NULL` / `IS NOT NULL`.',
      'Memakai `NOT IN (subquery)` padahal kolom subquery bisa NULL, sehingga hasilnya kosong.',
      "Menyamakan NULL dengan 0 atau `''` (teks kosong).",
      'Lupa bahwa `kolom <> \'X\'` juga membuang baris yang kolomnya NULL.',
    ],
    dialects: [
      {
        label: 'Ganti NULL dengan nilai lain',
        syntax: {
          sqlite: "IFNULL(x, '-')  /  COALESCE(x, '-')",
          sqlServer: "ISNULL(x, '-')  /  COALESCE(x, '-')",
          mysql: "IFNULL(x, '-')  /  COALESCE(x, '-')",
          postgresql: "COALESCE(x, '-')",
          oracle: "NVL(x, '-')  /  COALESCE(x, '-')",
        },
        note: '`COALESCE` adalah standar SQL dan bekerja di semua DBMS — pilih ini bila query harus portabel.',
      },
      {
        label: "Teks kosong '' vs NULL",
        syntax: {
          sqlite: "'' berbeda dari NULL",
          sqlServer: "'' berbeda dari NULL",
          mysql: "'' berbeda dari NULL",
          postgresql: "'' berbeda dari NULL",
          oracle: "'' DIANGGAP NULL",
        },
        note: "Di Oracle, `WHERE kolom = ''` tidak pernah TRUE karena `''` diperlakukan sebagai NULL.",
      },
      {
        label: 'Perbandingan yang menganggap NULL = NULL',
        syntax: {
          sqlite: 'a IS b',
          sqlServer: 'a IS NOT DISTINCT FROM b  (2022+)',
          mysql: 'a <=> b',
          postgresql: 'a IS NOT DISTINCT FROM b',
          oracle: 'DECODE(a, b, 1, 0) = 1',
        },
      },
    ],
  },
];
