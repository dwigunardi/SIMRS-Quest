import { Eye, Lightbulb, Lock } from 'lucide-react';
import { MISSION_KIND_META, MissionKindBadge, displayKind } from '../MissionKind';
import { isBoss, solutionAttemptsLeft } from '../../lib/boss';
import type { Mission, MissionProgress } from '../../types';

/**
 * Gaya tombol sekunder yang dipakai bersama oleh semua workspace misi (juga Lab Performa & Mode Ujian).
 * Tema terang: disabled:opacity-40 di atas putih → ±2,3:1, padahal labelnya tetap informatif (mis. "Show Solution (3)"
 * di boss, "Sebelumnya" di soal pertama) → gaya nonaktif khas tema terang: latar abu-abu + teks redup, tanpa opacity.
 */
export const SECONDARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40 light:disabled:bg-slate-900 light:disabled:text-slate-500 light:disabled:opacity-100';

export function WorkspaceHeader({ mission, totalCount }: { mission: Mission; totalCount: number }) {
  const kind = displayKind(mission);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${MISSION_KIND_META[kind].chipClass}`}>
        Misi {mission.order}/{totalCount}
      </span>
      <h2 className="text-base font-semibold text-slate-100">{mission.title}</h2>
      <span className="font-mono text-xs text-slate-500">{mission.concept}</span>
      {kind === 'sql' ? null : (
        <span className="ml-auto">
          <MissionKindBadge kind={kind} />
        </span>
      )}
    </div>
  );
}

export interface AssistButtonsProps {
  mission: Mission;
  missionProgress: MissionProgress;
  onHint: () => void;
  onShowSolution: () => void;
}

/** Tombol Hint & Show Solution (konfirmasi penalti XP ditangani App). */
export function AssistButtons({ mission, missionProgress, onHint, onShowSolution }: AssistButtonsProps) {
  const allHintsRevealed = missionProgress.hintsRevealed >= mission.hint.length;
  const marksAnswer = mission.kind === 'concept' || mission.kind === 'predict';
  const solutionLabel = marksAnswer ? 'Tandai Jawaban' : 'Show Solution';
  const attemptsLeft = solutionAttemptsLeft(mission, missionProgress);
  const solutionTitle =
    attemptsLeft > 0
      ? `Solusi boss terbuka setelah ${attemptsLeft}× percobaan lagi`
      : marksAnswer
        ? 'Tandai jawaban yang benar (misi bernilai 0 XP)'
        : undefined;
  return (
    <>
      {/* Boss Challenge tidak punya hint. */}
      {isBoss(mission) ? null : (
        <button
          type="button"
          onClick={onHint}
          disabled={allHintsRevealed}
          className={`${SECONDARY_BUTTON} hover:border-amber-500/50 hover:text-amber-200`}
        >
          <Lightbulb className="h-4 w-4 text-amber-400" aria-hidden />
          Hint
        </button>
      )}
      <button type="button" onClick={onShowSolution} disabled={attemptsLeft > 0} className={SECONDARY_BUTTON} title={solutionTitle}>
        {attemptsLeft > 0 ? <Lock className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        {solutionLabel}
        {attemptsLeft > 0 ? <span className="text-xs tabular-nums text-slate-500">({attemptsLeft})</span> : null}
      </button>
    </>
  );
}
