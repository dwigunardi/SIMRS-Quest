/**
 * Bagian 9 — "Setiap pelajaran berarti.": tab fitur pencatat kemajuan yang SUNGGUH ADA di aplikasi (Streak, Rank,
 * Misi & Boss, Lencana, Ujian, Latihan ulang, Peta Kelemahan), masing-masing dengan panel ilustrasi.
 *
 * Kejujuran angka: panel Streak dan Rank memakai angka ASLI pengguna bila `glance` tersedia (streak hidup / sudah
 * mulai); selain itu tampil contoh yang diberi keterangan. Untuk streak asli hanya N hari terakhir yang ditandai —
 * hari sebelum itu tidak diketahui dari ringkasan, jadi dibiarkan kosong, tidak dikarang.
 */
import { Fragment, useId, useMemo, useState, type ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Check, Info } from 'lucide-react';
import type { TrackGlance } from '../../tracks';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { cn } from '../lib/cn';
import {
  EXAM_MINUTE_OPTIONS,
  EXAM_QUESTION_COUNTS,
  FEATURES,
  RANK_LADDER,
  REVIEW_INTERVAL_DAYS,
  SECTION_IDS,
  formatNumber,
  type FeatureTabId,
  type IconName,
} from '../lib/content';
import { spring, viewportOnce } from '../lib/motion';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { Reveal } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';
import { Tabs, type TabItem } from '../ui/Tabs';

export interface GamificationProps {
  /** Ringkasan jalur SQL pengguna (useTrackGlance); null bila belum ada / belum selesai dimuat. */
  glance: TrackGlance | null;
}

const TAB_IDS = Object.keys(FEATURES.tabs) as FeatureTabId[];

const TAB_ITEMS: readonly TabItem<FeatureTabId>[] = TAB_IDS.map((id) => ({
  value: id,
  label: FEATURES.tabs[id].label,
  icon: <Icon name={FEATURES.tabs[id].icon} className="h-4 w-4" />,
}));

/* ------------------------------------------------------------------ */
/* Potongan bersama                                                    */
/* ------------------------------------------------------------------ */

/** Muncul bergiliran saat panel terlihat. */
function staggerOf(step: number, delay = 0.1): Variants {
  return { hidden: {}, show: { transition: { staggerChildren: step, delayChildren: delay } } };
}
const popIn: Variants = {
  hidden: { opacity: 0, scale: 0 },
  show: { opacity: 1, scale: 1, transition: spring },
};
const riseIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring },
};

/**
 * Alas emoji (ikon pangkat & lencana): warna TERANG yang sama di kedua tema. Emoji berwarna tetap — stetoskop,
 * lemari arsip, satelit — tenggelam di atas alas gelap, jadi alasnya tidak ikut tema.
 */
const EMOJI_BASE = 'bg-q-emoji-base';

function SampleNote({ children }: { children: ReactNode }): JSX.Element {
  return (
    <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-q-ink-soft">
      <Info aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Streak: kalender 28 hari                                            */
/* ------------------------------------------------------------------ */

const CALENDAR_DAYS = 28;

interface StreakView {
  /** true = angka pengguna sendiri. */
  real: boolean;
  streak: number;
  days: readonly boolean[];
  weekdays: readonly string[];
  best: number;
}

function buildStreakView(glance: TrackGlance | null, now: Date): StreakView {
  const { calendar } = FEATURES.tabs.streak;
  if (!glance || glance.streak.active <= 0) {
    return { real: false, streak: calendar.sampleStreak, days: calendar.days, weekdays: calendar.weekdays, best: 0 };
  }
  // Butir terakhir = hari ini. Streak hidup berakhir hari ini (bila hari ini sudah aktif) atau kemarin.
  const last = glance.streak.activeToday ? CALENDAR_DAYS - 1 : CALENDAR_DAYS - 2;
  const first = last - glance.streak.active + 1;
  const days = Array.from({ length: CALENDAR_DAYS }, (_, index) => index >= first && index <= last);
  // Judul kolom digeser supaya kolom terakhir = nama hari ini (calendar.weekdays mulai dari Senin).
  const todayFromMonday = (now.getDay() + 6) % 7;
  const weekdays = calendar.weekdays.map((_, column) => calendar.weekdays[(todayFromMonday + 1 + column) % 7] ?? '');
  return { real: true, streak: glance.streak.active, days, weekdays, best: glance.streak.best };
}

function StreakVisual({ glance }: { glance: TrackGlance | null }): JSX.Element {
  const { calendar } = FEATURES.tabs.streak;
  const reduced = usePrefersReducedMotion();
  const [now] = useState(() => new Date());
  const view = useMemo(() => buildStreakView(glance, now), [glance, now]);
  const label = calendar.streakLabel(view.streak);
  const todayIndex = view.days.length - 1;
  // Kata ber-tanda-hubung ("berturut-turut") tidak boleh terpenggal di tanda hubungnya.
  const labelWords = label.split(' ');
  /** Api menyala setelah lingkaran terakhir muncul. */
  const flameDelay = 0.25 + view.days.length * 0.03;

  return (
    <motion.div initial="hidden" whileInView="show" viewport={viewportOnce} variants={staggerOf(0.03, 0.2)} className="mx-auto w-full max-w-[380px]">
      <div className="flex items-center gap-4">
        <span aria-hidden className="relative grid h-14 w-14 shrink-0 place-items-center rounded-q bg-q-surface shadow-q-pop">
          <Icon name="flame" className="h-8 w-8 text-q-border-strong" />
          <motion.span
            className="absolute inset-0 grid place-items-center"
            variants={{
              hidden: { opacity: 0, rotate: 0, scale: 0.8 },
              show: {
                opacity: 1,
                scale: 1,
                rotate: reduced ? 0 : [0, -14, 11, -7, 0],
                transition: { delay: flameDelay, duration: 0.7, ease: 'easeOut' },
              },
            }}
          >
            <span className="grid h-full w-full place-items-center rounded-q bg-q-amber-soft">
              <Icon name="flame" className="h-8 w-8 fill-q-amber/60 text-q-amber-ink" />
            </span>
          </motion.span>
        </span>
        <div className="min-w-0">
          <p className="font-q-display text-xl font-semibold leading-tight text-q-ink sm:text-2xl">
            {labelWords.map((word, index) => (
              <Fragment key={index}>
                {index > 0 ? ' ' : null}
                <span className="whitespace-nowrap">{word}</span>
              </Fragment>
            ))}
          </p>
          <p className="mt-1 text-sm text-q-ink-soft">{view.real ? FEATURES.bestStreak(view.best) : calendar.caption}</p>
        </div>
      </div>

      <div role="img" aria-label={view.real ? label : `${calendar.caption}: ${label}`} className="mt-6 rounded-q-lg border border-q-border bg-q-surface p-4 sm:p-5">
        <div aria-hidden className="grid grid-cols-7 gap-2 text-center text-xs text-q-ink-soft">
          {view.weekdays.map((weekday, column) => (
            <span key={`${weekday}-${column}`}>{weekday}</span>
          ))}
        </div>
        <div aria-hidden className="mt-2 grid grid-cols-7 gap-2">
          {view.days.map((done, index) => (
            <span
              key={index}
              // Garis border-strong (≥ 3:1 terhadap kartu) supaya hari kosong tetap terlihat sebagai kisi. Untuk angka
              // pengguna sendiri, hari di luar streak digambar putus-putus: "tidak tercatat", bukan "tidak aktif".
              className={cn(
                'relative aspect-square rounded-full border border-q-border-strong',
                view.real ? 'border-dashed' : 'bg-q-muted',
                index === todayIndex ? 'outline outline-2 outline-offset-2 outline-q-amber-ink' : '',
              )}
            >
              {done ? (
                <motion.span variants={popIn} className="absolute -inset-px grid place-items-center rounded-full border border-q-amber-ink bg-q-amber text-q-on-amber">
                  <Check className="h-1/2 w-1/2" strokeWidth={3} />
                </motion.span>
              ) : null}
            </span>
          ))}
        </div>
        <div aria-hidden className="mt-4 flex items-center justify-center gap-5 text-xs text-q-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-q-amber-ink bg-q-amber" />
            {calendar.activeLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={cn('h-3 w-3 rounded-full border border-q-border-strong', view.real ? 'border-dashed' : 'bg-q-muted')} />
            {view.real ? calendar.unknownLabel : calendar.idleLabel}
          </span>
        </div>
      </div>
      {/* Kalender ini tidak ada di aplikasi (yang ada hanya angka streak): keterangannya selalu tampil. */}
      <SampleNote>
        <span data-testid="streak-note">{calendar.note}</span>
      </SampleNote>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Rank: bilah progres + tangga pangkat                                */
/* ------------------------------------------------------------------ */

function RankVisual({ glance }: { glance: TrackGlance | null }): JSX.Element {
  const { rank } = FEATURES.tabs;
  const real = glance !== null && glance.started;
  const xp = real ? glance.xp : rank.sample.xp;
  let rankIndex = 0;
  RANK_LADDER.forEach((step, index) => {
    if (xp >= step.minXp) rankIndex = index;
  });
  const current = RANK_LADDER[rankIndex];
  const next = RANK_LADDER[rankIndex + 1];
  const floor = current?.minXp ?? 0;
  const ratio = next ? Math.min(1, Math.max(0, (xp - floor) / (next.minXp - floor))) : 1;

  return (
    <motion.div initial="hidden" whileInView="show" viewport={viewportOnce} variants={staggerOf(0.06)} className="mx-auto w-full max-w-[420px]">
      <div className="rounded-q-lg border border-q-border bg-q-surface p-5">
        <div className="flex items-center gap-4">
          <span aria-hidden className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-q text-3xl leading-none', EMOJI_BASE)}>
            {current?.icon}
          </span>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-snug text-q-ink">{current?.title}</p>
            <p className="mt-0.5 text-sm tabular-nums text-q-amber-ink">
              {formatNumber(xp)} {FEATURES.xpUnit}
            </p>
          </div>
        </div>
        <div aria-hidden className="mt-5 h-3 overflow-hidden rounded-q-pill bg-q-muted">
          <motion.div
            className="h-full origin-left rounded-q-pill bg-q-primary"
            style={{ width: `${Math.max(ratio * 100, 3)}%` }}
            variants={{ hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 0.8, ease: 'easeOut', delay: 0.2 } } }}
          />
        </div>
        {next ? <p className="mt-2.5 text-sm text-q-ink-soft">{rank.nextLabel(Math.max(0, next.minXp - xp), next.title)}</p> : null}
      </div>

      <ol className="m-0 mt-5 grid list-none grid-cols-8 gap-1.5 p-0 sm:gap-2">
        {RANK_LADDER.map((step, index) => (
          <motion.li
            key={step.title}
            variants={popIn}
            title={step.title}
            className={cn(
              'grid aspect-square place-items-center rounded-q border text-base leading-none sm:text-xl',
              EMOJI_BASE,
              index < rankIndex ? 'border-q-primary/60' : '',
              index === rankIndex ? 'border-2 border-q-primary' : '',
              index > rankIndex ? 'border-dashed border-q-border-strong opacity-60 grayscale' : '',
            )}
          >
            <span aria-hidden>{step.icon}</span>
            <span className="sr-only">{step.title}</span>
          </motion.li>
        ))}
      </ol>
      {real ? null : <SampleNote>{FEATURES.sampleNote}</SampleNote>}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Misi & Boss: enam jenis misi                                        */
/* ------------------------------------------------------------------ */

/** Ikon tiap jenis misi, urut seperti FEATURES.tabs.missions.kinds. */
const KIND_ICONS: readonly IconName[] = ['database', 'bug', 'eye', 'shield-alert', 'book', 'crown'];

function MissionsVisual(): JSX.Element {
  const { kinds } = FEATURES.tabs.missions;
  return (
    <motion.ul
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      variants={staggerOf(0.06)}
      className="m-0 grid w-full list-none gap-3 p-0 sm:grid-cols-2"
    >
      {kinds.map((kind, index) => {
        const boss = index === kinds.length - 1;
        return (
          <motion.li
            key={kind.label}
            variants={riseIn}
            className={cn('flex items-start gap-3 rounded-q border p-4', boss ? 'border-q-amber/60 bg-q-amber-soft' : 'border-q-border bg-q-surface')}
          >
            <span
              aria-hidden
              className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-q', boss ? 'bg-q-amber text-q-on-amber' : 'bg-q-tint text-q-primary-ink')}
            >
              <Icon name={KIND_ICONS[index] ?? 'database'} className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className={cn('block text-[15px] font-bold leading-snug', boss ? 'text-q-amber-ink' : 'text-q-ink')}>{kind.label}</span>
              <span className={cn('mt-0.5 block text-[13px] leading-snug', boss ? 'text-q-amber-ink' : 'text-q-ink-soft')}>{kind.text}</span>
            </span>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}

/* ------------------------------------------------------------------ */
/* Lencana                                                             */
/* ------------------------------------------------------------------ */

function BadgesVisual(): JSX.Element {
  const { samples } = FEATURES.tabs.badges;
  return (
    <motion.ul
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      variants={staggerOf(0.07)}
      className="m-0 grid w-full list-none grid-cols-2 gap-x-3 gap-y-6 p-0 sm:grid-cols-3"
    >
      {samples.map((badge) => (
        <li key={badge.title} className="flex flex-col items-center text-center">
          <motion.span
            aria-hidden
            variants={popIn}
            className={cn('grid h-16 w-16 place-items-center rounded-full border-2 border-q-amber text-3xl leading-none shadow-[0_4px_0_0_rgb(var(--q-amber)/0.55)]', EMOJI_BASE)}
          >
            {badge.icon}
          </motion.span>
          <span className="mt-3.5 block text-sm font-bold leading-snug text-q-ink">{badge.title}</span>
          <span className="mt-1 block max-w-[20ch] text-xs leading-snug text-q-ink-soft">{badge.text}</span>
        </li>
      ))}
    </motion.ul>
  );
}

/* ------------------------------------------------------------------ */
/* Ujian: pilihan jumlah soal & batas waktu                            */
/* ------------------------------------------------------------------ */

/** Pilihan yang digambar "terpilih" pada ilustrasi (indeks pada daftar pilihan dari content.ts). */
const EXAM_PICK = { count: 1, minutes: 1 } as const;

function OptionRow({ label, options, picked }: { label: string; options: readonly string[]; picked: number }): JSX.Element {
  return (
    <div>
      <p className="text-sm text-q-ink-soft">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option, index) => (
          <motion.span
            key={option}
            variants={riseIn}
            className={cn(
              'inline-flex h-10 items-center gap-1.5 rounded-q border px-3.5 text-sm font-bold tabular-nums',
              index === picked ? 'border-q-primary bg-q-primary text-q-on-primary' : 'border-q-border-strong/70 bg-q-surface text-q-ink',
            )}
          >
            {index === picked ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
            {option}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function ExamVisual(): JSX.Element {
  const { exam } = FEATURES.tabs;
  const counts = EXAM_QUESTION_COUNTS.map((count) => String(count));
  const times = [...EXAM_MINUTE_OPTIONS.map((minutes) => exam.minutes(minutes)), exam.untimed];
  const pickedMinutes = EXAM_MINUTE_OPTIONS[EXAM_PICK.minutes] ?? EXAM_MINUTE_OPTIONS[0];
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      variants={staggerOf(0.05)}
      aria-hidden
      className="mx-auto flex w-full max-w-[420px] flex-col gap-5 rounded-q-lg border border-q-border bg-q-surface p-5 sm:p-6"
    >
      <OptionRow label={exam.countLabel} options={counts} picked={EXAM_PICK.count} />
      <OptionRow label={exam.timeLabel} options={times} picked={EXAM_PICK.minutes} />
      <motion.div variants={riseIn} className="flex items-center justify-between gap-4 rounded-q bg-q-muted px-4 py-3">
        <Icon name="timer" className="h-6 w-6 text-q-primary-ink" />
        <span className="font-q-display text-2xl font-semibold tabular-nums tracking-wide text-q-ink">{String(pickedMinutes).padStart(2, '0')}:00</span>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Latihan ulang: enam kotak Leitner                                   */
/* ------------------------------------------------------------------ */

function ReviewVisual(): JSX.Element {
  const { review } = FEATURES.tabs;
  const count = REVIEW_INTERVAL_DAYS.length;
  return (
    <motion.ol
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      variants={staggerOf(0.08)}
      className="m-0 mx-auto grid h-[280px] w-full max-w-[440px] list-none grid-cols-6 items-end gap-1.5 p-0 sm:gap-2.5"
    >
      {REVIEW_INTERVAL_DAYS.map((days, index) => (
        <li key={days} className="flex h-full min-w-0 flex-col justify-end text-center">
          <motion.span variants={riseIn} className="block text-xs font-bold leading-tight tabular-nums text-q-ink sm:text-sm">
            {review.dayLabel(days)}
          </motion.span>
          {/* Tinggi anak tangga hanya menunjukkan urutan kotak, bukan skala hari. */}
          <span aria-hidden className="mt-1.5 block" style={{ height: `${22 + (index / (count - 1)) * 48}%` }}>
            <motion.span
              variants={{ hidden: { scaleY: 0 }, show: { scaleY: 1, transition: spring } }}
              className="block h-full origin-bottom rounded-t-q border border-b-0 border-q-primary/50 bg-q-tint"
            />
          </span>
          <span className="block rounded-b-q bg-q-primary px-0.5 py-1.5 text-[10px] leading-tight text-q-on-primary sm:text-xs">{review.boxLabel(index + 1)}</span>
        </li>
      ))}
    </motion.ol>
  );
}

/* ------------------------------------------------------------------ */
/* Peta Kelemahan                                                      */
/* ------------------------------------------------------------------ */

function WeaknessVisual(): JSX.Element {
  const { samples, countLabel } = FEATURES.tabs.weakness;
  const max = Math.max(...samples.map((sample) => sample.count), 1);
  return (
    <div className="mx-auto w-full max-w-[420px]">
      <motion.ul
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        variants={staggerOf(0.09)}
        className="m-0 flex list-none flex-col gap-4 rounded-q-lg border border-q-border bg-q-surface p-5 sm:p-6"
      >
        {samples.map((sample) => (
          <li key={sample.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-bold text-q-ink">{sample.label}</span>
              <span className="shrink-0 tabular-nums text-q-ink-soft">{countLabel(sample.count)}</span>
            </div>
            <div aria-hidden className="mt-1.5 h-2.5">
              <motion.div
                variants={{ hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 0.6, ease: 'easeOut' } } }}
                className="h-full origin-left rounded-r-[4px] bg-q-coral"
                style={{ width: `${(sample.count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </motion.ul>
      <SampleNote>{FEATURES.sampleNote}</SampleNote>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

function FeatureVisual({ id, glance }: { id: FeatureTabId; glance: TrackGlance | null }): JSX.Element {
  switch (id) {
    case 'streak':
      return <StreakVisual glance={glance} />;
    case 'rank':
      return <RankVisual glance={glance} />;
    case 'missions':
      return <MissionsVisual />;
    case 'badges':
      return <BadgesVisual />;
    case 'exam':
      return <ExamVisual />;
    case 'review':
      return <ReviewVisual />;
    case 'weakness':
      return <WeaknessVisual />;
  }
}

function FeaturePanel({ id, glance }: { id: FeatureTabId; glance: TrackGlance | null }): JSX.Element {
  const tab = FEATURES.tabs[id];
  return (
    <Card radius="lg" padding="none" shadow="float" className="grid overflow-hidden lg:min-h-[440px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col justify-center gap-4 p-6 sm:p-10">
        <h3 className="text-balance text-[26px] font-bold leading-tight text-q-ink sm:text-[30px]">{tab.title}</h3>
        <p className="max-w-[46ch] text-pretty text-base leading-relaxed text-q-ink-soft">{tab.body}</p>
        {id === 'exam' ? <p className="max-w-[46ch] text-pretty text-sm leading-relaxed text-q-ink-soft">{FEATURES.tabs.exam.note}</p> : null}
      </div>
      <div className="flex items-center border-t border-q-border bg-q-muted p-5 sm:p-10 lg:border-l lg:border-t-0">
        <FeatureVisual id={id} glance={glance} />
      </div>
    </Card>
  );
}

export function Gamification({ glance }: GamificationProps): JSX.Element {
  const headingId = useId();
  return (
    <Section id={SECTION_IDS.features} labelledBy={headingId}>
      <Reveal>
        <SectionHeading id={headingId} title={FEATURES.title} lead={FEATURES.lead} />
      </Reveal>
      <Reveal delay={0.1} className="mt-10">
        <Tabs items={TAB_ITEMS} ariaLabel={FEATURES.tabsLabel} panelClassName="mt-8">
          {(value) => <FeaturePanel id={value} glance={glance} />}
        </Tabs>
      </Reveal>
    </Section>
  );
}
