/**
 * Analisis EXPLAIN QUERY PLAN: apakah sebuah query memakai index milik tabel tertentu?
 *
 * Aturan (berdasarkan probe SQLite 3.54.1):
 * - Baris plan yang relevan berbentuk `SCAN <obj> ...` atau `SEARCH <obj> ...`,
 *   dengan <obj> = nama tabel ATAU alias-nya (mis. "SEARCH k USING INDEX idx_kunjungan_tgl (...)").
 * - Baris dianggap milik tabel T bila menyebut NAMA index milik T (dari PRAGMA index_list,
 *   kebal alias), atau bila <obj> adalah nama/alias T yang terdeteksi di teks SQL.
 * - `SCAN` apa pun pada T = full scan, TERMASUK "SCAN t USING [COVERING] INDEX ..."
 *   (itu menelusuri seluruh index, mis. untuk COUNT(*) atau ORDER BY tanpa filter).
 * - `SEARCH` pada T dihitung memakai index bila menyebut index milik T, atau
 *   "USING INTEGER PRIMARY KEY"/"USING PRIMARY KEY" dan <obj> adalah nama/alias T (pencarian rowid T).
 *   "USING AUTOMATIC ... INDEX" TIDAK dihitung (index sementara yang dibangun dengan scan).
 * - Query dinyatakan memakai index T jika ada ≥1 SEARCH ber-index pada T dan TIDAK ada SCAN pada T.
 */
import type { Database } from 'sql.js';
import type { QueryResult } from '../types';
import { explainQueryPlan, readIndexes, stripCommentsAndStrings } from './sqlEngine';

export interface PlanFailure {
  ok: false;
  rawError: string;
  friendlyError: string;
}

export type PlanRead = { ok: true; lines: string[] } | PlanFailure;

export interface PlanAnalysis {
  ok: true;
  /** true jika plan melakukan SEARCH ber-index pada tabel dan tidak ada full SCAN pada tabel itu. */
  usesIndex: boolean;
  /** true jika ada baris SCAN (full scan) pada tabel. */
  fullScan: boolean;
  lines: string[];
}

/** Baris `detail` dari EXPLAIN QUERY PLAN statement pertama `sql`. */
export function readPlan(db: Database, sql: string): PlanRead {
  const outcome = explainQueryPlan(db, sql);
  if (!outcome.ok) return { ok: false, rawError: outcome.rawError, friendlyError: outcome.friendlyError };

  const result = outcome.results[0];
  if (!result) return { ok: true, lines: [] };
  const detailIdx = result.columns.indexOf('detail');
  const lines = result.rows.map((row) => String(row[detailIdx] ?? ''));
  return { ok: true, lines };
}

/** Tabel satu kolom "detail" untuk ditampilkan sebagai actual/expected. */
export function planToResult(lines: readonly string[]): QueryResult {
  return { columns: ['detail'], rows: lines.map((line) => [line]) };
}

/** Catatan teks query plan untuk CheckView.note. */
export function formatPlanNote(lines: readonly string[]): string {
  const body = lines.length > 0 ? lines.map((line) => `  ${line}`).join('\n') : '  (plan kosong)';
  return `Query plan (EXPLAIN QUERY PLAN):\n${body}`;
}

/** Kata kunci yang bisa muncul setelah nama tabel tetapi bukan alias. */
export const NON_ALIAS_WORDS: ReadonlySet<string> = new Set([
  'AS', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL', 'OUTER', 'ON', 'USING',
  'GROUP', 'ORDER', 'LIMIT', 'OFFSET', 'UNION', 'EXCEPT', 'INTERSECT', 'WINDOW', 'HAVING', 'SET',
  'VALUES', 'INDEXED', 'NOT', 'SELECT', 'FROM', 'WHEN', 'THEN', 'ELSE', 'END', 'AND', 'OR',
  'RETURNING', 'DEFAULT', 'WITH', 'LATERAL',
]);

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Nama tabel + alias yang dipakai untuknya di teks SQL (mis. "kunjungan k", "kunjungan AS k"). */
export function tableAliases(sql: string, table: string): Set<string> {
  const names = new Set<string>([table.toLowerCase()]);
  const pattern = new RegExp(`\\b${escapeRegex(table)}\\b(?:\\s+AS)?\\s+([A-Za-z_][A-Za-z0-9_]*)`, 'gi');
  for (const match of stripCommentsAndStrings(sql).matchAll(pattern)) {
    const alias = match[1];
    if (alias && !NON_ALIAS_WORDS.has(alias.toUpperCase())) names.add(alias.toLowerCase());
  }
  return names;
}

const PLAN_ACCESS = /^(SCAN|SEARCH)\s+(?:TABLE\s+)?(\S+)(?:\s+AS\s+(\S+))?/i;
const PLAN_INDEX = /\bUSING\s+(?:COVERING\s+)?INDEX\s+(\S+)/i;
const PLAN_ROWID = /\bUSING\s+(?:INTEGER\s+)?PRIMARY\s+KEY\b/i;

/** Analisis baris plan terhadap tabel `table` (lihat aturan di header file). */
export function analyzePlanLines(
  lines: readonly string[],
  indexNames: ReadonlySet<string>,
  aliases: ReadonlySet<string>,
): Pick<PlanAnalysis, 'usesIndex' | 'fullScan'> {
  let fullScan = false;
  let indexedSearch = false;

  for (const line of lines) {
    const access = PLAN_ACCESS.exec(line.trim());
    if (!access) continue;

    const objects = [access[2], access[3]].filter((o): o is string => Boolean(o)).map((o) => o.toLowerCase());
    const byName = objects.some((o) => aliases.has(o));
    const indexName = PLAN_INDEX.exec(line)?.[1]?.toLowerCase();
    const byIndex = indexName !== undefined && indexNames.has(indexName);
    if (!byName && !byIndex) continue;

    if (access[1]?.toUpperCase() === 'SCAN') {
      fullScan = true;
      continue;
    }
    if (byIndex || (byName && PLAN_ROWID.test(line))) indexedSearch = true;
  }

  return { usesIndex: indexedSearch && !fullScan, fullScan };
}

/** Nama index (huruf kecil) milik tabel. */
export function tableIndexNames(db: Database, table: string): Set<string> {
  return new Set(readIndexes(db, table).map((idx) => idx.name.toLowerCase()));
}

/** Apakah plan `sql` memakai index milik `table` (tanpa full scan pada tabel itu)? */
export function analyzeQueryPlan(db: Database, sql: string, table: string): PlanAnalysis | PlanFailure {
  const plan = readPlan(db, sql);
  if (!plan.ok) return plan;
  const verdict = analyzePlanLines(plan.lines, tableIndexNames(db, table), tableAliases(sql, table));
  return { ok: true, ...verdict, lines: plan.lines };
}

export type ColumnIndexStatus = 'full' | 'partial-only' | 'none';

/**
 * Index di `table` yang kolom PERTAMA-nya `column` (case-insensitive): 'full' jika ada index biasa,
 * 'partial-only' jika yang ada hanya partial index (CREATE INDEX ... WHERE ...), 'none' jika tidak ada.
 */
export function columnIndexStatus(db: Database, table: string, column: string): ColumnIndexStatus {
  const target = column.toLowerCase();
  const matching = readIndexes(db, table).filter((idx) => idx.columns[0]?.toLowerCase() === target);
  if (matching.some((idx) => !idx.partial)) return 'full';
  return matching.length > 0 ? 'partial-only' : 'none';
}

/* ------------------------------------------------------------------ */
/* Sargability terhadap satu kolom                                     */
/* ------------------------------------------------------------------ */

/**
 * - 'bounded'   : SEARCH lewat index berawalan kolom itu dengan kesamaan (`col=?`) atau rentang dua sisi
 *                 (`col>? AND col<?`; >= dan BETWEEN juga ditampilkan SQLite sebagai > dan <).
 * - 'one-sided' : SEARCH lewat index itu, tetapi hanya rentang satu sisi (`col>?`), sehingga yang dibaca
 *                 tetap semua baris dari batas itu sampai ujung index.
 * - 'none'      : index berawalan kolom itu tidak dipakai untuk SEARCH (mungkin index lain yang dipakai).
 */
export type ColumnSearch = 'bounded' | 'one-sided' | 'none';

export interface ColumnSearchAnalysis {
  ok: true;
  /** Tidak ada full SCAN pada tabel. */
  noFullScan: boolean;
  search: ColumnSearch;
  lines: string[];
}

const PLAN_INDEX_CONSTRAINTS = /\bUSING\s+(?:COVERING\s+)?INDEX\s+(\S+)\s+\(([^)]*)\)/i;

/** Nama index (huruf kecil, bukan partial) di `table` yang kolom pertamanya `column`. */
function indexNamesOnColumn(db: Database, table: string, column: string): Set<string> {
  const target = column.toLowerCase();
  return new Set(
    readIndexes(db, table)
      .filter((idx) => !idx.partial && idx.columns[0]?.toLowerCase() === target)
      .map((idx) => idx.name.toLowerCase()),
  );
}

/** Klasifikasi baris plan terhadap index berawalan `column` (lihat ColumnSearch). */
export function classifyColumnSearch(lines: readonly string[], indexNames: ReadonlySet<string>, column: string): ColumnSearch {
  const col = escapeRegex(column);
  const equality = new RegExp(`\\b${col}=\\?`, 'i');
  const lower = new RegExp(`\\b${col}>\\?`, 'i');
  const upper = new RegExp(`\\b${col}<\\?`, 'i');
  let best: ColumnSearch = 'none';

  for (const line of lines) {
    if (!/^\s*SEARCH\b/i.test(line)) continue;
    const match = PLAN_INDEX_CONSTRAINTS.exec(line);
    const indexName = match?.[1]?.toLowerCase();
    const constraints = match?.[2] ?? '';
    if (!indexName || !indexNames.has(indexName)) continue;

    const hasLower = lower.test(constraints);
    const hasUpper = upper.test(constraints);
    if (equality.test(constraints) || (hasLower && hasUpper)) return 'bounded';
    if (hasLower || hasUpper) best = 'one-sided';
  }
  return best;
}

/** Analisis plan `sql`: apakah `table` dicari lewat index berawalan `column` dengan batas yang jelas? */
export function analyzeColumnSearch(db: Database, sql: string, table: string, column: string): ColumnSearchAnalysis | PlanFailure {
  const plan = readPlan(db, sql);
  if (!plan.ok) return plan;
  const { fullScan } = analyzePlanLines(plan.lines, tableIndexNames(db, table), tableAliases(sql, table));
  const search = classifyColumnSearch(plan.lines, indexNamesOnColumn(db, table, column), column);
  return { ok: true, noFullScan: !fullScan, search, lines: plan.lines };
}

/** Kata kunci yang bisa diikuti "(" tetapi bukan pemanggilan fungsi. */
export const NOT_FUNCTIONS: ReadonlySet<string> = new Set([
  'AND', 'OR', 'NOT', 'WHERE', 'ON', 'IN', 'BETWEEN', 'WHEN', 'THEN', 'ELSE', 'SELECT', 'FROM', 'BY',
  'HAVING', 'AS', 'IS', 'EXISTS', 'VALUES', 'CASE', 'USING', 'JOIN', 'DISTINCT', 'ALL', 'UNION', 'LIKE', 'GLOB',
]);

/**
 * Nama fungsi pertama yang membungkus `column` secara langsung di SQL (mis. "strftime" pada
 * `strftime('%Y-%m', tgl_kunjungan)` atau "date" pada `date(k.tgl_kunjungan)`), atau null.
 * Komentar & string literal diabaikan.
 */
export function findWrappingFunction(sql: string, column: string): string | null {
  const pattern = new RegExp(
    `\\b([A-Za-z_][A-Za-z0-9_]*)\\s*\\(\\s*(?:''\\s*,\\s*)*(?:[A-Za-z_][A-Za-z0-9_]*\\.)?${escapeRegex(column)}\\b`,
    'gi',
  );
  for (const match of stripCommentsAndStrings(sql).matchAll(pattern)) {
    const name = match[1];
    if (name && !NOT_FUNCTIONS.has(name.toUpperCase())) return name;
  }
  return null;
}
