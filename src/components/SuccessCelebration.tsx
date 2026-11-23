import type { ReactNode } from 'react';
import { ArrowRight, CircleCheck, Flame, PartyPopper, Sparkles, Trophy } from 'lucide-react';
import type { CompletionSummary } from '../types';

/* ------------------------------------------------------------------ */
/* Kartu perayaan saat misi (jenis apa pun) diselesaikan               */
/* ------------------------------------------------------------------ */

const SPARKLES: { emoji: string; className: string; delay: string }[] = [
  { emoji: '✨', className: 'left-[8%] top-3', delay: '0ms' },
  { emoji: '🎉', className: 'left-[22%] top-8', delay: '150ms' },
  { emoji: '⭐', className: 'right-[24%] top-2', delay: '80ms' },
  { emoji: '💚', className: 'right-[10%] top-9', delay: '220ms' },
  { emoji: '✨', className: 'left-[45%] top-1', delay: '300ms' },
];

function XpLine({ completion }: { completion: CompletionSummary }): JSX.Element {
  if (!completion.firstCompletion) {
    return <p className="text-xs text-slate-400">Misi ini sudah pernah kamu selesaikan — tidak ada XP tambahan, tapi latihan ulang tetap bagus!</p>;
  }
  if (completion.xpGained === 0) {
    return <p className="text-xs text-slate-400">0 XP (solusi dibuka). Coba tantang dirimu tanpa solusi di misi berikutnya!</p>;
  }
  return (
    <p className="text-sm font-semibold text-amber-300">
      +{completion.xpGained} XP <span className="font-normal text-slate-400">ditambahkan ke totalmu</span>
    </p>
  );
}

function StreakLine({ completion }: { completion: CompletionSummary }): JSX.Element {
  const { current, best } = completion.streak;
  return (
    <div className="flex items-center gap-2 rounded-md border border-orange-500/30 bg-orange-950/20 px-3 py-1.5 text-xs">
      <Flame className={`h-4 w-4 text-orange-400 ${completion.streakIncreased ? 'animate-pulse' : ''}`} aria-hidden="true" />
      <span className="font-semibold text-orange-300">🔥 {current} hari streak</span>
      {completion.streakIncreased ? <span className="text-orange-200/80">· streak naik!</span> : null}
      <span className="text-slate-500">· terbaik {best}</span>
    </div>
  );
}

function RankUpCard({ completion }: { completion: CompletionSummary }): JSX.Element | null {
  const rank = completion.rankUp;
  if (!rank) return null;
  return (
    <div className="animate-pop-in flex items-center gap-3 rounded-lg border border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent px-4 py-3 [animation-delay:250ms]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-2xl ring-2 ring-amber-400/60">
        {rank.icon}
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
          <Trophy className="h-3.5 w-3.5" aria-hidden="true" /> Naik pangkat!
        </p>
        <p className="text-sm font-bold text-amber-100">Kamu sekarang seorang {rank.title}</p>
      </div>
    </div>
  );
}

function NextStep({ hasNextMission, onNextMission }: { hasNextMission: boolean; onNextMission: () => void }): JSX.Element {
  if (hasNextMission) {
    return (
      <button
        type="button"
        onClick={onNextMission}
        className="group inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
      >
        Misi Berikutnya
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-teal-500/40 bg-teal-950/30 px-3 py-2 text-sm text-teal-200">
      <PartyPopper className="h-4 w-4 shrink-0 text-teal-300" aria-hidden="true" />
      <span>Selamat! Kamu telah menuntaskan semua misi SIMRS SQL Quest. Coba Free Playground untuk eksplorasi bebas.</span>
    </div>
  );
}

export interface SuccessCelebrationProps {
  /** Judul utama, mis. "Jawaban benar!" atau "Serangan berhasil!". */
  title: string;
  /** Baris kecil di bawah judul (waktu eksekusi, keterangan penilaian). */
  subtitle: ReactNode;
  completion: CompletionSummary | null;
  hasNextMission: boolean;
  onNextMission: () => void;
}

export function SuccessCelebration({ title, subtitle, completion, hasNextMission, onNextMission }: SuccessCelebrationProps): JSX.Element {
  const xpGained = completion?.xpGained ?? 0;
  return (
    <div
      role="status"
      className="relative overflow-hidden rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-teal-500/5 to-slate-900/40 px-4 py-4"
    >
      {SPARKLES.map((sparkle, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`pointer-events-none absolute animate-float-up text-lg ${sparkle.className}`}
          style={{ animationDelay: sparkle.delay }}
        >
          {sparkle.emoji}
        </span>
      ))}
      {xpGained > 0 ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-4 animate-float-up font-mono text-xl font-bold text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] [animation-delay:200ms]"
        >
          +{xpGained} XP
        </span>
      ) : null}

      <div className="flex items-start gap-3">
        <div className="animate-pop-in flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/70">
          <CircleCheck className="h-7 w-7 text-emerald-400" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="flex items-center gap-1.5 text-base font-bold text-emerald-300">
              {title} <Sparkles className="h-4 w-4 text-amber-300" aria-hidden="true" />
            </p>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">{subtitle}</div>
          </div>
          {completion ? <XpLine completion={completion} /> : null}
          {completion ? <StreakLine completion={completion} /> : null}
        </div>
      </div>

      {completion?.rankUp ? (
        <div className="mt-3">
          <RankUpCard completion={completion} />
        </div>
      ) : null}

      <div className="mt-4">
        <NextStep hasNextMission={hasNextMission} onNextMission={onNextMission} />
      </div>
    </div>
  );
}
