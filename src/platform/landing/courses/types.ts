/**
 * Bentuk data halaman landing per jalur ('#/landing/<id>'). SATU template (pages/CoursePage.tsx) merender semua jalur
 * dari data ini; template tidak menulis teks jalur sendiri. Teks antarmuka yang sama untuk semua jalur (label tombol,
 * breadcrumb, judul bagian umum) ada di lib/pagesContent.ts (COURSE_UI).
 *
 * Dua varian:
 * - 'tersedia' (AvailableCourse): bagian C1–C10 lengkap — statistik, fitur, silabus (dibangun dari kurikulum asli),
 *   isi jalur, baris fitur, alasan, FAQ, jalur terkait, CTA.
 * - 'segera' (SoonCourse): hero jujur, rencana materi (bertanda rencana), cara mengerjakannya, ajakan mulai dari SQL,
 *   FAQ, jalur terkait, CTA. TIDAK punya silabus, statistik, atau angka pelajaran.
 *
 * Semua `href` adalah hash yang dikenal router (src/platform/router.ts) — diperiksa scripts/verify/courses.ts.
 * Jangan memakai '#id' untuk gulir di dalam halaman: pakai scrollToSection() dengan COURSE_SECTION_IDS.
 */
import type { TrackStatus } from '../../tracks';
import type { FaqItem, IconName, PracticeTabId } from '../lib/content';
import type { CourseSectionId } from '../lib/pagesContent';

/* ------------------------------------------------------------------ */
/* Potongan umum                                                       */
/* ------------------------------------------------------------------ */

export interface CourseLink {
  label: string;
  /** Hash rute aplikasi ('#/sql/playground', '#/landing', …). */
  href: string;
}

/** Tempat jalur dikerjakan — dipakai filter katalog dan baris "Cara mengerjakannya". */
export type CourseEnv = 'browser' | 'vscode';

/** Butir bergambar ikon: fitur, topik rencana, langkah. */
export interface IconItem {
  icon: IconName;
  title: string;
  text: string;
}

/** Judul bagian + kalimat pembuka opsional. */
export interface Heading {
  title: string;
  lead?: string;
}

/* ------------------------------------------------------------------ */
/* C1 Hero                                                             */
/* ------------------------------------------------------------------ */

export interface CourseHero {
  /** Deskripsi di bawah H1 "Belajar {title}". */
  lead: string;
  /**
   * Tombol 3D utama. `start` untuk pengguna baru, `resume` untuk pengguna yang sudah mulai (status dari
   * usePageStatus()), `note` = teks kecil di samping/bawahnya, mis. "(gratis)". Teks ditulis kalimat biasa; Button3D
   * yang membuatnya kapital.
   */
  cta: { start: string; resume: string; note: string; href: string };
  /** Tombol sekunder pertama: menggulir ke bagian `target` (silabus / rencana). Ikon "⌄" digambar komponen. */
  outline: { label: string; target: CourseSectionId };
  /** Tombol sekunder kedua (tautan). Ikon "→" digambar komponen. */
  secondary: CourseLink;
  /** Baris pengganti bukti sosial, didahului titik hijau. */
  proof: string;
  /** Jalur lain untuk baris "Terhubung dengan" (id registri, urut tampil). */
  connected: readonly string[];
  /** Logo di kartu besar kanan (1–3 ikon). */
  logos: readonly IconName[];
  /**
   * Cuplikan misi SUNGGUHAN di panggung kanan hero (jalur tersedia): query yang diketik lalu penilaiannya. Jalur
   * 'segera' tidak punya cuplikan — panggungnya menampilkan topik rencana (bertanda "Rencana") dari `plan`.
   */
  glimpse?: HeroGlimpse;
}

/** Cuplikan misi di hero: kode misi asli (boleh dipecah barisnya, maknanya sama) + judul & XP penilaiannya. */
export interface HeroGlimpse {
  /** "Tier 1 · Misi 2". */
  label: string;
  fileName: string;
  code: string;
  /** Judul kartu penilaian, sama dengan aplikasi ("Jawaban benar!"). */
  verdict: string;
  /** "+50 XP". */
  xp: string;
}

/** Potongan antarmuka aplikasi yang menandai sebuah fitur (mis. pill "−20% XP", tab "Perbedaan"). */
export interface FeatureToken {
  text: string;
  /** code = kata kunci SQL; amber = XP/hint; primary = hijau aplikasi; neutral = label biasa. */
  tone: 'code' | 'amber' | 'primary' | 'neutral';
}

/** Satu fitur C2: butir berikon + potongan antarmuka yang benar-benar ada di aplikasi. */
export interface FeatureItem extends IconItem {
  token: FeatureToken;
}

/** Satu angka di baris statistik hero (angka tebal hitung-naik, dipisah titik). */
export interface CourseStat {
  value: number;
  label: string;
}

/* ------------------------------------------------------------------ */
/* C3 Silabus (jalur tersedia)                                         */
/* ------------------------------------------------------------------ */

/** Jenis misi untuk badge silabus — sama dengan displayKind di src/components/MissionKind.tsx. */
export type SyllabusMissionKind = 'sql' | 'fix' | 'predict' | 'injection' | 'concept' | 'boss';

export interface SyllabusMission {
  id: string;
  /** Nomor urut global (sama dengan "Misi n" di aplikasi). */
  order: number;
  /** order dua digit: "01", "48". */
  number: string;
  title: string;
  /** Konsep yang dilatih (field `concept` misi). */
  concept: string;
  kind: SyllabusMissionKind;
  /** Label badge jenis misi (MISSION_KIND_LABEL). */
  kindLabel: string;
  xp: number;
}

export interface SyllabusArticle {
  id: string;
  title: string;
  summary: string;
}

export interface SyllabusTier {
  tier: number;
  /** Nilai unik untuk Accordion, mis. "tier-1". */
  value: string;
  /** Eyebrow, mis. "Tier 1" (komponen boleh membuatnya kapital). */
  label: string;
  /** Nama tier asli (TIERS). */
  title: string;
  /** Deskripsi tier asli (TIERS). */
  description: string;
  /** Semua misi tier ini (termasuk Boss), urut order. */
  missions: readonly SyllabusMission[];
  /** Boss tier ini (juga ada di `missions`); null bila tier tanpa Boss. */
  boss: SyllabusMission | null;
  /** Artikel Materi tier ini (Article.tier), urut seperti di aplikasi. */
  articles: readonly SyllabusArticle[];
  /** Chip ringkas, mis. ["8 misi", "1 Boss", "4 materi"]. */
  chips: readonly string[];
  /** Tombol "Mulai →": jalur dibuka di misi "Lanjutkan" (aplikasi belum punya tautan ke tier tertentu). */
  start: CourseLink;
}

export interface CourseSyllabus extends Heading {
  /** Baris meta di samping judul, mis. ["10 tier", "10 Boss", "72 misi", "39 materi"]. */
  meta: readonly string[];
  tiers: readonly SyllabusTier[];
  /** Pill kemajuan bila ada progres: "{n} dari 72 misi selesai". */
  progress: (completed: number, total: number) => string;
}

/* ------------------------------------------------------------------ */
/* C4 Isi jalur, C5 janji, C6 baris fitur, C7 alasan (jalur tersedia)  */
/* ------------------------------------------------------------------ */

export interface CoursePart extends IconItem {
  id: string;
  /** Hitungan di kaki kartu, mis. "72 misi". */
  count: string;
  href: string;
}

/** Contoh latihan di baris "Jalankan query sungguhan": kunci ke PRACTICE.tabs (lib/content.ts, sudah diverifikasi). */
export interface RunRowTab {
  id: PracticeTabId;
  label: string;
}

export interface CourseRows {
  /** a — Jalankan query sungguhan: tab latihan + jendela kode + panel HASIL/KONSOL + tiga kolom mini. */
  run: Heading & {
    tabs: readonly RunRowTab[];
    tabsLabel: string;
    /** Nama tab panel bawah jendela kode. */
    panels: { result: string; console: string };
    /** Baris konsol (teks apa adanya, tanpa angka karangan). `rows` = jumlah baris hasil contoh. */
    consoleLines: (rows: number) => readonly string[];
    /** Judul tiga kolom mini. */
    columns: { input: string; yours: string; expected: string };
    /**
     * Judul kolom pengganti untuk tab yang tidak dinilai "hasil kamu vs seharusnya": Tebak Hasil (pilihanmu vs jawaban
     * yang benar) dan Lab Injection (mode rentan vs mode aman — kebocoran di mode rentan justru tujuan misinya).
     */
    columnsByTab: Partial<Record<PracticeTabId, { yours: string; expected: string }>>;
    /** Baris konsol tab Tebak Hasil: query-nya TIDAK dijalankan, kamu memilih tabel hasilnya. */
    consoleNoRun: string;
    /** Keterangan wajib di bawah mockup. */
    note: string;
    /** Tombol di samping: `label` untuk pengguna baru (membuka misi pertama), `resume` bila sudah mulai. */
    link: CourseLink & { resume: string };
  };
  /** b — Streak (latar mint): kalender bulan berjalan + dua kartu. */
  streak: Heading & {
    /** Keterangan kalender. Riwayat per hari TIDAK disimpan aplikasi: yang boleh ditandai hanya streak yang berjalan. */
    calendarCaption: (monthLabel: string) => string;
    note: string;
    weekdays: readonly string[];
    activeLabel: string;
    unknownLabel: string;
    best: { label: string; value: (days: number) => string; empty: string };
    today: { label: string; yes: string; no: string };
    /** Judul kalender bila progres ASLI menunjukkan streak sedang 0 (putus atau belum pernah aktif). */
    zeroTitle: string;
    /** Ditampilkan bila pengguna belum punya progres (angka di kartu lalu contoh). */
    sampleNote: string;
    sample: { best: number; current: number; activeToday: boolean };
  };
  /** c — Belajar di mana saja: ponsel berisi daftar tier + chip progres, kartu mengambang "Tanpa instalasi". */
  anywhere: Heading & { floating: string; phoneLabel: string; points: readonly { icon: IconName; text: string }[] };
  /**
   * d — Taklukkan Boss: daftar Boss asli (CourseSyllabus.tiers[].boss) dengan status dari progres di browser ini
   * (useCourseProgress → bossStates; tanpa progres semuanya 'locked' — itu memang status sebenarnya).
   */
  bosses: Heading & {
    status: { locked: string; open: string; done: string };
    /** Keterangan sumber status (wajib tampil). */
    note: string;
    /** Aturan buka-kunci Boss. */
    rule: string;
  };
  /** e — Banyak cara belajar: tab yang mengganti isi kartu (crossfade). */
  ways: Heading & { tabsLabel: string; tabs: readonly (IconItem & { id: string; label: string; bullets: readonly string[] })[] };
  /** f — Naik pangkat & kumpulkan lencana: kartu pangkat bermiring 3D halus. Angka pangkat: RANK_LADDER (lib/content.ts). */
  ranks: Heading & { cardLabel: string; badgesLabel: string; link: CourseLink };
}

/* ------------------------------------------------------------------ */
/* Varian 'segera'                                                     */
/* ------------------------------------------------------------------ */

export interface CoursePlan extends Heading {
  /** Badge di setiap topik, mis. "Rencana". */
  badge: string;
  /** Kalimat yang WAJIB tampil: ini rencana yang bisa berubah. */
  note: string;
  /** 4–6 topik, tanpa angka pelajaran. */
  topics: readonly IconItem[];
}

export interface CourseHow extends Heading {
  env: CourseEnv;
  steps: readonly IconItem[];
  note: string;
}

export interface CourseWaiting extends Heading {
  text: string;
  reasons: readonly string[];
  cta: CourseLink;
}

/* ------------------------------------------------------------------ */
/* Bersama                                                             */
/* ------------------------------------------------------------------ */

export interface CourseRelated extends Heading {
  /** Keterangan bahwa urutan langkah hanya saran. */
  note: string;
}

export interface CourseCta {
  /** "Belajar {title} bersama Kapi". */
  title: string;
  /** Pengunjung yang belum mulai jalur SQL. */
  lead: string;
  /** Sudah mulai, masih ada misi tersisa (tombolnya `resume`) — jangan menyebut "misi pertama". */
  leadResume: string;
  /** Semua misi jalur SQL sudah tuntas (tombolnya label tujuan utama, mis. "Buka jalur SQL"). */
  leadDone: string;
  start: string;
  resume: string;
  href: string;
}

export interface CourseMeta {
  /** document.title — courseDocumentTitle(title) dari lib/pagesContent.ts. */
  title: string;
  /** meta description, ±150 karakter. */
  description: string;
  ogTitle: string;
  ogDescription: string;
}

interface CourseCommon {
  /** = id registri (src/platform/tracks.ts). */
  id: string;
  /** = title registri. Dipakai di H1 "Belajar {title}". */
  title: string;
  icon: IconName;
  env: CourseEnv;
  hero: CourseHero;
  faq: Heading & { items: readonly FaqItem[] };
  related: CourseRelated;
  cta: CourseCta;
  meta: CourseMeta;
}

export interface AvailableCourse extends CourseCommon {
  status: Extract<TrackStatus, 'tersedia'>;
  stats: readonly CourseStat[];
  /** C2: tepat 6 fitur nyata. */
  features: Heading & { items: readonly FeatureItem[] };
  syllabus: CourseSyllabus;
  /** C4. */
  parts: Heading & { items: readonly CoursePart[] };
  /** C5: eyebrow bergaris + H2. */
  promise: { eyebrow: string; title: string };
  /** C6. */
  rows: CourseRows;
  /** C7: tepat 4 alasan. */
  why: { title: string; items: readonly { title: string; text: string }[] };
}

export interface SoonCourse extends CourseCommon {
  status: Extract<TrackStatus, 'segera'>;
  plan: CoursePlan;
  how: CourseHow;
  waiting: CourseWaiting;
}

export type CourseData = AvailableCourse | SoonCourse;

export function isAvailableCourse(course: CourseData): course is AvailableCourse {
  return course.status === 'tersedia';
}
