/**
 * Tier 10 – Fungsi Tanggal, Teks & JSON (misi 64–71; Final Boss di misi 72).
 * Tabel satusehat_log berisi resource FHIR Observation (hasil lab & tekanan darah) sebagai teks JSON, seperti log
 * integrasi SATUSEHAT sungguhan. Semua fungsi di sini bawaan SQLite 3.54 (strftime, julianday, substr/instr, printf,
 * group_concat … ORDER BY, json_extract / -> / ->>, json_each).
 */
import type { PredictMission, SqlMission, TierInfo } from '../../types';

export const TIER10: TierInfo = {
  tier: 10,
  name: 'Fungsi Tanggal, Teks & JSON',
  description:
    'Mengolah tanggal (umur, hari, rentang waktu), merapikan teks (masking data pribadi, group_concat), dan membaca data JSON resource FHIR dari integrasi SATUSEHAT.',
};

const XP = 275;
const STARTER = '-- Tulis query kamu di sini\nSELECT ';

export const MISSIONS_TIER10: Array<SqlMission | PredictMission> = [
  /* ------------------------------------------------------------------ */
  /* #64 Umur & kelompok usia                                            */
  /* ------------------------------------------------------------------ */
  {
    id: 't10-umur',
    kind: 'sql',
    tier: 10,
    order: 64,
    title: 'Umur Pasien Saat Berobat',
    concept: 'strftime: Menghitung Umur',
    story:
      'Laporan kunjungan BPJS bulanan ke Dinas Kesehatan wajib mencantumkan umur pasien PADA SAAT berkunjung, beserta kelompok usianya. Laporan bulan lalu dikembalikan karena seorang pasien tercatat setahun lebih tua: rumusnya hanya mengurangkan tahun, padahal ulang tahunnya belum lewat.',
    task:
      "Untuk kunjungan pasien berpenjamin 'BPJS' pada Oktober 2026 yang statusnya BUKAN 'Batal', tampilkan no_rawat, nama, tgl_kunjungan, umur (umur dalam tahun penuh pada tgl_kunjungan: belum bertambah bila ulang tahun di tahun itu belum lewat), dan kelompok_usia: 'Anak' bila umur < 18, 'Lansia' bila umur ≥ 60, selain itu 'Dewasa'. Urutkan berdasarkan tgl_kunjungan, lalu no_rawat.",
    hint: [
      "strftime('%Y', tanggal) mengambil tahun dan strftime('%m-%d', tanggal) mengambil bulan-tanggal sebagai teks. Tanggal di database ini berformat YYYY-MM-DD, jadi teks 'MM-DD' bisa dibandingkan langsung.",
      "Umur = selisih tahun, dikurangi 1 bila strftime('%m-%d', tgl_kunjungan) < strftime('%m-%d', tgl_lahir). Di SQLite perbandingan bernilai 1 (benar) atau 0 (salah), jadi bisa langsung dikurangkan.",
      'Hati-hati dengan (julianday(a) - julianday(b)) / 365: tahun kabisat membuat hasilnya meleset sehari-dua di sekitar ulang tahun. Bungkus perhitungan umur di CTE/subquery agar CASE kelompok_usia tidak perlu menulis ulang rumusnya.',
    ],
    solutionSql: `WITH kunjungan_bpjs AS (
  SELECT
    k.no_rawat,
    p.nama,
    k.tgl_kunjungan,
    CAST(strftime('%Y', k.tgl_kunjungan) AS INTEGER) - CAST(strftime('%Y', p.tgl_lahir) AS INTEGER)
      - (strftime('%m-%d', k.tgl_kunjungan) < strftime('%m-%d', p.tgl_lahir)) AS umur
  FROM kunjungan k
  INNER JOIN pasien p ON p.no_rm = k.no_rm
  WHERE p.penjamin = 'BPJS'
    AND k.status <> 'Batal'
    AND k.tgl_kunjungan >= '2026-10-01'
    AND k.tgl_kunjungan < '2026-11-01'
)
SELECT
  no_rawat,
  nama,
  tgl_kunjungan,
  umur,
  CASE
    WHEN umur < 18 THEN 'Anak'
    WHEN umur >= 60 THEN 'Lansia'
    ELSE 'Dewasa'
  END AS kelompok_usia
FROM kunjungan_bpjs
ORDER BY tgl_kunjungan, no_rawat;`,
    starterSql: STARTER,
    xpReward: XP,
    orderMatters: true,
  },

  /* ------------------------------------------------------------------ */
  /* #65 Hari tersibuk                                                   */
  /* ------------------------------------------------------------------ */
  {
    id: 't10-hari-sibuk',
    kind: 'sql',
    tier: 10,
    order: 65,
    title: 'Hari Paling Sibuk',
    concept: "strftime('%w'): Hari dalam Minggu",
    story:
      'Kepala Instalasi Rawat Jalan ingin menambah petugas pendaftaran di hari yang paling ramai. Data kunjungan hanya menyimpan tanggal, jadi nama harinya harus diturunkan dari tanggal tersebut — dan laporan harus urut seperti kalender kerja, dari Senin sampai Minggu, bukan urut abjad.',
    task:
      "Hitung jumlah kunjungan (semua status) per hari dalam minggu. Tampilkan kolom hari (nama hari dalam Bahasa Indonesia: 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu') dan jumlah_kunjungan. Tampilkan hanya hari yang punya kunjungan, diurutkan dari Senin sampai Minggu.",
    hint: [
      "strftime('%w', tanggal) menghasilkan nomor hari sebagai TEKS: '0' = Minggu, '1' = Senin, …, '6' = Sabtu. Ubah menjadi nama hari dengan CASE.",
      "Kelompokkan berdasarkan nomor harinya (GROUP BY strftime('%w', tgl_kunjungan)), bukan berdasarkan tanggal.",
      "ORDER BY hari akan mengurutkan secara abjad (Jumat, Kamis, Minggu, …). Agar Senin pertama dan Minggu terakhir, urutkan dengan (CAST(strftime('%w', tgl_kunjungan) AS INTEGER) + 6) % 7, atau CASE yang memberi Minggu nomor 7.",
    ],
    solutionSql: `SELECT
  CASE strftime('%w', tgl_kunjungan)
    WHEN '1' THEN 'Senin'
    WHEN '2' THEN 'Selasa'
    WHEN '3' THEN 'Rabu'
    WHEN '4' THEN 'Kamis'
    WHEN '5' THEN 'Jumat'
    WHEN '6' THEN 'Sabtu'
    ELSE 'Minggu'
  END AS hari,
  COUNT(*) AS jumlah_kunjungan
FROM kunjungan
GROUP BY strftime('%w', tgl_kunjungan)
ORDER BY (CAST(strftime('%w', tgl_kunjungan) AS INTEGER) + 6) % 7;`,
    starterSql: STARTER,
    xpReward: XP,
    orderMatters: true,
  },

  /* ------------------------------------------------------------------ */
  /* #66 Masking data pribadi                                            */
  /* ------------------------------------------------------------------ */
  {
    id: 't10-masking',
    kind: 'sql',
    tier: 10,
    order: 66,
    title: 'Layar Antrean yang Ramah Privasi',
    concept: 'Fungsi Teks: substr, instr, upper',
    story:
      'Layar antrean di ruang tunggu menampilkan data pasien BPJS yang dipanggil. Sesuai UU Pelindungan Data Pribadi, NIK tidak boleh tampil utuh dan nama cukup nama panggilan. Petugas mengeluh beberapa nama pasien hilang dari layar — ternyata pasien yang namanya hanya satu kata.',
    task:
      "Untuk setiap pasien berpenjamin 'BPJS', tampilkan no_rm, nama_panggilan (kata PERTAMA dari nama, dalam huruf kapital semua; nama satu kata dipakai utuh), nik_samaran (4 digit pertama NIK + 8 tanda bintang '********' + 4 digit terakhir NIK), dan kota. Urutkan berdasarkan no_rm.",
    hint: [
      "substr(teks, mulai, panjang) memotong teks (posisi dimulai dari 1); panjang negatif tidak dipakai di sini, tetapi mulai negatif menghitung dari belakang: substr(nik, -4) = 4 karakter terakhir. upper() membuat huruf kapital, dan || menyambung teks.",
      "instr(nama, ' ') memberi posisi spasi pertama. Kata pertama = substr(nama, 1, posisi_spasi - 1).",
      "Untuk nama satu kata (mis. Sutarno) instr menghasilkan 0, sehingga substr(nama, 1, -1) menjadi kosong. Trik umumnya: cari spasi di nama || ' ', sehingga selalu ada spasi di akhir.",
    ],
    solutionSql: `SELECT
  no_rm,
  upper(substr(nama, 1, instr(nama || ' ', ' ') - 1)) AS nama_panggilan,
  substr(nik, 1, 4) || '********' || substr(nik, -4) AS nik_samaran,
  kota
FROM pasien
WHERE penjamin = 'BPJS'
ORDER BY no_rm;`,
    starterSql: STARTER,
    xpReward: XP,
    orderMatters: true,
  },

  /* ------------------------------------------------------------------ */
  /* #67 group_concat                                                    */
  /* ------------------------------------------------------------------ */
  {
    id: 't10-group-concat',
    kind: 'sql',
    tier: 10,
    order: 67,
    title: 'Satu Baris per Kunjungan, Semua Diagnosa',
    concept: 'group_concat … ORDER BY',
    story:
      'Verifikator klaim BPJS ingin melihat kunjungan dengan lebih dari satu diagnosa dalam satu baris saja, bukan satu baris per diagnosa: kodenya digabung dan urut, supaya mudah dicocokkan dengan berkas klaim yang juga urut kode.',
    task:
      "Untuk setiap kunjungan yang punya minimal 2 diagnosa, tampilkan no_rawat, nama (nama pasien), jumlah_diagnosa, diagnosa_primer (nama_penyakit dari diagnosa berjenis 'Primer'), dan daftar_kode (semua kode_icd10 kunjungan itu digabung dengan pemisah ', ' dan diurutkan A–Z, mis. 'E11.9, I10'). Urutkan berdasarkan no_rawat.",
    hint: [
      "group_concat(kolom, pemisah) menggabungkan nilai satu grup menjadi satu teks. Tanpa urutan eksplisit, urutannya mengikuti urutan baris yang kebetulan dibaca — tidak bisa diandalkan.",
      "SQLite 3.44+ mendukung urutan di dalam fungsi agregat: group_concat(d.kode_icd10, ', ' ORDER BY d.kode_icd10).",
      "Untuk diagnosa_primer, pakai agregat bersyarat di grup yang sama: MAX(CASE WHEN d.jenis = 'Primer' THEN d.nama_penyakit END). Saring 'minimal 2 diagnosa' dengan HAVING COUNT(*) >= 2.",
    ],
    solutionSql: `SELECT
  k.no_rawat,
  p.nama,
  COUNT(*) AS jumlah_diagnosa,
  MAX(CASE WHEN d.jenis = 'Primer' THEN d.nama_penyakit END) AS diagnosa_primer,
  group_concat(d.kode_icd10, ', ' ORDER BY d.kode_icd10) AS daftar_kode
FROM kunjungan k
INNER JOIN pasien p ON p.no_rm = k.no_rm
INNER JOIN diagnosa d ON d.no_rawat = k.no_rawat
GROUP BY k.no_rawat, p.nama
HAVING COUNT(*) >= 2
ORDER BY k.no_rawat;`,
    starterSql: STARTER,
    xpReward: XP,
    orderMatters: true,
  },

  /* ------------------------------------------------------------------ */
  /* #68 json_extract / ->>                                              */
  /* ------------------------------------------------------------------ */
  {
    id: 't10-json-lab',
    kind: 'sql',
    tier: 10,
    order: 68,
    title: 'Hasil Lab di Luar Nilai Rujukan',
    concept: "JSON: ->> dan json_extract",
    story:
      'Hasil laboratorium dikirim ke SATUSEHAT sebagai resource FHIR Observation dan salinannya disimpan di kolom payload tabel satusehat_log (teks JSON). Tim mutu ingin daftar hasil lab yang di luar nilai rujukan untuk ditindaklanjuti dokter — langsung dari JSON-nya, tanpa tabel lab terpisah.',
    task:
      "Dari satusehat_log berstatus 'Terkirim', ambil hasil lab (Observation yang punya valueQuantity) yang nilainya di atas batas atas atau di bawah batas bawah rujukan. Tampilkan no_rawat, pemeriksaan (code.text), nilai (valueQuantity.value), satuan (valueQuantity.unit), batas_bawah (referenceRange[0].low.value, NULL bila tidak ada), batas_atas (referenceRange[0].high.value), dan keterangan: 'Tinggi' bila nilai > batas_atas, 'Rendah' bila nilai < batas_bawah. Urutkan berdasarkan no_rawat, lalu pemeriksaan.",
    hint: [
      "Buka satu payload di Free Playground: SELECT payload FROM satusehat_log WHERE id_log = 2; Jalur JSON ditulis seperti '$.valueQuantity.value', dan elemen array dengan indeks: '$.referenceRange[0].high.value'.",
      "kolom ->> 'jalur' (atau json_extract(kolom, 'jalur')) menghasilkan nilai SQL biasa: angka tetap angka. Sedangkan kolom -> 'jalur' menghasilkan TEKS JSON: dibandingkan dengan angka, teks di SQLite selalu dianggap lebih besar; dibandingkan sesama teks, urutannya per karakter sehingga '85' > '150' (trombosit rendah jadi terlihat 'Tinggi').",
      'Tekanan darah tidak punya valueQuantity (nilainya di array component), jadi tersaring otomatis bila kamu mensyaratkan nilai IS NOT NULL. Membandingkan dengan batas yang NULL menghasilkan NULL (tidak memenuhi), sehingga lab tanpa batas bawah tetap aman.',
    ],
    solutionSql: `WITH lab AS (
  SELECT
    no_rawat,
    payload ->> '$.code.text' AS pemeriksaan,
    payload ->> '$.valueQuantity.value' AS nilai,
    payload ->> '$.valueQuantity.unit' AS satuan,
    payload ->> '$.referenceRange[0].low.value' AS batas_bawah,
    payload ->> '$.referenceRange[0].high.value' AS batas_atas
  FROM satusehat_log
  WHERE status_kirim = 'Terkirim'
    AND payload ->> '$.valueQuantity.value' IS NOT NULL
)
SELECT
  no_rawat,
  pemeriksaan,
  nilai,
  satuan,
  batas_bawah,
  batas_atas,
  CASE WHEN nilai > batas_atas THEN 'Tinggi' ELSE 'Rendah' END AS keterangan
FROM lab
WHERE nilai > batas_atas OR nilai < batas_bawah
ORDER BY no_rawat, pemeriksaan;`,
    starterSql: '-- Lihat dulu bentuk JSON-nya:\n-- SELECT payload FROM satusehat_log WHERE id_log = 2;\nSELECT ',
    xpReward: XP,
    orderMatters: true,
  },

  /* ------------------------------------------------------------------ */
  /* #69 Tebak hasil: -> vs ->>                                          */
  /* ------------------------------------------------------------------ */
  {
    id: 't10-predict-json',
    kind: 'predict',
    tier: 10,
    order: 69,
    title: 'Tebak: Satu Panah atau Dua Panah?',
    concept: 'Tebak Hasil: -> vs ->>',
    story:
      'Programmer integrasi SATUSEHAT menampilkan nama pemeriksaan di laporan dan heran: kenapa di satu kolom namanya muncul dengan tanda kutip? Sebelum menjalankan query-nya, coba tebak dulu apa yang dihasilkan dua operator panah ini.',
    task:
      'Baca query di panel kanan TANPA menjalankannya, lalu pilih tabel yang benar-benar dihasilkan query itu. Perhatikan beda operator -> dan ->>.',
    hint: [
      '-> mengembalikan bagian JSON SEBAGAI JSON: teks JSON tetap memakai tanda kutip ganda, objek tetap berbentuk {…}.',
      '->> mengembalikan nilai SQL biasa (sama seperti json_extract): teks tanpa kutip, angka sebagai angka, null JSON sebagai NULL.',
    ],
    query: `SELECT
  payload -> '$.code.text' AS panah_satu,
  payload ->> '$.code.text' AS panah_dua
FROM satusehat_log
WHERE id_log = 13;`,
    explanation:
      '-> menghasilkan representasi JSON dari nilai yang ditunjuk, sehingga teks "Trombosit" tetap berupa string JSON lengkap dengan tanda kutip ganda. ->> (dan json_extract) "membuka" nilai itu menjadi nilai SQL biasa: Trombosit tanpa kutip. Gunakan ->> untuk menampilkan, membandingkan, dan menghitung; gunakan -> bila hasilnya akan diolah lagi sebagai JSON (mis. mengambil objek lalu diteruskan ke json_each).',
    distractors: [
      {
        sql: `SELECT
  payload ->> '$.code.text' AS panah_satu,
  payload ->> '$.code.text' AS panah_dua
FROM satusehat_log
WHERE id_log = 13;`,
        misconception: 'Mengira -> dan ->> sama saja (keduanya mengembalikan teks biasa). Padahal -> mengembalikan JSON, sehingga string tetap dibungkus tanda kutip ganda.',
      },
      {
        sql: `SELECT
  payload ->> '$.code.text' AS panah_satu,
  payload -> '$.code.text' AS panah_dua
FROM satusehat_log
WHERE id_log = 13;`,
        misconception: 'Tertukar: mengira panah ganda (->>) yang mempertahankan format JSON. Ingat: panah tambahan = "keluarkan lagi" menjadi nilai SQL biasa.',
      },
      {
        sql: `SELECT
  NULL AS panah_satu,
  payload ->> '$.code.text' AS panah_dua
FROM satusehat_log
WHERE id_log = 13;`,
        misconception: 'Mengira -> hanya bisa dipakai untuk objek/array sehingga teks menghasilkan NULL. Padahal -> bisa menunjuk nilai apa pun dan mengembalikannya dalam bentuk JSON.',
      },
    ],
    xpReward: XP,
    orderMatters: false,
  },

  /* ------------------------------------------------------------------ */
  /* #70 json_each                                                       */
  /* ------------------------------------------------------------------ */
  {
    id: 't10-json-each',
    kind: 'sql',
    tier: 10,
    order: 70,
    title: 'Tekanan Darah dari Array Component',
    concept: 'json_each + Pivot',
    story:
      'Di FHIR, tekanan darah dikirim sebagai satu Observation dengan array component: satu elemen sistolik (LOINC 8480-6) dan satu diastolik (8462-4). Rekan programmer selalu mengambil component[0] sebagai sistolik — sampai dokter jantung menemukan pasien yang "sistolik 90, diastolik 142". Standar FHIR tidak menjamin urutan elemen array.',
    task:
      "Untuk setiap log tekanan darah (Observation berkode LOINC 85354-9 di code.coding[0].code) yang statusnya BUKAN 'Gagal', tampilkan no_rawat, nama (nama pasien), sistolik, diastolik, dan kategori: 'Hipertensi derajat 2' bila sistolik ≥ 160 atau diastolik ≥ 100; 'Hipertensi derajat 1' bila sistolik ≥ 140 atau diastolik ≥ 90; selain itu 'Normal'. Sistolik dan diastolik harus dicari berdasarkan kode LOINC komponennya, bukan posisinya di array. Urutkan berdasarkan no_rawat.",
    hint: [
      "json_each(kolom, '$.component') adalah table-valued function: tulis di FROM seperti tabel (FROM satusehat_log l, json_each(l.payload, '$.component') c), dan setiap elemen array menjadi satu baris dengan kolom c.value berisi elemen itu.",
      "Kode komponen ada di c.value ->> '$.code.coding[0].code'. Ubah dua baris komponen menjadi dua kolom dengan pivot: MAX(CASE WHEN kode = '8480-6' THEN c.value ->> '$.valueQuantity.value' END) AS sistolik, lalu GROUP BY log-nya (l.id_log).",
      'Hitung sistolik & diastolik di CTE dulu, lalu tulis CASE kategori di query luar. Periksa urutan CASE: derajat 2 harus diperiksa sebelum derajat 1.',
    ],
    solutionSql: `WITH tekanan AS (
  SELECT
    l.id_log,
    l.no_rawat,
    p.nama,
    MAX(CASE WHEN c.value ->> '$.code.coding[0].code' = '8480-6' THEN c.value ->> '$.valueQuantity.value' END) AS sistolik,
    MAX(CASE WHEN c.value ->> '$.code.coding[0].code' = '8462-4' THEN c.value ->> '$.valueQuantity.value' END) AS diastolik
  FROM satusehat_log l
  INNER JOIN kunjungan k ON k.no_rawat = l.no_rawat
  INNER JOIN pasien p ON p.no_rm = k.no_rm
  CROSS JOIN json_each(l.payload, '$.component') c
  WHERE l.payload ->> '$.code.coding[0].code' = '85354-9'
    AND l.status_kirim <> 'Gagal'
  GROUP BY l.id_log, l.no_rawat, p.nama
)
SELECT
  no_rawat,
  nama,
  sistolik,
  diastolik,
  CASE
    WHEN sistolik >= 160 OR diastolik >= 100 THEN 'Hipertensi derajat 2'
    WHEN sistolik >= 140 OR diastolik >= 90 THEN 'Hipertensi derajat 1'
    ELSE 'Normal'
  END AS kategori
FROM tekanan
ORDER BY no_rawat;`,
    starterSql: '-- Lihat satu Observation tekanan darah:\n-- SELECT payload FROM satusehat_log WHERE id_log = 8;\nSELECT ',
    xpReward: XP,
    orderMatters: true,
  },

  /* ------------------------------------------------------------------ */
  /* #71 Perbaiki Bug: BETWEEN pada kolom tanggal+jam                    */
  /* ------------------------------------------------------------------ */
  {
    id: 't10-fix-waktu',
    kind: 'sql',
    tier: 10,
    order: 71,
    title: 'Kiriman 31 Oktober yang Menghilang',
    concept: 'Debug: BETWEEN & Tanggal+Jam',
    story:
      'Laporan harian pengiriman SATUSEHAT bulan Oktober tidak cocok dengan dashboard Kemenkes: dua resource yang dikirim ulang pada 31 Oktober pagi tidak muncul di laporan. Kolom waktu_kirim menyimpan tanggal DAN jam (mis. 2026-10-31 08:12:40).',
    task:
      "Perbaiki query di editor (mengandung 1 bug). Hasil yang diminta: untuk setiap tanggal di bulan Oktober 2026 yang punya pengiriman, kolom tanggal (tanggal dari waktu_kirim), terkirim (banyaknya log berstatus 'Terkirim'), dan gagal (banyaknya log berstatus 'Gagal'), diurutkan berdasarkan tanggal.",
    hint: [
      "Bandingkan teks '2026-10-31 08:12:40' dengan '2026-10-31': mana yang lebih besar secara urutan teks?",
      "BETWEEN '2026-10-01' AND '2026-10-31' berhenti tepat di '2026-10-31' (tengah malam di awal hari itu). Semua waktu di tanggal 31 setelah 00:00:00 berada di LUAR rentang.",
      "Pola yang aman untuk kolom tanggal+jam: batas atas eksklusif di awal hari berikutnya — waktu_kirim >= '2026-10-01' AND waktu_kirim < '2026-11-01'. Pola ini juga tetap bisa memakai index (sargable).",
    ],
    solutionSql: `SELECT
  date(waktu_kirim) AS tanggal,
  SUM(status_kirim = 'Terkirim') AS terkirim,
  SUM(status_kirim = 'Gagal') AS gagal
FROM satusehat_log
WHERE waktu_kirim >= '2026-10-01'
  AND waktu_kirim < '2026-11-01'
GROUP BY date(waktu_kirim)
ORDER BY tanggal;`,
    starterSql: `-- Laporan harian pengiriman SATUSEHAT Oktober (ada kiriman yang hilang)
SELECT
  date(waktu_kirim) AS tanggal,
  SUM(status_kirim = 'Terkirim') AS terkirim,
  SUM(status_kirim = 'Gagal') AS gagal
FROM satusehat_log
WHERE waktu_kirim BETWEEN '2026-10-01' AND '2026-10-31'
GROUP BY date(waktu_kirim)
ORDER BY tanggal;`,
    xpReward: XP,
    orderMatters: true,
    fix: { bugCount: 1 },
  },
];
