/**
 * Test case Tier 10 (fungsi tanggal, teks & JSON). Jebakan khas: umur tanpa koreksi ulang tahun, urut abjad nama hari,
 * nama satu kata, group_concat tanpa urutan, -> (teks JSON) dibandingkan dengan angka, component[0] dianggap sistolik,
 * dan BETWEEN pada kolom tanggal+jam.
 */
import type { MissionTestCases } from './types';

const UMUR_FROM = `FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm
WHERE p.penjamin = 'BPJS' AND k.status <> 'Batal' AND k.tgl_kunjungan >= '2026-10-01' AND k.tgl_kunjungan < '2026-11-01'`;
const KELOMPOK = (u: string) => `CASE WHEN ${u} < 18 THEN 'Anak' WHEN ${u} >= 60 THEN 'Lansia' ELSE 'Dewasa' END AS kelompok_usia`;

const HARI_CASE = `CASE strftime('%w', tgl_kunjungan) WHEN '1' THEN 'Senin' WHEN '2' THEN 'Selasa' WHEN '3' THEN 'Rabu' WHEN '4' THEN 'Kamis' WHEN '5' THEN 'Jumat' WHEN '6' THEN 'Sabtu' ELSE 'Minggu' END`;

const LAB_CTE = (arrow: string) => `WITH lab AS (
  SELECT no_rawat, payload ${arrow} '$.code.text' AS pemeriksaan, payload ${arrow} '$.valueQuantity.value' AS nilai,
    payload ${arrow} '$.valueQuantity.unit' AS satuan, payload ${arrow} '$.referenceRange[0].low.value' AS batas_bawah,
    payload ${arrow} '$.referenceRange[0].high.value' AS batas_atas
  FROM satusehat_log WHERE status_kirim = 'Terkirim' AND payload ->> '$.valueQuantity.value' IS NOT NULL
)`;
const LAB_TAIL = `SELECT no_rawat, pemeriksaan, nilai, satuan, batas_bawah, batas_atas,
  CASE WHEN nilai > batas_atas THEN 'Tinggi' ELSE 'Rendah' END AS keterangan
FROM lab WHERE nilai > batas_atas OR nilai < batas_bawah ORDER BY no_rawat, pemeriksaan;`;

const BP_TAIL = `SELECT no_rawat, nama, sistolik, diastolik,
  CASE WHEN sistolik >= 160 OR diastolik >= 100 THEN 'Hipertensi derajat 2' WHEN sistolik >= 140 OR diastolik >= 90 THEN 'Hipertensi derajat 1' ELSE 'Normal' END AS kategori
FROM tekanan ORDER BY no_rawat;`;

const BOSS_HBA1C = `hba1c AS (
  SELECT k.no_rm, l.payload ->> '$.valueQuantity.value' AS nilai, date(l.payload ->> '$.effectiveDateTime') AS tgl,
    ROW_NUMBER() OVER (PARTITION BY k.no_rm ORDER BY l.payload ->> '$.effectiveDateTime' DESC) AS urutan
  FROM satusehat_log l JOIN kunjungan k ON k.no_rawat = l.no_rawat
  WHERE l.payload ->> '$.code.coding[0].code' = '4548-4' AND l.status_kirim <> 'Gagal'
)`;
const BOSS_SELECT = (umur: string, urut = 'urutan = 1', poli = "group_concat(nama_poli, ', ' ORDER BY nama_poli)") => `WITH dm AS (
  SELECT DISTINCT k.no_rm FROM kunjungan k JOIN diagnosa d ON d.no_rawat = k.no_rawat WHERE d.kode_icd10 = 'E11.9'
),
${BOSS_HBA1C},
poli AS (
  SELECT no_rm, ${poli} AS daftar
  FROM (SELECT DISTINCT k.no_rm, pl.nama_poli FROM kunjungan k JOIN poliklinik pl ON pl.id_poli = k.id_poli WHERE k.status <> 'Batal')
  GROUP BY no_rm
)
SELECT p.no_rm, p.nama, ${umur} AS umur,
  (SELECT COUNT(*) FROM kunjungan k WHERE k.no_rm = p.no_rm AND k.status <> 'Batal') AS jumlah_kunjungan,
  h.nilai AS hba1c_terakhir, h.tgl AS tgl_hba1c,
  CASE WHEN h.nilai IS NULL THEN 'Belum diperiksa' WHEN h.nilai < 7 THEN 'Terkontrol' ELSE 'Belum terkontrol' END AS status_kontrol,
  po.daftar AS poli_dikunjungi
FROM dm JOIN pasien p ON p.no_rm = dm.no_rm LEFT JOIN hba1c h ON h.no_rm = p.no_rm AND h.${urut} LEFT JOIN poli po ON po.no_rm = p.no_rm
ORDER BY p.no_rm;`;
const UMUR_BOSS = "2026 - CAST(strftime('%Y', p.tgl_lahir) AS INTEGER) - ('11-30' < strftime('%m-%d', p.tgl_lahir))";

export const TEST_CASES_TIER10: Record<string, MissionTestCases> = {
  't10-umur': {
    wrong: [
      {
        label: 'hanya selisih tahun (Wulan Sari jadi 44)',
        answer: `SELECT k.no_rawat, p.nama, k.tgl_kunjungan, strftime('%Y', k.tgl_kunjungan) - strftime('%Y', p.tgl_lahir) AS umur,
  ${KELOMPOK("strftime('%Y', k.tgl_kunjungan) - strftime('%Y', p.tgl_lahir)")} ${UMUR_FROM} ORDER BY k.tgl_kunjungan, k.no_rawat;`,
        reason: 'cell-values',
      },
      {
        label: 'Batal ikut',
        answer: `SELECT k.no_rawat, p.nama, k.tgl_kunjungan, CAST((julianday(k.tgl_kunjungan) - julianday(p.tgl_lahir)) / 365.2425 AS INTEGER) AS umur,
  ${KELOMPOK('CAST((julianday(k.tgl_kunjungan) - julianday(p.tgl_lahir)) / 365.2425 AS INTEGER)')}
FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm
WHERE p.penjamin = 'BPJS' AND k.tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31' ORDER BY k.tgl_kunjungan, k.no_rawat;`,
        reason: 'row-count',
      },
      {
        label: 'julianday / 365 (tahun kabisat diabaikan: Wulan Sari jadi 44)',
        answer: `SELECT k.no_rawat, p.nama, k.tgl_kunjungan, CAST((julianday(k.tgl_kunjungan) - julianday(p.tgl_lahir)) / 365 AS INTEGER) AS umur,
  ${KELOMPOK('CAST((julianday(k.tgl_kunjungan) - julianday(p.tgl_lahir)) / 365 AS INTEGER)')} ${UMUR_FROM} ORDER BY k.tgl_kunjungan, k.no_rawat;`,
        reason: 'cell-values',
      },
    ],
    correct: [
      {
        label: 'julianday / 365.2425 dibulatkan ke bawah',
        answer: `SELECT k.no_rawat, p.nama, k.tgl_kunjungan, CAST((julianday(k.tgl_kunjungan) - julianday(p.tgl_lahir)) / 365.2425 AS INTEGER) AS umur,
  ${KELOMPOK('CAST((julianday(k.tgl_kunjungan) - julianday(p.tgl_lahir)) / 365.2425 AS INTEGER)')} ${UMUR_FROM} ORDER BY k.tgl_kunjungan, k.no_rawat;`,
      },
      {
        label: 'koreksi ulang tahun dengan CASE + strftime bulan/tanggal terpisah',
        answer: `SELECT no_rawat, nama, tgl_kunjungan, umur, CASE WHEN umur >= 60 THEN 'Lansia' WHEN umur >= 18 THEN 'Dewasa' ELSE 'Anak' END AS kelompok_usia
FROM (SELECT k.no_rawat, p.nama, k.tgl_kunjungan,
  strftime('%Y', k.tgl_kunjungan) - strftime('%Y', p.tgl_lahir)
    - CASE WHEN strftime('%m', k.tgl_kunjungan) < strftime('%m', p.tgl_lahir)
             OR (strftime('%m', k.tgl_kunjungan) = strftime('%m', p.tgl_lahir) AND strftime('%d', k.tgl_kunjungan) < strftime('%d', p.tgl_lahir)) THEN 1 ELSE 0 END AS umur
  ${UMUR_FROM})
ORDER BY tgl_kunjungan, no_rawat;`,
      },
    ],
  },

  't10-hari-sibuk': {
    wrong: [
      { label: 'urut abjad nama hari', answer: `SELECT ${HARI_CASE} AS hari, COUNT(*) AS jumlah_kunjungan FROM kunjungan GROUP BY hari ORDER BY hari;`, reason: 'row-order' },
      { label: 'Minggu dianggap awal minggu', answer: `SELECT ${HARI_CASE} AS hari, COUNT(*) AS jumlah_kunjungan FROM kunjungan GROUP BY strftime('%w', tgl_kunjungan) ORDER BY strftime('%w', tgl_kunjungan);`, reason: 'row-order' },
      { label: 'Batal tidak dihitung', answer: `SELECT ${HARI_CASE} AS hari, COUNT(*) AS jumlah_kunjungan FROM kunjungan WHERE status <> 'Batal' GROUP BY strftime('%w', tgl_kunjungan) ORDER BY (strftime('%w', tgl_kunjungan) + 6) % 7;`, reason: 'cell-values' },
    ],
    correct: [
      {
        label: 'nomor urut hari dari CASE terpisah',
        answer: `SELECT hari, COUNT(*) AS jumlah_kunjungan FROM (
  SELECT ${HARI_CASE} AS hari, CASE strftime('%w', tgl_kunjungan) WHEN '0' THEN 7 ELSE CAST(strftime('%w', tgl_kunjungan) AS INTEGER) END AS urut FROM kunjungan
) GROUP BY hari, urut ORDER BY urut;`,
      },
      {
        label: 'tabel bantu nama hari (CTE VALUES)',
        answer: `WITH nama_hari(no, hari) AS (VALUES ('1', 'Senin'), ('2', 'Selasa'), ('3', 'Rabu'), ('4', 'Kamis'), ('5', 'Jumat'), ('6', 'Sabtu'), ('0', 'Minggu'))
SELECT n.hari, COUNT(*) AS jumlah_kunjungan FROM kunjungan k JOIN nama_hari n ON n.no = strftime('%w', k.tgl_kunjungan)
GROUP BY n.no, n.hari ORDER BY CASE n.no WHEN '0' THEN 7 ELSE CAST(n.no AS INTEGER) END;`,
      },
    ],
  },

  't10-masking': {
    wrong: [
      {
        label: 'instr tanpa spasi tambahan (nama satu kata jadi kosong)',
        answer: "SELECT no_rm, upper(substr(nama, 1, instr(nama, ' ') - 1)) AS nama_panggilan, substr(nik, 1, 4) || '********' || substr(nik, -4) AS nik_samaran, kota FROM pasien WHERE penjamin = 'BPJS' ORDER BY no_rm;",
        reason: 'cell-values',
      },
      {
        label: 'jumlah bintang salah (7)',
        answer: "SELECT no_rm, upper(substr(nama, 1, instr(nama || ' ', ' ') - 1)) AS nama_panggilan, substr(nik, 1, 4) || '*******' || substr(nik, -4) AS nik_samaran, kota FROM pasien WHERE penjamin = 'BPJS' ORDER BY no_rm;",
        reason: 'cell-values',
      },
      {
        label: 'tidak dikapitalkan',
        answer: "SELECT no_rm, substr(nama, 1, instr(nama || ' ', ' ') - 1) AS nama_panggilan, substr(nik, 1, 4) || '********' || substr(nik, -4) AS nik_samaran, kota FROM pasien WHERE penjamin = 'BPJS' ORDER BY no_rm;",
        reason: 'cell-values',
      },
    ],
    correct: [
      {
        label: 'CASE untuk nama satu kata + substr posisi 13',
        answer: `SELECT no_rm,
  upper(CASE WHEN instr(nama, ' ') = 0 THEN nama ELSE substr(nama, 1, instr(nama, ' ') - 1) END) AS nama_panggilan,
  substr(nik, 1, 4) || replace(printf('%8s', ''), ' ', '*') || substr(nik, 13, 4) AS nik_samaran,
  kota
FROM pasien WHERE penjamin = 'BPJS' ORDER BY no_rm;`,
      },
      {
        label: 'rtrim + substr dengan length',
        answer: "SELECT no_rm, upper(rtrim(substr(nama || ' ', 1, instr(nama || ' ', ' ')))) AS nama_panggilan, substr(nik, 1, 4) || '********' || substr(nik, length(nik) - 3) AS nik_samaran, kota FROM pasien WHERE penjamin = 'BPJS' ORDER BY no_rm;",
      },
    ],
  },

  't10-group-concat': {
    wrong: [
      {
        label: 'group_concat tanpa urutan',
        answer: `SELECT k.no_rawat, p.nama, COUNT(*) AS jumlah_diagnosa, MAX(CASE WHEN d.jenis = 'Primer' THEN d.nama_penyakit END) AS diagnosa_primer, group_concat(d.kode_icd10, ', ') AS daftar_kode
FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm JOIN diagnosa d ON d.no_rawat = k.no_rawat GROUP BY k.no_rawat HAVING COUNT(*) >= 2 ORDER BY k.no_rawat;`,
        reason: 'cell-values',
      },
      {
        label: 'pemisah koma tanpa spasi (bawaan)',
        answer: `SELECT k.no_rawat, p.nama, COUNT(*) AS jumlah_diagnosa, MAX(CASE WHEN d.jenis = 'Primer' THEN d.nama_penyakit END) AS diagnosa_primer, group_concat(d.kode_icd10 ORDER BY d.kode_icd10) AS daftar_kode
FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm JOIN diagnosa d ON d.no_rawat = k.no_rawat GROUP BY k.no_rawat HAVING COUNT(*) >= 2 ORDER BY k.no_rawat;`,
        reason: 'cell-values',
      },
      {
        label: 'tanpa HAVING (kunjungan 1 diagnosa ikut)',
        answer: `SELECT k.no_rawat, p.nama, COUNT(*) AS jumlah_diagnosa, MAX(CASE WHEN d.jenis = 'Primer' THEN d.nama_penyakit END) AS diagnosa_primer, group_concat(d.kode_icd10, ', ' ORDER BY d.kode_icd10) AS daftar_kode
FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm JOIN diagnosa d ON d.no_rawat = k.no_rawat GROUP BY k.no_rawat ORDER BY k.no_rawat;`,
        reason: 'row-count',
      },
    ],
    correct: [
      {
        label: 'string_agg (alias group_concat) + subquery primer',
        answer: `SELECT k.no_rawat, p.nama, COUNT(*) AS jumlah_diagnosa,
  (SELECT x.nama_penyakit FROM diagnosa x WHERE x.no_rawat = k.no_rawat AND x.jenis = 'Primer') AS diagnosa_primer,
  string_agg(d.kode_icd10, ', ' ORDER BY d.kode_icd10) AS daftar_kode
FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm JOIN diagnosa d ON d.no_rawat = k.no_rawat
GROUP BY k.no_rawat HAVING jumlah_diagnosa > 1 ORDER BY k.no_rawat;`,
      },
      {
        label: 'urut di subquery FROM sebelum group_concat',
        answer: `SELECT no_rawat, nama, COUNT(*) AS jumlah_diagnosa, MAX(CASE WHEN jenis = 'Primer' THEN nama_penyakit END) AS diagnosa_primer, group_concat(kode_icd10, ', ' ORDER BY kode_icd10) AS daftar_kode
FROM (SELECT k.no_rawat, p.nama, d.jenis, d.nama_penyakit, d.kode_icd10 FROM kunjungan k JOIN pasien p USING (no_rm) JOIN diagnosa d USING (no_rawat))
GROUP BY no_rawat, nama HAVING COUNT(*) >= 2 ORDER BY no_rawat;`,
      },
    ],
  },

  't10-json-lab': {
    wrong: [
      { label: "-> (teks JSON) di kedua sisi: teks dibandingkan per karakter ('85' > '150')", answer: `${LAB_CTE('->')}\n${LAB_TAIL}`, reason: 'cell-values' },
      {
        label: 'status Gagal ikut (kolesterol tercatat dua kali)',
        answer: `${LAB_CTE('->>').replace("status_kirim = 'Terkirim'", "status_kirim <> 'Antri'")}\n${LAB_TAIL}`,
        reason: 'row-count',
      },
      {
        label: 'jalur referenceRange tanpa indeks [0]',
        answer: `${LAB_CTE('->>').replaceAll('referenceRange[0]', 'referenceRange')}\n${LAB_TAIL}`,
        reason: 'row-count',
      },
    ],
    correct: [
      {
        label: 'json_extract + flag dibandingkan langsung',
        answer: `SELECT no_rawat, json_extract(payload, '$.code.text') AS pemeriksaan, json_extract(payload, '$.valueQuantity.value') AS nilai,
  json_extract(payload, '$.valueQuantity.unit') AS satuan, json_extract(payload, '$.referenceRange[0].low.value') AS batas_bawah,
  json_extract(payload, '$.referenceRange[0].high.value') AS batas_atas,
  CASE WHEN json_extract(payload, '$.valueQuantity.value') > json_extract(payload, '$.referenceRange[0].high.value') THEN 'Tinggi' ELSE 'Rendah' END AS keterangan
FROM satusehat_log
WHERE status_kirim = 'Terkirim'
  AND (json_extract(payload, '$.valueQuantity.value') > json_extract(payload, '$.referenceRange[0].high.value')
    OR json_extract(payload, '$.valueQuantity.value') < json_extract(payload, '$.referenceRange[0].low.value'))
ORDER BY no_rawat, pemeriksaan;`,
      },
      {
        label: 'keterangan dari dua cabang CASE eksplisit',
        answer: `${LAB_CTE('->>')}
SELECT * FROM (SELECT no_rawat, pemeriksaan, nilai, satuan, batas_bawah, batas_atas,
  CASE WHEN nilai > batas_atas THEN 'Tinggi' WHEN nilai < batas_bawah THEN 'Rendah' END AS keterangan FROM lab)
WHERE keterangan IS NOT NULL ORDER BY no_rawat, pemeriksaan;`,
      },
    ],
  },

  't10-json-each': {
    wrong: [
      {
        label: 'component[0] dianggap sistolik',
        answer: `WITH tekanan AS (
  SELECT l.no_rawat, p.nama, l.payload ->> '$.component[0].valueQuantity.value' AS sistolik, l.payload ->> '$.component[1].valueQuantity.value' AS diastolik
  FROM satusehat_log l JOIN kunjungan k ON k.no_rawat = l.no_rawat JOIN pasien p ON p.no_rm = k.no_rm
  WHERE l.payload ->> '$.code.coding[0].code' = '85354-9' AND l.status_kirim <> 'Gagal'
)
${BP_TAIL}`,
        reason: 'cell-values',
      },
      {
        label: 'urutan CASE terbalik (derajat 1 diperiksa dulu)',
        answer: `WITH tekanan AS (
  SELECT l.id_log, l.no_rawat, p.nama,
    MAX(CASE WHEN c.value ->> '$.code.coding[0].code' = '8480-6' THEN c.value ->> '$.valueQuantity.value' END) AS sistolik,
    MAX(CASE WHEN c.value ->> '$.code.coding[0].code' = '8462-4' THEN c.value ->> '$.valueQuantity.value' END) AS diastolik
  FROM satusehat_log l JOIN kunjungan k ON k.no_rawat = l.no_rawat JOIN pasien p ON p.no_rm = k.no_rm, json_each(l.payload, '$.component') c
  WHERE l.payload ->> '$.code.coding[0].code' = '85354-9' AND l.status_kirim <> 'Gagal' GROUP BY l.id_log
)
SELECT no_rawat, nama, sistolik, diastolik,
  CASE WHEN sistolik >= 140 OR diastolik >= 90 THEN 'Hipertensi derajat 1' WHEN sistolik >= 160 OR diastolik >= 100 THEN 'Hipertensi derajat 2' ELSE 'Normal' END AS kategori
FROM tekanan ORDER BY no_rawat;`,
        reason: 'cell-values',
      },
      {
        label: 'log Gagal ikut (Sutarno dua kali)',
        answer: `WITH tekanan AS (
  SELECT l.id_log, l.no_rawat, p.nama,
    MAX(CASE WHEN c.value ->> '$.code.coding[0].code' = '8480-6' THEN c.value ->> '$.valueQuantity.value' END) AS sistolik,
    MAX(CASE WHEN c.value ->> '$.code.coding[0].code' = '8462-4' THEN c.value ->> '$.valueQuantity.value' END) AS diastolik
  FROM satusehat_log l JOIN kunjungan k ON k.no_rawat = l.no_rawat JOIN pasien p ON p.no_rm = k.no_rm, json_each(l.payload, '$.component') c
  WHERE l.payload ->> '$.code.coding[0].code' = '85354-9' GROUP BY l.id_log
)
${BP_TAIL}`,
        reason: 'row-count',
      },
    ],
    correct: [
      {
        label: 'subquery berkorelasi per komponen',
        answer: `WITH tekanan AS (
  SELECT l.no_rawat, p.nama,
    (SELECT c.value ->> '$.valueQuantity.value' FROM json_each(l.payload, '$.component') c WHERE c.value ->> '$.code.coding[0].code' = '8480-6') AS sistolik,
    (SELECT c.value ->> '$.valueQuantity.value' FROM json_each(l.payload, '$.component') c WHERE c.value ->> '$.code.coding[0].code' = '8462-4') AS diastolik
  FROM satusehat_log l JOIN kunjungan k ON k.no_rawat = l.no_rawat JOIN pasien p ON p.no_rm = k.no_rm
  WHERE json_extract(l.payload, '$.code.coding[0].code') = '85354-9' AND l.status_kirim IN ('Terkirim', 'Antri')
)
${BP_TAIL}`,
      },
      {
        label: 'json_each + filter teks komponen (Sistolik/Diastolik)',
        answer: `WITH tekanan AS (
  SELECT l.id_log, l.no_rawat, p.nama,
    SUM(CASE WHEN json_extract(c.value, '$.code.text') = 'Sistolik' THEN json_extract(c.value, '$.valueQuantity.value') END) AS sistolik,
    SUM(CASE WHEN json_extract(c.value, '$.code.text') = 'Diastolik' THEN json_extract(c.value, '$.valueQuantity.value') END) AS diastolik
  FROM satusehat_log l JOIN json_each(l.payload, '$.component') c JOIN kunjungan k ON k.no_rawat = l.no_rawat JOIN pasien p ON p.no_rm = k.no_rm
  WHERE l.payload ->> '$.code.text' = 'Tekanan darah' AND l.status_kirim != 'Gagal' GROUP BY l.id_log
)
${BP_TAIL}`,
      },
    ],
  },

  't10-fix-waktu': {
    wrong: [
      {
        label: "batas atas < '2026-10-31' (seluruh tanggal 31 terbuang)",
        answer: "SELECT date(waktu_kirim) AS tanggal, SUM(status_kirim = 'Terkirim') AS terkirim, SUM(status_kirim = 'Gagal') AS gagal FROM satusehat_log WHERE waktu_kirim >= '2026-10-01' AND waktu_kirim < '2026-10-31' GROUP BY date(waktu_kirim) ORDER BY tanggal;",
        reason: 'row-count',
      },
      {
        label: 'Gagal dihitung sebagai terkirim (COUNT semua)',
        answer: "SELECT date(waktu_kirim) AS tanggal, COUNT(*) AS terkirim, SUM(status_kirim = 'Gagal') AS gagal FROM satusehat_log WHERE waktu_kirim >= '2026-10-01' AND waktu_kirim < '2026-11-01' GROUP BY date(waktu_kirim) ORDER BY tanggal;",
        reason: 'cell-values',
      },
    ],
    correct: [
      {
        label: 'date() di kedua sisi BETWEEN',
        answer: "SELECT date(waktu_kirim) AS tanggal, SUM(status_kirim = 'Terkirim') AS terkirim, SUM(status_kirim = 'Gagal') AS gagal FROM satusehat_log WHERE date(waktu_kirim) BETWEEN '2026-10-01' AND '2026-10-31' GROUP BY date(waktu_kirim) ORDER BY tanggal;",
      },
      {
        label: "strftime('%Y-%m') + COUNT bersyarat",
        answer: "SELECT substr(waktu_kirim, 1, 10) AS tanggal, COUNT(CASE WHEN status_kirim = 'Terkirim' THEN 1 END) AS terkirim, COUNT(CASE WHEN status_kirim = 'Gagal' THEN 1 END) AS gagal FROM satusehat_log WHERE strftime('%Y-%m', waktu_kirim) = '2026-10' GROUP BY 1 ORDER BY 1;",
      },
    ],
  },

  'boss-t10-diabetes': {
    wrong: [
      {
        label: 'poli tanpa DISTINCT (Poli Penyakit Dalam tercatat dua kali)',
        answer: BOSS_SELECT(UMUR_BOSS).replace('(SELECT DISTINCT k.no_rm, pl.nama_poli FROM', '(SELECT k.no_rm, pl.nama_poli FROM'),
        reason: 'cell-values',
      },
      { label: 'HbA1c PERTAMA, bukan terakhir', answer: BOSS_SELECT(UMUR_BOSS).replace("ORDER BY l.payload ->> '$.effectiveDateTime' DESC", "ORDER BY l.payload ->> '$.effectiveDateTime'"), reason: 'cell-values' },
      { label: 'poli tanpa urutan', answer: BOSS_SELECT(UMUR_BOSS, 'urutan = 1', "group_concat(nama_poli, ', ')"), reason: 'cell-values' },
      {
        label: 'INNER JOIN HbA1c (pasien belum diperiksa hilang)',
        answer: BOSS_SELECT(UMUR_BOSS).replace('LEFT JOIN hba1c h', 'JOIN hba1c h'),
        reason: 'row-count',
      },
    ],
    correct: [
      {
        label: 'HbA1c terakhir lewat MAX tanggal + subquery',
        answer: `WITH dm AS (SELECT DISTINCT k.no_rm FROM kunjungan k JOIN diagnosa d USING (no_rawat) WHERE d.kode_icd10 = 'E11.9'),
lab AS (
  SELECT k.no_rm, json_extract(l.payload, '$.valueQuantity.value') AS nilai, json_extract(l.payload, '$.effectiveDateTime') AS waktu
  FROM satusehat_log l JOIN kunjungan k USING (no_rawat)
  WHERE json_extract(l.payload, '$.code.coding[0].code') = '4548-4' AND l.status_kirim != 'Gagal'
),
terakhir AS (SELECT no_rm, nilai, substr(waktu, 1, 10) AS tgl FROM lab a WHERE waktu = (SELECT MAX(waktu) FROM lab b WHERE b.no_rm = a.no_rm))
SELECT p.no_rm, p.nama,
  CAST((julianday('2026-11-30') - julianday(p.tgl_lahir)) / 365.2425 AS INTEGER) AS umur,
  (SELECT COUNT(*) FROM kunjungan k WHERE k.no_rm = p.no_rm AND k.status <> 'Batal') AS jumlah_kunjungan,
  t.nilai AS hba1c_terakhir, t.tgl AS tgl_hba1c,
  CASE WHEN t.nilai IS NULL THEN 'Belum diperiksa' WHEN t.nilai < 7 THEN 'Terkontrol' ELSE 'Belum terkontrol' END AS status_kontrol,
  (SELECT group_concat(nama_poli, ', ' ORDER BY nama_poli) FROM (SELECT DISTINCT pl.nama_poli FROM kunjungan k JOIN poliklinik pl USING (id_poli) WHERE k.no_rm = p.no_rm AND k.status <> 'Batal')) AS poli_dikunjungi
FROM dm JOIN pasien p USING (no_rm) LEFT JOIN terakhir t USING (no_rm)
ORDER BY p.no_rm;`,
      },
      { label: 'struktur CTE berbeda, ROW_NUMBER', answer: BOSS_SELECT(UMUR_BOSS) },
    ],
  },
};
