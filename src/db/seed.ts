/**
 * Skema & data dummy SIMRS. Murni string SQL tanpa dependensi browser,
 * sehingga bisa dipakai di aplikasi (browser) maupun script verifikasi (Node).
 */

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE pasien (
  no_rm          TEXT PRIMARY KEY,
  nik            TEXT NOT NULL UNIQUE,
  nama           TEXT NOT NULL,
  jenis_kelamin  TEXT NOT NULL CHECK (jenis_kelamin IN ('L', 'P')),
  tgl_lahir      TEXT NOT NULL,
  kota           TEXT NOT NULL,
  penjamin       TEXT NOT NULL CHECK (penjamin IN ('BPJS', 'Umum', 'Asuransi'))
);

CREATE TABLE poliklinik (
  id_poli    TEXT PRIMARY KEY,
  nama_poli  TEXT NOT NULL,
  gedung     TEXT NOT NULL
);

CREATE TABLE dokter (
  id_dokter     TEXT PRIMARY KEY,
  nama_dokter   TEXT NOT NULL,
  spesialisasi  TEXT NOT NULL,
  id_poli       TEXT NOT NULL REFERENCES poliklinik (id_poli)
);

CREATE TABLE kunjungan (
  no_rawat       TEXT PRIMARY KEY,
  no_rm          TEXT NOT NULL REFERENCES pasien (no_rm),
  id_poli        TEXT NOT NULL REFERENCES poliklinik (id_poli),
  id_dokter      TEXT NOT NULL REFERENCES dokter (id_dokter),
  tgl_kunjungan  TEXT NOT NULL,
  no_sep         TEXT NULL,
  status         TEXT NOT NULL CHECK (status IN ('Selesai', 'Dirawat', 'Batal'))
);

CREATE TABLE diagnosa (
  id_diagnosa    INTEGER PRIMARY KEY,
  no_rawat       TEXT NOT NULL REFERENCES kunjungan (no_rawat),
  kode_icd10     TEXT NOT NULL,
  nama_penyakit  TEXT NOT NULL,
  jenis          TEXT NOT NULL CHECK (jenis IN ('Primer', 'Sekunder'))
);

CREATE TABLE billing (
  id_billing    INTEGER PRIMARY KEY,
  no_rawat      TEXT NOT NULL UNIQUE REFERENCES kunjungan (no_rawat),
  total_biaya   INTEGER NOT NULL CHECK (total_biaya >= 0),
  status_bayar  TEXT NOT NULL CHECK (status_bayar IN ('Lunas', 'Belum Lunas'))
);

-- Struktur organisasi RS (hierarki atasan-bawahan) untuk latihan recursive query.
CREATE TABLE struktur_organisasi (
  id_jabatan    TEXT PRIMARY KEY,
  nama_jabatan  TEXT NOT NULL,
  nama_pejabat  TEXT NOT NULL,
  id_atasan     TEXT NULL REFERENCES struktur_organisasi (id_jabatan)
);

-- Log pengiriman resource FHIR ke platform SATUSEHAT (Kemenkes). payload & response berupa teks JSON.
CREATE TABLE satusehat_log (
  id_log         INTEGER PRIMARY KEY,
  no_rawat       TEXT NOT NULL REFERENCES kunjungan (no_rawat),
  resource_type  TEXT NOT NULL,
  payload        TEXT NOT NULL CHECK (json_valid(payload)),
  status_kirim   TEXT NOT NULL CHECK (status_kirim IN ('Terkirim', 'Gagal', 'Antri')),
  waktu_kirim    TEXT NULL,
  response       TEXT NULL CHECK (response IS NULL OR json_valid(response))
);

-- Index pada kolom foreign key / kolom filter yang sering dipakai.
-- Catatan: diagnosa(kode_icd10) SENGAJA belum diberi index (dipakai di misi optimasi).
CREATE INDEX idx_kunjungan_no_rm   ON kunjungan (no_rm);
CREATE INDEX idx_kunjungan_tgl     ON kunjungan (tgl_kunjungan);
CREATE INDEX idx_kunjungan_dokter  ON kunjungan (id_dokter);
CREATE INDEX idx_diagnosa_no_rawat ON diagnosa (no_rawat);
`;

export const SEED_SQL = `
INSERT INTO poliklinik (id_poli, nama_poli, gedung) VALUES
  ('P01', 'Poli Umum',            'Gedung A'),
  ('P02', 'Poli Penyakit Dalam',  'Gedung A'),
  ('P03', 'Poli Anak',            'Gedung B'),
  ('P04', 'Poli Kandungan',       'Gedung B'),
  ('P05', 'Poli Jantung',         'Gedung C'),
  ('P06', 'Poli Saraf',           'Gedung C'),
  ('P07', 'Poli Gigi',            'Gedung A');

INSERT INTO dokter (id_dokter, nama_dokter, spesialisasi, id_poli) VALUES
  ('D001', 'dr. Andi Pratama',          'Dokter Umum',                 'P01'),
  ('D002', 'dr. Sari Wulandari',        'Dokter Umum',                 'P01'),
  ('D003', 'dr. Budi Santoso, Sp.PD',   'Spesialis Penyakit Dalam',    'P02'),
  ('D004', 'dr. Ratna Dewi, Sp.PD',     'Spesialis Penyakit Dalam',    'P02'),
  ('D005', 'dr. Hendra Gunawan, Sp.A',  'Spesialis Anak',              'P03'),
  ('D006', 'dr. Maya Kusuma, Sp.OG',    'Spesialis Obstetri Ginekologi','P04'),
  ('D007', 'dr. Agus Salim, Sp.JP',     'Spesialis Jantung',           'P05'),
  ('D008', 'dr. Fitri Handayani, Sp.N', 'Spesialis Saraf',             'P06'),
  ('D009', 'drg. Lestari Putri',        'Dokter Gigi',                 'P07'),
  ('D010', 'dr. Yoga Permana, Sp.JP',   'Spesialis Jantung',           'P05');

INSERT INTO pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin) VALUES
  ('RM-0001', '3201011203850001', 'Ahmad Fauzi',        'L', '1985-03-12', 'Bogor',     'BPJS'),
  ('RM-0002', '3273024507900002', 'Siti Nurhaliza',     'P', '1990-07-05', 'Bandung',   'BPJS'),
  ('RM-0003', '3171031511780003', 'Bambang Sutrisno',   'L', '1978-11-15', 'Jakarta',   'Umum'),
  ('RM-0004', '3175046202950004', 'Dewi Lestari',       'P', '1995-02-22', 'Jakarta',   'Asuransi'),
  ('RM-0005', '3276052008880005', 'Rizky Ramadhan',     'L', '1988-08-20', 'Depok',     'BPJS'),
  ('RM-0006', '3216064109010006', 'Putri Ayu Ningsih',  'P', '2001-09-01', 'Bekasi',    'BPJS'),
  ('RM-0007', '3603071007650007', 'Joko Susilo',        'L', '1965-07-10', 'Tangerang', 'Umum'),
  ('RM-0008', '3578085312920008', 'Indah Permatasari',  'P', '1992-12-13', 'Surabaya',  'Asuransi'),
  ('RM-0009', '3201092504180009', 'Muhammad Alif',      'L', '2018-04-25', 'Bogor',     'BPJS'),
  ('RM-0010', '3273106603200010', 'Aisyah Zahra',       'P', '2020-03-26', 'Bandung',   'BPJS'),
  ('RM-0011', '3171110101550011', 'Sutarno',            'L', '1955-01-01', 'Jakarta',   'BPJS'),
  ('RM-0012', '3175125806700012', 'Sri Rahayu',         'P', '1970-06-18', 'Jakarta',   'BPJS'),
  ('RM-0013', '3276131409830013', 'Hendro Wibowo',      'L', '1983-09-14', 'Depok',     'Asuransi'),
  ('RM-0014', '3216146811970014', 'Nur Aini',           'P', '1997-11-28', 'Bekasi',    'Umum'),
  ('RM-0015', '3603150305600015', 'Slamet Riyadi',      'L', '1960-05-03', 'Tangerang', 'BPJS'),
  ('RM-0016', '3578164402990016', 'Anisa Rahmawati',    'P', '1999-02-04', 'Surabaya',  'BPJS'),
  ('RM-0017', '3201171712750017', 'Agus Setiawan',      'L', '1975-12-17', 'Bogor',     'Umum'),
  ('RM-0018', '3273185108860018', 'Rina Marlina',       'P', '1986-08-11', 'Bandung',   'Asuransi'),
  ('RM-0019', '3171192006930019', 'Fajar Nugroho',      'L', '1993-06-20', 'Jakarta',   'BPJS'),
  ('RM-0020', '3175206710820020', 'Wulan Sari',         'P', '1982-10-27', 'Jakarta',   'BPJS');

INSERT INTO kunjungan (no_rawat, no_rm, id_poli, id_dokter, tgl_kunjungan, no_sep, status) VALUES
  ('2026/10/01/000001', 'RM-0001', 'P02', 'D003', '2026-10-01', '0301R0011026V000101', 'Selesai'),
  ('2026/10/01/000002', 'RM-0002', 'P04', 'D006', '2026-10-01', '0301R0011026V000102', 'Selesai'),
  ('2026/10/02/000001', 'RM-0003', 'P01', 'D001', '2026-10-02', NULL,                  'Selesai'),
  ('2026/10/03/000001', 'RM-0004', 'P05', 'D007', '2026-10-03', NULL,                  'Dirawat'),
  ('2026/10/03/000002', 'RM-0005', 'P01', 'D002', '2026-10-03', NULL,                  'Selesai'),
  ('2026/10/05/000001', 'RM-0006', 'P04', 'D006', '2026-10-05', '0301R0011026V000106', 'Selesai'),
  ('2026/10/06/000001', 'RM-0009', 'P03', 'D005', '2026-10-06', '0301R0011026V000107', 'Selesai'),
  ('2026/10/07/000001', 'RM-0010', 'P03', 'D005', '2026-10-07', NULL,                  'Batal'),
  ('2026/10/08/000001', 'RM-0011', 'P05', 'D007', '2026-10-08', '0301R0011026V000109', 'Dirawat'),
  ('2026/10/09/000001', 'RM-0012', 'P02', 'D004', '2026-10-09', NULL,                  'Selesai'),
  ('2026/10/10/000001', 'RM-0007', 'P06', 'D008', '2026-10-10', NULL,                  'Selesai'),
  ('2026/10/12/000001', 'RM-0008', 'P01', 'D001', '2026-10-12', NULL,                  'Selesai'),
  ('2026/10/14/000001', 'RM-0013', 'P05', 'D010', '2026-10-14', NULL,                  'Selesai'),
  ('2026/10/15/000001', 'RM-0015', 'P02', 'D003', '2026-10-15', '0301R0011026V000114', 'Selesai'),
  ('2026/10/16/000001', 'RM-0016', 'P04', 'D006', '2026-10-16', '0301R0011026V000115', 'Selesai'),
  ('2026/10/18/000001', 'RM-0001', 'P05', 'D007', '2026-10-18', '0301R0011026V000116', 'Selesai'),
  ('2026/10/20/000001', 'RM-0014', 'P01', 'D002', '2026-10-20', NULL,                  'Batal'),
  ('2026/10/22/000001', 'RM-0020', 'P06', 'D008', '2026-10-22', NULL,                  'Selesai'),
  ('2026/10/24/000001', 'RM-0007', 'P06', 'D008', '2026-10-24', NULL,                  'Batal'),
  ('2026/10/25/000001', 'RM-0002', 'P01', 'D001', '2026-10-25', '0301R0011026V000119', 'Selesai'),
  ('2026/10/28/000001', 'RM-0011', 'P02', 'D003', '2026-10-28', '0301R0011026V000120', 'Selesai'),
  ('2026/11/02/000001', 'RM-0003', 'P05', 'D010', '2026-11-02', NULL,                  'Selesai'),
  ('2026/11/03/000001', 'RM-0009', 'P03', 'D005', '2026-11-03', '0301R0011126V000122', 'Selesai'),
  ('2026/11/04/000001', 'RM-0005', 'P02', 'D004', '2026-11-04', '0301R0011126V000123', 'Selesai'),
  ('2026/11/05/000001', 'RM-0006', 'P01', 'D002', '2026-11-05', NULL,                  'Batal'),
  ('2026/11/06/000001', 'RM-0012', 'P06', 'D008', '2026-11-06', NULL,                  'Dirawat'),
  ('2026/11/08/000001', 'RM-0004', 'P01', 'D001', '2026-11-08', NULL,                  'Selesai'),
  ('2026/11/10/000001', 'RM-0015', 'P05', 'D007', '2026-11-10', '0301R0011126V000127', 'Selesai'),
  ('2026/11/12/000001', 'RM-0016', 'P07', 'D009', '2026-11-12', '0301R0011126V000128', 'Selesai'),
  ('2026/11/13/000001', 'RM-0013', 'P05', 'D010', '2026-11-13', NULL,                  'Selesai'),
  ('2026/11/14/000001', 'RM-0001', 'P02', 'D003', '2026-11-14', '0301R0011126V000129', 'Selesai'),
  ('2026/11/15/000001', 'RM-0010', 'P03', 'D005', '2026-11-15', '0301R0011126V000130', 'Selesai');

INSERT INTO diagnosa (id_diagnosa, no_rawat, kode_icd10, nama_penyakit, jenis) VALUES
  (1,  '2026/10/01/000001', 'I10',   'Hipertensi esensial',                         'Primer'),
  (2,  '2026/10/01/000001', 'E11.9', 'Diabetes melitus tipe 2 tanpa komplikasi',    'Sekunder'),
  (3,  '2026/10/01/000002', 'Z34.9', 'Pemeriksaan kehamilan normal',                'Primer'),
  (4,  '2026/10/02/000001', 'J06.9', 'Infeksi saluran pernapasan atas akut',        'Primer'),
  (5,  '2026/10/03/000001', 'I21.9', 'Infark miokard akut',                         'Primer'),
  (6,  '2026/10/03/000001', 'I10',   'Hipertensi esensial',                         'Sekunder'),
  (7,  '2026/10/03/000002', 'A09',   'Diare dan gastroenteritis',                   'Primer'),
  (8,  '2026/10/05/000001', 'Z34.9', 'Pemeriksaan kehamilan normal',                'Primer'),
  (9,  '2026/10/06/000001', 'J06.9', 'Infeksi saluran pernapasan atas akut',        'Primer'),
  (10, '2026/10/08/000001', 'I50.9', 'Gagal jantung',                               'Primer'),
  (11, '2026/10/08/000001', 'E11.9', 'Diabetes melitus tipe 2 tanpa komplikasi',    'Sekunder'),
  (12, '2026/10/09/000001', 'E11.9', 'Diabetes melitus tipe 2 tanpa komplikasi',    'Primer'),
  (13, '2026/10/09/000001', 'I10',   'Hipertensi esensial',                         'Sekunder'),
  (14, '2026/10/10/000001', 'G43.9', 'Migrain',                                     'Primer'),
  (15, '2026/10/12/000001', 'K29.7', 'Gastritis',                                   'Primer'),
  (16, '2026/10/14/000001', 'I20.9', 'Angina pektoris',                             'Primer'),
  (17, '2026/10/15/000001', 'E11.9', 'Diabetes melitus tipe 2 tanpa komplikasi',    'Primer'),
  (18, '2026/10/16/000001', 'O21.0', 'Hiperemesis gravidarum ringan',               'Primer'),
  (19, '2026/10/18/000001', 'I10',   'Hipertensi esensial',                         'Primer'),
  (20, '2026/10/22/000001', 'G44.2', 'Nyeri kepala tipe tegang',                    'Primer'),
  (21, '2026/10/25/000001', 'J06.9', 'Infeksi saluran pernapasan atas akut',        'Primer'),
  (22, '2026/10/28/000001', 'I10',   'Hipertensi esensial',                         'Primer'),
  (23, '2026/10/28/000001', 'E78.5', 'Hiperlipidemia',                              'Sekunder'),
  (24, '2026/11/02/000001', 'I25.1', 'Penyakit jantung aterosklerotik',             'Primer'),
  (25, '2026/11/03/000001', 'A90',   'Demam dengue',                                'Primer'),
  (26, '2026/11/04/000001', 'K29.7', 'Gastritis',                                   'Primer'),
  (27, '2026/11/06/000001', 'I63.9', 'Infark serebral (stroke iskemik)',            'Primer'),
  (28, '2026/11/06/000001', 'I10',   'Hipertensi esensial',                         'Sekunder'),
  (29, '2026/11/10/000001', 'I50.9', 'Gagal jantung',                               'Primer'),
  (30, '2026/11/14/000001', 'E11.9', 'Diabetes melitus tipe 2 tanpa komplikasi',    'Primer'),
  (31, '2026/11/14/000001', 'E78.5', 'Hiperlipidemia',                              'Sekunder'),
  (32, '2026/11/15/000001', 'A09',   'Diare dan gastroenteritis',                   'Primer');

INSERT INTO billing (id_billing, no_rawat, total_biaya, status_bayar) VALUES
  (1,  '2026/10/01/000001',   450000, 'Lunas'),
  (2,  '2026/10/01/000002',   350000, 'Lunas'),
  (3,  '2026/10/02/000001',   150000, 'Lunas'),
  (4,  '2026/10/03/000001', 12500000, 'Belum Lunas'),
  (5,  '2026/10/03/000002',   125000, 'Lunas'),
  (6,  '2026/10/05/000001',   380000, 'Lunas'),
  (7,  '2026/10/06/000001',   275000, 'Lunas'),
  (8,  '2026/10/08/000001', 18750000, 'Belum Lunas'),
  (9,  '2026/10/09/000001',   520000, 'Lunas'),
  (10, '2026/10/10/000001',   650000, 'Lunas'),
  (11, '2026/10/12/000001',   200000, 'Lunas'),
  (12, '2026/10/14/000001',  2350000, 'Lunas'),
  (13, '2026/10/15/000001',   480000, 'Lunas'),
  (14, '2026/10/16/000001',   410000, 'Lunas'),
  (15, '2026/10/18/000001',  1850000, 'Lunas'),
  (16, '2026/10/22/000001',   500000, 'Belum Lunas'),
  (17, '2026/10/25/000001',   135000, 'Lunas'),
  (18, '2026/10/28/000001',   560000, 'Lunas'),
  (19, '2026/11/02/000001',  3150000, 'Lunas'),
  (20, '2026/11/03/000001',   290000, 'Lunas'),
  (21, '2026/11/04/000001',   615000, 'Lunas'),
  (22, '2026/11/06/000001',  5000000, 'Belum Lunas'),
  (23, '2026/11/08/000001',   225000, 'Belum Lunas'),
  (24, '2026/11/10/000001',  1975000, 'Lunas'),
  (25, '2026/11/12/000001',   850000, 'Lunas'),
  (26, '2026/11/14/000001',   495000, 'Lunas'),
  (27, '2026/11/15/000001',   310000, 'Lunas'),
  (28, '2026/11/13/000001',   450000, 'Lunas');

INSERT INTO struktur_organisasi (id_jabatan, nama_jabatan, nama_pejabat, id_atasan) VALUES
  ('J01', 'Direktur Utama',                     'dr. Hartono Wijaya, MARS',      NULL),
  ('J02', 'Wakil Direktur Pelayanan Medis',     'dr. Lina Marlina, Sp.PK',       'J01'),
  ('J03', 'Wakil Direktur Umum & Keuangan',     'Drs. Bambang Hermawan, M.M.',   'J01'),
  ('J04', 'Kepala Bidang Pelayanan Medis',      'dr. Rudi Hartanto',             'J02'),
  ('J05', 'Kepala Bidang Keperawatan',          'Ns. Sri Wahyuni, S.Kep.',       'J02'),
  ('J06', 'Kepala Bidang Penunjang Medis',      'dr. Dian Puspita, Sp.Rad',      'J02'),
  ('J07', 'Kepala Instalasi Rawat Jalan',       'dr. Andi Pratama',              'J04'),
  ('J08', 'Kepala Instalasi Rawat Inap',        'dr. Budi Santoso, Sp.PD',       'J04'),
  ('J09', 'Kepala Instalasi Gawat Darurat',     'dr. Teguh Prasetyo',            'J04'),
  ('J10', 'Kepala Ruang Perawatan Melati',      'Ns. Yuliana, S.Kep.',           'J05'),
  ('J11', 'Kepala Instalasi Laboratorium',      'dr. Nanda Kurnia, Sp.PK',       'J06'),
  ('J12', 'Kepala Bagian Keuangan',             'Ratih Kumalasari, S.E., Ak.',   'J03'),
  ('J13', 'Kepala Bagian SDM',                  'Yusuf Maulana, S.Psi.',         'J03'),
  ('J14', 'Kepala Instalasi SIMRS',             'Arief Rahman, S.Kom., M.T.',    'J03'),
  ('J15', 'Koordinator Casemix & Klaim BPJS',   'Desi Anggraini, S.KM.',         'J12'),
  ('J16', 'Programmer SIMRS',                   'Bayu Saputra, S.Kom.',          'J14'),
  ('J17', 'Analis Data Kesehatan',              'Mega Pertiwi, S.Si.',           'J14'),
  ('J18', 'IT Support',                         'Rendi Kurniawan, A.Md.Kom.',    'J14'),
  ('J19', 'Koordinator Poli Rawat Jalan',       'Ns. Wati Susanti, S.Kep.',      'J07');

INSERT INTO satusehat_log (id_log, no_rawat, resource_type, payload, status_kirim, waktu_kirim, response) VALUES
  (1, '2026/10/01/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"vital-signs"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"85354-9"}],"text":"Tekanan darah"},"subject":{"reference":"Patient/RM-0001"},"encounter":{"reference":"Encounter/2026/10/01/000001"},"effectiveDateTime":"2026-10-01T08:40:00+07:00","component":[{"code":{"coding":[{"system":"http://loinc.org","code":"8480-6"}],"text":"Sistolik"},"valueQuantity":{"value":150,"unit":"mm[Hg]"}},{"code":{"coding":[{"system":"http://loinc.org","code":"8462-4"}],"text":"Diastolik"},"valueQuantity":{"value":95,"unit":"mm[Hg]"}}]}', 'Terkirim', '2026-10-01 10:14:51', NULL),
  (2, '2026/10/01/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"laboratory"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"1558-6"}],"text":"Glukosa darah puasa"},"subject":{"reference":"Patient/RM-0001"},"encounter":{"reference":"Encounter/2026/10/01/000001"},"effectiveDateTime":"2026-10-01T09:30:00+07:00","valueQuantity":{"value":182,"unit":"mg/dL"},"referenceRange":[{"low":{"value":70},"high":{"value":100}}],"interpretation":[{"coding":[{"code":"H"}]}]}', 'Terkirim', '2026-10-01 10:15:22', NULL),
  (3, '2026/10/01/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"laboratory"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"4548-4"}],"text":"HbA1c"},"subject":{"reference":"Patient/RM-0001"},"encounter":{"reference":"Encounter/2026/10/01/000001"},"effectiveDateTime":"2026-10-01T09:30:00+07:00","valueQuantity":{"value":8.1,"unit":"%"},"referenceRange":[{"high":{"value":5.7}}],"interpretation":[{"coding":[{"code":"H"}]}]}', 'Terkirim', '2026-10-01 10:16:05', NULL),
  (4, '2026/10/02/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"laboratory"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"6690-2"}],"text":"Leukosit"},"subject":{"reference":"Patient/RM-0003"},"encounter":{"reference":"Encounter/2026/10/02/000001"},"effectiveDateTime":"2026-10-02T10:05:00+07:00","valueQuantity":{"value":11.2,"unit":"10*3/uL"},"referenceRange":[{"low":{"value":4},"high":{"value":10}}],"interpretation":[{"coding":[{"code":"H"}]}]}', 'Terkirim', '2026-10-02 11:20:43', NULL),
  (5, '2026/10/09/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"vital-signs"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"85354-9"}],"text":"Tekanan darah"},"subject":{"reference":"Patient/RM-0012"},"encounter":{"reference":"Encounter/2026/10/09/000001"},"effectiveDateTime":"2026-10-09T08:55:00+07:00","component":[{"code":{"coding":[{"system":"http://loinc.org","code":"8480-6"}],"text":"Sistolik"},"valueQuantity":{"value":138,"unit":"mm[Hg]"}},{"code":{"coding":[{"system":"http://loinc.org","code":"8462-4"}],"text":"Diastolik"},"valueQuantity":{"value":88,"unit":"mm[Hg]"}}]}', 'Terkirim', '2026-10-09 09:39:30', NULL),
  (6, '2026/10/09/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"laboratory"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"1558-6"}],"text":"Glukosa darah puasa"},"subject":{"reference":"Patient/RM-0012"},"encounter":{"reference":"Encounter/2026/10/09/000001"},"effectiveDateTime":"2026-10-09T09:10:00+07:00","valueQuantity":{"value":143,"unit":"mg/dL"},"referenceRange":[{"low":{"value":70},"high":{"value":100}}],"interpretation":[{"coding":[{"code":"H"}]}]}', 'Terkirim', '2026-10-09 09:40:11', NULL),
  (7, '2026/10/15/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"laboratory"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"4548-4"}],"text":"HbA1c"},"subject":{"reference":"Patient/RM-0015"},"encounter":{"reference":"Encounter/2026/10/15/000001"},"effectiveDateTime":"2026-10-15T10:20:00+07:00","valueQuantity":{"value":6.9,"unit":"%"},"referenceRange":[{"high":{"value":5.7}}],"interpretation":[{"coding":[{"code":"H"}]}]}', 'Terkirim', '2026-10-15 11:02:47', NULL),
  (8, '2026/10/18/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"vital-signs"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"85354-9"}],"text":"Tekanan darah"},"subject":{"reference":"Patient/RM-0001"},"encounter":{"reference":"Encounter/2026/10/18/000001"},"effectiveDateTime":"2026-10-18T09:15:00+07:00","component":[{"code":{"coding":[{"system":"http://loinc.org","code":"8462-4"}],"text":"Diastolik"},"valueQuantity":{"value":90,"unit":"mm[Hg]"}},{"code":{"coding":[{"system":"http://loinc.org","code":"8480-6"}],"text":"Sistolik"},"valueQuantity":{"value":142,"unit":"mm[Hg]"}}]}', 'Terkirim', '2026-10-18 10:01:19', NULL),
  (9, '2026/10/28/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"vital-signs"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"85354-9"}],"text":"Tekanan darah"},"subject":{"reference":"Patient/RM-0011"},"encounter":{"reference":"Encounter/2026/10/28/000001"},"effectiveDateTime":"2026-10-28T13:30:00+07:00","component":[{"code":{"coding":[{"system":"http://loinc.org","code":"8480-6"}],"text":"Sistolik"},"valueQuantity":{"value":135,"unit":"mm[Hg]"}},{"code":{"coding":[{"system":"http://loinc.org","code":"8462-4"}],"text":"Diastolik"},"valueQuantity":{"value":85,"unit":"mm[Hg]"}}]}', 'Gagal', '2026-10-28 14:19:58', '{"resourceType":"OperationOutcome","issue":[{"severity":"error","code":"required","diagnostics":"Observation.subject: Patient/RM-0011 belum terdaftar di SATUSEHAT (IHS number kosong)"}]}'),
  (10, '2026/10/28/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"laboratory"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"2093-3"}],"text":"Kolesterol total"},"subject":{"reference":"Patient/RM-0011"},"encounter":{"reference":"Encounter/2026/10/28/000001"},"effectiveDateTime":"2026-10-28T13:45:00+07:00","valueQuantity":{"value":245,"unit":"mg/dL"},"referenceRange":[{"high":{"value":200}}],"interpretation":[{"coding":[{"code":"H"}]}]}', 'Gagal', '2026-10-28 14:20:00', '{"resourceType":"OperationOutcome","issue":[{"severity":"error","code":"required","diagnostics":"Observation.subject: Patient/RM-0011 belum terdaftar di SATUSEHAT (IHS number kosong)"}]}'),
  (11, '2026/10/28/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"vital-signs"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"85354-9"}],"text":"Tekanan darah"},"subject":{"reference":"Patient/RM-0011"},"encounter":{"reference":"Encounter/2026/10/28/000001"},"effectiveDateTime":"2026-10-28T13:30:00+07:00","component":[{"code":{"coding":[{"system":"http://loinc.org","code":"8480-6"}],"text":"Sistolik"},"valueQuantity":{"value":135,"unit":"mm[Hg]"}},{"code":{"coding":[{"system":"http://loinc.org","code":"8462-4"}],"text":"Diastolik"},"valueQuantity":{"value":85,"unit":"mm[Hg]"}}]}', 'Terkirim', '2026-10-31 08:12:40', NULL),
  (12, '2026/10/28/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"laboratory"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"2093-3"}],"text":"Kolesterol total"},"subject":{"reference":"Patient/RM-0011"},"encounter":{"reference":"Encounter/2026/10/28/000001"},"effectiveDateTime":"2026-10-28T13:45:00+07:00","valueQuantity":{"value":245,"unit":"mg/dL"},"referenceRange":[{"high":{"value":200}}],"interpretation":[{"coding":[{"code":"H"}]}]}', 'Terkirim', '2026-10-31 08:13:05', NULL),
  (13, '2026/11/03/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"laboratory"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"777-3"}],"text":"Trombosit"},"subject":{"reference":"Patient/RM-0009"},"encounter":{"reference":"Encounter/2026/11/03/000001"},"effectiveDateTime":"2026-11-03T12:50:00+07:00","valueQuantity":{"value":85,"unit":"10*3/uL"},"referenceRange":[{"low":{"value":150},"high":{"value":400}}],"interpretation":[{"coding":[{"code":"L"}]}]}', 'Terkirim', '2026-11-03 13:45:10', NULL),
  (14, '2026/11/06/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"vital-signs"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"85354-9"}],"text":"Tekanan darah"},"subject":{"reference":"Patient/RM-0012"},"encounter":{"reference":"Encounter/2026/11/06/000001"},"effectiveDateTime":"2026-11-06T07:20:00+07:00","component":[{"code":{"coding":[{"system":"http://loinc.org","code":"8480-6"}],"text":"Sistolik"},"valueQuantity":{"value":178,"unit":"mm[Hg]"}},{"code":{"coding":[{"system":"http://loinc.org","code":"8462-4"}],"text":"Diastolik"},"valueQuantity":{"value":104,"unit":"mm[Hg]"}}]}', 'Antri', NULL, NULL),
  (15, '2026/11/14/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"laboratory"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"4548-4"}],"text":"HbA1c"},"subject":{"reference":"Patient/RM-0001"},"encounter":{"reference":"Encounter/2026/11/14/000001"},"effectiveDateTime":"2026-11-14T09:35:00+07:00","valueQuantity":{"value":7.4,"unit":"%"},"referenceRange":[{"high":{"value":5.7}}],"interpretation":[{"coding":[{"code":"H"}]}]}', 'Terkirim', '2026-11-14 10:05:31', NULL),
  (16, '2026/11/14/000001', 'Observation', '{"resourceType":"Observation","status":"final","category":[{"coding":[{"code":"laboratory"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"2093-3"}],"text":"Kolesterol total"},"subject":{"reference":"Patient/RM-0001"},"encounter":{"reference":"Encounter/2026/11/14/000001"},"effectiveDateTime":"2026-11-14T09:35:00+07:00","valueQuantity":{"value":190,"unit":"mg/dL"},"referenceRange":[{"high":{"value":200}}],"interpretation":[{"coding":[{"code":"N"}]}]}', 'Terkirim', '2026-11-14 10:06:02', NULL);
`;

/** Urutan tabel untuk ditampilkan di Schema Explorer. */
export const TABLE_ORDER = [
  'pasien',
  'poliklinik',
  'dokter',
  'kunjungan',
  'diagnosa',
  'billing',
  'struktur_organisasi',
  'satusehat_log',
] as const;

export type TableName = (typeof TABLE_ORDER)[number];

export const TABLE_DESCRIPTIONS: Record<TableName, string> = {
  pasien: 'Master data pasien beserta nomor rekam medis (no_rm) dan jenis penjamin.',
  poliklinik: 'Daftar poliklinik rawat jalan dan lokasi gedungnya.',
  dokter: 'Daftar dokter, spesialisasi, dan poliklinik tempat praktik.',
  kunjungan: 'Transaksi registrasi/kunjungan pasien (no_rawat). no_sep terisi untuk pasien BPJS yang SEP-nya sudah terbit.',
  diagnosa: 'Diagnosa ICD-10 per kunjungan (Primer/Sekunder).',
  billing: 'Tagihan per kunjungan beserta status pembayarannya.',
  struktur_organisasi:
    'Struktur organisasi RS: setiap jabatan menunjuk atasannya lewat id_atasan (NULL = pucuk pimpinan). Cocok untuk recursive query.',
  satusehat_log:
    'Log pengiriman data ke SATUSEHAT: payload berisi resource FHIR Observation (hasil lab / tekanan darah) dalam format JSON; response berisi pesan error JSON bila pengiriman gagal.',
};
