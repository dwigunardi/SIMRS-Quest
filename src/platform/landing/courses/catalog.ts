/**
 * Ringkasan semua jalur untuk kartu (katalog, "Jalur yang terhubung", 404) dan urutan belajar yang DISARANKAN.
 *
 * Modul RINGAN: hanya registri (src/platform/tracks.ts) + daftar jalur landing (lib/content.ts). TIDAK mengimpor data
 * misi — halaman katalog tidak perlu memuatnya. Judul, status, dan deskripsi diambil dari registri sehingga tidak
 * bisa berbeda; scripts/verify/courses.ts memeriksa bahwa setiap jalur registri punya ringkasan di sini.
 */
import { courseHref } from '../../router';
import { TRACKS as REGISTRY, type TrackStatus } from '../../tracks';
import { TRACKS as LANDING_TRACKS, type IconName } from '../lib/content';
import type { CourseEnv } from './types';

/** Urutan belajar yang disarankan (saran, bukan syarat): SQL → JS & TS → REST API → React → framework. */
export const SUGGESTED_ORDER: readonly string[] = ['sql', 'js', 'rest', 'react', 'framework'];

/** Data tambahan per jalur yang tidak ada di registri. */
const EXTRA: Readonly<Record<string, { env: CourseEnv; logos: readonly IconName[]; stepNote: string; keywords: readonly string[] }>> = {
  sql: {
    env: 'browser',
    logos: ['database'],
    stepNote: 'Kenali datanya dulu: tabel, relasi, dan query di database rumah sakit.',
    keywords: ['sql', 'sqlite', 'database', 'query', 'select', 'join', 'tabel', 'ddl', 'json'],
  },
  js: {
    env: 'browser',
    logos: ['si-javascript', 'si-typescript'],
    stepNote: 'Olah data pasien dan tagihan dengan kode yang bertipe ketat.',
    keywords: ['javascript', 'typescript', 'js', 'ts', 'fungsi', 'tipe'],
  },
  rest: {
    env: 'browser',
    logos: ['globe'],
    stepNote: 'Buka data SIMRS lewat endpoint yang rapi.',
    keywords: ['rest', 'api', 'http', 'endpoint', 'json'],
  },
  react: {
    env: 'browser',
    logos: ['si-react'],
    stepNote: 'Tampilkan data itu di layar loket, antrean, dan rekam medis.',
    keywords: ['react', 'komponen', 'frontend', 'ui', 'state'],
  },
  framework: {
    env: 'vscode',
    logos: ['si-nestjs', 'si-nextdotjs', 'si-laravel'],
    stepNote: 'Satukan semuanya dalam proyek utuh dengan framework sungguhan.',
    keywords: ['nestjs', 'nest', 'next.js', 'nextjs', 'next', 'laravel', 'framework', 'vs code', 'php'],
  },
};

export interface CourseSummary {
  id: string;
  title: string;
  tagline: string;
  /** Deskripsi registri (kartu menampilkannya dua baris). */
  description: string;
  status: TrackStatus;
  /** Ikon jalur (sama dengan menu navbar). */
  icon: IconName;
  /** Logo teknologi untuk kartu logo (1–3). */
  logos: readonly IconName[];
  env: CourseEnv;
  /** '#/landing/<id>'. */
  href: string;
  /** Posisi di SUGGESTED_ORDER, mulai dari 1. */
  step: number;
  /** Satu kalimat untuk kartu "Urutan belajar yang kami sarankan". */
  stepNote: string;
  /** Kata kunci tambahan untuk pencarian katalog (huruf kecil). */
  keywords: readonly string[];
}

function summarize(id: string): CourseSummary | null {
  const track = REGISTRY.find((t) => t.id === id);
  const landing = LANDING_TRACKS.find((t) => t.id === id);
  const extra = EXTRA[id];
  if (!track || !landing || !extra) return null;
  return {
    id,
    title: track.title,
    tagline: track.tagline,
    description: track.description,
    status: track.status,
    icon: landing.icon,
    logos: extra.logos,
    env: extra.env,
    href: courseHref(id),
    step: SUGGESTED_ORDER.indexOf(id) + 1,
    stepNote: extra.stepNote,
    keywords: extra.keywords,
  };
}

/** Semua jalur dalam urutan registri. */
export const COURSE_SUMMARIES: readonly CourseSummary[] = REGISTRY.map((t) => summarize(t.id)).filter((s): s is CourseSummary => s !== null);

/** Semua jalur dalam urutan belajar yang disarankan (langkah 1–5). */
export const COURSES_BY_STEP: readonly CourseSummary[] = [...COURSE_SUMMARIES].sort((a, b) => a.step - b.step);

export function courseSummary(id: string): CourseSummary | undefined {
  return COURSE_SUMMARIES.find((course) => course.id === id);
}

/** Jalur lain selain `id`, urut langkah yang disarankan — untuk "Jalur yang terhubung dengan …". */
export function relatedCourses(id: string): CourseSummary[] {
  return COURSES_BY_STEP.filter((course) => course.id !== id);
}

/** Pencocokan teks katalog: judul, tagline, deskripsi, dan kata kunci (tanpa membedakan huruf besar/kecil). */
export function matchesQuery(course: CourseSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  const haystack = [course.title, course.tagline, course.description, ...course.keywords].join(' ').toLowerCase();
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}
