/**
 * State Mode Ujian: sesi berjalan (disimpan di localStorage agar tahan refresh), timer berbasis tenggat yang
 * mengumpulkan otomatis saat waktu habis — juga saat pengguna sedang di mode lain —, penilaian lewat worker SQL, dan
 * riwayat ujian.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Database, SqlJsStatic } from 'sql.js';
import { MISSIONS, getMissionById } from '../data/missions';
import {
  EXAM_HISTORY_KEY,
  EXAM_SESSION_KEY,
  MAX_HISTORY,
  buildExam,
  buildReviewSession,
  isAnswered,
  isExamMission,
  itemFromCheck,
  parseHistory,
  parseSession,
  remainingMs,
  unansweredItem,
  type ExamAnswer,
  type ExamConfig,
  type ExamItemResult,
  type ExamMission,
  type ExamRecord,
  type ExamSession,
} from '../lib/exam';
import { buildPredictChoices } from '../lib/predict';
import { sqlGuard } from '../lib/sqlGuard';
import { stoppedFailure } from '../lib/sqlEngine';
import { checkMission } from '../lib/validator';
import type { CheckResult, UserProgress } from '../types';
import type { MistakesApi } from './useMistakes';


function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* penyimpanan penuh / tidak tersedia — tetap jalan di memori */
  }
}

const LETTERS = 'ABCDEFGH';

async function gradeSql(SQL: SqlJsStatic | null, mission: Extract<ExamMission, { kind: 'sql' }>, sql: string): Promise<CheckResult> {
  const outcome = await sqlGuard.check(mission.id, sql);
  switch (outcome.status) {
    case 'done':
      return outcome.value;
    case 'timeout':
    case 'cancelled':
      return { kind: 'error', ...stoppedFailure('timeout') };
    case 'crashed':
      return { kind: 'error', ...stoppedFailure('crashed', outcome.message) };
    case 'unavailable':
      if (!SQL) return { kind: 'error', rawError: 'mesin SQL belum siap', friendlyError: 'Mesin SQL belum siap; jawaban ini tidak bisa dinilai.' };
      return checkMission(SQL, mission, sql);
    default: {
      const unreachable: never = outcome;
      return unreachable;
    }
  }
}

function gradePredict(db: Database | null, mission: Extract<ExamMission, { kind: 'predict' }>, choiceId: string): ExamItemResult {
  const built = db ? buildPredictChoices(db, mission) : null;
  if (!built?.ok) return { missionId: mission.id, status: 'wrong', kind: 'reading', message: 'Pilihan tidak bisa dibangun ulang untuk dinilai.', answer: '' };
  const index = built.choices.findIndex((c) => c.id === choiceId);
  const choice = built.choices[index];
  const answer = index >= 0 ? `Pilihan ${LETTERS[index] ?? '?'}` : '';
  if (choice?.correct) return { missionId: mission.id, status: 'correct', kind: null, message: 'Benar.', answer };
  return { missionId: mission.id, status: 'wrong', kind: 'reading', message: choice ? `Salah paham di balik pilihanmu: ${choice.explanation}` : 'Pilihan tidak dikenali.', answer };
}

export interface ExamApi {
  session: ExamSession | null;
  history: readonly ExamRecord[];
  /** Rapor yang sedang ditampilkan (baru selesai / dibuka dari riwayat). */
  report: ExamRecord | null;
  current: number;
  setCurrent: (index: number) => void;
  /** Sisa waktu (ms) sesi berjalan; null bila tanpa batas / tidak ada sesi. */
  remaining: number | null;
  grading: { done: number; total: number } | null;
  start: (config: ExamConfig) => { ok: true; shortBy: number } | { ok: false; message: string };
  /** Mulai sesi latihan ulang dari misi pilihan jadwal (tanpa batas waktu). */
  startReview: (missions: readonly ExamMission[]) => void;
  setAnswer: (missionId: string, answer: ExamAnswer) => void;
  submit: () => void;
  abandon: () => void;
  openReport: (id: string | null) => void;
  clearHistory: () => void;
}

export function useExam(
  SQL: SqlJsStatic | null,
  referenceDb: Database | null,
  progress: UserProgress,
  mistakes: Pick<MistakesApi, 'record' | 'markSolved'>,
  /** Dipanggil sekali setiap sesi (ujian/latihan ulang) selesai dinilai — mis. untuk jadwal ulang & streak. */
  onFinished?: (record: ExamRecord) => void,
): ExamApi {
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const [session, setSession] = useState<ExamSession | null>(() => parseSession(readJson(EXAM_SESSION_KEY), MISSIONS));
  const [history, setHistory] = useState<ExamRecord[]>(() => parseHistory(readJson(EXAM_HISTORY_KEY)));
  const [reportId, setReportId] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [grading, setGrading] = useState<{ done: number; total: number } | null>(null);
  const gradingRef = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const saveSession = useCallback((next: ExamSession | null) => {
    sessionRef.current = next;
    writeJson(EXAM_SESSION_KEY, next);
    setSession(next);
  }, []);

  const submitWith = useCallback(
    async (timedOut: boolean) => {
      const active = sessionRef.current;
      if (!active || gradingRef.current) return;
      gradingRef.current = true;
      setGrading({ done: 0, total: active.missionIds.length });
      const items: ExamItemResult[] = [];
      for (const [index, id] of active.missionIds.entries()) {
        const mission = getMissionById(id);
        const answer = active.answers[id];
        if (!mission || !isExamMission(mission)) continue;
        if (!isAnswered(mission, answer)) items.push(unansweredItem(mission));
        else if (mission.kind === 'sql' && answer?.kind === 'sql') items.push(itemFromCheck(mission, await gradeSql(SQL, mission, answer.sql), answer.sql));
        else if (mission.kind === 'predict' && answer?.kind === 'predict' && answer.choiceId) items.push(gradePredict(referenceDb, mission, answer.choiceId));
        setGrading({ done: index + 1, total: active.missionIds.length });
      }
      for (const item of items) {
        if (item.status === 'correct') mistakes.markSolved(item.missionId);
        else if (item.kind) mistakes.record(item.missionId, item.kind);
      }
      const record: ExamRecord = {
        id: active.id,
        purpose: active.purpose,
        startedAt: active.startedAt,
        finishedAt: new Date().toISOString(),
        timedOut,
        config: active.config,
        items,
      };
      onFinishedRef.current?.(record);
      setHistory((prev) => {
        const next = [...prev.filter((r) => r.id !== record.id), record].slice(-MAX_HISTORY);
        writeJson(EXAM_HISTORY_KEY, next);
        return next;
      });
      setReportId(record.id);
      saveSession(null);
      setGrading(null);
      gradingRef.current = false;
    },
    [SQL, referenceDb, mistakes, saveSession],
  );

  // Timer: berdetak selama ada sesi bertenggat; waktu habis → kumpulkan otomatis (penilaian butuh mesin SQL siap).
  useEffect(() => {
    if (!session?.deadline) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session?.deadline]);
  const remaining = session ? remainingMs(session, now) : null;
  useEffect(() => {
    if (remaining === 0 && SQL) void submitWith(true);
  }, [remaining, SQL, submitWith]);

  const start = useCallback(
    (config: ExamConfig) => {
      const built = buildExam(MISSIONS, progress, config, Math.random, new Date());
      if (!built.ok) return built;
      setCurrent(0);
      setReportId(null);
      setNow(Date.now());
      saveSession(built.session);
      return { ok: true as const, shortBy: built.shortBy };
    },
    [progress, saveSession],
  );

  const startReview = useCallback(
    (missions: readonly ExamMission[]) => {
      const session = buildReviewSession(missions, Math.random, new Date());
      if (!session) return;
      setCurrent(0);
      setReportId(null);
      saveSession(session);
    },
    [saveSession],
  );

  const setAnswer = useCallback(
    (missionId: string, answer: ExamAnswer) => {
      const active = sessionRef.current;
      if (!active || gradingRef.current || !(missionId in active.answers)) return;
      saveSession({ ...active, answers: { ...active.answers, [missionId]: answer } });
    },
    [saveSession],
  );

  const report = reportId ? (history.find((r) => r.id === reportId) ?? null) : null;

  return {
    session,
    history,
    report,
    current: session ? Math.min(current, session.missionIds.length - 1) : 0,
    setCurrent,
    remaining,
    grading,
    start,
    startReview,
    setAnswer,
    submit: () => void submitWith(false),
    abandon: () => saveSession(null),
    openReport: setReportId,
    clearHistory: () => {
      writeJson(EXAM_HISTORY_KEY, []);
      setHistory([]);
      setReportId(null);
    },
  };
}
