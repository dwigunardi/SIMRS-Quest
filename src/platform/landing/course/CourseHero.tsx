/**
 * C1 — Hero landing jalur ('#/landing/<id>'), satu komponen untuk kedua varian:
 *
 *   'tersedia': badge TERSEDIA, "Mulai belajar (gratis)" / "Lanjutkan", "Lihat silabus ⌄", "Playground SQL →", titik hijau
 *               + baris jaminan, statistik hitung-naik dari kurikulum, chip "Terhubung dengan", kartu logo besar.
 *   'segera'  : sama, tetapi badge SEGERA (amber), tombol utama menuju jalur SQL ("Mulai dari SQL"), "Lihat rencana ⌄",
 *               titik amber (bukan hijau "sudah berjalan"), tanpa statistik, kartu belakang bergaris putus-putus.
 *
 * Semua teks dari data jalur (`course.hero`, courses/*.ts) dan label bersama COURSE_UI (lib/pagesContent.ts). Satu-satunya
 * h1 halaman ada di sini. Latar: gradien diagonal surface → mint (token q, jadi ikut tema terang/gelap).
 *
 * Panggung kanan (course/HeroStage.tsx): kartu logo melayang dengan Kapi, plus cuplikan misi sungguhan (jalur
 * tersedia) atau topik rencana (jalur segera). Di bawah lg panggungnya satu baris di bawah teks, lebih kecil.
 */
import { ArrowRight, ChevronDown } from 'lucide-react';
import { courseSummary } from '../courses/catalog';
import { isAvailableCourse, type CourseData } from '../courses/types';
import { ctaLabelFor, usePageStatus } from '../layout/pageStatus';
import { cn } from '../lib/cn';
import { COURSE_SECTION_IDS, COURSE_UI } from '../lib/pagesContent';
import { Breadcrumb } from '../ui/Breadcrumb';
import { Button3D } from '../ui/Button3D';
import { Chip } from '../ui/Chip';
import { Pill } from '../ui/Pill';
import { Section } from '../ui/Section';
import { StatRow } from '../ui/StatRow';
import { HeroStage } from './HeroStage';

export interface CourseHeroProps {
  course: CourseData;
  /** Tombol "Lihat silabus ⌄" / "Lihat rencana ⌄": gulir ke bagiannya (dan buka tier pertama silabus). */
  onShowOutline: () => void;
}

const TITLE_ID = 'course-title';
const CONNECTED_ID = 'course-connected';

/** Judul panjang ("JavaScript & TypeScript", "NestJS · Next.js · Laravel") memakai skala lebih kecil supaya muat di ponsel. */
const LONG_TITLE = 12;

/**
 * Titik tengah nama jalur ("NestJS · Next.js · Laravel") menempel ke kata sebelumnya (spasi tak-terputus), jadi baris
 * H1 yang patah tidak pernah diawali "·". Hanya tampilan; pembaca layar membaca teks yang sama.
 */
function keepDots(text: string): string {
  return text.replace(/ · /g, ' · ');
}

export function CourseHero({ course, onShowOutline }: CourseHeroProps): JSX.Element {
  const status = usePageStatus();
  const { hero } = course;
  const available = isAvailableCourse(course);
  const long = course.title.length > LONG_TITLE;

  return (
    <Section
      id={COURSE_SECTION_IDS.hero}
      spacing="none"
      labelledBy={TITLE_ID}
      className="q-page-hero pb-12 pt-8 sm:pb-16 sm:pt-10 lg:pb-16 lg:pt-12"
    >
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
        <div className="flex min-w-0 flex-col items-start">
          <Breadcrumb
            items={[
              { label: COURSE_UI.breadcrumb.home, href: COURSE_UI.breadcrumb.homeHref },
              { label: COURSE_UI.breadcrumb.catalog, href: COURSE_UI.breadcrumb.catalogHref },
              { label: course.title },
            ]}
          />

          <p className="m-0 mt-7 flex items-center gap-2.5" data-testid="course-status" data-status={course.status}>
            <Pill size="sm" tone={available ? 'solid' : 'amber'} className={cn('font-bold uppercase tracking-[0.08em]', available ? '' : 'bg-q-amber text-q-on-amber')}>
              {COURSE_UI.status[course.status]}
            </Pill>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-q-ink-soft">{COURSE_UI.trackWord}</span>
          </p>

          <h1
            id={TITLE_ID}
            className={cn(
              'm-0 mt-4 max-w-full text-balance font-q-display font-bold text-q-ink',
              long ? 'text-[32px] leading-[1.12] sm:text-[44px] lg:text-[56px] lg:leading-[1.06]' : 'text-[44px] leading-[1.05] sm:text-[56px] lg:text-[64px]',
            )}
          >
            {keepDots(COURSE_UI.h1(course.title))}
          </h1>

          <p className="m-0 mt-5 max-w-[58ch] text-pretty text-lg leading-relaxed text-q-ink-soft">{hero.lead}</p>

          {/* Tombol utama + "(gratis)"; di ponsel selebar layar dengan keterangan di bawahnya. */}
          <div className="mt-8 flex w-full flex-col items-stretch gap-2 pb-1 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
            <Button3D href={hero.cta.href} size="lg" className="w-full sm:w-auto" data-testid="course-primary" data-mode={status.mode}>
              {ctaLabelFor(hero.cta, status)}
            </Button3D>
            {status.started ? null : <span className="text-center text-sm text-q-ink-soft sm:text-left">{hero.cta.note}</span>}
          </div>

          <div className="mt-4 flex w-full flex-col gap-3 pb-1 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button3D
              variant="outline"
              size="md"
              onClick={onShowOutline}
              iconRight={<ChevronDown aria-hidden className="h-4 w-4" />}
              data-testid="course-outline"
            >
              {hero.outline.label}
            </Button3D>
            <Button3D variant="outline" size="md" href={hero.secondary.href} iconRight={<ArrowRight aria-hidden className="h-4 w-4" />} data-testid="course-secondary">
              {hero.secondary.label}
            </Button3D>
          </div>

          <p className="m-0 mt-6 flex items-start gap-2.5 text-sm leading-snug text-q-ink-soft" data-testid="course-proof">
            <ProofDot live={available} />
            <span>{hero.proof}</span>
          </p>

          {available ? <StatRow items={course.stats} label={COURSE_UI.statsLabel(course.title)} size="lg" className="mt-7" /> : null}

          <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2.5">
            <span id={CONNECTED_ID} className="text-xs font-bold uppercase tracking-[0.14em] text-q-ink-soft">
              {COURSE_UI.connected}
            </span>
            <ul aria-labelledby={CONNECTED_ID} className="m-0 flex list-none flex-wrap gap-2 p-0">
              {hero.connected.map((id) => {
                const other = courseSummary(id);
                return other ? (
                  <Chip key={id} as="li" href={other.href} icon={other.icon} tone="surface" size="md" data={{ 'data-track': id }}>
                    {other.title}
                  </Chip>
                ) : null;
              })}
            </ul>
          </div>
        </div>

        <HeroStage course={course} />
      </div>
    </Section>
  );
}

/** Titik di depan baris jaminan: hijau berdenyut untuk jalur yang sudah berjalan, amber diam untuk jalur 'segera'. */
function ProofDot({ live }: { live: boolean }): JSX.Element {
  if (!live) return <span aria-hidden className="mt-[5px] inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-q-amber" />;
  return (
    <span aria-hidden className="relative mt-[5px] flex h-2.5 w-2.5 shrink-0">
      <span className="q-loop absolute inline-flex h-full w-full rounded-full bg-q-success opacity-70 motion-safe:animate-ping" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-q-success" />
    </span>
  );
}
