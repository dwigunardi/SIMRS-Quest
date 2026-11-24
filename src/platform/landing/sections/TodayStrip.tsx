/**
 * "Hari ini" — HANYA untuk pengguna lama, tepat di bawah tombol "Lanjutkan" (di ATAS bola dunia) supaya masuk lipatan
 * pertama: ringkasan kemajuan (pangkat, XP, misi selesai), sesi ujian/latihan yang masih berjalan (dengan jam mundur
 * hidup), latihan ulang yang jatuh tempo, saran dari Peta Kelemahan, dan keadaan streak. Bila tidak ada satu pun butir,
 * cukup satu kalimat tenang.
 *
 * Komponen ini tidak membaca storage: semua datang dari `glance`. Lebar & jaraknya diatur pemanggil lewat className.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { TrackGlance } from '../../tracks';
import { Mascot } from '../illustrations/Mascot';
import { cn } from '../lib/cn';
import { ROUTES, TODAY, TRACKS, type IconName } from '../lib/content';
import { Button3D } from '../ui/Button3D';
import { Icon } from '../ui/Icon';

export interface TodayStripProps {
  glance: TrackGlance;
  /** Lebar & jarak dari pemanggil. */
  className?: string;
}

const TRACK_TITLE = TRACKS.find((track) => track.status === 'tersedia')?.title ?? '';

const TITLE_ID = 'today-title';

/** Ada butir yang layak ditampilkan? */
export function hasTodayItems(glance: TrackGlance): boolean {
  return glance.exam !== null || glance.reviewDue > 0 || glance.weakness !== null || glance.streak.active > 0;
}

/** Sisa waktu "12:34" (atau "1:02:03" bila lebih dari satu jam); tidak pernah negatif. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Sisa waktu (ms) menuju `deadline`, diperbarui dua kali per detik; null bila tanpa batas waktu. */
function useRemaining(deadline: string | null): number | null {
  const due = deadline === null ? Number.NaN : Date.parse(deadline);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Number.isNaN(due)) return undefined;
    let timer = 0;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      // Waktu habis: jam berhenti berdetak (tidak ada lagi yang berubah sampai sesinya dikumpulkan).
      if (current >= due) window.clearInterval(timer);
    };
    // Lebih rapat dari satu detik supaya angka tidak tampak melompat dua detik.
    timer = window.setInterval(tick, 500);
    tick();
    return () => window.clearInterval(timer);
  }, [due]);
  return Number.isNaN(due) ? null : Math.max(0, due - now);
}

type Tone = 'amber' | 'coral' | 'primary' | 'brand' | 'muted';

// Kelas ditulis utuh per warna supaya terbaca pemindai Tailwind.
const TILE: Record<Tone, string> = {
  amber: 'border-q-amber/50 bg-q-amber-soft text-q-amber-ink',
  coral: 'border-q-coral/40 bg-q-coral-soft text-q-coral-ink',
  primary: 'border-q-primary/30 bg-q-tint text-q-primary-ink',
  brand: 'border-q-brand/40 bg-q-tint text-q-brand-ink',
  muted: 'border-q-border bg-q-muted text-q-ink-soft',
};

interface ItemProps {
  testId: string;
  icon: IconName;
  tone: Tone;
  title: ReactNode;
  detail: ReactNode;
  /** Di kanan butir (mis. jam mundur). */
  aside?: ReactNode;
  action?: ReactNode;
}

function Item({ testId, icon, tone, title, detail, aside, action }: ItemProps): JSX.Element {
  return (
    <li className="flex min-w-0 gap-3.5 py-4 first:pt-0 last:pb-0 sm:py-0" data-testid={testId}>
      <span aria-hidden className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-q border-2', TILE[tone])}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p className="m-0 text-pretty text-[15px] font-bold leading-snug text-q-ink">{title}</p>
        <p className="m-0 text-pretty text-sm leading-relaxed text-q-ink-soft">{detail}</p>
        {action !== undefined ? <div className="mt-2 pb-1">{action}</div> : null}
      </div>
      {aside}
    </li>
  );
}

function ExamItem({ exam }: { exam: NonNullable<TrackGlance['exam']> }): JSX.Element {
  const remaining = useRemaining(exam.deadline);
  const expired = remaining !== null && remaining <= 0;
  const purpose = exam.purpose;
  const answered = TODAY.exam.answered(exam.answered, exam.total);

  return (
    <Item
      testId="today-exam"
      icon={purpose === 'exam' ? 'clipboard-check' : 'repeat'}
      tone={expired ? 'coral' : 'amber'}
      title={expired ? TODAY.exam.waiting[purpose] : TODAY.exam.running[purpose]}
      detail={expired ? TODAY.exam.expired : remaining === null ? `${answered} · ${TODAY.exam.noLimit.toLowerCase()}` : answered}
      aside={
        remaining !== null && !expired ? (
          <span className="flex shrink-0 flex-col items-end leading-none">
            <span className="text-[11px] text-q-ink-soft">{TODAY.exam.remaining}</span>
            <span role="timer" aria-live="off" className="mt-1 font-mono text-xl font-bold tabular-nums text-q-amber-ink" data-testid="today-exam-clock">
              {formatCountdown(remaining)}
            </span>
          </span>
        ) : undefined
      }
      action={
        <Button3D href={ROUTES.exam} size="sm" variant={expired ? 'primary' : 'outline'} data-testid="today-exam-go">
          {TODAY.exam.back[purpose]}
        </Button3D>
      }
    />
  );
}

// Jumlah kolom mengikuti banyaknya butir, supaya tidak ada kuadran kosong: tiga butir = tiga kolom di layar lebar.
const COLUMNS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2' };

/** Pangkat, XP, dan misi selesai (dengan bilah kemajuan aksesibel) — yang dulu ada di puncak Beranda lama. */
function Summary({ glance }: { glance: TrackGlance }): JSX.Element {
  const ratio = glance.total > 0 ? Math.min(1, glance.completed / glance.total) : 0;
  const missions = TODAY.summary.missions(glance.completed, glance.total);
  return (
    <div className="flex w-full min-w-0 items-center gap-3 sm:ml-auto sm:w-auto" data-testid="today-summary">
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-q bg-q-emoji-base text-xl leading-none">
        {glance.rank.icon}
      </span>
      <div className="min-w-0 flex-1 sm:flex-none">
        <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm leading-snug">
          <span className="font-bold text-q-ink" data-testid="today-rank">
            {glance.rank.title}
          </span>
          <span className="tabular-nums text-q-amber-ink" data-testid="today-xp">
            {TODAY.summary.xp(glance.xp)}
          </span>
        </p>
        <div className="mt-1.5 flex items-center gap-2.5">
          <div
            role="progressbar"
            aria-label={TODAY.summary.progressLabel(TRACK_TITLE)}
            aria-valuemin={0}
            aria-valuemax={glance.total}
            aria-valuenow={glance.completed}
            aria-valuetext={missions}
            className="h-2 min-w-[96px] flex-1 overflow-hidden rounded-q-pill bg-q-muted ring-1 ring-inset ring-q-border-strong/40 sm:w-36 sm:flex-none"
            data-testid="today-progress"
          >
            <div className="h-full rounded-q-pill bg-q-primary" style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 3 : 0)}%` }} />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-q-ink-soft">{missions}</span>
        </div>
      </div>
    </div>
  );
}

export function TodayStrip({ glance, className }: TodayStripProps): JSX.Element | null {
  const { exam, reviewDue, weakness, streak } = glance;
  const any = hasTodayItems(glance);
  // Pengguna baru tanpa apa pun yang perlu ditampilkan: bagian ini tidak ada.
  if (!glance.started && !any) return null;

  const count = Number(exam !== null) + Number(reviewDue > 0) + Number(weakness !== null) + Number(streak.active > 0);

  return (
    <section aria-labelledby={TITLE_ID} className={cn('relative z-10 text-left', className)} data-testid="home-today">
      <div className="flex flex-col gap-5 rounded-q-lg border border-q-border bg-q-surface p-5 shadow-q-float sm:p-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-4">
          <Mascot pose="point" expression={any ? 'smile' : 'wink'} title={TODAY.mascotLabel} className="w-11 shrink-0" />
          <h2 id={TITLE_ID} className="m-0 text-q-h3 font-bold text-q-ink">
            {TODAY.title}
          </h2>
          {glance.started ? <Summary glance={glance} /> : null}
        </div>

        <div className="border-t border-q-border pt-5">
          {any ? (
            <ul className={cn('m-0 grid min-w-0 list-none grid-cols-1 divide-y divide-q-border p-0 sm:gap-x-8 sm:gap-y-6 sm:divide-y-0', COLUMNS[count] ?? 'sm:grid-cols-2')}>
              {exam ? <ExamItem exam={exam} /> : null}
              {reviewDue > 0 ? (
                <Item
                  testId="today-review"
                  icon="repeat"
                  tone="brand"
                  title={TODAY.review.title(reviewDue)}
                  detail={exam ? TODAY.review.blocked : TODAY.review.detail}
                  action={
                    exam ? undefined : (
                      <Button3D href={ROUTES.exam} size="sm" variant="outline" data-testid="today-review-go">
                        {TODAY.review.cta}
                      </Button3D>
                    )
                  }
                />
              ) : null}
              {weakness ? (
                <Item
                  testId="today-weakness"
                  icon="radar"
                  tone="coral"
                  title={TODAY.weakness.title(weakness.label, weakness.count)}
                  detail={TODAY.weakness.detail}
                  action={
                    <Button3D href={ROUTES.progress} size="sm" variant="outline" data-testid="today-weakness-go">
                      {TODAY.weakness.cta}
                    </Button3D>
                  }
                />
              ) : null}
              {streak.active > 0 ? (
                <Item
                  testId="today-streak"
                  icon="flame"
                  tone={streak.activeToday ? 'amber' : 'muted'}
                  title={
                    <>
                      {TODAY.streak.title(streak.active)}
                      <span className="font-normal text-q-ink-soft">, {(streak.activeToday ? TODAY.streak.doneToday : TODAY.streak.notYet).toLowerCase()}</span>
                    </>
                  }
                  detail={streak.activeToday ? TODAY.streak.doneDetail(streak.best) : TODAY.streak.notYetDetail}
                />
              ) : null}
            </ul>
          ) : (
            <p className="m-0 text-pretty text-base leading-relaxed text-q-ink-soft" data-testid="today-empty">
              {TODAY.empty}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
