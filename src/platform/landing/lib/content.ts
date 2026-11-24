/**
 * SEMUA teks & daftar landing (Beranda) ada di berkas ini — satu tempat supaya kelak mudah diterjemahkan.
 * Komponen section tidak menulis kalimatnya sendiri; mereka mengimpor dari sini.
 *
 * ATURAN ISI: landing ini milik aplikasi nyata. Setiap angka dan nama di sini diperiksa terhadap data sebenarnya oleh
 * scripts/verify/landing.ts (`npm run verify`): jumlah misi/tier/boss/materi/lencana/pangkat, XP, jadwal latihan ulang,
 * pilihan ujian, tabel & kota di database latihan, contoh misi, dan daftar jalur. Verifikasi yang sama menolak kata
 * yang menjanjikan hal yang tidak ada di aplikasi. Mengubah kurikulum? Perbarui berkas ini sampai verifikasi lolos.
 *
 * Berkas ini murni data: tidak mengimpor React, ikon, maupun data misi (Beranda harus tetap ringan). Ikon disebut
 * dengan nama (IconName) dan digambar oleh ui/Icon.tsx.
 */

/* ------------------------------------------------------------------ */
/* Fakta (angka bernama)                                               */
/* ------------------------------------------------------------------ */

export const MISSION_COUNT = 72;
export const TIER_COUNT = 10;
/** Satu Boss per tier. */
export const BOSS_COUNT = 10;
export const ARTICLE_COUNT = 39;
export const BADGE_COUNT = 23;
export const RANK_COUNT = 8;
export const TOTAL_XP = 14_800;
/** Membuka hint mengurangi XP misi itu sebesar ini (persen). */
export const HINT_PENALTY_PERCENT = 20;
/** Solusi Boss baru bisa dibuka setelah percobaan sebanyak ini. */
export const BOSS_SOLUTION_AFTER = 3;
/** Jarak tayang latihan ulang (hari) per kotak Leitner. */
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60] as const;
export const EXAM_QUESTION_COUNTS = [5, 10, 15] as const;
/** Pilihan batas waktu ujian (menit); selain itu ada pilihan tanpa batas waktu. */
export const EXAM_MINUTE_OPTIONS = [15, 30, 45] as const;
/** Banyaknya kunjungan sintetis di Lab Performa. */
export const PERF_LAB_VISITS = 200_000;
export const TABLE_COUNT = 8;
export const PATIENT_COUNT = 20;
export const CITY_COUNT = 7;

export const MASCOT_NAME = 'Kapi';
export const GITHUB_URL = 'https://github.com/dwigunardi/SIMRS-Quest';
export const LICENSE_URL = `${GITHUB_URL}/blob/HEAD/LICENSE`;
export const LICENSE_NAME = 'MIT';

/** Angka dengan pemisah ribuan Indonesia: 14800 → "14.800". */
export function formatNumber(value: number): string {
  return value.toLocaleString('id-ID');
}

/** "5, 10, atau 15" — daftar pilihan dalam kalimat. */
function orList(values: readonly number[]): string {
  if (values.length <= 1) return values.join('');
  return `${values.slice(0, -1).join(', ')}, atau ${values.at(-1)}`;
}

/* ------------------------------------------------------------------ */
/* Ikon                                                                */
/* ------------------------------------------------------------------ */

/** Nama ikon yang dikenal ui/Icon.tsx. Awalan "si-" = logo teknologi (simple-icons), sisanya lucide. */
export type IconName =
  | 'database'
  | 'braces'
  | 'globe'
  | 'atom'
  | 'layers'
  | 'book'
  | 'terminal'
  | 'clipboard-check'
  | 'chart'
  | 'github'
  | 'scale'
  | 'hard-drive'
  | 'tag'
  | 'user-x'
  | 'app-window'
  | 'table'
  | 'git-merge'
  | 'sigma'
  | 'square-stack'
  | 'workflow'
  | 'rows'
  | 'arrow-left-right'
  | 'gauge'
  | 'shield-alert'
  | 'pencil-ruler'
  | 'file-json'
  | 'calendar'
  | 'bug'
  | 'eye'
  | 'flame'
  | 'medal'
  | 'swords'
  | 'award'
  | 'timer'
  | 'repeat'
  | 'radar'
  | 'git-compare'
  | 'lightbulb'
  | 'key'
  | 'zap'
  | 'file-down'
  | 'trophy'
  | 'check'
  | 'crown'
  | 'si-javascript'
  | 'si-typescript'
  | 'si-react'
  | 'si-nestjs'
  | 'si-nextdotjs'
  | 'si-laravel';

/* ------------------------------------------------------------------ */
/* Tautan & jangkar                                                    */
/* ------------------------------------------------------------------ */

/** Tujuan di dalam aplikasi (hash router: src/platform/router.ts). */
export const ROUTES = {
  home: '#/',
  sql: '#/sql',
  missions: '#/sql/misi',
  articles: '#/sql/materi',
  playground: '#/sql/playground',
  progress: '#/sql/progres',
  exam: '#/sql/ujian',
} as const;

/**
 * id elemen tiap section. JANGAN dipakai sebagai href ("#faq" akan ditangkap router hash) — gulir dengan
 * scrollToSection() dari lib/scroll.ts.
 */
export const SECTION_IDS = {
  hero: 'beranda',
  paths: 'jalur',
  practice: 'praktik',
  outcomes: 'hasil',
  ranks: 'pangkat',
  features: 'fitur',
  stuck: 'bantuan',
  devices: 'perangkat',
  faq: 'faq',
  cta: 'mulai',
} as const;

export type SectionId = (typeof SECTION_IDS)[keyof typeof SECTION_IDS];

/* ------------------------------------------------------------------ */
/* Jalur belajar (harus cocok dengan src/platform/tracks.ts)           */
/* ------------------------------------------------------------------ */

export type LandingTrackStatus = 'tersedia' | 'segera';

export interface LandingTrack {
  /** Sama dengan id di registri jalur. */
  id: string;
  title: string;
  status: LandingTrackStatus;
  icon: IconName;
  /** Satu baris — sama dengan tagline di registri. */
  tagline: string;
  /** Apa yang dikerjakan di jalur ini (untuk panel tab). */
  summary: string;
  /** Tujuan tautan; hanya jalur yang tersedia. */
  href?: string;
}

export const TRACKS: readonly LandingTrack[] = [
  {
    id: 'sql',
    title: 'SQL',
    status: 'tersedia',
    icon: 'database',
    tagline: 'Dari SELECT pertama sampai merancang tabel SIMRS.',
    summary:
      'Menulis query di database rumah sakit: menyaring, JOIN, agregasi, window function, transaksi, index, keamanan, sampai merancang tabel.',
    href: ROUTES.sql,
  },
  {
    id: 'js',
    title: 'JavaScript & TypeScript',
    status: 'segera',
    icon: 'braces',
    tagline: 'Logika di balik layar pendaftaran dan billing.',
    summary: 'Dasar bahasa sampai tipe yang ketat, dengan kasus mengolah data pasien dan menghitung tagihan.',
  },
  {
    id: 'rest',
    title: 'REST API',
    status: 'segera',
    icon: 'globe',
    tagline: 'Membuka data SIMRS lewat endpoint yang rapi.',
    summary: 'Merancang dan memanggil API di atas database yang sama: resource, metode, kode status, validasi, dan paginasi.',
  },
  {
    id: 'react',
    title: 'React',
    status: 'segera',
    icon: 'atom',
    tagline: 'Antarmuka loket, antrean, dan rekam medis.',
    summary: 'Komponen, state, dan pengambilan data untuk layar rumah sakit, dari daftar pasien sampai formulir pendaftaran.',
  },
  {
    id: 'framework',
    title: 'NestJS · Next.js · Laravel',
    status: 'segera',
    icon: 'layers',
    tagline: 'Proyek utuh dengan framework sungguhan.',
    summary: 'Membangun modul SIMRS sebagai proyek nyata: struktur proyek, migrasi, dan pengujian.',
  },
];

export const SOON_LABEL = 'Segera';

/* ------------------------------------------------------------------ */
/* Database latihan (harus cocok dengan src/db/seed.ts)                */
/* ------------------------------------------------------------------ */

export interface PracticeTable {
  name: string;
  rows: number;
  about: string;
}

export const PRACTICE_TABLES: readonly PracticeTable[] = [
  { name: 'pasien', rows: 20, about: 'Identitas, kota asal, dan penjamin' },
  { name: 'poliklinik', rows: 7, about: 'Poli dan gedungnya' },
  { name: 'dokter', rows: 10, about: 'Dokter, spesialisasi, dan polinya' },
  { name: 'kunjungan', rows: 32, about: 'Kunjungan rawat jalan dan statusnya' },
  { name: 'diagnosa', rows: 32, about: 'Diagnosa berkode ICD-10' },
  { name: 'billing', rows: 28, about: 'Tagihan dan status bayar' },
  { name: 'struktur_organisasi', rows: 19, about: 'Bagan jabatan rumah sakit' },
  { name: 'satusehat_log', rows: 16, about: 'Log kiriman JSON ke SATUSEHAT' },
];

export interface PatientCity {
  name: string;
  /** Banyaknya pasien dari kota ini di tabel pasien. */
  patients: number;
  /** Koordinat untuk penanda bola dunia. */
  lat: number;
  lon: number;
}

/** Kota asal pasien pada data latihan, urut dari yang terbanyak. */
export const PATIENT_CITIES: readonly PatientCity[] = [
  { name: 'Jakarta', patients: 6, lat: -6.2088, lon: 106.8456 },
  { name: 'Bandung', patients: 3, lat: -6.9175, lon: 107.6191 },
  { name: 'Bogor', patients: 3, lat: -6.5971, lon: 106.806 },
  { name: 'Bekasi', patients: 2, lat: -6.2383, lon: 106.9756 },
  { name: 'Depok', patients: 2, lat: -6.4025, lon: 106.7942 },
  { name: 'Surabaya', patients: 2, lat: -7.2575, lon: 112.7521 },
  { name: 'Tangerang', patients: 2, lat: -6.1783, lon: 106.6319 },
];

/** Titik tengah bola dunia (Indonesia). */
export const GLOBE_FOCUS = { lat: -2.5, lon: 113 } as const;

/** Catatan jujur tentang data: dipakai di FAQ dan keterangan mockup. */
export const DATA_NOTE = 'Semua data pasien di database latihan adalah karangan, bukan data sungguhan.';

/* ------------------------------------------------------------------ */
/* 1. Navbar                                                           */
/* ------------------------------------------------------------------ */

export interface NavLinkItem {
  label: string;
  description?: string;
  href: string;
  icon: IconName;
  /** Tautan keluar aplikasi (buka di tab baru). */
  external?: boolean;
}

const NAV_FEATURES: readonly NavLinkItem[] = [
  { label: 'Materi', description: `${ARTICLE_COUNT} artikel ringkas berisi contoh query`, href: ROUTES.articles, icon: 'book' },
  { label: 'Playground', description: 'Bebas mencoba query di database latihan', href: ROUTES.playground, icon: 'terminal' },
  { label: 'Ujian', description: 'Soal acak dari misi yang sudah kamu buka, dengan batas waktu', href: ROUTES.exam, icon: 'clipboard-check' },
  { label: 'Progres', description: 'XP, pangkat, lencana, dan Peta Kelemahan', href: ROUTES.progress, icon: 'chart' },
];

const NAV_ABOUT: readonly NavLinkItem[] = [
  { label: 'Kode sumber di GitHub', description: 'Lihat kodenya atau laporkan masalah', href: GITHUB_URL, icon: 'github', external: true },
  { label: `Lisensi ${LICENSE_NAME}`, description: 'Bebas dipakai, diubah, dan dibagikan', href: LICENSE_URL, icon: 'scale', external: true },
];

const NAV_ABOUT_NOTE: { icon: IconName; text: string } = {
  icon: 'hard-drive',
  text: 'Data belajarmu tersimpan di browser ini dan tidak dikirim ke mana pun.',
};

export const NAV = {
  ariaLabel: 'Navigasi utama',
  homeLabel: 'Ke awal halaman',
  /** Isi menu "Jalur" = TRACKS; jalur 'segera' tampil tanpa tautan dengan chip SOON_LABEL. */
  tracks: { label: 'Jalur' },
  features: { label: 'Fitur', items: NAV_FEATURES },
  about: {
    label: 'Tentang',
    items: NAV_ABOUT,
    /** Baris keterangan (bukan tautan). */
    note: NAV_ABOUT_NOTE,
  },
  cta: { start: 'Mulai belajar', resume: 'Lanjutkan', href: ROUTES.sql },
  theme: { toDark: 'Ganti ke tema gelap', toLight: 'Ganti ke tema terang' },
  /** Tombol jeda untuk semua gerak yang berjalan sendiri (pita berjalan, kata berganti, bola dunia, maskot). */
  motion: { pause: 'Jeda animasi', resume: 'Jalankan animasi lagi' },
  mobile: { open: 'Buka menu', close: 'Tutup menu', title: 'Menu' },
  externalHint: '(buka di tab baru)',
} as const;

/* ------------------------------------------------------------------ */
/* 2. Hero                                                             */
/* ------------------------------------------------------------------ */

const HERO_ASSURANCES: ReadonlyArray<{ icon: IconName; text: string }> = [
  { icon: 'tag', text: 'Gratis' },
  { icon: 'user-x', text: 'Tanpa akun' },
  { icon: 'app-window', text: 'Berjalan di browsermu' },
];

export const HERO = {
  /** H1: "Belajar [kata berganti] gratis". */
  titleBefore: 'Belajar',
  titleAfter: 'gratis',
  /** Topik yang SUDAH ada di kurikulum; berganti tiap `rotateMs`. */
  rotatingWords: ['SQL', 'JOIN', 'GROUP BY', 'window function', 'transaksi', 'index', 'JSON', 'desain tabel'],
  rotateMs: 2200,
  /**
   * Subjudul: "{72} misi, {10} tier, dan {39} materi lewat kasus kerja rumah sakit" — angkanya hitung-naik.
   * Sengaja TIDAK memakai kata yang mengesankan kasus/datanya nyata: semua data latihan karangan (DATA_NOTE).
   */
  subtitle: {
    counts: [
      { value: MISSION_COUNT, label: 'misi' },
      { value: TIER_COUNT, label: 'tier' },
      { value: ARTICLE_COUNT, label: 'materi' },
    ],
    /** Kata sebelum butir terakhir. */
    joiner: 'dan',
    tail: 'lewat kasus kerja rumah sakit',
  },
  cta: { start: 'Mulai belajar', resume: 'Lanjutkan', href: ROUTES.sql },
  restore: { prompt: 'Punya file cadangan?', action: 'Pulihkan' },
  /** Pengganti baris penilaian: tiga fakta singkat. */
  assurances: HERO_ASSURANCES,
  /** Badge bertitik hijau di dekat bola dunia. */
  badge: {
    /** Pengguna baru: fakta dari data latihan. */
    fresh: `Data latihan: ${PATIENT_COUNT} pasien dari ${CITY_COUNT} kota`,
    /** Pengguna lama. Streak yang sudah putus (0 hari) tidak disebut. */
    returning: (completed: number, streakDays: number): string =>
      streakDays > 0 ? `${completed} misi selesai · streak ${streakDays} hari` : `${completed} misi selesai`,
  },
  globeLabel: `Bola dunia berpusat di Indonesia dengan penanda di ${CITY_COUNT} kota asal pasien pada data latihan`,
  mascotLabel: `${MASCOT_NAME}, maskot kapsul yang mengintip dari atas bola dunia`,
  /** Baris di atas tombol "Lanjutkan": jalur dan misi yang akan dibuka. */
  resumeLine: (trackTitle: string, order: number, title: string): string => `${trackTitle} · Misi ${order} — ${title}`,
  /** Pengganti baris itu bila tidak ada lagi misi yang tersisa. */
  allDone: (total: number): string => `Semua ${total} misi sudah tuntas`,
  /** Dibacakan pembaca layar selama ringkasan progres dimuat. */
  loading: 'Memuat ringkasan belajar…',
  /**
   * Dua kartu pendamping bola dunia (layar lebar): sebuah query dan hasilnya. Hasil query ini harus = PATIENT_CITIES
   * dengan urutan yang sama (terbanyak dulu, lalu abjad) — diperiksa verifikasi terhadap database latihan.
   */
  cityQuery: {
    fileName: 'kota-asal.sql',
    sql: 'SELECT kota,\n       COUNT(*) AS jumlah\nFROM pasien\nGROUP BY kota\nORDER BY jumlah DESC, kota;',
    codeLabel: 'Contoh query: jumlah pasien per kota',
    resultLabel: 'Hasil query: jumlah pasien per kota pada data latihan',
    columns: ['kota', 'jumlah'],
  },
} as const;

/* ------------------------------------------------------------------ */
/* 2b. Pemberitahuan Beranda & "Hari ini" (pengguna lama)               */
/* ------------------------------------------------------------------ */

/** Pemberitahuan di bawah navbar (sections/Notices.tsx) dan alur memulihkan cadangan (sections/RestorePanel.tsx). */
export const HOME = {
  noticesLabel: 'Pemberitahuan',
  notice: { close: 'Tutup pemberitahuan' },
  /** Catatan sekali tampil untuk pengguna yang sudah punya progres sebelum Beranda ada. */
  intro: {
    lead: 'Sekarang ada Beranda.',
    body: (trackTitle: string): string => `Progres ${trackTitle}-mu utuh. Tekan Lanjutkan untuk kembali ke misi terakhir.`,
    close: 'Tutup catatan',
  },
  glanceError: {
    title: 'Ringkasan belajar tidak bisa dimuat',
    body: 'Progresmu tidak terpengaruh. Coba muat ulang halaman, atau langsung buka jalurnya.',
    reload: 'Muat ulang',
  },
  /** Bagian bawah halaman (dimuat terpisah) gagal diunduh. */
  belowError: {
    text: 'Sebagian halaman ini gagal dimuat. Tombol di atas tetap berfungsi.',
    retry: 'Coba muat lagi',
  },
  quarantine: {
    title: 'Sebagian data progres tersimpan tidak bisa dibaca',
    body: (when: string): string =>
      `Terdeteksi pada ${when}. Salinan aslinya sudah diamankan di browser ini dan tidak dihapus, tetapi bagian itu sekarang mulai dari kosong. Sebaiknya pulihkan dari file cadangan bila punya.`,
    restore: 'Pulihkan dari file cadangan',
    dismiss: 'Mengerti, tutup',
  },
  restore: {
    inputLabel: 'Pilih file cadangan progres',
    reading: 'Membaca file cadangan…',
    errorTitle: 'File tidak dipulihkan',
    /** Disambung setelah pesan penolakan. */
    errorTail: 'Tidak ada data yang diubah.',
    pickAnother: 'Pilih file lain',
    close: 'Tutup',
    confirmTitle: (exportedAt: string): string => `Pulihkan cadangan dari ${exportedAt}?`,
    incomingLabel: 'Isi file',
    currentLabel: 'Di browser ini sekarang',
    currentEmpty: 'Belum ada progres, jadi tidak ada yang tertimpa.',
    currentReplaced: (summary: string): string => `${summary}. Semuanya akan DIGANTI (tidak digabung) dengan isi file.`,
    reloadNote: 'Setelah dipulihkan, halaman dimuat ulang.',
    apply: 'Ya, pulihkan',
    cancel: 'Batal',
  },
} as const;

/** Kartu "Hari ini" di bawah hero. Angkanya datang dari ringkasan progres pengguna, bukan dari berkas ini. */
export const TODAY = {
  title: 'Hari ini',
  mascotLabel: `${MASCOT_NAME} menunjuk daftar hari ini`,
  /** Ringkasan kemajuan di kepala kartu: pangkat, XP, dan misi selesai. */
  summary: {
    xp: (xp: number): string => `${formatNumber(xp)} XP`,
    missions: (completed: number, total: number): string => `${completed}/${total} misi`,
    progressLabel: (trackTitle: string): string => `Kemajuan jalur ${trackTitle}`,
  },
  exam: {
    running: { exam: 'Ujian sedang berjalan', review: 'Latihan ulang sedang berjalan' },
    waiting: { exam: 'Ujian menunggu dikumpulkan', review: 'Latihan ulang menunggu dikumpulkan' },
    answered: (answered: number, total: number): string => `${answered}/${total} dijawab`,
    noLimit: 'Tanpa batas waktu',
    remaining: 'Sisa waktu',
    expired: 'Waktu habis — buka untuk mengumpulkan dan melihat nilai',
    back: { exam: 'Kembali ke ujian', review: 'Kembali ke latihan' },
  },
  review: {
    title: (count: number): string => `${count} misi jatuh tempo`,
    detail: 'Latihan ulang singkat supaya yang sudah dipelajari tidak menguap.',
    blocked: 'Latihan ulang bisa dimulai setelah sesi yang sedang berjalan selesai.',
    /** Menuju halaman Ujian, tempat kartu latihan ulang berada (sesinya dimulai dari sana). */
    cta: 'Buka latihan ulang',
  },
  weakness: {
    /**
     * `count` = jumlah kesalahan jenis itu SEPANJANG riwayat (bukan minggu ini), dan jenisnya dipilih Peta Kelemahan
     * menurut skor berbobot kebaruan — jadi kalimatnya tidak boleh menyebut "minggu ini" atau "paling sering".
     */
    title: (label: string, count: number): string => `Paling perlu diulang: ${label} (${count}× salah)`,
    detail: 'Peta Kelemahan menunjukkan misi dan materi untuk memperbaikinya.',
    cta: 'Lihat Peta Kelemahan',
  },
  streak: {
    title: (days: number): string => `Streak ${days} hari`,
    doneToday: 'Sudah aktif hari ini',
    notYet: 'Belum aktif hari ini',
    doneDetail: (best: number): string => `Sampai jumpa besok. Rekor terbaikmu ${best} hari.`,
    notYetDetail: 'Selesaikan satu misi atau satu sesi latihan hari ini supaya streak tidak putus.',
  },
  empty: 'Tidak ada yang mendesak hari ini. Lanjutkan misi kapan pun kamu siap.',
} as const;

/* ------------------------------------------------------------------ */
/* 3. Marquee                                                          */
/* ------------------------------------------------------------------ */

export interface MarqueeItem {
  label: string;
  icon: IconName;
  status: LandingTrackStatus;
}

const MARQUEE_ITEMS: readonly MarqueeItem[] = [
  { label: 'SELECT', icon: 'table', status: 'tersedia' },
  { label: 'JOIN', icon: 'git-merge', status: 'tersedia' },
  { label: 'GROUP BY', icon: 'sigma', status: 'tersedia' },
  { label: 'Subquery', icon: 'square-stack', status: 'tersedia' },
  { label: 'CTE', icon: 'workflow', status: 'tersedia' },
  { label: 'Window function', icon: 'rows', status: 'tersedia' },
  { label: 'Transaksi', icon: 'arrow-left-right', status: 'tersedia' },
  { label: 'Index', icon: 'gauge', status: 'tersedia' },
  { label: 'SQL injection', icon: 'shield-alert', status: 'tersedia' },
  { label: 'Desain tabel', icon: 'pencil-ruler', status: 'tersedia' },
  { label: 'Fungsi tanggal', icon: 'calendar', status: 'tersedia' },
  { label: 'JSON', icon: 'file-json', status: 'tersedia' },
  { label: 'JavaScript', icon: 'si-javascript', status: 'segera' },
  { label: 'TypeScript', icon: 'si-typescript', status: 'segera' },
  { label: 'REST API', icon: 'globe', status: 'segera' },
  { label: 'React', icon: 'si-react', status: 'segera' },
  { label: 'NestJS', icon: 'si-nestjs', status: 'segera' },
  { label: 'Next.js', icon: 'si-nextdotjs', status: 'segera' },
  { label: 'Laravel', icon: 'si-laravel', status: 'segera' },
];

export const MARQUEE = {
  ariaLabel: 'Topik yang sudah tersedia dan teknologi jalur berikutnya',
  /** Nama tiap baris pita untuk pembaca layar. */
  rows: { available: 'Topik SQL yang sudah tersedia', soon: 'Teknologi jalur berikutnya (segera)' },
  items: MARQUEE_ITEMS,
} as const;

/* ------------------------------------------------------------------ */
/* 4. Jalur & peta tier                                                */
/* ------------------------------------------------------------------ */

export interface RoadmapTier {
  tier: number;
  /** Nama tier — sama dengan data kurikulum. */
  name: string;
  /** Jumlah misi di tier ini (termasuk Boss). */
  missions: number;
  /** Contoh topik, untuk satu baris keterangan. */
  topics: string;
  /** Judul Boss tier ini — sama dengan data kurikulum, tanpa awalan "Boss:". */
  boss: string;
}

const ROADMAP_TIERS: readonly RoadmapTier[] = [
  { tier: 1, name: 'Dasar Query', missions: 8, topics: 'SELECT, WHERE, LIKE, ORDER BY, DISTINCT', boss: 'Undangan Skrining Hipertensi' },
  { tier: 2, name: 'Relasi & Agregasi', missions: 8, topics: 'JOIN, COUNT, SUM, GROUP BY, HAVING', boss: 'Pasien BPJS yang Jarang Kontrol' },
  { tier: 3, name: 'Kasus Nyata SIMRS', missions: 9, topics: 'Rekap BPJS, CASE WHEN, subquery', boss: 'Rapor Beban Kerja Dokter' },
  { tier: 4, name: 'CTE, JOIN Lanjutan & Rekursif', missions: 8, topics: 'WITH, FULL OUTER JOIN, WITH RECURSIVE', boss: 'Matriks Kepadatan Gedung' },
  { tier: 5, name: 'Window Functions', missions: 6, topics: 'ROW_NUMBER, RANK, LAG, total kumulatif', boss: 'Dua Tagihan Teratas per Poli' },
  { tier: 6, name: 'DML & Transaksi', missions: 6, topics: 'INSERT, UPDATE, DELETE, COMMIT, ROLLBACK', boss: 'Tutup Shift Malam' },
  { tier: 7, name: 'Optimasi & Keamanan', missions: 6, topics: 'Index, query sargable, SQL injection', boss: 'Registri Penyakit Jantung Koroner' },
  { tier: 8, name: 'Konsep Prosedural & Skala Besar', missions: 4, topics: 'SQL dinamis, cursor, partisi tabel', boss: 'Pensiunkan Cursor Lama' },
  { tier: 9, name: 'Desain Tabel & DDL', missions: 8, topics: 'CREATE TABLE, constraint, VIEW, TRIGGER', boss: 'Modul Rawat Inap' },
  { tier: 10, name: 'Fungsi Tanggal, Teks & JSON', missions: 9, topics: 'strftime, group_concat, JSON SATUSEHAT', boss: 'Dashboard Pasien Diabetes' },
];

export const PATHS = {
  title: 'Belajar untuk pekerjaan, bukan sekadar bahasa',
  lead: 'Setiap misi adalah permintaan dari unit rumah sakit: pendaftaran, rekam medis, keuangan, sampai casemix. Kamu belajar sambil menyelesaikan pekerjaan yang memang ada.',
  tabsLabel: 'Jalur belajar',
  roadmap: {
    caption: `Peta jalur SQL: ${TIER_COUNT} tier, masing-masing ditutup satu Boss`,
    /** Aturan buka-kunci Boss (src/lib/progress.ts), supaya Boss di peta tidak terbaca sebagai gerbang. */
    bossNote: 'Boss terbuka setelah misi lain di tier-nya selesai, dan tidak mengunci tier berikutnya.',
    /** Untuk pembaca layar: tier yang sudah dilewati pengguna. */
    doneLabel: 'selesai',
    tierLabel: (tier: number): string => `Tier ${tier}`,
    missionsLabel: (count: number): string => `${count} misi`,
    bossLabel: 'Boss',
    finalBossLabel: 'Final Boss',
    tiers: ROADMAP_TIERS,
    /** Tanda kemajuan pengguna lama di atas peta (angkanya dari ringkasan progres). */
    here: 'Kamu di sini',
    progress: (completed: number, total: number): string => `${completed} dari ${total} misi selesai`,
    allDone: 'Semua tier tuntas',
  },
  /** Panel untuk jalur yang belum tersedia. */
  soon: {
    title: (trackTitle: string): string => `Jalur ${trackTitle} sedang disiapkan`,
    body: 'Belum ada tanggal rilisnya. Sementara itu, jalur SQL sudah lengkap dan bisa langsung dikerjakan.',
    cta: 'Buka jalur SQL',
    href: ROUTES.sql,
  },
} as const;

/* ------------------------------------------------------------------ */
/* 5. Strip "Jelajahi misi"                                            */
/* ------------------------------------------------------------------ */

export const EXPLORE = {
  title: `Jelajahi ${MISSION_COUNT} misi`,
  lead: 'Dari SELECT pertama sampai Final Boss.',
  cta: 'Buka jalur SQL',
  href: ROUTES.sql,
  /** Keterangan peta mini: kotak = misi, belah ketupat = Boss (PATHS.roadmap.bossLabel). */
  legendMission: 'Misi',
} as const;

/* ------------------------------------------------------------------ */
/* 6. Belajar sambil praktik                                           */
/* ------------------------------------------------------------------ */

export interface ResultTable {
  columns: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string | number>>;
}

/** Nama TAB pembanding saat jawaban salah — sama dengan TABS di src/components/MissionOutput.tsx. */
export const OUTPUT_TABS = { diff: 'Perbedaan', yours: 'Hasil Kamu', expected: 'Seharusnya' } as const;
/** JUDUL tabel hasil di aplikasi (bukan nama tab): tabel jawabanmu dan tabel pembandingnya. */
export const OUTPUT_CAPTIONS = { yours: 'Hasil Kamu', expected: 'Expected Output' } as const;

export interface PredictOption {
  /** Jawaban yang benar. */
  correct: boolean;
  /** Kenapa benar / salah paham apa yang diwakilinya. */
  why: string;
  table: ResultTable;
}

const PREDICT_OPTIONS: readonly PredictOption[] = [
  {
    correct: false,
    why: 'Mengira DISTINCT hanya melihat kolom pertama.',
    table: { columns: ['kota'], rows: [['Bandung'], ['Bogor']] },
  },
  {
    correct: true,
    why: 'DISTINCT membuang baris yang seluruh kolomnya kembar, jadi tersisa 4 pasangan kota dan penjamin.',
    table: {
      columns: ['kota', 'penjamin'],
      rows: [
        ['Bandung', 'Asuransi'],
        ['Bandung', 'BPJS'],
        ['Bogor', 'BPJS'],
        ['Bogor', 'Umum'],
      ],
    },
  },
  {
    correct: false,
    why: 'Mengira DISTINCT tidak berpengaruh, sehingga baris kembar tetap tampil.',
    table: {
      columns: ['kota', 'penjamin'],
      rows: [
        ['Bandung', 'Asuransi'],
        ['Bandung', 'BPJS'],
        ['Bandung', 'BPJS'],
        ['Bogor', 'BPJS'],
        ['Bogor', 'BPJS'],
        ['Bogor', 'Umum'],
      ],
    },
  },
];

const QUERY_RESULT: ResultTable = {
  columns: ['no_rm', 'nama', 'kota'],
  rows: [
    ['RM-0001', 'Ahmad Fauzi', 'Bogor'],
    ['RM-0009', 'Muhammad Alif', 'Bogor'],
    ['RM-0011', 'Sutarno', 'Jakarta'],
    ['RM-0012', 'Sri Rahayu', 'Jakarta'],
    ['RM-0019', 'Fajar Nugroho', 'Jakarta'],
    ['RM-0020', 'Wulan Sari', 'Jakarta'],
  ],
};

/**
 * Cuplikan isi tabel untuk kartu soal di tab latihan: beberapa kolom + baris-baris PERTAMA tabelnya, persis seperti
 * `SELECT kolom… FROM tabel LIMIT n` di database latihan (diperiksa verifikasi). Kunci = nama tabel.
 */
export const TABLE_PREVIEWS: Readonly<Record<string, ResultTable>> = {
  pasien: {
    columns: ['no_rm', 'nama', 'kota', 'penjamin'],
    rows: [
      ['RM-0001', 'Ahmad Fauzi', 'Bogor', 'BPJS'],
      ['RM-0002', 'Siti Nurhaliza', 'Bandung', 'BPJS'],
      ['RM-0003', 'Bambang Sutrisno', 'Jakarta', 'Umum'],
      ['RM-0004', 'Dewi Lestari', 'Jakarta', 'Asuransi'],
    ],
  },
  billing: {
    columns: ['no_rawat', 'total_biaya', 'status_bayar'],
    rows: [
      ['2026/10/01/000001', 450_000, 'Lunas'],
      ['2026/10/01/000002', 350_000, 'Lunas'],
      ['2026/10/02/000001', 150_000, 'Lunas'],
      ['2026/10/03/000001', 12_500_000, 'Belum Lunas'],
    ],
  },
};

const FIX_RESULT: ResultTable = {
  columns: ['no_rawat', 'total_biaya'],
  rows: [
    ['2026/10/08/000001', 18_750_000],
    ['2026/10/03/000001', 12_500_000],
    ['2026/11/06/000001', 5_000_000],
  ],
};

const PLAYGROUND_RESULT: ResultTable = {
  columns: ['kota', 'jumlah_pasien'],
  rows: [
    ['Jakarta', 6],
    ['Bandung', 3],
    ['Bogor', 3],
    ['Bekasi', 2],
    ['Depok', 2],
    ['Surabaya', 2],
    ['Tangerang', 2],
  ],
};

/**
 * Contoh di tiap tab diambil dari misi SUNGGUHAN (missionId) — query, tabel hasil, dan pesannya diperiksa verifikasi
 * terhadap kurikulum dan database latihan.
 */
const PRACTICE_BUTTONS = { hint: 'Hint', run: 'Run & Check', runPlayground: 'Run', replay: 'Putar ulang' } as const;

export const PRACTICE = {
  title: 'Belajar sambil praktik.',
  lead: 'Tulis query, jalankan, dan lihat hasilnya dinilai saat itu juga. Tidak ada video panjang yang harus ditonton dulu.',
  tabsLabel: 'Jenis latihan',
  buttons: PRACTICE_BUTTONS,
  /** Keterangan di bawah mockup: ini peragaan, bukan editor sungguhan. */
  sampleNote: 'Contoh tampilan. Di aplikasi, query-mu benar-benar dijalankan di browser dan dinilai dari hasilnya.',
  /** Teks kecil di dalam mockup (keadaan menunggu, label tombol, label untuk pembaca layar). */
  ui: {
    running: 'Menjalankan query…',
    idleCheck: `Tekan ${PRACTICE_BUTTONS.run} untuk melihat penilaiannya.`,
    /** Judul pratinjau tabel di kartu soal. */
    tablePreview: 'Cuplikan tabel',
    tablePreviewMore: (shown: number, total: number): string => `${shown} dari ${total} baris`,
    /** Untuk pembaca layar di sekitar XP yang dicoret setelah hint dibuka. */
    xpBefore: 'Sebelumnya',
    xpNow: 'sekarang',
    idleRun: `Tekan ${PRACTICE_BUTTONS.runPlayground} untuk melihat hasilnya.`,
    compareLabel: 'Tampilan perbandingan hasil',
    diffSummaryLabel: 'Ringkasan perbedaan',
    statusColumnLabel: 'Status',
    /** Nama tab berkas kedua di tab Perbaiki Query (nama buatan untuk peragaan). */
    fixFile: 'perbaikan.sql',
    showFix: 'Lihat perbaikan',
    missingRows: (count: number): string => `${count} baris kurang`,
    missingLabel: 'kurang',
    bugCount: (count: number): string => `${count} bug di query ini`,
    bugLine: (line: number): string => `Baris ${line}`,
    hintCost: `Hint dibuka: XP misi ini berkurang ${HINT_PENALTY_PERCENT}%.`,
    pickPrompt: 'Pilih salah satu tabel di atas.',
    send: 'Kirim',
    sending: 'Mengirim…',
    idleSend: 'Tekan Kirim untuk melihat apa yang ditampilkan portal.',
    modeLabel: 'Cara server menyusun query',
  },
  verdict: {
    /** Judul & keterangan kartu sukses — sama dengan aplikasi (src/components/MissionOutput.tsx). */
    correct: 'Jawaban benar!',
    correctDetail: 'Hasil cocok dengan Expected Output.',
    xp: (xp: number): string => `+${xp} XP`,
  },
  rowCount: (count: number): string => `${count} baris`,
  tabs: {
    query: {
      label: 'Query',
      icon: 'database' as IconName,
      missionId: 't1-where',
      tierLabel: 'Tier 1 · Misi 2',
      missionTitle: 'Pasien BPJS Jabodetabek',
      task: "Tampilkan no_rm, nama, dan kota untuk pasien berpenjamin 'BPJS' yang kotanya 'Jakarta' atau 'Bogor'.",
      fileName: 'misi-02.sql',
      /** Sama dengan solusi misi. */
      code: `SELECT
  no_rm,
  nama,
  kota
FROM pasien
WHERE penjamin = 'BPJS'
  AND (kota = 'Jakarta' OR kota = 'Bogor');`,
      xp: 50,
      result: QUERY_RESULT,
      /** Hint PERTAMA misi ini (teks asli dari kurikulum). */
      hint: 'Saring baris dengan WHERE. Kamu butuh dua syarat sekaligus: penjamin dan kota.',
      hintLabel: 'Hint 1 dari 3',
    },
    fix: {
      label: 'Perbaiki Query',
      icon: 'bug' as IconName,
      missionId: 't1-fix-tagihan',
      tierLabel: 'Tier 1 · Misi 7',
      missionTitle: 'Laporan Tunggakan yang Kosong',
      task: 'Query rekanmu seharusnya menampilkan tiga tagihan belum lunas terbesar, tetapi hasilnya kosong. Ada 2 bug.',
      bugCount: 2,
      fileName: 'misi-07.sql',
      /** Query bermasalah, persis seperti yang tampil di editor misi. */
      buggyCode: `-- Query dari rekan: 3 tunggakan terbesar (hasilnya keliru)
SELECT
  no_rawat,
  total_biaya
FROM billing
WHERE status_bayar = 'Belum lunas'
ORDER BY total_biaya
LIMIT 3;`,
      buggyNote: 'Hasil kosong: 0 baris.',
      /** Sama dengan solusi misi. */
      fixedCode: `SELECT
  no_rawat,
  total_biaya
FROM billing
WHERE status_bayar = 'Belum Lunas'
ORDER BY total_biaya DESC
LIMIT 3;`,
      /** Baris (mulai dari 1) pada buggyCode yang mengandung bug, dan penjelasannya. */
      bugs: [
        { line: 6, text: "Teks dibandingkan persis: 'Belum lunas' tidak sama dengan 'Belum Lunas'." },
        { line: 7, text: 'Tanpa DESC, urutannya dari yang terkecil.' },
      ],
      xp: 50,
      result: FIX_RESULT,
    },
    predict: {
      label: 'Tebak Hasil',
      icon: 'eye' as IconName,
      missionId: 't1-predict-distinct',
      tierLabel: 'Tier 1 · Misi 6',
      missionTitle: 'Tebak: DISTINCT Dua Kolom',
      task: 'Baca query ini tanpa menjalankannya, lalu pilih tabel yang benar-benar dihasilkannya.',
      fileName: 'misi-06.sql',
      /** Sama dengan query misi. */
      code: `SELECT DISTINCT
  kota,
  penjamin
FROM pasien
WHERE kota IN ('Bogor', 'Bandung')
ORDER BY kota, penjamin;`,
      optionLabel: (letter: string): string => `Pilihan ${letter}`,
      /** Tiga tabel pilihan. Dua yang salah adalah hasil salah paham yang umum (dari misinya). */
      options: PREDICT_OPTIONS,
      xp: 50,
    },
    injection: {
      label: 'Lab Injection',
      icon: 'shield-alert' as IconName,
      missionId: 't7-injection-bypass',
      tierLabel: 'Tier 7 · Misi 48',
      missionTitle: 'Portal Cek Pasien yang Bocor',
      task: 'Kamu penguji keamanan internal. Ketik input form yang membuat portal ini menampilkan semua pasien, lalu coba lagi di mode aman.',
      formTitle: 'Cek Data Pasien (Loket Pendaftaran)',
      inputLabel: 'Nomor Rekam Medis',
      /** Contoh input yang berhasil (dari misinya). */
      payload: "' OR '1'='1",
      fileName: 'query-server.sql',
      /** SQL yang terbentuk di server setelah input disambung mentah-mentah ke template rentan. */
      builtSql: "SELECT no_rm, nama, kota FROM pasien WHERE no_rm = '' OR '1'='1'",
      vulnerable: { label: 'Mode rentan', outcome: `Bocor: ${PATIENT_COUNT} pasien tampil, padahal seharusnya satu.`, rows: PATIENT_COUNT },
      /** Template aman dari misinya. */
      safeSql: 'SELECT no_rm, nama, kota FROM pasien WHERE no_rm = ?',
      safe: { label: 'Mode aman (prepared statement)', outcome: 'Aman: 0 baris. Input diperlakukan sebagai data, bukan kode SQL.', rows: 0 },
      xp: 225,
    },
    playground: {
      label: 'Playground',
      icon: 'terminal' as IconName,
      title: 'Free Playground',
      task: 'Tanpa soal dan tanpa penilaian. Coba query apa pun di database latihan.',
      fileName: 'playground.sql',
      code: `SELECT
  kota,
  COUNT(*) AS jumlah_pasien
FROM pasien
GROUP BY kota
ORDER BY jumlah_pasien DESC, kota;`,
      result: PLAYGROUND_RESULT,
      /** Alat lain yang ada di Playground. */
      tools: [
        { label: 'Urutan Eksekusi', text: 'Lihat tabel antara di tiap langkah, dari FROM sampai LIMIT.' },
        { label: 'Explain', text: 'Baca rencana eksekusi: SCAN atau SEARCH.' },
        { label: 'Lab Performa', text: `Ukur waktu query di ${formatNumber(PERF_LAB_VISITS)} kunjungan sintetis.` },
      ],
    },
  },
} as const;

export type PracticeTabId = keyof typeof PRACTICE.tabs;

/* ------------------------------------------------------------------ */
/* 7. Contoh keluaran                                                  */
/* ------------------------------------------------------------------ */

export interface OutcomeSlide {
  id: string;
  /** Teks pill topik. */
  topic: string;
  title: string;
  /** Query yang menghasilkan diagram batang; verifikasi menjalankannya (baris = [label, nilai]). */
  sql: string;
  /** Cincin progres: `part` dari `whole`. */
  ring: { label: string; part: number; whole: number };
  stats: readonly [{ label: string; value: string }, { label: string; value: string }];
  bars: { label: string; unit: string; items: ReadonlyArray<{ label: string; value: number }> };
}

const OUTCOME_SLIDES: readonly OutcomeSlide[] = [
  {
    id: 'kunjungan',
    topic: 'COUNT + GROUP BY',
    title: 'Kunjungan per poli',
    sql: `SELECT pl.nama_poli, COUNT(*) AS jumlah
FROM kunjungan k
JOIN poliklinik pl ON k.id_poli = pl.id_poli
GROUP BY pl.nama_poli
ORDER BY jumlah DESC, pl.nama_poli;`,
    ring: { label: 'Kunjungan selesai', part: 25, whole: 32 },
    stats: [
      { label: 'Total kunjungan', value: '32' },
      { label: 'Poliklinik', value: '7' },
    ],
    bars: {
      label: 'Kunjungan per poli',
      unit: 'kunjungan',
      items: [
        { label: 'Poli Jantung', value: 7 },
        { label: 'Poli Umum', value: 7 },
        { label: 'Poli Penyakit Dalam', value: 6 },
        { label: 'Poli Anak', value: 4 },
        { label: 'Poli Saraf', value: 4 },
        { label: 'Poli Kandungan', value: 3 },
        { label: 'Poli Gigi', value: 1 },
      ],
    },
  },
  {
    id: 'bpjs',
    topic: 'JOIN tiga tabel',
    title: 'Kunjungan pasien BPJS per poli',
    sql: `SELECT pl.nama_poli, COUNT(*) AS jumlah_kunjungan
FROM kunjungan k
INNER JOIN pasien p ON k.no_rm = p.no_rm
INNER JOIN poliklinik pl ON k.id_poli = pl.id_poli
WHERE p.penjamin = 'BPJS'
  AND k.status <> 'Batal'
GROUP BY pl.id_poli, pl.nama_poli
ORDER BY jumlah_kunjungan DESC, pl.nama_poli ASC;`,
    ring: { label: 'Pasien berpenjamin BPJS', part: 12, whole: 20 },
    stats: [
      { label: 'Pasien BPJS', value: '12' },
      { label: 'Kunjungan BPJS (tidak batal)', value: '20' },
    ],
    bars: {
      label: 'Kunjungan BPJS per poli',
      unit: 'kunjungan',
      items: [
        { label: 'Poli Penyakit Dalam', value: 6 },
        { label: 'Poli Anak', value: 3 },
        { label: 'Poli Jantung', value: 3 },
        { label: 'Poli Kandungan', value: 3 },
        { label: 'Poli Saraf', value: 2 },
        { label: 'Poli Umum', value: 2 },
        { label: 'Poli Gigi', value: 1 },
      ],
    },
  },
  {
    id: 'tagihan',
    topic: 'SUM + JOIN',
    title: 'Tagihan lunas per poli',
    // Hanya tagihan LUNAS: tiga tunggakan besar di Poli Jantung & Saraf membuat diagram "semua tagihan" tak terbaca.
    sql: `SELECT pl.nama_poli, SUM(b.total_biaya) / 1000 AS ribu_rupiah
FROM billing b
JOIN kunjungan k ON b.no_rawat = k.no_rawat
JOIN poliklinik pl ON k.id_poli = pl.id_poli
WHERE b.status_bayar = 'Lunas'
GROUP BY pl.nama_poli
ORDER BY ribu_rupiah DESC, pl.nama_poli;`,
    ring: { label: 'Tagihan lunas', part: 23, whole: 28 },
    stats: [
      { label: 'Sudah lunas', value: 'Rp 17.020.000' },
      { label: 'Belum lunas', value: 'Rp 36.975.000' },
    ],
    bars: {
      label: 'Tagihan lunas per poli',
      unit: 'ribu rupiah',
      items: [
        { label: 'Poli Jantung', value: 9_775 },
        { label: 'Poli Penyakit Dalam', value: 3_120 },
        { label: 'Poli Kandungan', value: 1_140 },
        { label: 'Poli Anak', value: 875 },
        { label: 'Poli Gigi', value: 850 },
        { label: 'Poli Saraf', value: 650 },
        { label: 'Poli Umum', value: 610 },
      ],
    },
  },
];

export const OUTCOMES = {
  title: 'Lihat apa yang nanti bisa kamu lakukan.',
  lead: 'Beberapa baris SQL sudah cukup untuk menjawab pertanyaan yang tiap hari muncul di rumah sakit.',
  /** Keterangan wajib di dekat mockup: ini contoh, bukan fitur dasbor. */
  note: 'Contoh tampilan. Angkanya hasil query di database latihan; di aplikasi, hasil query tampil sebagai tabel.',
  /** Chip kecil di pojok mockup. */
  sampleChip: 'Contoh',
  carouselLabel: 'Contoh keluaran query',
  prev: 'Contoh sebelumnya',
  next: 'Contoh berikutnya',
  queryLabel: 'Query di baliknya',
  ringOf: (part: number, whole: number): string => `${part} dari ${whole}`,
  slides: OUTCOME_SLIDES,
} as const;

/* ------------------------------------------------------------------ */
/* 8. Naik pangkat                                                     */
/* ------------------------------------------------------------------ */

export interface LandingRank {
  title: string;
  /** XP minimum untuk pangkat ini. */
  minXp: number;
  /** Emoji pangkat, sama dengan di aplikasi. */
  icon: string;
}

/** Tangga pangkat — sama dengan src/lib/ranks.ts. */
export const RANK_LADDER: readonly LandingRank[] = [
  { title: 'IT Intern', minXp: 0, icon: '🩺' },
  { title: 'Junior Programmer RS', minXp: 300, icon: '💻' },
  { title: 'SIMRS Engineer', minXp: 1100, icon: '🏥' },
  { title: 'Senior Healthcare Dev', minXp: 2600, icon: '🏆' },
  { title: 'Database Specialist RS', minXp: 5000, icon: '🗄️' },
  { title: 'Health Informatics Architect', minXp: 8000, icon: '🧠' },
  { title: 'Kepala Instalasi SIMRS', minXp: 10_200, icon: '👑' },
  { title: 'Direktur Transformasi Digital RS', minXp: 12_500, icon: '🛰️' },
];

export const RANKS = {
  title: 'Naik pangkat',
  lead: `Setiap misi memberi XP. Kumpulkan XP untuk naik melewati ${RANK_COUNT} pangkat, dari IT Intern sampai Direktur Transformasi Digital RS.`,
  /** Indeks RANK_LADDER untuk tiga kartu bertumpuk (awal, tengah, puncak). */
  featured: [0, 4, 7],
  cardLabel: 'Pangkat',
  xpLabel: (minXp: number): string => (minXp === 0 ? 'Pangkat awal' : `Mulai ${formatNumber(minXp)} XP`),
  total: `Total XP yang bisa dikumpulkan: ${formatNumber(TOTAL_XP)}`,
  link: { label: 'Lihat progresmu', href: ROUTES.progress },
} as const;

/* ------------------------------------------------------------------ */
/* 9. Setiap pelajaran berarti                                         */
/* ------------------------------------------------------------------ */

/**
 * Contoh kalender 28 hari untuk panel Streak (true = hari aktif; butir terakhir = hari ini). MURNI ILUSTRASI: aplikasi
 * tidak menyimpan riwayat per hari — yang ada hanya angka streak, rekor terbaik, dan tanggal aktif terakhir.
 */
const STREAK_SAMPLE: readonly boolean[] = [
  true, true, false, true, true, true, false,
  true, true, true, true, false, true, true,
  true, true, false, true, true, true, true,
  true, true, true, true, true, true, true,
];

export const FEATURES = {
  title: 'Setiap pelajaran berarti.',
  lead: 'Yang kamu kerjakan hari ini tercatat, diulang pada waktu yang tepat, dan terlihat kemajuannya.',
  tabsLabel: 'Fitur pencatat kemajuan',
  /** Keterangan untuk angka di dalam mockup panel. */
  sampleNote: 'Angka di dalam contoh ini hanya ilustrasi.',
  /** Untuk pengguna lama, panel Streak & Rank memakai angka mereka sendiri. */
  bestStreak: (days: number): string => `Rekor terbaikmu: ${days} hari`,
  xpUnit: 'XP',
  tabs: {
    streak: {
      label: 'Streak',
      icon: 'flame' as IconName,
      title: 'Streak harian',
      body: 'Selesaikan misi, ujian, atau latihan ulang untuk menandai hari ini aktif. Hari aktif berturut-turut menjadi streak, dan rekor terbaikmu ikut dicatat.',
      calendar: {
        caption: 'Ilustrasi 28 hari',
        /** WAJIB tampil di panel: kalender ini tidak ada di aplikasi. */
        note: 'Kalender ini hanya ilustrasi. Di aplikasi, streak tampil sebagai angka hari berturut-turut dan rekor terbaikmu; riwayat per hari tidak disimpan.',
        weekdays: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
        days: STREAK_SAMPLE,
        /** Streak yang sedang berjalan pada contoh (hari aktif berturut-turut terakhir). */
        sampleStreak: 11,
        streakLabel: (days: number): string => `${days} hari berturut-turut`,
        activeLabel: 'Aktif',
        idleLabel: 'Tidak aktif',
        /** Untuk angka pengguna sendiri: hari di luar streak yang berjalan memang tidak diketahui. */
        unknownLabel: 'Tidak tercatat',
      },
    },
    rank: {
      label: 'Pangkat',
      icon: 'medal' as IconName,
      title: `${RANK_COUNT} pangkat`,
      body: `XP menentukan pangkatmu. Seluruh kurikulum bernilai ${formatNumber(TOTAL_XP)} XP, dan pangkat tertinggi tetap bisa dicapai walau kamu membuka hint di setiap misi.`,
      /** Contoh posisi pada bilah progres pangkat. */
      sample: { xp: 1850, rankIndex: 2 },
      nextLabel: (xp: number, title: string): string => `${formatNumber(xp)} XP lagi menuju ${title}`,
    },
    missions: {
      label: 'Misi & Boss',
      icon: 'swords' as IconName,
      title: `${MISSION_COUNT} misi, ${BOSS_COUNT} Boss`,
      body: `Misi terbuka satu per satu. Tiap tier ditutup satu Boss: soal gabungan tanpa hint, dan solusinya baru bisa dibuka setelah ${BOSS_SOLUTION_AFTER} percobaan. Boss tidak mengunci tier berikutnya.`,
      kinds: [
        { label: 'Query SQL', text: 'Tulis query, hasilnya dinilai otomatis.' },
        { label: 'Perbaiki Query', text: 'Temukan bug di query rekan kerja.' },
        { label: 'Tebak Hasil', text: 'Pilih tabel yang benar tanpa menjalankan query.' },
        { label: 'Lab Injection', text: 'Tembus portal yang rentan, lalu lihat cara menutup celahnya.' },
        { label: 'Kartu konsep', text: 'Materi singkat yang ditutup kuis.' },
        { label: 'Boss', text: 'Soal gabungan di akhir tiap tier.' },
      ],
    },
    badges: {
      label: 'Lencana',
      icon: 'award' as IconName,
      title: `${BADGE_COUNT} lencana`,
      body: 'Lencana diberikan untuk perjalanan, Boss, ketepatan, konsistensi, ujian, dan membaca materi.',
      /** Contoh lencana — judul & emoji sama dengan di aplikasi. */
      samples: [
        { title: 'Hari Pertama', icon: '🩺', text: 'Selesaikan misi pertamamu.' },
        { title: 'Boss Pertama Tumbang', icon: '⚔️', text: 'Kalahkan satu Boss Challenge.' },
        { title: 'Tepat Sasaran', icon: '🎯', text: 'Selesaikan 10 misi pada percobaan pertama tanpa hint & solusi.' },
        { title: 'Seminggu Penuh', icon: '📅', text: 'Aktif 7 hari berturut-turut.' },
        { title: 'Berani Diuji', icon: '📝', text: 'Kumpulkan satu Mode Ujian.' },
        { title: 'Kutu Buku', icon: '📚', text: 'Buka semua artikel materi.' },
      ],
    },
    exam: {
      label: 'Ujian',
      icon: 'timer' as IconName,
      title: 'Mode Ujian',
      body: `Pilih ${orList(EXAM_QUESTION_COUNTS)} soal dengan waktu ${orList(EXAM_MINUTE_OPTIONS)} menit, atau tanpa batas waktu. Soal diambil acak dari misi yang sudah kamu buka. Tidak ada hint selama ujian; semua jawaban dinilai saat dikumpulkan.`,
      countLabel: 'Jumlah soal',
      timeLabel: 'Batas waktu',
      minutes: (value: number): string => `${value} menit`,
      untimed: 'Tanpa batas',
      note: 'Ujian tidak memberi XP. Hasilnya masuk riwayat ujian dan Peta Kelemahan.',
    },
    review: {
      label: 'Latihan ulang',
      icon: 'repeat' as IconName,
      title: 'Latihan ulang terjadwal',
      body: `Soal dari misi yang sudah selesai muncul lagi setelah ${REVIEW_INTERVAL_DAYS.slice(0, -1).join(', ')}, lalu ${REVIEW_INTERVAL_DAYS.at(-1)} hari. Jawab benar, jaraknya makin panjang. Jawab salah, soalnya muncul lagi besok.`,
      boxLabel: (box: number): string => `Kotak ${box}`,
      dayLabel: (days: number): string => `${days} hari`,
    },
    weakness: {
      label: 'Peta Kelemahan',
      icon: 'radar' as IconName,
      title: 'Peta Kelemahan',
      body: 'Setiap jawaban salah dicatat menurut jenisnya, lengkap dengan saran materi untuk dibaca ulang.',
      /** Contoh jenis kesalahan — labelnya sama dengan di aplikasi; angkanya ilustrasi. */
      samples: [
        { label: 'Baris berlebih', count: 5 },
        { label: 'Agregat & GROUP BY', count: 3 },
        { label: 'Pengurutan', count: 2 },
        { label: 'Nilai & perhitungan', count: 1 },
      ],
      countLabel: (count: number): string => `${count} kali`,
    },
  },
} as const;

export type FeatureTabId = keyof typeof FEATURES.tabs;

/* ------------------------------------------------------------------ */
/* 10. Macet?                                                          */
/* ------------------------------------------------------------------ */

const STUCK_DIFF_ROWS: ReadonlyArray<{ status: 'same' | 'extra'; cells: readonly string[] }> = [
  { status: 'same', cells: ['RM-0001', 'Ahmad Fauzi', 'Bogor'] },
  { status: 'same', cells: ['RM-0009', 'Muhammad Alif', 'Bogor'] },
  { status: 'same', cells: ['RM-0011', 'Sutarno', 'Jakarta'] },
  { status: 'same', cells: ['RM-0012', 'Sri Rahayu', 'Jakarta'] },
  { status: 'extra', cells: ['RM-0017', 'Agus Setiawan', 'Bogor'] },
  { status: 'same', cells: ['RM-0019', 'Fajar Nugroho', 'Jakarta'] },
  { status: 'same', cells: ['RM-0020', 'Wulan Sari', 'Jakarta'] },
];

export const STUCK = {
  title: `Macet? ${MASCOT_NAME} menunjukkan di mana harus mencari.`,
  lead: 'Jawaban salah bukan jalan buntu. Aplikasi menunjukkan bagian mana yang berbeda, lalu memberi petunjuk bertahap.',
  points: [
    {
      icon: 'git-compare' as IconName,
      title: 'Tab Perbedaan',
      text: 'Menandai baris yang berlebih, kurang, salah urut, atau nilainya berbeda, sehingga kamu tahu persis apa yang harus diperbaiki.',
    },
    {
      icon: 'lightbulb' as IconName,
      title: 'Hint bertahap',
      text: `Dari arah umum sampai bentuk query. Membuka hint mengurangi ${HINT_PENALTY_PERCENT}% XP misi itu.`,
    },
    {
      icon: 'key' as IconName,
      title: 'Show Solution',
      text: 'Kalau tetap buntu, lihat jawabannya. Misi yang solusinya dibuka tidak memberi XP.',
    },
    {
      icon: 'radar' as IconName,
      title: 'Peta Kelemahan',
      text: 'Kesalahanmu dikelompokkan menurut jenisnya, lengkap dengan saran materi.',
    },
  ],
  /** Mockup: percobaan salah pada misi t1-where (kurung OR terlupa), lalu perbaikannya. Diperiksa verifikasi. */
  example: {
    missionId: 't1-where',
    fileName: 'misi-02.sql',
    wrongCode: `SELECT
  no_rm,
  nama,
  kota
FROM pasien
WHERE penjamin = 'BPJS'
  AND kota = 'Jakarta' OR kota = 'Bogor';`,
    /** Baris (mulai dari 1) yang keliru pada wrongCode. */
    wrongLine: 7,
    wrongMessage: 'Jumlah baris berbeda: diharapkan 6 baris, hasil kamu 7 baris.',
    summary: ['6 baris sama', '1 baris berlebih'],
    diff: {
      columns: ['no_rm', 'nama', 'kota'],
      rows: STUCK_DIFF_ROWS,
      sameLabel: 'sama',
      extraLabel: 'berlebih',
    },
    /** Hint kedua misi ini (teks asli dari kurikulum). */
    hint: "Hati-hati: AND dievaluasi lebih dulu daripada OR. Bungkus syarat kota dengan tanda kurung: (kota = 'Jakarta' OR kota = 'Bogor').",
    hintLabel: 'Hint 2 dari 3',
    mistakeKind: 'Baris berlebih',
    /** Keterangan landing (bukan kutipan layar): disambung dengan mistakeKind. */
    mistakeNote: 'Di aplikasi, jawaban salah ini tercatat di Peta Kelemahan sebagai jenis kesalahan',
    fixedLine: "  AND (kota = 'Jakarta' OR kota = 'Bogor');",
    correctMessage: 'Jawaban benar!',
    correctDetail: 'Hasil cocok dengan Expected Output.',
    wrongLabel: 'Belum tepat',
    correctLabel: 'Benar',
  },
  cta: { label: 'Coba satu misi', href: ROUTES.sql },
  /** Label kecil di mockup (sebagian hanya untuk pembaca layar). */
  ui: {
    stateLabel: 'Keadaan contoh',
    compareLabel: 'Tampilan perbandingan hasil',
    diffSummaryLabel: 'Ringkasan perbedaan',
    sampleNote: 'Contoh tampilan dari misi sungguhan.',
    missingLabel: 'kurang',
  },
} as const;

/* ------------------------------------------------------------------ */
/* 11. Belajar di layar mana pun                                       */
/* ------------------------------------------------------------------ */

const DEVICE_NOTES: ReadonlyArray<{ icon: IconName; text: string }> = [
  { icon: 'zap', text: 'Tanpa instalasi' },
  { icon: 'hard-drive', text: 'Data tersimpan di browsermu' },
  { icon: 'file-down', text: 'Bisa dicadangkan ke file' },
];

export const DEVICES = {
  title: 'Belajar di layar mana pun.',
  lead: 'Tampilannya menyesuaikan dari laptop sampai ponsel. Cukup buka di browser, tidak ada yang perlu dipasang.',
  /** Pengganti lencana toko aplikasi: tiga fakta. */
  notes: DEVICE_NOTES,
  browserUrl: 'SIMRS Quest · jalur SQL',
  browserLabel: 'Contoh tampilan misi di layar lebar',
  phoneLabel: 'Contoh tampilan misi di ponsel',
  /** Label layar jalur yang ditiru mockup. */
  appLabels: { missions: 'Misi', missionMap: 'Peta Misi' },
} as const;

/* ------------------------------------------------------------------ */
/* 12. FAQ                                                             */
/* ------------------------------------------------------------------ */

export interface FaqItem {
  id: string;
  question: string;
  /** Satu paragraf per butir. */
  answer: readonly string[];
}

const UPCOMING_TRACKS = TRACKS.filter((track) => track.status === 'segera')
  .map((track) => track.title)
  .join('; ');

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'gratis',
    question: 'Apakah benar-benar gratis?',
    answer: [
      `Ya. Tidak ada paket berbayar, iklan, atau pendaftaran. Kode sumbernya terbuka dengan lisensi ${LICENSE_NAME}, jadi kamu juga boleh menjalankan salinanmu sendiri.`,
    ],
  },
  {
    id: 'data',
    question: 'Di mana data belajarku disimpan?',
    answer: [
      'Di penyimpanan browser pada perangkat ini. Tidak ada server yang menerima progres atau query-mu.',
      'Karena itu, menghapus data situs di browser ikut menghapus progres. Cadangkan dulu ke file lewat halaman Progres.',
    ],
  },
  {
    id: 'pindah',
    question: 'Bagaimana cara pindah perangkat atau browser?',
    answer: [
      'Buka Progres, lalu pilih "Ekspor ke file" untuk mengunduh cadangan berformat JSON.',
      'Di perangkat baru, pilih "Pulihkan" di Beranda atau "Impor dari file" di halaman Progres. Progres di perangkat itu akan diganti dengan isi cadangan.',
    ],
  },
  {
    id: 'internet',
    question: 'Apakah perlu internet?',
    answer: [
      'Perlu, untuk memuat aplikasinya: halaman ini, lalu mesin SQL saat jalur pertama kali dibuka, dan setiap kali halaman dimuat ulang. Aplikasi ini belum bisa dibuka tanpa koneksi.',
      'Query-mu sendiri dijalankan oleh SQLite di browsermu dan tidak dikirim ke server mana pun. Kalau kamu menjalankan salinan dari kode sumbernya di komputermu, internet tidak diperlukan.',
    ],
  },
  {
    id: 'jalur-lain',
    question: 'Kapan jalur selain SQL tersedia?',
    answer: [
      `Belum ada tanggalnya. Yang sedang disiapkan: ${UPCOMING_TRACKS}. Di halaman ini jalur tersebut ditandai "${SOON_LABEL}".`,
    ],
  },
  {
    id: 'lompat',
    question: 'Aku sudah bisa SQL. Bisa langsung lompat ke tier lanjut?',
    answer: [
      'Belum bisa. Misi terbuka berurutan, jadi tier lanjut baru terbuka setelah misi sebelumnya selesai. Kalau kamu sudah paham, misi awal biasanya selesai dalam beberapa menit.',
      'Yang terbuka sejak awal: semua artikel materi, kartu konsep, dan Free Playground untuk mencoba query apa pun. Mode Ujian bukan jalan pintas: soalnya hanya diambil dari misi yang sudah terbuka.',
    ],
  },
  {
    id: 'database',
    question: 'Database apa yang dipakai untuk latihan?',
    answer: [
      `SQLite yang berjalan di browser (WebAssembly), berisi ${TABLE_COUNT} tabel sistem informasi rumah sakit: ${PRACTICE_TABLES.map((table) => table.name).join(', ')}.`,
      DATA_NOTE,
    ],
  },
];

export const FAQ = {
  title: 'Pertanyaan yang sering muncul',
  items: FAQ_ITEMS,
} as const;

/* ------------------------------------------------------------------ */
/* 13. CTA penutup                                                     */
/* ------------------------------------------------------------------ */

export const CTA = {
  title: 'Misi pertamamu sudah menunggu',
  /** Untuk pengguna lama. */
  titleReturning: 'Lanjutkan dari misi terakhirmu',
  lead: 'Gratis, tanpa akun, langsung di browser.',
  button: { start: 'Mulai belajar', resume: 'Lanjutkan', href: ROUTES.sql },
  /** Semua misi sudah selesai: tombolnya memakai EXPLORE.cta. */
  allDone: { title: 'Semua misi sudah tuntas', lead: 'Ulangi misi, coba Playground, atau uji diri di Mode Ujian.' },
} as const;

/* ------------------------------------------------------------------ */
/* 14. Footer                                                          */
/* ------------------------------------------------------------------ */

export const FOOTER = {
  tagline: 'Belajar membangun sistem informasi rumah sakit, satu misi demi satu misi.',
  github: { label: 'GitHub', href: GITHUB_URL },
  /** Kolom "Jalur": isinya TRACKS (yang 'segera' tanpa tautan + chip). */
  tracksTitle: 'Jalur',
  helpTitle: 'Bantuan',
  help: {
    backup: { label: 'Cadangkan progres', href: ROUTES.progress },
    /** Menggulir ke section FAQ (bukan href). */
    faq: { label: 'Pertanyaan yang sering muncul', sectionId: SECTION_IDS.faq },
  },
  legal: `Sumber terbuka berlisensi ${LICENSE_NAME}.`,
  dataNote: DATA_NOTE,
} as const;
