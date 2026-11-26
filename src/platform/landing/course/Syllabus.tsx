/**
 * C3 — Silabus jalur 'tersedia', dibangun dari kurikulum ASLI (course.syllabus, courses/sql.ts → TIERS/MISSIONS/ARTICLES).
 *
 *   Judul "Silabus" + meta (10 tier • 10 Boss • 72 misi • 39 materi) + "Buka semua / Tutup semua" (+ pill kemajuan bila
 *   ada progres). Lalu satu kartu per tier di sepanjang rel bernomor: eyebrow "Tier n", judul & deskripsi tier asli,
 *   peta mini misi (kotak = misi, belah ketupat = Boss — bahasa visual yang sama dengan strip "Jelajahi" Beranda), chip
 *   hitungan, dan "Buka ⌄". Tombol "Mulai →" (pengguna baru) / "Lanjutkan →" hanya ada di tier tempat misi berikutnya
 *   berada: tombolnya membuka jalur di misi "Lanjutkan" — aplikasi tidak punya tautan ke tier tertentu, jadi tier lain
 *   tidak diberi tombol yang menjanjikan hal itu.
 *   Dibuka (Radix Accordion type="multiple" TERKENDALI, tinggi teranimasi): grup "Misi" (nomor, judul, konsep, badge
 *   jenis misi nyata) dan grup "Materi" (artikel tier itu).
 *
 * Progres hanya DIBACA (props `progress` dari useCourseProgress → parseProgress): misi selesai diberi centang + label
 * teks "Selesai", kotak peta mininya terisi, tier yang tuntas ditandai di rel dan di eyebrow. Tanpa progres tidak ada
 * tanda apa pun — kemajuan tidak dikarang.
 *
 * Keadaan terbuka dikendalikan induk (`open` / `onOpenChange`) supaya tombol hero "Lihat silabus" bisa membuka tier
 * pertama. Animasi tinggi memakai kelas q-anim (mati saat gerak dikurangi).
 */
import { useMemo } from 'react';
import * as RadixAccordion from '@radix-ui/react-accordion';
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import type { CourseProgress } from '../courses/progress';
import type { AvailableCourse, SyllabusMission, SyllabusMissionKind, SyllabusTier } from '../courses/types';
import { usePageStatus } from '../layout/pageStatus';
import { cn } from '../lib/cn';
import type { IconName } from '../lib/content';
import { COURSE_SECTION_IDS, COURSE_UI } from '../lib/pagesContent';
import { Button3D } from '../ui/Button3D';
import { Chip } from '../ui/Chip';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { Reveal } from '../ui/Reveal';
import { Section } from '../ui/Section';

export interface SyllabusProps {
  course: AvailableCourse;
  /** Progres jalur di browser ini (hanya dibaca). */
  progress: CourseProgress;
  /** Nilai tier yang sedang terbuka (SyllabusTier.value). */
  open: readonly string[];
  onOpenChange: (open: string[]) => void;
}

const TITLE_ID = 'course-syllabus-title';

/** Ikon badge jenis misi — sama dengan daftar jenis misi di Beranda (sections/Gamification.tsx). */
const KIND_ICON: Readonly<Record<SyllabusMissionKind, IconName>> = {
  sql: 'database',
  fix: 'bug',
  predict: 'eye',
  injection: 'shield-alert',
  concept: 'book',
  boss: 'crown',
};

/**
 * Tier tempat misi berikutnya berada — satu-satunya kartu yang diberi tombol ke jalur (tombolnya membuka misi
 * "Lanjutkan", bukan tier yang diklik). Misi "Lanjutkan" dari ringkasan jalur bila sudah dimuat; sebelum itu misi
 * pertama yang belum selesai. Pengguna baru: tier pertama. Semua misi tuntas: tidak ada.
 */
function currentTierOf(tiers: readonly SyllabusTier[], progress: CourseProgress, resumeId: string | null): string | null {
  if (resumeId !== null) {
    const holder = tiers.find((tier) => tier.missions.some((mission) => mission.id === resumeId));
    if (holder) return holder.value;
  }
  if (!progress.started) return tiers[0]?.value ?? null;
  return tiers.find((tier) => tier.missions.some((mission) => !progress.completedIds.has(mission.id)))?.value ?? null;
}

export function Syllabus({ course, progress, open, onOpenChange }: SyllabusProps): JSX.Element {
  const { syllabus } = course;
  const status = usePageStatus();
  const values = syllabus.tiers.map((tier) => tier.value);
  const allOpen = values.length > 0 && values.every((value) => open.includes(value));
  const ui = COURSE_UI.syllabus;
  const resumeId = status.glance?.resume?.missionId ?? null;
  const currentTier = useMemo(() => currentTierOf(syllabus.tiers, progress, resumeId), [syllabus.tiers, progress, resumeId]);

  return (
    <Section id={COURSE_SECTION_IDS.syllabus} tone="tint" labelledBy={TITLE_ID}>
      <Reveal className="flex flex-col gap-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:gap-6">
            <h2 id={TITLE_ID} className="m-0 font-q-body text-q-h2-sm font-bold text-q-ink lg:text-q-h2">
              {syllabus.title}
            </h2>
            <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base font-bold text-q-ink" data-testid="syllabus-meta">
              {syllabus.meta.map((item, index) => (
                <span key={item} className="inline-flex items-baseline gap-2 whitespace-nowrap">
                  {item}
                  {index < syllabus.meta.length - 1 ? (
                    <span aria-hidden className="font-normal text-q-ink-soft">
                      •
                    </span>
                  ) : null}
                </span>
              ))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pb-1">
            {progress.started ? (
              <span data-testid="syllabus-progress">
                <Pill tone="surface" icon={<Check aria-hidden className="h-4 w-4 text-q-success-ink" />} className="font-bold">
                  {syllabus.progress(progress.completed, progress.total)}
                </Pill>
              </span>
            ) : null}
            <Button3D
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(allOpen ? [] : values)}
              iconLeft={allOpen ? <ChevronsDownUp aria-hidden className="h-4 w-4" /> : <ChevronsUpDown aria-hidden className="h-4 w-4" />}
              data-testid="syllabus-toggle-all"
            >
              {allOpen ? ui.collapseAll : ui.expandAll}
            </Button3D>
          </div>
        </div>
        {syllabus.lead !== undefined ? <p className="m-0 max-w-[64ch] text-pretty text-base leading-relaxed text-q-ink-soft">{syllabus.lead}</p> : null}
      </Reveal>

      <Reveal className="mt-10">
        <RadixAccordion.Root type="multiple" value={[...open]} onValueChange={onOpenChange} className="relative flex flex-col gap-4" data-testid="syllabus">
          {/* Rel yang menyambung nomor-nomor tier (hiasan). */}
          <span aria-hidden className="absolute bottom-10 left-[19px] top-10 hidden w-0.5 rounded-full bg-q-primary/25 sm:block" />
          {syllabus.tiers.map((tier) => (
            <TierCard key={tier.value} course={course} tier={tier} progress={progress} isOpen={open.includes(tier.value)} current={tier.value === currentTier} />
          ))}
        </RadixAccordion.Root>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Satu tier                                                           */
/* ------------------------------------------------------------------ */

interface TierCardProps {
  course: AvailableCourse;
  tier: SyllabusTier;
  progress: CourseProgress;
  isOpen: boolean;
  /** Misi berikutnya ada di tier ini → kartunya diberi tombol "Mulai"/"Lanjutkan" ke jalur. */
  current: boolean;
}

function TierCard({ course, tier, progress, isOpen, current }: TierCardProps): JSX.Element {
  const ui = COURSE_UI.syllabus;
  const titleId = `syllabus-${tier.value}-title`;
  const done = tier.missions.filter((mission) => progress.completedIds.has(mission.id)).length;
  const total = tier.missions.length;
  const complete = progress.started && total > 0 && done === total;
  const state: NodeState = complete ? 'done' : progress.started && done > 0 ? 'partial' : 'idle';

  return (
    <RadixAccordion.Item
      value={tier.value}
      className="group/tier relative sm:pl-14"
      data-testid="syllabus-tier"
      data-tier={tier.tier}
      data-done={complete ? 'true' : 'false'}
      data-done-count={done}
      data-current={current ? 'true' : undefined}
    >
      <TierNode tier={tier.tier} state={state} />
      <div className={cn('overflow-hidden rounded-q-lg border bg-q-surface transition-colors duration-200', isOpen ? 'border-q-primary/40' : 'border-q-border')}>
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="min-w-0 flex-1">
            <p className="m-0 flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-bold uppercase leading-none tracking-[0.14em] text-q-primary-ink">{tier.label}</span>
              {complete ? (
                <Pill size="sm" tone="success" icon={<Check aria-hidden className="h-3.5 w-3.5" />} className="font-bold">
                  {ui.done}
                </Pill>
              ) : null}
            </p>
            <h3 id={titleId} className="m-0 mt-2 text-balance font-q-body text-q-h3 font-bold text-q-ink">
              {tier.title}
            </h3>
            {/* Ponsel: deskripsi tier tertutup diringkas dua baris (utuh saat tier dibuka) supaya daftar tier tidak terlalu panjang. */}
            <p className="m-0 mt-2 max-w-[68ch] text-pretty text-[15px] leading-relaxed text-q-ink-soft max-sm:line-clamp-2 max-sm:group-data-[state=open]/tier:line-clamp-none">
              {tier.description}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 sm:gap-x-5">
              <MissionStrip missions={tier.missions} completed={progress.completedIds} />
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {tier.chips.map((chip) => (
                  <Chip key={chip} as="li">
                    {chip}
                  </Chip>
                ))}
              </ul>
              {progress.started && !complete ? <span className="text-sm text-q-ink-soft">{course.syllabus.progress(done, total)}</span> : null}
            </div>
          </div>

          <div className="flex shrink-0 gap-3 pb-1 lg:pt-0.5">
            {current ? (
              <Button3D
                href={tier.start.href}
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                iconRight={<ArrowRight aria-hidden className="h-4 w-4" />}
                data-testid="syllabus-start"
              >
                {progress.started ? ui.resume : tier.start.label}
                <span className="sr-only"> {ui.startHint(course.title)}</span>
              </Button3D>
            ) : null}
            <RadixAccordion.Trigger
              className="group inline-flex h-9 flex-1 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-q-pill bg-q-muted px-4 font-q-body text-[13px] font-bold uppercase tracking-[0.06em] text-q-ink transition-colors duration-150 hover:bg-q-tint hover:text-q-primary-ink sm:flex-none"
              data-testid="syllabus-trigger"
            >
              {isOpen ? ui.close : ui.open}
              <span className="sr-only">
                {' '}
                {tier.label}: {tier.title}
              </span>
              <ChevronDown aria-hidden className="q-anim h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </RadixAccordion.Trigger>
          </div>
        </div>

        {/* Wilayah isi dinamai judul tier (bawaan Radix memakai teks tombol, jadi namanya "Tutup Tier n: …"). */}
        <RadixAccordion.Content aria-labelledby={titleId} className="q-anim overflow-hidden data-[state=closed]:animate-q-accordion-up data-[state=open]:animate-q-accordion-down">
          <div className="grid gap-8 border-t border-q-border px-5 pb-6 pt-5 sm:px-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
            <div className="min-w-0">
              <GroupHeading icon="swords" label={ui.missions} count={tier.missions.length} />
              <ol className="m-0 mt-2 list-none divide-y divide-q-border p-0">
                {tier.missions.map((mission) => (
                  <MissionRow key={mission.id} mission={mission} done={progress.completedIds.has(mission.id)} />
                ))}
              </ol>
            </div>
            <div className="min-w-0">
              <GroupHeading icon="book" label={ui.articles} count={tier.articles.length} />
              <ul className="m-0 mt-2 list-none divide-y divide-q-border p-0">
                {tier.articles.map((article) => (
                  <li key={article.id} className="flex items-start gap-3 py-2.5 text-[15px] leading-snug text-q-ink">
                    <BookOpen aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-q-primary-ink" />
                    <span className="min-w-0">{article.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </RadixAccordion.Content>
      </div>
    </RadixAccordion.Item>
  );
}

/* ------------------------------------------------------------------ */
/* Potongan kecil                                                      */
/* ------------------------------------------------------------------ */

type NodeState = 'idle' | 'partial' | 'done';

/** Nomor tier di rel kiri (hiasan; nomor yang sama ada di eyebrow "Tier n"). Tuntas = hijau penuh bercentang. */
function TierNode({ tier, state }: { tier: number; state: NodeState }): JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute left-0 top-5 hidden h-10 w-10 place-items-center rounded-full border-2 text-sm font-bold tabular-nums sm:grid',
        state === 'done' && 'border-q-primary bg-q-primary text-q-on-primary',
        state === 'partial' && 'border-q-primary bg-q-surface text-q-primary-ink',
        state === 'idle' && 'border-q-border bg-q-surface text-q-ink-soft',
      )}
    >
      {state === 'done' ? <Check className="h-5 w-5" /> : tier}
    </span>
  );
}

/**
 * Peta mini tier: satu kotak per misi, belah ketupat amber untuk Boss. Misi yang selesai terisi penuh. Hiasan — hitungan
 * yang sama tersedia sebagai teks di chip & baris kemajuan.
 */
function MissionStrip({ missions, completed }: { missions: readonly SyllabusMission[]; completed: ReadonlySet<string> }): JSX.Element {
  return (
    <span aria-hidden className="flex items-center gap-1" data-testid="syllabus-strip">
      {missions.map((mission) => {
        const done = completed.has(mission.id);
        return mission.kind === 'boss' ? (
          <span key={mission.id} className="grid h-3.5 w-3.5 place-items-center">
            <span className={cn('block h-[10px] w-[10px] rotate-45 rounded-[2px]', done ? 'bg-q-amber' : 'bg-q-amber/35')} />
          </span>
        ) : (
          <span key={mission.id} className={cn('block h-3 w-3 rounded-[4px]', done ? 'bg-q-primary' : 'bg-q-brand/30')} data-done={done ? 'true' : undefined} />
        );
      })}
    </span>
  );
}

function GroupHeading({ icon, label, count }: { icon: IconName; label: string; count: number }): JSX.Element {
  return (
    <h4 className="m-0 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] text-q-ink-soft">
      <Icon name={icon} className="h-4 w-4 text-q-primary-ink" />
      {label}
      <span className="font-normal tabular-nums tracking-normal">({count})</span>
    </h4>
  );
}

function MissionRow({ mission, done }: { mission: SyllabusMission; done: boolean }): JSX.Element {
  const boss = mission.kind === 'boss';
  return (
    <li className="flex items-start gap-3 py-2.5" data-mission={mission.id} data-done={done ? 'true' : undefined}>
      <span className={cn('w-7 shrink-0 pt-px text-sm font-bold tabular-nums', boss ? 'text-q-amber-ink' : 'text-q-ink-soft')}>{mission.number}</span>
      <span className="flex min-w-0 flex-1 items-start justify-between gap-3 sm:gap-4">
        <span className="min-w-0">
          <span className="block text-[15px] font-bold leading-snug text-q-ink">{mission.title}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-q-ink-soft">{mission.concept}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
          {done ? (
            <span className="inline-flex items-center gap-1 text-[13px] font-bold text-q-success-ink">
              <Check aria-hidden className="h-4 w-4" />
              {COURSE_UI.syllabus.done}
            </span>
          ) : null}
          {/* Ponsel: jenis misi biasa cukup ikonnya (labelnya tetap dibaca pembaca layar); Boss selalu berlabel. */}
          <Pill size="sm" tone={boss ? 'amber' : 'neutral'} icon={<Icon name={KIND_ICON[mission.kind]} className="h-3.5 w-3.5" />} className={boss ? 'font-bold' : 'max-sm:px-1.5'}>
            <span className={boss ? undefined : 'max-sm:sr-only'}>{mission.kindLabel}</span>
          </Pill>
        </span>
      </span>
    </li>
  );
}
