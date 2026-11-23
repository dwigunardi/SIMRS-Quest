/**
 * Tier 7 – Optimasi & Keamanan.
 * - #46: grading 'index' (CREATE INDEX + EXPLAIN QUERY PLAN probe).
 * - #47: grading 'result' + requireIndexOn (query sargable).
 * - #48: lab injection tautologi (' OR '1'='1) — target: ke-20 no_rm pasien tampil (contains-all-values).
 * - #49: lab injection UNION SELECT — target: total_biaya 18750000 tampil DAN SQL rentan membaca FROM billing.
 * - #50: kartu konsep prepared statement + kuis.
 */
import type { Mission, TierInfo } from '../../types';

export const TIER7: TierInfo = {
  tier: 7,
  name: 'Optimasi & Keamanan',
  description:
    'Membuat query cepat dengan index dan filter yang sargable, membaca EXPLAIN QUERY PLAN, serta melindungi aplikasi dengan prepared statement.',
};

const XP = 225;

export const MISSIONS_TIER7: Mission[] = [
  {
    id: 't7-index',
    kind: 'sql',
    tier: 7,
    order: 46,
    title: 'Laporan Hipertensi yang Lambat',
    concept: 'CREATE INDEX',
    story:
      "Dashboard surveilans penyakit tidak menular memanggil query WHERE kode_icd10 = 'I10' setiap beberapa detik. Di data dummy ini hanya ada 32 diagnosa, tetapi di RS sungguhan tabel diagnosa bisa berisi jutaan baris. Tanpa index, SQLite harus melakukan full table scan (SCAN diagnosa), yaitu membaca SEMUA baris satu per satu. Index B-tree pada kode_icd10 bekerja seperti indeks di belakang buku: database langsung melompat ke baris 'I10' (SEARCH ... USING INDEX). Biayanya, setiap INSERT/UPDATE/DELETE juga harus memperbarui index dan index memakan ruang disk. Jadi index hanya dibuat untuk kolom yang memang sering difilter atau di-JOIN.",
    task:
      "Buat index bernama idx_diagnosa_icd10 pada tabel diagnosa, kolom kode_icd10. Penilaian: (1) harus ada index di tabel diagnosa dengan kolom PERTAMA kode_icd10, dan (2) EXPLAIN QUERY PLAN untuk SELECT no_rawat, nama_penyakit FROM diagnosa WHERE kode_icd10 = 'I10' harus berubah dari SCAN menjadi SEARCH ... USING INDEX.",
    hint: [
      "Coba dulu di Playground: EXPLAIN QUERY PLAN SELECT no_rawat, nama_penyakit FROM diagnosa WHERE kode_icd10 = 'I10'; Kolom detail akan menunjukkan SCAN diagnosa, artinya semua baris dibaca.",
      'Sintaksnya: CREATE INDEX nama_index ON nama_tabel (nama_kolom); Konvensi penamaan yang umum: idx_<tabel>_<kolom>.',
      'Jangan memakai UNIQUE (kode ICD-10 berulang di banyak kunjungan), jangan menambahkan COLLATE NOCASE, dan jangan membungkus kolom dengan fungsi. Index seperti itu tidak cocok untuk perbandingan = biasa sehingga planner tetap SCAN. Setelah membuat index, jalankan ulang EXPLAIN QUERY PLAN untuk melihat bedanya.',
    ],
    solutionSql: 'CREATE INDEX idx_diagnosa_icd10 ON diagnosa (kode_icd10);',
    starterSql:
      "-- Lihat rencana eksekusi sebelum ada index:\n-- EXPLAIN QUERY PLAN SELECT no_rawat, nama_penyakit FROM diagnosa WHERE kode_icd10 = 'I10';\n\nCREATE INDEX ",
    xpReward: XP,
    orderMatters: false,
    grading: {
      type: 'index',
      table: 'diagnosa',
      column: 'kode_icd10',
      probeSql: "SELECT no_rawat, nama_penyakit FROM diagnosa WHERE kode_icd10 = 'I10'",
    },
    requiredPatterns: [
      { pattern: String.raw`CREATE\s+INDEX`, message: 'Misi ini wajib membuat index dengan CREATE INDEX ... ON diagnosa (kode_icd10).' },
    ],
  },
  {
    id: 't7-sargable',
    kind: 'sql',
    tier: 7,
    order: 47,
    title: 'Index Ada, Tapi Tidak Terpakai',
    concept: 'Query Sargable',
    story:
      "Tabel kunjungan sudah punya index idx_kunjungan_tgl pada tgl_kunjungan, tetapi laporan bulanan tetap lambat. Ternyata query-nya ditulis WHERE strftime('%Y-%m', tgl_kunjungan) = '2026-10'. Karena kolomnya dibungkus fungsi, database harus menghitung strftime untuk SETIAP baris lalu membandingkannya, jadi index tidak bisa dipakai (SCAN kunjungan). Filter yang bisa memakai index disebut sargable (Search ARGument ABLE): kolom dibiarkan polos, nilainya yang dibentuk menjadi rentang.",
    task:
      "Tampilkan kolom no_rawat, no_rm, id_poli, tgl_kunjungan, dan status untuk semua kunjungan di bulan Oktober 2026 (tanggal 1 sampai 31 Oktober). Urutan baris bebas. Hasil harus benar DAN query plan-nya harus mencari tabel kunjungan lewat index pada tgl_kunjungan dengan batas bawah dan batas atas (SEARCH kunjungan USING INDEX idx_kunjungan_tgl (tgl_kunjungan>? AND tgl_kunjungan<?)), bukan full SCAN. Kolom tgl_kunjungan tidak boleh dibungkus fungsi.",
    hint: [
      "Bandingkan di Playground: EXPLAIN QUERY PLAN untuk versi strftime(...) = '2026-10' dan untuk versi rentang tanggal. Perhatikan beda SCAN dan SEARCH.",
      "Format tanggal di kolom ini YYYY-MM-DD (teks), jadi urutan teksnya sama dengan urutan kronologis. Rentang tanggal bisa ditulis sebagai perbandingan langsung pada kolom: tgl_kunjungan >= '...' AND tgl_kunjungan < '...'.",
      "Pakai batas bawah inklusif '2026-10-01' dan batas atas eksklusif '2026-11-01'. Pola ini aman juga untuk kolom yang menyimpan jam. Hindari substr(), strftime(), date(), dan LIKE pada kolom ini: semuanya membuat planner melakukan SCAN. ORDER BY tidak dilarang (ORDER BY tgl_kunjungan bahkan memanfaatkan urutan index), tetapi tidak diperlukan karena urutan baris bebas.",
    ],
    solutionSql: `SELECT
  no_rawat,
  no_rm,
  id_poli,
  tgl_kunjungan,
  status
FROM kunjungan
WHERE tgl_kunjungan >= '2026-10-01'
  AND tgl_kunjungan < '2026-11-01';`,
    starterSql:
      "-- Versi LAMBAT (full scan). Ubah filternya menjadi sargable!\nSELECT no_rawat, no_rm, id_poli, tgl_kunjungan, status\nFROM kunjungan\nWHERE strftime('%Y-%m', tgl_kunjungan) = '2026-10';",
    xpReward: XP,
    orderMatters: false,
    grading: { type: 'result', requireIndexOn: { table: 'kunjungan', column: 'tgl_kunjungan' } },
  },
  {
    id: 't7-injection-bypass',
    kind: 'injection',
    tier: 7,
    order: 48,
    title: 'Portal Cek Pasien yang Bocor',
    concept: 'SQL Injection: Tautologi',
    story:
      "Vendor lama membuat halaman \"Cek Data Pasien\" untuk petugas loket. Programmernya membangun query dengan menyambung input langsung ke teks SQL: \"... WHERE no_rm = '\" + input + \"'\". Tim keamanan RS menugaskan kamu sebagai penguji (pentester) internal untuk membuktikan bahwa halaman ini bisa membocorkan data SEMUA pasien, padahal seharusnya hanya menampilkan satu pasien sesuai No. RM yang diketik.",
    task:
      'Ketik INPUT FORM (bukan query SQL utuh) sehingga halaman menampilkan data SELURUH pasien di tabel pasien: ke-20 No. RM harus muncul. Setelah berhasil, nyalakan "Mode aman (prepared statement)" dan kirim payload yang sama untuk melihat kenapa serangan itu gagal.',
    hint: [
      "Kirim dulu input normal (RM-0001) dan perhatikan SQL yang dibentuk server. Input kamu berada DI DALAM sepasang tanda kutip: no_rm = '...'.",
      "Jika input kamu diawali tanda kutip ', string milik server tertutup lebih awal dan sisa input dibaca sebagai kode SQL. Kondisi apa yang bisa ditambahkan dengan OR agar WHERE bernilai benar untuk setiap baris?",
      "Tanda kutip penutup dari template masih ada di ujung query. Seimbangkan dengan membiarkan input berakhir pada string yang terbuka (mis. '...'='...), atau buang sisa template dengan komentar -- di akhir input.",
    ],
    xpReward: XP,
    lab: {
      formTitle: 'Cek Data Pasien (Loket Pendaftaran)',
      inputLabel: 'Nomor Rekam Medis',
      placeholder: 'mis. RM-0001',
      vulnerableTemplate: "SELECT no_rm, nama, kota FROM pasien WHERE no_rm = '{input}'",
      safeTemplate: 'SELECT no_rm, nama, kota FROM pasien WHERE no_rm = ?',
      sampleInput: 'RM-0001',
      goal: {
        type: 'contains-all-values',
        referenceSql: 'SELECT no_rm FROM pasien',
        description: 'Buat halaman menampilkan data SEMUA pasien: ke-20 No. RM di tabel pasien harus muncul, bukan hanya satu pasien.',
      },
    },
    solutionPayload: "' OR '1'='1",
  },
  {
    id: 't7-injection-union',
    kind: 'injection',
    tier: 7,
    order: 49,
    title: 'Tagihan Bocor Lewat Pencarian Nama',
    concept: 'SQL Injection: UNION SELECT',
    story:
      "Modul \"Cari Pasien\" di portal internal hanya boleh menampilkan No. RM dan nama pasien, dan akun petugas loket tidak seharusnya bisa melihat data keuangan. Namun query pencariannya masih dirakit dengan menyambung string: \"... WHERE nama LIKE '%\" + input + \"%'\". Dengan UNION SELECT, penyerang bisa menempelkan query kedua dan membuat halaman yang sama menampilkan data dari tabel lain, misalnya tabel billing. Tim keamanan RS meminta kamu, sebagai penguji internal yang sudah mendapat izin tertulis, membuktikan celah ini di lingkungan uji agar vendor segera memperbaikinya dengan prepared statement.",
    task:
      'Ketik INPUT FORM sehingga halaman pencarian ikut menampilkan data dari tabel billing, khususnya nilai total_biaya 18750000 (tagihan rawat inap terbesar). Nilai itu harus dibaca dari kolom total_biaya tabel billing (payload kamu harus memuat FROM billing), bukan diketik sebagai angka, karena hanya itu yang membuktikan ada data yang bocor. Setelah berhasil, coba payload yang sama di mode aman.',
    hint: [
      "Kirim dulu input normal (Siti). Perhatikan bahwa query server menampilkan tepat 2 kolom (no_rm, nama) dan input kamu berada di antara '%...%'.",
      'UNION menggabungkan dua SELECT, dengan syarat jumlah kolom keduanya sama. Tutup string LIKE milik server dengan tanda kutip, lalu tempelkan SELECT kedua yang mengambil 2 kolom dari tabel billing.',
      "Sisa template (%') akan merusak sintaks. Matikan dengan komentar -- di akhir input. Kolom yang berisi nominal tagihan di tabel billing adalah total_biaya; pasangkan dengan satu kolom lain agar jumlahnya 2.",
    ],
    xpReward: XP,
    lab: {
      formTitle: 'Cari Pasien berdasarkan Nama',
      inputLabel: 'Nama pasien (boleh sebagian)',
      placeholder: 'mis. Siti',
      vulnerableTemplate: "SELECT no_rm, nama FROM pasien WHERE nama LIKE '%{input}%'",
      safeTemplate: "SELECT no_rm, nama FROM pasien WHERE nama LIKE '%' || ? || '%'",
      sampleInput: 'Siti',
      goal: {
        type: 'contains-value',
        value: 18750000,
        description: 'Buat halaman pencarian pasien ikut menampilkan nilai total_biaya 18750000 yang diambil dari tabel billing.',
      },
      requiredPatterns: [
        {
          pattern: String.raw`\bFROM\s+billing\b`,
          message:
            'Angka 18750000 memang tampil, tetapi query yang dieksekusi tidak membaca tabel billing (tidak ada FROM billing). Mengetik angkanya sendiri tidak membuktikan ada data yang bocor. Ambil nilainya dengan UNION SELECT ... FROM billing.',
        },
        {
          pattern: String.raw`\btotal_biaya\b`,
          message:
            'Nilai 18750000 harus dibaca dari kolom total_biaya, bukan diketik sebagai angka. Ganti literal angkanya dengan nama kolom total_biaya di SELECT kedua.',
        },
      ],
    },
    solutionPayload: "%' UNION SELECT no_rawat, total_biaya FROM billing --",
  },
  {
    id: 't7-prepared-statement',
    kind: 'concept',
    tier: 7,
    order: 50,
    title: 'Prepared Statement: Pertahanan Utama',
    concept: 'Prepared Statement',
    story:
      'Tim IT RS akan mengaudit semua modul SIMRS (pendaftaran online, portal hasil lab, kasir) sebelum diintegrasikan dengan SATUSEHAT. Temuan paling sering pada audit keamanan aplikasi kesehatan adalah query yang dirakit dengan menyambung string input pengguna. Sebelum memperbaikinya, seluruh programmer wajib memahami cara kerja prepared statement.',
    task:
      'Pelajari materi tentang prepared statement (parameterized query) beserta contohnya di berbagai bahasa, lalu jawab SEMUA pertanyaan kuis dengan benar.',
    hint: [
      'Kata kuncinya: pada prepared statement, struktur SQL dikompilasi lebih dulu, dan nilai input baru dikirim sesudahnya sebagai DATA. Data tidak pernah dibaca ulang sebagai kode SQL.',
      'Placeholder (? / :nama / $1) hanya bisa menggantikan NILAI. Nama tabel, nama kolom, dan arah ORDER BY tidak bisa di-bind, jadi harus divalidasi dengan whitelist.',
      'Prepared statement adalah pertahanan utama. Least privilege, validasi format input, dan menyembunyikan pesan error mentah adalah lapisan tambahan, bukan pengganti.',
    ],
    xpReward: XP,
    sections: [
      {
        heading: 'Akar masalah: data bercampur dengan kode',
        body:
          'SQL injection terjadi ketika aplikasi membuat query dengan cara menyambung (concatenate) string input pengguna ke dalam teks SQL. Bagi database, hasil sambungan itu hanyalah satu teks SQL utuh. Database tidak tahu bagian mana yang ditulis programmer dan bagian mana yang diketik pengguna. Kalau input mengandung karakter yang bermakna dalam SQL, seperti tanda kutip tunggal, struktur query bisa berubah dari yang dimaksud programmer.\n\nGejala paling sederhana: pasien bernama `O\'Brien` atau `Ma\'ruf` membuat halaman pencarian error. Kalau tanda kutip saja bisa merusak query, berarti input pengguna sedang diperlakukan sebagai kode. Itulah tanda bahaya yang harus segera diperbaiki.',
        examples: [
          {
            dialect: 'Node.js (RENTAN, jangan ditiru)',
            caption: 'Input dari form langsung disambung ke teks SQL.',
            code: `// noRm berasal dari form pencarian pasien
const sql = "SELECT no_rm, nama, kota FROM pasien WHERE no_rm = '" + noRm + "'";
const result = db.exec(sql); // struktur query bergantung pada isi noRm!`,
          },
        ],
      },
      {
        heading: 'Cara kerja prepared statement',
        body:
          'Prepared statement memisahkan dua tahap. Pertama, teks SQL dengan placeholder (`?`, `:nama`, atau `$1`) dikirim dan di-parse/dikompilasi oleh database. Pada tahap ini struktur query sudah terkunci. Kedua, nilai input dikirim terpisah lewat proses bind. Database memperlakukan nilai itu murni sebagai data bertipe (teks, angka, NULL), sehingga tanda kutip, tanda minus ganda, atau kata kunci SQL di dalamnya hanyalah karakter biasa.\n\nBonusnya: statement yang sama bisa dieksekusi ulang dengan parameter berbeda tanpa di-parse ulang (lebih efisien), dan driver menangani konversi tipe dengan benar, misalnya tanggal dan angka besar seperti NIK.',
        examples: [
          {
            dialect: 'Node.js (sql.js)',
            caption: 'Persis seperti yang dipakai aplikasi ini di mode aman.',
            code: `const stmt = db.prepare('SELECT no_rm, nama, kota FROM pasien WHERE no_rm = ?');
try {
  stmt.bind([noRm]);            // noRm dikirim sebagai DATA
  while (stmt.step()) {
    console.log(stmt.getAsObject());
  }
} finally {
  stmt.free();                  // selalu bebaskan statement
}`,
          },
          {
            dialect: 'PHP (PDO)',
            code: `$pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
$stmt = $pdo->prepare(
  'SELECT no_rawat, tgl_kunjungan, status FROM kunjungan WHERE no_rm = :no_rm AND tgl_kunjungan >= :dari'
);
$stmt->execute([':no_rm' => $_GET['no_rm'], ':dari' => '2026-10-01']);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);`,
          },
          {
            dialect: 'Java (JDBC PreparedStatement)',
            code: `String sql = "UPDATE billing SET status_bayar = ? WHERE no_rawat = ?";
try (PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setString(1, "Lunas");
    ps.setString(2, noRawat);
    int updated = ps.executeUpdate();
}`,
          },
          {
            dialect: 'Python (sqlite3 & psycopg)',
            code: `# sqlite3: placeholder ?
cur.execute("SELECT nama, penjamin FROM pasien WHERE kota = ? AND penjamin = ?", (kota, penjamin))

# psycopg (PostgreSQL): placeholder %s, BUKAN format string Python
cur.execute("SELECT nama_dokter FROM dokter WHERE id_poli = %s", (id_poli,))
# SALAH: cur.execute(f"... WHERE id_poli = '{id_poli}'")`,
          },
        ],
      },
      {
        heading: 'Mengapa escaping manual dan blacklist tidak cukup',
        body:
          'Escaping manual (mengganti `\'` menjadi `\'\'`) mudah terlewat di satu tempat saja, berbeda aturan antar-database dan charset, dan sama sekali tidak menolong di konteks angka, misalnya `WHERE id_billing = ` + input, yang nilainya tidak diapit tanda kutip. Blacklist kata (menolak "OR", "UNION", "--") selalu bisa diakali dengan variasi penulisan, dan sering malah memblokir data sah, misalnya nama jalan atau catatan klinis.\n\nWaspadai juga second-order injection: data yang tersimpan aman di database lalu suatu hari disambung ke query lain di modul berbeda. Aturannya sederhana: SETIAP nilai yang masuk ke query lewat parameter, dari mana pun asalnya.\n\nBatasan penting: placeholder hanya untuk NILAI. Nama tabel, nama kolom, dan kata kunci seperti ASC/DESC tidak bisa di-bind. Untuk fitur seperti "urutkan berdasarkan kolom pilihan pengguna", gunakan whitelist: petakan pilihan pengguna ke daftar nama kolom yang sudah pasti aman.',
        examples: [
          {
            dialect: 'TypeScript (whitelist kolom sort)',
            code: `const SORTABLE = { nama: 'nama', lahir: 'tgl_lahir', kota: 'kota' } as const;
type SortKey = keyof typeof SORTABLE;
function isSortKey(v: string): v is SortKey { return Object.hasOwn(SORTABLE, v); }

// sortParam datang dari query string/JSON: string apa pun, tipe TypeScript hilang saat runtime
function buildQuery(sortParam: string, desc: boolean): string {
  if (!isSortKey(sortParam)) throw new Error('Kolom urut tidak diizinkan'); // validasi saat runtime
  const column = SORTABLE[sortParam];
  const direction = desc ? 'DESC' : 'ASC';
  return \`SELECT no_rm, nama, kota FROM pasien WHERE penjamin = ? ORDER BY \${column} \${direction}\`;
}`,
          },
        ],
      },
      {
        heading: 'Pertahanan berlapis (defense in depth)',
        body:
          'Prepared statement adalah pertahanan utama, tetapi sistem kesehatan menyimpan data yang sangat sensitif (rekam medis, NIK, diagnosis), sehingga perlu lapisan tambahan:\n\n1. Least privilege: akun database untuk portal pasien hanya boleh SELECT pada view yang diperlukan, tidak boleh DROP, DELETE, atau membaca tabel billing. Kalau ada celah, kerusakannya terbatas.\n2. Jangan tampilkan error database mentah ke pengguna. Catat di log server dan tampilkan pesan umum.\n3. Validasi format input sebagai pelengkap, misalnya no_rm harus cocok dengan pola `RM-\\d{4}`.\n4. ORM bukan jaminan: method raw query di ORM tetap rentan kalau string disambung.\n5. Audit log dan pemantauan query yang tidak wajar.',
        examples: [
          {
            dialect: 'PostgreSQL (least privilege)',
            code: `CREATE ROLE portal_pasien LOGIN PASSWORD '***';
CREATE VIEW v_jadwal_dokter AS
  SELECT d.nama_dokter, d.spesialisasi, p.nama_poli
  FROM dokter d JOIN poliklinik p ON p.id_poli = d.id_poli;
GRANT SELECT ON v_jadwal_dokter TO portal_pasien;  -- tidak ada akses ke billing/pasien`,
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'Mengapa prepared statement mencegah SQL injection?',
        options: [
          'Karena driver otomatis menghapus semua tanda kutip dari input',
          'Karena struktur query dikompilasi lebih dulu, lalu input dikirim terpisah sebagai data yang tidak pernah di-parse sebagai SQL',
          'Karena query dienkripsi sebelum dikirim ke database',
          'Karena database menolak input yang mengandung kata kunci SQL',
        ],
        correctIndex: 1,
        explanation:
          'Pemisahan kode dan data adalah intinya. Input tidak diubah atau dihapus. Input disimpan dan dibandingkan apa adanya, hanya saja tidak pernah ikut menentukan struktur query.',
      },
      {
        id: 'q2',
        question: 'Fitur "urutkan tabel pasien berdasarkan kolom pilihan pengguna" perlu nama kolom dinamis. Apa cara yang aman?',
        options: [
          'Bind nama kolom sebagai parameter: ORDER BY ?',
          'Escape tanda kutip pada nama kolom lalu sambungkan ke query',
          'Petakan pilihan pengguna ke whitelist nama kolom yang sudah ditentukan di kode',
          'Tidak perlu apa-apa karena ORDER BY tidak bisa disusupi',
        ],
        correctIndex: 2,
        explanation:
          'Placeholder hanya menggantikan nilai. ORDER BY ? akan mengurutkan berdasarkan nilai konstanta, bukan kolom. Identifier dinamis harus berasal dari whitelist di kode.',
      },
      {
        id: 'q3',
        question: 'Query WHERE id_billing = " + input (tanpa tanda kutip) sudah memakai fungsi escape tanda kutip. Apakah aman?',
        options: [
          'Tidak aman, karena di konteks angka penyerang tidak butuh tanda kutip untuk mengubah logika query',
          'Aman, karena tanda kutip sudah di-escape',
          'Aman, asalkan input dibatasi maksimal 10 karakter',
          'Aman, karena id_billing bertipe INTEGER',
        ],
        correctIndex: 0,
        explanation:
          'Escaping hanya melindungi literal string. Di konteks angka, input bisa langsung menambah ekspresi. Gunakan parameter (atau konversi ketat ke angka), bukan escaping.',
      },
      {
        id: 'q4',
        question: 'Portal jadwal dokter sudah memakai prepared statement. Langkah tambahan mana yang PALING tepat sebagai lapisan pertahanan berikutnya?',
        options: [
          'Memakai akun database admin agar query tidak pernah gagal karena izin',
          'Menampilkan pesan error SQLite lengkap agar pengguna bisa melapor dengan detail',
          'Memakai akun database dengan hak minimum (hanya SELECT pada view jadwal) dan mencatat error di log server',
          'Menambahkan blacklist kata UNION dan OR di sisi JavaScript browser',
        ],
        correctIndex: 2,
        explanation:
          'Least privilege membatasi dampak jika ada celah lain, dan error mentah adalah kebocoran informasi. Validasi di browser mudah dilewati karena penyerang bisa mengirim request langsung.',
      },
    ],
  },
];
