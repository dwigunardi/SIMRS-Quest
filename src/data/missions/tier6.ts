/**
 * Tier 6 – DML & Transaksi (misi 40–44; boss di misi 45).
 * Semua misi dinilai dengan grading 'state': solutionSql dijalankan di DB segar A,
 * SQL user di DB segar B, lalu hasil verifySql (membaca SELURUH tabel terdampak,
 * diurutkan per primary key) dibandingkan. Perubahan "nyasar" ke baris lain ikut terdeteksi,
 * dan isi SEMUA tabel lain juga dibandingkan (kerusakan kolateral). Misi transaksi (43–44)
 * dilacak per statement: setiap perubahan wajib berada di dalam transaksi, dan misi 44 wajib
 * punya ROLLBACK yang benar-benar membatalkan perubahan.
 */
import type { SqlMission, TierInfo } from '../../types';

export const TIER6: TierInfo = {
  tier: 6,
  name: 'DML & Transaksi',
  description:
    'Mengubah data dengan INSERT, UPDATE, dan DELETE secara presisi, lalu mengamankan perubahan berantai dengan transaksi (BEGIN, COMMIT, ROLLBACK).',
};

const XP = 200;

const KUNJUNGAN_DENGAN_BILLING = `SELECT
  k.no_rawat, k.no_rm, k.id_poli, k.id_dokter, k.tgl_kunjungan, k.no_sep, k.status,
  b.id_billing, b.total_biaya, b.status_bayar
FROM kunjungan AS k
LEFT JOIN billing AS b ON b.no_rawat = k.no_rawat
ORDER BY k.no_rawat;`;

export const MISSIONS_TIER6: SqlMission[] = [
  {
    id: 't6-insert',
    kind: 'sql',
    tier: 6,
    order: 40,
    title: 'Registrasi Pasien Baru',
    concept: 'INSERT INTO',
    story:
      'Seorang pasien baru datang ke loket pendaftaran rawat jalan. Aplikasi pendaftaran sedang gangguan, sehingga petugas meminta tim IT memasukkan data pasien langsung ke database agar nomor rekam medisnya bisa langsung dipakai.',
    task:
      "Tambahkan SATU baris ke tabel pasien dengan nilai: no_rm 'RM-0021', nik '3201212309940021', nama 'Dimas Prasetyo', jenis_kelamin 'L', tgl_lahir '1994-09-23', kota 'Bogor', penjamin 'BPJS'. Jangan mengubah baris lain. Penilaian dilakukan dengan membaca seluruh isi tabel pasien setelah query kamu dijalankan.",
    hint: [
      'Bentuk umum: INSERT INTO nama_tabel (kolom1, kolom2, ...) VALUES (nilai1, nilai2, ...); Menyebut daftar kolom secara eksplisit membuat query tetap benar walaupun urutan kolom tabel berubah.',
      "Semua kolom tabel pasien bertipe TEXT, termasuk nik dan tgl_lahir, jadi tulis nilainya dengan tanda kutip tunggal. Ingat aturan CHECK: jenis_kelamin hanya 'L'/'P', penjamin hanya 'BPJS'/'Umum'/'Asuransi' (huruf besar-kecil berpengaruh).",
      "Pastikan urutan nilai di VALUES sama persis dengan urutan kolom yang kamu sebutkan. Setelah INSERT, kamu boleh menambahkan SELECT * FROM pasien WHERE no_rm = 'RM-0021'; untuk mengecek hasilnya.",
    ],
    solutionSql: `INSERT INTO pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin)
VALUES ('RM-0021', '3201212309940021', 'Dimas Prasetyo', 'L', '1994-09-23', 'Bogor', 'BPJS');`,
    starterSql:
      '-- Daftarkan pasien baru RM-0021 ke tabel pasien\nINSERT INTO pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin)\nVALUES ',
    xpReward: XP,
    orderMatters: true,
    grading: {
      type: 'state',
      verifySql: 'SELECT * FROM pasien ORDER BY no_rm;',
      label: 'Isi tabel pasien',
    },
  },
  {
    id: 't6-update',
    kind: 'sql',
    tier: 6,
    order: 41,
    title: 'SEP yang Akhirnya Terbit',
    concept: 'UPDATE ... SET ... WHERE',
    story:
      'Petugas casemix mendapat kabar dari aplikasi V-Claim BPJS bahwa SEP (Surat Eligibilitas Peserta) untuk dua kunjungan sudah terbit. Nomornya harus dicatat ke kunjungan yang tepat. Kalau salah baris, klaim bisa ditolak BPJS.',
    task:
      "Di tabel kunjungan, isi kolom no_sep untuk dua kunjungan: no_rawat '2026/10/09/000001' diisi '0301R0011026V000110', dan no_rawat '2026/10/22/000001' diisi '0301R0011026V000118'. Baris lain tidak boleh berubah. Penilaian membaca seluruh isi tabel kunjungan.",
    hint: [
      'UPDATE tanpa WHERE mengubah SEMUA baris. Sebelum menjalankan UPDATE, biasakan menulis SELECT dengan WHERE yang sama untuk memastikan baris yang terkena memang yang dimaksud.',
      'Gunakan primary key (no_rawat) untuk menunjuk baris. Jangan memakai no_rm: satu pasien bisa punya banyak kunjungan, misalnya RM-0012 punya dua kunjungan yang SEP-nya sama-sama masih kosong.',
      "Karena nilai SEP tiap kunjungan berbeda, cara paling jelas adalah dua statement: UPDATE kunjungan SET no_sep = '...' WHERE no_rawat = '...'; lalu satu lagi untuk kunjungan kedua.",
    ],
    solutionSql: `UPDATE kunjungan SET no_sep = '0301R0011026V000110' WHERE no_rawat = '2026/10/09/000001';
UPDATE kunjungan SET no_sep = '0301R0011026V000118' WHERE no_rawat = '2026/10/22/000001';`,
    starterSql:
      "-- Cek dulu baris yang akan diubah:\n-- SELECT * FROM kunjungan WHERE no_rawat IN ('2026/10/09/000001', '2026/10/22/000001');\nUPDATE kunjungan\nSET no_sep = ",
    xpReward: XP,
    orderMatters: true,
    grading: {
      type: 'state',
      verifySql: 'SELECT * FROM kunjungan ORDER BY no_rawat;',
      label: 'Isi tabel kunjungan',
    },
  },
  {
    id: 't6-delete',
    kind: 'sql',
    tier: 6,
    order: 42,
    title: 'Koreksi Diagnosa Salah Input',
    concept: 'DELETE ... WHERE',
    story:
      'Dokter penanggung jawab mengoreksi rekam medis Sri Rahayu (kunjungan 2026/10/09/000001): diagnosa sekunder Hipertensi esensial (I10) ternyata salah input. Pasien tidak hipertensi, jadi baris itu harus dihapus agar laporan morbiditas dan klaim tidak keliru. Diagnosa primernya (Diabetes, E11.9) tetap benar.',
    task:
      "Hapus dari tabel diagnosa HANYA baris dengan no_rawat '2026/10/09/000001' dan kode_icd10 'I10'. Semua diagnosa lain, termasuk diagnosa I10 milik kunjungan lain dan diagnosa E11.9 di kunjungan yang sama, harus tetap ada. Penilaian membaca seluruh isi tabel diagnosa.",
    hint: [
      'Tulis dulu SELECT * FROM diagnosa WHERE ...; sampai hasilnya tepat satu baris yang ingin dihapus. Setelah itu baru ganti SELECT * menjadi DELETE.',
      "Satu syarat saja tidak cukup: kode_icd10 = 'I10' mengenai banyak kunjungan, sedangkan no_rawat = '2026/10/09/000001' juga mengenai diagnosa diabetes. Gabungkan kedua syarat dengan AND, atau pakai id_diagnosa yang kamu temukan dari SELECT.",
      'Catatan foreign key: kamu tidak bisa menghapus baris kunjungan yang masih punya diagnosa atau billing (FOREIGN KEY constraint failed). Di misi ini yang dihapus adalah baris anak di tabel diagnosa, jadi aman.',
    ],
    solutionSql: `DELETE FROM diagnosa
WHERE no_rawat = '2026/10/09/000001'
  AND kode_icd10 = 'I10';`,
    starterSql:
      "-- Langkah 1: pastikan targetnya tepat satu baris\nSELECT *\nFROM diagnosa\nWHERE no_rawat = '2026/10/09/000001';\n\n-- Langkah 2: ubah menjadi DELETE dengan syarat yang presisi\n",
    xpReward: XP,
    orderMatters: true,
    grading: {
      type: 'state',
      verifySql: 'SELECT * FROM diagnosa ORDER BY id_diagnosa;',
      label: 'Isi tabel diagnosa',
    },
  },
  {
    id: 't6-transaction-commit',
    kind: 'sql',
    tier: 6,
    order: 43,
    title: 'Batal Berobat: Semua atau Tidak Sama Sekali',
    concept: 'BEGIN ... COMMIT',
    story:
      'Kunjungan Dewi Lestari (2026/11/08/000001) ternyata registrasi ganda dan harus dibatalkan. Status kunjungannya diubah menjadi Batal, dan tagihannya (Rp225.000, Belum Lunas) dihapus. Dua perubahan ini harus terjadi bersamaan. Kalau listrik padam di tengah jalan, jangan sampai kunjungan sudah Batal tetapi tagihannya masih menagih pasien.',
    task:
      "Dalam SATU transaksi (BEGIN ... COMMIT): ubah status kunjungan '2026/11/08/000001' menjadi 'Batal', dan hapus baris billing milik no_rawat tersebut. Baris kunjungan TIDAK dihapus, hanya statusnya yang berubah. Akhiri dengan COMMIT. Penilaian membaca seluruh kunjungan beserta billing-nya (LEFT JOIN).",
    hint: [
      'Transaksi menjadikan beberapa perubahan satu unit: perubahan baru permanen saat COMMIT, dan bila transaksi tidak pernah di-COMMIT (koneksi putus, listrik padam, atau ROLLBACK) semuanya batal. Catatan: di SQLite, statement yang error TIDAK otomatis membatalkan seluruh transaksi; aplikasi harus menangkap error lalu menjalankan ROLLBACK. Polanya: BEGIN; statement 1; statement 2; COMMIT;',
      "Kamu butuh satu UPDATE kunjungan SET status = 'Batal' WHERE no_rawat = '...'; dan satu DELETE FROM billing WHERE no_rawat = '...'; dengan no_rawat yang sama.",
      'Jangan lupa COMMIT. Transaksi yang dibiarkan terbuka akan menahan lock dan, di misi ini, dianggap belum selesai. Di SQLite, END sama dengan COMMIT, tetapi misi ini meminta COMMIT (bentuk standar SQL).',
    ],
    solutionSql: `BEGIN;
UPDATE kunjungan SET status = 'Batal' WHERE no_rawat = '2026/11/08/000001';
DELETE FROM billing WHERE no_rawat = '2026/11/08/000001';
COMMIT;`,
    starterSql: '-- Batalkan kunjungan 2026/11/08/000001 secara atomik\nBEGIN;\n\n',
    xpReward: XP,
    orderMatters: true,
    grading: {
      type: 'state',
      verifySql: KUNJUNGAN_DENGAN_BILLING,
      label: 'Kunjungan + billing',
      transaction: { requireRolledBackChange: false },
    },
    requiredPatterns: [
      { pattern: String.raw`\bBEGIN\b`, message: 'Misi ini wajib dikerjakan di dalam transaksi: mulai dengan BEGIN;' },
      { pattern: String.raw`\bCOMMIT\b`, message: 'Transaksi harus diakhiri dengan COMMIT; agar perubahan tersimpan permanen.' },
    ],
  },
  {
    id: 't6-transaction-rollback',
    kind: 'sql',
    tier: 6,
    order: 44,
    title: 'Selamat Berkat ROLLBACK',
    concept: 'ROLLBACK',
    story:
      'Kasir hendak menandai lunas tagihan Wulan Sari (kunjungan 2026/10/22/000001, Rp500.000). Karena terburu-buru, ia menjalankan UPDATE tanpa WHERE, dan semua tagihan Belum Lunas, termasuk tagihan rawat inap belasan juta, ikut tercatat Lunas. Untungnya ia bekerja di dalam transaksi, jadi kesalahan itu masih bisa dibatalkan.',
    task:
      "Peragakan alur aman ini dalam satu skrip: (1) BEGIN; jalankan kesalahan UPDATE billing SET status_bayar = 'Lunas'; (boleh SELECT untuk melihat kerusakannya), lalu ROLLBACK; (2) BEGIN; ubah status_bayar menjadi 'Lunas' HANYA untuk billing dengan no_rawat '2026/10/22/000001'; COMMIT;. Kondisi akhir tabel billing harus hanya memuat perubahan yang benar. Penilaian membaca seluruh isi tabel billing.",
    hint: [
      'ROLLBACK membatalkan SEMUA perubahan sejak BEGIN terakhir, seolah tidak pernah terjadi. Setelah ROLLBACK, transaksinya selesai, jadi perubahan yang benar perlu BEGIN baru.',
      "Urutannya: BEGIN; UPDATE tanpa WHERE; ROLLBACK; BEGIN; UPDATE dengan WHERE no_rawat = '2026/10/22/000001'; COMMIT;",
      'ROLLBACK tanpa transaksi aktif akan error ("cannot rollback - no transaction is active"). Pastikan setiap ROLLBACK/COMMIT punya pasangan BEGIN.',
    ],
    solutionSql: `BEGIN;
UPDATE billing SET status_bayar = 'Lunas';
SELECT COUNT(*) AS jumlah_belum_lunas FROM billing WHERE status_bayar = 'Belum Lunas';
ROLLBACK;

BEGIN;
UPDATE billing SET status_bayar = 'Lunas' WHERE no_rawat = '2026/10/22/000001';
COMMIT;`,
    starterSql:
      "-- (1) Simulasi kesalahan di dalam transaksi\nBEGIN;\nUPDATE billing SET status_bayar = 'Lunas';  -- oops, lupa WHERE!\nSELECT status_bayar, COUNT(*) FROM billing GROUP BY status_bayar;\n-- batalkan di sini\n\n-- (2) Perubahan yang benar\n",
    xpReward: XP,
    orderMatters: true,
    grading: {
      type: 'state',
      verifySql: 'SELECT * FROM billing ORDER BY id_billing;',
      label: 'Isi tabel billing',
      transaction: { requireRolledBackChange: true },
    },
    requiredPatterns: [
      { pattern: String.raw`\bBEGIN\b`, message: 'Gunakan transaksi: mulai dengan BEGIN; sebelum membuat perubahan.' },
      {
        pattern: String.raw`\bROLLBACK\b`,
        message: 'Misi ini melatih ROLLBACK: jalankan dulu UPDATE yang salah di dalam transaksi, lalu batalkan dengan ROLLBACK;.',
      },
      { pattern: String.raw`\bCOMMIT\b`, message: 'Perubahan yang benar harus disimpan dengan COMMIT;.' },
    ],
  },
];
