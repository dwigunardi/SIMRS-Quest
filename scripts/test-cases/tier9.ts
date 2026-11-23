/**
 * Test case Tier 9 (Desain Tabel & DDL). Misi 'schema' dinilai dari struktur + uji perilaku, jadi:
 * - jawaban salah mencakup constraint yang hilang/terlalu longgar/terlalu ketat dan tipe yang keliru;
 * - formulasi setara mencakup cara penulisan constraint yang berbeda (level kolom vs tabel, CREATE UNIQUE INDEX,
 *   CONSTRAINT bernama, REFERENCES tanpa kolom, VARCHAR) — semuanya harus diterima.
 */
import type { MissionTestCases } from './types';

const JADWAL_INSERTS = `INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai, kuota) VALUES ('D001', 'Senin', '08:00', '12:00', 25);
INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai) VALUES ('D007', 'Rabu', '13:00', '16:00');`;

function jadwal(columns: string): string {
  return `CREATE TABLE jadwal_praktik (\n${columns}\n);\n${JADWAL_INSERTS}`;
}

const J_ID = 'id_jadwal INTEGER PRIMARY KEY';
const J_DOKTER = 'id_dokter TEXT NOT NULL REFERENCES dokter (id_dokter)';
const J_HARI = "hari TEXT NOT NULL CHECK (hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'))";
const J_JAM = 'jam_mulai TEXT NOT NULL, jam_selesai TEXT NOT NULL';
const J_KUOTA = 'kuota INTEGER NOT NULL DEFAULT 20 CHECK (kuota > 0)';
const J_TAIL = 'CHECK (jam_selesai > jam_mulai), UNIQUE (id_dokter, hari)';

const ALTER_OK = "ALTER TABLE billing ADD COLUMN metode_bayar TEXT NOT NULL DEFAULT 'Tunai' CHECK (metode_bayar IN ('Tunai', 'Transfer', 'BPJS'));";
const UPDATE_BPJS =
  "UPDATE billing SET metode_bayar = 'BPJS' WHERE no_rawat IN (SELECT k.no_rawat FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm WHERE p.penjamin = 'BPJS');";

const UPSERT_VALUES = `INSERT INTO pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin) VALUES
  ('RM-0005', '3276052008880005', 'Rizky Ramadan', 'L', '1988-08-20', 'Bogor', 'BPJS'),
  ('RM-0014', '3216146811970014', 'Nur Aini', 'P', '1997-11-28', 'Bekasi', 'BPJS'),
  ('RM-0021', '3174032105990021', 'Larasati Putri', 'P', '1999-05-21', 'Jakarta', 'Asuransi')`;
const UPSERT_OK = `${UPSERT_VALUES}\nON CONFLICT (no_rm) DO UPDATE SET kota = excluded.kota, penjamin = excluded.penjamin;`;

const VIEW_SELECT = `SELECT k.no_rawat, p.no_rm, p.nama, pl.nama_poli, k.tgl_kunjungan, b.total_biaya, b.status_bayar
FROM billing b JOIN kunjungan k ON k.no_rawat = b.no_rawat JOIN pasien p ON p.no_rm = k.no_rm JOIN poliklinik pl ON pl.id_poli = k.id_poli`;

const LOG_TABLE = `CREATE TABLE log_status_bayar (
  id_log INTEGER PRIMARY KEY, id_billing INTEGER NOT NULL, status_lama TEXT NOT NULL, status_baru TEXT NOT NULL
);`;
const LOG_INSERT = 'INSERT INTO log_status_bayar (id_billing, status_lama, status_baru) VALUES (OLD.id_billing, OLD.status_bayar, NEW.status_bayar);';

function resep(noRawat: string, jumlah: string, aturan = "aturan_pakai TEXT NOT NULL DEFAULT '3x1'", tail = ''): string {
  return `CREATE TABLE resep (
  id_resep INTEGER PRIMARY KEY,
  ${noRawat},
  nama_obat TEXT NOT NULL,
  ${jumlah},
  ${aturan}${tail}
);`;
}

const KAMAR = `CREATE TABLE kamar (
  kode_kamar TEXT PRIMARY KEY, nama_ruang TEXT NOT NULL,
  kelas TEXT NOT NULL CHECK (kelas IN ('VIP', '1', '2', '3')),
  tarif_per_malam INTEGER NOT NULL CHECK (tarif_per_malam > 0)
);`;
const RAWAT_INAP = `CREATE TABLE rawat_inap (
  id_rawat_inap INTEGER PRIMARY KEY,
  no_rawat TEXT NOT NULL UNIQUE REFERENCES kunjungan (no_rawat),
  kode_kamar TEXT NOT NULL REFERENCES kamar (kode_kamar),
  tgl_masuk TEXT NOT NULL, tgl_keluar TEXT,
  CHECK (tgl_keluar IS NULL OR tgl_keluar >= tgl_masuk)
);`;
const BOSS_DATA = `INSERT INTO kamar VALUES ('MLT-01', 'Melati', '1', 750000), ('MLT-02', 'Melati', '2', 450000), ('ANG-01', 'Anggrek', 'VIP', 1500000);
INSERT INTO rawat_inap (no_rawat, kode_kamar, tgl_masuk, tgl_keluar) VALUES
  ('2026/10/03/000001', 'ANG-01', '2026-10-03', '2026-10-08'),
  ('2026/10/08/000001', 'MLT-01', '2026-10-08', NULL),
  ('2026/11/06/000001', 'MLT-02', '2026-11-06', NULL);`;
const BOSS_VIEW = `CREATE VIEW v_pasien_dirawat AS
SELECT r.no_rawat, p.nama, km.nama_ruang, km.kelas, r.tgl_masuk
FROM rawat_inap r JOIN kunjungan k ON k.no_rawat = r.no_rawat JOIN pasien p ON p.no_rm = k.no_rm JOIN kamar km ON km.kode_kamar = r.kode_kamar
WHERE r.tgl_keluar IS NULL;`;

export const TEST_CASES_TIER9: Record<string, MissionTestCases> = {
  't9-create-table': {
    wrong: [
      { label: 'tanpa CHECK hari (Minggu lolos)', answer: jadwal([J_ID, J_DOKTER, 'hari TEXT NOT NULL', J_JAM, J_KUOTA, J_TAIL].join(',\n')), reason: 'probe-mismatch' },
      { label: 'tanpa UNIQUE (id_dokter, hari)', answer: jadwal([J_ID, J_DOKTER, J_HARI, J_JAM, J_KUOTA, 'CHECK (jam_selesai > jam_mulai)'].join(',\n')), reason: 'schema-structure' },
      { label: 'kuota tanpa DEFAULT (insert tanpa kuota gagal)', answer: `CREATE TABLE jadwal_praktik (${[J_ID, J_DOKTER, J_HARI, J_JAM, 'kuota INTEGER NOT NULL CHECK (kuota > 0)', J_TAIL].join(', ')});` },
      { label: 'CHECK (kuota >= 0): kuota 0 lolos', answer: jadwal([J_ID, J_DOKTER, J_HARI, J_JAM, 'kuota INTEGER NOT NULL DEFAULT 20 CHECK (kuota >= 0)', J_TAIL].join(',\n')), reason: 'probe-mismatch' },
      { label: 'tanpa FOREIGN KEY ke dokter', answer: jadwal([J_ID, 'id_dokter TEXT NOT NULL', J_HARI, J_JAM, J_KUOTA, J_TAIL].join(',\n')), reason: 'schema-structure' },
      { label: 'jam bertipe TIME (afinitas NUMERIC)', answer: jadwal([J_ID, J_DOKTER, J_HARI, 'jam_mulai TIME NOT NULL, jam_selesai TIME NOT NULL', J_KUOTA, J_TAIL].join(',\n')), reason: 'schema-structure' },
      { label: 'jam_mulai boleh NULL', answer: jadwal([J_ID, J_DOKTER, J_HARI, 'jam_mulai TEXT, jam_selesai TEXT NOT NULL', J_KUOTA, J_TAIL].join(',\n')), reason: 'schema-structure' },
      { label: 'tanpa CHECK jam_selesai > jam_mulai', answer: jadwal([J_ID, J_DOKTER, J_HARI, J_JAM, J_KUOTA, 'UNIQUE (id_dokter, hari)'].join(',\n')), reason: 'probe-mismatch' },
      {
        label: 'urutan INSERT tertukar (id_jadwal berbeda)',
        answer: `CREATE TABLE jadwal_praktik (${[J_ID, J_DOKTER, J_HARI, J_JAM, J_KUOTA, J_TAIL].join(', ')});
INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai) VALUES ('D007', 'Rabu', '13:00', '16:00');
INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai, kuota) VALUES ('D001', 'Senin', '08:00', '12:00', 25);`,
        reason: 'cell-values',
      },
    ],
    correct: [
      {
        label: 'constraint tabel bernama + CREATE UNIQUE INDEX + VARCHAR',
        answer: `CREATE TABLE jadwal_praktik (
  id_jadwal INTEGER PRIMARY KEY,
  id_dokter VARCHAR(10) NOT NULL,
  hari VARCHAR(6) NOT NULL,
  jam_mulai CHAR(5) NOT NULL,
  jam_selesai CHAR(5) NOT NULL,
  kuota INT NOT NULL DEFAULT 20,
  CONSTRAINT fk_jadwal_dokter FOREIGN KEY (id_dokter) REFERENCES dokter,
  CONSTRAINT ck_hari CHECK (hari = 'Senin' OR hari = 'Selasa' OR hari = 'Rabu' OR hari = 'Kamis' OR hari = 'Jumat' OR hari = 'Sabtu'),
  CONSTRAINT ck_jam CHECK (jam_mulai < jam_selesai),
  CONSTRAINT ck_kuota CHECK (kuota >= 1)
);
CREATE UNIQUE INDEX uq_jadwal_dokter_hari ON jadwal_praktik (id_dokter, hari);
${JADWAL_INSERTS}`,
      },
      {
        label: 'UNIQUE (hari, id_dokter) — urutan kolom berbeda, aturan sama; kuota CHECK BETWEEN',
        answer: jadwal([J_ID, J_DOKTER, J_HARI, J_JAM, 'kuota INTEGER NOT NULL DEFAULT 20 CHECK (kuota BETWEEN 1 AND 500)', 'CHECK (jam_selesai > jam_mulai), UNIQUE (hari, id_dokter)'].join(',\n')),
      },
    ],
  },

  't9-alter-table': {
    wrong: [
      { label: 'kolom tanpa NOT NULL', answer: `ALTER TABLE billing ADD COLUMN metode_bayar TEXT DEFAULT 'Tunai' CHECK (metode_bayar IN ('Tunai', 'Transfer', 'BPJS'));\n${UPDATE_BPJS}`, reason: 'schema-structure' },
      { label: 'tanpa CHECK (Kartu Kredit lolos)', answer: `ALTER TABLE billing ADD COLUMN metode_bayar TEXT NOT NULL DEFAULT 'Tunai';\n${UPDATE_BPJS}`, reason: 'probe-mismatch' },
      { label: 'lupa UPDATE tagihan BPJS', answer: ALTER_OK, reason: 'cell-values' },
      { label: "UPDATE tanpa WHERE (semua jadi 'BPJS')", answer: `${ALTER_OK}\nUPDATE billing SET metode_bayar = 'BPJS';`, reason: 'cell-values' },
      { label: 'NOT NULL tanpa DEFAULT (ditolak SQLite)', answer: `ALTER TABLE billing ADD COLUMN metode_bayar TEXT NOT NULL CHECK (metode_bayar IN ('Tunai', 'Transfer', 'BPJS'));\n${UPDATE_BPJS}` },
      {
        label: 'membuat ulang tabel billing (kolom lain hilang)',
        answer: `DROP TABLE billing;\nCREATE TABLE billing (id_billing INTEGER PRIMARY KEY, no_rawat TEXT NOT NULL, metode_bayar TEXT NOT NULL DEFAULT 'Tunai');`,
      },
    ],
    correct: [
      {
        label: 'tanpa kata COLUMN, VARCHAR, CHECK dengan OR, UPDATE dengan EXISTS',
        answer: `ALTER TABLE billing ADD metode_bayar VARCHAR(10) NOT NULL DEFAULT 'Tunai' CHECK (metode_bayar = 'Tunai' OR metode_bayar = 'Transfer' OR metode_bayar = 'BPJS');
UPDATE billing SET metode_bayar = 'BPJS'
WHERE EXISTS (SELECT 1 FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm WHERE k.no_rawat = billing.no_rawat AND p.penjamin = 'BPJS');`,
      },
      { label: 'CONSTRAINT bernama', answer: `ALTER TABLE billing ADD COLUMN metode_bayar TEXT NOT NULL DEFAULT 'Tunai' CONSTRAINT ck_metode CHECK (metode_bayar IN ('BPJS', 'Transfer', 'Tunai'));\n${UPDATE_BPJS}` },
    ],
  },

  't9-upsert': {
    wrong: [
      { label: 'INSERT OR REPLACE (semua kolom tertimpa, nama ikut berubah)', answer: UPSERT_VALUES.replace('INSERT INTO', 'INSERT OR REPLACE INTO') + ';', reason: 'cell-values' },
      { label: 'nama ikut ditimpa', answer: `${UPSERT_VALUES}\nON CONFLICT (no_rm) DO UPDATE SET nama = excluded.nama, kota = excluded.kota, penjamin = excluded.penjamin;`, reason: 'cell-values' },
      { label: 'DO NOTHING (pasien lama tidak diperbarui)', answer: `${UPSERT_VALUES}\nON CONFLICT (no_rm) DO NOTHING;`, reason: 'cell-values' },
      { label: 'hanya kota yang diperbarui', answer: `${UPSERT_VALUES}\nON CONFLICT (no_rm) DO UPDATE SET kota = excluded.kota;`, reason: 'cell-values' },
      {
        label: 'UPDATE + INSERT terpisah (tanpa ON CONFLICT)',
        answer: `UPDATE pasien SET kota = 'Bogor', penjamin = 'BPJS' WHERE no_rm = 'RM-0005';
UPDATE pasien SET kota = 'Bekasi', penjamin = 'BPJS' WHERE no_rm = 'RM-0014';
INSERT INTO pasien VALUES ('RM-0021', '3174032105990021', 'Larasati Putri', 'P', '1999-05-21', 'Jakarta', 'Asuransi');`,
        reason: 'missing-construct',
      },
      { label: 'UPSERT benar + UPDATE tanpa WHERE', answer: `${UPSERT_OK}\nUPDATE pasien SET kota = 'Bogor';`, reason: 'cell-values' },
    ],
    correct: [
      { label: 'SET dengan row value', answer: `${UPSERT_VALUES}\nON CONFLICT (no_rm) DO UPDATE SET (kota, penjamin) = (excluded.kota, excluded.penjamin);` },
      {
        label: 'tanpa daftar kolom INSERT',
        answer: `INSERT INTO pasien VALUES
  ('RM-0005', '3276052008880005', 'Rizky Ramadan', 'L', '1988-08-20', 'Bogor', 'BPJS'),
  ('RM-0014', '3216146811970014', 'Nur Aini', 'P', '1997-11-28', 'Bekasi', 'BPJS'),
  ('RM-0021', '3174032105990021', 'Larasati Putri', 'P', '1999-05-21', 'Jakarta', 'Asuransi')
ON CONFLICT(no_rm) DO UPDATE SET penjamin = excluded.penjamin, kota = excluded.kota;`,
      },
    ],
  },

  't9-view': {
    wrong: [
      { label: 'CREATE TABLE … AS SELECT (salinan, bukan view)', answer: `CREATE TABLE v_tagihan_pasien AS\n${VIEW_SELECT};`, reason: 'schema-object' },
      {
        label: 'LEFT JOIN dari kunjungan (kunjungan tanpa tagihan ikut)',
        answer: `CREATE VIEW v_tagihan_pasien AS
SELECT k.no_rawat, p.no_rm, p.nama, pl.nama_poli, k.tgl_kunjungan, b.total_biaya, b.status_bayar
FROM kunjungan k LEFT JOIN billing b ON b.no_rawat = k.no_rawat JOIN pasien p ON p.no_rm = k.no_rm JOIN poliklinik pl ON pl.id_poli = k.id_poli;`,
        reason: 'row-count',
      },
      { label: 'hanya tagihan Belum Lunas', answer: `CREATE VIEW v_tagihan_pasien AS\n${VIEW_SELECT}\nWHERE b.status_bayar = 'Belum Lunas';`, reason: 'row-count' },
      {
        label: 'kolom nama_poli terlupa',
        answer: `CREATE VIEW v_tagihan_pasien AS
SELECT k.no_rawat, p.no_rm, p.nama, k.tgl_kunjungan, b.total_biaya, b.status_bayar
FROM billing b JOIN kunjungan k ON k.no_rawat = b.no_rawat JOIN pasien p ON p.no_rm = k.no_rm;`,
      },
    ],
    correct: [
      {
        label: 'daftar kolom di CREATE VIEW + JOIN … USING',
        answer: `CREATE VIEW IF NOT EXISTS v_tagihan_pasien (no_rawat, no_rm, nama, nama_poli, tgl_kunjungan, total_biaya, status_bayar) AS
SELECT no_rawat, no_rm, nama, nama_poli, tgl_kunjungan, total_biaya, status_bayar
FROM kunjungan JOIN billing USING (no_rawat) JOIN pasien USING (no_rm) JOIN poliklinik USING (id_poli);`,
      },
      { label: 'alias kolom eksplisit', answer: `CREATE VIEW v_tagihan_pasien AS\n${VIEW_SELECT.replace('SELECT k.no_rawat,', 'SELECT k.no_rawat AS no_rawat,')};` },
    ],
  },

  't9-trigger': {
    wrong: [
      { label: 'hanya tabel log, trigger belum dibuat', answer: LOG_TABLE, reason: 'schema-object' },
      { label: 'tanpa OF & tanpa WHEN (perubahan kolom lain ikut tercatat)', answer: `${LOG_TABLE}\nCREATE TRIGGER trg_log_status_bayar AFTER UPDATE ON billing BEGIN ${LOG_INSERT} END;`, reason: 'row-count' },
      { label: 'tanpa WHEN (nilai sama ikut tercatat)', answer: `${LOG_TABLE}\nCREATE TRIGGER trg_log_status_bayar AFTER UPDATE OF status_bayar ON billing BEGIN ${LOG_INSERT} END;`, reason: 'row-count' },
      {
        label: 'status lama & baru tertukar',
        answer: `${LOG_TABLE}\nCREATE TRIGGER trg_log_status_bayar AFTER UPDATE OF status_bayar ON billing WHEN OLD.status_bayar <> NEW.status_bayar
BEGIN INSERT INTO log_status_bayar (id_billing, status_lama, status_baru) VALUES (NEW.id_billing, NEW.status_bayar, OLD.status_bayar); END;`,
        reason: 'cell-values',
      },
      {
        label: 'trigger menjalankan UPDATE uji sendiri di skrip (log & billing ikut berubah)',
        answer: `${LOG_TABLE}\nCREATE TRIGGER trg_log_status_bayar AFTER UPDATE OF status_bayar ON billing WHEN OLD.status_bayar <> NEW.status_bayar BEGIN ${LOG_INSERT} END;\nUPDATE billing SET status_bayar = 'Lunas' WHERE id_billing = 4;`,
      },
    ],
    correct: [
      { label: 'BEFORE UPDATE + IS NOT', answer: `${LOG_TABLE}\nCREATE TRIGGER trg_log_status_bayar BEFORE UPDATE OF status_bayar ON billing FOR EACH ROW WHEN NEW.status_bayar IS NOT OLD.status_bayar BEGIN ${LOG_INSERT} END;` },
      { label: 'tanpa OF, tetapi WHEN menyaring perubahan status', answer: `${LOG_TABLE}\nCREATE TRIGGER trg_log_status_bayar AFTER UPDATE ON billing WHEN OLD.status_bayar <> NEW.status_bayar BEGIN ${LOG_INSERT} END;` },
    ],
  },

  't9-fix-resep': {
    wrong: [
      { label: 'hanya FOREIGN KEY yang diperbaiki (jumlah 0 lolos)', answer: resep('no_rawat TEXT NOT NULL REFERENCES kunjungan (no_rawat)', 'jumlah INTEGER NOT NULL CHECK (jumlah >= 0)'), reason: 'probe-mismatch' },
      { label: 'hanya CHECK yang diperbaiki (FK masih ke no_rm)', answer: resep('no_rawat TEXT NOT NULL REFERENCES kunjungan (no_rm)', 'jumlah INTEGER NOT NULL CHECK (jumlah > 0)'), reason: 'schema-structure' },
      { label: 'DEFAULT aturan pakai terhapus', answer: resep('no_rawat TEXT NOT NULL REFERENCES kunjungan (no_rawat)', 'jumlah INTEGER NOT NULL CHECK (jumlah > 0)', 'aturan_pakai TEXT NOT NULL'), reason: 'probe-mismatch' },
      { label: 'FOREIGN KEY dibuang', answer: resep('no_rawat TEXT NOT NULL', 'jumlah INTEGER NOT NULL CHECK (jumlah > 0)'), reason: 'schema-structure' },
    ],
    correct: [
      { label: 'REFERENCES tanpa kolom (= primary key induk)', answer: resep('no_rawat TEXT NOT NULL REFERENCES kunjungan', 'jumlah INTEGER NOT NULL CHECK (jumlah > 0)') },
      {
        label: 'FOREIGN KEY & CHECK sebagai constraint tabel, jumlah >= 1',
        answer: resep('no_rawat TEXT NOT NULL', 'jumlah INTEGER NOT NULL', "aturan_pakai TEXT NOT NULL DEFAULT '3x1'", ',\n  FOREIGN KEY (no_rawat) REFERENCES kunjungan (no_rawat),\n  CHECK (jumlah >= 1)'),
      },
    ],
  },

  'boss-t9-rawat-inap': {
    wrong: [
      { label: 'tanpa UNIQUE no_rawat (dirawat inap dua kali)', answer: `${KAMAR}\n${RAWAT_INAP.replace('NOT NULL UNIQUE REFERENCES', 'NOT NULL REFERENCES')}\n${BOSS_DATA}\n${BOSS_VIEW}`, reason: 'schema-structure' },
      { label: 'view tanpa WHERE tgl_keluar IS NULL', answer: `${KAMAR}\n${RAWAT_INAP}\n${BOSS_DATA}\n${BOSS_VIEW.replace('\nWHERE r.tgl_keluar IS NULL', '')}`, reason: 'row-count' },
      {
        label: 'tanpa CHECK tanggal keluar',
        answer: `${KAMAR}\n${RAWAT_INAP.replace(',\n  CHECK (tgl_keluar IS NULL OR tgl_keluar >= tgl_masuk)', '')}\n${BOSS_DATA}\n${BOSS_VIEW}`,
        reason: 'probe-mismatch',
      },
      { label: 'kelas kamar tanpa CHECK', answer: `${KAMAR.replace(" CHECK (kelas IN ('VIP', '1', '2', '3'))", '')}\n${RAWAT_INAP}\n${BOSS_DATA}\n${BOSS_VIEW}`, reason: 'probe-mismatch' },
      { label: 'view berupa tabel salinan', answer: `${KAMAR}\n${RAWAT_INAP}\n${BOSS_DATA}\n${BOSS_VIEW.replace('CREATE VIEW v_pasien_dirawat AS', 'CREATE TABLE v_pasien_dirawat AS')}`, reason: 'schema-object' },
    ],
    correct: [
      {
        label: 'CHECK tanggal tanpa IS NULL (NULL lolos CHECK) + UNIQUE INDEX + FK di level tabel',
        answer: `${KAMAR}
CREATE TABLE rawat_inap (
  id_rawat_inap INTEGER PRIMARY KEY,
  no_rawat TEXT NOT NULL,
  kode_kamar TEXT NOT NULL,
  tgl_masuk TEXT NOT NULL,
  tgl_keluar TEXT CHECK (tgl_keluar >= tgl_masuk),
  FOREIGN KEY (no_rawat) REFERENCES kunjungan (no_rawat),
  FOREIGN KEY (kode_kamar) REFERENCES kamar
);
CREATE UNIQUE INDEX uq_rawat_inap_no_rawat ON rawat_inap (no_rawat);
${BOSS_DATA}
${BOSS_VIEW}`,
      },
      {
        label: 'kelas dengan OR, view memakai LEFT JOIN kamar',
        answer: `${KAMAR.replace("CHECK (kelas IN ('VIP', '1', '2', '3'))", "CHECK (kelas = 'VIP' OR kelas = '1' OR kelas = '2' OR kelas = '3')")}
${RAWAT_INAP}
${BOSS_DATA}
CREATE VIEW v_pasien_dirawat AS
SELECT r.no_rawat, p.nama, km.nama_ruang, km.kelas, r.tgl_masuk
FROM rawat_inap r JOIN kunjungan k USING (no_rawat) JOIN pasien p USING (no_rm) LEFT JOIN kamar km ON km.kode_kamar = r.kode_kamar
WHERE r.tgl_keluar IS NULL;`,
      },
    ],
  },
};
