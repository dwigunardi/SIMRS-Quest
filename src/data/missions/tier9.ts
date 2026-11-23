/**
 * Tier 9 – Desain Tabel & DDL (misi 56–62; boss di misi 63).
 * - #56: kartu konsep normalisasi + kuis.
 * - #57, #58, #60, #61, #62: grading 'schema' — struktur objek dibandingkan dengan hasil solusi, lalu probe
 *   (INSERT/UPDATE uji) harus diterima/ditolak sama seperti di DB solusi, lalu isi akhir dibaca verifySql.
 * - #59: UPSERT, grading 'state' + konstruksi wajib ON CONFLICT.
 * Semua DDL di sini didukung SQLite 3.54 (CHECK, FOREIGN KEY, ALTER TABLE ADD COLUMN, VIEW, TRIGGER, UPSERT).
 */
import type { ConceptMission, SqlMission, TierInfo } from '../../types';

export const TIER9: TierInfo = {
  tier: 9,
  name: 'Desain Tabel & DDL',
  description:
    'Merancang tabel sendiri: normalisasi, CREATE TABLE dengan constraint (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, DEFAULT), ALTER TABLE, UPSERT, VIEW, dan TRIGGER.',
};

const XP = 250;

const JADWAL_SQL = `CREATE TABLE jadwal_praktik (
  id_jadwal    INTEGER PRIMARY KEY,
  id_dokter    TEXT    NOT NULL REFERENCES dokter (id_dokter),
  hari         TEXT    NOT NULL CHECK (hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu')),
  jam_mulai    TEXT    NOT NULL,
  jam_selesai  TEXT    NOT NULL,
  kuota        INTEGER NOT NULL DEFAULT 20 CHECK (kuota > 0),
  CHECK (jam_selesai > jam_mulai),
  UNIQUE (id_dokter, hari)
);`;

export const MISSIONS_TIER9: Array<SqlMission | ConceptMission> = [
  /* ------------------------------------------------------------------ */
  /* #56 Normalisasi (kartu konsep)                                      */
  /* ------------------------------------------------------------------ */
  {
    id: 't9-normalisasi',
    kind: 'concept',
    tier: 9,
    order: 56,
    title: 'Satu Fakta, Satu Tempat',
    concept: 'Normalisasi',
    story:
      'Bagian farmasi selama ini mencatat resep di satu spreadsheet besar: setiap baris berisi nomor rawat, nama pasien, alamat, nama dokter, spesialisasi, dan daftar obat dipisah koma. Saat seorang pasien pindah alamat, alamatnya harus diganti di puluhan baris, dan ada yang terlewat. Sebelum memindahkannya ke database, Kepala Instalasi SIMRS memintamu memahami cara merancang tabel yang benar.',
    task:
      'Pelajari normalisasi (1NF, 2NF, 3NF), anomali data yang dicegahnya, dan kapan denormalisasi justru masuk akal, lalu jawab SEMUA pertanyaan kuis dengan benar.',
    hint: [
      'Normalisasi intinya: setiap fakta disimpan di SATU tempat. Nama pasien cukup ada di tabel pasien; tabel lain menyimpan no_rm saja.',
      '1NF: satu sel = satu nilai (tidak ada daftar dipisah koma). 2NF: kolom non-kunci bergantung pada SELURUH kunci gabungan. 3NF: kolom non-kunci tidak bergantung pada kolom non-kunci lain.',
      'Denormalisasi (menyimpan salinan) boleh untuk laporan/arsip yang dibaca jauh lebih sering daripada diubah, asal disadari risikonya dan sumber kebenarannya tetap satu.',
    ],
    xpReward: XP,
    sections: [
      {
        heading: 'Masalah tabel "serba ada"',
        body:
          'Tabel yang menampung semuanya dalam satu baris tampak praktis, tetapi menimbulkan tiga anomali:\n\n- **Anomali update**: alamat pasien tersimpan di banyak baris; mengubahnya di satu baris saja membuat data saling bertentangan.\n- **Anomali insert**: dokter baru tidak bisa dicatat sebelum punya resep, karena barisnya harus berisi resep.\n- **Anomali delete**: menghapus resep terakhir seorang dokter ikut menghapus satu-satunya catatan spesialisasinya.\n\nNormalisasi memecah tabel seperti itu menjadi beberapa tabel kecil yang dihubungkan dengan kunci (PRIMARY KEY dan FOREIGN KEY), sehingga setiap fakta hanya disimpan sekali — persis seperti skema SIMRS di aplikasi ini: `pasien`, `dokter`, `kunjungan`, `diagnosa`, `billing`.',
        examples: [
          {
            dialect: 'Sebelum (satu tabel, tidak normal)',
            code: `resep_lama
no_rawat           | nama_pasien  | alamat_pasien | dokter            | spesialisasi      | obat
2026/10/01/000001  | Ahmad Fauzi  | Bogor         | dr. Budi Santoso  | Penyakit Dalam    | Amlodipin, Metformin
2026/10/18/000001  | Ahmad Fauzi  | Bogor         | dr. Agus Salim    | Jantung           | Bisoprolol`,
            caption: 'Nama & alamat pasien berulang; kolom obat berisi daftar (melanggar 1NF).',
          },
        ],
      },
      {
        heading: '1NF, 2NF, 3NF dengan bahasa sehari-hari',
        body:
          '- **1NF — satu sel, satu nilai.** Kolom `obat` berisi "Amlodipin, Metformin" melanggar 1NF: mencari pasien yang mendapat Metformin harus memakai LIKE dan rawan salah. Solusinya satu baris per obat di tabel tersendiri (`resep_obat`).\n- **2NF — bergantung pada SELURUH kunci.** Pada tabel `resep_obat (no_rawat, kode_obat, nama_obat, jumlah)` dengan kunci gabungan (no_rawat, kode_obat), kolom `nama_obat` hanya bergantung pada `kode_obat`. Pindahkan ke tabel master `obat (kode_obat, nama_obat)`.\n- **3NF — tidak bergantung pada kolom non-kunci lain.** Di tabel `dokter`, menyimpan `nama_poli` di samping `id_poli` melanggar 3NF: `nama_poli` bergantung pada `id_poli`, bukan pada `id_dokter`. Cukup simpan `id_poli`, lalu JOIN ke `poliklinik` saat dibutuhkan.\n\nSingkatnya: setiap kolom harus menjelaskan *kunci, seluruh kunci, dan tidak ada yang lain selain kunci*.',
        examples: [
          {
            dialect: 'SQLite',
            caption: 'Hasil normalisasi resep: master obat + tabel penghubung dengan kunci gabungan.',
            code: `CREATE TABLE obat (
  kode_obat  TEXT PRIMARY KEY,
  nama_obat  TEXT NOT NULL
);

CREATE TABLE resep_obat (
  no_rawat   TEXT    NOT NULL REFERENCES kunjungan (no_rawat),
  kode_obat  TEXT    NOT NULL REFERENCES obat (kode_obat),
  jumlah     INTEGER NOT NULL CHECK (jumlah > 0),
  PRIMARY KEY (no_rawat, kode_obat)
);`,
          },
        ],
      },
      {
        heading: 'Kapan denormalisasi masuk akal?',
        body:
          'Denormalisasi berarti sengaja menyimpan salinan data demi kecepatan baca atau kesederhanaan laporan. Contoh yang wajar di rumah sakit:\n\n- **Data historis yang harus dibekukan**: tarif kamar saat pasien dirawat disalin ke tagihan, karena tarif master bisa naik tahun depan tetapi tagihan lama tidak boleh ikut berubah.\n- **Tabel laporan/ringkasan** (mis. rekap kunjungan harian) yang dibaca dashboard ribuan kali tetapi dihitung ulang sekali semalam.\n\nSyaratnya: tetap ada satu sumber kebenaran, dan salinannya diperbarui dengan cara yang terkontrol (job terjadwal, trigger, atau materialized view). Sebelum denormalisasi, coba dulu index dan VIEW.',
      },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'Tabel kunjungan_lama punya kolom diagnosa berisi "I10, E11.9". Bentuk normal mana yang dilanggar?',
        options: ['1NF — satu sel berisi lebih dari satu nilai', '2NF — bergantung pada sebagian kunci', '3NF — bergantung pada kolom non-kunci', 'Tidak melanggar apa pun selama dipisah koma'],
        correctIndex: 0,
        explanation:
          'Satu sel berisi daftar nilai melanggar 1NF. Mencari kunjungan dengan diagnosa E11.9 jadi butuh LIKE dan rawan salah (mis. ikut cocok dengan kode lain). Solusinya satu baris per diagnosa, seperti tabel diagnosa di skema ini.',
      },
      {
        id: 'q2',
        question: 'Tabel dokter menyimpan id_poli dan nama_poli. Saat Poli Saraf berganti nama, apa risikonya?',
        options: [
          'Tidak ada risiko; nama_poli hanya teks biasa',
          'Anomali update: nama_poli harus diganti di setiap baris dokter, dan baris yang terlewat membuat data bertentangan',
          'Anomali insert: dokter baru tidak bisa ditambahkan',
          'FOREIGN KEY otomatis memperbarui nama_poli',
        ],
        correctIndex: 1,
        explanation:
          'nama_poli bergantung pada id_poli, bukan pada id_dokter (pelanggaran 3NF). Akibatnya nama yang sama tersimpan di banyak baris. Simpan id_poli saja dan ambil nama_poli lewat JOIN ke tabel poliklinik.',
      },
      {
        id: 'q3',
        question: 'Pada tabel resep_obat dengan PRIMARY KEY (no_rawat, kode_obat), kolom mana yang melanggar 2NF?',
        options: ['jumlah', 'nama_obat, karena hanya bergantung pada kode_obat', 'no_rawat', 'Tidak ada; kunci gabungan selalu memenuhi 2NF'],
        correctIndex: 1,
        explanation:
          'jumlah bergantung pada kombinasi (no_rawat, kode_obat), jadi sudah tepat. nama_obat hanya bergantung pada kode_obat — sebagian kunci — sehingga harus dipindah ke tabel master obat.',
      },
      {
        id: 'q4',
        question: 'Mana contoh denormalisasi yang paling bisa dibenarkan?',
        options: [
          'Menyalin nama pasien ke setiap baris diagnosa agar tidak perlu JOIN',
          'Menyimpan tarif kamar yang berlaku saat itu di baris tagihan, karena tagihan lama tidak boleh ikut berubah saat tarif master naik',
          'Menyimpan semua tabel dalam satu tabel besar supaya backup lebih mudah',
          'Menghapus FOREIGN KEY agar INSERT lebih cepat',
        ],
        correctIndex: 1,
        explanation:
          'Tarif yang tercatat di tagihan adalah fakta historis yang memang harus dibekukan. Menyalin nama pasien demi menghindari JOIN hanya memindahkan masalah: nama harus diubah di banyak tempat. JOIN pada kolom ber-index itu murah.',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* #57 CREATE TABLE + constraint                                       */
  /* ------------------------------------------------------------------ */
  {
    id: 't9-create-table',
    kind: 'sql',
    tier: 9,
    order: 57,
    title: 'Jadwal Praktik Dokter',
    concept: 'CREATE TABLE + Constraint',
    story:
      'Pendaftaran online akan menampilkan jadwal praktik setiap dokter beserta kuota pasiennya. Selama ini jadwal dicatat di papan tulis, dan pernah terjadi satu dokter tercatat dua kali di hari yang sama, ada jadwal hari Minggu padahal poli tutup, dan kuota 0 yang membuat pasien tidak bisa mendaftar. Kali ini aturan itu harus dijaga oleh database, bukan oleh ketelitian petugas.',
    task:
      "Buat tabel jadwal_praktik dengan kolom berikut:\n• id_jadwal INTEGER PRIMARY KEY\n• id_dokter TEXT, wajib diisi, harus merujuk ke dokter(id_dokter)\n• hari TEXT, wajib diisi, hanya boleh 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', atau 'Sabtu'\n• jam_mulai dan jam_selesai TEXT (format 'HH:MM'), keduanya wajib diisi, dan jam_selesai harus lebih besar dari jam_mulai\n• kuota INTEGER, wajib diisi, bawaan 20 bila tidak disebut, dan harus lebih dari 0\n• satu dokter hanya boleh punya SATU jadwal per hari\nLalu isi dua jadwal, berurutan: D001 hari Senin 08:00–12:00 kuota 25, dan D007 hari Rabu 13:00–16:00 tanpa menyebut kuota. Penilai akan menjalankan sendiri serangkaian INSERT uji (yang sah harus diterima, yang melanggar aturan harus ditolak), lalu membaca isi tabel.",
    hint: [
      'Kerangka: CREATE TABLE nama (kolom TIPE constraint, …, constraint_tabel); Constraint satu kolom (NOT NULL, DEFAULT, CHECK, REFERENCES) ditulis setelah tipenya; aturan yang melibatkan dua kolom ditulis sebagai constraint tabel di akhir.',
      "Pemetaan aturan: wajib diisi → NOT NULL; bawaan → DEFAULT 20; daftar nilai → CHECK (hari IN (…)); lebih dari 0 → CHECK (kuota > 0); merujuk tabel lain → REFERENCES dokter (id_dokter); dua kolom dibandingkan → CHECK (jam_selesai > jam_mulai) di akhir; satu jadwal per dokter per hari → UNIQUE (id_dokter, hari).",
      "Tipe TEXT untuk jam memang disengaja: teks berformat 'HH:MM' urut dengan benar saat dibandingkan. Untuk INSERT jadwal D007, sebut daftar kolom tanpa kuota agar DEFAULT terpakai. Coba-coba INSERT yang melanggar aturan di Free Playground untuk memastikan semuanya ditolak.",
    ],
    solutionSql: `${JADWAL_SQL}

INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai, kuota)
VALUES ('D001', 'Senin', '08:00', '12:00', 25);
INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai)
VALUES ('D007', 'Rabu', '13:00', '16:00');`,
    starterSql: '-- Rancang tabel jadwal_praktik beserta aturannya\nCREATE TABLE jadwal_praktik (\n  \n);\n',
    xpReward: XP,
    orderMatters: true,
    grading: {
      type: 'schema',
      objects: [{ name: 'jadwal_praktik', type: 'table' }],
      probes: [
        { description: 'Jadwal sah: D003 Kamis 09:00–12:00 kuota 15', sql: "INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai, kuota) VALUES ('D003', 'Kamis', '09:00', '12:00', 15)" },
        { description: 'Jadwal tanpa kuota (memakai bawaan)', sql: "INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai) VALUES ('D005', 'Sabtu', '08:00', '11:00')" },
        { description: 'Hari Minggu (poli tutup)', sql: "INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai) VALUES ('D002', 'Minggu', '08:00', '12:00')" },
        { description: 'Jam selesai sebelum jam mulai', sql: "INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai) VALUES ('D002', 'Selasa', '14:00', '10:00')" },
        { description: 'Kuota 0', sql: "INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai, kuota) VALUES ('D002', 'Jumat', '08:00', '12:00', 0)" },
        { description: 'Dokter yang tidak terdaftar (D999)', sql: "INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai) VALUES ('D999', 'Senin', '08:00', '12:00')" },
        { description: 'D001 dijadwalkan dua kali di hari Senin', sql: "INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai) VALUES ('D001', 'Senin', '13:00', '15:00')" },
        { description: 'Dokter dikosongkan (NULL)', sql: "INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai) VALUES (NULL, 'Senin', '08:00', '12:00')" },
        { description: 'Jam mulai dikosongkan (NULL)', sql: "INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai) VALUES ('D004', 'Senin', NULL, '12:00')" },
      ],
      verifySql: 'SELECT id_jadwal, id_dokter, hari, jam_mulai, jam_selesai, kuota FROM jadwal_praktik ORDER BY id_jadwal;',
      label: 'Isi jadwal_praktik setelah uji',
    },
    requiredPatterns: [{ pattern: String.raw`CREATE\s+TABLE`, message: 'Misi ini meminta tabel baru dibuat dengan CREATE TABLE jadwal_praktik (…).' }],
  },

  /* ------------------------------------------------------------------ */
  /* #58 ALTER TABLE ADD COLUMN                                          */
  /* ------------------------------------------------------------------ */
  {
    id: 't9-alter-table',
    kind: 'sql',
    tier: 9,
    order: 58,
    title: 'Metode Pembayaran di Tagihan',
    concept: 'ALTER TABLE',
    story:
      'Bagian Keuangan ingin tahu berapa tagihan yang dibayar tunai, transfer, atau ditanggung BPJS. Tabel billing sudah berisi data dan dipakai aplikasi kasir setiap hari, jadi tidak boleh dibuat ulang. Kolom baru harus ditambahkan ke tabel yang ada tanpa mengganggu baris lama.',
    task:
      "Tambahkan kolom metode_bayar TEXT ke tabel billing: wajib diisi, bawaan 'Tunai', dan hanya boleh 'Tunai', 'Transfer', atau 'BPJS'. Setelah itu ubah metode_bayar menjadi 'BPJS' untuk semua tagihan milik pasien yang penjaminnya 'BPJS' (tagihan lain tetap 'Tunai'). Penilai lalu menjalankan INSERT/UPDATE uji dan membaca seluruh tabel billing.",
    hint: [
      'ALTER TABLE nama_tabel ADD COLUMN nama_kolom TIPE constraint…; menambah kolom di akhir tabel. Baris lama otomatis mendapat nilai DEFAULT kolom itu.',
      "Kolom NOT NULL yang ditambahkan ke tabel berisi data WAJIB punya DEFAULT; tanpa DEFAULT SQLite menolak (\"Cannot add a NOT NULL column with default value NULL\"), karena baris lama akan bernilai NULL. Tulis: ADD COLUMN metode_bayar TEXT NOT NULL DEFAULT 'Tunai' CHECK (metode_bayar IN (…)).",
      "Untuk langkah kedua, saring billing dengan subquery: UPDATE billing SET metode_bayar = 'BPJS' WHERE no_rawat IN (SELECT k.no_rawat FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm WHERE p.penjamin = 'BPJS');",
    ],
    solutionSql: `ALTER TABLE billing
ADD COLUMN metode_bayar TEXT NOT NULL DEFAULT 'Tunai'
  CHECK (metode_bayar IN ('Tunai', 'Transfer', 'BPJS'));

UPDATE billing
SET metode_bayar = 'BPJS'
WHERE no_rawat IN (
  SELECT k.no_rawat
  FROM kunjungan k
  INNER JOIN pasien p ON p.no_rm = k.no_rm
  WHERE p.penjamin = 'BPJS'
);`,
    starterSql: '-- Tambahkan kolom metode_bayar ke billing\nALTER TABLE billing\n',
    xpReward: XP,
    orderMatters: true,
    grading: {
      type: 'schema',
      objects: [{ name: 'billing', type: 'table' }],
      probes: [
        { description: 'Tagihan baru tanpa menyebut metode (memakai bawaan)', sql: "INSERT INTO billing (no_rawat, total_biaya, status_bayar) VALUES ('2026/10/07/000001', 25000, 'Lunas')" },
        { description: "Metode 'Kartu Kredit' (tidak ada di daftar)", sql: "UPDATE billing SET metode_bayar = 'Kartu Kredit' WHERE id_billing = 1" },
        { description: 'Metode dikosongkan (NULL)', sql: 'UPDATE billing SET metode_bayar = NULL WHERE id_billing = 2' },
        { description: "Tagihan dibayar 'Transfer'", sql: "UPDATE billing SET metode_bayar = 'Transfer' WHERE id_billing = 3" },
      ],
      verifySql: 'SELECT id_billing, no_rawat, total_biaya, status_bayar, metode_bayar FROM billing ORDER BY id_billing;',
      label: 'Isi billing setelah uji',
    },
    requiredPatterns: [{ pattern: String.raw`ALTER\s+TABLE`, message: 'Tabel billing sudah berisi data: tambahkan kolomnya dengan ALTER TABLE … ADD COLUMN, jangan membuat ulang tabel.' }],
  },

  /* ------------------------------------------------------------------ */
  /* #59 UPSERT                                                          */
  /* ------------------------------------------------------------------ */
  {
    id: 't9-upsert',
    kind: 'sql',
    tier: 9,
    order: 59,
    title: 'Sinkronisasi Pendaftaran Online',
    concept: 'UPSERT (ON CONFLICT)',
    story:
      'Aplikasi pendaftaran online mengirim data pasien setiap malam. Sebagian sudah terdaftar (nomor RM-nya ada) dan hanya memperbarui kota serta penjamin; sebagian pasien baru. Pasien mengetik nama sendiri di ponsel, jadi ejaannya sering berbeda dari data rekam medis — nama, NIK, dan tanggal lahir pasien lama TIDAK boleh ikut ditimpa.',
    task:
      "Dengan SATU statement INSERT … ON CONFLICT, masukkan tiga baris kiriman ini ke tabel pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin):\n('RM-0005', '3276052008880005', 'Rizky Ramadan', 'L', '1988-08-20', 'Bogor', 'BPJS')\n('RM-0014', '3216146811970014', 'Nur Aini', 'P', '1997-11-28', 'Bekasi', 'BPJS')\n('RM-0021', '3174032105990021', 'Larasati Putri', 'P', '1999-05-21', 'Jakarta', 'Asuransi')\nBila no_rm sudah ada, perbarui HANYA kota dan penjamin dengan nilai kiriman. Bila belum ada, sisipkan sebagai pasien baru. Penilaian membaca seluruh tabel pasien.",
    hint: [
      'UPSERT = INSERT yang berubah menjadi UPDATE bila bentrok dengan PRIMARY KEY/UNIQUE: INSERT INTO t (…) VALUES (…), (…) ON CONFLICT (kolom_kunci) DO UPDATE SET kolom = excluded.kolom;',
      '`excluded` adalah baris yang GAGAL disisipkan (nilai kiriman). Di DO UPDATE SET, sebut hanya kolom yang boleh berubah: kota = excluded.kota, penjamin = excluded.penjamin. Kolom yang tidak disebut tetap seperti semula.',
      'Jangan memakai INSERT OR REPLACE: REPLACE menghapus baris lama lalu menyisipkan baris baru, sehingga SEMUA kolom diganti nilai kiriman — nama RM-0005 ikut berubah menjadi ejaan yang keliru. Di tabel yang dirujuk dengan ON DELETE CASCADE, penghapusan itu bahkan ikut menghapus baris anaknya diam-diam.',
    ],
    solutionSql: `INSERT INTO pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin)
VALUES
  ('RM-0005', '3276052008880005', 'Rizky Ramadan', 'L', '1988-08-20', 'Bogor', 'BPJS'),
  ('RM-0014', '3216146811970014', 'Nur Aini', 'P', '1997-11-28', 'Bekasi', 'BPJS'),
  ('RM-0021', '3174032105990021', 'Larasati Putri', 'P', '1999-05-21', 'Jakarta', 'Asuransi')
ON CONFLICT (no_rm) DO UPDATE SET
  kota = excluded.kota,
  penjamin = excluded.penjamin;`,
    starterSql:
      "-- Sinkronisasi 3 pasien dari pendaftaran online (satu statement)\nINSERT INTO pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin)\nVALUES\n  ('RM-0005', '3276052008880005', 'Rizky Ramadan', 'L', '1988-08-20', 'Bogor', 'BPJS'),\n  ('RM-0014', '3216146811970014', 'Nur Aini', 'P', '1997-11-28', 'Bekasi', 'BPJS'),\n  ('RM-0021', '3174032105990021', 'Larasati Putri', 'P', '1999-05-21', 'Jakarta', 'Asuransi')\n",
    xpReward: XP,
    orderMatters: true,
    grading: { type: 'state', verifySql: 'SELECT * FROM pasien ORDER BY no_rm;', label: 'Isi tabel pasien' },
    requiredPatterns: [
      { pattern: String.raw`\bON\s+CONFLICT\b`, message: 'Misi ini melatih UPSERT: gunakan satu INSERT … ON CONFLICT (no_rm) DO UPDATE SET …, bukan UPDATE dan INSERT terpisah.' },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* #60 VIEW                                                            */
  /* ------------------------------------------------------------------ */
  {
    id: 't9-view',
    kind: 'sql',
    tier: 9,
    order: 60,
    title: 'Satu Query untuk Semua Kasir',
    concept: 'CREATE VIEW',
    story:
      'Aplikasi kasir, dashboard keuangan, dan laporan bulanan masing-masing menulis ulang JOIN yang sama antara billing, kunjungan, pasien, dan poliklinik — dan pernah ada yang lupa satu syarat sehingga angkanya berbeda. Tim SIMRS memutuskan menyimpan query itu di database sebagai VIEW, supaya semua aplikasi membaca sumber yang sama dan selalu melihat data terbaru.',
    task:
      'Buat view v_tagihan_pasien yang menampilkan setiap tagihan dengan kolom no_rawat, no_rm, nama, nama_poli, tgl_kunjungan, total_biaya, dan status_bayar (hanya kunjungan yang punya tagihan). Penilai akan mengubah dan menambah data tagihan, lalu membaca isi view — view harus ikut menampilkan perubahan itu.',
    hint: [
      'CREATE VIEW nama AS SELECT …; View menyimpan QUERY-nya, bukan datanya. Setiap kali view dibaca, query itu dijalankan ulang terhadap data terbaru.',
      'Isi view-nya adalah SELECT biasa: billing di-JOIN ke kunjungan (no_rawat), pasien (no_rm), dan poliklinik (id_poli). Kunjungan tanpa tagihan tidak ikut, jadi INNER JOIN dari billing sudah tepat.',
      'Jangan memakai CREATE TABLE … AS SELECT: itu menyalin data SAAT ITU saja sehingga tagihan baru tidak muncul. Nama kolom view mengikuti nama/alias kolom SELECT-nya.',
    ],
    solutionSql: `CREATE VIEW v_tagihan_pasien AS
SELECT
  k.no_rawat,
  p.no_rm,
  p.nama,
  pl.nama_poli,
  k.tgl_kunjungan,
  b.total_biaya,
  b.status_bayar
FROM billing b
INNER JOIN kunjungan k ON k.no_rawat = b.no_rawat
INNER JOIN pasien p ON p.no_rm = k.no_rm
INNER JOIN poliklinik pl ON pl.id_poli = k.id_poli;`,
    starterSql: '-- Simpan query tagihan sebagai VIEW\nCREATE VIEW v_tagihan_pasien AS\nSELECT ',
    xpReward: XP,
    orderMatters: true,
    grading: {
      type: 'schema',
      objects: [{ name: 'v_tagihan_pasien', type: 'view' }],
      probes: [
        { description: 'Tagihan Wulan Sari dilunasi', sql: "UPDATE billing SET status_bayar = 'Lunas' WHERE id_billing = 16" },
        { description: 'Biaya administrasi untuk kunjungan batal 2026/10/07/000001', sql: "INSERT INTO billing (no_rawat, total_biaya, status_bayar) VALUES ('2026/10/07/000001', 50000, 'Belum Lunas')" },
        { description: 'Menulis langsung ke view', sql: "UPDATE v_tagihan_pasien SET status_bayar = 'Lunas' WHERE no_rawat = '2026/11/06/000001'" },
      ],
      verifySql: 'SELECT * FROM v_tagihan_pasien ORDER BY no_rawat;',
      label: 'Isi v_tagihan_pasien setelah uji',
    },
    requiredPatterns: [{ pattern: String.raw`CREATE\s+VIEW`, message: 'Misi ini meminta VIEW: CREATE VIEW v_tagihan_pasien AS SELECT …' }],
  },

  /* ------------------------------------------------------------------ */
  /* #61 TRIGGER                                                         */
  /* ------------------------------------------------------------------ */
  {
    id: 't9-trigger',
    kind: 'sql',
    tier: 9,
    order: 61,
    title: 'Jejak Audit Status Tagihan',
    concept: 'CREATE TRIGGER',
    story:
      'Auditor menemukan tagihan rawat inap Rp18.750.000 yang berubah dari Belum Lunas menjadi Lunas tanpa bukti pembayaran, dan tidak ada yang tahu kapan atau dari aplikasi mana perubahan itu terjadi. Mulai sekarang setiap perubahan status bayar harus tercatat otomatis oleh database — dari aplikasi mana pun perubahan itu datang.',
    task:
      'Buat tabel log_status_bayar persis seperti di editor, lalu buat trigger trg_log_status_bayar pada tabel billing: setiap kali status_bayar sebuah tagihan BENAR-BENAR berubah nilainya, catat satu baris berisi id_billing, status_lama, dan status_baru. Perubahan kolom lain, atau UPDATE yang mengisi status_bayar dengan nilai yang sama, tidak boleh dicatat. Penilai akan menjalankan beberapa UPDATE uji pada billing, lalu membaca isi log.',
    hint: [
      'Kerangka: CREATE TRIGGER nama AFTER UPDATE OF kolom ON tabel FOR EACH ROW WHEN kondisi BEGIN statement; END; Di dalam trigger, OLD.kolom = nilai sebelum UPDATE dan NEW.kolom = nilai sesudahnya.',
      '"AFTER UPDATE OF status_bayar" membuat trigger hanya terpicu bila kolom status_bayar disebut di SET. Tetapi UPDATE billing SET status_bayar = status_bayar tetap memicunya, jadi tambahkan WHEN OLD.status_bayar <> NEW.status_bayar.',
      'Isi trigger: INSERT INTO log_status_bayar (id_billing, status_lama, status_baru) VALUES (OLD.id_billing, OLD.status_bayar, NEW.status_bayar); Jangan menjalankan UPDATE uji di skripmu — coba di Free Playground, karena penilai menjalankan ujinya sendiri.',
    ],
    solutionSql: `CREATE TABLE log_status_bayar (
  id_log       INTEGER PRIMARY KEY,
  id_billing   INTEGER NOT NULL,
  status_lama  TEXT    NOT NULL,
  status_baru  TEXT    NOT NULL
);

CREATE TRIGGER trg_log_status_bayar
AFTER UPDATE OF status_bayar ON billing
FOR EACH ROW
WHEN OLD.status_bayar <> NEW.status_bayar
BEGIN
  INSERT INTO log_status_bayar (id_billing, status_lama, status_baru)
  VALUES (OLD.id_billing, OLD.status_bayar, NEW.status_bayar);
END;`,
    starterSql: `-- Tabel log (sudah benar, jangan diubah)
CREATE TABLE log_status_bayar (
  id_log       INTEGER PRIMARY KEY,
  id_billing   INTEGER NOT NULL,
  status_lama  TEXT    NOT NULL,
  status_baru  TEXT    NOT NULL
);

-- Tulis trigger-nya di bawah ini
CREATE TRIGGER trg_log_status_bayar
`,
    xpReward: XP,
    orderMatters: true,
    grading: {
      type: 'schema',
      objects: [
        { name: 'log_status_bayar', type: 'table' },
        { name: 'trg_log_status_bayar', type: 'trigger' },
      ],
      probes: [
        { description: 'Tagihan id 16 dilunasi', sql: "UPDATE billing SET status_bayar = 'Lunas' WHERE id_billing = 16" },
        { description: 'Hanya total_biaya tagihan id 8 yang diubah', sql: 'UPDATE billing SET total_biaya = total_biaya + 100000 WHERE id_billing = 8' },
        { description: 'status_bayar tagihan id 22 diisi nilai yang sama', sql: 'UPDATE billing SET status_bayar = status_bayar WHERE id_billing = 22' },
        { description: 'Semua tagihan Belum Lunas dilunasi sekaligus', sql: "UPDATE billing SET status_bayar = 'Lunas' WHERE status_bayar = 'Belum Lunas'" },
        { description: 'Pelunasan tagihan id 1 dibatalkan', sql: "UPDATE billing SET status_bayar = 'Belum Lunas' WHERE id_billing = 1" },
        { description: "Status 'Cicil' (ditolak CHECK tabel billing — log-nya ikut batal)", sql: "UPDATE billing SET status_bayar = 'Cicil' WHERE id_billing = 2" },
      ],
      verifySql: 'SELECT id_billing, status_lama, status_baru FROM log_status_bayar ORDER BY id_log;',
      label: 'Isi log_status_bayar setelah uji',
    },
    requiredPatterns: [{ pattern: String.raw`CREATE\s+TRIGGER`, message: 'Misi ini meminta TRIGGER: CREATE TRIGGER trg_log_status_bayar … ON billing …' }],
  },

  /* ------------------------------------------------------------------ */
  /* #62 Perbaiki Bug: CREATE TABLE resep                                */
  /* ------------------------------------------------------------------ */
  {
    id: 't9-fix-resep',
    kind: 'sql',
    tier: 9,
    order: 62,
    title: 'Tabel Resep yang Menolak Semua Resep',
    concept: 'Debug: FOREIGN KEY & CHECK',
    story:
      'Rekan kerjamu membuat tabel resep untuk modul farmasi. Saat diuji, aplikasi tidak bisa menyimpan satu resep pun — muncul error "foreign key mismatch". Anehnya, apoteker juga melaporkan bahwa di versi uji coba sebelumnya resep dengan jumlah obat 0 sempat tersimpan.',
    task:
      "Perbaiki DDL di editor (mengandung 2 bug). Tabel resep yang benar: id_resep INTEGER PRIMARY KEY; no_rawat TEXT wajib diisi dan merujuk ke kunjungan(no_rawat); nama_obat TEXT wajib diisi; jumlah INTEGER wajib diisi dan harus lebih dari 0; aturan_pakai TEXT wajib diisi dengan bawaan '3x1'. Penilai akan menjalankan INSERT resep uji dan membaca isi tabel.",
    hint: [
      'FOREIGN KEY harus merujuk ke kolom yang UNIK di tabel induk (PRIMARY KEY atau UNIQUE). Kolom yang tidak unik membuat SQLite tidak tahu baris induk mana yang dimaksud, sehingga setiap INSERT gagal dengan "foreign key mismatch".',
      'Periksa kolom apa yang dirujuk REFERENCES kunjungan (…). Primary key tabel kunjungan adalah no_rawat; no_rm di kunjungan bisa muncul berkali-kali.',
      'Bug kedua ada di CHECK: "lebih dari 0" bukan ">= 0".',
    ],
    solutionSql: `CREATE TABLE resep (
  id_resep      INTEGER PRIMARY KEY,
  no_rawat      TEXT    NOT NULL REFERENCES kunjungan (no_rawat),
  nama_obat     TEXT    NOT NULL,
  jumlah        INTEGER NOT NULL CHECK (jumlah > 0),
  aturan_pakai  TEXT    NOT NULL DEFAULT '3x1'
);`,
    starterSql: `-- DDL dari rekan: tidak ada resep yang bisa disimpan
CREATE TABLE resep (
  id_resep      INTEGER PRIMARY KEY,
  no_rawat      TEXT    NOT NULL REFERENCES kunjungan (no_rm),
  nama_obat     TEXT    NOT NULL,
  jumlah        INTEGER NOT NULL CHECK (jumlah >= 0),
  aturan_pakai  TEXT    NOT NULL DEFAULT '3x1'
);`,
    xpReward: XP,
    orderMatters: true,
    grading: {
      type: 'schema',
      objects: [{ name: 'resep', type: 'table' }],
      probes: [
        { description: 'Resep sah: Metformin 500 mg × 30, 2x1', sql: "INSERT INTO resep (no_rawat, nama_obat, jumlah, aturan_pakai) VALUES ('2026/11/14/000001', 'Metformin 500 mg', 30, '2x1')" },
        { description: 'Resep tanpa aturan pakai (memakai bawaan)', sql: "INSERT INTO resep (no_rawat, nama_obat, jumlah) VALUES ('2026/11/15/000001', 'Oralit', 6)" },
        { description: 'Jumlah obat 0', sql: "INSERT INTO resep (no_rawat, nama_obat, jumlah) VALUES ('2026/11/15/000001', 'Zinc 20 mg', 0)" },
        { description: 'Nomor rawat yang tidak ada', sql: "INSERT INTO resep (no_rawat, nama_obat, jumlah) VALUES ('2026/12/01/000099', 'Paracetamol 500 mg', 10)" },
        { description: 'Nama obat dikosongkan (NULL)', sql: "INSERT INTO resep (no_rawat, nama_obat, jumlah) VALUES ('2026/11/14/000001', NULL, 10)" },
      ],
      verifySql: 'SELECT id_resep, no_rawat, nama_obat, jumlah, aturan_pakai FROM resep ORDER BY id_resep;',
      label: 'Isi resep setelah uji',
    },
    fix: { bugCount: 2 },
  },
];
