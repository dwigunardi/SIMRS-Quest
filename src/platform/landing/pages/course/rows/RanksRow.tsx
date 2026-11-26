/**
 * C6f — "Naik pangkat & kumpulkan lencana": kartu pangkat bergaya tanda pengenal pegawai rumah sakit (tangga pangkat
 * sungguhan, RANK_LADDER) yang miring 3D halus mengikuti penunjuk saat disorot, plus kartu lencana (contoh lencana
 * yang memang ada di aplikasi). Aplikasi ini tidak menerbitkan dokumen tanda tamat apa pun — yang ada pangkat & lencana.
 *
 * Angka: XP asli pengguna bila sudah mulai (usePageStatus → glance), selain itu contoh FEATURES.tabs.rank.sample dengan
 * keterangan. Efek miring hanya untuk penunjuk mouse dan mati saat gerak dikurangi / "Jeda animasi" (hanya transform).
 */
import { useEffect, type PointerEvent } from 'react';
import { motion, useSpring, type MotionValue } from 'framer-motion';
import { Zap } from 'lucide-react';
import type { AvailableCourse } from '../../../courses/types';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { usePageStatus } from '../../../layout/pageStatus';
import { cn } from '../../../lib/cn';
import { FEATURES, RANK_COUNT, RANK_LADDER, formatNumber } from '../../../lib/content';
import { Button3D } from '../../../ui/Button3D';
import { FeatureRow, RowNote } from './FeatureRow';

type Ranks = AvailableCourse['rows']['ranks'];

/** Kemiringan maksimum (derajat) di tepi kartu. */
const TILT = { x: 8, y: 10 } as const;
const TILT_SPRING = { stiffness: 180, damping: 18, mass: 0.6 } as const;

function useTilt(): {
  style: { rotateX: MotionValue<number>; rotateY: MotionValue<number>; transformPerspective: number };
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
} {
  const reduced = usePrefersReducedMotion();
  const rotateX = useSpring(0, TILT_SPRING);
  const rotateY = useSpring(0, TILT_SPRING);
  useEffect(() => {
    if (reduced) {
      rotateX.jump(0);
      rotateY.jump(0);
    }
  }, [reduced, rotateX, rotateY]);
  return {
    style: { rotateX, rotateY, transformPerspective: 900 },
    onPointerMove: (event) => {
      if (reduced || event.pointerType !== 'mouse') return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
      const y = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
      rotateY.set(x * 2 * TILT.y);
      rotateX.set(-y * 2 * TILT.x);
    },
    onPointerLeave: () => {
      rotateX.set(0);
      rotateY.set(0);
    },
  };
}

function rankIndexOf(xp: number): number {
  let index = 0;
  RANK_LADDER.forEach((step, position) => {
    if (xp >= step.minXp) index = position;
  });
  return index;
}

function RankCard({ ranks, xp }: { ranks: Ranks; xp: number }): JSX.Element {
  const tilt = useTilt();
  const index = rankIndexOf(xp);
  const current = RANK_LADDER[index];
  const next = RANK_LADDER[index + 1];
  const floor = current?.minXp ?? 0;
  const ratio = next ? Math.min(1, Math.max(0, (xp - floor) / (next.minXp - floor))) : 1;
  return (
    <div className="relative mx-auto w-full max-w-[300px] pt-10">
      {/* tali */}
      <span aria-hidden className="absolute left-1/2 top-0 h-16 w-4 -translate-x-1/2 rounded-t-sm bg-q-border-strong" />
      <motion.figure
        style={tilt.style}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
        className="relative m-0 overflow-hidden rounded-q-lg border border-q-border bg-q-surface text-center shadow-q-float"
      >
        <span aria-hidden className="relative block h-16 bg-q-primary">
          <span className="absolute left-1/2 top-3 h-2.5 w-11 -translate-x-1/2 rounded-q-pill bg-q-border-strong ring-2 ring-q-surface" />
        </span>
        <span aria-hidden className="relative mx-auto -mt-10 grid h-20 w-20 place-items-center rounded-full border-4 border-q-surface bg-q-emoji-base text-4xl leading-none">
          {current?.icon}
        </span>
        <figcaption className="px-6 pb-6 pt-3">
          <span className="block text-xs tabular-nums text-q-ink-soft">
            {ranks.cardLabel} {index + 1}/{RANK_COUNT}
          </span>
          <span className="mt-1 block text-balance text-lg font-bold leading-snug text-q-ink">{current?.title}</span>
          <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold tabular-nums text-q-amber-ink">
            <Zap aria-hidden className="h-4 w-4" />
            {formatNumber(xp)} {FEATURES.xpUnit}
          </span>
          <span aria-hidden className="mt-4 block h-2.5 overflow-hidden rounded-q-pill bg-q-muted">
            <motion.span
              className="block h-full origin-left rounded-q-pill bg-q-primary"
              style={{ width: `${Math.max(ratio * 100, 3)}%` }}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            />
          </span>
          {next ? <span className="mt-2 block text-[13px] leading-snug text-q-ink-soft">{FEATURES.tabs.rank.nextLabel(Math.max(0, next.minXp - xp), next.title)}</span> : null}
          <ol className="m-0 mt-5 grid list-none grid-cols-8 gap-1 p-0">
            {RANK_LADDER.map((step, position) => (
              <li
                key={step.title}
                title={step.title}
                className={cn(
                  'grid aspect-square place-items-center rounded-lg border bg-q-emoji-base text-sm leading-none',
                  position < index ? 'border-q-primary/60' : '',
                  position === index ? 'border-2 border-q-primary' : '',
                  position > index ? 'border-dashed border-q-border-strong opacity-60 grayscale' : '',
                )}
              >
                <span aria-hidden>{step.icon}</span>
                <span className="sr-only">{step.title}</span>
              </li>
            ))}
          </ol>
        </figcaption>
      </motion.figure>
    </div>
  );
}

function BadgesCard({ ranks }: { ranks: Ranks }): JSX.Element {
  const { badges } = FEATURES.tabs;
  return (
    <div className="rounded-q-lg border border-q-border bg-q-surface p-5 shadow-q-float sm:rotate-2">
      <p className="m-0 flex items-baseline justify-between gap-3">
        <span className="text-base font-bold text-q-ink">{ranks.badgesLabel}</span>
        <span className="text-sm tabular-nums text-q-amber-ink">{badges.title}</span>
      </p>
      <p className="m-0 mt-1 text-[13px] leading-snug text-q-ink-soft">{badges.body}</p>
      <ul className="m-0 mt-4 grid list-none grid-cols-3 gap-x-2 gap-y-4 p-0">
        {badges.samples.map((badge) => (
          <li key={badge.title} className="flex flex-col items-center text-center">
            <span aria-hidden className="grid h-12 w-12 place-items-center rounded-full border-2 border-q-amber bg-q-emoji-base text-2xl leading-none">
              {badge.icon}
            </span>
            <span className="mt-2 block text-[12px] font-bold leading-tight text-q-ink">{badge.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RanksRow({ course }: { course: AvailableCourse }): JSX.Element {
  const { ranks } = course.rows;
  const { glance } = usePageStatus();
  const real = glance !== null && glance.started;
  const xp = real ? glance.xp : FEATURES.tabs.rank.sample.xp;
  return (
    <FeatureRow
      name="ranks"
      flip
      title={ranks.title}
      lead={ranks.lead}
      extra={
        <div className="pb-1 pt-2">
          <Button3D href={ranks.link.href} variant="outline">
            {ranks.link.label}
          </Button3D>
        </div>
      }
      visual={
        <div>
          <div className="grid items-center gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6">
            <RankCard ranks={ranks} xp={xp} />
            <BadgesCard ranks={ranks} />
          </div>
          {real ? null : <RowNote testId="ranks-sample-note">{FEATURES.sampleNote}</RowNote>}
        </div>
      }
    />
  );
}
