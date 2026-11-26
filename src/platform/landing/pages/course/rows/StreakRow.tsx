/**
 * C6b — "Bangun streak-mu" (latar mint): kalender bulan berjalan + dua kartu kecil (Rekor terbaik, Hari ini sudah
 * dihitung?).
 *
 * Kejujuran: aplikasi hanya menyimpan angka streak, rekor terbaik, dan tanggal aktif terakhir — BUKAN riwayat per hari.
 * Karena itu yang ditandai di kalender hanya hari-hari streak yang sedang berjalan (berakhir hari ini atau kemarin);
 * hari lain sebelum hari ini diberi isian tipis "tidak tercatat", bukan "tidak aktif". Angka asli dipakai bila ada
 * progres di browser ini (streak 0 → judul ajakan `zeroTitle`, bukan "0 hari"); selain itu contoh dari data
 * (`streak.sample`) dengan keterangan `sampleNote`. Keterangan `streak.note` selalu tampil (digabung dengan `sampleNote`
 * bila angkanya contoh). Hanya membaca progres (props), tidak pernah menulis.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Check, Clock, Flame, Trophy } from 'lucide-react';
import type { CourseProgress } from '../../../courses/progress';
import type { AvailableCourse } from '../../../courses/types';
import { cn } from '../../../lib/cn';
import { FEATURES } from '../../../lib/content';
import { spring, viewportOnce } from '../../../lib/motion';
import { FeatureRow, RowNote } from './FeatureRow';

type Streak = AvailableCourse['rows']['streak'];

interface StreakView {
  /** true = angka pengguna sendiri. */
  real: boolean;
  current: number;
  best: number;
  activeToday: boolean;
}

function viewOf(streak: Streak, progress: CourseProgress): StreakView {
  const real = progress.started || progress.streak.best > 0;
  if (!real) return { real, current: streak.sample.current, best: streak.sample.best, activeToday: streak.sample.activeToday };
  return { real, current: progress.streak.active, best: progress.streak.best, activeToday: progress.streak.activeToday };
}

type DayState = 'active' | 'unknown' | 'future';

interface CalendarDay {
  day: number;
  state: DayState;
  today: boolean;
}

/** Hari-hari bulan berjalan (Senin di kolom pertama) + kosong di depan. */
function buildMonth(now: Date, view: StreakView): { blanks: number; days: CalendarDay[] } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const length = new Date(year, month + 1, 0).getDate();
  const blanks = (new Date(year, month, 1).getDay() + 6) % 7;
  // Streak hidup berakhir hari ini (sudah aktif) atau kemarin.
  const end = view.current > 0 ? (view.activeToday ? today : today - 1) : 0;
  const start = end - view.current + 1;
  const days = Array.from({ length }, (_, index): CalendarDay => {
    const day = index + 1;
    let state: DayState = 'unknown';
    if (day > today) state = 'future';
    else if (view.current > 0 && day >= start && day <= end) state = 'active';
    return { day, state, today: day === today };
  });
  return { blanks, days };
}

const grid: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.03, delayChildren: 0.15 } } };
const pop: Variants = { hidden: { opacity: 0, scale: 0.4 }, show: { opacity: 1, scale: 1, transition: spring } };

function Calendar({ streak, view, now }: { streak: Streak; view: StreakView; now: Date }): JSX.Element {
  const monthLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const { blanks, days } = useMemo(() => buildMonth(now, view), [now, view]);
  const caption = streak.calendarCaption(monthLabel);
  // Progres asli dengan streak 0 (putus/belum pernah aktif): ajakan memulai, bukan "0 hari berturut-turut".
  const streakLabel = view.real && view.current === 0 ? streak.zeroTitle : FEATURES.tabs.streak.calendar.streakLabel(view.current);
  return (
    <figure className="m-0 rounded-q-lg border border-q-border bg-q-surface p-4 shadow-q-float sm:p-6">
      <figcaption className="flex items-center gap-3">
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-q bg-q-amber-soft text-q-amber-ink">
          <Flame className="h-6 w-6 fill-q-amber/50" />
        </span>
        <span className="min-w-0">
          {/* Varela Round + angka tabular: Orbitron menggambar nol bergaris miring ("Ø"). */}
          <span className="block font-q-body text-lg font-bold leading-tight tabular-nums text-q-ink sm:text-xl" data-testid="streak-title">
            {streakLabel}
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-q-ink-soft">{caption}</span>
        </span>
      </figcaption>

      <div role="img" aria-label={`${caption}: ${streakLabel}`} className="mt-5">
        <div aria-hidden className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-q-ink-soft sm:gap-2 sm:text-xs">
          {streak.weekdays.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <motion.div aria-hidden initial="hidden" whileInView="show" viewport={viewportOnce} variants={grid} className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: blanks }, (_, index) => (
            <span key={`blank-${index}`} />
          ))}
          {days.map((day) => (
            <span
              key={day.day}
              className={cn(
                'relative grid aspect-square place-items-center rounded-full text-[11px] tabular-nums text-q-ink-soft sm:text-xs',
                // Hari lalu yang tidak tercatat: isian tipis tanpa garis (tidak lebih ramai dari hari aktif); hari depan polos.
                day.state === 'unknown' ? 'bg-q-muted' : '',
                day.state === 'future' ? 'opacity-60' : '',
                day.today ? 'outline outline-2 outline-offset-2 outline-q-amber-ink' : '',
              )}
            >
              {day.day}
              {day.state === 'active' ? (
                <motion.span variants={pop} className="absolute inset-0 grid place-items-center rounded-full border border-q-amber-ink bg-q-amber font-bold text-q-on-amber">
                  {day.day}
                </motion.span>
              ) : null}
            </span>
          ))}
        </motion.div>
        <div aria-hidden className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-q-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-q-amber-ink bg-q-amber" />
            {streak.activeLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-q-muted ring-1 ring-q-border" />
            {streak.unknownLabel}
          </span>
        </div>
      </div>
    </figure>
  );
}

/** Warna ikon kartu kecil: hijau = tercapai, amber = belum (bukan silang hijau). */
const CARD_TONE = {
  primary: 'bg-q-tint text-q-primary-ink',
  success: 'bg-q-success-soft text-q-success-ink',
  amber: 'bg-q-amber-soft text-q-amber-ink',
} as const;

function SmallCard({ label, children, icon, tone, testId }: { label: string; children: ReactNode; icon: ReactNode; tone: keyof typeof CARD_TONE; testId?: string }): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-q-lg border border-q-border bg-q-surface p-4" data-testid={testId} data-tone={tone}>
      <span aria-hidden className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-q', CARD_TONE[tone])}>
        {icon}
      </span>
      <dl className="m-0 min-w-0">
        <dt className="text-[13px] leading-snug text-q-ink-soft">{label}</dt>
        <dd className="m-0 mt-0.5 text-lg font-bold leading-tight text-q-ink">{children}</dd>
      </dl>
    </div>
  );
}

export function StreakRow({ course, progress }: { course: AvailableCourse; progress: CourseProgress }): JSX.Element {
  const { streak } = course.rows;
  // Tanggal dibaca sekali per tampilan (kalender tidak berganti hari di tengah jalan).
  const [now] = useState(() => new Date());
  const view = useMemo(() => viewOf(streak, progress), [streak, progress]);
  return (
    <FeatureRow
      name="streak"
      band
      flip
      title={streak.title}
      lead={streak.lead}
      visual={
        <div className="mx-auto w-full max-w-[460px]">
          <Calendar streak={streak} view={view} now={now} />
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <SmallCard label={streak.best.label} tone="primary" icon={<Trophy className="h-5 w-5" />} testId="streak-best">
              {view.best > 0 ? streak.best.value(view.best) : streak.best.empty}
            </SmallCard>
            <SmallCard
              label={streak.today.label}
              tone={view.activeToday ? 'success' : 'amber'}
              icon={view.activeToday ? <Check className="h-5 w-5" strokeWidth={3} /> : <Clock className="h-5 w-5" strokeWidth={2.5} />}
              testId="streak-today"
            >
              {view.activeToday ? streak.today.yes : streak.today.no}
            </SmallCard>
          </div>
          {/* Satu keterangan: kalender selalu ilustrasi; tanpa progres, angkanya juga contoh. */}
          <RowNote testId="streak-calendar-note">{view.real ? streak.note : `${streak.sampleNote} ${streak.note}`}</RowNote>
        </div>
      }
    />
  );
}
