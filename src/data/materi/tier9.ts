/**
 * Materi untuk konsep yang diperkenalkan di Tier 9 (Desain Tabel & DDL).
 * Contoh yang membuat/mengubah objek memakai `run: 'playground'` (bisa di-Reset Database) dan sengaja memakai tabel lain
 * daripada soal misi (stok_obat, poliklinik, v_kunjungan_bpjs, log_alamat), sehingga tidak bisa dipakai sebagai jawaban.
 */
import type { Article } from '../../types';

export const ARTICLES_TIER9: Article[] = [
  {
    id: 'create-table',
    title: 'CREATE TABLE & Constraint',
    summary: 'Merancang tabel beserta aturannya: tipe kolom, PRIMARY KEY, FOREIGN KEY, NOT NULL, UNIQUE, CHECK, dan DEFAULT — supaya data salah ditolak database, bukan dibersihkan belakangan.',
    tier: 9,
    missions: ['t9-create-table', 't9-fix-resep', 't9-normalisasi'],
    sections: [
      {
        heading: 'Kolom, tipe, dan aturan',
        body: `\`CREATE TABLE nama (kolom TIPE constraint…, …, constraint_tabel…);\` membuat tabel baru. Setiap aturan yang ditulis di sini dijaga database untuk SEMUA aplikasi yang menulis ke tabel itu:

- \`PRIMARY KEY\` — identitas baris, unik. \`INTEGER PRIMARY KEY\` di SQLite otomatis bernomor urut bila dikosongkan.
- \`NOT NULL\` — wajib diisi. \`DEFAULT nilai\` — nilai bawaan bila kolom tidak disebut di INSERT.
- \`UNIQUE\` — tidak boleh kembar; \`UNIQUE (a, b)\` berarti **kombinasi** a dan b yang tidak boleh kembar.
- \`CHECK (kondisi)\` — nilai harus memenuhi kondisi, mis. \`CHECK (stok >= 0)\`. Kondisi yang melibatkan dua kolom ditulis sebagai constraint tabel di akhir.
- \`REFERENCES induk (kolom)\` — FOREIGN KEY: nilainya harus ada di tabel induk, dan kolom induk itu harus PRIMARY KEY/UNIQUE.

**Tipe di SQLite berbeda dari DBMS lain.** SQLite memakai *afinitas*: tipe yang mengandung INT → INTEGER, CHAR/TEXT/CLOB → TEXT, REAL/FLOA/DOUB → REAL, selain itu (termasuk \`DATE\`, \`BOOLEAN\`, \`DECIMAL\`) → NUMERIC. Simpan tanggal sebagai TEXT berformat \`YYYY-MM-DD\` agar urutan teksnya sama dengan urutan waktu.`,
        examples: [
          {
            title: 'Struktur & aturan tabel kunjungan',
            sql: `SELECT name AS kolom, type AS tipe, "notnull" AS wajib_isi, dflt_value AS bawaan, pk
FROM pragma_table_info('kunjungan');`,
            note: '`pragma_table_info` membaca struktur tabel seperti tabel biasa. Kolom `pk` = posisi di PRIMARY KEY, `wajib_isi = 1` = NOT NULL.',
          },
          {
            title: 'FOREIGN KEY milik tabel kunjungan',
            sql: `SELECT "from" AS kolom, "table" AS tabel_induk, "to" AS kolom_induk
FROM pragma_foreign_key_list('kunjungan');`,
            note: 'Tiga relasi: ke pasien, poliklinik, dan dokter. Setiap kolom induk adalah PRIMARY KEY tabelnya — syarat agar FOREIGN KEY bisa dipakai.',
          },
          {
            title: 'Merancang tabel stok obat',
            sql: `CREATE TABLE stok_obat (
  kode_obat   TEXT    PRIMARY KEY,
  nama_obat   TEXT    NOT NULL UNIQUE,
  satuan      TEXT    NOT NULL DEFAULT 'tablet' CHECK (satuan IN ('tablet', 'kapsul', 'botol', 'ampul')),
  stok        INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
  stok_minimum INTEGER NOT NULL DEFAULT 10,
  CHECK (stok_minimum >= 0)
);

INSERT INTO stok_obat (kode_obat, nama_obat, stok) VALUES ('OB-001', 'Paracetamol 500 mg', 120);
INSERT INTO stok_obat (kode_obat, nama_obat, satuan, stok) VALUES ('OB-002', 'Sirup OBH', 'botol', 15);

SELECT * FROM stok_obat;`,
            run: 'playground',
            note: "Lalu coba `INSERT INTO stok_obat (kode_obat, nama_obat, stok) VALUES ('OB-003', 'Amoxicillin', -5);` — ditolak CHECK. Ganti satuan dengan `'sachet'` — juga ditolak. Klik **Reset Database** untuk mengulang.",
          },
        ],
      },
      {
        heading: 'Desain yang baik dimulai dari normalisasi',
        body: `Sebelum menulis CREATE TABLE, tentukan dulu **satu fakta disimpan di mana**. Data pasien di tabel pasien; tabel lain cukup menyimpan \`no_rm\` sebagai FOREIGN KEY. Kolom berisi daftar ("A, B, C") dipecah menjadi tabel tersendiri, satu baris per nilai.

Beberapa kebiasaan yang menyelamatkan:

- **Beri setiap aturan bisnis constraint-nya.** "Satu dokter satu jadwal per hari" → \`UNIQUE (id_dokter, hari)\`. Aturan yang hanya dijaga aplikasi pasti suatu saat dilanggar aplikasi lain, impor data, atau perbaikan manual.
- **FOREIGN KEY selalu merujuk kolom unik** di induk. Merujuk kolom yang bisa kembar membuat SQLite menolak setiap INSERT dengan "foreign key mismatch".
- **Uji constraint-nya**, bukan hanya data yang sah: coba INSERT yang seharusnya ditolak dan pastikan memang ditolak.`,
        examples: [
          {
            title: 'Melihat DDL asli sebuah tabel',
            sql: `SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'billing';`,
            note: '`sqlite_schema` menyimpan teks CREATE TABLE setiap objek. Perhatikan `UNIQUE` pada `no_rawat`: satu kunjungan hanya boleh punya satu tagihan.',
          },
        ],
      },
    ],
    pitfalls: [
      'Membuat FOREIGN KEY ke kolom induk yang tidak unik — setiap INSERT gagal dengan "foreign key mismatch".',
      'Menulis `CHECK (x >= 0)` padahal aturannya "lebih dari 0", atau lupa bahwa NULL lolos CHECK (kondisi bernilai NULL tidak dianggap pelanggaran) — tambahkan NOT NULL bila kolom wajib.',
      'Memakai tipe DATE/DATETIME di SQLite lalu kaget nilainya berafinitas NUMERIC; simpan tanggal sebagai TEXT ISO.',
      'Lupa bahwa FOREIGN KEY di SQLite baru ditegakkan dengan `PRAGMA foreign_keys = ON` (aplikasi ini menyalakannya; banyak aplikasi lain tidak).',
    ],
    dialects: [
      {
        label: 'Teks dengan batas panjang',
        syntax: {
          sqlite: 'TEXT  (panjang tidak dibatasi; VARCHAR(20) → afinitas TEXT, angka diabaikan)',
          sqlServer: 'NVARCHAR(20)',
          mysql: 'VARCHAR(20)',
          postgresql: 'VARCHAR(20) atau TEXT',
          oracle: 'VARCHAR2(20)',
        },
      },
      {
        label: 'Penegakan CHECK & FOREIGN KEY',
        syntax: {
          sqlite: 'CHECK selalu; FOREIGN KEY hanya dengan PRAGMA foreign_keys = ON',
          sqlServer: 'selalu ditegakkan',
          mysql: 'FOREIGN KEY (InnoDB) selalu; CHECK sejak 8.0.16 (sebelumnya diabaikan diam-diam)',
          postgresql: 'selalu ditegakkan',
          oracle: 'selalu ditegakkan',
        },
      },
      {
        label: 'Tipe ketat (tolak teks di kolom angka)',
        syntax: {
          sqlite: 'CREATE TABLE … ( … ) STRICT  (3.37+)',
          sqlServer: 'selalu ketat',
          mysql: 'ketat dengan sql_mode STRICT_TRANS_TABLES (bawaan 5.7+)',
          postgresql: 'selalu ketat',
          oracle: 'selalu ketat',
        },
      },
    ],
  },

  {
    id: 'alter-table',
    title: 'ALTER TABLE: Mengubah Tabel yang Sudah Berisi Data',
    summary: 'Menambah, mengganti nama, atau menghapus kolom tanpa membuat ulang tabel — dan aturan khusus untuk kolom NOT NULL baru.',
    tier: 9,
    missions: ['t9-alter-table'],
    sections: [
      {
        heading: 'Menambah kolom',
        body: `Tabel produksi tidak bisa dibuat ulang begitu saja — datanya sudah dipakai. \`ALTER TABLE tabel ADD COLUMN kolom TIPE constraint…;\` menambah kolom di **akhir** tabel, dan setiap baris lama langsung bernilai DEFAULT kolom itu (atau NULL bila tidak ada DEFAULT).

Karena itu kolom **NOT NULL** yang ditambahkan ke tabel berisi data **wajib punya DEFAULT** yang tidak NULL — kalau tidak, baris lama akan melanggar aturannya sendiri dan SQLite menolak: "Cannot add a NOT NULL column with default value NULL". Constraint CHECK dan REFERENCES boleh ikut ditulis.

Setelah kolom ada, isi nilai yang benar untuk baris lama dengan UPDATE biasa.`,
        examples: [
          {
            title: 'Nomor telepon poliklinik',
            sql: `ALTER TABLE poliklinik ADD COLUMN no_telepon TEXT;

UPDATE poliklinik SET no_telepon = '0251-830' || substr(id_poli, 2) WHERE gedung = 'Gedung A';

SELECT id_poli, nama_poli, gedung, no_telepon FROM poliklinik;`,
            run: 'playground',
            note: 'Poli di Gedung B dan C tetap NULL karena kolom ini tidak punya DEFAULT dan tidak NOT NULL. Jalankan dua kali → "duplicate column name"; klik **Reset Database**.',
          },
        ],
      },
      {
        heading: 'Mengganti nama, menghapus, dan batasan SQLite',
        body: `- \`ALTER TABLE t RENAME TO t_baru;\` — ganti nama tabel.
- \`ALTER TABLE t RENAME COLUMN a TO b;\` — ganti nama kolom (SQLite 3.25+); view dan trigger yang memakainya ikut diperbarui.
- \`ALTER TABLE t DROP COLUMN c;\` — hapus kolom (SQLite 3.35+), ditolak bila kolom itu PRIMARY KEY, UNIQUE, ber-index, atau dipakai FOREIGN KEY/CHECK/view.

SQLite **tidak bisa** mengubah tipe atau constraint kolom yang sudah ada. Caranya: buat tabel baru dengan struktur yang benar, salin datanya (\`INSERT INTO baru SELECT … FROM lama\`), hapus tabel lama, lalu ganti nama tabel baru — semuanya di dalam satu transaksi.`,
        examples: [
          {
            title: 'Kolom apa saja yang dimiliki poliklinik sekarang?',
            sql: `SELECT cid, name AS kolom, type AS tipe FROM pragma_table_info('poliklinik');`,
            note: 'Di database awal ada 3 kolom. Setelah contoh ADD COLUMN di atas dijalankan di Playground, kolom ke-4 muncul di urutan terakhir.',
          },
        ],
      },
    ],
    pitfalls: [
      'Menambah kolom NOT NULL tanpa DEFAULT ke tabel berisi data → ditolak.',
      'Mengira ALTER TABLE ADD COLUMN bisa menyisipkan kolom di tengah — di SQLite (dan PostgreSQL) selalu di akhir.',
      'Membuat ulang tabel (DROP + CREATE) di produksi untuk menambah kolom — data, index, trigger, dan relasinya ikut hilang.',
      'Lupa mengisi nilai yang benar untuk baris lama setelah kolom baru ditambahkan.',
    ],
    dialects: [
      {
        label: 'Menambah kolom',
        syntax: {
          sqlite: 'ALTER TABLE t ADD COLUMN c TEXT',
          sqlServer: 'ALTER TABLE t ADD c NVARCHAR(20)  -- tanpa kata COLUMN',
          mysql: 'ALTER TABLE t ADD COLUMN c VARCHAR(20) [AFTER kolom]',
          postgresql: 'ALTER TABLE t ADD COLUMN c TEXT',
          oracle: 'ALTER TABLE t ADD (c VARCHAR2(20))',
        },
      },
      {
        label: 'Mengubah tipe kolom',
        syntax: {
          sqlite: 'tidak bisa: buat tabel baru, salin data, DROP, RENAME',
          sqlServer: 'ALTER TABLE t ALTER COLUMN c NVARCHAR(50)',
          mysql: 'ALTER TABLE t MODIFY COLUMN c VARCHAR(50)',
          postgresql: 'ALTER TABLE t ALTER COLUMN c TYPE VARCHAR(50)',
          oracle: 'ALTER TABLE t MODIFY (c VARCHAR2(50))',
        },
      },
      {
        label: 'Mengganti nama kolom',
        syntax: {
          sqlite: 'ALTER TABLE t RENAME COLUMN a TO b  (3.25+)',
          sqlServer: "EXEC sp_rename 't.a', 'b', 'COLUMN'",
          mysql: 'ALTER TABLE t RENAME COLUMN a TO b  (8.0+)',
          postgresql: 'ALTER TABLE t RENAME COLUMN a TO b',
          oracle: 'ALTER TABLE t RENAME COLUMN a TO b',
        },
      },
    ],
  },

  {
    id: 'upsert',
    title: 'UPSERT: Sisipkan atau Perbarui',
    summary: 'INSERT … ON CONFLICT … DO UPDATE / DO NOTHING: satu statement yang menyisipkan baris baru atau memperbarui baris yang sudah ada — dan kenapa INSERT OR REPLACE berbahaya.',
    tier: 9,
    missions: ['t9-upsert'],
    sections: [
      {
        heading: 'ON CONFLICT dan baris excluded',
        body: `Sinkronisasi data dari sistem lain sering berisi campuran baris baru dan baris yang sudah ada. Daripada memeriksa satu per satu, pakai UPSERT:

\`INSERT INTO t (…) VALUES (…), (…) ON CONFLICT (kolom_unik) DO UPDATE SET kolom = excluded.kolom;\`

- \`ON CONFLICT (kolom_unik)\` — bentrok pada PRIMARY KEY/UNIQUE mana yang ditangani.
- \`excluded\` — baris kiriman yang **gagal** disisipkan; nama kolom tanpa awalan merujuk ke nilai **lama** di tabel. Jadi \`stok = stok + excluded.stok\` menambahkan jumlah kiriman ke stok yang ada.
- Kolom yang tidak disebut di SET **tidak berubah**. Inilah kelebihannya dibanding REPLACE.
- \`DO NOTHING\` — abaikan baris yang bentrok, sisipkan sisanya.

Tambahan \`WHERE\` setelah SET membatasi kapan UPDATE terjadi, mis. hanya bila data kiriman lebih baru.`,
        examples: [
          {
            title: 'Penerimaan obat: stok bertambah, obat baru tercatat',
            sql: `CREATE TABLE IF NOT EXISTS stok_gudang (
  kode_obat TEXT PRIMARY KEY,
  nama_obat TEXT NOT NULL,
  stok      INTEGER NOT NULL CHECK (stok >= 0)
);
INSERT OR IGNORE INTO stok_gudang VALUES ('OB-001', 'Paracetamol 500 mg', 100), ('OB-002', 'Amoxicillin 500 mg', 40);

INSERT INTO stok_gudang (kode_obat, nama_obat, stok)
VALUES ('OB-001', 'PARACETAMOL 500MG', 50), ('OB-003', 'Oralit', 30)
ON CONFLICT (kode_obat) DO UPDATE SET stok = stok + excluded.stok;

SELECT * FROM stok_gudang ORDER BY kode_obat;`,
            run: 'playground',
            note: 'OB-001 menjadi 150 (100 + 50) dan namanya **tetap** "Paracetamol 500 mg" karena kolom nama tidak disebut di SET. OB-003 disisipkan sebagai baris baru. Jalankan berkali-kali: stok OB-001 terus bertambah 50.',
          },
        ],
      },
      {
        heading: 'Jangan pakai INSERT OR REPLACE untuk sinkronisasi',
        body: `\`INSERT OR REPLACE\` (dan \`REPLACE INTO\`) terlihat mirip, tetapi cara kerjanya **menghapus** baris lama lalu menyisipkan baris baru:

- Semua kolom diganti nilai kiriman — kolom yang tidak disebut di INSERT menjadi NULL/DEFAULT, walaupun sebelumnya berisi.
- Karena sungguh terjadi DELETE, tabel anak yang merujuknya dengan \`ON DELETE CASCADE\` **ikut kehilangan barisnya** diam-diam. Dengan FOREIGN KEY bawaan (NO ACTION) REPLACE tetap lolos, karena pemeriksaan dilakukan di akhir statement saat baris berkunci sama sudah disisipkan kembali — jadi kerusakannya tidak memunculkan error apa pun.
- rowid bisa berubah, dan trigger DELETE terpicu bila recursive_triggers aktif.

Gunakan REPLACE hanya untuk tabel sederhana tanpa relasi yang memang ingin ditimpa utuh (mis. cache).`,
      },
    ],
    pitfalls: [
      'Menyebut semua kolom di DO UPDATE SET sehingga data yang seharusnya dipertahankan (nama, NIK) ikut tertimpa.',
      'Memakai INSERT OR REPLACE untuk sinkronisasi: kolom yang tidak dikirim menjadi NULL, dan baris anak ber-ON DELETE CASCADE ikut terhapus — tanpa error.',
      '`ON CONFLICT (kolom)` pada kolom yang tidak punya PRIMARY KEY/UNIQUE → error "ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint".',
      'Menulis `SET stok = excluded.stok` padahal maksudnya menambah stok: excluded hanya berisi nilai kiriman.',
    ],
    dialects: [
      {
        label: 'Sisipkan atau perbarui',
        syntax: {
          sqlite: 'INSERT … ON CONFLICT (k) DO UPDATE SET c = excluded.c',
          sqlServer: 'MERGE t USING src ON … WHEN MATCHED THEN UPDATE … WHEN NOT MATCHED THEN INSERT …;',
          mysql: 'INSERT … AS baru ON DUPLICATE KEY UPDATE c = baru.c  (8.0.19+; dulu VALUES(c))',
          postgresql: 'INSERT … ON CONFLICT (k) DO UPDATE SET c = EXCLUDED.c',
          oracle: 'MERGE INTO t USING src ON (…) WHEN MATCHED THEN UPDATE … WHEN NOT MATCHED THEN INSERT …',
        },
      },
      {
        label: 'Abaikan baris yang bentrok',
        syntax: {
          sqlite: 'INSERT … ON CONFLICT DO NOTHING  (atau INSERT OR IGNORE)',
          sqlServer: 'MERGE … WHEN NOT MATCHED THEN INSERT …',
          mysql: 'INSERT IGNORE …  (hati-hati: error lain juga diabaikan)',
          postgresql: 'INSERT … ON CONFLICT DO NOTHING',
          oracle: 'MERGE … WHEN NOT MATCHED THEN INSERT …',
        },
      },
    ],
  },

  {
    id: 'view',
    title: 'VIEW: Query yang Disimpan',
    summary: 'CREATE VIEW menyimpan sebuah SELECT di database dengan nama, sehingga semua aplikasi membaca logika yang sama dan selalu melihat data terbaru.',
    tier: 9,
    missions: ['t9-view'],
    sections: [
      {
        heading: 'View menyimpan query, bukan data',
        body: `\`CREATE VIEW nama AS SELECT …;\` menyimpan query dengan nama. Setelah itu view dibaca seperti tabel: \`SELECT * FROM nama WHERE …\`. Setiap kali dibaca, query-nya dijalankan ulang terhadap data **terbaru** — tagihan yang baru ditambahkan langsung muncul.

Kegunaannya:

- **Satu sumber logika.** JOIN dan filter yang rumit ditulis sekali; dashboard, laporan, dan aplikasi kasir tidak bisa "lupa satu syarat".
- **Membatasi akses.** Pengguna laporan cukup diberi hak membaca view yang hanya menampilkan kolom tertentu (di DBMS dengan sistem hak akses).
- **Nama kolom yang ramah**, lewat alias di SELECT atau daftar kolom \`CREATE VIEW v (a, b) AS …\`.

Bedakan dengan \`CREATE TABLE … AS SELECT\`, yang menyalin hasil **saat itu saja** dan tidak ikut berubah.`,
        examples: [
          {
            title: 'View kunjungan pasien BPJS',
            sql: `CREATE VIEW IF NOT EXISTS v_kunjungan_bpjs AS
SELECT k.no_rawat, p.nama, k.tgl_kunjungan, k.no_sep
FROM kunjungan k
JOIN pasien p ON p.no_rm = k.no_rm
WHERE p.penjamin = 'BPJS' AND k.status <> 'Batal';

SELECT * FROM v_kunjungan_bpjs WHERE no_sep IS NULL;`,
            run: 'playground',
            note: 'Lalu jalankan `UPDATE kunjungan SET no_sep = \'0301R001-UJI\' WHERE no_rawat = \'2026/10/12/000001\';` dan baca view-nya lagi — perubahan langsung terlihat tanpa membuat ulang view.',
          },
          {
            title: 'Objek apa saja yang ada di database?',
            sql: `SELECT type, name FROM sqlite_schema WHERE type IN ('table', 'view') ORDER BY type, name;`,
            note: 'Di database awal belum ada view. Setelah contoh di atas dijalankan di Playground, `v_kunjungan_bpjs` muncul dengan type `view`.',
          },
        ],
      },
      {
        heading: 'Mengubah view & batasannya',
        body: `- SQLite tidak punya \`CREATE OR REPLACE VIEW\`: hapus dulu dengan \`DROP VIEW IF EXISTS nama;\` lalu buat ulang.
- View di SQLite **hanya bisa dibaca**. INSERT/UPDATE/DELETE ke view ditolak ("cannot modify … because it is a view"), kecuali dibuatkan trigger \`INSTEAD OF\`.
- View tidak membuat query lebih cepat — ia dijalankan ulang setiap kali dibaca. Untuk hasil berat yang dibaca berulang, DBMS lain punya *materialized view* (hasil disimpan dan di-refresh berkala).
- Hindari \`SELECT *\` di dalam definisi view: kolom yang ditambahkan ke tabel kelak tidak otomatis ikut, dan urutan kolom jadi tidak jelas.`,
      },
    ],
    pitfalls: [
      'Memakai CREATE TABLE … AS SELECT lalu bingung kenapa data baru tidak muncul.',
      'Mencoba UPDATE langsung ke view di SQLite.',
      'Mengira view menyimpan hasil sehingga lebih cepat — query-nya tetap dijalankan setiap kali dibaca.',
      'Lupa memberi alias pada kolom hasil perhitungan, sehingga nama kolom view menjadi teks ekspresinya.',
    ],
    dialects: [
      {
        label: 'Membuat ulang view',
        syntax: {
          sqlite: 'DROP VIEW IF EXISTS v; CREATE VIEW v AS …',
          sqlServer: 'CREATE OR ALTER VIEW v AS …  (2016 SP1+)',
          mysql: 'CREATE OR REPLACE VIEW v AS …',
          postgresql: 'CREATE OR REPLACE VIEW v AS …  (kolom baru hanya di akhir)',
          oracle: 'CREATE OR REPLACE VIEW v AS …',
        },
      },
      {
        label: 'Menulis lewat view',
        syntax: {
          sqlite: 'tidak bisa; pakai trigger INSTEAD OF',
          sqlServer: 'bisa untuk view sederhana (satu tabel dasar)',
          mysql: 'bisa untuk view sederhana',
          postgresql: 'otomatis untuk view sederhana (9.3+)',
          oracle: 'bisa untuk view sederhana (key-preserved)',
        },
      },
      {
        label: 'Hasil disimpan (materialized)',
        syntax: {
          sqlite: 'tidak ada; pakai tabel ringkasan',
          sqlServer: 'indexed view (WITH SCHEMABINDING + clustered index)',
          mysql: 'tidak ada; pakai tabel ringkasan',
          postgresql: 'CREATE MATERIALIZED VIEW … ; REFRESH MATERIALIZED VIEW …',
          oracle: 'CREATE MATERIALIZED VIEW …',
        },
      },
    ],
  },

  {
    id: 'trigger',
    title: 'TRIGGER: Aksi Otomatis Saat Data Berubah',
    summary: 'CREATE TRIGGER menjalankan statement otomatis sebelum/sesudah INSERT, UPDATE, atau DELETE — untuk jejak audit, menjaga aturan lintas tabel, atau menolak perubahan.',
    tier: 9,
    missions: ['t9-trigger'],
    sections: [
      {
        heading: 'Kapan terpicu, dan OLD/NEW',
        body: `\`CREATE TRIGGER nama {BEFORE | AFTER} {INSERT | UPDATE [OF kolom] | DELETE} ON tabel [FOR EACH ROW] [WHEN kondisi] BEGIN statement; … END;\`

- Trigger SQLite selalu **per baris**: UPDATE yang mengenai 4 baris memicunya 4 kali.
- \`OLD.kolom\` = nilai sebelum perubahan (UPDATE/DELETE), \`NEW.kolom\` = nilai sesudahnya (INSERT/UPDATE).
- \`UPDATE OF kolom\` — hanya terpicu bila kolom itu **disebut** di SET (meskipun nilainya sama).
- \`WHEN kondisi\` — saringan tambahan, mis. \`WHEN OLD.kota IS NOT NEW.kota\` agar hanya perubahan nilai sungguhan yang diproses. \`IS NOT\` aman untuk NULL, sedangkan \`<>\` dengan NULL bernilai NULL (dianggap tidak terpenuhi).

Trigger berjalan di dalam statement yang memicunya: bila statement itu gagal atau di-ROLLBACK, perubahan yang dibuat trigger ikut batal.`,
        examples: [
          {
            title: 'Jejak perubahan alamat pasien',
            sql: `CREATE TABLE IF NOT EXISTS log_alamat (
  id_log    INTEGER PRIMARY KEY,
  no_rm     TEXT NOT NULL,
  kota_lama TEXT,
  kota_baru TEXT
);

CREATE TRIGGER IF NOT EXISTS trg_log_alamat
AFTER UPDATE OF kota ON pasien
FOR EACH ROW
WHEN OLD.kota IS NOT NEW.kota
BEGIN
  INSERT INTO log_alamat (no_rm, kota_lama, kota_baru) VALUES (OLD.no_rm, OLD.kota, NEW.kota);
END;

UPDATE pasien SET kota = 'Cibinong' WHERE no_rm = 'RM-0017';
UPDATE pasien SET kota = kota WHERE no_rm = 'RM-0018';

SELECT * FROM log_alamat;`,
            run: 'playground',
            note: 'Hanya RM-0017 yang tercatat. UPDATE kedua memang menyebut kolom kota (trigger terpicu), tetapi WHEN menyaringnya karena nilainya tidak berubah.',
          },
        ],
      },
      {
        heading: 'Menolak perubahan dengan RAISE',
        body: `Di dalam trigger, \`SELECT RAISE(ABORT, 'pesan');\` membatalkan statement yang memicunya dengan pesan error. Biasanya dipakai di trigger \`BEFORE\` dengan WHEN, untuk aturan yang tidak bisa ditulis sebagai CHECK — misalnya aturan yang membaca tabel lain:

\`CREATE TRIGGER trg_tolak_hapus_lunas BEFORE DELETE ON billing WHEN OLD.status_bayar = 'Lunas' BEGIN SELECT RAISE(ABORT, 'Tagihan lunas tidak boleh dihapus'); END;\`

**Gunakan secukupnya.** Trigger tidak terlihat di kode aplikasi, sehingga perilaku "ajaib" mudah membingungkan rekan kerja dan memperlambat INSERT/UPDATE massal. Aturan sederhana lebih baik ditulis sebagai constraint; trigger cocok untuk jejak audit dan aturan lintas tabel.`,
        examples: [
          {
            title: 'Jenis objek di database',
            sql: `SELECT type AS jenis, COUNT(*) AS jumlah FROM sqlite_schema GROUP BY type ORDER BY type;`,
            note: 'Database awal hanya berisi tabel dan index — belum ada trigger. Setelah contoh log alamat dijalankan di Playground, baris `trigger` muncul (tabel pasien punya `trg_log_alamat`).',
          },
        ],
      },
    ],
    pitfalls: [
      'Lupa WHEN sehingga UPDATE yang tidak mengubah nilai (atau mengubah kolom lain) ikut tercatat.',
      'Membandingkan dengan `<>` pada kolom yang bisa NULL — perubahan dari/ke NULL tidak terdeteksi; pakai IS NOT.',
      'Memakai trigger untuk aturan yang cukup ditulis sebagai CHECK atau FOREIGN KEY.',
      'Menguji trigger dengan UPDATE di skrip yang sama dengan pembuatannya di lingkungan produksi — data sungguhan ikut berubah.',
    ],
    dialects: [
      {
        label: 'Nilai lama & baru',
        syntax: {
          sqlite: 'OLD.kolom / NEW.kolom (per baris)',
          sqlServer: 'tabel semu deleted / inserted (per STATEMENT, bisa banyak baris)',
          mysql: 'OLD.kolom / NEW.kolom, FOR EACH ROW',
          postgresql: 'OLD / NEW di dalam fungsi trigger (RETURNS trigger)',
          oracle: ':OLD.kolom / :NEW.kolom, FOR EACH ROW',
        },
      },
      {
        label: 'Saringan kondisi',
        syntax: {
          sqlite: 'WHEN OLD.c IS NOT NEW.c',
          sqlServer: 'IF UPDATE(c) … atau JOIN inserted/deleted',
          mysql: 'tidak ada WHEN; pakai IF … END IF di dalam BEGIN … END',
          postgresql: 'WHEN (OLD.c IS DISTINCT FROM NEW.c)',
          oracle: 'WHEN (OLD.c <> NEW.c)  -- tanpa titik dua di WHEN',
        },
      },
      {
        label: 'Membatalkan dengan pesan',
        syntax: {
          sqlite: "SELECT RAISE(ABORT, 'pesan')",
          sqlServer: "THROW 50001, 'pesan', 1",
          mysql: "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pesan'",
          postgresql: "RAISE EXCEPTION 'pesan'",
          oracle: "RAISE_APPLICATION_ERROR(-20001, 'pesan')",
        },
      },
    ],
  },
];
