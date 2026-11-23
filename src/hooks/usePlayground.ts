import { useCallback, useEffect, useRef, useState } from 'react';
import { planExecution, stoppedPlan, type ExecPlan } from '../lib/execSteps';
import { explainScript } from '../lib/planTree';
import { isMutatingSql, isReadOnlyScript, stoppedFailure } from '../lib/sqlEngine';
import { sqlGuard, type GuardOutcome } from '../lib/sqlGuard';
import type { ExecFailure, ExecOutcome, PlanReport } from '../types';
import type { SqlEngine } from './useSqlEngine';

export type PlaygroundTab = 'result' | 'plan' | 'steps';

/** Hasil tombol "Urutan Eksekusi". */
export interface PlaygroundSteps {
  plan: ExecPlan;
  sql: string;
  dbVersion: number;
}

export interface PlaygroundPlan {
  report: PlanReport;
  /** SQL editor saat Explain dijalankan — untuk mendeteksi plan yang sudah usang. */
  sql: string;
  /** engine.dbVersion saat Explain dijalankan. */
  dbVersion: number;
}

/** Hasil tombol "Buat index ini" pada saran AUTOMATIC INDEX. */
export interface AppliedSuggestion {
  sql: string;
  outcome: ExecOutcome;
}

/** Alasan plan dianggap usang: SQL di editor berubah, atau isi/skema database berubah. */
export type PlanStaleness = 'sql' | 'db' | null;

export interface Playground {
  sql: string;
  setSql: (sql: string) => void;
  outcome: ExecOutcome | null;
  /** Skrip mutasi gagal di tengah jalan — sebagian statement mungkin sudah dijalankan. */
  partial: boolean;
  plan: PlaygroundPlan | null;
  staleness: PlanStaleness;
  steps: PlaygroundSteps | null;
  /** true jika SQL editor atau database berubah sejak urutan eksekusi dihitung. */
  stepsStale: boolean;
  applied: AppliedSuggestion | null;
  tab: PlaygroundTab;
  setTab: (tab: PlaygroundTab) => void;
  /** true selama Run / Urutan Eksekusi sedang menunggu worker. */
  running: boolean;
  /** Hentikan query yang sedang berjalan (tombol Hentikan). */
  cancel: () => void;
  run: () => void;
  explain: () => void;
  /** Menghitung langkah urutan eksekusi logis (FROM → WHERE → … → LIMIT) tanpa mengubah database. */
  visualize: () => void;
  /** Muat `sql` ke editor lalu langsung tampilkan urutan eksekusinya (dari contoh di Materi). */
  loadAndVisualize: (sql: string) => void;
  /** Muat `sql` ke editor dan bersihkan hasil lama (agar hasil query sebelumnya tidak tampak seperti hasil contoh). */
  loadSql: (sql: string) => void;
  /** Menjalankan SQL saran (mis. CREATE INDEX) di DB sesi, lalu Explain ulang otomatis. */
  applySuggestion: (sql: string) => void;
  resetDatabase: () => void;
}

/** Hasil uji coba di worker → kegagalan untuk ditampilkan, atau null bila query boleh dilanjutkan. */
function stoppedBy(outcome: GuardOutcome<unknown>): ExecFailure | null {
  if (outcome.status === 'timeout') return stoppedFailure('timeout');
  if (outcome.status === 'cancelled') return stoppedFailure('cancelled');
  if (outcome.status === 'crashed') return stoppedFailure('crashed', outcome.message);
  return null;
}

export function usePlayground(engine: SqlEngine, initialSql: string): Playground {
  const { SQL, db, dbVersion, run: runOnEngine, resetDatabase: resetEngine, sessionSource } = engine;
  const [sql, setSql] = useState(initialSql);
  const [outcome, setOutcome] = useState<ExecOutcome | null>(null);
  const [partial, setPartial] = useState(false);
  const [plan, setPlan] = useState<PlaygroundPlan | null>(null);
  const [steps, setSteps] = useState<PlaygroundSteps | null>(null);
  const [applied, setApplied] = useState<AppliedSuggestion | null>(null);
  const [tab, setTab] = useState<PlaygroundTab>('result');
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  /** Explain ulang setelah dbVersion berikutnya ter-render (dbVersion baru belum terlihat di closure). */
  const reexplainPending = useRef(false);

  const explainNow = useCallback(
    (keepApplied: boolean) => {
      if (!db) return;
      setPlan({ report: explainScript(db, sql, SQL), sql, dbVersion });
      if (!keepApplied) setApplied(null);
      setTab('plan');
    },
    [SQL, db, sql, dbVersion],
  );

  useEffect(() => {
    if (!reexplainPending.current) return;
    reexplainPending.current = false;
    explainNow(true);
  }, [dbVersion, explainNow]);

  /**
   * Uji coba `script` di salinan DB sesi (worker, dengan batas waktu). Hasil: outcome worker, 'direct' (jalankan
   * langsung: worker tidak tersedia / salinan tidak setara), atau kegagalan bila dihentikan.
   */
  const trial = useCallback(
    async (script: string): Promise<{ kind: 'done'; outcome: ExecOutcome } | { kind: 'stopped'; outcome: ExecFailure } | { kind: 'direct' }> => {
      const source = sessionSource();
      if (!source) return { kind: 'direct' };
      try {
        const guarded = await sqlGuard.execOnSession(script, source);
        const stopped = stoppedBy(guarded);
        if (stopped) return { kind: 'stopped', outcome: stopped };
        return guarded.status === 'done' ? { kind: 'done', outcome: guarded.value } : { kind: 'direct' };
      } catch {
        return { kind: 'direct' };
      }
    },
    [sessionSource],
  );

  /** Jalankan `task` sebagai satu-satunya operasi aktif (Run/Urutan Eksekusi tidak boleh tumpang tindih). */
  const exclusive = useCallback(async (task: () => Promise<void>) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    try {
      await task();
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, []);

  const run = useCallback(() => {
    const script = sql;
    void exclusive(async () => {
      const show = (result: ExecOutcome, partialChange: boolean) => {
        setOutcome(result);
        setPartial(partialChange);
        setApplied(null);
        setTab('result');
      };
      const tried = await trial(script);
      if (tried.kind === 'stopped') return show(tried.outcome, false);
      // Skrip yang hanya membaca: hasil salinan = hasil sebenarnya, tidak perlu dijalankan dua kali.
      if (tried.kind === 'done' && isReadOnlyScript(script)) return show(tried.outcome, false);
      // Skrip pengubah data (sudah terbukti selesai di salinan) atau worker tidak tersedia → jalankan di DB sesi.
      const result = runOnEngine(script);
      if (result) show(result, !result.ok && isMutatingSql(script));
    });
  }, [exclusive, runOnEngine, sql, trial]);

  const explain = useCallback(() => explainNow(false), [explainNow]);

  const visualize = useCallback(() => {
    if (!db) return;
    const script = sql;
    const version = dbVersion;
    void exclusive(async () => {
      // Langkah-langkahnya dijalankan di thread utama — pastikan dulu query-nya selesai di salinan.
      const tried = await trial(script);
      const plan: ExecPlan = tried.kind === 'stopped' ? stoppedPlan(tried.outcome) : planExecution(db, script);
      setSteps({ plan, sql: script, dbVersion: version });
      setTab('steps');
    });
  }, [db, sql, dbVersion, exclusive, trial]);

  const loadSql = useCallback((next: string) => {
    setSql(next);
    setOutcome(null);
    setPartial(false);
    setApplied(null);
    setTab('result');
  }, []);

  const loadAndVisualize = useCallback(
    (next: string) => {
      setSql(next);
      if (!db) return;
      setSteps({ plan: planExecution(db, next), sql: next, dbVersion });
      setTab('steps');
    },
    [db, dbVersion],
  );

  const applySuggestion = useCallback(
    (suggestion: string) => {
      const result = runOnEngine(suggestion);
      if (!result) return;
      setApplied({ sql: suggestion, outcome: result });
      // engine.run menaikkan dbVersion untuk setiap statement pengubah (CREATE …), bahkan yang gagal →
      // efek di atas menjalankan Explain ulang dengan skema terbaru (dan plan tidak dianggap usang).
      if (result.ok || isMutatingSql(suggestion)) reexplainPending.current = true;
    },
    [runOnEngine],
  );

  const resetDatabase = useCallback(() => {
    resetEngine();
    setOutcome(null);
    setPartial(false);
    setApplied(null);
  }, [resetEngine]);

  let staleness: PlanStaleness = null;
  if (plan && plan.sql !== sql) staleness = 'sql';
  else if (plan && plan.dbVersion !== dbVersion) staleness = 'db';

  const stepsStale = steps !== null && (steps.sql !== sql || steps.dbVersion !== dbVersion);

  const cancel = useCallback(() => sqlGuard.cancel(), []);

  return {
    sql,
    setSql,
    outcome,
    partial,
    plan,
    staleness,
    steps,
    stepsStale,
    applied,
    tab,
    setTab,
    running,
    cancel,
    run,
    explain,
    visualize,
    loadAndVisualize,
    loadSql,
    applySuggestion,
    resetDatabase,
  };
}
