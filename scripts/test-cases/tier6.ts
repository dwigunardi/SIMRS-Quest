/**
 * Test case Tier 6 (DML & Transaksi, grading 'state').
 * Penilaian membandingkan isi tabel setelah SQL user vs setelah solutionSql,
 * sehingga perubahan yang "nyasar" ke baris lain (UPDATE/DELETE tanpa WHERE) ikut tertangkap.
 */
import type { MissionTestCases } from './types';

const INSERT_OK =
  "INSERT INTO pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin) VALUES ('RM-0021', '3201212309940021', 'Dimas Prasetyo', 'L', '1994-09-23', 'Bogor', 'BPJS');";

export const TEST_CASES_TIER6: Record<string, MissionTestCases> = {
  't6-insert': {
    wrong: [
      { label: 'INSERT benar + DELETE FROM billing (tabel lain rusak)', answer: `${INSERT_OK}\nDELETE FROM billing;`, reason: 'row-count' },
      { label: 'INSERT benar + DROP TABLE struktur_organisasi', answer: `${INSERT_OK}\nDROP TABLE struktur_organisasi;`, reason: 'no-result' },
      {
        label: 'jenis kelamin salah',
        answer:
          "INSERT INTO pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin) VALUES ('RM-0021', '3201212309940021', 'Dimas Prasetyo', 'P', '1994-09-23', 'Bogor', 'BPJS');",
        reason: 'cell-values',
      },
      {
        label: 'nilai tertukar (nama di kolom nik)',
        answer:
          "INSERT INTO pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin) VALUES ('RM-0021', 'Dimas Prasetyo', '3201212309940021', 'L', '1994-09-23', 'Bogor', 'BPJS');",
        reason: 'cell-values',
      },
      {
        label: "melanggar CHECK ('Laki-laki')",
        answer:
          "INSERT INTO pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin) VALUES ('RM-0021', '3201212309940021', 'Dimas Prasetyo', 'Laki-laki', '1994-09-23', 'Bogor', 'BPJS');",
      },
      {
        label: 'NIK duplikat (UNIQUE)',
        answer:
          "INSERT INTO pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin) VALUES ('RM-0021', '3201011203850001', 'Dimas Prasetyo', 'L', '1994-09-23', 'Bogor', 'BPJS');",
      },
      { label: 'hanya SELECT, tidak ada INSERT', answer: 'SELECT * FROM pasien;', reason: 'row-count' },
      {
        label: 'INSERT benar + UPDATE tanpa WHERE (kerusakan kolateral)',
        answer: `${INSERT_OK}\nUPDATE pasien SET kota = 'Bogor';`,
        reason: 'cell-values',
      },
    ],
    correct: [
      { label: 'solusi + SELECT pengecekan', answer: `${INSERT_OK}\nSELECT * FROM pasien WHERE no_rm = 'RM-0021';` },
      {
        label: 'urutan kolom berbeda',
        answer:
          "insert into pasien (nama, no_rm, penjamin, kota, tgl_lahir, jenis_kelamin, nik) values ('Dimas Prasetyo', 'RM-0021', 'BPJS', 'Bogor', '1994-09-23', 'L', '3201212309940021')",
      },
      {
        label: 'tanpa daftar kolom (urutan tabel)',
        answer: "INSERT INTO pasien VALUES ('RM-0021', '3201212309940021', 'Dimas Prasetyo', 'L', '1994-09-23', 'Bogor', 'BPJS');",
      },
    ],
  },
  't6-update': {
    wrong: [
      {
        label: 'UPDATE benar + DELETE FROM diagnosa (tabel lain rusak)',
        answer:
          "UPDATE kunjungan SET no_sep = '0301R0011026V000110' WHERE no_rawat = '2026/10/09/000001';\nUPDATE kunjungan SET no_sep = '0301R0011026V000118' WHERE no_rawat = '2026/10/22/000001';\nDELETE FROM diagnosa;",
        reason: 'row-count',
      },
      {
        label: 'UPDATE tanpa WHERE',
        answer:
          "UPDATE kunjungan SET no_sep = '0301R0011026V000110';\nUPDATE kunjungan SET no_sep = '0301R0011026V000118' WHERE no_rawat = '2026/10/22/000001';",
        reason: 'cell-values',
      },
      {
        label: 'memakai no_rm (RM-0012 punya 2 kunjungan)',
        answer:
          "UPDATE kunjungan SET no_sep = '0301R0011026V000110' WHERE no_rm = 'RM-0012';\nUPDATE kunjungan SET no_sep = '0301R0011026V000118' WHERE no_rm = 'RM-0020';",
        reason: 'cell-values',
      },
      {
        label: 'nomor SEP tertukar',
        answer:
          "UPDATE kunjungan SET no_sep = '0301R0011026V000118' WHERE no_rawat = '2026/10/09/000001';\nUPDATE kunjungan SET no_sep = '0301R0011026V000110' WHERE no_rawat = '2026/10/22/000001';",
        reason: 'cell-values',
      },
      {
        label: 'hanya satu kunjungan',
        answer: "UPDATE kunjungan SET no_sep = '0301R0011026V000110' WHERE no_rawat = '2026/10/09/000001';",
        reason: 'cell-values',
      },
    ],
    correct: [
      {
        label: 'satu UPDATE dengan CASE',
        answer:
          "UPDATE kunjungan SET no_sep = CASE no_rawat WHEN '2026/10/09/000001' THEN '0301R0011026V000110' ELSE '0301R0011026V000118' END WHERE no_rawat IN ('2026/10/09/000001', '2026/10/22/000001');",
      },
      {
        label: 'urutan statement dibalik, huruf kecil',
        answer:
          "update kunjungan set no_sep = '0301R0011026V000118' where no_rawat = '2026/10/22/000001';\nupdate kunjungan set no_sep = '0301R0011026V000110' where no_rawat = '2026/10/09/000001';",
      },
    ],
  },
  't6-delete': {
    wrong: [
      {
        label: 'DELETE benar + UPDATE billing tanpa WHERE (tabel lain rusak)',
        answer: 'DELETE FROM diagnosa WHERE id_diagnosa = 13;\nUPDATE billing SET total_biaya = 0;',
        reason: 'cell-values',
      },
      { label: 'hanya filter kode I10 (semua kunjungan)', answer: "DELETE FROM diagnosa WHERE kode_icd10 = 'I10';", reason: 'row-count' },
      {
        label: 'hanya filter no_rawat (diabetes ikut terhapus)',
        answer: "DELETE FROM diagnosa WHERE no_rawat = '2026/10/09/000001';",
        reason: 'row-count',
      },
      { label: 'DELETE tanpa WHERE', answer: 'DELETE FROM diagnosa;', reason: 'row-count' },
      { label: 'id salah (menghapus diagnosa primer)', answer: 'DELETE FROM diagnosa WHERE id_diagnosa = 12;', reason: 'cell-values' },
      {
        label: 'menghapus kunjungan (FK gagal)',
        answer: "DELETE FROM kunjungan WHERE no_rawat = '2026/10/09/000001';",
      },
    ],
    correct: [
      { label: 'pakai id_diagnosa', answer: 'DELETE FROM diagnosa WHERE id_diagnosa = 13;' },
      {
        label: 'no_rawat + jenis Sekunder',
        answer: "delete from diagnosa where jenis = 'Sekunder' and no_rawat = '2026/10/09/000001'",
      },
      {
        label: 'SELECT cek lalu DELETE',
        answer:
          "SELECT * FROM diagnosa WHERE no_rawat = '2026/10/09/000001' AND kode_icd10 = 'I10';\nDELETE FROM diagnosa WHERE no_rawat = '2026/10/09/000001' AND kode_icd10 = 'I10';",
      },
    ],
  },
  't6-transaction-commit': {
    wrong: [
      {
        label: 'DELETE di luar transaksi (setelah COMMIT)',
        answer:
          "BEGIN;\nUPDATE kunjungan SET status = 'Batal' WHERE no_rawat = '2026/11/08/000001';\nCOMMIT;\nDELETE FROM billing WHERE no_rawat = '2026/11/08/000001';",
        reason: 'transaction-flow',
      },
      {
        label: 'BEGIN; COMMIT; kosong lalu perubahan autocommit',
        answer:
          "BEGIN;\nCOMMIT;\nUPDATE kunjungan SET status = 'Batal' WHERE no_rawat = '2026/11/08/000001';\nDELETE FROM billing WHERE no_rawat = '2026/11/08/000001';",
        reason: 'transaction-flow',
      },
      {
        label: 'transaksi benar + DELETE FROM diagnosa sebelum COMMIT (tabel lain rusak)',
        answer:
          "BEGIN;\nUPDATE kunjungan SET status = 'Batal' WHERE no_rawat = '2026/11/08/000001';\nDELETE FROM billing WHERE no_rawat = '2026/11/08/000001';\nDELETE FROM diagnosa;\nCOMMIT;",
        reason: 'row-count',
      },
      {
        label: 'lupa COMMIT (transaksi terbuka)',
        answer:
          "BEGIN;\nUPDATE kunjungan SET status = 'Batal' WHERE no_rawat = '2026/11/08/000001';\nDELETE FROM billing WHERE no_rawat = '2026/11/08/000001';",
        reason: 'open-transaction',
      },
      {
        label: 'lupa menghapus billing',
        answer: "BEGIN;\nUPDATE kunjungan SET status = 'Batal' WHERE no_rawat = '2026/11/08/000001';\nCOMMIT;",
        reason: 'cell-values',
      },
      {
        label: 'menghapus baris kunjungan, bukan mengubah status',
        answer:
          "BEGIN;\nDELETE FROM billing WHERE no_rawat = '2026/11/08/000001';\nDELETE FROM kunjungan WHERE no_rawat = '2026/11/08/000001';\nCOMMIT;",
        reason: 'row-count',
      },
      {
        label: 'tanpa transaksi (state benar, konstruksi kurang)',
        answer:
          "UPDATE kunjungan SET status = 'Batal' WHERE no_rawat = '2026/11/08/000001';\nDELETE FROM billing WHERE no_rawat = '2026/11/08/000001';",
        reason: 'missing-construct',
      },
      {
        label: 'END sebagai pengganti COMMIT',
        answer:
          "BEGIN;\nUPDATE kunjungan SET status = 'Batal' WHERE no_rawat = '2026/11/08/000001';\nDELETE FROM billing WHERE no_rawat = '2026/11/08/000001';\nEND;",
        reason: 'missing-construct',
      },
      {
        label: 'DELETE billing tanpa WHERE (semua tagihan terhapus)',
        answer:
          "BEGIN;\nUPDATE kunjungan SET status = 'Batal' WHERE no_rawat = '2026/11/08/000001';\nDELETE FROM billing;\nCOMMIT;",
        reason: 'cell-values',
      },
      {
        label: 'UPDATE status tanpa WHERE (semua kunjungan batal)',
        answer:
          "BEGIN;\nUPDATE kunjungan SET status = 'Batal';\nDELETE FROM billing WHERE no_rawat = '2026/11/08/000001';\nCOMMIT;",
        reason: 'cell-values',
      },
      {
        label: 'diakhiri ROLLBACK (tidak ada yang tersimpan)',
        answer:
          "BEGIN;\nUPDATE kunjungan SET status = 'Batal' WHERE no_rawat = '2026/11/08/000001';\nDELETE FROM billing WHERE no_rawat = '2026/11/08/000001';\nROLLBACK;\nCOMMIT;",
      },
    ],
    correct: [
      {
        label: 'SELECT pengecekan di luar transaksi tidak dianggap perubahan',
        answer:
          "SELECT * FROM billing WHERE no_rawat = '2026/11/08/000001';\nBEGIN;\nUPDATE kunjungan SET status = 'Batal' WHERE no_rawat = '2026/11/08/000001';\nDELETE FROM billing WHERE no_rawat = '2026/11/08/000001';\nCOMMIT;\nSELECT * FROM kunjungan WHERE no_rawat = '2026/11/08/000001';",
      },
      {
        label: 'BEGIN TRANSACTION, DELETE dulu',
        answer:
          "BEGIN TRANSACTION;\nDELETE FROM billing WHERE no_rawat = '2026/11/08/000001';\nUPDATE kunjungan SET status = 'Batal' WHERE no_rawat = '2026/11/08/000001';\nCOMMIT TRANSACTION;",
      },
      {
        label: 'DELETE via id_billing + huruf kecil',
        answer:
          "begin;\nupdate kunjungan set status = 'Batal' where no_rawat = '2026/11/08/000001';\ndelete from billing where id_billing = 23;\ncommit;",
      },
    ],
  },
  't6-transaction-rollback': {
    wrong: [
      {
        label: 'ROLLBACK kosong (tidak ada kesalahan yang dibatalkan)',
        answer:
          "BEGIN;\nROLLBACK;\nBEGIN;\nUPDATE billing SET status_bayar = 'Lunas' WHERE no_rawat = '2026/10/22/000001';\nCOMMIT;",
        reason: 'transaction-flow',
      },
      {
        label: 'perubahan benar di autocommit setelah ROLLBACK',
        answer:
          "BEGIN;\nUPDATE billing SET status_bayar = 'Lunas';\nROLLBACK;\nUPDATE billing SET status_bayar = 'Lunas' WHERE no_rawat = '2026/10/22/000001';\nBEGIN;\nCOMMIT;",
        reason: 'transaction-flow',
      },
      {
        label: 'kesalahan di-COMMIT',
        answer: "BEGIN;\nUPDATE billing SET status_bayar = 'Lunas';\nCOMMIT;\nROLLBACK;",
      },
      {
        label: 'kesalahan ter-COMMIT, ROLLBACK di transaksi kedua',
        answer:
          "BEGIN;\nUPDATE billing SET status_bayar = 'Lunas';\nCOMMIT;\nBEGIN;\nUPDATE billing SET status_bayar = 'Lunas' WHERE no_rawat = '2026/10/22/000001';\nROLLBACK;",
        reason: 'cell-values',
      },
      {
        label: 'ROLLBACK tapi lupa perubahan yang benar',
        answer: "BEGIN;\nUPDATE billing SET status_bayar = 'Lunas';\nROLLBACK;",
        reason: 'cell-values',
      },
      {
        label: 'perubahan benar tanpa ROLLBACK',
        answer: "BEGIN;\nUPDATE billing SET status_bayar = 'Lunas' WHERE no_rawat = '2026/10/22/000001';\nCOMMIT;",
        reason: 'missing-construct',
      },
      {
        label: 'perubahan benar tapi lupa COMMIT',
        answer:
          "BEGIN;\nUPDATE billing SET status_bayar = 'Lunas';\nROLLBACK;\nBEGIN;\nUPDATE billing SET status_bayar = 'Lunas' WHERE no_rawat = '2026/10/22/000001';",
        reason: 'open-transaction',
      },
      {
        label: 'transaksi kedua juga UPDATE tanpa WHERE lalu COMMIT',
        answer:
          "BEGIN;\nUPDATE billing SET status_bayar = 'Lunas';\nROLLBACK;\nBEGIN;\nUPDATE billing SET status_bayar = 'Lunas';\nCOMMIT;",
        reason: 'cell-values',
      },
      {
        label: 'perubahan benar lalu di-ROLLBACK',
        answer:
          "BEGIN;\nUPDATE billing SET status_bayar = 'Lunas' WHERE no_rawat = '2026/10/22/000001';\nROLLBACK;\nCOMMIT;",
      },
    ],
    correct: [
      {
        label: 'tanpa SELECT, pakai id_billing',
        answer:
          "BEGIN;\nUPDATE billing SET status_bayar = 'Lunas';\nROLLBACK;\nBEGIN;\nUPDATE billing SET status_bayar = 'Lunas' WHERE id_billing = 16;\nCOMMIT;",
      },
      {
        label: 'kata TRANSACTION eksplisit',
        answer:
          "BEGIN TRANSACTION;\nUPDATE billing SET status_bayar = 'Lunas' WHERE status_bayar = 'Belum Lunas';\nSELECT * FROM billing;\nROLLBACK TRANSACTION;\nBEGIN TRANSACTION;\nUPDATE billing SET status_bayar = 'Lunas' WHERE no_rawat = '2026/10/22/000001';\nCOMMIT TRANSACTION;",
      },
    ],
  },
};
