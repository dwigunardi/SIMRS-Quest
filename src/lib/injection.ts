/**
 * Lab SQL injection: mensimulasikan server yang membangun query dari input form.
 * - Mode RENTAN: input disambung mentah-mentah ke template (string concatenation).
 * - Mode AMAN: template memakai placeholder `?` dan input di-bind (prepared statement).
 * Setiap percobaan memakai database seed segar, jadi payload destruktif (mis. "; DROP TABLE ...")
 * tidak memengaruhi apa pun di luar percobaan itu.
 */
import type { Database, SqlJsStatic } from 'sql.js';
import type {
  CellValue,
  CheckResult,
  CheckView,
  ExecFailure,
  ExecOutcome,
  InjectionGoal,
  InjectionLab,
  InjectionMission,
  InjectionRun,
  QueryResult,
  RequiredPattern,
} from '../types';
import { cellsEqual } from './compare';
import { findMissingPatterns } from './requiredPatterns';
import { createSeededDatabase, executePrepared, executeSql } from './sqlEngine';

const VIEW: CheckView = {
  actualLabel: 'Data yang tampil di halaman',
  expectedLabel: 'Target serangan',
};

/**
 * Penyambungan string mentah, persis seperti kode server yang rentan.
 * Pengganti berupa FUNGSI (bukan string) agar `$&`, `$'`, `$$` di input tidak ditafsirkan
 * sebagai pola pengganti — input harus masuk apa adanya.
 */
export function buildVulnerableSql(lab: InjectionLab, input: string): string {
  return lab.vulnerableTemplate.replaceAll('{input}', () => input);
}

function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function describeSafeExecution(lab: InjectionLab, input: string): string {
  return `${lab.safeTemplate}\n-- parameter ?1 = ${sqlStringLiteral(input)} (dikirim terpisah sebagai DATA, bukan bagian dari teks SQL)`;
}

function lastResult(outcome: ExecOutcome): QueryResult | null {
  if (!outcome.ok) return null;
  return outcome.results[outcome.results.length - 1] ?? null;
}

function containsValue(result: QueryResult, value: CellValue): boolean {
  return result.rows.some((row) => row.some((cell) => cellsEqual(cell, value)));
}

/**
 * Nilai pembanding target (kolom pertama `referenceSql` pada DB seed segar), dihitung SEBELUM payload
 * dijalankan agar payload bertumpuk tidak bisa mengubahnya. Kosong untuk jenis target lain.
 */
function referenceValues(db: Database, goal: InjectionGoal): CellValue[] {
  if (goal.type !== 'contains-all-values') return [];
  const outcome = executeSql(db, goal.referenceSql);
  if (!outcome.ok) throw new Error(`referenceSql target lab gagal dijalankan: ${outcome.rawError}`);
  const rows = outcome.results[outcome.results.length - 1]?.rows ?? [];
  return rows.map((row) => row[0] ?? null);
}

interface GoalContext {
  goal: InjectionGoal;
  /** Nilai yang wajib tampil (khusus 'contains-all-values'). */
  reference: readonly CellValue[];
}

function countFound(result: QueryResult, values: readonly CellValue[]): number {
  return values.filter((value) => containsValue(result, value)).length;
}

/** Target keluaran tercapai? Dinilai pada result set TERAKHIR (yang ditampilkan halaman). */
function isOutputGoalMet({ goal, reference }: GoalContext, result: QueryResult | null): boolean {
  if (!result) return false;
  switch (goal.type) {
    case 'row-count-at-least':
      return result.rows.length >= goal.count;
    case 'contains-value':
      return containsValue(result, goal.value);
    case 'contains-all-values':
      return reference.length > 0 && countFound(result, reference) === reference.length;
    default: {
      const unreachable: never = goal;
      return unreachable;
    }
  }
}

function progressText({ goal, reference }: GoalContext, result: QueryResult | null): string {
  const rows = result?.rows.length ?? 0;
  switch (goal.type) {
    case 'row-count-at-least':
      return `Halaman baru menampilkan ${rows} baris, padahal targetnya minimal ${goal.count} baris.`;
    case 'contains-value':
      return `Halaman menampilkan ${rows} baris, tetapi nilai ${String(goal.value)} belum muncul di data mana pun.`;
    case 'contains-all-values': {
      const found = result ? countFound(result, reference) : 0;
      return `Halaman menampilkan ${rows} baris, tetapi baru ${found} dari ${reference.length} data target yang muncul.`;
    }
    default: {
      const unreachable: never = goal;
      return unreachable;
    }
  }
}

const VULNERABLE_RETRY_TIP =
  'Perhatikan SQL yang dieksekusi server di atas. Jika input kamu masih utuh di dalam tanda kutip, berarti ia masih diperlakukan sebagai nilai biasa: tutup dulu tanda kutip pembuka dari template. Jika struktur query sudah berubah tetapi target belum tercapai, periksa logika yang kamu sisipkan (OR vs AND, kolom yang diambil), dan matikan sisa template dengan komentar -- bila perlu.';

const SAFE_MODE_LESSON =
  'Mode aman memakai prepared statement: payload kamu dikirim sebagai DATA melalui parameter ?, bukan disambung ke teks SQL. Tanda kutip, OR, UNION, maupun -- di dalamnya hanya dicocokkan sebagai teks biasa, jadi struktur query tidak berubah dan serangan gagal. Inilah pertahanan yang benar terhadap SQL injection.';

const ERROR_LEAK_NOTE =
  'Catatan keamanan: pesan error database yang bocor ke halaman adalah kebocoran informasi tersendiri, karena penyerang jadi tahu bentuk query di server. Untuk melanjutkan serangan, seimbangkan tanda kutip atau matikan sisa query dengan komentar --.';

interface GoalVerdict {
  met: boolean;
  /** Pesan umpan balik jika belum tercapai di mode rentan. */
  message: string;
}

/** Target tercapai di mode rentan: keluaran sesuai DAN konstruksi wajib ada di SQL yang dieksekusi. */
function judgeVulnerable(
  ctx: GoalContext,
  result: QueryResult | null,
  executedSql: string,
  required: readonly RequiredPattern[] | undefined,
): GoalVerdict {
  if (!isOutputGoalMet(ctx, result)) return { met: false, message: `${progressText(ctx, result)} ${VULNERABLE_RETRY_TIP}` };
  const missing = findMissingPatterns(executedSql, required);
  if (missing.length > 0) return { met: false, message: missing.map((p) => p.message).join(' ') };
  return { met: true, message: '' };
}

function buildCheck(outcome: ExecOutcome, goal: InjectionGoal, safeMode: boolean, verdict: GoalVerdict): CheckResult {
  if (!outcome.ok) {
    const friendlyError = safeMode ? outcome.friendlyError : `${outcome.friendlyError}\n\n${ERROR_LEAK_NOTE}`;
    return { kind: 'error', rawError: outcome.rawError, friendlyError };
  }

  const actual = lastResult(outcome);
  const view: CheckView = { ...VIEW, note: `Target: ${goal.description}` };
  if (verdict.met && actual) {
    return { kind: 'correct', actual, expected: null, elapsedMs: outcome.elapsedMs, view };
  }

  const message = safeMode ? SAFE_MODE_LESSON : verdict.message;
  return {
    kind: 'wrong',
    actual,
    expected: null,
    compare: { match: false, reason: 'goal-not-met', message, firstDiff: null },
    elapsedMs: outcome.elapsedMs,
    view,
  };
}

const NOT_MET: GoalVerdict = { met: false, message: '' };

/** Percobaan yang dihentikan sebelum selesai (batas waktu / dibatalkan) — tampil sebagai error, target tidak tercapai. */
export function stoppedInjectionRun(mission: InjectionMission, input: string, safeMode: boolean, outcome: ExecFailure): InjectionRun {
  const executedSql = safeMode ? describeSafeExecution(mission.lab, input) : buildVulnerableSql(mission.lab, input);
  return {
    executedSql,
    safeMode,
    outcome,
    goalMet: false,
    check: { kind: 'error', rawError: outcome.rawError, friendlyError: outcome.friendlyError },
  };
}

/** Satu percobaan serangan (atau input normal) terhadap form simulasi. */
export function runInjection(SQL: SqlJsStatic, mission: InjectionMission, input: string, safeMode: boolean): InjectionRun {
  const { lab } = mission;
  const db = createSeededDatabase(SQL);
  try {
    const ctx: GoalContext = { goal: lab.goal, reference: referenceValues(db, lab.goal) };
    const executedSql = safeMode ? describeSafeExecution(lab, input) : buildVulnerableSql(lab, input);
    const outcome = safeMode ? executePrepared(db, lab.safeTemplate, [input]) : executeSql(db, executedSql);
    const verdict: GoalVerdict =
      safeMode || !outcome.ok ? NOT_MET : judgeVulnerable(ctx, lastResult(outcome), executedSql, lab.requiredPatterns);
    return { executedSql, safeMode, outcome, goalMet: verdict.met, check: buildCheck(outcome, lab.goal, safeMode, verdict) };
  } finally {
    db.close();
  }
}
