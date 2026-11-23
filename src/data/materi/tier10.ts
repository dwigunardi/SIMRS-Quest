/**
 * Materi untuk konsep yang diperkenalkan di Tier 10 (fungsi tanggal, teks & JSON).
 * Contoh sengaja memakai kasus lain dari soal misi (umur pasien Umum, format rupiah, pasien per kota, field FHIR lain,
 * membangun JSON), dan diperiksa `npm run verify` agar tidak sama dengan Expected Output misi.
 */
import type { Article } from '../../types';

export const ARTICLES_TIER10: Article[] = [
  {
    id: 'fungsi-tanggal',
    title: 'Fungsi Tanggal & Waktu',
    summary: 'date, strftime, julianday, dan modifier seperti +1 day / start of month — untuk umur, rentang waktu, nama hari, dan rekap per bulan, plus jebakan kolom tanggal+jam.',
    tier: 10,
    missions: ['t10-umur', 't10-hari-sibuk', 't10-fix-waktu'],
    sections: [
      {
        heading: 'Tanggal di SQLite adalah teks ISO',
        body: `SQLite tidak punya tipe DATE khusus. Tanggal disimpan sebagai teks \`YYYY-MM-DD\` (atau \`YYYY-MM-DD HH:MM:SS\`), dan karena formatnya dari satuan terbesar ke terkecil, **urutan teks sama dengan urutan waktu** — perbandingan \`<\`, \`>\`, \`BETWEEN\`, dan \`ORDER BY\` bekerja langsung.

Fungsi utama:

- \`date(t, modifier…)\` → \`YYYY-MM-DD\`; \`datetime(t, …)\` → dengan jam.
- \`strftime(format, t)\` → bagian tertentu sebagai **teks**: \`%Y\` tahun, \`%m\` bulan, \`%d\` tanggal, \`%w\` hari (0 = Minggu), \`%j\` hari ke- dalam tahun, \`%H:%M\` jam.
- \`julianday(t)\` → angka hari (pecahan); selisih dua julianday = selisih hari.
- Modifier: \`'+7 days'\`, \`'-1 month'\`, \`'start of month'\`, \`'weekday 1'\` (Senin berikutnya), \`'localtime'\`.

Hasil strftime selalu teks: \`strftime('%m', t) = 10\` membandingkan teks dengan angka. Bandingkan dengan \`'10'\`, atau \`CAST(… AS INTEGER)\`.`,
        examples: [
          {
            title: 'Rekap kunjungan per bulan',
            sql: `SELECT strftime('%Y-%m', tgl_kunjungan) AS bulan, COUNT(*) AS jumlah
FROM kunjungan
GROUP BY bulan
ORDER BY bulan;`,
            note: '`strftime(\'%Y-%m\', …)` memotong tanggal menjadi bulan, sehingga GROUP BY mengelompokkan per bulan.',
          },
          {
            title: 'Modifier: akhir bulan dan "satu bulan kemudian"',
            sql: `SELECT
  date('2026-10-15', 'start of month') AS awal_bulan,
  date('2026-10-15', 'start of month', '+1 month', '-1 day') AS akhir_bulan,
  date('2026-01-31', '+1 month') AS jebakan_31_januari,
  date('2026-11-23', 'weekday 1') AS senin_berikutnya;`,
            note: '`2026-01-31 + 1 month` menjadi **2026-03-03**, bukan akhir Februari: SQLite menambah bulan lalu "meluapkan" tanggal 31 Februari ke Maret. Untuk akhir bulan, pakai pola `start of month, +1 month, -1 day`.',
          },
          {
            title: 'Berapa hari sejak kunjungan terakhir (per 30 November)?',
            sql: `SELECT p.nama, MAX(k.tgl_kunjungan) AS terakhir,
  CAST(julianday('2026-11-30') - julianday(MAX(k.tgl_kunjungan)) AS INTEGER) AS hari_sejak
FROM pasien p
JOIN kunjungan k ON k.no_rm = p.no_rm
WHERE p.penjamin = 'Umum'
GROUP BY p.no_rm
ORDER BY hari_sejak DESC;`,
            note: 'Selisih julianday menghasilkan jumlah hari (bisa pecahan bila ada jam). `CAST(… AS INTEGER)` membuang pecahannya.',
          },
        ],
      },
      {
        heading: 'Umur & rentang waktu yang benar',
        body: `**Umur** bukan sekadar selisih tahun: ulang tahun di tahun itu harus sudah lewat. Pola yang tepat:

\`tahun(sekarang) − tahun(lahir) − (strftime('%m-%d', sekarang) < strftime('%m-%d', lahir))\`

Perbandingan di SQLite bernilai 1 atau 0, jadi bisa langsung dikurangkan. \`(julianday(a) − julianday(b)) / 365\` meleset di sekitar ulang tahun karena tahun kabisat; dengan \`/ 365.2425\` jauh lebih dekat, tetapi tetap pecahan — pola tahun-bulan-tanggal di atas paling bisa dipercaya.

**Rentang tanggal pada kolom yang berisi jam** (mis. \`2026-10-31 08:12:40\`): \`BETWEEN '2026-10-01' AND '2026-10-31'\` berhenti di \`'2026-10-31'\` (tengah malam di awal hari), sehingga semua kejadian tanggal 31 setelah pukul 00:00 terbuang. Pakai batas atas eksklusif: \`>= '2026-10-01' AND < '2026-11-01'\` — tetap benar untuk kolom dengan atau tanpa jam, dan tetap sargable (bisa memakai index).`,
        examples: [
          {
            title: 'Umur pasien Umum per 1 Januari 2027',
            sql: `SELECT nama, tgl_lahir,
  2027 - CAST(strftime('%Y', tgl_lahir) AS INTEGER) - ('01-01' < strftime('%m-%d', tgl_lahir)) AS umur
FROM pasien
WHERE penjamin = 'Umum'
ORDER BY tgl_lahir;`,
            note: 'Semua pasien lahir setelah tanggal 1 Januari, jadi ulang tahunnya di 2027 belum lewat dan umurnya berkurang 1 dari selisih tahun — kecuali yang lahir tepat 1 Januari.',
          },
        ],
      },
    ],
    pitfalls: [
      'Menghitung umur dengan selisih tahun saja — pasien yang belum berulang tahun tercatat setahun lebih tua.',
      "Membandingkan hasil strftime (teks) dengan angka, mis. strftime('%w', t) = 0 — selalu salah; tulis '0'.",
      "BETWEEN '…-31' pada kolom tanggal+jam membuang hampir seluruh hari terakhir; pakai < awal periode berikutnya.",
      'Menyimpan tanggal dengan format lain (31/10/2026) — perbandingan dan urutan teks jadi kacau dan fungsi tanggal mengembalikan NULL.',
    ],
    dialects: [
      {
        label: 'Bagian tanggal',
        syntax: {
          sqlite: "strftime('%Y', t)  -- teks",
          sqlServer: 'YEAR(t) / DATEPART(year, t)',
          mysql: 'YEAR(t) / EXTRACT(YEAR FROM t)',
          postgresql: 'EXTRACT(YEAR FROM t) / date_part(\'year\', t)',
          oracle: 'EXTRACT(YEAR FROM t)',
        },
      },
      {
        label: 'Tambah interval',
        syntax: {
          sqlite: "date(t, '+7 days')",
          sqlServer: 'DATEADD(day, 7, t)',
          mysql: 'DATE_ADD(t, INTERVAL 7 DAY)',
          postgresql: "t + INTERVAL '7 days'",
          oracle: 't + 7  /  t + INTERVAL \'7\' DAY',
        },
      },
      {
        label: 'Selisih hari',
        syntax: {
          sqlite: 'julianday(b) - julianday(a)',
          sqlServer: 'DATEDIFF(day, a, b)',
          mysql: 'DATEDIFF(b, a)',
          postgresql: 'b - a  -- untuk tipe date',
          oracle: 'b - a  -- untuk tipe DATE',
        },
      },
      {
        label: 'Umur (tahun penuh)',
        syntax: {
          sqlite: "pola tahun − tahun − (mm-dd < mm-dd)",
          sqlServer: 'DATEDIFF(year, lahir, t) − koreksi ulang tahun (DATEDIFF hanya menghitung batas tahun)',
          mysql: 'TIMESTAMPDIFF(YEAR, lahir, t)',
          postgresql: "date_part('year', age(t, lahir))",
          oracle: 'TRUNC(MONTHS_BETWEEN(t, lahir) / 12)',
        },
      },
    ],
  },

  {
    id: 'fungsi-teks',
    title: 'Fungsi Teks & group_concat',
    summary: 'substr, instr, upper/lower, replace, trim, printf, dan group_concat — merapikan, memotong, memformat, dan menggabungkan teks.',
    tier: 10,
    missions: ['t10-masking', 't10-group-concat'],
    sections: [
      {
        heading: 'Memotong, mencari, dan memformat',
        body: `- \`substr(t, mulai, panjang)\` — posisi dimulai dari **1**. \`mulai\` negatif menghitung dari belakang: \`substr(nik, -4)\` = 4 karakter terakhir.
- \`instr(t, cari)\` — posisi kemunculan pertama, **0** bila tidak ada (perhatikan saat dipakai sebagai panjang!).
- \`upper\`, \`lower\`, \`trim\` / \`ltrim\` / \`rtrim\`, \`length\`, \`replace(t, lama, baru)\`.
- \`||\` menyambung teks; \`NULL || 'x'\` hasilnya NULL — bungkus dengan \`COALESCE\` bila kolom bisa kosong.
- \`printf(format, …)\` (alias \`format\`): \`'%05d'\` angka dengan nol di depan, \`'%,d'\` pemisah ribuan, \`'%.2f'\` dua desimal.

**Masking data pribadi** (UU PDP): tampilkan sebagian saja, mis. 4 digit awal + bintang + 4 digit akhir. Lakukan di query/tampilan; data aslinya tetap utuh di tabel.`,
        examples: [
          {
            title: 'Format rupiah ala Indonesia',
            sql: `SELECT no_rawat,
  total_biaya,
  'Rp' || replace(printf('%,d', total_biaya), ',', '.') AS rupiah
FROM billing
WHERE total_biaya >= 1000000
ORDER BY total_biaya DESC;`,
            note: '`printf(\'%,d\')` memakai koma sebagai pemisah ribuan; `replace` mengubahnya menjadi titik sesuai format Indonesia.',
          },
          {
            title: 'Gelar dokter: ada spesialis atau tidak?',
            sql: `SELECT nama_dokter,
  instr(nama_dokter, ', Sp.') AS posisi_gelar,
  CASE WHEN instr(nama_dokter, ', Sp.') > 0 THEN substr(nama_dokter, instr(nama_dokter, ', Sp.') + 2) END AS gelar_spesialis
FROM dokter;`,
            note: 'Dokter umum dan dokter gigi tidak punya ", Sp.", sehingga instr = 0 dan gelar_spesialis NULL.',
          },
        ],
      },
      {
        heading: 'group_concat: banyak baris menjadi satu teks',
        body: `\`group_concat(kolom, pemisah)\` adalah fungsi agregat: setiap grup menghasilkan satu teks gabungan. Pemisah bawaannya \`','\` tanpa spasi.

**Urutan isi gabungan tidak dijamin** tanpa permintaan eksplisit — biasanya mengikuti urutan baris yang kebetulan dibaca. Sejak SQLite 3.44, urutkan langsung di dalam fungsi: \`group_concat(kolom, ', ' ORDER BY kolom)\`. \`string_agg(kolom, pemisah)\` adalah nama lain yang sama dengan PostgreSQL/SQL Server.

\`group_concat(DISTINCT kolom)\` membuang duplikat, tetapi DISTINCT hanya boleh dengan satu argumen (pemisah bawaan). Untuk distinct + pemisah lain, buang duplikat dulu di subquery.`,
        examples: [
          {
            title: 'Daftar pasien per kota',
            sql: `SELECT kota,
  COUNT(*) AS jumlah,
  group_concat(nama, ' · ' ORDER BY nama) AS pasien
FROM pasien
GROUP BY kota
ORDER BY jumlah DESC, kota;`,
            note: 'Satu baris per kota. Coba hapus `ORDER BY nama` di dalam group_concat — urutan nama mengikuti urutan baris di tabel.',
          },
        ],
      },
    ],
    pitfalls: [
      "Memakai instr(t, ' ') sebagai panjang substr untuk teks tanpa spasi — instr = 0 sehingga hasilnya kosong; tambahkan spasi: instr(t || ' ', ' ').",
      'Lupa bahwa substr dimulai dari 1, bukan 0.',
      'Mengandalkan urutan isi group_concat tanpa ORDER BY.',
      "Menyambung kolom yang bisa NULL dengan || — seluruh hasilnya NULL.",
    ],
    dialects: [
      {
        label: 'Menggabungkan teks satu grup',
        syntax: {
          sqlite: "group_concat(x, ', ' ORDER BY x)  /  string_agg",
          sqlServer: "STRING_AGG(x, ', ') WITHIN GROUP (ORDER BY x)",
          mysql: "GROUP_CONCAT(x ORDER BY x SEPARATOR ', ')",
          postgresql: "string_agg(x, ', ' ORDER BY x)",
          oracle: "LISTAGG(x, ', ') WITHIN GROUP (ORDER BY x)",
        },
      },
      {
        label: 'Potong & cari',
        syntax: {
          sqlite: 'substr(t, 1, 4) / instr(t, x)',
          sqlServer: 'SUBSTRING(t, 1, 4) / CHARINDEX(x, t)',
          mysql: 'SUBSTRING(t, 1, 4) / INSTR(t, x) / LOCATE(x, t)',
          postgresql: 'substring(t from 1 for 4) / strpos(t, x)',
          oracle: 'SUBSTR(t, 1, 4) / INSTR(t, x)',
        },
      },
      {
        label: 'Sambung teks',
        syntax: {
          sqlite: "a || b",
          sqlServer: 'a + b  /  CONCAT(a, b)',
          mysql: 'CONCAT(a, b)  (|| = OR secara bawaan)',
          postgresql: 'a || b  /  concat(a, b)',
          oracle: 'a || b',
        },
      },
    ],
  },

  {
    id: 'json',
    title: 'JSON di SQL (FHIR & SATUSEHAT)',
    summary: 'Membaca JSON dengan ->, ->>, json_extract, dan json_each; membuat JSON dengan json_object — dasar mengolah resource FHIR untuk integrasi SATUSEHAT.',
    tier: 10,
    missions: ['t10-json-lab', 't10-predict-json', 't10-json-each'],
    sections: [
      {
        heading: 'Kenapa JSON? Resource FHIR',
        body: `SATUSEHAT (platform interoperabilitas Kemenkes) menerima data dalam standar **HL7 FHIR**: setiap data klinis adalah *resource* JSON — Patient, Encounter, Condition, Observation, dan seterusnya. Bentuknya bertingkat (objek di dalam objek) dan berisi array, jadi tidak pas dipecah ke kolom-kolom tetap. Banyak SIMRS menyimpan salinan payload yang dikirim apa adanya — seperti kolom \`payload\` di tabel \`satusehat_log\`.

**Jalur JSON** menunjuk bagian dokumen: \`'$'\` = akar, \`'$.code.text'\` = field bertingkat, \`'$.component[0]'\` = elemen pertama array, \`'$.component[#-1]'\` = elemen terakhir.

- \`json_extract(j, jalur)\` dan \`j ->> jalur\` → **nilai SQL**: teks tanpa kutip, angka sebagai angka.
- \`j -> jalur\` → **teks JSON**: string tetap berkutip, objek tetap \`{…}\`. Cocok untuk diteruskan ke fungsi JSON lain.
- \`json_valid(j)\`, \`json_type(j, jalur)\` — memeriksa bentuk data (tabel ini memakai \`CHECK (json_valid(payload))\`).`,
        examples: [
          {
            title: 'Siapa pasiennya & kapan diperiksa?',
            sql: `SELECT id_log,
  payload ->> '$.subject.reference' AS pasien,
  payload ->> '$.effectiveDateTime' AS waktu_periksa,
  payload ->> '$.category[0].coding[0].code' AS kategori,
  json_type(payload, '$.component') AS tipe_component
FROM satusehat_log
WHERE status_kirim = 'Antri' OR id_log <= 3;`,
            note: '`json_type` bernilai `array` untuk Observation tekanan darah dan NULL bila field-nya tidak ada (hasil lab tidak punya component).',
          },
          {
            title: 'Membaca pesan error dari respons SATUSEHAT',
            sql: `SELECT id_log, waktu_kirim,
  response ->> '$.issue[0].severity' AS tingkat,
  response ->> '$.issue[0].diagnostics' AS pesan
FROM satusehat_log
WHERE status_kirim = 'Gagal';`,
            note: 'Respons gagal berbentuk OperationOutcome dengan array issue. Baris yang berhasil punya response NULL.',
          },
        ],
      },
      {
        heading: 'Array dengan json_each, dan membuat JSON',
        body: `\`json_each(j, jalur)\` adalah *table-valued function*: dipakai di FROM seperti tabel, dan setiap elemen array (atau setiap field objek) menjadi satu baris dengan kolom \`key\`, \`value\`, \`type\`, \`fullkey\`. Biasanya ditulis \`FROM tabel t, json_each(t.kolom, '$.array') e\`, lalu \`e.value ->> '$.field'\`.

**Jangan bergantung pada posisi elemen array** kecuali standarnya menjamin urutan: cari elemen berdasarkan isinya (mis. kode LOINC), bukan \`[0]\`.

Arah sebaliknya — **membuat JSON dari tabel** — dipakai saat menyusun payload yang akan dikirim: \`json_object('kunci', nilai, …)\`, \`json_array(…)\`, dan agregat \`json_group_array(…)\` / \`json_group_object(…)\`.`,
        examples: [
          {
            title: 'Membongkar array category setiap log',
            sql: `SELECT l.id_log, e.key AS indeks, e.value ->> '$.coding[0].code' AS kategori
FROM satusehat_log l, json_each(l.payload, '$.category') e
WHERE l.id_log BETWEEN 1 AND 4;`,
            note: 'Setiap log punya satu elemen category, jadi satu baris per log; `e.key` adalah indeks elemen di array (0).',
          },
          {
            title: 'Menyusun payload Patient sederhana',
            sql: `SELECT json_object(
  'resourceType', 'Patient',
  'identifier', json_array(json_object('system', 'https://fhir.kemkes.go.id/id/nik', 'value', nik)),
  'name', json_array(json_object('text', nama)),
  'gender', CASE jenis_kelamin WHEN 'L' THEN 'male' ELSE 'female' END,
  'birthDate', tgl_lahir
) AS payload_patient
FROM pasien
WHERE no_rm IN ('RM-0003', 'RM-0004');`,
            note: 'json_object menyusun teks JSON yang valid (kutip & escape diurus otomatis) — jauh lebih aman daripada menyambung string dengan ||.',
          },
        ],
      },
    ],
    pitfalls: [
      "Membandingkan hasil -> (teks JSON) dengan angka: di SQLite teks selalu dianggap lebih besar dari angka, jadi semua baris lolos. Pakai ->> atau json_extract.",
      'Menganggap elemen array FHIR selalu urut (component[0] = sistolik) — cari berdasarkan kode.',
      'Menyusun JSON dengan menyambung string (||) — kutip di dalam data merusak JSON-nya; pakai json_object.',
      "Jalur tanpa '$' di depan atau salah huruf besar/kecil — nama field JSON peka huruf besar/kecil (valueQuantity ≠ valuequantity).",
    ],
    dialects: [
      {
        label: 'Ambil nilai skalar',
        syntax: {
          sqlite: "j ->> '$.a.b'  /  json_extract(j, '$.a.b')",
          sqlServer: "JSON_VALUE(j, '$.a.b')",
          mysql: "j ->> '$.a.b'  /  JSON_UNQUOTE(JSON_EXTRACT(j, '$.a.b'))",
          postgresql: "j #>> '{a,b}'  /  j -> 'a' ->> 'b'  (kolom jsonb)",
          oracle: "JSON_VALUE(j, '$.a.b')",
        },
      },
      {
        label: 'Bongkar array menjadi baris',
        syntax: {
          sqlite: "FROM t, json_each(t.j, '$.arr')",
          sqlServer: "CROSS APPLY OPENJSON(t.j, '$.arr')",
          mysql: "JSON_TABLE(t.j, '$.arr[*]' COLUMNS (…))",
          postgresql: "CROSS JOIN LATERAL jsonb_array_elements(t.j -> 'arr')",
          oracle: "JSON_TABLE(t.j, '$.arr[*]' COLUMNS (…))",
        },
      },
      {
        label: 'Tipe kolom JSON',
        syntax: {
          sqlite: 'TEXT + CHECK (json_valid(kolom))  (atau JSONB biner sejak 3.45)',
          sqlServer: 'NVARCHAR(MAX) + ISJSON  (tipe json di 2025)',
          mysql: 'JSON',
          postgresql: 'jsonb (disarankan) / json',
          oracle: 'JSON (21c+) / CLOB + IS JSON',
        },
      },
    ],
  },
];
