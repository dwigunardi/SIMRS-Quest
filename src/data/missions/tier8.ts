/**
 * Tier 8 – Konsep Prosedural & Skala Besar (misi 52–54; final boss di misi 55).
 * SQLite tidak punya stored procedure, cursor, EXEC, maupun partisi tabel,
 * sehingga tier ini berupa kartu konsep dengan contoh dialek T-SQL / PL/pgSQL / MySQL
 * dan kuis pilihan ganda yang dinilai otomatis (tanpa eksekusi SQL).
 */
import type { ConceptMission, TierInfo } from '../../types';

export const TIER8: TierInfo = {
  tier: 8,
  name: 'Konsep Prosedural & Skala Besar',
  description:
    'Materi untuk database server (SQL Server, PostgreSQL, MySQL): SQL dinamis yang aman, cursor vs pendekatan set-based, dan partisi tabel untuk data jutaan baris.',
};

const XP = 100;

export const MISSIONS_TIER8: ConceptMission[] = [
  {
    id: 't8-dynamic-sql',
    kind: 'concept',
    tier: 8,
    order: 52,
    title: 'SQL Dinamis untuk Laporan Fleksibel',
    concept: 'SQL Dinamis',
    story:
      'Direksi meminta satu stored procedure laporan kunjungan yang bisa difilter dan diurutkan sesuai pilihan pengguna: per poli, per penjamin, urut tanggal atau nama. Programmer senior mengusulkan SQL dinamis, tetapi tim keamanan mengingatkan bahwa SQL dinamis yang ditulis sembarangan adalah sumber SQL injection di level database.',
    task:
      'Pelajari cara menulis SQL dinamis yang aman di SQL Server, PostgreSQL, dan MySQL, lalu jawab SEMUA pertanyaan kuis dengan benar.',
    hint: [
      'NILAI (tanggal, id_poli, no_rm) selalu dikirim sebagai parameter: sp_executesql dengan @param di T-SQL, EXECUTE ... USING di PL/pgSQL, EXECUTE ... USING @var di MySQL.',
      'IDENTIFIER (nama tabel/kolom) tidak bisa menjadi parameter. Validasi dengan whitelist, lalu bungkus dengan QUOTENAME() (T-SQL) atau format(\'%I\') (PostgreSQL).',
      'EXEC(@sql) dengan string yang disambung dari input pengguna adalah pola paling berbahaya. Kalau query bisa ditulis statis, tulis statis.',
    ],
    xpReward: XP,
    sections: [
      {
        heading: 'Apa itu SQL dinamis?',
        body:
          'SQL dinamis adalah teks SQL yang dirakit saat program berjalan (runtime), lalu dieksekusi, biasanya di dalam stored procedure atau function. Bandingkan dengan SQL statis yang teksnya sudah pasti saat procedure dibuat.\n\nKapan dipakai: (1) kolom ORDER BY atau filter opsional yang dipilih pengguna, (2) PIVOT dengan daftar kolom yang baru diketahui saat runtime, misalnya satu kolom per poliklinik, (3) operasi pada nama tabel yang berubah, misalnya tabel arsip per tahun `kunjungan_2025`, (4) skrip administrasi seperti membuat index di banyak tabel.\n\nKapan dihindari: jika query bisa ditulis statis. SQL statis lebih mudah dibaca, dicek sintaksnya saat procedure dibuat, dan aman dari injection secara bawaan.',
      },
      {
        heading: 'SQL Server (T-SQL): sp_executesql dan QUOTENAME',
        body:
          '`EXEC(@sql)` hanya menerima satu string, sehingga nilai filter terpaksa disambung ke teks SQL. Ini berbahaya. `sp_executesql` menerima teks SQL berisi parameter (@nama) plus definisi dan nilai parameternya, mirip prepared statement. Bonusnya, execution plan bisa dipakai ulang.\n\nUntuk nama kolom/tabel, cocokkan dulu dengan whitelist, lalu bungkus dengan `QUOTENAME()` yang menghasilkan identifier berkurung siku `[tgl_kunjungan]` dan meng-escape karakter `]`.',
        examples: [
          {
            dialect: 'T-SQL (SQL Server)',
            caption: 'Filter sebagai parameter, kolom sort lewat whitelist + QUOTENAME.',
            code: `CREATE OR ALTER PROCEDURE dbo.usp_laporan_kunjungan
  @id_poli  CHAR(3),
  @dari     DATE,
  @sort_by  SYSNAME = N'tgl_kunjungan'
AS
BEGIN
  SET NOCOUNT ON;

  IF @sort_by NOT IN (N'tgl_kunjungan', N'no_rm', N'status')
    THROW 50001, N'Kolom urut tidak diizinkan', 1;

  DECLARE @sql NVARCHAR(MAX) = N'
    SELECT no_rawat, no_rm, tgl_kunjungan, status
    FROM dbo.kunjungan
    WHERE id_poli = @p_poli AND tgl_kunjungan >= @p_dari
    ORDER BY ' + QUOTENAME(@sort_by) + N';';

  EXEC sys.sp_executesql
    @sql,
    N'@p_poli CHAR(3), @p_dari DATE',
    @p_poli = @id_poli,
    @p_dari = @dari;
END;`,
          },
          {
            dialect: 'T-SQL (RENTAN, jangan ditiru)',
            code: `-- Nilai disambung langsung ke teks SQL: siapa pun yang mengontrol @id_poli
-- bisa mengubah struktur query.
DECLARE @sql NVARCHAR(MAX) =
  N'SELECT * FROM dbo.kunjungan WHERE id_poli = ''' + @id_poli + N'''';
EXEC (@sql);`,
          },
        ],
      },
      {
        heading: 'PostgreSQL (PL/pgSQL): EXECUTE format() ... USING',
        body:
          'Di PL/pgSQL, `EXECUTE` menjalankan string SQL. Fungsi `format()` punya penanda khusus: `%I` untuk identifier (otomatis diberi tanda kutip ganda jika perlu), `%L` untuk literal yang di-escape, dan `%s` untuk teks mentah yang sebaiknya dihindari untuk input pengguna. Nilai sebaiknya dikirim lewat `USING` dan dirujuk sebagai `$1`, `$2`, sehingga tidak masuk ke teks SQL sama sekali.',
        examples: [
          {
            dialect: 'PL/pgSQL (PostgreSQL)',
            code: `CREATE OR REPLACE FUNCTION laporan_kunjungan(p_tahun int, p_id_poli text)
RETURNS TABLE (no_rawat text, no_rm text, tgl_kunjungan date)
LANGUAGE plpgsql AS $$
BEGIN
  -- nama tabel arsip per tahun: identifier → %I
  RETURN QUERY EXECUTE format(
    'SELECT no_rawat, no_rm, tgl_kunjungan FROM %I WHERE id_poli = $1 ORDER BY tgl_kunjungan',
    'kunjungan_' || p_tahun
  )
  USING p_id_poli;  -- nilai → parameter $1
END;
$$;`,
          },
        ],
      },
      {
        heading: 'MySQL: PREPARE, EXECUTE, DEALLOCATE',
        body:
          'MySQL menyediakan prepared statement di level SQL. Teks SQL disimpan dalam variabel, di-`PREPARE`, lalu di-`EXECUTE` dengan `USING @variabel`. Placeholder `?` tetap hanya untuk nilai. Untuk identifier, pakai whitelist dan backtick. Setelah selesai, bebaskan dengan `DEALLOCATE PREPARE`.',
        examples: [
          {
            dialect: 'MySQL',
            code: `SET @sql = 'SELECT no_rawat, total_biaya FROM billing WHERE status_bayar = ? AND total_biaya >= ?';
SET @status = 'Belum Lunas';
SET @min = 1000000;

PREPARE stmt FROM @sql;
EXECUTE stmt USING @status, @min;
DEALLOCATE PREPARE stmt;`,
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'Di SQL Server, mengapa sp_executesql lebih dianjurkan daripada EXEC(@sql) untuk SQL dinamis yang berisi filter dari pengguna?',
        options: [
          'Karena sp_executesql otomatis menghapus kata kunci berbahaya',
          'Karena EXEC(@sql) tidak bisa menjalankan SELECT',
          'Karena sp_executesql berjalan dengan hak akses yang lebih rendah',
          'Karena sp_executesql mendukung parameter, sehingga nilai tidak disambung ke teks SQL dan plan bisa dipakai ulang',
        ],
        correctIndex: 3,
        explanation:
          'sp_executesql memisahkan teks SQL dan nilai parameter, mirip prepared statement. EXEC(@sql) memaksa nilai disambung sebagai teks.',
      },
      {
        id: 'q2',
        question: "Di PL/pgSQL, penanda format() mana yang tepat untuk menyisipkan NAMA TABEL seperti 'kunjungan_2025'?",
        options: ['%s', '%L', '%I', '$1'],
        correctIndex: 2,
        explanation:
          '%I memperlakukan argumen sebagai identifier dan memberi tanda kutip ganda bila perlu. %L untuk literal nilai, $1 untuk parameter USING yang hanya bisa berupa nilai, dan %s menyisipkan teks mentah.',
      },
      {
        id: 'q3',
        question: 'Laporan hanya perlu filter id_poli dan rentang tanggal yang selalu sama bentuknya. Pendekatan terbaik adalah...',
        options: [
          'SQL dinamis dengan EXEC agar fleksibel di masa depan',
          'SQL statis biasa dengan parameter, karena SQL dinamis tidak diperlukan',
          'Cursor yang membaca kunjungan satu per satu',
          'Membuat tabel baru untuk setiap poli',
        ],
        correctIndex: 1,
        explanation:
          'SQL dinamis menambah kompleksitas dan risiko. Pakai hanya jika struktur query (kolom, tabel, pivot) benar-benar berubah saat runtime.',
      },
      {
        id: 'q4',
        question: 'Apa fungsi QUOTENAME(@sort_by) pada contoh T-SQL?',
        options: [
          'Membungkus nama kolom dalam kurung siku dan meng-escape karakter ] sehingga tetap diperlakukan sebagai identifier',
          'Mengubah nilai menjadi parameter yang di-bind',
          'Mengecek apakah kolom tersebut ada di tabel',
          'Mengenkripsi nama kolom',
        ],
        correctIndex: 0,
        explanation:
          'QUOTENAME membuat identifier aman secara sintaks, tetapi tidak mengecek keberadaan kolom. Karena itu tetap dipadukan dengan whitelist.',
      },
    ],
  },
  {
    id: 't8-cursor',
    kind: 'concept',
    tier: 8,
    order: 53,
    title: 'Cursor vs Set-Based',
    concept: 'Cursor',
    story:
      'Proses tutup buku bulanan di bagian keuangan memakan waktu 3 jam. Setelah ditelusuri, stored procedure-nya memakai cursor yang membaca ratusan ribu tagihan satu per satu, lalu menjalankan UPDATE untuk setiap baris. Kepala Instalasi SIMRS meminta tim memahami kapan cursor memang perlu dan kapan harus diganti query set-based.',
    task:
      'Pelajari cara kerja cursor di T-SQL dan PL/pgSQL, bandingkan dengan pendekatan set-based, lalu jawab SEMUA pertanyaan kuis dengan benar.',
    hint: [
      'Database relasional dioptimalkan untuk memproses HIMPUNAN baris sekaligus. Cursor memproses satu baris per iterasi (row-by-row, sering dijuluki RBAR: row by agonizing row).',
      'Hampir semua logika "untuk setiap baris, ubah sesuatu" bisa ditulis sebagai satu UPDATE/INSERT ... SELECT dengan JOIN, CASE, atau window function.',
      'Cursor masih wajar dipakai untuk aksi yang memang harus per baris dan berada di luar SQL biasa, misalnya memanggil procedure lain per baris, atau memproses batch kecil agar lock tidak menumpuk.',
    ],
    xpReward: XP,
    sections: [
      {
        heading: 'Apa itu cursor?',
        body:
          'Cursor adalah "penunjuk" ke result set yang memungkinkan kode prosedural mengambil baris SATU PER SATU, mirip perulangan for di bahasa pemrograman. Siklus hidupnya di T-SQL: `DECLARE` (definisikan query), `OPEN` (jalankan), `FETCH NEXT` berulang sampai `@@FETCH_STATUS <> 0`, lalu `CLOSE` dan `DEALLOCATE`.\n\nSQLite tidak punya cursor di level SQL. Di aplikasi, perulangan `stmt.step()` di sql.js sebenarnya adalah cursor sisi klien.',
        examples: [
          {
            dialect: 'T-SQL (SQL Server)',
            caption: 'Menandai tagihan rawat jalan kecil sebagai Lunas, baris per baris (pola yang LAMBAT).',
            code: `DECLARE @id_billing INT, @total INT;

DECLARE cur_billing CURSOR LOCAL FAST_FORWARD FOR
  SELECT id_billing, total_biaya
  FROM dbo.billing
  WHERE status_bayar = 'Belum Lunas';

OPEN cur_billing;
FETCH NEXT FROM cur_billing INTO @id_billing, @total;

WHILE @@FETCH_STATUS = 0
BEGIN
  IF @total < 1000000
    UPDATE dbo.billing SET status_bayar = 'Lunas' WHERE id_billing = @id_billing;

  FETCH NEXT FROM cur_billing INTO @id_billing, @total;
END;

CLOSE cur_billing;
DEALLOCATE cur_billing;`,
          },
          {
            dialect: 'PL/pgSQL (PostgreSQL)',
            caption: 'FOR ... IN SELECT LOOP adalah cursor implisit yang lebih ringkas.',
            code: `DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id_billing, total_biaya FROM billing WHERE status_bayar = 'Belum Lunas'
  LOOP
    IF rec.total_biaya < 1000000 THEN
      UPDATE billing SET status_bayar = 'Lunas' WHERE id_billing = rec.id_billing;
    END IF;
  END LOOP;
END;
$$;`,
          },
        ],
      },
      {
        heading: 'Pendekatan set-based: satu statement untuk semua baris',
        body:
          'Logika kedua contoh di atas setara dengan SATU UPDATE. Database cukup memindai sekali, memakai index bila ada, menulis log transaksi secara efisien, dan mengambil lock dalam satu operasi. Pada ratusan ribu baris, bedanya bisa dari jam menjadi detik.\n\nPola "untuk setiap baris hitung sesuatu dari tabel lain" juga bisa set-based: UPDATE dengan subquery atau JOIN, INSERT ... SELECT, MERGE/UPSERT, atau window function (ROW_NUMBER, SUM OVER) untuk perhitungan berurutan seperti running total, yang dulu sering dikerjakan dengan cursor.',
        examples: [
          {
            dialect: 'SQL standar (juga jalan di SQLite)',
            code: `UPDATE billing
SET status_bayar = 'Lunas'
WHERE status_bayar = 'Belum Lunas'
  AND total_biaya < 1000000;`,
          },
          {
            dialect: 'T-SQL (UPDATE dengan JOIN)',
            caption: 'Menandai semua kunjungan yang tagihannya sudah lunas, tanpa loop.',
            code: `UPDATE k
SET k.status = 'Selesai'
FROM dbo.kunjungan AS k
JOIN dbo.billing AS b ON b.no_rawat = k.no_rawat
WHERE k.status = 'Dirawat'
  AND b.status_bayar = 'Lunas';`,
          },
        ],
      },
      {
        heading: 'Kapan cursor masih wajar?',
        body:
          'Cursor bukan terlarang, tetapi harus punya alasan kuat:\n\n1. Aksi per baris yang tidak bisa diekspresikan sebagai satu query, misalnya memanggil stored procedure lain (kirim notifikasi, panggil integrasi BPJS/SATUSEHAT melalui antrean) untuk setiap kunjungan.\n2. Skrip administrasi: perulangan atas daftar tabel atau database, misalnya rebuild index tiap tabel. Ini sering dipadukan dengan SQL dinamis.\n3. Memproses data sangat besar dalam batch kecil (misalnya 5.000 baris per transaksi) agar log dan lock tidak membengkak. Ini pun lebih sering dibuat dengan WHILE + UPDATE TOP (n) yang tetap set-based per batch.\n\nJika memakai cursor di T-SQL, pilih opsi ringan seperti `LOCAL FAST_FORWARD` (read-only, maju saja), dan selalu CLOSE/DEALLOCATE.',
      },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'Mengapa cursor yang menjalankan UPDATE per baris biasanya jauh lebih lambat daripada satu UPDATE set-based?',
        options: [
          'Karena setiap iterasi adalah eksekusi statement terpisah dengan overhead sendiri (parsing/plan, log, lock), sedangkan set-based diproses sekali secara optimal',
          'Karena cursor tidak bisa memakai index sama sekali',
          'Karena cursor hanya bisa membaca 100 baris',
          'Karena UPDATE di dalam cursor selalu memicu ROLLBACK',
        ],
        correctIndex: 0,
        explanation:
          'Overhead per statement dikalikan jumlah baris. Set-based membiarkan optimizer memilih strategi terbaik untuk seluruh himpunan.',
      },
      {
        id: 'q2',
        question: 'Di T-SQL, loop WHILE pada cursor berhenti ketika...',
        options: [
          '@@ROWCOUNT bernilai 0',
          'CLOSE dipanggil di awal loop',
          '@@ERROR bernilai 1',
          '@@FETCH_STATUS tidak lagi bernilai 0 (tidak ada baris yang berhasil di-fetch)',
        ],
        correctIndex: 3,
        explanation: '@@FETCH_STATUS = 0 berarti FETCH berhasil. Nilai lain (-1/-2) berarti baris habis atau hilang.',
      },
      {
        id: 'q3',
        question: 'Manakah kasus yang PALING wajar memakai cursor?',
        options: [
          'Menaikkan tarif semua tindakan 10%',
          'Menghitung total kumulatif pendapatan per tanggal',
          'Memanggil stored procedure pengiriman notifikasi untuk setiap pasien yang jadwal kontrolnya besok',
          'Menghapus semua diagnosa milik kunjungan yang batal',
        ],
        correctIndex: 2,
        explanation:
          'Memanggil procedure per baris tidak bisa diganti satu statement. Pilihan lain bisa dikerjakan dengan UPDATE, window function SUM() OVER, atau DELETE dengan subquery.',
      },
      {
        id: 'q4',
        question: 'Pada PL/pgSQL, konstruksi FOR rec IN SELECT ... LOOP pada dasarnya adalah...',
        options: [
          'Query set-based yang dieksekusi sekaligus',
          'Cursor implisit yang memproses hasil SELECT baris per baris',
          'Trigger yang berjalan otomatis',
          'Index sementara',
        ],
        correctIndex: 1,
        explanation:
          'PostgreSQL membuka cursor secara otomatis untuk loop tersebut. Sintaksnya ringkas, tetapi tetap row-by-row.',
      },
    ],
  },
  {
    id: 't8-partitioning',
    kind: 'concept',
    tier: 8,
    order: 54,
    title: 'Partisi Tabel untuk Data Bertahun-tahun',
    concept: 'Partisi Tabel',
    story:
      'Setelah SIMRS berjalan 8 tahun, tabel kunjungan berisi lebih dari 50 juta baris. Laporan bulanan melambat, backup memakan waktu lama, dan menghapus data yang lewat masa retensi membuat database terkunci berjam-jam. Konsultan database menyarankan partisi tabel berdasarkan tgl_kunjungan.',
    task:
      'Pelajari konsep partisi tabel (range partitioning, partition pruning) di PostgreSQL dan MySQL, kaitannya dengan EXPLAIN dan index, lalu jawab SEMUA pertanyaan kuis dengan benar.',
    hint: [
      'Partisi memecah SATU tabel logis menjadi beberapa tabel fisik (misalnya per bulan). Aplikasi tetap melakukan query ke tabel induk.',
      'Partition pruning hanya terjadi jika filter memakai kolom kunci partisi secara sargable, misalnya tgl_kunjungan >= ... AND tgl_kunjungan < ... Prinsipnya sama dengan misi query sargable.',
      'Keuntungan besar lainnya adalah pengelolaan data: menghapus data lama cukup dengan DROP/DETACH satu partisi, bukan DELETE jutaan baris.',
    ],
    xpReward: XP,
    sections: [
      {
        heading: 'Konsep: satu tabel logis, banyak potongan fisik',
        body:
          'Partisi tabel membagi data satu tabel ke beberapa potongan fisik berdasarkan kunci partisi. Jenis yang umum: RANGE (rentang nilai, cocok untuk tanggal), LIST (daftar nilai, misalnya per kode cabang RS), dan HASH (sebaran merata berdasarkan hash).\n\nUntuk tabel transaksi SIMRS seperti kunjungan, billing, dan log, RANGE per bulan atau per tahun pada kolom tanggal adalah pilihan paling umum, karena hampir semua laporan memfilter berdasarkan periode dan data lama jarang disentuh.\n\nSQLite tidak mendukung partisi. Materi ini untuk PostgreSQL/MySQL di server produksi.',
      },
      {
        heading: 'PostgreSQL: declarative partitioning',
        body:
          'Tabel induk dibuat dengan `PARTITION BY RANGE (kolom)`, lalu setiap partisi dibuat dengan `FOR VALUES FROM (...) TO (...)`. Batas bawah inklusif dan batas atas eksklusif, persis pola rentang sargable. Primary key pada tabel berpartisi WAJIB menyertakan kolom kunci partisi. Index yang dibuat di tabel induk otomatis dibuat di setiap partisi.',
        examples: [
          {
            dialect: 'PostgreSQL',
            code: `CREATE TABLE kunjungan (
  no_rawat       text        NOT NULL,
  no_rm          text        NOT NULL,
  id_poli        text        NOT NULL,
  id_dokter      text        NOT NULL,
  tgl_kunjungan  date        NOT NULL,
  no_sep         text,
  status         text        NOT NULL,
  PRIMARY KEY (no_rawat, tgl_kunjungan)       -- wajib memuat kunci partisi
) PARTITION BY RANGE (tgl_kunjungan);

CREATE TABLE kunjungan_2026_10 PARTITION OF kunjungan
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE kunjungan_2026_11 PARTITION OF kunjungan
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE kunjungan_default PARTITION OF kunjungan DEFAULT;

CREATE INDEX ON kunjungan (no_rm);           -- diturunkan ke semua partisi`,
          },
        ],
      },
      {
        heading: 'Partition pruning dan EXPLAIN',
        body:
          'Partition pruning artinya planner melewati partisi yang pasti tidak berisi data yang dicari. Query Oktober 2026 hanya menyentuh `kunjungan_2026_10`, bukan seluruh tabel 8 tahun. Kamu bisa membuktikannya dengan EXPLAIN: hanya partisi yang relevan yang muncul di plan.\n\nSyaratnya sama dengan index: filter harus sargable pada kolom kunci partisi. `WHERE date_trunc(\'month\', tgl_kunjungan) = \'2026-10-01\'` atau `EXTRACT(MONTH FROM tgl_kunjungan) = 10` membuat planner tidak bisa melakukan pruning, sehingga semua partisi dipindai. Partisi juga TIDAK menggantikan index. Di dalam partisi, filter no_rm tetap butuh index.',
        examples: [
          {
            dialect: 'PostgreSQL',
            code: `EXPLAIN
SELECT no_rawat, no_rm, status
FROM kunjungan
WHERE tgl_kunjungan >= DATE '2026-10-01'
  AND tgl_kunjungan <  DATE '2026-11-01';

-- Hasil (disederhanakan):
-- Seq Scan on kunjungan_2026_10 kunjungan
--   Filter: ((tgl_kunjungan >= '2026-10-01') AND (tgl_kunjungan < '2026-11-01'))
-- partisi lain tidak muncul = sudah di-prune`,
          },
          {
            dialect: 'PostgreSQL (retensi data)',
            caption: 'Mengarsipkan data lama tanpa DELETE jutaan baris.',
            code: `ALTER TABLE kunjungan DETACH PARTITION kunjungan_2018_01;
-- pindahkan ke storage arsip / dump, lalu:
DROP TABLE kunjungan_2018_01;`,
          },
        ],
      },
      {
        heading: 'MySQL dan data warehouse cloud',
        body:
          'MySQL (InnoDB) mendukung `PARTITION BY RANGE`, biasanya dengan `RANGE COLUMNS` untuk tanggal atau `TO_DAYS()`. Setiap kunci unik, termasuk primary key, harus memuat kolom partisi. `EXPLAIN` menampilkan kolom `partitions` untuk memastikan pruning terjadi.\n\nDi data warehouse cloud, idenya sama dengan istilah berbeda. BigQuery memakai partitioning (biasanya kolom tanggal) plus clustering, sementara Snowflake memakai micro-partition otomatis dan clustering key. Biaya query sering dihitung dari data yang dipindai, jadi filter pada kolom partisi langsung menghemat biaya.\n\nKapan TIDAK perlu partisi: tabel yang masih jutaan baris dengan index yang tepat biasanya sudah cukup cepat. Partisi menambah kompleksitas, misalnya aturan primary key, perawatan pembuatan partisi baru tiap bulan, dan query yang tidak memfilter kunci partisi bisa malah lebih lambat.',
        examples: [
          {
            dialect: 'MySQL',
            code: `CREATE TABLE billing_arsip (
  id_billing     INT          NOT NULL,
  no_rawat       VARCHAR(20)  NOT NULL,
  tgl_tagihan    DATE         NOT NULL,
  total_biaya    BIGINT       NOT NULL,
  status_bayar   VARCHAR(12)  NOT NULL,
  PRIMARY KEY (id_billing, tgl_tagihan)
)
PARTITION BY RANGE COLUMNS (tgl_tagihan) (
  PARTITION p2025 VALUES LESS THAN ('2026-01-01'),
  PARTITION p2026 VALUES LESS THAN ('2027-01-01'),
  PARTITION pmax  VALUES LESS THAN (MAXVALUE)
);

EXPLAIN SELECT SUM(total_biaya) FROM billing_arsip
WHERE tgl_tagihan >= '2026-10-01' AND tgl_tagihan < '2026-11-01';
-- kolom partitions: p2026`,
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'Apa yang dimaksud partition pruning?',
        options: [
          'Menghapus partisi lama secara otomatis setiap bulan',
          'Planner melewati partisi yang pasti tidak memuat data sesuai filter, sehingga hanya partisi relevan yang dipindai',
          'Mengompresi isi partisi agar lebih kecil',
          'Menggabungkan semua partisi menjadi satu sebelum query',
        ],
        correctIndex: 1,
        explanation: 'Pruning mengurangi data yang dibaca. Buktikan dengan EXPLAIN: partisi yang tidak relevan tidak muncul di plan.',
      },
      {
        id: 'q2',
        question: 'Tabel kunjungan dipartisi RANGE per bulan pada tgl_kunjungan. Filter mana yang memungkinkan pruning?',
        options: [
          'WHERE EXTRACT(MONTH FROM tgl_kunjungan) = 10',
          "WHERE to_char(tgl_kunjungan, 'YYYY-MM') = '2026-10'",
          "WHERE tgl_kunjungan >= '2026-10-01' AND tgl_kunjungan < '2026-11-01'",
          "WHERE no_rm = 'RM-0001'",
        ],
        correctIndex: 2,
        explanation:
          'Sama seperti index, kolom kunci partisi harus dibandingkan secara langsung (sargable). Filter no_rm tidak menyentuh kunci partisi sama sekali.',
      },
      {
        id: 'q3',
        question: 'Keuntungan operasional partisi untuk retensi data rekam medis lama adalah...',
        options: [
          'Data lama bisa dilepas dengan DETACH/DROP satu partisi, jauh lebih cepat daripada DELETE jutaan baris',
          'Index tidak diperlukan lagi',
          'Primary key boleh tidak unik',
          'Query tanpa filter tanggal menjadi lebih cepat',
        ],
        correctIndex: 0,
        explanation:
          'DROP/DETACH partisi adalah operasi metadata. DELETE massal menghasilkan log besar dan lock panjang. Index tetap diperlukan, dan query tanpa filter partisi justru tidak diuntungkan.',
      },
      {
        id: 'q4',
        question: 'Di PostgreSQL, mengapa PRIMARY KEY (no_rawat) saja tidak bisa dipakai pada tabel kunjungan yang dipartisi berdasarkan tgl_kunjungan?',
        options: [
          'Karena no_rawat bertipe text',
          'Karena tabel berpartisi tidak boleh punya primary key',
          'Karena tgl_kunjungan harus menjadi kolom pertama di tabel',
          'Karena constraint unik pada tabel berpartisi harus memuat semua kolom kunci partisi',
        ],
        correctIndex: 3,
        explanation:
          'Keunikan dijaga per partisi, sehingga kolom partisi harus ikut di PK/UNIQUE, misalnya PRIMARY KEY (no_rawat, tgl_kunjungan).',
      },
    ],
  },
];
