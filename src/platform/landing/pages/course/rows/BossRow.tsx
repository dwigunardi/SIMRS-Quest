/**
 * C6d — "Taklukkan 10 Boss": daftar Boss ASLI (satu per tier, dari silabus yang dibangun dari kurikulum) dengan status
 * dari progres di browser ini (courses/progress.ts → bossStates; aturan yang sama dengan aplikasi). Tanpa progres
 * semuanya "Terkunci" — itu memang status sebenarnya. Keterangan sumber status (`bosses.note`) selalu tampil.
 *
 * Saat progres berubah (misi diselesaikan di tab lain), kartu & pill status berpindah dengan layout animation.
 */
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Check, Crown, Lock, Swords, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { BossState, CourseProgress } from '../../../courses/progress';
import type { AvailableCourse, SyllabusMission, SyllabusTier } from '../../../courses/types';
import { cn } from '../../../lib/cn';
import { crossfade, spring } from '../../../lib/motion';
import { Pill, type PillTone } from '../../../ui/Pill';
import { FeatureRow, RowNote } from './FeatureRow';

const STATE_STYLE: Record<BossState, { tone: PillTone; Icon: LucideIcon }> = {
  done: { tone: 'success', Icon: Check },
  open: { tone: 'amber', Icon: Swords },
  locked: { tone: 'neutral', Icon: Lock },
};

/** Urutan legenda. */
const STATES: readonly BossState[] = ['done', 'open', 'locked'];

/** "Boss: Tutup Shift Malam" → { prefix: "Boss", name: "Tutup Shift Malam" }. */
function splitTitle(title: string): { prefix: string | null; name: string } {
  const match = /^((?:Final\s+)?Boss):\s*(.+)$/i.exec(title);
  return match ? { prefix: match[1] ?? null, name: match[2] ?? title } : { prefix: null, name: title };
}

interface BossEntry {
  tier: SyllabusTier;
  boss: SyllabusMission;
}

/** Pill status yang berganti dengan crossfade saat statusnya berubah. */
function StatePill({ state, labels, className }: { state: BossState; labels: Record<BossState, string>; className?: string }): JSX.Element {
  const style = STATE_STYLE[state];
  return (
    <motion.span layout="position" className={cn('shrink-0', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={state} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={crossfade} className="block">
          <Pill size="sm" tone={style.tone} icon={<style.Icon aria-hidden className="h-3 w-3" strokeWidth={2.5} />}>
            {labels[state]}
          </Pill>
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

function numberTone(final: boolean, state: BossState): string {
  if (final) return 'bg-q-amber text-q-on-amber';
  return state === 'done' ? 'bg-q-primary text-q-on-primary' : 'bg-q-muted text-q-ink-soft';
}

/**
 * Satu Boss. Ponsel: ubin ringkas (nomor + status di atas, nama di bawah) dalam dua kolom; Final Boss selebar penuh.
 * Mulai sm: nomor di kiri, label tier + status di atas nama. Salinan pill yang tidak tampil disembunyikan (display:none),
 * jadi pembaca layar hanya membaca satu.
 */
function BossItem({ entry, state, labels, final }: { entry: BossEntry; state: BossState; labels: Record<BossState, string>; final: boolean }): JSX.Element {
  const { prefix, name } = splitTitle(entry.boss.title);
  return (
    <motion.li
      layout
      transition={spring}
      data-boss={entry.boss.id}
      data-state={state}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-q border p-2.5 sm:flex-row sm:items-start sm:gap-3 sm:p-3',
        final ? 'col-span-2 border-q-amber/60 bg-q-amber-soft sm:col-span-1' : 'border-q-border bg-q-surface',
        state === 'locked' ? '' : 'shadow-q-pop',
      )}
    >
      <span className="flex items-center justify-between gap-2 sm:block">
        <span aria-hidden className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-q text-sm font-bold tabular-nums sm:h-9 sm:w-9', numberTone(final, state))}>
          {final ? <Crown className="h-[18px] w-[18px]" /> : entry.tier.tier}
        </span>
        <StatePill state={state} labels={labels} className="sm:hidden" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          {/* Ponsel: nomor ubin sudah menyebut tier-nya — labelnya hanya untuk pembaca layar, ubin jadi lebih pendek. */}
          <span className={cn('min-w-0 truncate text-xs max-sm:sr-only', final ? 'text-q-amber-ink' : 'text-q-ink-soft')}>
            {entry.tier.label}
            {prefix !== null ? ` · ${prefix}` : ''}
          </span>
          <StatePill state={state} labels={labels} className="hidden sm:block" />
        </span>
        <span className="block text-pretty text-[15px] font-bold leading-snug text-q-ink sm:mt-1">{name}</span>
      </span>
    </motion.li>
  );
}

export function BossRow({ course, progress }: { course: AvailableCourse; progress: CourseProgress }): JSX.Element {
  const { bosses } = course.rows;
  const entries: BossEntry[] = course.syllabus.tiers.flatMap((tier) => (tier.boss ? [{ tier, boss: tier.boss }] : []));
  const stateOf = (id: string): BossState => progress.bossStates[id] ?? 'locked';
  const counts = STATES.map((state) => ({ state, count: entries.filter((entry) => stateOf(entry.boss.id) === state).length }));
  const rows = Math.ceil(entries.length / 2);
  return (
    <FeatureRow
      name="bosses"
      flip
      band
      title={bosses.title}
      lead={bosses.lead}
      extra={
        <p className="m-0 flex max-w-[52ch] items-start gap-2.5 text-[15px] leading-relaxed text-q-ink">
          <Crown aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-q-amber-ink" />
          {bosses.rule}
        </p>
      }
      visual={
        <div>
          <div className="rounded-q-lg border border-q-border bg-q-muted p-3 sm:p-4">
            <ul className="m-0 mb-3 flex list-none flex-wrap gap-2 p-0 sm:mb-4">
              {counts.map(({ state, count }) => {
                const style = STATE_STYLE[state];
                return (
                  <li key={state}>
                    <Pill size="sm" tone="surface" icon={<style.Icon aria-hidden className="h-3 w-3" strokeWidth={2.5} />}>
                      {bosses.status[state]}{' '}
                      <span className="font-bold tabular-nums">{count}</span>
                    </Pill>
                  </li>
                );
              })}
            </ul>
            <LayoutGroup>
              {/* Ponsel: dua kolom ubin ringkas (urut baris); mulai sm: dua kolom urut ke bawah. Final Boss selebar penuh. */}
              <ol
                className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-flow-col sm:grid-rows-[repeat(var(--q-rows),minmax(0,auto))]"
                style={{ '--q-rows': rows } as CSSProperties}
              >
                {entries.map((entry, index) => (
                  <BossItem key={entry.boss.id} entry={entry} state={stateOf(entry.boss.id)} labels={bosses.status} final={index === entries.length - 1} />
                ))}
              </ol>
            </LayoutGroup>
          </div>
          <RowNote testId="bosses-note">{bosses.note}</RowNote>
        </div>
      }
    />
  );
}
