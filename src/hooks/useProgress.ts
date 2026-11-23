import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  completeMission,
  createEmptyProgress,
  getCompletedCount,
  loadProgress,
  markHintRevealed,
  markSolutionShown,
  recordActivity,
  recordAttempt as recordAttemptPure,
  saveProgress,
  STORAGE_KEY,
} from '../lib/progress';
import { getRankProgress } from '../lib/ranks';
import type { CompletionSummary, Mission, RankProgress, UserProgress } from '../types';

export interface ProgressApi {
  progress: UserProgress;
  rankProgress: RankProgress;
  completedCount: number;
  recordAttempt: (missionId: string) => void;
  revealHint: (missionId: string, revealedCount: number) => void;
  showSolution: (missionId: string) => void;
  /** Sinkron: dihitung dari ref progres terbaru, lalu setState + simpan. */
  complete: (mission: Mission) => CompletionSummary;
  setLastMission: (missionId: string) => void;
  resetProgress: () => void;
  /** Hari ini dihitung aktif untuk streak (sesi latihan ulang / ujian yang dinilai). */
  markActive: () => void;
}

export function useProgress(): ProgressApi {
  const [progress, setProgress] = useState<UserProgress>(() => loadProgress());
  const progressRef = useRef<UserProgress>(progress);

  /** Satu-satunya jalur perubahan: update ref, state, dan localStorage sekaligus. */
  const commit = useCallback((next: UserProgress) => {
    progressRef.current = next;
    setProgress(next);
    saveProgress(next);
  }, []);

  /**
   * Sinkron antar-tab: event 'storage' hanya terpicu di tab LAIN. Tanpa ini, tab
   * yang masih memegang progres lama akan menimpa progres baru saat commit berikutnya.
   * key === null berarti localStorage dibersihkan seluruhnya.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      const latest = loadProgress();
      progressRef.current = latest;
      setProgress(latest);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const recordAttempt = useCallback(
    (missionId: string) => commit(recordAttemptPure(progressRef.current, missionId)),
    [commit],
  );

  const revealHint = useCallback(
    (missionId: string, revealedCount: number) =>
      commit(markHintRevealed(progressRef.current, missionId, revealedCount)),
    [commit],
  );

  const showSolution = useCallback(
    (missionId: string) => commit(markSolutionShown(progressRef.current, missionId)),
    [commit],
  );

  const complete = useCallback(
    (mission: Mission): CompletionSummary => {
      const result = completeMission(progressRef.current, mission, new Date());
      commit(result.progress);
      return result.summary;
    },
    [commit],
  );

  const setLastMission = useCallback(
    (missionId: string) => {
      if (progressRef.current.lastMissionId === missionId) return;
      commit({ ...progressRef.current, lastMissionId: missionId });
    },
    [commit],
  );

  const resetProgress = useCallback(() => commit(createEmptyProgress()), [commit]);

  const markActive = useCallback(() => {
    const next = recordActivity(progressRef.current, new Date());
    if (next !== progressRef.current) commit(next);
  }, [commit]);

  const rankProgress = useMemo(() => getRankProgress(progress.xp), [progress.xp]);
  const completedCount = useMemo(() => getCompletedCount(progress), [progress]);

  return {
    progress,
    rankProgress,
    completedCount,
    recordAttempt,
    revealHint,
    showSolution,
    complete,
    setLastMission,
    resetProgress,
    markActive,
  };
}
