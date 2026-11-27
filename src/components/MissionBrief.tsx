import type { ReactNode } from 'react';
import { BookOpen, CircleCheck, ClipboardCopy, Crown, Eye, ListChecks, Lightbulb, Lock, Stethoscope, Target, Zap } from 'lucide-react';
import { ClampedText } from './ClampedText';
import { HighlightedCode } from './HighlightedCode';
import { useBriefFold } from '../hooks/useBriefFold';
import { getMissionById } from '../data/missions';
import { BOSS_SOLUTION_AFTER, bossLabel, isBoss, solutionAttemptsLeft, type BossMission } from '../lib/boss';
import { MissionKindBadge, displayKind } from './MissionKind';
import type { Mission, MissionProgress } from '../types';

export interface MissionBriefProps {
  mission: Mission;
  missionProgress: MissionProgress;
  /** XP yang akan/sudah didapat (sudah memperhitungkan penalti hint/solusi). */
  reward: number;
}

/** Judul, Skenario, dan Tugas misi aktif — ditampilkan di atas tab agar selalu terlihat. */
export function MissionBrief({ mission, missionProgress, reward }: MissionBriefProps) {
  const fold = useBriefFold();
  return (
    <article className="space-y-3" aria-label="Misi aktif">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 font-medium text-teal-300">
            Tier {mission.tier}
          </span>
          <MissionKindBadge kind={displayKind(mission)} />
          <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 font-mono text-emerald-300">
            {mission.concept}
          </span>
          <span className="text-slate-500">Misi {mission.order}</span>
          <RewardChip mission={mission} missionProgress={missionProgress} reward={reward} />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-50">{mission.title}</h2>
      </div>

      <section className="rounded-xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 to-slate-900/40 p-4">
        <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-300">
          <Stethoscope className="h-4 w-4" aria-hidden />
          Skenario
        </h3>
        <ClampedText
          text={mission.story}
          lines={3}
          expanded={fold.storyExpanded}
          onExpandedChange={fold.setStoryExpanded}
          label="skenario"
          className="text-sm leading-relaxed text-slate-300"
        />
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
          <Target className="h-4 w-4" aria-hidden />
          Tugas
        </h3>
        <ClampedText
          text={mission.task}
          lines={5}
          expanded={fold.taskExpanded}
          onExpandedChange={fold.setTaskExpanded}
          label="tugas"
          className="whitespace-pre-line text-sm leading-relaxed text-slate-100"
        />
      </section>
    </article>
  );
}

export interface MissionHelpProps {
  mission: Mission;
  missionProgress: MissionProgress;
  /**
   * Tampilkan blok solusi. Default: missionProgress.solutionShown. Pemanggil bisa
   * mengisinya true untuk misi yang sudah selesai (solusi dilihat tanpa penalti,
   * sehingga solutionShown di progres tidak berubah).
   */
  solutionVisible?: boolean;
  /** Konfirmasi (window.confirm) ditangani oleh pemanggil agar konsisten dengan tombol di panel kanan. */
  onRevealHint: () => void;
  onShowSolution: () => void;
  /** Salin solusi ke tempat kerja: SQL ke editor (misi sql) atau payload ke form (lab injection). */
  onCopySolution: (text: string) => void;
}

/** Hint bertahap + Show Solution untuk misi aktif. */
export function MissionHelp({
  mission,
  missionProgress,
  solutionVisible = missionProgress.solutionShown,
  onRevealHint,
  onShowSolution,
  onCopySolution,
}: MissionHelpProps) {
  return (
    <div className="space-y-3">
      {isBoss(mission) ? (
        <BossRules mission={mission} />
      ) : (
        <HintSection mission={mission} missionProgress={missionProgress} onRevealHint={onRevealHint} />
      )}
      <SolutionSection
        mission={mission}
        missionProgress={missionProgress}
        visible={solutionVisible}
        onShowSolution={onShowSolution}
        onCopySolution={onCopySolution}
      />
    </div>
  );
}

interface RewardChipProps {
  mission: Mission;
  missionProgress: MissionProgress;
  reward: number;
}

function RewardChip({ mission, missionProgress, reward }: RewardChipProps) {
  if (missionProgress.completed) {
    return (
      <span className="ml-auto flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 font-semibold text-emerald-300">
        <CircleCheck className="h-3.5 w-3.5" aria-hidden />
        Selesai • +{missionProgress.earnedXp} XP
      </span>
    );
  }

  if (missionProgress.solutionShown) {
    return (
      <span className="ml-auto flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 font-semibold text-rose-300">
        <Zap className="h-3.5 w-3.5" aria-hidden />
        0 XP (solusi dibuka)
      </span>
    );
  }

  const reduced = reward < mission.xpReward;
  return (
    <span
      className="ml-auto flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-semibold text-amber-300 light:border-amber-700/40 light:bg-amber-950/40"
      title={reduced ? 'XP berkurang 20% karena hint sudah dibuka' : 'XP penuh jika diselesaikan tanpa bantuan'}
    >
      <Zap className="h-3.5 w-3.5" aria-hidden />
      {reduced && <span className="font-normal text-amber-500/60 line-through light:text-slate-500">{mission.xpReward}</span>}
      {reward} XP
    </span>
  );
}

/** Pengganti panel hint untuk Boss Challenge: aturan main + rekap misi yang konsepnya digabung. */
function BossRules({ mission }: { mission: BossMission }) {
  const combined = mission.boss.combines.flatMap((id) => {
    const m = getMissionById(id);
    return m ? [m] : [];
  });
  return (
    <section className="rounded-xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/10 to-slate-900/40 p-4 light:border-yellow-700/40 light:from-yellow-950/30">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-yellow-200">
        <Crown className="h-4 w-4" aria-hidden />
        {bossLabel(mission.tier)}: tanpa hint
      </h3>
      <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-300">
        <li>• Satu soal yang menggabungkan beberapa konsep sekaligus — dan jebakan-jebakannya.</li>
        <li>• Tidak ada hint dan materi khusus; semua materi tetap boleh dibuka dari tab Materi atau mode Materi.</li>
        <li>• Solusi baru bisa dibuka setelah {BOSS_SOLUTION_AFTER} percobaan (dan membuat boss bernilai 0 XP).</li>
      </ul>
      {combined.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Mengulang konsep dari</p>
          <div className="flex flex-wrap gap-1.5">
            {combined.map((m) => (
              <span key={m.id} className="rounded-full border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-[11px] text-slate-300" title={m.title}>
                Misi {m.order} · <span className="font-mono text-teal-300">{m.concept}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

interface HintSectionProps {
  mission: Mission;
  missionProgress: MissionProgress;
  onRevealHint: () => void;
}

function HintSection({ mission, missionProgress, onRevealHint }: HintSectionProps) {
  const total = mission.hint.length;
  const revealed = Math.min(missionProgress.hintsRevealed, total);
  const visibleHints = mission.hint.slice(0, revealed);
  const allRevealed = revealed >= total;
  const penaltyPending = !missionProgress.hintUsed && !missionProgress.completed && !missionProgress.solutionShown;
  const buttonLabel = revealed > 0 ? 'Hint berikutnya' : penaltyPending ? 'Hint (-20% XP)' : 'Lihat hint';

  return (
    <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 light:border-amber-700/30 light:bg-amber-950/15">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
          <Lightbulb className="h-4 w-4" aria-hidden />
          Hint
        </h3>
        <span className="text-xs tabular-nums text-slate-500">
          {revealed}/{total} terbuka
        </span>
        <button
          type="button"
          onClick={onRevealHint}
          disabled={allRevealed}
          className="ml-auto rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-transparent disabled:text-slate-500 light:border-amber-700/50 light:bg-amber-950/40 light:hover:bg-amber-950/70 light:disabled:border-slate-700 light:disabled:bg-transparent"
        >
          {allRevealed ? 'Semua hint terbuka' : buttonLabel}
        </button>
      </div>
      {visibleHints.length > 0 && (
        <ol className="mt-3 space-y-2">
          {visibleHints.map((hint, index) => (
            <li key={index} className="flex animate-pop-in gap-2 text-sm leading-relaxed text-slate-300">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-300 light:bg-amber-950/70">
                {index + 1}
              </span>
              <span>{hint}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

interface SolutionSectionProps {
  mission: Mission;
  missionProgress: MissionProgress;
  visible: boolean;
  onShowSolution: () => void;
  onCopySolution: (text: string) => void;
}

function SolutionSection({ mission, missionProgress, visible, onShowSolution, onCopySolution }: SolutionSectionProps) {
  const attemptsLeft = solutionAttemptsLeft(mission, missionProgress);
  if (!visible && attemptsLeft > 0) {
    return (
      <section className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <p className="flex-1 text-xs leading-relaxed text-slate-400">
          Solusi boss terkunci sampai kamu mencoba {BOSS_SOLUTION_AFTER}× dengan Run &amp; Check — tinggal{' '}
          <span className="font-semibold text-slate-200">{attemptsLeft}× lagi</span>. Jawaban salah pun berguna: lihat tab
          Perbedaan dan Urutan Eksekusi untuk menemukan langkah yang meleset.
        </p>
      </section>
    );
  }
  if (!visible) {
    const WHAT: Record<Mission['kind'], string> = {
      sql: 'solusi referensi',
      injection: 'solusi referensi',
      concept: 'kunci jawaban kuis',
      predict: 'jawaban yang benar',
    };
    const what = WHAT[mission.kind];
    return (
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <BookOpen className="h-4 w-4 text-slate-500" aria-hidden />
        <p className="flex-1 text-xs text-slate-400">
          Buntu? Kamu bisa melihat {what}
          {missionProgress.completed ? '.' : ', tetapi misi ini akan bernilai 0 XP.'}
        </p>
        <button
          type="button"
          onClick={onShowSolution}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-200"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
          Show Solution
        </button>
      </section>
    );
  }

  switch (mission.kind) {
    case 'sql':
      return (
        <SolutionFrame title="Solusi Referensi" copyLabel="Salin ke editor" onCopy={() => onCopySolution(mission.solutionSql)}>
          <HighlightedCode code={mission.solutionSql} />
        </SolutionFrame>
      );
    case 'injection':
      return (
        <SolutionFrame title="Contoh Payload" copyLabel="Salin ke form" onCopy={() => onCopySolution(mission.solutionPayload)}>
          <pre className="scrollbar-thin overflow-x-auto whitespace-pre p-4 font-mono text-[13px] text-violet-200">{mission.solutionPayload}</pre>
          <p className="border-t border-slate-800 px-4 py-2 text-xs leading-relaxed text-slate-500">
            Payload ini diketik di kolom input form, bukan di editor SQL. Perhatikan bagaimana tanda kutip di awal payload
            &quot;menutup&quot; string milik server.
          </p>
        </SolutionFrame>
      );
    case 'predict':
      return (
        <section className="animate-pop-in flex items-start gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
          <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" aria-hidden />
          <p className="text-xs leading-relaxed text-slate-300">
            Tabel yang benar ditandai di panel kanan, lengkap dengan SQL di balik setiap pilihan dan penjelasan salah paham yang
            diwakilinya. Telusuri juga <span className="font-semibold text-emerald-300">Urutan Eksekusi</span> query-nya.
          </p>
        </section>
      );
    case 'concept':
      return (
        <section className="animate-pop-in flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
          <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" aria-hidden />
          <p className="text-xs leading-relaxed text-slate-300">
            Jawaban ditandai di kuis (panel kanan) beserta penjelasannya. Baca penjelasannya baik-baik — tujuan kartu ini
            adalah memahami konsepnya.
          </p>
        </section>
      );
    default: {
      const unreachable: never = mission;
      return unreachable;
    }
  }
}

interface SolutionFrameProps {
  title: string;
  copyLabel: string;
  onCopy: () => void;
  children: ReactNode;
}

function SolutionFrame({ title, copyLabel, onCopy, children }: SolutionFrameProps) {
  return (
    <section className="animate-pop-in rounded-xl border border-slate-700 bg-slate-950/80">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
        <BookOpen className="h-4 w-4 text-emerald-400" aria-hidden />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">{title}</h3>
        <button
          type="button"
          onClick={onCopy}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
        >
          <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
          {copyLabel}
        </button>
      </div>
      {children}
    </section>
  );
}
