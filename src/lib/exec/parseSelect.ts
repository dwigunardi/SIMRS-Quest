/**
 * Pemecah SELECT tunggal menjadi klausa-klausanya (WITH, SELECT, FROM + JOIN, WHERE, GROUP BY, HAVING,
 * WINDOW, ORDER BY, LIMIT) untuk visualisasi urutan eksekusi. Bukan parser SQL lengkap: cukup mengenali
 * kata kunci tingkat atas (di luar tanda kurung), sehingga subquery, CASE, dan window function tetap utuh.
 * Komentar sudah dibuang lebih dulu (lihat stripComments) sehingga potongan teks aman disambung ulang.
 */
import { tokenizeSql, type SqlTokenType } from '../sqlHighlight';

export interface Tok {
  type: SqlTokenType;
  text: string;
  /** Huruf besar untuk keyword/identifier — memudahkan perbandingan. */
  upper: string;
  start: number;
  end: number;
  /** Kedalaman kurung di posisi token (token '(' dan ')' memakai kedalaman luarnya). */
  depth: number;
}

/** Token bermakna (tanpa spasi & komentar) beserta posisi dan kedalaman kurung. */
export function significantTokens(sql: string): Tok[] {
  const out: Tok[] = [];
  let pos = 0;
  let depth = 0;
  for (const token of tokenizeSql(sql)) {
    const start = pos;
    pos += token.text.length;
    if (token.type === 'whitespace' || token.type === 'comment') continue;
    if (token.text === ')') depth = Math.max(0, depth - 1);
    out.push({ type: token.type, text: token.text, upper: token.text.toUpperCase(), start, end: pos, depth });
    if (token.text === '(') depth += 1;
  }
  return out;
}

/** Komentar diganti spasi (string literal tetap utuh), titik koma & spasi di ujung dibuang. */
export function stripComments(sql: string): string {
  const parts = tokenizeSql(sql).map((token) => (token.type === 'comment' ? ' ' : token.text));
  return parts.join('').trim().replace(/;+\s*$/, '').trim();
}

export function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export function unquoteIdent(text: string): string {
  const first = text.charAt(0);
  if ((first === '"' || first === '`') && text.length >= 2 && text.endsWith(first)) {
    return text.slice(1, -1).replaceAll(first + first, first);
  }
  if (first === '[' && text.endsWith(']')) return text.slice(1, -1);
  return text;
}

/* ------------------------------------------------------------------ */
/* Bentuk hasil                                                         */
/* ------------------------------------------------------------------ */

export type ClauseKind = 'with' | 'select' | 'from' | 'where' | 'group' | 'having' | 'window' | 'order' | 'limit';

export interface Clause {
  kind: ClauseKind;
  /** Posisi kata kunci pembuka klausa di teks statement. */
  start: number;
  /** Posisi setelah kata kunci (mis. setelah "GROUP BY"). */
  bodyStart: number;
  end: number;
}

export interface SelectItem {
  /** Teks ekspresi tanpa alias. */
  expr: string;
  /** Alias (`AS nama` atau nama di belakang ekspresi), tanpa kutip. */
  alias: string | null;
  /** `*` atau `t.*`. */
  star: boolean;
}

export type JoinType = 'first' | 'inner' | 'left' | 'right' | 'full' | 'cross' | 'comma';

export interface FromSource {
  join: JoinType;
  natural: boolean;
  /** Operator penggabung seperti tertulis, mis. "LEFT JOIN" atau ",". Kosong untuk sumber pertama. */
  operator: string;
  /** Tabel/subquery beserta aliasnya, mis. "kunjungan k" atau "(SELECT …) s". */
  source: string;
  /** "ON …" atau "USING (…)", atau null. */
  constraint: string | null;
  /** Nama untuk mengualifikasi kolom (alias atau nama tabel); null jika tidak bisa ditentukan. */
  qualifier: string | null;
  /** Nama tabel fisik bila sumbernya tabel/view/CTE bernama (bukan subquery). */
  table: string | null;
  /** Akhir segmen ini di teks statement — FROM s/d segmen ke-i = teks[fromBody, end). */
  end: number;
}

export interface ParsedSelect {
  sql: string;
  /** "WITH … " (termasuk spasi penutup) atau string kosong. */
  withPrefix: string;
  cteNames: string[];
  recursive: boolean;
  /** Token DISTINCT tepat setelah SELECT, bila ada. */
  distinct: { start: number; end: number } | null;
  clauses: Partial<Record<ClauseKind, Clause>>;
  items: SelectItem[];
  sources: FromSource[];
}

export type ParseResult =
  | { ok: true; parsed: ParsedSelect }
  | { ok: false; reason: 'not-select' | 'compound' | 'unsupported'; message: string };

/* ------------------------------------------------------------------ */
/* Pemisahan klausa                                                    */
/* ------------------------------------------------------------------ */

const COMPOUND = new Set(['UNION', 'INTERSECT', 'EXCEPT']);

function clauseKindAt(tokens: readonly Tok[], i: number): { kind: ClauseKind; width: number } | null {
  const t = tokens[i];
  if (!t || t.type !== 'keyword') return null;
  const next = tokens[i + 1];
  switch (t.upper) {
    case 'FROM':
      return { kind: 'from', width: 1 };
    case 'WHERE':
      return { kind: 'where', width: 1 };
    case 'HAVING':
      return { kind: 'having', width: 1 };
    case 'WINDOW':
      return { kind: 'window', width: 1 };
    case 'LIMIT':
      return { kind: 'limit', width: 1 };
    case 'GROUP':
      return next?.upper === 'BY' ? { kind: 'group', width: 2 } : null;
    case 'ORDER':
      return next?.upper === 'BY' ? { kind: 'order', width: 2 } : null;
    default:
      return null;
  }
}

const DML_WORDS = new Set(['INSERT', 'REPLACE', 'UPDATE', 'DELETE']);

/** Indeks token SELECT utama (setelah klausa WITH) dan info CTE. */
function locateMainSelect(tokens: readonly Tok[]): { index: number; cteNames: string[]; recursive: boolean } | null {
  const first = tokens[0];
  if (!first) return null;
  if (first.upper === 'SELECT') return { index: 0, cteNames: [], recursive: false };
  if (first.upper !== 'WITH') return null;
  const recursive = tokens[1]?.upper === 'RECURSIVE';
  const names: string[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t || t.depth !== 0) continue;
    // WITH … INSERT/UPDATE/DELETE: SELECT berikutnya hanya sumber data DML, bukan query utama.
    if (DML_WORDS.has(t.upper)) return null;
    // SELECT utama tepat setelah badan CTE terakhir "… )".
    if (t.upper === 'SELECT') return tokens[i - 1]?.text === ')' ? { index: i, cteNames: names, recursive } : null;
    const prev = tokens[i - 1];
    if (t.type === 'identifier' && (prev?.upper === 'WITH' || prev?.upper === 'RECURSIVE' || prev?.text === ',')) {
      names.push(unquoteIdent(t.text));
    }
  }
  return null;
}

function splitTopLevel(tokens: readonly Tok[], baseDepth: number, separator: string): Tok[][] {
  const groups: Tok[][] = [[]];
  for (const t of tokens) {
    if (t.depth === baseDepth && t.text === separator) {
      groups.push([]);
      continue;
    }
    groups[groups.length - 1]?.push(t);
  }
  return groups.filter((g) => g.length > 0);
}

function unquoteAlias(text: string): string {
  return text.startsWith("'") && text.endsWith("'") && text.length >= 2 ? text.slice(1, -1).replaceAll("''", "'") : unquoteIdent(text);
}

const ALIAS_BEFORE: ReadonlySet<SqlTokenType> = new Set(['identifier', 'number', 'string', 'function']);

function parseSelectItem(sql: string, tokens: readonly Tok[], baseDepth: number): SelectItem {
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  if (!first || !last) return { expr: '', alias: null, star: false };
  const text = sql.slice(first.start, last.end);
  if (last.text === '*' && (tokens.length === 1 || tokens[tokens.length - 2]?.text === '.')) {
    return { expr: text, alias: null, star: true };
  }
  const beforeLast = tokens[tokens.length - 2];
  if (!beforeLast || last.depth !== baseDepth) return { expr: text, alias: null, star: false };
  // Setelah AS, alias boleh berupa nama, 'string', atau kata kunci non-reserved (mis. AS last, AS text).
  if (beforeLast.upper === 'AS' && tokens.length >= 3 && (last.type === 'identifier' || last.type === 'string' || last.type === 'keyword')) {
    const exprEnd = tokens[tokens.length - 3]?.end ?? first.end;
    return { expr: sql.slice(first.start, exprEnd), alias: unquoteAlias(last.text), star: false };
  }
  // Alias tanpa AS: "COUNT(*) jumlah", "CASE … END kategori", "nama n", "kota 'Kota'".
  const implicit =
    (last.type === 'identifier' || last.type === 'string') &&
    beforeLast.text !== '.' &&
    (beforeLast.text === ')' || beforeLast.upper === 'END' || ALIAS_BEFORE.has(beforeLast.type));
  if (implicit) return { expr: sql.slice(first.start, beforeLast.end), alias: unquoteAlias(last.text), star: false };
  return { expr: text, alias: null, star: false };
}

const JOIN_WORDS = new Set(['NATURAL', 'LEFT', 'RIGHT', 'FULL', 'INNER', 'CROSS', 'OUTER', 'JOIN']);

function joinTypeOf(words: readonly string[]): JoinType {
  if (words.includes(',')) return 'comma';
  if (words.includes('LEFT')) return 'left';
  if (words.includes('RIGHT')) return 'right';
  if (words.includes('FULL')) return 'full';
  if (words.includes('CROSS')) return 'cross';
  return 'inner';
}

/**
 * Nama tabel & alias sumber FROM: `pasien`, `main.pasien p`, `kunjungan AS k`, `(SELECT …) s`,
 * `json_each(x) j`. Token '(' dan ')' pembungkus subquery berada di kedalaman `baseDepth`.
 */
function describeSource(tokens: readonly Tok[], baseDepth: number): { qualifier: string | null; table: string | null } {
  const top = tokens.filter((t) => t.depth === baseDepth);
  const first = top[0];
  if (!first) return { qualifier: null, table: null };
  let table: string | null = null;
  let next: number;
  if (first.text === '(') {
    next = top.findIndex((t) => t.text === ')') + 1;
  } else if (first.type === 'identifier' && top[1]?.text === '(') {
    next = top.findIndex((t, i) => i > 1 && t.text === ')') + 1; // fungsi tabel
  } else if (top[1]?.text === '.' && top[2]?.type === 'identifier') {
    table = unquoteIdent(top[2].text);
    next = 3;
  } else {
    table = first.type === 'identifier' ? unquoteIdent(first.text) : null;
    next = 1;
  }
  let aliasTok = top[next];
  if (aliasTok?.upper === 'AS') aliasTok = top[next + 1];
  const alias = aliasTok?.type === 'identifier' ? unquoteIdent(aliasTok.text) : null;
  return { qualifier: alias ?? table, table };
}

function parseFrom(sql: string, tokens: readonly Tok[], baseDepth: number): FromSource[] {
  const sources: FromSource[] = [];
  let operatorWords: string[] = [];
  let operatorTokens: Tok[] = [];
  let body: Tok[] = [];

  const flush = () => {
    if (body.length === 0) return;
    const onAt = body.findIndex((t) => t.depth === baseDepth && (t.upper === 'ON' || t.upper === 'USING'));
    const sourceTokens = onAt === -1 ? body : body.slice(0, onAt);
    const constraintTokens = onAt === -1 ? [] : body.slice(onAt);
    const firstSource = sourceTokens[0];
    const lastSource = sourceTokens[sourceTokens.length - 1];
    const lastBody = body[body.length - 1];
    if (!firstSource || !lastSource || !lastBody) return;
    const firstConstraint = constraintTokens[0];
    const lastConstraint = constraintTokens[constraintTokens.length - 1];
    const { qualifier, table } = describeSource(sourceTokens, baseDepth);
    const opFirst = operatorTokens[0];
    const opLast = operatorTokens[operatorTokens.length - 1];
    sources.push({
      join: sources.length === 0 ? 'first' : joinTypeOf(operatorWords),
      natural: operatorWords.includes('NATURAL'),
      operator: opFirst && opLast ? sql.slice(opFirst.start, opLast.end) : '',
      source: sql.slice(firstSource.start, lastSource.end),
      constraint: firstConstraint && lastConstraint ? sql.slice(firstConstraint.start, lastConstraint.end) : null,
      qualifier,
      table,
      end: lastBody.end,
    });
    body = [];
    operatorWords = [];
    operatorTokens = [];
  };

  for (const t of tokens) {
    const isOperator = t.depth === baseDepth && (t.text === ',' || (t.type === 'keyword' && JOIN_WORDS.has(t.upper)));
    if (isOperator) {
      if (body.length > 0) flush();
      operatorWords.push(t.text === ',' ? ',' : t.upper);
      operatorTokens.push(t);
      continue;
    }
    body.push(t);
  }
  flush();
  return sources;
}

export function parseSelect(sql: string): ParseResult {
  const tokens = significantTokens(sql);
  const main = locateMainSelect(tokens);
  if (!main) {
    return { ok: false, reason: 'not-select', message: 'Visualisasi urutan eksekusi hanya untuk query SELECT (boleh diawali WITH).' };
  }
  const selectTok = tokens[main.index];
  if (!selectTok) return { ok: false, reason: 'not-select', message: 'SELECT utama tidak ditemukan.' };
  const baseDepth = selectTok.depth;

  const clauses: Partial<Record<ClauseKind, Clause>> = {};
  const order: Clause[] = [];
  let distinct: ParsedSelect['distinct'] = null;
  let selectBody = selectTok.end;
  const afterSelect = tokens[main.index + 1];
  if (afterSelect && (afterSelect.upper === 'DISTINCT' || afterSelect.upper === 'ALL')) {
    if (afterSelect.upper === 'DISTINCT') distinct = { start: afterSelect.start, end: afterSelect.end };
    selectBody = afterSelect.end;
  }
  order.push({ kind: 'select', start: selectTok.start, bodyStart: selectBody, end: sql.length });

  for (let i = main.index + 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t || t.depth !== baseDepth) continue;
    if (COMPOUND.has(t.upper)) {
      return {
        ok: false,
        reason: 'compound',
        message: `Query gabungan (${t.upper}) belum didukung visualisasi ini. Coba visualisasikan setiap SELECT-nya secara terpisah.`,
      };
    }
    const found = clauseKindAt(tokens, i);
    if (!found) continue;
    const bodyTok = tokens[i + found.width - 1];
    const previous = order[order.length - 1];
    if (previous) previous.end = t.start;
    order.push({ kind: found.kind, start: t.start, bodyStart: bodyTok?.end ?? t.end, end: sql.length });
    i += found.width - 1;
  }
  for (const clause of order) {
    if (clauses[clause.kind]) {
      return { ok: false, reason: 'unsupported', message: `Klausa ${clause.kind.toUpperCase()} muncul lebih dari sekali di tingkat atas.` };
    }
    clauses[clause.kind] = clause;
  }

  const inRange = (clause: Clause | undefined) =>
    clause ? tokens.filter((t) => t.start >= clause.bodyStart && t.end <= clause.end) : [];
  const items = splitTopLevel(inRange(clauses.select), baseDepth, ',').map((group) => parseSelectItem(sql, group, baseDepth));
  const sources = clauses.from ? parseFrom(sql, inRange(clauses.from), baseDepth) : [];

  return {
    ok: true,
    parsed: {
      sql,
      withPrefix: main.index > 0 ? `${sql.slice(0, selectTok.start)}` : '',
      cteNames: main.cteNames,
      recursive: main.recursive,
      distinct,
      clauses,
      items,
      sources,
    },
  };
}

/** Teks isi klausa (tanpa kata kuncinya), sudah di-trim. */
export function clauseBody(parsed: ParsedSelect, kind: ClauseKind): string | null {
  const clause = parsed.clauses[kind];
  return clause ? parsed.sql.slice(clause.bodyStart, clause.end).trim() : null;
}

/** Teks klausa lengkap dengan kata kuncinya, mis. "WHERE kota = 'Bogor'". */
export function clauseText(parsed: ParsedSelect, kind: ClauseKind): string | null {
  const clause = parsed.clauses[kind];
  return clause ? parsed.sql.slice(clause.start, clause.end).trim() : null;
}

/** Ekspresi di klausa (GROUP BY / ORDER BY) yang dipisah koma tingkat atas. */
export function splitTerms(text: string): string[] {
  const tokens = significantTokens(text);
  return splitTopLevel(tokens, 0, ',').map((group) => {
    const first = group[0];
    const last = group[group.length - 1];
    return first && last ? text.slice(first.start, last.end) : '';
  });
}
