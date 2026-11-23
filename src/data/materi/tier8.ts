/**
 * Materi untuk konsep yang diperkenalkan di Tier 8.
 * Kartu konsep tier 8 sudah memuat kode T-SQL / PL/pgSQL / MySQL yang lengkap; artikel di sini melengkapinya
 * dengan demonstrasi yang bisa dijalankan langsung di SQLite plus perbandingan dialek yang ringkas.
 */
import type { Article } from '../../types';

export const ARTICLES_TIER8: Article[] = [
  {
    id: 'sql-dinamis',
    title: 'SQL Dinamis',
    summary: 'Kapan teks query perlu disusun saat program berjalan, cara amannya (nilai lewat parameter, nama lewat whitelist), dan alternatif statis yang sering membuatnya tidak perlu.',
    tier: 8,
    missions: ['t8-dynamic-sql'],
    sections: [
      {
        heading: 'Kapan query "dinamis" dan kapan cukup statis',
        body: `SQL dinamis berarti teks query disusun saat program berjalan, lalu dieksekusi. Kebutuhan ini biasanya muncul di layar laporan SIMRS yang fleksibel: filter boleh diisi boleh kosong, kolom urutan dipilih pengguna, atau nama tabel arsip berganti per tahun.

Sebelum menyusun string, tanyakan dulu: **apakah bentuk query-nya benar-benar berubah?** Jika yang berubah hanya NILAI (poli mana, status apa, tanggal berapa), satu query statis dengan parameter sudah cukup. Filter opsional bisa ditulis dengan pola \`(:poli IS NULL OR id_poli = :poli)\`: jika parameter dikosongkan (NULL), syarat itu otomatis bernilai benar untuk semua baris.

Catatan: pola ini praktis tetapi **tidak sargable**. Dengan parameter sungguhan, SQLite tidak bisa memakai index pada kolom itu (plan menjadi \`SCAN\`, walau kolomnya ber-index), karena satu plan harus berlaku untuk parameter kosong maupun terisi. Untuk tabel besar, susun WHERE hanya dari filter yang diisi (nilainya tetap lewat parameter), atau di SQL Server tambahkan \`OPTION (RECOMPILE)\`.

Contoh di bawah menulis nilai parameter langsung sebagai literal karena contoh materi tidak bisa mengikat parameter. Bayangkan \`'P05'\` dan \`NULL\` itu adalah nilai yang dikirim aplikasi.`,
        examples: [
          {
            title: 'Filter opsional: poli diisi, status dikosongkan',
            sql: `SELECT no_rawat, id_poli, status, tgl_kunjungan
FROM kunjungan
WHERE ('P05' IS NULL OR id_poli = 'P05')  -- :poli = 'P05'
  AND (NULL IS NULL OR status = NULL)     -- :status = NULL (tidak dipilih)
ORDER BY tgl_kunjungan;`,
            note: 'Hasilnya 7 kunjungan Poli Jantung dengan status apa pun. Syarat status lolos untuk semua baris karena `NULL IS NULL` bernilai benar. Ganti `NULL` di kedua tempat dengan `\'Selesai\'` dan hasilnya tinggal 5 baris — query-nya tetap satu dan bentuknya sama.',
          },
          {
            title: 'Urutan pilihan pengguna tanpa menyusun string',
            sql: `SELECT no_rm, nama, kota
FROM pasien
WHERE penjamin = 'Asuransi'
ORDER BY                                  -- :urut = 'kota' (pilihan lain: 'nama')
  CASE WHEN 'kota' = 'nama' THEN nama END,
  CASE WHEN 'kota' = 'kota' THEN kota END,
  no_rm;`,
            note: 'Hanya CASE yang cocok yang menghasilkan nilai; CASE lainnya bernilai NULL untuk semua baris sehingga tidak memengaruhi urutan. Hasil: 4 pasien Asuransi terurut Bandung, Depok, Jakarta, Surabaya. Karena pilihan kolom sudah "dikunci" di dalam CASE, input pengguna tidak pernah menjadi bagian dari teks SQL.',
          },
        ],
      },
      {
        heading: 'Jika memang harus dinamis: nilai vs nama',
        body: `Ada dua jenis bagian query yang bisa datang dari luar, dan cara amannya berbeda:

- **Nilai** (angka, teks, tanggal): SELALU dikirim sebagai parameter/bind variable. Database menerimanya sebagai data, bukan kode, sehingga tanda kutip atau \`--\` di dalamnya tidak berbahaya.
- **Nama** (kolom, tabel, arah \`ASC\`/\`DESC\`): parameter TIDAK bisa menggantikan nama. Cocokkan input dengan **daftar putih** (whitelist) nama yang diizinkan di aplikasi, baru sisipkan. Fungsi pengutip nama (QUOTENAME, \`format('%I')\`, quote_ident) adalah lapisan tambahan, bukan pengganti whitelist.

Di SQLite tidak ada perintah SQL untuk mengeksekusi string. SQL dinamis hidup di aplikasi: program menyusun teks query, memanggil \`prepare()\`, lalu mengikat nilai dengan \`bind()\`. Prinsipnya sama persis dengan prepared statement di misi keamanan tier 7.`,
      },
    ],
    pitfalls: [
      'Menyambung input pengguna langsung ke string SQL "karena filternya dinamis" — inilah pintu SQL injection; nilai tetap harus lewat parameter.',
      'Mengira parameter bisa dipakai untuk nama kolom atau arah urutan (`ORDER BY ?`) — parameter hanya mengganti NILAI, jadi hasilnya mengurutkan berdasarkan konstanta.',
      'Memakai SQL dinamis padahal yang berubah hanya nilai filter: query jadi sulit dibaca, sulit di-cache, dan lebih berisiko. Pola `(:x IS NULL OR kolom = :x)` atau CASE sering sudah cukup (ingat: pola itu mengorbankan index, jadi untuk tabel besar susun WHERE dari filter yang diisi saja).',
    ],
    dialects: [
      {
        label: 'Menjalankan string SQL dengan parameter nilai',
        syntax: {
          sqlite: 'tidak ada di SQL — aplikasi menyusun teks, lalu prepare() + bind()',
          sqlServer: "EXEC sp_executesql @sql, N'@poli CHAR(3)', @poli = 'P05';",
          mysql: 'PREPARE s FROM @sql; EXECUTE s USING @poli; DEALLOCATE PREPARE s;',
          postgresql: 'EXECUTE format(...) USING v_poli;  -- di dalam PL/pgSQL',
          oracle: 'EXECUTE IMMEDIATE v_sql USING v_poli;  -- di dalam PL/SQL',
        },
        note: 'Di semua DBMS, parameter (USING / bind) hanya untuk NILAI, bukan untuk nama tabel atau kolom.',
      },
      {
        label: 'Menyisipkan nama kolom/tabel',
        syntax: {
          sqlite: 'whitelist di aplikasi, lalu bungkus "nama"',
          sqlServer: 'whitelist + QUOTENAME(@kolom)',
          mysql: 'whitelist, lalu bungkus `nama` (atau sys.quote_identifier(), MySQL 5.7+)',
          postgresql: "whitelist + format('%I', kolom) atau quote_ident(kolom)",
          oracle: 'whitelist + DBMS_ASSERT.SIMPLE_SQL_NAME(v_kolom)',
        },
      },
    ],
  },
  {
    id: 'cursor-set-based',
    title: 'Cursor vs Set-Based',
    summary: 'Berpikir per himpunan, bukan per baris: masalah yang terlihat butuh loop baris demi baris (saldo berjalan, data terbaru per grup, update bersyarat) bisa diselesaikan dengan satu query.',
    tier: 8,
    missions: ['t8-cursor'],
    sections: [
      {
        heading: 'Dari "untuk setiap baris…" ke "untuk semua baris sekaligus"',
        body: `Programmer yang terbiasa dengan bahasa prosedural sering menulis logika data sebagai loop: ambil baris pertama, hitung, simpan, ambil baris berikutnya. Di database, loop seperti itu ditulis dengan **cursor**. Masalahnya, setiap putaran adalah perjalanan bolak-balik antara logika prosedural dan mesin SQL, dan optimizer tidak bisa melihat pekerjaan secara utuh.

Cara berpikir **set-based** menyatakan HASIL yang diinginkan untuk seluruh himpunan baris dalam satu statement, lalu membiarkan database memilih cara tercepat. Tiga pola yang paling sering menggantikan cursor:

- **Nilai berjalan** (saldo kumulatif, nomor urut): window function \`SUM(...) OVER (ORDER BY ...)\`
- **Baris pertama/terbaru per grup**: \`ROW_NUMBER() OVER (PARTITION BY ...)\` lalu saring \`= 1\`
- **Perubahan bersyarat per baris**: satu UPDATE dengan \`CASE\`, bukan UPDATE berulang di dalam loop`,
        examples: [
          {
            title: 'Pendapatan kumulatif Poli Penyakit Dalam',
            sql: `SELECT k.tgl_kunjungan, k.no_rawat, b.total_biaya,
       SUM(b.total_biaya) OVER (ORDER BY k.tgl_kunjungan, k.no_rawat) AS kumulatif
FROM kunjungan k
JOIN billing b ON b.no_rawat = k.no_rawat
WHERE k.id_poli = 'P02'
ORDER BY k.tgl_kunjungan, k.no_rawat;`,
            note: 'Versi cursor akan menyimpan variabel "total sementara" dan menambahkannya setiap FETCH. Di sini satu window function menghasilkan 6 baris dengan kumulatif akhir 3.120.000.',
          },
          {
            title: 'Kunjungan terbaru setiap dokter',
            sql: `WITH urut AS (
  SELECT id_dokter, no_rawat, tgl_kunjungan,
         ROW_NUMBER() OVER (PARTITION BY id_dokter ORDER BY tgl_kunjungan DESC, no_rawat DESC) AS rn
  FROM kunjungan
)
SELECT id_dokter, no_rawat, tgl_kunjungan
FROM urut
WHERE rn = 1
ORDER BY id_dokter;`,
            note: 'Tanpa loop per dokter: 10 dokter, masing-masing tepat satu baris. Hanya D006 yang kunjungan terakhirnya masih di Oktober (2026-10-16).',
          },
        ],
      },
      {
        heading: 'Update bersyarat: pratinjau, lalu satu statement',
        body: `Misalkan beberapa poliklinik pindah gedung: Gedung A ke Gedung D, Gedung C ke Gedung E. Versi cursor membuka cursor atas poliklinik, memeriksa gedung tiap baris, lalu menjalankan UPDATE satu per satu.

Versi set-based menuliskan aturan perpindahan sebagai \`CASE\`. Biasakan **pratinjau dengan SELECT** memakai CASE yang sama, baru jalankan UPDATE-nya dengan WHERE yang membatasi baris yang memang berubah.

Cursor tetap wajar untuk pekerjaan yang memang harus berurutan atau memanggil proses lain per baris, misalnya mengirim notifikasi satu per satu atau memproses batch kecil untuk menghindari lock panjang. Untuk mengubah atau menghitung data, mulailah dari set-based.`,
        examples: [
          {
            title: 'Pratinjau perpindahan gedung (SELECT)',
            sql: `SELECT id_poli, nama_poli, gedung AS gedung_lama,
       CASE gedung
         WHEN 'Gedung A' THEN 'Gedung D'
         WHEN 'Gedung C' THEN 'Gedung E'
         ELSE gedung
       END AS gedung_baru
FROM poliklinik
ORDER BY id_poli;`,
            note: '7 poliklinik: 5 berubah gedung (3 dari Gedung A, 2 dari Gedung C), 2 di Gedung B tetap.',
          },
          {
            title: 'Satu UPDATE set-based untuk semua baris',
            run: 'playground',
            sql: `UPDATE poliklinik
SET gedung = CASE gedung
               WHEN 'Gedung A' THEN 'Gedung D'
               WHEN 'Gedung C' THEN 'Gedung E'
             END
WHERE gedung IN ('Gedung A', 'Gedung C');

SELECT id_poli, nama_poli, gedung FROM poliklinik ORDER BY id_poli;`,
            note: 'Satu statement mengubah 5 baris sekaligus. WHERE memastikan baris Gedung B tidak tersentuh, sehingga CASE tidak perlu ELSE.',
          },
        ],
      },
    ],
    pitfalls: [
      'Menerjemahkan logika prosedural apa adanya menjadi cursor + UPDATE per baris — untuk ribuan baris jauh lebih lambat daripada satu UPDATE set-based.',
      'Lupa menutup/membebaskan cursor (CLOSE + DEALLOCATE di T-SQL) sehingga sumber daya tertahan.',
      'Menjalankan UPDATE massal tanpa pratinjau SELECT dengan kondisi yang sama — kesalahan aturan langsung mengenai semua baris.',
    ],
    dialects: [
      {
        label: 'Loop baris demi baris',
        syntax: {
          sqlite: 'tidak ada cursor di SQL — aplikasi memanggil step() untuk setiap baris',
          sqlServer: 'DECLARE c CURSOR FOR ...; OPEN c; FETCH NEXT FROM c INTO @x; WHILE @@FETCH_STATUS = 0 ...',
          mysql: 'DECLARE c CURSOR FOR ...; DECLARE CONTINUE HANDLER FOR NOT FOUND ...; FETCH c INTO x;  -- hanya di stored procedure',
          postgresql: 'FOR rec IN SELECT ... LOOP ... END LOOP;  -- PL/pgSQL',
          oracle: 'FOR rec IN (SELECT ...) LOOP ... END LOOP;  -- PL/SQL',
        },
      },
      {
        label: 'UPDATE memakai tabel lain (set-based)',
        syntax: {
          sqlite: 'UPDATE t SET ... FROM t2 WHERE ...  -- sejak 3.33',
          sqlServer: 'UPDATE t SET ... FROM t JOIN t2 ON ...',
          mysql: 'UPDATE t JOIN t2 ON ... SET ...',
          postgresql: 'UPDATE t SET ... FROM t2 WHERE ...',
          oracle: 'MERGE INTO t USING t2 ON (...) WHEN MATCHED THEN UPDATE SET ...',
        },
      },
    ],
  },
  {
    id: 'partisi-tabel',
    title: 'Partisi Tabel',
    summary: 'Ide di balik partisi dan partition pruning — membaca hanya potongan data yang relevan — beserta analogi yang bisa dicoba langsung di SQLite.',
    tier: 8,
    missions: ['t8-partitioning'],
    sections: [
      {
        heading: 'Membaca hanya potongan yang perlu',
        body: `Tabel kunjungan rumah sakit tumbuh setiap hari. Setelah bertahun-tahun, kebanyakan laporan hanya menyentuh periode tertentu, misalnya bulan berjalan. Partisi memecah satu tabel logis menjadi beberapa potongan fisik berdasarkan **kunci partisi** (biasanya tanggal). Saat query menyaring kunci itu, database cukup membuka potongan yang relevan; potongan lain dilewati. Itulah **partition pruning**.

SQLite tidak punya partisi, tetapi idenya bisa dirasakan lewat index: dengan rentang tanggal yang ditulis langsung pada kolom, SQLite **mencari** (SEARCH) bagian index yang relevan alih-alih membaca seluruh tabel (SCAN). Syaratnya mirip pruning: kolom kunci harus dibandingkan apa adanya, tidak dibungkus fungsi (lihat materi **Query Sargable**).`,
        examples: [
          {
            title: 'Rentang tanggal → hanya bagian yang relevan dibaca',
            sql: `EXPLAIN QUERY PLAN
SELECT no_rawat, id_poli, status
FROM kunjungan
WHERE tgl_kunjungan >= '2026-11-01'
  AND tgl_kunjungan < '2026-12-01';`,
            note: 'Plan-nya `SEARCH kunjungan USING INDEX idx_kunjungan_tgl (tgl_kunjungan>? AND tgl_kunjungan<?)`: SQLite melompat ke awal November di index lalu berhenti di akhir rentang. Pada tabel berpartisi bulanan, filter yang sama membuat database hanya membuka partisi November.',
          },
        ],
      },
      {
        heading: 'Arsip + data aktif dengan UNION ALL',
        body: `Sebelum partisi bawaan tersedia di banyak DBMS, cara klasiknya adalah tabel terpisah per periode (mis. \`kunjungan_arsip\` dan \`kunjungan_aktif\`) yang digabung dengan \`UNION ALL\`, sering lewat sebuah VIEW. Data lama bisa dipindah atau dihapus per potongan tanpa \`DELETE\` besar di satu tabel raksasa — inilah keuntungan operasional yang sama dengan partisi.

Contoh berikut meniru pola itu dengan CTE: kunjungan dipecah menjadi potongan "arsip Oktober" dan "aktif November", lalu digabung kembali. Pada partisi sungguhan, pemecahan ini dilakukan database secara otomatis dan transparan.

Partisi bukan obat segala lambat. Ia membantu bila query hampir selalu menyaring kunci partisi dan datanya sangat besar. Untuk tabel kecil atau query yang tidak menyaring kunci partisi, index biasa sering lebih tepat.`,
        examples: [
          {
            title: 'Dua potongan, satu tabel logis',
            sql: `WITH arsip_oktober AS (
  SELECT no_rawat, status FROM kunjungan
  WHERE tgl_kunjungan >= '2026-10-01' AND tgl_kunjungan < '2026-11-01'
), aktif_november AS (
  SELECT no_rawat, status FROM kunjungan
  WHERE tgl_kunjungan >= '2026-11-01' AND tgl_kunjungan < '2026-12-01'
), semua AS (
  SELECT 'arsip Oktober' AS potongan, no_rawat, status FROM arsip_oktober
  UNION ALL
  SELECT 'aktif November', no_rawat, status FROM aktif_november
)
SELECT potongan, COUNT(*) AS jumlah_kunjungan, SUM(status = 'Batal') AS batal
FROM semua
GROUP BY potongan
ORDER BY potongan;`,
            note: 'Potongan arsip berisi 21 kunjungan (3 batal), potongan aktif 11 kunjungan (1 batal). `UNION ALL` (bukan `UNION`) dipakai karena potongan tidak saling tumpang tindih, jadi tidak perlu membuang duplikat.',
          },
        ],
      },
    ],
    pitfalls: [
      'Menyaring kunci partisi lewat fungsi (mis. mengambil tahun-bulan dari tanggal) — database tidak bisa menentukan potongan mana yang relevan, sehingga semua potongan dibaca.',
      'Memartisi tabel kecil atau memilih kunci partisi yang jarang dipakai di WHERE — kerumitan bertambah tanpa manfaat.',
      'Memakai `UNION` saat menggabungkan potongan yang tidak tumpang tindih — langkah pembuangan duplikat yang mahal dan tidak perlu; pakai `UNION ALL`.',
    ],
    dialects: [
      {
        label: 'Membuat tabel berpartisi per bulan',
        syntax: {
          sqlite: 'tidak ada — tiruan: tabel per periode + VIEW dengan UNION ALL',
          sqlServer: 'CREATE PARTITION FUNCTION pf (date) AS RANGE RIGHT FOR VALUES (...); CREATE PARTITION SCHEME ps ...; CREATE TABLE ... ON ps (tgl_kunjungan)',
          mysql: "PARTITION BY RANGE COLUMNS (tgl_kunjungan) (PARTITION p202611 VALUES LESS THAN ('2026-12-01'), ...)",
          postgresql: "PARTITION BY RANGE (tgl_kunjungan); CREATE TABLE kunjungan_2026_11 PARTITION OF kunjungan FOR VALUES FROM ('2026-11-01') TO ('2026-12-01')",
          oracle: "PARTITION BY RANGE (tgl_kunjungan) INTERVAL (NUMTOYMINTERVAL(1, 'MONTH')) (PARTITION p0 VALUES LESS THAN (DATE '2026-01-01'))",
        },
      },
      {
        label: 'Membuang data periode lama',
        syntax: {
          sqlite: "DELETE FROM ... WHERE tgl_kunjungan < '...'  (atau DROP tabel arsipnya)",
          sqlServer: 'TRUNCATE TABLE ... WITH (PARTITIONS (1))  -- sejak 2016; atau SWITCH PARTITION',
          mysql: 'ALTER TABLE kunjungan DROP PARTITION p202501',
          postgresql: 'ALTER TABLE kunjungan DETACH PARTITION kunjungan_2025_01; DROP TABLE kunjungan_2025_01',
          oracle: 'ALTER TABLE kunjungan DROP PARTITION p202501',
        },
      },
      {
        label: 'Melihat apakah pruning terjadi',
        syntax: {
          sqlite: 'EXPLAIN QUERY PLAN (menunjukkan SEARCH lewat index, bukan partisi)',
          sqlServer: 'actual execution plan — properti Actual Partition Count',
          mysql: 'EXPLAIN — kolom partitions',
          postgresql: 'EXPLAIN — hanya partisi yang relevan tercantum di plan',
          oracle: 'EXPLAIN PLAN — kolom Pstart / Pstop',
        },
      },
    ],
  },
];
