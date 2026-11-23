import { useCallback, useMemo, useState } from 'react';
import type { SqlMission } from '../../types';
import type { QuizAnswers } from './missionAttempt';

/** Draf kerja per misi (hanya di memori sesi; tidak disimpan ke localStorage). */
interface DraftState {
  sql: Readonly<Record<string, string>>;
  injection: Readonly<Record<string, string>>;
  safeMode: Readonly<Record<string, boolean>>;
  quiz: Readonly<Record<string, QuizAnswers>>;
  /** Misi tebak hasil: id pilihan tabel yang sedang dipilih. */
  predict: Readonly<Record<string, string>>;
}

const EMPTY_DRAFTS: DraftState = { sql: {}, injection: {}, safeMode: {}, quiz: {}, predict: {} };
const NO_ANSWERS: QuizAnswers = {};

export interface MissionDrafts {
  sqlFor: (mission: SqlMission) => string;
  injectionInputFor: (missionId: string) => string;
  safeModeFor: (missionId: string) => boolean;
  quizAnswersFor: (missionId: string) => QuizAnswers;
  predictChoiceFor: (missionId: string) => string | null;
  setSql: (missionId: string, sql: string) => void;
  setInjectionInput: (missionId: string, input: string) => void;
  setSafeMode: (missionId: string, safeMode: boolean) => void;
  setQuizAnswer: (missionId: string, questionId: string, optionIndex: number) => void;
  setPredictChoice: (missionId: string, choiceId: string) => void;
  resetAll: () => void;
}

export function useMissionDrafts(): MissionDrafts {
  const [drafts, setDrafts] = useState<DraftState>(EMPTY_DRAFTS);

  const setSql = useCallback((missionId: string, sql: string) => {
    setDrafts((prev) => ({ ...prev, sql: { ...prev.sql, [missionId]: sql } }));
  }, []);

  const setInjectionInput = useCallback((missionId: string, input: string) => {
    setDrafts((prev) => ({ ...prev, injection: { ...prev.injection, [missionId]: input } }));
  }, []);

  const setSafeMode = useCallback((missionId: string, safeMode: boolean) => {
    setDrafts((prev) => ({ ...prev, safeMode: { ...prev.safeMode, [missionId]: safeMode } }));
  }, []);

  const setQuizAnswer = useCallback((missionId: string, questionId: string, optionIndex: number) => {
    setDrafts((prev) => ({
      ...prev,
      quiz: { ...prev.quiz, [missionId]: { ...(prev.quiz[missionId] ?? NO_ANSWERS), [questionId]: optionIndex } },
    }));
  }, []);

  const setPredictChoice = useCallback((missionId: string, choiceId: string) => {
    setDrafts((prev) => ({ ...prev, predict: { ...prev.predict, [missionId]: choiceId } }));
  }, []);

  const resetAll = useCallback(() => setDrafts(EMPTY_DRAFTS), []);

  return useMemo(
    () => ({
      sqlFor: (mission: SqlMission) => drafts.sql[mission.id] ?? mission.starterSql,
      injectionInputFor: (missionId: string) => drafts.injection[missionId] ?? '',
      safeModeFor: (missionId: string) => drafts.safeMode[missionId] ?? false,
      quizAnswersFor: (missionId: string) => drafts.quiz[missionId] ?? NO_ANSWERS,
      predictChoiceFor: (missionId: string) => drafts.predict[missionId] ?? null,
      setSql,
      setInjectionInput,
      setSafeMode,
      setQuizAnswer,
      setPredictChoice,
      resetAll,
    }),
    [drafts, setSql, setInjectionInput, setSafeMode, setQuizAnswer, setPredictChoice, resetAll],
  );
}
