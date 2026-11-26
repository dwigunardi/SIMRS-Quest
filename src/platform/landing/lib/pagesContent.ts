/**
 * Teks halaman katalog ('#/landing'), halaman 404 jalur, dan label antarmuka yang SAMA untuk semua landing jalur
 * (breadcrumb, badge status, tombol silabus, …). Teks khusus tiap jalur ada di courses/*.ts.
 *
 * Sengaja TERPISAH dari lib/content.ts: content.ts ikut bundel awal Beranda, sedangkan berkas ini hanya dimuat oleh
 * halaman yang dimuat malas — Beranda tidak membesar. Berkas ini murni data: hanya mengimpor angka bernama dari
 * content.ts dan nama produk (keduanya sudah diverifikasi), tidak mengimpor React, ikon, maupun data misi.
 *
 * ATURAN ISI sama dengan Beranda: setiap klaim harus benar untuk aplikasi ini (`npm run verify` memeriksa kata
 * terlarang, angka, dan tautan di berkas ini — scripts/verify/courses.ts).
 */
import { PRODUCT_NAME } from '../../brand';
import { ARTICLE_COUNT, BOSS_COUNT, LICENSE_NAME, MASCOT_NAME, MISSION_COUNT, RANK_COUNT, ROUTES, TABLE_COUNT, TIER_COUNT, type FaqItem, type IconName } from './content';

/* ------------------------------------------------------------------ */
/* id section (sasaran scrollToSection — JANGAN dipakai sebagai href)   */
/* ------------------------------------------------------------------ */

/**
 * id section halaman landing jalur. FAQ sengaja 'faq' (sama dengan Beranda) supaya tautan "Pertanyaan yang sering
 * muncul" di footer ikut bekerja.
 */
export const COURSE_SECTION_IDS = {
  hero: 'ringkasan',
  features: 'fitur-jalur',
  syllabus: 'silabus',
  plan: 'rencana',
  parts: 'isi-jalur',
  rows: 'yang-kamu-dapat',
  how: 'cara-mengerjakan',
  waiting: 'sambil-menunggu',
  why: 'kenapa',
  faq: 'faq',
  related: 'jalur-terkait',
  cta: 'mulai',
} as const;

export type CourseSectionId = (typeof COURSE_SECTION_IDS)[keyof typeof COURSE_SECTION_IDS];

export const CATALOG_SECTION_IDS = {
  hero: 'katalog',
  browse: 'semua-jalur',
  start: 'mulai-dari-mana',
  order: 'urutan',
  how: 'cara-kerja',
  faq: 'faq',
  cta: 'mulai',
} as const;

export type CatalogSectionId = (typeof CATALOG_SECTION_IDS)[keyof typeof CATALOG_SECTION_IDS];

export type PageSectionId = CourseSectionId | CatalogSectionId;

/* ------------------------------------------------------------------ */
/* Judul tab & meta                                                    */
/* ------------------------------------------------------------------ */

/** document.title halaman landing jalur. */
export function courseDocumentTitle(title: string): string {
  return `Belajar ${title} — Jalur Interaktif Gratis | ${PRODUCT_NAME}`;
}

export const CATALOG_META = {
  title: `Semua Jalur Belajar Ngoding Interaktif Gratis | ${PRODUCT_NAME}`,
  description: `Katalog jalur belajar ngoding ${PRODUCT_NAME} dengan kasus sistem informasi rumah sakit. Jalur SQL sudah lengkap: ${MISSION_COUNT} misi di browser, gratis dan tanpa akun.`,
  ogTitle: `Jalur belajar ngoding lewat kasus rumah sakit — ${PRODUCT_NAME}`,
  ogDescription: 'SQL sudah bisa dikerjakan langsung di browser. JavaScript & TypeScript, REST API, React, dan NestJS · Next.js · Laravel sedang disiapkan.',
} as const;

export const NOT_FOUND_META = {
  title: `Jalur tidak ditemukan | ${PRODUCT_NAME}`,
  description: `Alamat jalur ini tidak ada di ${PRODUCT_NAME}. Lihat katalog semua jalur atau kembali ke Beranda.`,
  /** Halaman 404 tidak untuk diindeks. */
  robots: 'noindex',
} as const;

/* ------------------------------------------------------------------ */
/* Label antarmuka bersama landing jalur                                */
/* ------------------------------------------------------------------ */

export const COURSE_UI = {
  breadcrumb: { home: 'Beranda', catalog: 'Jalur', homeHref: ROUTES.home, catalogHref: ROUTES.catalog },
  /** Badge terisi di atas H1, diikuti kata `trackWord`. */
  status: { tersedia: 'Tersedia', segera: 'Segera' },
  trackWord: 'Jalur',
  h1: (title: string): string => `Belajar ${title}`,
  connected: 'Terhubung dengan',
  statsLabel: (title: string): string => `Jalur ${title} dalam angka`,
  heroCardLabel: (title: string): string => `Logo jalur ${title}`,
  syllabus: {
    expandAll: 'Buka semua',
    collapseAll: 'Tutup semua',
    open: 'Buka',
    close: 'Tutup',
    /**
     * Tombol di kartu tier tempat misi berikutnya berada (hanya satu tier): "Mulai" untuk pengguna baru (tier 1),
     * "Lanjutkan" bila sudah mulai. Tombolnya membuka JALUR di misi "Lanjutkan" — aplikasi tidak punya tautan ke tier
     * tertentu, jadi tier lain tidak diberi tombol yang menjanjikan hal itu.
     */
    start: 'Mulai',
    resume: 'Lanjutkan',
    /** Teks pembaca layar sesudah "Mulai"/"Lanjutkan": "Mulai jalur SQL". */
    startHint: (title: string): string => `jalur ${title}`,
    missions: 'Misi',
    articles: 'Materi',
    /** Label teks di samping centang misi yang sudah selesai (bukan hanya warna/ikon). */
    done: 'Selesai',
    bossBadge: 'Boss',
  },
  related: {
    step: (step: number): string => `Langkah ${step}`,
    /** Penanda kartu jalur yang sedang dibuka bila ikut ditampilkan. */
    here: 'Jalur ini',
    open: 'Lihat jalur',
  },
  /** Label status kartu jalur (CourseCard). */
  cardStatus: { tersedia: 'Tersedia', segera: 'Segera' },
  /** Keterangan lingkungan kerja (filter katalog & kartu). */
  env: { browser: 'Di browser', vscode: 'VS Code' },
  mascotLabel: `${MASCOT_NAME}, maskot ${PRODUCT_NAME}`,
} as const;

/** Label kerangka yang sama untuk katalog, landing jalur, dan 404. */
export const PAGE_UI = {
  /** Tombol pertama di urutan Tab (terlihat saat difokus): lompati navbar ke judul halaman. */
  skipToContent: 'Lewati ke isi utama',
} as const;

/** "Satu", "Dua", … untuk bilangan kecil di awal kalimat (≥ 10 tetap angka). */
const NUMBER_WORDS = ['Nol', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan'] as const;

export function countWord(count: number, capitalized = true): string {
  const word = NUMBER_WORDS[count] ?? String(count);
  return capitalized ? word : word.toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Katalog '#/landing'                                                 */
/* ------------------------------------------------------------------ */

export type CatalogFilterId = 'all' | 'tersedia' | 'segera' | 'browser' | 'vscode';

export interface CatalogLogo {
  /** Jalur yang diwakili kartu; undefined = kartu database SIMRS. */
  trackId?: string;
  icons: readonly IconName[];
  label: string;
  sub?: string;
}

const CATALOG_FAQ: readonly FaqItem[] = [
  {
    id: 'tersedia',
    question: 'Jalur mana yang sudah bisa dikerjakan?',
    answer: [
      `Jalur SQL: ${MISSION_COUNT} misi dalam ${TIER_COUNT} tier, ${BOSS_COUNT} Boss, dan ${ARTICLE_COUNT} materi. Jalur lainnya masih berstatus Segera dan belum ada tanggal rilisnya.`,
    ],
  },
  {
    id: 'gratis',
    question: 'Apakah semua jalur gratis?',
    answer: [
      'Jalur SQL gratis seluruhnya: tidak ada paket berbayar, iklan, atau pendaftaran. Jalur lainnya belum dibuka.',
      `Semua yang ada di aplikasi ini saat ini gratis, dan kode sumbernya terbuka dengan lisensi ${LICENSE_NAME}.`,
    ],
  },
  {
    id: 'akun',
    question: 'Perlu mendaftar dulu?',
    answer: [
      'Tidak, aplikasi ini tidak memakai akun. Progres tersimpan di penyimpanan browser pada perangkat ini dan tidak dikirim ke server mana pun.',
      'Untuk pindah perangkat, ekspor progres ke file dari halaman Progres, lalu pulihkan di perangkat baru.',
    ],
  },
  {
    id: 'lingkungan',
    question: 'Apa bedanya jalur "Di browser" dan "VS Code"?',
    answer: [
      'Jalur bertanda Di browser dikerjakan di editor browser di dalam aplikasi, tanpa memasang apa pun. Jalur SQL sudah begitu: query-mu dijalankan SQLite di browsermu. Jalur lain bertanda Di browser direncanakan dengan cara yang sama.',
      'Jalur NestJS · Next.js · Laravel direncanakan dikerjakan di VS Code sebagai proyek sungguhan, dengan runner lokal yang melaporkan hasil test ke aplikasi.',
    ],
  },
  {
    id: 'urutan',
    question: 'Haruskah aku mengikuti urutan yang disarankan?',
    answer: [
      'Urutan itu saran. Kami menyarankan mulai dari SQL karena semua jalur memakai kasus SIMRS yang sama, dan saat ini hanya SQL yang sudah bisa dikerjakan.',
    ],
  },
  {
    id: 'kapan',
    question: 'Kapan jalur baru tersedia?',
    answer: ['Belum ada tanggalnya. Jalur yang sedang disiapkan ditandai Segera; halaman tiap jalur berisi rencana materinya.'],
  },
];

const CATALOG_LOGOS: readonly CatalogLogo[] = [
  { trackId: 'sql', icons: ['database'], label: 'SQL' },
  { trackId: 'js', icons: ['si-javascript', 'si-typescript'], label: 'JavaScript & TypeScript' },
  { trackId: 'rest', icons: ['globe'], label: 'REST API' },
  { trackId: 'react', icons: ['si-react'], label: 'React' },
  { trackId: 'framework', icons: ['si-nestjs', 'si-nextdotjs', 'si-laravel'], label: 'NestJS · Next.js · Laravel' },
  { icons: ['table'], label: 'Database SIMRS', sub: `${TABLE_COUNT} tabel` },
];
/** Kartu logo jalur (tanpa kartu database) — verify memastikan isinya = registri, jadi jumlahnya ikut registri. */
const TRACK_LOGO_COUNT = CATALOG_LOGOS.filter((logo) => logo.trackId !== undefined).length;

export interface CatalogFilter {
  id: CatalogFilterId;
  label: string;
}

const CATALOG_FILTERS: readonly CatalogFilter[] = [
  { id: 'all', label: 'Semua' },
  { id: 'tersedia', label: 'Tersedia' },
  { id: 'segera', label: 'Segera' },
  { id: 'browser', label: 'Di browser' },
  { id: 'vscode', label: 'VS Code' },
];

export const CATALOG = {
  hero: {
    eyebrow: 'Jalur belajar interaktif gratis',
    title: 'Belajar ngoding lewat kasus rumah sakit',
    lead: 'Setiap jalur memakai kasus sistem informasi rumah sakit: pasien, kunjungan, dan tagihan. Jalur SQL sudah lengkap dan bisa langsung dikerjakan di browser.',
    cta: { start: 'Mulai belajar', resume: 'Lanjutkan', note: '(gratis)', href: ROUTES.sql },
    /** Baris bukti nyata di bawah tombol. */
    proof: [`${MISSION_COUNT} misi siap dikerjakan`, 'Gratis & tanpa akun', `Sumber terbuka ${LICENSE_NAME}`],
    logosLabel: `Logo ${countWord(TRACK_LOGO_COUNT, false)} jalur dan database SIMRS`,
    /** Keterangan di bawah kartu logo di layar sempit (kartunya terlalu kecil untuk nama jalur). */
    logosCaption: `${countWord(TRACK_LOGO_COUNT)} jalur, satu database SIMRS berisi ${TABLE_COUNT} tabel`,
    /** Enam kartu logo (grid 3×2): lima jalur + database SIMRS. */
    logos: CATALOG_LOGOS,
  },
  browse: {
    title: 'Telusuri semua jalur',
    lead: (available: number, soon: number): string => `${countWord(available)} jalur sudah bisa dikerjakan, ${countWord(soon, false)} lainnya sedang disiapkan.`,
    searchLabel: 'Cari jalur',
    searchPlaceholder: 'Cari: SQL, React, API…',
    /** Tombol ikon di dalam kolom pencarian (Esc juga mengosongkannya). */
    clearSearch: 'Hapus pencarian',
    filtersLabel: 'Saring jalur',
    filters: CATALOG_FILTERS,
    /** Diumumkan ke pembaca layar (aria-live) saat hasil berubah. */
    resultCount: (count: number): string => `${count} jalur ditemukan`,
    empty: {
      title: 'Belum ada jalur yang cocok',
      text: (query: string): string =>
        query.trim() === '' ? 'Coba saringan lain.' : `Tidak ada jalur yang cocok dengan "${query.trim()}". Coba kata lain, misalnya SQL atau React.`,
      /** Kata pencarian cocok dengan `matches` jalur, tetapi semuanya tersaring oleh chip `filter`. */
      filtered: (query: string, filter: string, matches: number): string =>
        query.trim() === ''
          ? `Belum ada jalur berlabel "${filter}".`
          : `Ada ${matches} jalur yang cocok dengan "${query.trim()}", tetapi tidak ada yang berlabel "${filter}".`,
      reset: 'Tampilkan semua jalur',
      /** Tombol untuk kasus `filtered`: kembali ke saringan Semua, kata pencarian tetap. */
      showMatches: (matches: number): string => (matches === 1 ? 'Lihat jalur yang cocok' : `Lihat ${matches} jalur yang cocok`),
    },
  },
  start: {
    title: 'Belum tahu mulai dari mana?',
    text: `Mulai dari SQL. Semua jalur memakai kasus SIMRS yang sama — pasien, kunjungan, tagihan — dan SQL adalah jalur yang sudah lengkap: ${MISSION_COUNT} misi dari SELECT pertama sampai merancang tabel.`,
    reasons: [`${MISSION_COUNT} misi, ${BOSS_COUNT} Boss, dan ${ARTICLE_COUNT} materi`, 'Kasus SIMRS yang sama dipakai jalur berikutnya', 'Langsung di browser, tanpa instalasi'],
    cta: { label: 'Mulai dari SQL', href: ROUTES.sql },
    secondary: { label: 'Lihat jalur SQL', href: '#/landing/sql' },
  },
  order: {
    title: 'Urutan belajar yang kami sarankan',
    lead: 'Urutan ini saran: setiap langkah memakai bekal dari langkah sebelumnya, dengan kasus rumah sakit yang sama.',
  },
  how: {
    title: 'Cara kerja',
    steps: [
      { number: '01', title: 'Pilih jalur', text: 'Saat ini jalur SQL sudah bisa dikerjakan, mulai dari misi pertama.' },
      {
        number: '02',
        title: 'Kerjakan misi di browser dan langsung dinilai',
        text: 'Tulis query, jalankan, lalu lihat penilaiannya saat itu juga. Query-mu dijalankan SQLite di browsermu.',
      },
      {
        number: '03',
        title: 'Naik pangkat & cadangkan progresmu',
        text: `XP membawamu melewati ${RANK_COUNT} pangkat. Progres tersimpan di browser dan bisa diekspor ke file.`,
      },
    ],
  },
  faq: { title: 'Pertanyaan tentang jalur', items: CATALOG_FAQ },
  cta: {
    title: 'Misi pertamamu sudah menunggu',
    titleReturning: 'Lanjutkan dari misi terakhirmu',
    lead: 'Gratis, tanpa akun, langsung di browser.',
    start: 'Mulai belajar',
    resume: 'Lanjutkan',
    href: ROUTES.sql,
  },
} as const;

/* ------------------------------------------------------------------ */
/* 404 jalur ('#/landing/<tidak dikenal>')                             */
/* ------------------------------------------------------------------ */

export const NOT_FOUND = {
  title: 'Jalur tidak ditemukan',
  text: (slug: string): string => `Tidak ada jalur dengan alamat "${slug}". Mungkin ada salah ketik di tautannya.`,
  /** Tanpa slug yang bisa ditampilkan. */
  textGeneric: 'Alamat jalur ini tidak ada. Mungkin ada salah ketik di tautannya.',
  catalog: { label: 'Lihat semua jalur', href: ROUTES.catalog },
  home: { label: 'Kembali ke Beranda', href: ROUTES.home },
  /** Jalan pintas ketiga: langsung ke jalur yang sudah bisa dikerjakan. */
  sql: { label: 'Langsung buka jalur SQL', href: ROUTES.sql },
  suggestionsTitle: 'Atau buka salah satu jalur ini',
  mascotLabel: `${MASCOT_NAME} sedang berpikir`,
} as const;
