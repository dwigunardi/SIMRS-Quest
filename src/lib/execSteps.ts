/**
 * Visualisasi URUTAN EKSEKUSI LOGIS sebuah SELECT:
 *   WITH → FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT
 * Setiap langkah ditampilkan sebagai tabel antara. Tabel itu dihitung dengan menjalankan SELECT
 * turunan (potongan query user) di database, jadi angkanya selalu konsisten dengan SQLite, dan
 * langkah terakhir SELALU menjalankan query asli apa adanya.
 *
 * Batasan: satu SELECT tingkat atas (tanpa UNION/INTERSECT/EXCEPT). Subquery tetap berjalan
 * sebagai bagian dari ekspresi, tetapi isinya tidak dipecah per langkah.
 */
import type { Database } from 'sql.js';
import {
  clauseBody,
  clauseText,
  parseSelect,
  quoteIdent,
  significantTokens,
  splitTerms,
  stripComments,
  unquoteIdent,
  type FromSource,
  type ParsedSelect,
  type Tok,
} from './exec/parseSelect';
import { splitStatements, toFriendlyError, withQueryOnly } from './sqlEngine';
import type { CellValue, ExecFailure } from '../types';

export type StepKind = 'with' | 'from' | 'join' | 'where' | 'group' | 'having' | 'select' | 'distinct' | 'order' | 'limit';

export interface StepTable {
  columns: string[];
  /** Maksimal DISPLAY_ROWS baris pertama. */
  rows: CellValue[][];
  /** Jumlah baris sebenarnya (bisa lebih besar dari rows.length). */
  total: number;
  /** true jika penghitungan dihentikan di COUNT_LIMIT (total = batas bawah). */
  totalCapped: boolean;
}

export interface ExecStep {
  kind: StepKind;
  /** Nomor urut eksekusi, mulai 1. */
  order: number;
  /** Label pendek untuk navigasi, mis. "FROM pasien p". */
  title: string;
  /** Potongan SQL yang dijalankan di langkah ini, seperti ditulis user. */
  clause: string;
  /** Penjelasan (boleh memakai `kode` dan **tebal**). */
  explanation: string;
  table: StepTable | null;
  /** Baris yang dibuang langkah ini (WHERE). */
  removed: StepTable | null;
  /** Jumlah baris/grup yang MASUK ke langkah ini (null untuk langkah pertama / tidak relevan). */
  rowsIn: number | null;
  /** Jumlah baris/grup yang KELUAR (untuk HAVING: grup yang lolos, bukan jumlah baris tabel). */
  rowsOut: number | null;
  /** Satuan rowsIn/rowsOut. */
  unit: 'baris' | 'grup';
  /** Kolom tabel yang disorot (kolom baru dari JOIN, kunci grup, kolom hasil hitungan, kunci urut). */
  highlight: number[];
  /** Kolom nomor grup → baris diwarnai berselang per grup. */
  groupColumn: number | null;
  /** Kolom status HAVING ('lolos' / 'dibuang'). */
  statusColumn: number | null;
  notes: string[];
  error: { raw: string; friendly: string } | null;
}

/** Klausa dalam urutan TULIS, beserta nomor urutan eksekusinya — untuk diagram "ditulis vs dijalankan". */
export interface WrittenClause {
  label: string;
  text: string;
  /** Nomor langkah eksekusi pertama klausa ini. */
  order: number;
}

export type ExecPlan =
  | { ok: true; sql: string; steps: ExecStep[]; written: WrittenClause[]; notes: string[] }
  | { ok: false; reason: 'empty' | 'not-select' | 'compound' | 'unsupported' | 'error'; message: string; rawError?: string };

export const DISPLAY_ROWS = 100;
export const COUNT_LIMIT = 100_000;
const REMOVED_ROWS = 50;

/* ------------------------------------------------------------------ */
/* Eksekusi                                                            */
/* ------------------------------------------------------------------ */

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function runTable(db: Database, sql: string, maxRows = DISPLAY_ROWS): StepTable {
  const stmt = db.prepare(sql);
  try {
    const columns = stmt.getColumnNames();
    const rows: CellValue[][] = [];
    let total = 0;
    let totalCapped = false;
    while (stmt.step()) {
      if (rows.length < maxRows) rows.push(stmt.get());
      total += 1;
      if (total >= COUNT_LIMIT) {
        totalCapped = true;
        break;
      }
    }
    return { columns, rows, total, totalCapped };
  } finally {
    stmt.free();
  }
}

function runCount(db: Database, sql: string): number {
  const stmt = db.prepare(`SELECT COUNT(*) FROM (${sql})`);
  try {
    return stmt.step() ? Number(stmt.get()[0] ?? 0) : 0;
  } finally {
    stmt.free();
  }
}

function columnNames(db: Database, sql: string): string[] {
  const stmt = db.prepare(sql);
  try {
    return stmt.getColumnNames();
  } finally {
    stmt.free();
  }
}

/* ------------------------------------------------------------------ */
/* Analisis ekspresi                                                   */
/* ------------------------------------------------------------------ */

const AGGREGATES = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'TOTAL', 'GROUP_CONCAT', 'STRING_AGG']);
const IMPLICIT_COLUMNS = ['rowid', 'oid', '_rowid_'];

/** Indeks token ')' penutup untuk '(' di `open`. */
function closingParen(tokens: readonly Tok[], open: number): number {
  const depth = tokens[open]?.depth ?? 0;
  for (let i = open + 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t?.text === ')' && t.depth === depth) return i;
  }
  return tokens.length - 1;
}

/** Rentang token yang berada di dalam subquery `( SELECT … )` — diabaikan saat analisis ekspresi luar. */
function subqueryMask(tokens: readonly Tok[]): boolean[] {
  const mask = tokens.map(() => false);
  tokens.forEach((t, i) => {
    if (t.text !== '(' || (tokens[i + 1]?.upper !== 'SELECT' && tokens[i + 1]?.upper !== 'WITH')) return;
    const close = closingParen(tokens, i);
    for (let j = i + 1; j < close; j++) mask[j] = true;
  });
  return mask;
}

/** Pemanggilan fungsi agregat (bukan window function) di sebuah ekspresi, seperti tertulis. */
export function aggregateCalls(text: string): string[] {
  const tokens = significantTokens(text);
  const mask = subqueryMask(tokens);
  const calls: string[] = [];
  tokens.forEach((t, i) => {
    if (mask[i] || !AGGREGATES.has(t.upper) || tokens[i + 1]?.text !== '(') return;
    const close = closingParen(tokens, i + 1);
    const after = tokens[close + 1];
    if (after?.upper === 'OVER' || (after?.upper === 'FILTER' && tokens[closingParen(tokens, close + 2) + 1]?.upper === 'OVER')) return;
    // MIN/MAX dengan ≥2 argumen adalah fungsi skalar biasa.
    const argDepth = (tokens[i + 1]?.depth ?? 0) + 1;
    const commas = tokens.slice(i + 2, close).filter((x) => x.text === ',' && x.depth === argDepth).length;
    if ((t.upper === 'MIN' || t.upper === 'MAX') && commas > 0) return;
    calls.push(text.slice(t.start, tokens[close]?.end ?? t.end));
  });
  return calls;
}

function hasWindowFunction(text: string): boolean {
  const tokens = significantTokens(text);
  const mask = subqueryMask(tokens);
  return tokens.some((t, i) => !mask[i] && t.upper === 'OVER');
}

/**
 * Ganti referensi alias kolom SELECT dengan ekspresinya (SQLite mengizinkan alias di WHERE/GROUP BY/
 * HAVING, tetapi kolom tabel bernama sama lebih diutamakan — aturan yang sama dipakai di sini).
 */
function substituteAliases(text: string, aliases: ReadonlyMap<string, string>, sourceColumns: ReadonlySet<string>): { text: string; used: string[] } {
  if (aliases.size === 0) return { text, used: [] };
  const tokens = significantTokens(text);
  const mask = subqueryMask(tokens);
  let out = '';
  let cursor = 0;
  const used: string[] = [];
  tokens.forEach((t, i) => {
    if (mask[i] || t.type !== 'identifier' || tokens[i - 1]?.text === '.' || tokens[i + 1]?.text === '.' || tokens[i + 1]?.text === '(') return;
    const name = unquoteIdent(t.text).toLowerCase();
    const expr = aliases.get(name);
    if (expr === undefined || sourceColumns.has(name)) return;
    out += `${text.slice(cursor, t.start)}(${expr})`;
    cursor = t.end;
    used.push(unquoteIdent(t.text));
  });
  return { text: out + text.slice(cursor), used };
}

/* ------------------------------------------------------------------ */
/* Penjelasan                                                          */
/* ------------------------------------------------------------------ */

function rowsWord(n: number, capped = false): string {
  return `${capped ? '≥' : ''}${n.toLocaleString('id-ID')} baris`;
}

function joinExplanation(source: FromSource, name: string): string {
  const tag = `\`${name}\``;
  switch (source.join) {
    case 'left':
      return `**LEFT JOIN**: setiap baris kiri dipasangkan dengan baris ${tag} yang cocok dengan syarat ON. Baris kiri yang TIDAK punya pasangan tetap ada, kolom ${tag}-nya diisi NULL.`;
    case 'right':
      return `**RIGHT JOIN**: kebalikan LEFT JOIN — semua baris ${tag} dipertahankan; kolom tabel kiri diisi NULL bila tidak ada pasangan.`;
    case 'full':
      return `**FULL OUTER JOIN**: baris kedua sisi dipertahankan; sisi yang tidak punya pasangan diisi NULL.`;
    case 'cross':
      return `**CROSS JOIN**: setiap baris dipasangkan dengan SETIAP baris ${tag} (perkalian kartesius).`;
    case 'comma':
      return `**Koma di FROM** = CROSS JOIN: setiap baris dipasangkan dengan SETIAP baris ${tag}. Syarat penggabungannya (jika ada) baru diterapkan di WHERE.`;
    case 'inner':
    case 'first':
      return `**${source.natural ? 'NATURAL ' : ''}JOIN** (INNER): setiap baris dipasangkan dengan baris ${tag} yang memenuhi syarat ${source.natural ? 'kolom bernama sama' : 'ON/USING'}. Baris yang tidak punya pasangan DIBUANG dari kedua sisi.`;
    default: {
      const unreachable: never = source.join;
      return unreachable;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Penyusunan langkah                                                  */
/* ------------------------------------------------------------------ */

interface Draft {
  kind: StepKind;
  title: string;
  clause: string;
  explain: (ctx: { table: StepTable; rowsIn: number | null; rowsOut: number }) => string;
  sql: string;
  /** Hitung baris yang keluar dengan query lain (mis. grup yang lolos HAVING). Default: jumlah baris tabel. */
  countSql?: string;
  removedSql?: string;
  unit?: 'baris' | 'grup';
  /** Satuan untuk rowsIn bila berbeda dari langkah sebelumnya. */
  inUnit?: 'baris' | 'grup';
  highlight?: (table: StepTable) => number[];
  groupColumn?: number;
  statusColumn?: (table: StepTable) => number;
  notes?: string[];
  /** Langkah ini tidak mengubah jumlah baris secara bermakna (WITH). */
  standalone?: boolean;
}

interface Context {
  parsed: ParsedSelect;
  /** "WITH … " + spasi, atau "". */
  w: string;
  /** Kolom setiap sumber FROM (kosong bila tidak bisa dibaca). */
  sourceColumns: Array<{ source: FromSource; columns: string[] }>;
  /** Daftar kolom terkualifikasi semua sumber FROM ("p"."no_rm" AS "p.no_rm", …) atau "*". */
  allColumns: string;
  sourceColumnNames: Set<string>;
  fromSql: string;
  whereSql: string;
  whereText: string | null;
  groupSql: string;
  keyExprs: string[];
  keyLabels: string[];
  havingText: string | null;
  havingSql: string;
  hasAggregate: boolean;
  aliasNotes: string[];
}

function qualifiedColumns(sources: ReadonlyArray<{ source: FromSource; columns: string[] }>): { sql: string; owners: number[] } {
  if (sources.some((s) => !s.source.qualifier)) return { sql: '*', owners: [] };
  const parts: string[] = [];
  const owners: number[] = [];
  sources.forEach((s, index) => {
    const q = s.source.qualifier ?? '';
    for (const column of s.columns) {
      parts.push(`${quoteIdent(q)}.${quoteIdent(column)} AS ${quoteIdent(`${q}.${column}`)}`);
      owners.push(index);
    }
  });
  return parts.length > 0 ? { sql: parts.join(', '), owners } : { sql: '*', owners: [] };
}

function withDrafts(parsed: ParsedSelect, w: string): Draft[] {
  return parsed.cteNames.map((name) => ({
    kind: 'with',
    title: `WITH ${name}`,
    clause: `${name} AS (…)`,
    sql: `${w}SELECT * FROM ${quoteIdent(name)}`,
    standalone: true,
    explain: ({ table }) =>
      `CTE \`${name}\` dihitung lebih dulu dan hasilnya (${rowsWord(table.total, table.totalCapped)}) bisa dipakai seperti tabel biasa oleh query utama.` +
      (parsed.recursive ? ' Pada WITH RECURSIVE, bagian rekursifnya dijalankan berulang sampai tidak ada baris baru.' : ''),
  }));
}

function fromDrafts(ctx: Context): Draft[] {
  const { parsed, w, sourceColumns: columnsBySource } = ctx;
  const fromClause = parsed.clauses.from;
  if (!fromClause) return [];
  return parsed.sources.map((source, index): Draft => {
    const upto = columnsBySource.slice(0, index + 1);
    const { sql: cols, owners } = qualifiedColumns(upto);
    const fromText = parsed.sql.slice(fromClause.bodyStart, source.end).trim();
    const name = source.qualifier ?? source.source;
    if (index === 0) {
      return {
        kind: 'from',
        title: `FROM ${source.source}`,
        clause: `FROM ${source.source}`,
        sql: `${w}SELECT ${cols} FROM ${fromText}`,
        explain: ({ table }) =>
          `Eksekusi dimulai dari **FROM**: SQLite mengambil semua baris \`${source.source}\` (${rowsWord(table.total, table.totalCapped)}). Belum ada penyaringan, pengelompokan, atau pemilihan kolom.`,
      };
    }
    const constraint = source.constraint ? ` ${source.constraint}` : '';
    return {
      kind: 'join',
      title: `${source.operator === ',' ? ',' : source.operator.toUpperCase()} ${source.source}`,
      clause: `${source.operator} ${source.source}${constraint}`,
      sql: `${w}SELECT ${cols} FROM ${fromText}`,
      highlight: () => owners.flatMap((owner, col) => (owner === index ? [col] : [])),
      explain: ({ table, rowsIn }) =>
        `${joinExplanation(source, name)} Hasil: ${rowsWord(rowsIn ?? 0)} → ${rowsWord(table.total, table.totalCapped)}.`,
    };
  });
}

function whereDraft(ctx: Context): Draft | null {
  const { w, allColumns, fromSql, whereText, parsed } = ctx;
  if (whereText === null) return null;
  return {
    kind: 'where',
    title: 'WHERE',
    clause: clauseText(parsed, 'where') ?? '',
    sql: `${w}SELECT ${allColumns}${fromSql}${ctx.whereSql}`,
    removedSql: `${w}SELECT ${allColumns}${fromSql} WHERE CASE WHEN (${whereText}) THEN 0 ELSE 1 END`,
    notes: ctx.aliasNotes,
    explain: ({ table, rowsIn }) => {
      const kept = table.total;
      const dropped = Math.max(0, (rowsIn ?? kept) - kept);
      return `**WHERE** memeriksa setiap baris SATU PER SATU. Hanya baris yang kondisinya bernilai TRUE yang lolos; hasil FALSE atau NULL dibuang. ${rowsWord(rowsIn ?? kept)} → ${rowsWord(kept, table.totalCapped)} (${dropped.toLocaleString('id-ID')} dibuang). Karena berjalan sebelum GROUP BY, WHERE tidak bisa memakai COUNT/SUM/AVG.`;
    },
  };
}

function groupDraft(ctx: Context): Draft | null {
  const { w, allColumns, fromSql, whereSql, parsed, keyExprs, keyLabels } = ctx;
  if (keyExprs.length > 0) {
    const orderBy = keyExprs.join(', ');
    const keyCols = keyExprs.map((expr, i) => `${expr} AS ${quoteIdent(`🔑 ${keyLabels[i] ?? expr}`)}`).join(', ');
    return {
      kind: 'group',
      title: 'GROUP BY',
      clause: clauseText(parsed, 'group') ?? '',
      sql: `${w}SELECT DENSE_RANK() OVER (ORDER BY ${orderBy}) AS "grup", ${keyCols}, ${allColumns}${fromSql}${whereSql} ORDER BY ${orderBy}`,
      countSql: `${w}SELECT 1${fromSql}${whereSql}${ctx.groupSql}`,
      unit: 'grup',
      inUnit: 'baris',
      groupColumn: 0,
      highlight: () => keyExprs.map((_, i) => i + 1),
      explain: ({ rowsIn, rowsOut }) =>
        `**GROUP BY** mengumpulkan baris yang nilai ${keyLabels.map((k) => `\`${k}\``).join(', ')}-nya sama ke dalam satu grup (warna berselang = grup berbeda). ${rowsWord(rowsIn ?? 0)} → ${rowsOut.toLocaleString('id-ID')} grup. Mulai tahap berikutnya setiap grup diperlakukan sebagai SATU baris, sehingga kolom di luar GROUP BY hanya bermakna lewat fungsi agregat (COUNT, SUM, AVG, …).`,
    };
  }
  if (!ctx.hasAggregate) return null;
  return {
    kind: 'group',
    title: 'Agregasi (tanpa GROUP BY)',
    clause: aggregateCalls(clauseBody(parsed, 'select') ?? '').join(', '),
    sql: `${w}SELECT 1 AS "grup", ${allColumns}${fromSql}${whereSql}`,
    countSql: `${w}SELECT 1`,
    unit: 'grup',
    inUnit: 'baris',
    groupColumn: 0,
    explain: ({ rowsIn }) =>
      `Ada fungsi agregat tetapi tidak ada GROUP BY, jadi SELURUH ${rowsWord(rowsIn ?? 0)} dianggap SATU grup. Hasil akhirnya pasti tepat 1 baris (meskipun tidak ada baris yang lolos WHERE).`,
  };
}

function havingDraft(ctx: Context): Draft | null {
  const { w, fromSql, whereSql, groupSql, parsed, keyExprs, keyLabels, havingText } = ctx;
  if (havingText === null) return null;
  const aggs = [...new Set(aggregateCalls(havingText))].filter((a) => a.replace(/\s+/g, '').toUpperCase() !== 'COUNT(*)');
  const cols = [
    ...keyExprs.map((expr, i) => `${expr} AS ${quoteIdent(keyLabels[i] ?? expr)}`),
    'COUNT(*) AS "COUNT(*)"',
    ...aggs.map((a) => `${a} AS ${quoteIdent(a)}`),
    `CASE WHEN (${havingText}) THEN 'lolos' ELSE 'dibuang' END AS "HAVING"`,
  ];
  const orderBy = keyExprs.length > 0 ? ` ORDER BY ${keyExprs.join(', ')}` : '';
  return {
    kind: 'having',
    title: 'HAVING',
    clause: clauseText(parsed, 'having') ?? '',
    sql: `${w}SELECT ${cols.join(', ')}${fromSql}${whereSql}${groupSql}${orderBy}`,
    // COUNT(*) (bukan 1) agar tetap query agregat walau tanpa GROUP BY — HAVING butuh query agregat.
    countSql: `${w}SELECT COUNT(*)${fromSql}${whereSql}${groupSql}${ctx.havingSql}`,
    unit: 'grup',
    statusColumn: (table) => table.columns.length - 1,
    highlight: (table) => [table.columns.length - 1],
    explain: ({ rowsIn, rowsOut }) =>
      `**HAVING** menyaring GRUP, bukan baris — dan berjalan SETELAH agregat dihitung, karena itu boleh memakai COUNT/SUM/AVG (yang dilarang di WHERE). Tabel ini menampilkan satu baris per grup beserta nilai agregatnya. ${(rowsIn ?? 0).toLocaleString('id-ID')} grup → ${rowsOut.toLocaleString('id-ID')} grup lolos.`,
  };
}

/** Teks statement s/d awal klausa `kind` pertama yang ada (atau seluruh statement). */
function sqlBefore(parsed: ParsedSelect, kinds: ReadonlyArray<'order' | 'limit'>): string {
  const starts = kinds.flatMap((k) => (parsed.clauses[k] ? [parsed.clauses[k]?.start ?? 0] : []));
  return starts.length > 0 ? parsed.sql.slice(0, Math.min(...starts)).trim() : parsed.sql;
}

function isPlainColumn(expr: string): boolean {
  return /^(?:[A-Za-z_][\w$]*|"[^"]+")(?:\.(?:[A-Za-z_][\w$]*|"[^"]+"))?$/.test(expr.trim());
}

function projectionDrafts(ctx: Context): Draft[] {
  const { parsed } = ctx;
  const drafts: Draft[] = [];
  const base = sqlBefore(parsed, ['order', 'limit']);
  const distinct = parsed.distinct;
  const withoutDistinct = distinct ? base.slice(0, distinct.start) + base.slice(distinct.end) : base;
  const computed = parsed.items.map((item) => !item.star && !isPlainColumn(item.expr));
  const windowed = hasWindowFunction(clauseBody(parsed, 'select') ?? '');
  const aliases = parsed.items.filter((i) => i.alias).map((i) => `\`${i.alias}\``);
  const notes = windowed
    ? ['Window function (… OVER (…)) dihitung di tahap SELECT ini — setelah WHERE, GROUP BY, dan HAVING. Karena itu hasilnya tidak bisa disaring di WHERE; bungkus query dengan subquery/CTE bila perlu.']
    : [];
  drafts.push({
    kind: 'select',
    title: 'SELECT',
    clause: `SELECT ${clauseBody(parsed, 'select') ?? ''}`,
    sql: withoutDistinct,
    notes,
    highlight: (table) => (parsed.items.some((i) => i.star) ? [] : computed.flatMap((c, i) => (c && i < table.columns.length ? [i] : []))),
    explain: ({ table }) =>
      `Baru sekarang **SELECT** dijalankan: memilih kolom, menghitung ekspresi (kolom yang disorot)${aliases.length > 0 ? `, dan memberi alias ${aliases.join(', ')}` : ''}. ${ctx.keyExprs.length > 0 || ctx.hasAggregate ? 'Setiap grup menghasilkan satu baris. ' : ''}Hasil: ${rowsWord(table.total, table.totalCapped)}. Inilah sebabnya alias belum dikenal di WHERE (menurut standar SQL), tetapi sudah bisa dipakai di ORDER BY.`,
  });
  if (distinct) {
    drafts.push({
      kind: 'distinct',
      title: 'DISTINCT',
      clause: 'SELECT DISTINCT …',
      sql: base,
      explain: ({ table, rowsIn }) =>
        `**DISTINCT** membuang baris yang SELURUH kolomnya kembar (bukan hanya kolom pertama). ${rowsWord(rowsIn ?? 0)} → ${rowsWord(table.total, table.totalCapped)} (${Math.max(0, (rowsIn ?? 0) - table.total).toLocaleString('id-ID')} duplikat dibuang).`,
    });
  }
  return drafts;
}

/** Kolom hasil yang dipakai sebagai kunci ORDER BY (dicocokkan lewat nomor posisi, nama/alias, atau teks ekspresi). */
function orderColumns(parsed: ParsedSelect, table: StepTable): number[] {
  const body = clauseBody(parsed, 'order') ?? '';
  const lowerColumns = table.columns.map((c) => c.toLowerCase());
  return splitTerms(body).flatMap((term) => {
    const expr = term.replace(/\s+(?:ASC|DESC)\b.*$/i, '').replace(/\s+COLLATE\s+\w+$/i, '').replace(/\s+NULLS\s+(?:FIRST|LAST)$/i, '').trim();
    if (/^\d+$/.test(expr)) return [Number(expr) - 1];
    const bare = unquoteIdent(expr.includes('.') ? expr.slice(expr.lastIndexOf('.') + 1) : expr).toLowerCase();
    const byName = lowerColumns.indexOf(bare);
    if (byName >= 0) return [byName];
    const byExpr = parsed.items.findIndex((item) => item.expr.replace(/\s+/g, '').toLowerCase() === expr.replace(/\s+/g, '').toLowerCase());
    return byExpr >= 0 ? [byExpr] : [];
  });
}

function orderLimitDrafts(parsed: ParsedSelect): Draft[] {
  const drafts: Draft[] = [];
  const orderText = clauseText(parsed, 'order');
  const limitText = clauseText(parsed, 'limit');
  if (orderText !== null) {
    drafts.push({
      kind: 'order',
      title: 'ORDER BY',
      clause: orderText,
      sql: sqlBefore(parsed, ['limit']),
      highlight: (table) => orderColumns(parsed, table),
      explain: () =>
        `**ORDER BY** mengurutkan baris hasil SELECT (kolom kunci disorot). Karena berjalan setelah SELECT, ORDER BY boleh memakai alias kolom. Jumlah baris tidak berubah.`,
    });
  }
  if (limitText !== null) {
    drafts.push({
      kind: 'limit',
      title: 'LIMIT',
      clause: limitText,
      sql: parsed.sql,
      notes: orderText === null ? ['Tanpa ORDER BY, baris mana yang terambil tidak dijamin — urutannya bergantung pada cara SQLite membaca tabel.'] : [],
      explain: ({ table, rowsIn }) =>
        `**LIMIT** adalah langkah terakhir: hanya baris pertama (setelah OFFSET, jika ada) yang diambil. ${rowsWord(rowsIn ?? 0)} → ${rowsWord(table.total)}.`,
    });
  }
  return drafts;
}

function buildContext(db: Database, parsed: ParsedSelect): Context | { error: string } {
  const w = parsed.withPrefix;
  const sourceColumns = parsed.sources.map((source) => {
    try {
      return { source, columns: columnNames(db, `${w}SELECT * FROM ${source.source} LIMIT 0`) };
    } catch {
      return { source, columns: [] };
    }
  });
  const sourceColumnNames = new Set([...IMPLICIT_COLUMNS, ...sourceColumns.flatMap((s) => s.columns.map((c) => c.toLowerCase()))]);
  const aliases = new Map<string, string>();
  for (const item of parsed.items) if (item.alias) aliases.set(item.alias.toLowerCase(), item.expr);

  const aliasNotes: string[] = [];
  const whereRaw = clauseBody(parsed, 'where');
  const where = whereRaw === null ? null : substituteAliases(whereRaw, aliases, sourceColumnNames);
  if (where && where.used.length > 0) {
    aliasNotes.push(
      `WHERE memakai alias SELECT (${where.used.map((u) => `\`${u}\``).join(', ')}). SQLite mengizinkannya, tetapi DBMS lain (SQL Server, PostgreSQL, MySQL) akan menolak, karena SELECT baru dijalankan SETELAH WHERE. Tulis ulang ekspresinya di WHERE agar portabel.`,
    );
  }

  const keyExprs: string[] = [];
  const keyLabels: string[] = [];
  for (const term of splitTerms(clauseBody(parsed, 'group') ?? '')) {
    if (/^\d+$/.test(term)) {
      const position = Number(term);
      const item = parsed.items[position - 1];
      // `*` dikembangkan SQLite menjadi banyak kolom → nomor posisi setelahnya tidak bisa dipetakan ke item.
      const starBefore = parsed.items.slice(0, position).some((i) => i.star);
      if (!item || starBefore) return { error: `GROUP BY ${term} merujuk kolom SELECT nomor ${term} yang tidak bisa ditentukan (ada * sebelum posisi itu). Tulis nama kolomnya di GROUP BY.` };
      keyExprs.push(item.expr);
      keyLabels.push(item.alias ?? item.expr);
      continue;
    }
    keyExprs.push(substituteAliases(term, aliases, sourceColumnNames).text);
    keyLabels.push(term);
  }

  const havingRaw = clauseBody(parsed, 'having');
  const having = havingRaw === null ? null : substituteAliases(havingRaw, aliases, sourceColumnNames).text;
  const fromBody = clauseBody(parsed, 'from');
  return {
    parsed,
    w,
    sourceColumns,
    // Tanpa FROM ("SELECT 1 WHERE …") tidak ada kolom sumber; '*' akan gagal ("no tables specified").
    allColumns: parsed.sources.length > 0 ? qualifiedColumns(sourceColumns).sql : '1 AS "baris"',
    sourceColumnNames,
    fromSql: fromBody ? ` FROM ${fromBody}` : '',
    whereSql: where ? ` WHERE ${where.text}` : '',
    whereText: where ? where.text : null,
    groupSql: keyExprs.length > 0 ? ` GROUP BY ${keyExprs.join(', ')}` : '',
    keyExprs,
    keyLabels,
    havingText: having,
    havingSql: having === null ? '' : ` HAVING ${having}`,
    hasAggregate: aggregateCalls(clauseBody(parsed, 'select') ?? '').length > 0 || (havingRaw !== null && aggregateCalls(havingRaw).length > 0),
    aliasNotes,
  };
}

function runDraft(db: Database, draft: Draft, order: number, rowsIn: number | null): ExecStep {
  const step: ExecStep = {
    kind: draft.kind,
    order,
    title: draft.title,
    clause: draft.clause,
    explanation: '',
    table: null,
    removed: null,
    rowsIn: draft.standalone ? null : rowsIn,
    rowsOut: null,
    unit: draft.unit ?? 'baris',
    highlight: [],
    groupColumn: draft.groupColumn ?? null,
    statusColumn: null,
    notes: draft.notes ?? [],
    error: null,
  };
  try {
    const table = runTable(db, draft.sql);
    const rowsOut = draft.countSql ? runCount(db, draft.countSql) : table.total;
    step.table = table;
    step.rowsOut = rowsOut;
    step.highlight = draft.highlight?.(table) ?? [];
    step.statusColumn = draft.statusColumn?.(table) ?? null;
    if (draft.removedSql) step.removed = runTable(db, draft.removedSql, REMOVED_ROWS);
    step.explanation = draft.explain({ table, rowsIn: step.rowsIn, rowsOut });
  } catch (err) {
    const raw = errorText(err);
    step.error = { raw, friendly: toFriendlyError(raw) };
    step.explanation = 'Langkah ini gagal dihitung — lihat pesan error di bawah.';
  }
  return step;
}

function writtenOrder(parsed: ParsedSelect, steps: readonly ExecStep[]): WrittenClause[] {
  const orderOf = (kind: StepKind) => steps.find((s) => s.kind === kind)?.order;
  const out: WrittenClause[] = [];
  const add = (label: string, text: string | null, kind: StepKind) => {
    const order = orderOf(kind);
    if (text !== null && order !== undefined) out.push({ label, text, order });
  };
  if (parsed.withPrefix) add('WITH', parsed.withPrefix.trim(), 'with');
  add(parsed.distinct ? 'SELECT DISTINCT' : 'SELECT', clauseText(parsed, 'select'), 'select');
  add('FROM', clauseText(parsed, 'from'), 'from');
  add('WHERE', clauseText(parsed, 'where'), 'where');
  add('GROUP BY', clauseText(parsed, 'group'), 'group');
  add('HAVING', clauseText(parsed, 'having'), 'having');
  add('ORDER BY', clauseText(parsed, 'order'), 'order');
  add('LIMIT', clauseText(parsed, 'limit'), 'limit');
  return out;
}

const MAIN_VERB = /^\s*(?:WITH\b[\s\S]*?\bSELECT\b|SELECT\b)/i;

/** Statement SELECT terakhir dari skrip (dipecah oleh parser SQLite). */
function pickStatement(db: Database, sql: string): { sql: string; notes: string[] } | Extract<ExecPlan, { ok: false }> {
  const split = splitStatements(db, sql);
  // Statement yang gagal di-parse (biasanya yang sedang ditulis) → tampilkan error-nya, jangan diam-diam
  // memvisualisasikan statement lain.
  if (split.error) return { ok: false, reason: 'error', message: split.error.friendlyError, rawError: split.error.rawError };
  if (split.statements.length === 0) {
    return { ok: false, reason: 'empty', message: 'Editor masih kosong. Tulis query SELECT terlebih dahulu.' };
  }
  const candidates = split.statements.map(stripComments).filter((s) => s.length > 0);
  const chosen = [...candidates].reverse().find((s) => MAIN_VERB.test(s));
  if (!chosen) {
    return { ok: false, reason: 'not-select', message: 'Visualisasi urutan eksekusi hanya untuk query SELECT. INSERT/UPDATE/DELETE/CREATE tidak punya tahapan seperti ini.' };
  }
  const notes: string[] = [];
  if (candidates.length > 1) notes.push(`Skrip berisi ${candidates.length} statement; yang divisualisasikan hanya SELECT terakhir. Statement lain tidak dijalankan.`);
  return { sql: chosen, notes };
}

/** Rencana gagal untuk query yang dihentikan sebelum langkahnya dihitung (batas waktu di worker). */
export function stoppedPlan(failure: ExecFailure): ExecPlan {
  return { ok: false, reason: 'error', message: failure.friendlyError, rawError: failure.rawError };
}

/**
 * Susun langkah-langkah eksekusi logis untuk SELECT terakhir di `sql`. `db` hanya dibaca: setiap
 * langkah adalah SELECT (statement tunggal) sehingga tidak ada data yang berubah.
 */
export function planExecution(db: Database, sql: string): ExecPlan {
  // Jaring pengaman: apa pun yang lolos analisis teks, koneksi dibuat read-only selama visualisasi.
  return withQueryOnly(db, () => planReadOnly(db, sql));
}

function planReadOnly(db: Database, sql: string): ExecPlan {
  const picked = pickStatement(db, sql);
  if ('ok' in picked) return picked;
  const parsedResult = parseSelect(picked.sql);
  if (!parsedResult.ok) return { ok: false, reason: parsedResult.reason, message: parsedResult.message };
  const parsed = parsedResult.parsed;

  try {
    db.prepare(parsed.sql).free();
  } catch (err) {
    const raw = errorText(err);
    return { ok: false, reason: 'error', message: toFriendlyError(raw), rawError: raw };
  }

  const ctx = buildContext(db, parsed);
  if ('error' in ctx) return { ok: false, reason: 'unsupported', message: ctx.error };

  const drafts: Draft[] = [
    ...withDrafts(parsed, ctx.w),
    ...fromDrafts(ctx),
    ...[whereDraft(ctx), groupDraft(ctx), havingDraft(ctx)].filter((d): d is Draft => d !== null),
    ...projectionDrafts(ctx),
    ...orderLimitDrafts(parsed),
  ];
  // Langkah terakhir selalu query asli apa adanya → tabel akhirnya identik dengan tombol Run.
  const last = drafts[drafts.length - 1];
  if (last) last.sql = parsed.sql;

  const steps: ExecStep[] = [];
  let rowsIn: number | null = null;
  drafts.forEach((draft, index) => {
    const step = runDraft(db, draft, index + 1, rowsIn);
    steps.push(step);
    if (!draft.standalone) rowsIn = step.rowsOut;
  });
  return { ok: true, sql: parsed.sql, steps, written: writtenOrder(parsed, steps), notes: picked.notes };
}
