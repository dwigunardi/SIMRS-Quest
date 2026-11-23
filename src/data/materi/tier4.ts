/**
 * Materi untuk konsep yang diperkenalkan di Tier 4: CTE, JOIN lanjutan (FULL OUTER / CROSS), dan CTE rekursif.
 * Contoh sengaja memakai skenario berbeda dari misi Tier 4 agar tidak membocorkan jawaban.
 */
import type { Article } from '../../types';

export const ARTICLES_TIER4: Article[] = [
  {
    id: 'cte',
    title: 'CTE (WITH): Memberi Nama pada Langkah Query',
    summary: 'WITH nama AS (…) menyimpan hasil antara dengan nama, sehingga query panjang bisa disusun langkah demi langkah dan hasil yang sama dipakai berkali-kali.',
    tier: 4,
    missions: ['t4-cte'],
    sections: [
      {
        heading: 'Hasil antara yang punya nama',
        body: `Laporan SIMRS sering butuh dua tahap: **rekap dulu**, baru **dibandingkan** atau **disaring**. Dengan subquery, tahap pertama ditulis di dalam kurung dan kadang harus diulang. CTE (*Common Table Expression*) menuliskannya di depan:

\`WITH nama_cte AS (SELECT …) SELECT … FROM nama_cte …\`

- CTE hanya hidup selama satu statement — bukan tabel sungguhan dan tidak tersimpan di database.
- Query utama membaca CTE seperti tabel biasa: boleh di-JOIN, disaring, dikelompokkan.
- Satu CTE boleh dipakai **lebih dari sekali**, misalnya sekali sebagai data dan sekali lagi di subquery untuk menghitung rata-ratanya.`,
        examples: [
          {
            title: 'Kota dengan pasien di atas rata-rata',
            sql: `WITH pasien_per_kota AS (
  SELECT kota, COUNT(*) AS jumlah
  FROM pasien
  GROUP BY kota
)
SELECT kota, jumlah
FROM pasien_per_kota
WHERE jumlah > (SELECT AVG(jumlah) FROM pasien_per_kota)
ORDER BY jumlah DESC, kota;`,
            note: 'CTE `pasien_per_kota` dibaca dua kali: sebagai sumber baris dan untuk menghitung rata-rata (20 pasien ÷ 7 kota ≈ 2,86). Hasilnya 3 kota: Jakarta (6), Bandung (3), Bogor (3).',
          },
        ],
      },
      {
        heading: 'Beberapa CTE berantai',
        body: `Beberapa CTE dipisahkan koma setelah satu kata \`WITH\`. CTE yang ditulis belakangan boleh memakai CTE sebelumnya, sehingga logika terbaca seperti resep:

\`WITH langkah1 AS (…), langkah2 AS (SELECT … FROM langkah1 …) SELECT … FROM langkah2;\`

Kapan memilih CTE dibanding subquery? Hasilnya sama; perbedaannya ada pada **keterbacaan**. Pakai CTE bila tahap antara cukup panjang, dipakai lebih dari sekali, atau ingin diperiksa terpisah — kamu bisa menjalankan \`SELECT * FROM langkah1\` saja untuk memastikan langkah pertama benar sebelum melanjutkan.`,
        examples: [
          {
            title: 'Kunjungan selesai per dokter (dua CTE)',
            sql: `WITH kunjungan_selesai AS (
  SELECT no_rawat, id_dokter
  FROM kunjungan
  WHERE status = 'Selesai'
),
per_dokter AS (
  SELECT id_dokter, COUNT(*) AS jumlah_selesai
  FROM kunjungan_selesai
  GROUP BY id_dokter
)
SELECT d.nama_dokter, p.jumlah_selesai
FROM per_dokter p
JOIN dokter d ON d.id_dokter = p.id_dokter
ORDER BY p.jumlah_selesai DESC, d.nama_dokter;`,
            note: '`per_dokter` membaca `kunjungan_selesai`, lalu query utama menempelkan nama dokter. dr. Andi Pratama dan dr. Budi Santoso sama-sama punya 4 kunjungan selesai; urutan kedua (nama) memecah seri.',
          },
        ],
      },
    ],
    pitfalls: [
      'Menulis `WITH` lagi untuk CTE kedua — cukup satu `WITH`, CTE berikutnya dipisah koma.',
      'Mengira CTE tersimpan seperti tabel; setelah statement selesai CTE hilang dan tidak bisa dipanggil dari query lain.',
      'Lupa bahwa alias kolom di query utama tidak boleh dipakai di WHERE level yang sama menurut standar SQL (SQLite mengizinkannya, DBMS lain menolak) — bungkus dengan CTE berikutnya agar portabel.',
      'Di SQL Server, statement sebelum `WITH` wajib diakhiri titik koma; tanpa itu muncul error sintaks yang membingungkan.',
    ],
    dialects: [
      {
        label: 'Menulis CTE',
        syntax: {
          sqlite: 'WITH r AS (…) SELECT …',
          sqlServer: ';WITH r AS (…) SELECT …',
          mysql: 'WITH r AS (…) SELECT … (sejak 8.0)',
          postgresql: 'WITH r AS (…) SELECT …',
          oracle: 'WITH r AS (…) SELECT …',
        },
        note: 'Titik koma di depan pada SQL Server hanya kebiasaan pengaman: statement sebelumnya harus diakhiri `;`. MySQL 5.7 ke bawah belum mendukung CTE.',
      },
      {
        label: 'Memaksa CTE dihitung sekali (materialisasi)',
        syntax: {
          sqlite: 'WITH r AS MATERIALIZED (…) (sejak 3.35)',
          sqlServer: 'tidak ada sintaksnya (selalu digabung ke query)',
          mysql: 'tidak ada sintaksnya (optimizer memutuskan)',
          postgresql: 'WITH r AS MATERIALIZED (…) (sejak 12)',
          oracle: 'hint /*+ MATERIALIZE */ (tidak resmi)',
        },
      },
    ],
  },
  {
    id: 'join-lanjutan',
    title: 'FULL OUTER JOIN & CROSS JOIN',
    summary: 'FULL OUTER JOIN mempertahankan baris dari kedua sisi; CROSS JOIN memasangkan setiap baris dengan setiap baris lain untuk membentuk matriks lengkap.',
    tier: 4,
    missions: ['t4-full-outer-join', 't4-cross-join'],
    sections: [
      {
        heading: 'FULL OUTER JOIN: tidak ada yang dibuang',
        body: `Ingat perilaku JOIN sejauh ini:

- \`INNER JOIN\` membuang baris yang tidak punya pasangan di **kedua** sisi.
- \`LEFT JOIN\` mempertahankan semua baris kiri; \`RIGHT JOIN\` kebalikannya (semua baris kanan).
- \`FULL OUTER JOIN\` mempertahankan **semua baris dari kedua sisi**. Bila tidak ada pasangan, kolom sisi lawan bernilai NULL.

Karena kunci di salah satu sisi bisa NULL, kolom kunci hasil biasanya diambil dengan \`COALESCE(kiri.kunci, kanan.kunci)\`, dan angka yang kosong diubah menjadi 0 dengan \`COALESCE(x, 0)\`. Pola ini cocok untuk membandingkan dua rekap yang anggotanya tidak sama persis.`,
        examples: [
          {
            title: 'Sebaran kota: pasien Umum vs Asuransi',
            sql: `WITH umum AS (
  SELECT kota, COUNT(*) AS jumlah FROM pasien WHERE penjamin = 'Umum' GROUP BY kota
),
asuransi AS (
  SELECT kota, COUNT(*) AS jumlah FROM pasien WHERE penjamin = 'Asuransi' GROUP BY kota
)
SELECT
  COALESCE(u.kota, a.kota) AS kota,
  COALESCE(u.jumlah, 0) AS pasien_umum,
  COALESCE(a.jumlah, 0) AS pasien_asuransi
FROM umum u
FULL OUTER JOIN asuransi a ON a.kota = u.kota
ORDER BY kota;`,
            note: 'Hanya Jakarta yang muncul di kedua rekap. Bekasi, Bogor, Tangerang hanya punya pasien Umum; Bandung, Depok, Surabaya hanya Asuransi. Totalnya 7 kota — INNER JOIN hanya akan menyisakan Jakarta.',
          },
        ],
      },
      {
        heading: 'CROSS JOIN: semua kombinasi',
        body: `\`CROSS JOIN\` (atau koma di FROM) memasangkan **setiap** baris kiri dengan **setiap** baris kanan, tanpa syarat. Jumlah barisnya = baris kiri × baris kanan: 7 poliklinik × 10 dokter = 70 baris.

Sekilas terlihat tidak berguna, tapi CROSS JOIN adalah cara membuat **kerangka lengkap**: daftar semua kombinasi yang *seharusnya* ada. Setelah kerangka terbentuk, data asli ditempel dengan \`LEFT JOIN\`, sehingga kombinasi tanpa data tetap muncul dengan nilai 0 — bukan hilang. Daftar kecil bisa dibuat sendiri dengan CTE berisi \`VALUES\`.`,
        examples: [
          {
            title: 'Kerangka kota × penjamin (termasuk yang nol)',
            sql: `WITH kota_dipilih(kota) AS (VALUES ('Bogor'), ('Surabaya')),
daftar_penjamin(penjamin) AS (VALUES ('Asuransi'), ('BPJS'), ('Umum'))
SELECT k.kota, dp.penjamin, COUNT(p.no_rm) AS jumlah_pasien
FROM kota_dipilih k
CROSS JOIN daftar_penjamin dp
LEFT JOIN pasien p
  ON p.kota = k.kota
 AND p.penjamin = dp.penjamin
GROUP BY k.kota, dp.penjamin
ORDER BY k.kota, dp.penjamin;`,
            note: '2 kota × 3 penjamin = 6 baris. Bogor–Asuransi dan Surabaya–Umum bernilai 0; tanpa kerangka CROSS JOIN kedua baris itu tidak akan muncul sama sekali.',
          },
        ],
      },
    ],
    pitfalls: [
      'Lupa `COALESCE` pada kunci FULL OUTER JOIN, sehingga baris yang hanya ada di sisi kanan tampil dengan kunci NULL.',
      'Menghitung `angka - NULL` atau `angka + NULL` — hasilnya NULL; ubah dulu menjadi 0 dengan `COALESCE`.',
      'CROSS JOIN tidak sengaja: lupa menulis syarat `ON` (atau memakai koma tanpa WHERE) sehingga hasil membengkak menjadi perkalian kedua tabel.',
      'Memakai `COUNT(*)` setelah LEFT JOIN ke kerangka: kombinasi kosong ikut terhitung 1; hitung kolom dari tabel data, mis. `COUNT(p.no_rm)`.',
    ],
    dialects: [
      {
        label: 'FULL OUTER JOIN',
        syntax: {
          sqlite: 'FULL OUTER JOIN (sejak 3.39)',
          sqlServer: 'FULL OUTER JOIN',
          mysql: 'tidak ada: LEFT JOIN … UNION … RIGHT JOIN',
          postgresql: 'FULL OUTER JOIN',
          oracle: 'FULL OUTER JOIN',
        },
      },
      {
        label: 'CROSS JOIN',
        syntax: {
          sqlite: 'a CROSS JOIN b  /  FROM a, b',
          sqlServer: 'a CROSS JOIN b  /  FROM a, b',
          mysql: 'a CROSS JOIN b  /  FROM a, b',
          postgresql: 'a CROSS JOIN b  /  FROM a, b',
          oracle: 'a CROSS JOIN b  /  FROM a, b',
        },
      },
      {
        label: 'Daftar nilai sementara',
        syntax: {
          sqlite: "WITH s(x) AS (VALUES ('a'), ('b'))",
          sqlServer: "(VALUES ('a'), ('b')) AS s(x)",
          mysql: "SELECT 'a' AS x UNION ALL SELECT 'b'",
          postgresql: "(VALUES ('a'), ('b')) AS s(x)",
          oracle: "SELECT 'a' FROM dual UNION ALL SELECT 'b' FROM dual",
        },
        note: 'MySQL 8.0.19+ juga punya `VALUES ROW(…)`, tetapi `UNION ALL` berlaku di semua versi.',
      },
    ],
  },
  {
    id: 'cte-rekursif',
    title: 'CTE Rekursif (WITH RECURSIVE)',
    summary: 'CTE yang memanggil dirinya sendiri: cocok untuk menelusuri hierarki (atasan–bawahan) dan membuat deret angka atau tanggal yang tidak ada di tabel.',
    tier: 4,
    missions: ['t4-recursive-org', 't4-recursive-dates'],
    sections: [
      {
        heading: 'Anchor + bagian rekursif',
        body: `CTE rekursif terdiri dari dua SELECT yang disambung \`UNION ALL\`:

- **Anchor**: baris awal, dijalankan sekali.
- **Bagian rekursif**: SELECT yang membaca CTE itu sendiri. SQLite menjalankannya berulang-ulang, setiap kali hanya terhadap baris yang **baru** ditemukan pada putaran sebelumnya.
- Rekursi **berhenti** saat bagian rekursif tidak menghasilkan baris baru. Karena itu harus ada syarat yang suatu saat bernilai salah, mis. \`WHERE n < 10\`.

Kolom bantu seperti \`langkah\` atau \`level\` (nilai anchor + 1 di setiap putaran) berguna untuk mengetahui seberapa dalam sebuah baris ditemukan.`,
        examples: [
          {
            title: 'Deret angka 1 sampai 10',
            sql: `WITH RECURSIVE angka(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM angka WHERE n < 10
)
SELECT n, n * n AS kuadrat
FROM angka;`,
            note: 'Anchor menghasilkan 1; setiap putaran menambah 1 sampai syarat `n < 10` gagal. Tanpa `WHERE n < 10` query tidak akan pernah berhenti (dan tab browser akan macet) — jangan dicoba tanpa `LIMIT` di dalam bagian rekursif.',
          },
          {
            title: 'Menelusuri atasan dari satu jabatan ke puncak',
            sql: `WITH RECURSIVE ke_atas AS (
  SELECT id_jabatan, nama_jabatan, id_atasan, 0 AS langkah
  FROM struktur_organisasi
  WHERE id_jabatan = 'J16'

  UNION ALL

  SELECT s.id_jabatan, s.nama_jabatan, s.id_atasan, k.langkah + 1
  FROM struktur_organisasi s
  JOIN ke_atas k ON s.id_jabatan = k.id_atasan
)
SELECT langkah, id_jabatan, nama_jabatan
FROM ke_atas
ORDER BY langkah;`,
            note: 'Mulai dari Programmer SIMRS (J16), setiap putaran mencari **atasannya** (`s.id_jabatan = k.id_atasan`). Empat baris: J16 → J14 → J03 → J01. Rekursi berhenti di Direktur Utama karena id_atasan-nya NULL.',
          },
        ],
      },
      {
        heading: 'Membuat deret tanggal',
        body: `Database jarang punya tabel kalender, padahal laporan per hari/minggu butuh tanggal yang **lengkap** — termasuk tanggal tanpa transaksi. CTE rekursif bisa membuatnya: anchor = tanggal awal, bagian rekursif menambah selang waktu dengan \`date(tgl, '+1 day')\` (atau \`'+7 day'\`, \`'+1 month'\`), dan syarat \`WHERE tgl < tanggal_akhir\` menghentikannya.

Setelah deretnya ada, data asli ditempelkan dengan LEFT JOIN atau subquery, sehingga periode tanpa transaksi tetap tampil dengan nilai 0.

**Pengaman putaran tak berujung**: pastikan syarat berhenti membandingkan nilai yang terus bertambah. Saat bereksperimen, taruh \`LIMIT\` **di dalam bagian rekursif**, mis. \`SELECT date(awal, '+7 day') FROM minggu WHERE … LIMIT 100\`. LIMIT di query utama hanya menolong bila query utama tidak memakai ORDER BY/GROUP BY/agregat; jika memakainya, SQLite harus menghabiskan seluruh deret dulu, sehingga query tetap tidak berhenti.`,
        examples: [
          {
            title: 'Rekap kunjungan per minggu (mulai Senin, 5 Oktober)',
            sql: `WITH RECURSIVE minggu(awal) AS (
  SELECT '2026-10-05'
  UNION ALL
  SELECT date(awal, '+7 day') FROM minggu WHERE awal < '2026-11-09'
  LIMIT 100 -- pengaman: rekursi berhenti paling lambat setelah 100 putaran
)
SELECT
  awal,
  date(awal, '+6 day') AS akhir,
  (SELECT COUNT(*)
     FROM kunjungan k
    WHERE k.tgl_kunjungan BETWEEN m.awal AND date(m.awal, '+6 day')) AS jumlah_kunjungan
FROM minggu m
ORDER BY awal;`,
            note: 'Enam minggu (Senin–Minggu) dari 5 Oktober s.d. 15 November; kunjungan 1–3 Oktober sengaja tidak termasuk karena deretnya dimulai Senin 5 Oktober. Minggu 26 Oktober–1 November hanya punya 1 kunjungan; berkat deret buatan, minggu yang sepi tetap terlihat. `LIMIT 100` di bagian rekursif tidak mengubah hasil, hanya pengaman bila syarat berhentinya keliru.',
          },
        ],
      },
    ],
    pitfalls: [
      'Membalik arah syarat JOIN di bagian rekursif: menukar kolom `id_jabatan`/`id_atasan` di ON membalik arah penelusuran (ke atas ↔ ke bawah).',
      'Tidak ada syarat berhenti, atau syaratnya tidak pernah salah — query berputar tanpa akhir.',
      'Memakai `UNION` (bukan `UNION ALL`) tanpa sadar: duplikat dibuang di setiap putaran, kadang menyembunyikan kesalahan logika.',
      'Membandingkan tanggal yang formatnya tidak seragam; `date()` di SQLite menghasilkan teks YYYY-MM-DD, jadi tanggal pembanding juga harus berformat sama.',
    ],
    dialects: [
      {
        label: 'Kata kunci CTE rekursif',
        syntax: {
          sqlite: 'WITH RECURSIVE t(n) AS (…)',
          sqlServer: 'WITH t(n) AS (…)  (tanpa RECURSIVE)',
          mysql: 'WITH RECURSIVE t(n) AS (…) (sejak 8.0)',
          postgresql: 'WITH RECURSIVE t(n) AS (…)',
          oracle: 'WITH t(n) AS (…)  (tanpa RECURSIVE)',
        },
        note: 'Oracle juga punya sintaks hierarki lamanya sendiri: `START WITH … CONNECT BY PRIOR …`.',
      },
      {
        label: 'Batas jumlah putaran',
        syntax: {
          sqlite: 'tidak ada batas bawaan — andalkan WHERE/LIMIT',
          sqlServer: 'default 100; OPTION (MAXRECURSION n)',
          mysql: 'cte_max_recursion_depth (default 1000)',
          postgresql: 'tidak ada batas bawaan — andalkan WHERE/LIMIT',
          oracle: 'mendeteksi siklus; klausa CYCLE … SET',
        },
      },
      {
        label: 'Tambah 1 hari',
        syntax: {
          sqlite: "date(d, '+1 day')",
          sqlServer: 'DATEADD(day, 1, d)',
          mysql: 'DATE_ADD(d, INTERVAL 1 DAY)',
          postgresql: "d + INTERVAL '1 day'",
          oracle: 'd + 1',
        },
      },
      {
        label: 'Deret angka 1–10 tanpa rekursi',
        syntax: {
          sqlite: 'pakai WITH RECURSIVE',
          sqlServer: 'GENERATE_SERIES(1, 10) (sejak 2022)',
          mysql: 'pakai WITH RECURSIVE',
          postgresql: 'generate_series(1, 10)',
          oracle: 'SELECT LEVEL FROM dual CONNECT BY LEVEL <= 10',
        },
      },
    ],
  },
];
