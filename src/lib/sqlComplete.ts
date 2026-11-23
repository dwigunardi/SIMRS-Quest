/**
 * Autocomplete SQL untuk editor (mirip IntelliSense): keyword, fungsi, tabel, kolom, dan alias.
 * Sadar konteks secara ringan:
 * - setelah `alias.` / `tabel.` → hanya kolom tabel itu
 * - setelah FROM / JOIN / INTO / UPDATE → nama tabel (dan CTE)
 * - selain itu → kolom tabel yang disebut di statement didahulukan, lalu alias, fungsi, keyword
 * Tidak memakai database: cukup teks editor + daftar tabel/kolom.
 */
import { cteNames } from './plan/names';
import { normalizeSql } from './plan/sqlText';
import { FUNCTIONS, KEYWORDS, tokenizeSql, type SqlTokenType } from './sqlHighlight';

export type CompletionKind = 'column' | 'table' | 'alias' | 'function' | 'keyword';

export interface CompletionItem {
  label: string;
  /** Teks yang disisipkan menggantikan awalan yang sedang diketik. */
  insert: string;
  kind: CompletionKind;
  /** Keterangan pendek di sisi kanan, mis. "TEXT · pasien" atau "hitung baris". */
  detail: string;
  /** Caret diletakkan sejauh ini dari akhir teks sisipan (mis. 1 untuk masuk ke dalam "()"). */
  caretBack: number;
}

export interface CompletionSchema {
  tables: ReadonlyArray<{ name: string; columns: ReadonlyArray<{ name: string; type: string }> }>;
}

export interface CompletionResult {
  /** Rentang teks yang akan diganti saat saran dipilih: [from, to) — termasuk sisa kata di kanan caret. */
  from: number;
  to: number;
  prefix: string;
  items: CompletionItem[];
}

export const MAX_COMPLETIONS = 40;

/** Keyword (termasuk frasa multi-kata) yang ditawarkan. */
const KEYWORD_ITEMS: readonly string[] = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS NULL', 'IS NOT NULL', 'LIKE', 'BETWEEN', 'AS',
  'DISTINCT', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN', 'CROSS JOIN', 'ON', 'USING',
  'GROUP BY', 'HAVING', 'ORDER BY', 'BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'UNION', 'UNION ALL', 'INTERSECT',
  'EXCEPT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'EXISTS', 'NOT EXISTS', 'NULL', 'WITH', 'RECURSIVE', 'OVER',
  'PARTITION BY', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE INDEX', 'CREATE TABLE',
  'DROP INDEX', 'DROP TABLE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'EXPLAIN QUERY PLAN', 'NULLS FIRST', 'NULLS LAST',
  'ROWS BETWEEN', 'UNBOUNDED PRECEDING', 'CURRENT ROW', 'CAST', 'COLLATE NOCASE', 'TRUE', 'FALSE',
];

/** Kata kunci yang lazim langsung mengikuti nama tabel di FROM/JOIN. */
const FOLLOW_SOURCE: readonly string[] = [
  'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN', 'CROSS JOIN', 'ON', 'USING', 'GROUP BY',
  'HAVING', 'ORDER BY', 'LIMIT', 'UNION', 'UNION ALL', 'EXCEPT', 'INTERSECT', 'WINDOW', 'NATURAL JOIN', 'SET', 'VALUES',
];

/** Keterangan singkat fungsi yang sering dipakai di kurikulum. */
const FUNCTION_DETAIL: Readonly<Record<string, string>> = {
  COUNT: 'hitung baris',
  SUM: 'jumlahkan',
  AVG: 'rata-rata',
  MIN: 'nilai terkecil',
  MAX: 'nilai terbesar',
  ROUND: 'bulatkan',
  COALESCE: 'nilai non-NULL pertama',
  IFNULL: 'ganti NULL',
  NULLIF: 'NULL jika sama',
  UPPER: 'huruf besar',
  LOWER: 'huruf kecil',
  LENGTH: 'panjang teks',
  SUBSTR: 'potong teks',
  TRIM: 'buang spasi',
  STRFTIME: 'format tanggal',
  DATE: 'tanggal',
  JULIANDAY: 'tanggal → angka hari',
  GROUP_CONCAT: 'gabung teks per grup',
  ROW_NUMBER: 'nomor urut (window)',
  RANK: 'peringkat, ada lompatan',
  DENSE_RANK: 'peringkat tanpa lompatan',
  LAG: 'nilai baris sebelumnya',
  LEAD: 'nilai baris berikutnya',
  IIF: 'if-else ringkas',
};

/** Fungsi khusus dialek lain yang tidak ada di SQLite — tidak ditawarkan. */
const NON_SQLITE_FUNCTIONS: ReadonlySet<string> = new Set(['QUOTENAME', 'QUOTE_IDENT', 'QUOTE_LITERAL', 'GETDATE', 'NOW', 'CEIL', 'CEILING', 'FLOOR', 'POWER', 'SQRT', 'MOD']);


interface PosToken {
  type: SqlTokenType;
  text: string;
  start: number;
  end: number;
}

function positioned(text: string): PosToken[] {
  const out: PosToken[] = [];
  let pos = 0;
  for (const token of tokenizeSql(text)) {
    out.push({ type: token.type, text: token.text, start: pos, end: pos + token.text.length });
    pos += token.text.length;
  }
  return out;
}

const IDENT_CHAR = /[A-Za-z0-9_$À-￿]/;

function countChar(text: string, ch: string): number {
  let n = 0;
  for (const c of text) if (c === ch) n += 1;
  return n;
}

/** true jika caret berada di dalam komentar, string, atau identifier ber-kutip yang belum ditutup. */
function insideLiteral(tokens: readonly PosToken[], caret: number): boolean {
  const token = tokens.find((t) => t.start < caret && caret <= t.end);
  if (!token) return false;
  if (token.type === 'comment') {
    if (!token.text.startsWith('/*')) return true;
    const closed = token.text.length >= 4 && token.text.endsWith('*/');
    return !closed || caret < token.end;
  }
  const quote = token.text.charAt(0);
  const quoted = token.type === 'string' || (token.type === 'identifier' && (quote === '"' || quote === '`'));
  if (!quoted) return false;
  // Literal tertutup berisi jumlah kutip genap (pembuka + pasangan escape + penutup).
  const closed = countChar(token.text, quote) % 2 === 0;
  return !closed || caret < token.end;
}

function unquote(text: string): string {
  const first = text.charAt(0);
  if ((first === '"' || first === '`') && text.length >= 2 && text.endsWith(first)) return text.slice(1, -1);
  if (first === '[' && text.endsWith(']')) return text.slice(1, -1);
  return text;
}

const TABLE_CONTEXT_WORDS: ReadonlySet<string> = new Set(['FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE']);
const CLAUSE_OF: Readonly<Record<string, string>> = {
  SELECT: 'SELECT',
  FROM: 'FROM',
  JOIN: 'FROM',
  ON: 'ON',
  USING: 'ON',
  WHERE: 'WHERE',
  GROUP: 'GROUP',
  HAVING: 'HAVING',
  ORDER: 'ORDER',
  LIMIT: 'LIMIT',
  SET: 'SET',
  VALUES: 'VALUES',
  WINDOW: 'WINDOW',
};

type Context = 'table' | 'expression' | 'operand-end' | 'statement-start' | 'limit' | 'alias';
type RankKey = CompletionKind | 'other-column';

/** Prioritas jenis saran per konteks (kecil = lebih atas; tidak tercantum = tidak ditawarkan). */
const RANKS: Record<Context, Partial<Record<RankKey, number>>> = {
  table: { table: 0, keyword: 5 },
  'statement-start': { keyword: 0 },
  limit: { keyword: 0, function: 1, column: 2, alias: 2 },
  // Posisi nama alias baru (setelah nama tabel di FROM): hanya kata kunci klausa berikutnya (lihat FOLLOW_SOURCE).
  alias: { keyword: 0 },
  // Tepat setelah operan (kolom, angka, string, ")"): yang sah berikutnya adalah operator/kata kunci (IN, LIKE, AS, …).
  'operand-end': { keyword: 0, function: 3, column: 4, alias: 4, table: 5, 'other-column': 6 },
  // Kolom tabel yang disebut di statement didahulukan dari kolom tabel lain.
  expression: { column: 0, alias: 1, function: 2, keyword: 3, table: 4, 'other-column': 5 },
};

function matchScore(label: string, prefix: string): number | null {
  if (!prefix) return 0;
  const l = label.toLowerCase();
  const p = prefix.toLowerCase();
  // Sama persis dengan ketikan selalu paling atas (mis. NULL di atas NULLIF), agar Enter = baris baru.
  if (l === p) return -1;
  if (l.startsWith(p)) return 0;
  if (l.split(/[_\s.]/).some((part) => part.startsWith(p))) return 1;
  if (p.length >= 2 && l.includes(p)) return 2;
  return null;
}

/* ------------------------------------------------------------------ */
/* Analisis teks di sekitar caret                                      */
/* ------------------------------------------------------------------ */

interface Cursor {
  /** Awal awalan yang sedang diketik. */
  from: number;
  prefix: string;
  /** `alias` pada `alias.awalan` (huruf kecil), atau null. */
  qualifier: string | null;
  /** Akhir teks sebelum awalan/kualifier — batas pencarian token sebelumnya. */
  headEnd: number;
}

function locateCursor(text: string, tokens: readonly PosToken[], caret: number): Cursor | null {
  let from = caret;
  while (from > 0 && IDENT_CHAR.test(text.charAt(from - 1))) from -= 1;
  const prefix = text.slice(from, caret);
  if (/^[0-9$]/.test(prefix)) return null;
  if (text.charAt(from - 1) !== '.') return { from, prefix, qualifier: null, headEnd: from };
  const owner = tokens.find((t) => t.end === from - 1);
  // "1." (angka desimal) atau ")." bukan kualifier.
  if (owner?.type !== 'identifier') return null;
  return { from, prefix, qualifier: unquote(owner.text).toLowerCase(), headEnd: owner.start };
}

/** Token bermakna (tanpa spasi/komentar) di statement aktif, tidak termasuk awalan yang sedang diketik. */
function statementTokens(tokens: readonly PosToken[], cursor: Cursor, caret: number): { tokens: PosToken[]; start: number; end: number } {
  let start = 0;
  let end = Number.POSITIVE_INFINITY;
  for (const t of tokens) {
    if (t.type !== 'punctuation' || t.text !== ';') continue;
    if (t.end <= cursor.from) start = t.end;
    else if (t.start >= caret) {
      end = t.start;
      break;
    }
  }
  const inStatement = tokens.filter(
    (t) => t.start >= start && t.end <= end && t.type !== 'whitespace' && t.type !== 'comment' && !(t.start === cursor.from && t.end === caret),
  );
  return { tokens: inStatement, start, end };
}

interface References {
  /** Tabel/CTE yang disebut (huruf kecil). */
  tables: Set<string>;
  /** alias (huruf kecil) → tabel/CTE (huruf kecil). */
  aliases: Map<string, string>;
  /** Alias kolom SELECT (`… AS total`). */
  columnAliases: Set<string>;
}

function aliasAfter(tokens: readonly PosToken[], index: number): string | null {
  let at = index + 1;
  let candidate = tokens[at];
  if (candidate?.type === 'keyword' && candidate.text.toUpperCase() === 'AS') {
    at += 1;
    candidate = tokens[at];
  }
  if (candidate?.type !== 'identifier' || tokens[at + 1]?.text === '.') return null;
  const alias = unquote(candidate.text);
  return KEYWORDS.has(alias.toUpperCase()) ? null : alias.toLowerCase();
}

/** Tabel yang disebut + alias-nya (`FROM pasien p`, `JOIN kunjungan AS k`, `FROM a, b`). */
function collectReferences(tokens: readonly PosToken[], isSource: (name: string) => boolean): References {
  const refs: References = { tables: new Set(), aliases: new Map(), columnAliases: new Set() };
  tokens.forEach((t, i) => {
    const next = tokens[i + 1];
    if (t.type === 'keyword' && t.text.toUpperCase() === 'AS' && next?.type === 'identifier') {
      refs.columnAliases.add(unquote(next.text));
      return;
    }
    if (t.type !== 'identifier') return;
    const name = unquote(t.text).toLowerCase();
    if (!isSource(name) || tokens[i - 1]?.text === '.' || next?.text === '.' || next?.text === '(') return;
    refs.tables.add(name);
    const alias = aliasAfter(tokens, i);
    if (alias) refs.aliases.set(alias, name);
  });
  for (const name of [...refs.columnAliases]) {
    const lower = name.toLowerCase();
    if (refs.aliases.has(lower) || isSource(lower)) refs.columnAliases.delete(name);
  }
  return refs;
}

/** Klausa aktif (SELECT/FROM/WHERE/…) pada kedalaman kurung caret. */
function activeClause(tokens: readonly PosToken[], headEnd: number): string | null {
  let clause: string | null = null;
  const stack: Array<string | null> = [];
  for (const t of tokens) {
    if (t.end > headEnd) break;
    if (t.text === '(') {
      stack.push(clause);
      clause = null;
    } else if (t.text === ')') {
      clause = stack.pop() ?? null;
    } else if (t.type === 'keyword') {
      clause = CLAUSE_OF[t.text.toUpperCase()] ?? clause;
    }
  }
  return clause;
}

function detectContext(
  tokens: readonly PosToken[],
  headEnd: number,
  isSource: (name: string) => boolean,
): { context: Context; prevWord: string; clause: string | null } {
  let prevIndex = -1;
  tokens.forEach((t, i) => {
    if (t.end <= headEnd) prevIndex = i;
  });
  const prev = tokens[prevIndex];
  const clause = activeClause(tokens, headEnd);
  if (!prev) return { context: 'statement-start', prevWord: '', clause };
  const prevWord = prev.text.toUpperCase();
  // "… AS |" atau "FROM pasien |" / "JOIN kunjungan |": user sedang menamai alias baru.
  const beforePrev = tokens[prevIndex - 1]?.text.toUpperCase() ?? '';
  const afterSourceName =
    prev.type === 'identifier' && isSource(unquote(prev.text).toLowerCase()) && (TABLE_CONTEXT_WORDS.has(beforePrev) || (beforePrev === ',' && clause === 'FROM'));
  if (prevWord === 'AS' || afterSourceName) return { context: 'alias', prevWord, clause };
  const createIndexOn = prevWord === 'ON' && tokens[0]?.text.toUpperCase() === 'CREATE';
  if (TABLE_CONTEXT_WORDS.has(prevWord) || (prevWord === ',' && clause === 'FROM') || createIndexOn) {
    return { context: 'table', prevWord, clause };
  }
  if (clause === 'LIMIT') return { context: 'limit', prevWord, clause };
  const operandEnd = prev.type === 'identifier' || prev.type === 'number' || prev.type === 'string' || prev.text === ')';
  return { context: operandEnd ? 'operand-end' : 'expression', prevWord, clause };
}

/* ------------------------------------------------------------------ */
/* Pengumpulan saran                                                   */
/* ------------------------------------------------------------------ */

type SchemaTable = CompletionSchema['tables'][number];

class Collector {
  private readonly entries: Array<{ item: CompletionItem; rank: number; score: number; seq: number }> = [];

  constructor(
    private readonly prefix: string,
    private readonly ranks: Partial<Record<RankKey, number>>,
  ) {}

  add(item: CompletionItem, rankKey: RankKey = item.kind): void {
    const score = matchScore(item.label, this.prefix);
    const rank = this.ranks[rankKey];
    if (score === null || rank === undefined) return;
    this.entries.push({ item, rank, score, seq: this.entries.length });
  }

  /** Kolom beberapa tabel; kolom bernama sama (mis. no_rawat) digabung jadi satu saran. */
  addColumns(tables: readonly SchemaTable[], rankKey: 'column' | 'other-column'): void {
    const merged = new Map<string, { label: string; type: string; tables: string[] }>();
    for (const table of tables) {
      for (const column of table.columns) {
        const key = column.name.toLowerCase();
        const entry = merged.get(key);
        if (entry) entry.tables.push(table.name);
        else merged.set(key, { label: column.name, type: column.type, tables: [table.name] });
      }
    }
    for (const entry of merged.values()) {
      const owners = entry.tables.length > 2 ? `${entry.tables.slice(0, 2).join(', ')}, …` : entry.tables.join(', ');
      this.add({ label: entry.label, insert: entry.label, kind: 'column', detail: `${entry.type || 'kolom'} · ${owners}`, caretBack: 0 }, rankKey);
    }
  }

  result(from: number, to: number): CompletionResult | null {
    const seen = new Set<string>();
    // Tanpa awalan: urutan asli (mis. urutan kolom di tabel). Dengan awalan: label terpendek dulu.
    const byLabel = this.prefix.length > 0;
    const items = [...this.entries]
      .sort(
        (a, b) =>
          a.score - b.score ||
          a.rank - b.rank ||
          (byLabel ? a.item.label.length - b.item.label.length || a.item.label.localeCompare(b.item.label) : a.seq - b.seq),
      )
      .filter(({ item }) => {
        const key = `${item.kind}:${item.label.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_COMPLETIONS)
      .map((entry) => entry.item);
    return items.length > 0 ? { from, to, prefix: this.prefix, items } : null;
  }
}

function keywordItem(keyword: string): CompletionItem {
  return { label: keyword, insert: keyword, kind: 'keyword', detail: 'keyword', caretBack: 0 };
}

function addGeneralItems(collector: Collector, schema: CompletionSchema, refs: References, clause: string | null, context: Context): void {
  const referenced = schema.tables.filter((t) => refs.tables.has(t.name.toLowerCase()));
  const others = schema.tables.filter((t) => !refs.tables.has(t.name.toLowerCase()));
  collector.addColumns(referenced, 'column');
  collector.addColumns(others, 'other-column');
  for (const [alias, table] of refs.aliases) {
    collector.add({ label: alias, insert: alias, kind: 'alias', detail: `alias → ${table}`, caretBack: 0 });
  }
  if (clause === 'ORDER' || clause === 'GROUP' || clause === 'HAVING') {
    for (const alias of refs.columnAliases) {
      collector.add({ label: alias, insert: alias, kind: 'alias', detail: 'alias kolom SELECT', caretBack: 0 });
    }
  }
  for (const name of FUNCTIONS) {
    if (NON_SQLITE_FUNCTIONS.has(name)) continue;
    collector.add({ label: name, insert: `${name}()`, kind: 'function', detail: FUNCTION_DETAIL[name] ?? 'fungsi', caretBack: 1 });
  }
  for (const keyword of KEYWORD_ITEMS) collector.add(keywordItem(keyword));
  if (context !== 'statement-start') {
    for (const table of schema.tables) collector.add({ label: table.name, insert: table.name, kind: 'table', detail: 'tabel', caretBack: 0 });
  }
}

/**
 * Saran untuk posisi `caret` di `text`. `explicit` = dipicu Ctrl+Space (boleh tanpa awalan).
 * Mengembalikan null jika tidak ada yang perlu ditawarkan (mis. di dalam string atau komentar).
 */
export function getCompletions(text: string, caret: number, schema: CompletionSchema, explicit = false): CompletionResult | null {
  const tokens = positioned(text);
  if (insideLiteral(tokens, caret)) return null;
  const cursor = locateCursor(text, tokens, caret);
  if (!cursor) return null;
  if (!explicit && cursor.prefix.length === 0 && cursor.qualifier === null) return null;

  const statement = statementTokens(tokens, cursor, caret);
  const tableByName = new Map(schema.tables.map((t) => [t.name.toLowerCase(), t] as const));
  const ctes = cteNames(normalizeSql(text.slice(statement.start, Math.min(statement.end, text.length))));
  const refs = collectReferences(statement.tokens, (name) => tableByName.has(name) || ctes.has(name));

  if (cursor.qualifier !== null) {
    const target = tableByName.get(refs.aliases.get(cursor.qualifier) ?? cursor.qualifier);
    if (!target) return null;
    const collector = new Collector(cursor.prefix, { column: 0 });
    collector.addColumns([target], 'column');
    return collector.result(cursor.from, identifierEnd(text, caret));
  }

  const { context, prevWord, clause } = detectContext(statement.tokens, cursor.headEnd, (name) => tableByName.has(name) || ctes.has(name));
  if (context === 'alias') {
    // Alias biasanya 1–3 huruf ("p", "kj"): jangan tawarkan apa pun sampai ketikan jelas mengarah ke kata kunci,
    // dan tidak pernah setelah AS — supaya Enter/Tab tidak mengganti alias yang sedang diketik.
    if (prevWord === 'AS' || cursor.prefix.length < 3) return null;
    const collector = new Collector(cursor.prefix, RANKS.alias);
    for (const keyword of FOLLOW_SOURCE) collector.add(keywordItem(keyword));
    return collector.result(cursor.from, identifierEnd(text, caret));
  }
  const collector = new Collector(cursor.prefix, RANKS[context]);
  if (context === 'table') {
    for (const table of schema.tables) {
      collector.add({ label: table.name, insert: table.name, kind: 'table', detail: `tabel · ${table.columns.length} kolom`, caretBack: 0 });
    }
    for (const cte of ctes) collector.add({ label: cte, insert: cte, kind: 'table', detail: 'CTE', caretBack: 0 });
    // Tabel turunan: "FROM (SELECT …" — tidak berlaku untuk INTO/UPDATE/TABLE.
    if (prevWord === 'FROM' || prevWord === 'JOIN') collector.add(keywordItem('SELECT'));
    return collector.result(cursor.from, identifierEnd(text, caret));
  }
  addGeneralItems(collector, schema, refs, clause, context);
  return collector.result(cursor.from, identifierEnd(text, caret));
}

/** Akhir nama yang sedang disunting: saran di tengah kata ("na|ma") mengganti seluruh katanya. */
export function identifierEnd(text: string, caret: number): number {
  let end = caret;
  while (end < text.length && IDENT_CHAR.test(text.charAt(end))) end += 1;
  return end;
}

/** true jika saran hanya mengulang persis apa yang sudah diketik (Enter sebaiknya membuat baris baru). */
export function isNoopCompletion(result: CompletionResult, item: CompletionItem): boolean {
  return item.insert.toLowerCase() === result.prefix.toLowerCase();
}
