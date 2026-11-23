import { useCallback, useRef, useState } from 'react';
import type { SqlJsStatic } from 'sql.js';
import { checkMission } from '../../lib/validator';
import { runInjection, stoppedInjectionRun } from '../../lib/injection';
import { stoppedFailure } from '../../lib/sqlEngine';
import { sqlGuard } from '../../lib/sqlGuard';
import { classifyCheck, type MistakeKind } from '../../lib/mistakes';
import { checkQuiz } from '../../lib/quiz';
import type { ProgressApi } from '../../hooks/useProgress';
import type { PredictChoice } from '../../lib/predict';
import type { CheckResult, CompletionSummary, ConceptMission, ExecFailure, InjectionMission, InjectionRun, Mission, PredictMission, SqlMission } from '../../types';

/** Bagian error dari ExecFailure untuk dijadikan CheckResult. */
function pick(failure: ExecFailure): { rawError: string; friendlyError: string } {
  return { rawError: failure.rawError, friendlyError: failure.friendlyError };
}
import type { MissionAttempt, QuizAnswers } from './missionAttempt';

export interface MissionRunner {
  attempt: MissionAttempt | null;
  completion: CompletionSummary | null;
  /** Misi yang penilaiannya sedang berjalan di worker (null = tidak ada). */
  runningMissionId: string | null;
  /** Hentikan penilaian yang sedang berjalan (tombol Hentikan). */
  cancel: () => void;
  /** Bertambah di setiap percobaan, agar animasi hasil (shake/pop-in) diputar ulang. */
  runId: number;
  runSql: (mission: SqlMission, sql: string) => void;
  submitInjection: (mission: InjectionMission, input: string, safeMode: boolean) => void;
  submitQuiz: (mission: ConceptMission, answers: QuizAnswers) => void;
  /** Misi tebak hasil: `choice` = pilihan tabel yang dipilih user. */
  submitPredict: (mission: PredictMission, choice: PredictChoice) => void;
  /** Bersihkan hasil percobaan (dipanggil saat pindah misi / reset progres). */
  clear: () => void;
}

type ProgressActions = Pick<ProgressApi, 'recordAttempt' | 'complete'>;

export interface MistakeLogActions {
  record: (missionId: string, kind: MistakeKind) => void;
  markSolved: (missionId: string) => void;
}

/**
 * Menjalankan penilaian untuk semua jenis misi dengan pola yang sama:
 * catat percobaan → nilai → simpan hasil → jika benar, selesaikan misi (XP, streak, rank).
 */
export function useMissionRunner(
  SQL: SqlJsStatic | null,
  progress: ProgressActions,
  /** Riwayat Peta Kelemahan: jenis kesalahan tiap percobaan yang belum benar + waktu jawaban benar. */
  log: MistakeLogActions,
): MissionRunner {
  const [attempt, setAttempt] = useState<MissionAttempt | null>(null);
  const [completion, setCompletion] = useState<CompletionSummary | null>(null);
  const [runId, setRunId] = useState(0);
  const [runningMissionId, setRunningMissionId] = useState<string | null>(null);
  const busy = useRef(false);
  const { recordAttempt, complete } = progress;
  const { record: recordMistake, markSolved } = log;

  const settle = useCallback(
    (mission: Mission, next: MissionAttempt, correct: boolean) => {
      setRunId((id) => id + 1);
      setAttempt(next);
      if (correct) markSolved(mission.id);
      setCompletion(correct ? complete(mission) : null);
    },
    [complete, markSolved],
  );

  /** Satu penilaian di worker pada satu waktu; Ctrl+Enter berulang saat masih berjalan diabaikan. */
  const exclusive = useCallback(async (missionId: string, task: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setRunningMissionId(missionId);
    try {
      await task();
    } finally {
      busy.current = false;
      setRunningMissionId(null);
    }
  }, []);

  const runSql = useCallback(
    (mission: SqlMission, sql: string) => {
      if (!SQL) return;
      void exclusive(mission.id, async () => {
        const guarded = await sqlGuard.check(mission.id, sql);
        // Dibatalkan user: bukan percobaan — tidak dicatat dan hasil sebelumnya tetap tampil.
        if (guarded.status === 'cancelled') return;
        let check: CheckResult;
        if (guarded.status === 'done') check = guarded.value;
        else if (guarded.status === 'timeout') check = { kind: 'error', ...pick(stoppedFailure('timeout')) };
        else if (guarded.status === 'crashed') check = { kind: 'error', ...pick(stoppedFailure('crashed', guarded.message)) };
        else check = checkMission(SQL, mission, sql); // worker tidak tersedia → langsung (tanpa batas waktu)
        recordAttempt(mission.id);
        const mistake = classifyCheck(mission, check);
        if (mistake) recordMistake(mission.id, mistake);
        settle(mission, { kind: 'sql', missionId: mission.id, check }, check.kind === 'correct');
      });
    },
    [SQL, exclusive, recordAttempt, recordMistake, settle],
  );

  const submitInjection = useCallback(
    (mission: InjectionMission, input: string, safeMode: boolean) => {
      if (!SQL) return;
      void exclusive(mission.id, async () => {
        const guarded = await sqlGuard.inject(mission.id, input, safeMode);
        if (guarded.status === 'cancelled') return;
        let run: InjectionRun;
        if (guarded.status === 'done') run = guarded.value;
        else if (guarded.status === 'timeout') run = stoppedInjectionRun(mission, input, safeMode, stoppedFailure('timeout'));
        else if (guarded.status === 'crashed') run = stoppedInjectionRun(mission, input, safeMode, stoppedFailure('crashed', guarded.message));
        else run = runInjection(SQL, mission, input, safeMode);
        recordAttempt(mission.id);
        // Mode aman memang dirancang agar serangan gagal — bukan kesalahan yang perlu dicatat.
        const mistake = safeMode ? null : classifyCheck(mission, run.check);
        if (mistake) recordMistake(mission.id, mistake);
        settle(mission, { kind: 'injection', missionId: mission.id, run }, run.check.kind === 'correct');
      });
    },
    [SQL, exclusive, recordAttempt, recordMistake, settle],
  );

  const submitQuiz = useCallback(
    (mission: ConceptMission, answers: QuizAnswers) => {
      recordAttempt(mission.id);
      const result = checkQuiz(mission, answers);
      // Soal yang belum dijawab bukan salah paham — hanya dicatat bila semua soal sudah dijawab.
      const allAnswered = mission.quiz.every((q) => answers[q.id] !== undefined);
      if (!result.correct && allAnswered) recordMistake(mission.id, 'concept');
      settle(mission, { kind: 'concept', missionId: mission.id, result, answers }, result.correct);
    },
    [recordAttempt, recordMistake, settle],
  );

  const submitPredict = useCallback(
    (mission: PredictMission, choice: PredictChoice) => {
      recordAttempt(mission.id);
      if (!choice.correct) recordMistake(mission.id, 'reading');
      settle(mission, { kind: 'predict', missionId: mission.id, choiceId: choice.id, correct: choice.correct }, choice.correct);
    },
    [recordAttempt, recordMistake, settle],
  );

  const clear = useCallback(() => {
    setAttempt(null);
    setCompletion(null);
  }, []);

  const cancel = useCallback(() => sqlGuard.cancel(), []);

  return { attempt, completion, runId, runningMissionId, cancel, runSql, submitInjection, submitQuiz, submitPredict, clear };
}
