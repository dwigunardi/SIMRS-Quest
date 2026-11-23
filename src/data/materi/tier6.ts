/**
 * Materi untuk konsep yang diperkenalkan di Tier 6 (DML & transaksi).
 * Contoh yang mengubah data memakai `run: 'playground'` (dibuka di Playground, bisa di-Reset Database),
 * dan sengaja menyentuh baris/tabel yang berbeda dari soal misi agar tidak membocorkan jawaban.
 */
import type { Article } from '../../types';

export const ARTICLES_TIER6: Article[] = [
  {
    id: 'insert',
    title: 'INSERT: Menambah Baris',
    summary: 'INSERT INTO … (kolom) VALUES (…) menambah baris baru; database menolaknya bila melanggar aturan tabel (NOT NULL, UNIQUE, CHECK, FOREIGN KEY).',
    tier: 6,
    missions: ['t6-insert'],
    sections: [
      {
        heading: 'Bentuk dasar: sebut kolomnya',
        body: `\`INSERT INTO tabel (kolom1, kolom2, …) VALUES (nilai1, nilai2, …);\` menambah **satu baris**. Nilai dipasangkan dengan kolom **berdasarkan urutan**: nilai pertama ke kolom pertama yang disebut, dan seterusnya.

- **Selalu tulis daftar kolom.** \`INSERT INTO tabel VALUES (…)\` tanpa daftar kolom memang boleh, tetapi bergantung pada urutan kolom di tabel — query bisa rusak diam-diam saat struktur tabel berubah.
- Teks dan tanggal ditulis dengan kutip tunggal (\`'Gedung C'\`, \`'2026-12-01'\`); angka tanpa kutip.
- Kolom yang tidak disebut diisi nilai default-nya (biasanya NULL). Jika kolom itu \`NOT NULL\` tanpa default, INSERT ditolak.
- Beberapa baris sekaligus: \`VALUES (…), (…), (…);\` — satu statement, lebih cepat dan lebih rapi daripada banyak INSERT.

Kebiasaan baik: **lihat dulu isi tabel** dengan SELECT untuk memastikan kunci yang akan dipakai belum ada.`,
        examples: [
          {
            title: 'Cek dulu: id poliklinik yang sudah terpakai',
            sql: `SELECT id_poli, nama_poli, gedung
FROM poliklinik
ORDER BY id_poli;`,
            note: 'Ada 7 poliklinik, P01 sampai P07 — jadi poliklinik baru bisa memakai `P08`.',
          },
          {
            title: 'Menambah dua poliklinik baru sekaligus',
            sql: `INSERT INTO poliklinik (id_poli, nama_poli, gedung)
VALUES
  ('P08', 'Poli Mata', 'Gedung C'),
  ('P09', 'Poli THT',  'Gedung B');

SELECT * FROM poliklinik WHERE id_poli IN ('P08', 'P09');`,
            run: 'playground',
            note: 'Jalankan di Playground. Menjalankannya dua kali akan gagal (`UNIQUE constraint failed`) karena `id_poli` adalah PRIMARY KEY — klik **Reset Database** untuk mengulang.',
          },
        ],
      },
      {
        heading: 'Aturan tabel & INSERT … SELECT',
        body: `Database menjaga kualitas data lewat **constraint** yang didefinisikan saat tabel dibuat. INSERT yang melanggarnya ditolak seluruhnya:

- \`NOT NULL\` — kolom wajib diisi.
- \`PRIMARY KEY\` / \`UNIQUE\` — nilai tidak boleh kembar (mis. dua pasien dengan NIK sama).
- \`CHECK\` — nilai harus memenuhi syarat, mis. \`jenis_kelamin IN ('L', 'P')\`. Perbandingannya peka huruf besar/kecil: \`'l'\` ditolak.
- \`FOREIGN KEY\` — nilai harus ada di tabel induk, mis. \`id_poli\` dokter harus ada di \`poliklinik\`. Di SQLite pengecekan ini hanya aktif dengan \`PRAGMA foreign_keys = ON\` — aplikasi ini menyalakannya.

Struktur dan aturan tabel bisa dilihat di Schema Explorer, atau lewat \`pragma_table_info\`.

Selain dari VALUES, baris baru bisa diambil dari **hasil SELECT**: \`INSERT INTO tujuan (kolom…) SELECT … FROM sumber …;\`. Cocok untuk mengisi tabel rekap atau arsip. Jumlah dan urutan kolom SELECT harus sama dengan daftar kolom tujuan.`,
        examples: [
          {
            title: 'Kolom mana yang wajib diisi di tabel dokter?',
            sql: `SELECT name AS kolom, type AS tipe, "notnull" AS wajib_isi, pk AS primary_key
FROM pragma_table_info('dokter');`,
            note: '`nama_dokter`, `spesialisasi`, dan `id_poli` bernilai `wajib_isi = 1` (NOT NULL). `id_dokter` adalah PRIMARY KEY (`primary_key = 1`), jadi harus unik. Perhatikan `wajib_isi = 0` untuk `id_dokter`: karena kekhususan lama SQLite, PRIMARY KEY bertipe TEXT masih menerima NULL kecuali ditulis `NOT NULL` — di DBMS lain PRIMARY KEY selalu NOT NULL.',
          },
          {
            title: 'INSERT … SELECT: mengisi tabel rekap kunjungan per poli',
            sql: `CREATE TABLE IF NOT EXISTS rekap_poli (
  id_poli          TEXT PRIMARY KEY,
  jumlah_kunjungan INTEGER NOT NULL
);
DELETE FROM rekap_poli;

INSERT INTO rekap_poli (id_poli, jumlah_kunjungan)
SELECT id_poli, COUNT(*)
FROM kunjungan
GROUP BY id_poli;

SELECT * FROM rekap_poli ORDER BY id_poli;`,
            run: 'playground',
            note: 'Satu INSERT menambah 7 baris sekaligus — satu per poliklinik yang punya kunjungan (P01 = 7 kunjungan, P07 = 1).',
          },
        ],
      },
    ],
    pitfalls: [
      'Menulis `INSERT INTO tabel VALUES (…)` tanpa daftar kolom, lalu nilai masuk ke kolom yang salah setelah struktur tabel berubah.',
      'Jumlah nilai di VALUES tidak sama dengan jumlah kolom yang disebut → error "N values for M columns".',
      'Menulis angka berawalan nol (NIK, nomor telepon) tanpa kutip — `0812…` menjadi angka dan nol di depannya hilang. Simpan sebagai TEXT.',
      'Mengira nilai CHECK tidak peka huruf: `penjamin = \'bpjs\'` ditolak jika aturannya `IN (\'BPJS\', …)`.',
    ],
    dialects: [
      {
        label: 'Banyak baris dalam satu INSERT',
        syntax: {
          sqlite: 'VALUES (…), (…)',
          sqlServer: 'VALUES (…), (…)  -- maks. 1000 baris',
          mysql: 'VALUES (…), (…)',
          postgresql: 'VALUES (…), (…)',
          oracle: 'VALUES (…), (…) sejak 23ai; sebelumnya INSERT ALL … SELECT 1 FROM dual',
        },
      },
      {
        label: 'Mengambil baris yang baru dibuat',
        syntax: {
          sqlite: 'INSERT … RETURNING *  (3.35+)',
          sqlServer: 'INSERT … OUTPUT inserted.* VALUES …',
          mysql: 'tidak ada RETURNING; SELECT LAST_INSERT_ID()  (MariaDB 10.5+: RETURNING)',
          postgresql: 'INSERT … RETURNING *',
          oracle: 'INSERT … RETURNING kolom INTO :var  (PL/SQL)',
        },
      },
      {
        label: 'Upsert (sisipkan, atau ubah jika sudah ada)',
        syntax: {
          sqlite: 'INSERT … ON CONFLICT (kolom) DO UPDATE SET …',
          sqlServer: 'MERGE INTO … USING … WHEN MATCHED …',
          mysql: 'INSERT … ON DUPLICATE KEY UPDATE …',
          postgresql: 'INSERT … ON CONFLICT (kolom) DO UPDATE SET …',
          oracle: 'MERGE INTO … USING … WHEN MATCHED …',
        },
      },
      {
        label: 'Kolom nomor otomatis',
        syntax: {
          sqlite: 'id INTEGER PRIMARY KEY',
          sqlServer: 'id INT IDENTITY(1,1)',
          mysql: 'id INT AUTO_INCREMENT PRIMARY KEY',
          postgresql: 'id INT GENERATED ALWAYS AS IDENTITY  (atau SERIAL)',
          oracle: 'id NUMBER GENERATED AS IDENTITY  (12c+)',
        },
      },
    ],
  },
  {
    id: 'update-delete',
    title: 'UPDATE & DELETE: Mengubah dan Menghapus',
    summary: 'UPDATE … SET … WHERE mengubah baris, DELETE … WHERE menghapusnya — WHERE menentukan baris mana yang kena, jadi selalu cek dulu dengan SELECT.',
    tier: 6,
    missions: ['t6-update', 't6-delete'],
    sections: [
      {
        heading: 'UPDATE: WHERE adalah rem',
        body: `\`UPDATE tabel SET kolom = nilai_baru WHERE syarat;\` mengubah **setiap baris yang memenuhi syarat**.

- **Tanpa WHERE, SEMUA baris berubah.** Ini kesalahan paling mahal di dunia SIMRS: satu UPDATE tanpa WHERE bisa membuat seluruh tagihan berstatus lunas.
- Beberapa kolom sekaligus: \`SET kolom1 = …, kolom2 = …\`.
- Nilai baru boleh berupa ekspresi dari nilai lama: \`SET total_biaya = total_biaya + 50000\`.
- Paling aman, saring dengan **primary key** (\`WHERE id_poli = 'P06'\`) — dijamin paling banyak satu baris (0 jika kuncinya tidak ada).

Kebiasaan profesional: **tulis dulu sebagai SELECT** dengan WHERE yang sama. Jika hasilnya tepat baris yang dimaksud, baru ganti \`SELECT … FROM\` menjadi \`UPDATE … SET\`. Setelah UPDATE, \`SELECT changes()\` di SQLite menampilkan jumlah baris yang benar-benar berubah.`,
        examples: [
          {
            title: 'Pratinjau: poliklinik di Gedung C',
            sql: `SELECT id_poli, nama_poli, gedung
FROM poliklinik
WHERE gedung = 'Gedung C';`,
            note: 'Ada 2 poliklinik di Gedung C (Jantung dan Saraf). Jika yang pindah hanya Poli Saraf, `WHERE gedung = \'Gedung C\'` terlalu luas — pakai `id_poli`.',
          },
          {
            title: 'Poli Saraf pindah ke Gedung D',
            sql: `UPDATE poliklinik
SET gedung = 'Gedung D'
WHERE id_poli = 'P06';

SELECT changes() AS baris_berubah;`,
            run: 'playground',
            note: '`baris_berubah` = 1. Coba hapus baris `WHERE` lalu jalankan lagi: ketujuh poliklinik pindah ke Gedung D (lalu Reset Database).',
          },
        ],
      },
      {
        heading: 'DELETE dan foreign key',
        body: `\`DELETE FROM tabel WHERE syarat;\` menghapus **seluruh baris** yang memenuhi syarat (bukan kolom tertentu — untuk mengosongkan kolom pakai \`UPDATE … SET kolom = NULL\`).

- Sama seperti UPDATE: **tanpa WHERE, semua baris terhapus**, dan perintah ini tidak bisa di-"undo" kecuali berada di dalam transaksi.
- Syarat yang terlalu umum sering menghapus lebih banyak dari yang dimaksud. Gabungkan beberapa syarat dengan AND, atau pakai primary key.
- **Foreign key melindungi data anak.** Baris induk yang masih dirujuk tabel lain tidak bisa dihapus: pasien yang punya kunjungan ditolak dengan \`FOREIGN KEY constraint failed\`. Hapus/ubah data anaknya dulu, atau pertimbangkan apakah data itu memang boleh dihapus (di rumah sakit, rekam medis biasanya tidak pernah dihapus, hanya ditandai).`,
        examples: [
          {
            title: 'Pasien mana yang masih dirujuk tabel kunjungan?',
            sql: `SELECT p.no_rm, p.nama, COUNT(k.no_rawat) AS jumlah_kunjungan
FROM pasien AS p
LEFT JOIN kunjungan AS k ON k.no_rm = p.no_rm
WHERE p.kota = 'Surabaya'
GROUP BY p.no_rm, p.nama;`,
            note: 'Kedua pasien Surabaya punya kunjungan (1 dan 2), jadi `DELETE FROM pasien WHERE no_rm = \'RM-0008\'` akan ditolak foreign key.',
          },
          {
            title: 'Menghapus satu diagnosa sekunder lewat primary key',
            sql: `-- Pratinjau dulu dengan syarat yang sama
SELECT id_diagnosa, no_rawat, kode_icd10, jenis
FROM diagnosa
WHERE id_diagnosa = 31;

DELETE FROM diagnosa
WHERE id_diagnosa = 31;

SELECT changes() AS baris_terhapus;`,
            run: 'playground',
            note: 'Diagnosa E78.5 (hiperlipidemia) ada di 2 kunjungan; memakai `id_diagnosa` memastikan hanya satu baris yang terhapus.',
          },
        ],
      },
    ],
    pitfalls: [
      'UPDATE atau DELETE tanpa WHERE — mengubah/menghapus seluruh tabel.',
      'Langsung menjalankan UPDATE/DELETE tanpa pratinjau SELECT dengan WHERE yang sama.',
      'Menyaring dengan kolom yang tidak unik (nama, kota, kode penyakit) padahal yang dimaksud satu baris tertentu.',
      'Memakai `DELETE` untuk mengosongkan satu kolom — yang benar `UPDATE … SET kolom = NULL`.',
    ],
    dialects: [
      {
        label: 'UPDATE memakai data tabel lain',
        syntax: {
          sqlite: 'UPDATE t SET … FROM u WHERE t.id = u.id  (3.33+)',
          sqlServer: 'UPDATE t SET … FROM t JOIN u ON …',
          mysql: 'UPDATE t JOIN u ON … SET …',
          postgresql: 'UPDATE t SET … FROM u WHERE t.id = u.id',
          oracle: 'MERGE INTO t USING u ON (…) WHEN MATCHED THEN UPDATE …',
        },
      },
      {
        label: 'Jumlah baris yang terdampak',
        syntax: {
          sqlite: 'SELECT changes()',
          sqlServer: 'SELECT @@ROWCOUNT',
          mysql: 'SELECT ROW_COUNT()',
          postgresql: 'GET DIAGNOSTICS n = ROW_COUNT  (PL/pgSQL)',
          oracle: 'SQL%ROWCOUNT  (PL/SQL)',
        },
      },
      {
        label: 'Mengosongkan seluruh tabel',
        syntax: {
          sqlite: 'DELETE FROM t  (tidak ada TRUNCATE)',
          sqlServer: 'TRUNCATE TABLE t',
          mysql: 'TRUNCATE TABLE t',
          postgresql: 'TRUNCATE t',
          oracle: 'TRUNCATE TABLE t',
        },
        note: 'Di MySQL dan Oracle, TRUNCATE adalah DDL yang langsung COMMIT — tidak bisa di-ROLLBACK. Di PostgreSQL dan SQL Server, TRUNCATE di dalam transaksi masih bisa dibatalkan.',
      },
      {
        label: 'Foreign key ditegakkan',
        syntax: {
          sqlite: 'hanya jika PRAGMA foreign_keys = ON (aplikasi ini: ON)',
          sqlServer: 'selalu',
          mysql: 'selalu di InnoDB (MyISAM mengabaikan)',
          postgresql: 'selalu',
          oracle: 'selalu',
        },
      },
    ],
  },
  {
    id: 'transaksi',
    title: 'Transaksi: BEGIN, COMMIT, ROLLBACK',
    summary: 'Transaksi mengikat beberapa perubahan menjadi satu kesatuan: semuanya tersimpan (COMMIT) atau semuanya dibatalkan (ROLLBACK).',
    tier: 6,
    missions: ['t6-transaction-commit', 't6-transaction-rollback'],
    sections: [
      {
        heading: 'Semua atau tidak sama sekali',
        body: `Banyak proses di rumah sakit terdiri dari beberapa perubahan yang **harus terjadi bersama**: memulangkan pasien rawat inap berarti mengubah status kunjungan **dan** status tagihannya. Kalau aplikasi mati di tengah jalan, data tidak boleh setengah jadi.

- \`BEGIN;\` — mulai transaksi. Perubahan sesudahnya belum permanen.
- \`COMMIT;\` — simpan semua perubahan sejak BEGIN secara permanen.
- \`ROLLBACK;\` — batalkan semua perubahan sejak BEGIN, seolah tidak pernah terjadi.

Tanpa BEGIN, database bekerja dalam mode **autocommit**: setiap statement langsung tersimpan begitu selesai, dan tidak bisa dibatalkan lagi.

**Jangan biarkan transaksi terbuka.** BEGIN tanpa COMMIT/ROLLBACK menahan perubahan di awang-awang (dan di server sungguhan, mengunci baris sehingga pengguna lain menunggu). Penilaian misi di aplikasi ini juga menganggap transaksi yang dibiarkan terbuka sebagai kesalahan.`,
        examples: [
          {
            title: 'Pratinjau: pasien yang sedang dirawat',
            sql: `SELECT k.no_rawat, k.status, b.total_biaya, b.status_bayar
FROM kunjungan AS k
JOIN billing AS b ON b.no_rawat = k.no_rawat
WHERE k.status = 'Dirawat'
ORDER BY k.no_rawat;`,
            note: 'Ada 3 pasien berstatus Dirawat, dan ketiga tagihannya masih Belum Lunas.',
          },
          {
            title: 'Pasien pulang: dua perubahan dalam satu transaksi',
            sql: `BEGIN;

UPDATE kunjungan
SET status = 'Selesai'
WHERE no_rawat = '2026/10/03/000001';

UPDATE billing
SET status_bayar = 'Lunas'
WHERE no_rawat = '2026/10/03/000001';

COMMIT;

SELECT k.no_rawat, k.status, b.status_bayar
FROM kunjungan AS k
JOIN billing AS b ON b.no_rawat = k.no_rawat
WHERE k.no_rawat = '2026/10/03/000001';`,
            run: 'playground',
            note: 'Kedua UPDATE baru permanen saat COMMIT. Jika salah satunya gagal, kamu bisa ROLLBACK dan tidak ada data yang setengah berubah.',
          },
        ],
      },
      {
        heading: 'ROLLBACK, error, dan savepoint',
        body: `ROLLBACK adalah "jaring pengaman": lakukan perubahan, periksa hasilnya dengan SELECT **di dalam transaksi yang sama**, lalu putuskan COMMIT atau ROLLBACK. Di dalam transaksi, SELECT sudah melihat perubahan yang belum di-COMMIT.

Apa yang terjadi jika satu statement **error** di tengah transaksi (mis. melanggar CHECK)? Di SQLite, hanya statement itu yang dibatalkan; perubahan sebelumnya tetap ada dan **transaksi masih terbuka** — kamu sendiri yang harus memilih ROLLBACK atau COMMIT. Perilaku ini berbeda di DBMS lain (lihat kotak dialek), jadi di aplikasi sungguhan, tangani error dengan ROLLBACK secara eksplisit.

**Savepoint** memberi titik kembali di tengah transaksi: \`SAVEPOINT sebelum_hapus;\` … \`ROLLBACK TO sebelum_hapus;\` membatalkan perubahan sejak titik itu saja, tanpa membatalkan seluruh transaksi.`,
        examples: [
          {
            title: 'Simulasi salah hapus, lalu ROLLBACK',
            sql: `BEGIN;

DELETE FROM diagnosa WHERE jenis = 'Sekunder';   -- terlalu luas!
SELECT COUNT(*) AS sekunder_tersisa FROM diagnosa WHERE jenis = 'Sekunder';

ROLLBACK;

SELECT COUNT(*) AS sekunder_setelah_rollback FROM diagnosa WHERE jenis = 'Sekunder';`,
            run: 'playground',
            note: 'Di dalam transaksi, diagnosa sekunder tersisa 0. Setelah ROLLBACK, ketujuh diagnosa sekunder kembali utuh.',
          },
        ],
      },
    ],
    pitfalls: [
      'Lupa COMMIT — perubahan tidak tersimpan, dan transaksi menggantung.',
      'Mengira ROLLBACK bisa membatalkan perubahan yang sudah di-COMMIT (atau yang dijalankan tanpa BEGIN/autocommit).',
      'Menjalankan beberapa perubahan yang saling bergantung tanpa transaksi, sehingga data bisa setengah berubah jika terjadi error.',
      'Mengira error di tengah transaksi otomatis membatalkan semuanya — di SQLite, MySQL, dan Oracle transaksi tetap terbuka.',
    ],
    dialects: [
      {
        label: 'Memulai transaksi',
        syntax: {
          sqlite: 'BEGIN;',
          sqlServer: 'BEGIN TRANSACTION;',
          mysql: 'START TRANSACTION;  (atau BEGIN;)',
          postgresql: 'BEGIN;  (atau START TRANSACTION;)',
          oracle: 'otomatis dimulai pada DML pertama; akhiri dengan COMMIT/ROLLBACK',
        },
        note: 'Di luar transaksi, SQLite, SQL Server, MySQL (autocommit=1), dan PostgreSQL bekerja autocommit. Di Oracle, alat seperti SQL*Plus default AUTOCOMMIT OFF, jadi COMMIT harus eksplisit.',
      },
      {
        label: 'Statement error di tengah transaksi',
        syntax: {
          sqlite: 'statement itu dibatalkan, transaksi tetap terbuka',
          sqlServer: 'bergantung SET XACT_ABORT (OFF: umumnya hanya statement itu)',
          mysql: 'statement itu dibatalkan, transaksi tetap terbuka (InnoDB)',
          postgresql: 'seluruh transaksi gagal; wajib ROLLBACK',
          oracle: 'statement itu dibatalkan, transaksi tetap terbuka',
        },
      },
      {
        label: 'Savepoint',
        syntax: {
          sqlite: 'SAVEPOINT a; … ROLLBACK TO a;',
          sqlServer: 'SAVE TRANSACTION a; … ROLLBACK TRANSACTION a;',
          mysql: 'SAVEPOINT a; … ROLLBACK TO a;',
          postgresql: 'SAVEPOINT a; … ROLLBACK TO a;',
          oracle: 'SAVEPOINT a; … ROLLBACK TO a;',
        },
      },
      {
        label: 'CREATE/DROP di dalam transaksi',
        syntax: {
          sqlite: 'ikut transaksi (bisa di-ROLLBACK)',
          sqlServer: 'ikut transaksi (bisa di-ROLLBACK)',
          mysql: 'DDL otomatis COMMIT',
          postgresql: 'ikut transaksi (bisa di-ROLLBACK)',
          oracle: 'DDL otomatis COMMIT',
        },
      },
    ],
  },
];
