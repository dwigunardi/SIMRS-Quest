/**
 * Materi untuk konsep yang diperkenalkan di Tier 7: index, query sargable, dan SQL injection.
 */
import type { Article } from '../../types';

export const ARTICLES_TIER7: Article[] = [
  {
    id: 'index',
    title: 'Index & EXPLAIN QUERY PLAN',
    summary: 'Index adalah "daftar isi" terurut yang membuat database bisa melompat langsung ke baris yang dicari, bukan membaca seluruh tabel.',
    tier: 7,
    missions: ['t7-index', 't7-sargable'],
    sections: [
      {
        heading: 'SCAN vs SEARCH',
        body: `Tanpa index, mencari \`WHERE no_rm = 'RM-0001'\` berarti membaca **setiap** baris tabel lalu memeriksanya satu per satu: **full table scan**. Index adalah struktur B-tree yang menyimpan nilai kolom dalam keadaan terurut beserta letak barisnya — persis seperti indeks di belakang buku. Database cukup menelusuri pohon itu untuk langsung melompat ke baris yang cocok.

Cara melihat apakah index dipakai: awali query dengan \`EXPLAIN QUERY PLAN\`. Query **tidak dijalankan**; SQLite hanya menunjukkan rencananya:

- \`SCAN tabel\` → seluruh tabel dibaca (lambat pada tabel besar)
- \`SEARCH tabel USING INDEX nama (kolom=?)\` → melompat lewat index
- \`USING COVERING INDEX\` → semua kolom yang dibutuhkan ada di index, tabelnya bahkan tidak perlu dibuka
- \`USING INTEGER PRIMARY KEY (rowid=?)\` → mencari lewat kunci utama bertipe INTEGER

Pada 32 kunjungan perbedaannya tak terasa, tetapi pada jutaan baris SCAN bisa butuh detik sementara SEARCH hanya milidetik.`,
        examples: [
          {
            title: 'Kolom ber-index → SEARCH',
            sql: `EXPLAIN QUERY PLAN
SELECT no_rawat, tgl_kunjungan, status
FROM kunjungan
WHERE no_rm = 'RM-0001';`,
            note: 'Kolom `detail`: **SEARCH kunjungan USING INDEX idx_kunjungan_no_rm (no_rm=?)**. Index `idx_kunjungan_no_rm` sudah dibuat di skema, jadi SQLite langsung melompat ke 3 kunjungan milik RM-0001.',
          },
          {
            title: 'Kolom tanpa index → SCAN',
            sql: `EXPLAIN QUERY PLAN
SELECT no_rawat, total_biaya
FROM billing
WHERE status_bayar = 'Belum Lunas';`,
            note: 'Hasilnya **SCAN billing**: belum ada index pada `status_bayar`, sehingga ke-28 tagihan dibaca semua untuk menemukan 5 yang belum lunas.',
          },
        ],
      },
      {
        heading: 'Membuat index, index gabungan, dan biayanya',
        body: `Sintaksnya: \`CREATE INDEX nama_index ON tabel (kolom);\`. Konvensi nama yang umum: \`idx_<tabel>_<kolom>\`. Index bisa dihapus lagi dengan \`DROP INDEX nama_index;\`.

**Index gabungan** (beberapa kolom) diurutkan berdasarkan kolom pertama, lalu kolom kedua, dan seterusnya — seperti buku telepon yang diurutkan per nama belakang lalu nama depan. Akibatnya berlaku **aturan prefiks kiri**: index \`(status_bayar, total_biaya)\` membantu filter \`status_bayar = …\` saja, atau \`status_bayar = … AND total_biaya > …\`, tetapi **tidak** membantu filter yang hanya memakai \`total_biaya\`. Taruh kolom yang difilter dengan \`=\` di depan, kolom rentang (\`>\`, \`<\`, \`BETWEEN\`) di belakang.

Index tidak gratis:
- Setiap INSERT/UPDATE/DELETE juga harus memperbarui semua index tabel itu → penulisan lebih lambat.
- Index memakan ruang disk.
- Tidak berguna untuk tabel kecil, atau kolom yang nilainya hampir sama semua (mis. kolom dengan 2 nilai pada jutaan baris) — membaca tabel langsung sering lebih murah.

Buat index untuk kolom yang **sering** dipakai di \`WHERE\`, \`JOIN … ON\`, atau \`ORDER BY\` pada tabel besar.`,
        examples: [
          {
            title: 'Index gabungan & aturan prefiks kiri',
            run: 'playground',
            sql: `CREATE INDEX idx_billing_status_biaya ON billing (status_bayar, total_biaya);

-- Memakai kolom pertama (status_bayar) → index terpakai
EXPLAIN QUERY PLAN
SELECT no_rawat FROM billing
WHERE status_bayar = 'Lunas' AND total_biaya > 1000000;

-- Hanya kolom kedua → index TIDAK terpakai
EXPLAIN QUERY PLAN
SELECT no_rawat FROM billing
WHERE total_biaya > 1000000;`,
            note: 'Plan pertama: **SEARCH billing USING INDEX idx_billing_status_biaya (status_bayar=? AND total_biaya>?)**. Plan kedua tetap **SCAN billing**, karena index itu terurut per `status_bayar` lebih dulu. Hapus lagi dengan `DROP INDEX idx_billing_status_biaya;` atau Reset Database.',
          },
        ],
      },
    ],
    pitfalls: [
      'Membuat index di semua kolom "biar cepat" — setiap index memperlambat INSERT/UPDATE/DELETE dan memakan ruang.',
      'Mengira index gabungan `(a, b)` juga membantu filter yang hanya memakai kolom `b` — aturan prefiks kiri.',
      'Menilai kecepatan dari tabel kecil di laptop; selalu cek `EXPLAIN QUERY PLAN` dan uji dengan volume data mendekati produksi.',
      'Index ada, tetapi kolomnya dibungkus fungsi di WHERE sehingga index tidak terpakai (lihat materi Query Sargable).',
    ],
    dialects: [
      {
        label: 'Melihat rencana eksekusi',
        syntax: {
          sqlite: 'EXPLAIN QUERY PLAN SELECT …',
          sqlServer: 'SET SHOWPLAN_TEXT ON; / "Include Actual Execution Plan" di SSMS',
          mysql: 'EXPLAIN SELECT … / EXPLAIN ANALYZE (8.0.18+)',
          postgresql: 'EXPLAIN SELECT … / EXPLAIN ANALYZE SELECT …',
          oracle: 'EXPLAIN PLAN FOR SELECT …; SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);',
        },
        note: 'Varian ANALYZE benar-benar menjalankan query dan menampilkan waktu nyata — hati-hati memakainya pada UPDATE/DELETE.',
      },
      {
        label: 'Kolom tambahan di index (covering)',
        syntax: {
          sqlite: 'tambahkan sebagai kolom index: (a, b)',
          sqlServer: 'CREATE INDEX i ON t (a) INCLUDE (b)',
          mysql: 'tambahkan sebagai kolom index: (a, b)',
          postgresql: 'CREATE INDEX i ON t (a) INCLUDE (b)  -- 11+',
          oracle: 'tambahkan sebagai kolom index: (a, b)',
        },
      },
    ],
  },
  {
    id: 'sargable',
    title: 'Query Sargable',
    summary: 'Index hanya terpakai bila kolomnya dibiarkan polos di WHERE — bungkus kolom dengan fungsi, dan index berubah jadi pajangan.',
    tier: 7,
    missions: ['t7-sargable'],
    sections: [
      {
        heading: 'Kolom yang dibungkus fungsi mematikan index',
        body: `**Sargable** = *Search ARGument ABLE*: filter yang bisa dijawab dengan menelusuri index. Index menyimpan nilai **asli** kolom dalam keadaan terurut. Begitu kolom dibungkus ekspresi — \`UPPER(kolom)\`, \`substr(kolom, …)\`, \`strftime(…, kolom)\`, \`kolom + 0\`, \`kolom * 1.1\` — database harus menghitung ekspresi itu untuk **setiap** baris dulu, baru bisa membandingkan. Urutan index tidak bisa dipakai, jadi hasilnya kembali ke SCAN.

Prinsip perbaikannya: **biarkan kolom polos, olah nilainya**. Ubah kondisi menjadi perbandingan langsung (\`=\`, \`>=\`, \`<\`) pada kolom asli. Untuk teks dan tanggal berformat ISO (\`YYYY-MM-DD\`), "semua yang diawali X" bisa ditulis sebagai **rentang**: batas bawah inklusif, batas atas eksklusif.`,
        examples: [
          {
            title: 'Fungsi di kolom → SCAN',
            sql: `EXPLAIN QUERY PLAN
SELECT no_rawat FROM kunjungan
WHERE UPPER(no_rm) = 'RM-0001';`,
            note: 'Walaupun `no_rm` punya index, plan-nya **SCAN kunjungan**: SQLite harus menghitung `UPPER()` di setiap baris. Bandingkan dengan contoh di materi Index yang memakai `no_rm = …` polos (SEARCH).',
          },
          {
            title: 'Pola awalan ditulis sebagai rentang → SEARCH',
            sql: `EXPLAIN QUERY PLAN
SELECT no_rawat, no_rm FROM kunjungan
WHERE no_rm >= 'RM-001' AND no_rm < 'RM-002';`,
            note: 'Plan: **SEARCH kunjungan USING INDEX idx_kunjungan_no_rm (no_rm>? AND no_rm<?)**. Rentang ini sama dengan "semua no_rm yang diawali RM-001" (RM-0010 s.d. RM-0019): 12 kunjungan. Versi `no_rm LIKE \'RM-001%\'` justru SCAN di SQLite.',
          },
          {
            title: 'Aritmetika di kolom juga mematikan index',
            sql: `EXPLAIN QUERY PLAN
SELECT * FROM billing
WHERE id_billing + 0 = 5;`,
            note: 'Hasilnya **SCAN billing**. Tulis `id_billing = 5` dan plan-nya menjadi **SEARCH billing USING INTEGER PRIMARY KEY (rowid=?)**. Aturannya sama untuk `total * 1.1 > x`: pindahkan hitungan ke sisi nilai (`total > x / 1.1`).',
          },
        ],
      },
      {
        heading: 'LIKE, OR, dan index ekspresi',
        body: `- **LIKE '%kata%'** (wildcard di depan) tidak bisa memakai index B-tree di DBMS mana pun — untuk pencarian teks bebas, pakai fitur *full-text search*.
- **LIKE 'awalan%'** bisa memakai index di banyak DBMS. Di SQLite ada syarat tambahan: karena LIKE di SQLite tidak peka huruf besar/kecil, index biasa (collation BINARY) tidak dipakai kecuali index-nya \`COLLATE NOCASE\` (\`PRAGMA case_sensitive_like = ON\` juga bisa, tetapi pragma ini sudah *deprecated*). Cara paling aman tetap rentang \`>=\` / \`<\`.
- Kalau ekspresinya memang selalu sama (mis. pencarian tanpa peduli huruf besar/kecil), buat **index ekspresi**: \`CREATE INDEX … ON pasien (lower(kota));\`. Index ini dipakai hanya jika WHERE menulis ekspresi yang **persis sama**.
- **Fungsi pada nilai** (bukan pada kolom) tidak masalah: \`WHERE tgl >= date('now', '-7 day')\` tetap sargable karena sisi kolomnya polos.`,
        examples: [
          {
            title: 'Index ekspresi untuk pencarian tanpa peduli kapital',
            run: 'playground',
            sql: `CREATE INDEX idx_pasien_kota_lower ON pasien (lower(kota));

EXPLAIN QUERY PLAN
SELECT nama, kota FROM pasien WHERE lower(kota) = 'depok';

SELECT nama, kota FROM pasien WHERE lower(kota) = 'depok';`,
            note: 'Plan: **SEARCH pasien USING INDEX idx_pasien_kota_lower (<expr>=?)** — ekspresi di WHERE sama persis dengan ekspresi index. Hasilnya 2 pasien dari Depok.',
          },
        ],
      },
    ],
    pitfalls: [
      'Membungkus kolom tanggal dengan `strftime()`/`substr()`/`date()` untuk menyaring per bulan — tulis sebagai rentang tanggal pada kolom polos.',
      'Memakai `LIKE \'%kata%\'` dan berharap index menolong.',
      'Membuat index ekspresi `lower(kota)` tetapi WHERE menulis `LOWER(TRIM(kota))` — ekspresinya harus identik.',
      'Mengira `col + 0 = 5` sama cepatnya dengan `col = 5`; hasilnya sama, plan-nya tidak.',
    ],
    dialects: [
      {
        label: 'Index ekspresi / fungsi',
        syntax: {
          sqlite: 'CREATE INDEX i ON pasien (lower(kota))  -- 3.9+',
          sqlServer: 'kolom terhitung + index: ALTER TABLE … ADD kota_l AS LOWER(kota); CREATE INDEX i ON pasien (kota_l)',
          mysql: 'CREATE INDEX i ON pasien ((LOWER(kota)))  -- 8.0.13+',
          postgresql: 'CREATE INDEX i ON pasien (lower(kota))',
          oracle: 'CREATE INDEX i ON pasien (LOWER(kota))',
        },
      },
      {
        label: 'Pencarian teks bebas (%kata%)',
        syntax: {
          sqlite: 'FTS5 (virtual table)',
          sqlServer: 'Full-Text Search: CONTAINS()',
          mysql: 'FULLTEXT index: MATCH … AGAINST',
          postgresql: 'tsvector + GIN, atau pg_trgm',
          oracle: 'Oracle Text: CONTAINS()',
        },
      },
    ],
  },
  {
    id: 'sql-injection',
    title: 'SQL Injection & Parameter Binding',
    summary: 'Menyambung input pengguna ke teks SQL membuat input itu bisa berubah menjadi kode; parameter binding memisahkan data dari kode.',
    tier: 7,
    missions: ['t7-injection-bypass', 't7-injection-union', 't7-prepared-statement'],
    sections: [
      {
        heading: 'Input yang berubah menjadi kode',
        body: `Bayangkan aplikasi membangun query dengan menyambung string: \`"SELECT nama_dokter FROM dokter WHERE id_dokter = '" + input + "'"\`. Selama input wajar (\`D001\`), semuanya beres. Tetapi input bisa memuat **tanda kutip**: kutip itu menutup string milik aplikasi lebih awal, dan sisa input dibaca database sebagai **perintah SQL**.

Keluarga serangan yang paling umum:
- **Tautologi / bypass**: menambahkan kondisi yang selalu benar (mis. \`OR 1=1\`) sehingga WHERE meloloskan semua baris — data semua orang bocor, atau pemeriksaan login terlewati.
- **UNION-based**: menempelkan \`UNION SELECT …\` untuk menampilkan isi tabel lain di halaman yang sama; syaratnya jumlah kolom kedua SELECT sama.
- **Komentar** (\`--\`, \`/* */\`): membuang sisa query milik aplikasi agar sintaksnya tetap valid.
- **Stacked queries**: menambahkan statement kedua setelah \`;\` (mis. \`DROP TABLE\`), bila driver mengizinkan banyak statement sekaligus.

Kolom **angka** bahkan lebih rawan: aplikasi biasanya menyambungnya tanpa kutip (\`"… WHERE id_billing = " + input\`), jadi penyerang tidak perlu menutup string apa pun. Contoh di bawah adalah SQL yang **terbentuk** setelah input berbahaya disambungkan ke query halaman "Detail Tagihan" seperti itu.`,
        examples: [
          {
            title: 'SQL hasil sambungan: input menjadi kode',
            sql: `SELECT no_rawat, total_biaya
FROM billing
WHERE id_billing = 1 OR 1=1`,
            note: 'Input pengguna: `1 OR 1=1` (kolom angka tidak memakai kutip, jadi tidak perlu menutup string). Yang seharusnya mengembalikan 1 tagihan malah mengembalikan **ke-28 tagihan**, karena `OR 1=1` selalu benar. Pada kolom teks, penyerang menambahkan kutip untuk menutup string milik aplikasi dan `--` untuk membuang sisanya (di MySQL, `--` wajib diikuti spasi).',
          },
          {
            title: 'Input yang sama diperlakukan sebagai DATA',
            sql: `SELECT COUNT(*) AS cocok
FROM billing
WHERE id_billing = '1 OR 1=1';`,
            note: 'Input yang sama, tetapi dikirim sebagai satu nilai utuh — seperti yang terjadi dengan parameter binding. Hasilnya **0**: tidak ada tagihan dengan ID `1 OR 1=1`, dan `OR` tidak pernah dibaca sebagai perintah. Binding melakukan ini secara otomatis, tanpa kamu perlu meng-escape apa pun sendiri.',
          },
        ],
      },
      {
        heading: 'Pertahanan: parameter binding dulu, lapisan lain kemudian',
        body: `**Prepared statement / parameterized query** adalah pertahanan utama. Struktur SQL dikirim dan dikompilasi lebih dulu dengan *placeholder* (\`?\`, \`$1\`, \`@p\`, \`:nama\`); nilai input dikirim terpisah sebagai **data** dan tidak pernah di-parse sebagai kode. Detail cara kerja dan contoh per bahasa ada di kartu konsep **Prepared Statement: Pertahanan Utama**.

Kenapa cara lain tidak cukup:
- **Escaping manual** mudah terlewat di satu tempat, dan aturannya berbeda per DBMS dan encoding.
- **Blacklist kata** (\`OR\`, \`UNION\`, \`--\`) selalu bisa diakali (huruf kapital acak, komentar di tengah kata, encoding lain) dan sering memblokir input sah (nama "Orlando").

Lapisan tambahan (*defense in depth*), bukan pengganti binding:
- **Least privilege**: akun database aplikasi loket tidak perlu hak baca tabel keuangan, apalagi \`DROP\`.
- **Whitelist** untuk bagian yang tidak bisa di-bind: nama tabel/kolom dan arah \`ORDER BY\` dipilih dari daftar yang diizinkan.
- **Validasi format** input (mis. No. RM harus berpola \`RM-0000\`) dan jangan tampilkan pesan error database mentah ke pengguna.`,
      },
    ],
    pitfalls: [
      'Merakit query dengan `+`, f-string, atau template literal yang berisi input pengguna — termasuk dari form "internal".',
      'Mengira input dari dropdown/hidden field aman; penyerang bisa mengirim request apa pun tanpa melewati UI.',
      'Mencoba mem-bind nama tabel atau kolom ke placeholder — tidak bisa; pakai whitelist.',
      'Mengandalkan blacklist kata kunci atau escaping manual sebagai pertahanan utama.',
    ],
    dialects: [
      {
        label: 'Placeholder parameter',
        syntax: {
          sqlite: "? atau ?1, :nama, @nama  — db.prepare('… WHERE no_rm = ?')",
          sqlServer: '@p  — WHERE no_rm = @no_rm (ADO.NET, sp_executesql)',
          mysql: '?  — PREPARE s FROM \'… WHERE no_rm = ?\' / driver JDBC, PDO',
          postgresql: '$1, $2  — WHERE no_rm = $1',
          oracle: ':nama  — WHERE no_rm = :no_rm',
        },
        note: 'Bentuk placeholder juga bergantung pada driver/bahasa: JDBC selalu memakai `?`, PDO menerima `?` atau `:nama`.',
      },
      {
        label: 'SQL dinamis yang aman di sisi server',
        syntax: {
          sqlite: 'tidak ada prosedur tersimpan; binding dilakukan di aplikasi',
          sqlServer: "EXEC sp_executesql N'… WHERE no_rm = @rm', N'@rm varchar(10)', @rm = @input",
          mysql: "PREPARE s FROM '… WHERE no_rm = ?'; EXECUTE s USING @rm;",
          postgresql: "EXECUTE format('SELECT … FROM %I WHERE no_rm = $1', tabel) USING rm;",
          oracle: "EXECUTE IMMEDIATE '… WHERE no_rm = :1' USING v_rm;",
        },
      },
    ],
  },
];
