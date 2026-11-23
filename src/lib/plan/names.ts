/** Explain: resolusi nama objek di baris plan (alias, CTE, view, subquery). */
import type { TableInfo } from '../../types';
import { NON_ALIAS_WORDS } from '../queryPlan';
import { MAIN_VERB, escapeRegex, normalizeSql, unique } from './sqlText';
import type { SchemaContext } from './schema';

/* ------------------------------------------------------------------ */
/* Resolusi nama objek di baris plan (alias, CTE, view, subquery)      */
/* ------------------------------------------------------------------ */

export interface AliasOccurrence {
  table: string;
  /** Berada di dalam tanda kurung (subquery/CTE/view) — dicocokkan dengan baris plan bersarang. */
  nested: boolean;
}

export interface AliasEntry {
  all: AliasOccurrence[];
  /** Kemunculan yang belum "dipakai" baris plan (untuk alias ambigu yang dipakai >1 tabel). */
  remaining: AliasOccurrence[];
}

export interface NameScope {
  ctes: Set<string>;
  aliases: Map<string, AliasEntry>;
  /** Tabel (huruf kecil) yang tertulis di statement (atau di view yang dipakainya). */
  mentioned: Set<string>;
}

export const CTE_NAME = /(?:\bWITH(?:\s+RECURSIVE)?|,)\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\([^()]*\))?\s*AS\s+(?:NOT\s+)?(?:MATERIALIZED\s+)?\(/gi;

/** Nama CTE (huruf kecil) yang didefinisikan di teks ter-normalisasi. */
export function cteNames(clean: string): Set<string> {
  const names = new Set<string>();
  for (const match of clean.matchAll(CTE_NAME)) {
    const name = match[1];
    if (name) names.add(name.toLowerCase());
  }
  return names;
}

export function mentions(text: string, name: string): boolean {
  return new RegExp(`\\b${escapeRegex(name)}\\b`, 'i').test(text);
}

/** Teks statement + definisi view yang dipakainya (rekursif), view ditandai bersarang. */
export function expandViews(clean: string, schema: SchemaContext): { text: string; viewText: string } {
  const seen = new Set<string>();
  const queue = [clean];
  const parts: string[] = [];
  while (queue.length > 0) {
    const text = queue.pop() ?? '';
    for (const [name, definition] of schema.views) {
      if (seen.has(name) || !mentions(text, name)) continue;
      seen.add(name);
      parts.push(definition);
      queue.push(definition);
    }
  }
  return { text: clean, viewText: parts.join(' ; ') };
}

export const CLAUSE_WORDS: ReadonlySet<string> = new Set(['SELECT', 'FROM', 'JOIN', 'WHERE', 'ON', 'GROUP', 'ORDER', 'HAVING', 'SET', 'VALUES', 'LIMIT', 'WINDOW', 'RETURNING']);

/**
 * Apakah posisi `pos` berada di dalam subquery EKSPRESI (IN (…), EXISTS (…), subquery skalar, badan CTE)?
 * Tabel turunan di FROM/JOIN (`FROM (SELECT …) s`) tidak dihitung bersarang, karena SQLite sering
 * meratakannya (flatten) sehingga barisnya muncul di tingkat atas plan.
 */
export function inExpressionSubquery(text: string, pos: number): boolean {
  const stack: boolean[] = [];
  const clauses: string[] = [''];
  let prevToken = '';
  /** Sedang berada di daftar CTE (WITH … AS (…), …) tingkat atas. */
  let inWith = false;
  let i = 0;
  while (i < pos) {
    const ch = text[i] ?? '';
    if (/[A-Za-z_]/.test(ch)) {
      const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i))?.[0] ?? ch;
      const upper = word.toUpperCase();
      if (CLAUSE_WORDS.has(upper)) clauses[clauses.length - 1] = upper;
      if (stack.length === 0) {
        if (upper === 'WITH') inWith = true;
        else if (MAIN_VERB.test(upper)) inWith = false;
      }
      prevToken = upper;
      i += word.length;
      continue;
    }
    if (ch === '(') {
      const clause = clauses[clauses.length - 1] ?? '';
      // Badan CTE juga diperlakukan seperti tabel turunan: SQLite sering meratakannya atau menjalankannya
      // sebagai co-routine yang dibaca di tingkat atas.
      const cteBody = inWith && stack.length === 0 && (prevToken === 'AS' || prevToken === 'MATERIALIZED');
      const derived = cteBody || prevToken === 'FROM' || prevToken === 'JOIN' || (prevToken === ',' && (clause === 'FROM' || clause === 'JOIN'));
      stack.push(!derived);
      clauses.push('');
      prevToken = '(';
    } else if (ch === ')') {
      stack.pop();
      if (clauses.length > 1) clauses.pop();
      prevToken = ')';
    } else if (!/\s/.test(ch)) {
      prevToken = ch;
    }
    i += 1;
  }
  return stack.some(Boolean);
}

export function collectAliases(text: string, schema: SchemaContext): Array<{ pos: number; alias: string; occurrence: AliasOccurrence }> {
  const found: Array<{ pos: number; alias: string; occurrence: AliasOccurrence }> = [];
  for (const table of schema.tables.values()) {
    const pattern = new RegExp(`\\b${escapeRegex(table.name)}\\b(?:\\s+AS)?\\s+([A-Za-z_][A-Za-z0-9_]*)`, 'gi');
    for (const match of text.matchAll(pattern)) {
      const alias = match[1]?.toLowerCase();
      if (!alias || NON_ALIAS_WORDS.has(alias.toUpperCase()) || alias === table.name.toLowerCase()) continue;
      const pos = match.index ?? 0;
      found.push({ pos, alias, occurrence: { table: table.name, nested: inExpressionSubquery(text, pos) } });
    }
  }
  return found;
}

export function buildScope(sql: string, schema: SchemaContext): NameScope {
  const clean = normalizeSql(sql);
  const { text, viewText } = expandViews(clean, schema);
  const found = [...collectAliases(text, schema).sort((a, b) => a.pos - b.pos), ...collectAliases(viewText, schema).sort((a, b) => a.pos - b.pos)];

  const aliases = new Map<string, AliasEntry>();
  for (const { alias, occurrence } of found) {
    const entry = aliases.get(alias) ?? { all: [], remaining: [] };
    entry.all.push(occurrence);
    entry.remaining.push(occurrence);
    aliases.set(alias, entry);
  }

  const combined = `${text} ; ${viewText}`;
  const mentioned = new Set<string>();
  for (const table of schema.tables.values()) {
    if (mentions(combined, table.name)) mentioned.add(table.name.toLowerCase());
  }
  return { ctes: cteNames(combined), aliases, mentioned };
}

export type Source =
  | { type: 'table'; table: TableInfo }
  | { type: 'subquery' }
  | { type: 'cte'; name: string }
  | { type: 'unknown'; name: string };

/**
 * Alias ambigu (satu alias untuk beberapa tabel berbeda): setiap baris plan "memakai" satu kemunculan,
 * mengutamakan kemunculan dengan tingkat sarang yang sama (baris plan bersarang ↔ alias di dalam kurung).
 * Bila tabel sudah pasti (lewat nama index), kemunculan tabel itu yang dipakai.
 */
export function takeAliasTable(entry: AliasEntry, nested: boolean, known: string | null, hintColumns: readonly string[], schema: SchemaContext): string | null {
  const distinct = unique(entry.all.map((o) => o.table));
  if (distinct.length === 1) return distinct[0] ?? null;
  const pick = (predicate: (o: AliasOccurrence) => boolean): AliasOccurrence | null => {
    const index = entry.remaining.findIndex(predicate);
    if (index === -1) return null;
    const [taken] = entry.remaining.splice(index, 1);
    return taken ?? null;
  };
  // Kemunculan untuk baris yang tabelnya pasti (lewat nama index) sudah dipesan di awal (reserveKnownAliases).
  if (known) return known;
  if (hintColumns.length > 0) {
    // Kolom di syarat pencarian (mis. "(nama_dokter=?)") hanya cocok dengan tabel yang punya kolom itu.
    const hasColumns = (tableName: string): boolean => {
      const columns = new Set(schema.tables.get(tableName.toLowerCase())?.columns.map((c) => c.name.toLowerCase()) ?? []);
      return hintColumns.every((c) => columns.has(c.toLowerCase()));
    };
    const fitting = unique(entry.remaining.filter((o) => hasColumns(o.table)).map((o) => o.table));
    const fittingAll = fitting.length > 0 ? fitting : unique(entry.all.filter((o) => hasColumns(o.table)).map((o) => o.table));
    const only = fittingAll.length === 1 ? fittingAll[0] : undefined;
    if (only) return pick((o) => o.table === only)?.table ?? only;
  }
  const taken = pick((o) => o.nested === nested) ?? pick(() => true);
  return taken?.table ?? entry.all[entry.all.length - 1]?.table ?? null;
}

export function resolveSource(
  names: readonly string[],
  scope: NameScope,
  schema: SchemaContext,
  nested: boolean,
  known: TableInfo | null,
  hintColumns: readonly string[] = [],
  cteResults: ReadonlySet<string> = new Set(),
): Source {
  const primary = names[0] ?? '';
  if (primary.startsWith('(')) return { type: 'subquery' };
  for (const raw of names) {
    const name = raw.toLowerCase();
    // "SCAN x" di luar CO-ROUTINE/MATERIALIZE x membaca HASIL CTE x, walau ada alias tabel bernama x.
    if (!known && scope.ctes.has(name) && cteResults.has(name)) return { type: 'cte', name: raw };
    // Alias tabel didahulukan dari nama CTE (alias "k" untuk kunjungan menutupi CTE bernama k);
    // CTE tetap menutupi tabel fisik bernama sama.
    const entry = scope.aliases.get(name);
    if (entry) {
      const tableName = takeAliasTable(entry, nested, known?.name ?? null, hintColumns, schema);
      const table = tableName ? schema.tables.get(tableName.toLowerCase()) : undefined;
      if (table) return { type: 'table', table: known ?? table };
    }
    if (scope.ctes.has(name)) return { type: 'cte', name: raw };
    const direct = schema.tables.get(name);
    if (direct) return { type: 'table', table: known ?? direct };
  }
  if (known) return { type: 'table', table: known };
  return { type: 'unknown', name: primary };
}
