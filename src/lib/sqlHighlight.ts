/**
 * Tokenizer SQL ringan untuk syntax highlighting.
 * Bersifat lossless: gabungan seluruh `token.text` selalu sama persis dengan input.
 */

export type SqlTokenType =
  | 'keyword'
  | 'function'
  | 'string'
  | 'number'
  | 'comment'
  | 'operator'
  | 'punctuation'
  | 'identifier'
  | 'whitespace';

export interface SqlToken {
  type: SqlTokenType;
  text: string;
}

export const KEYWORDS: ReadonlySet<string> = new Set([
  'ABORT', 'ACTION', 'ADD', 'AFTER', 'ALL', 'ALTER', 'ALWAYS', 'ANALYZE', 'AND', 'AS', 'ASC',
  'ATTACH', 'AUTOINCREMENT', 'BEFORE', 'BEGIN', 'BETWEEN', 'BY', 'CASCADE', 'CASE', 'CAST',
  'CHECK', 'COLLATE', 'COLUMN', 'COMMIT', 'CONFLICT', 'CONSTRAINT', 'CREATE', 'CROSS',
  'CURRENT', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP', 'DATABASE', 'DEFAULT',
  'DEFERRABLE', 'DEFERRED', 'DELETE', 'DESC', 'DETACH', 'DISTINCT', 'DO', 'DROP', 'EACH',
  'ELSE', 'END', 'ESCAPE', 'EXCEPT', 'EXCLUDE', 'EXCLUSIVE', 'EXISTS', 'EXPLAIN', 'FAIL',
  'FILTER', 'FIRST', 'FOLLOWING', 'FOR', 'FOREIGN', 'FROM', 'FULL', 'GENERATED', 'GLOB',
  'GROUP', 'GROUPS', 'HAVING', 'IF', 'IGNORE', 'IMMEDIATE', 'IN', 'INDEX', 'INDEXED',
  'INITIALLY', 'INNER', 'INSERT', 'INSTEAD', 'INTERSECT', 'INTO', 'IS', 'ISNULL', 'JOIN',
  'KEY', 'LAST', 'LEFT', 'LIKE', 'LIMIT', 'MATCH', 'MATERIALIZED', 'NATURAL', 'NO', 'NOT',
  'NOTHING', 'NOTNULL', 'NULL', 'NULLS', 'OF', 'OFFSET', 'ON', 'OR', 'ORDER', 'OTHERS',
  'OUTER', 'OVER', 'PARTITION', 'PLAN', 'PRAGMA', 'PRECEDING', 'PRIMARY', 'QUERY', 'RAISE',
  'RANGE', 'RECURSIVE', 'REFERENCES', 'REGEXP', 'REINDEX', 'RELEASE', 'RENAME', 'REPLACE',
  'RESTRICT', 'RETURNING', 'RIGHT', 'ROLLBACK', 'ROW', 'ROWS', 'SAVEPOINT', 'SELECT', 'SET',
  'TABLE', 'TEMP', 'TEMPORARY', 'THEN', 'TIES', 'TO', 'TRANSACTION', 'TRIGGER', 'TRUNCATE',
  'UNBOUNDED', 'UNION', 'UNIQUE', 'UPDATE', 'USING', 'VACUUM', 'VALUES', 'VIEW', 'VIRTUAL',
  'WHEN', 'WHERE', 'WINDOW', 'WITH', 'WITHOUT', 'TRUE', 'FALSE',
  // kata kunci prosedural T-SQL / PL/pgSQL / MySQL (contoh di kartu konsep)
  'DECLARE', 'CURSOR', 'FETCH', 'NEXT', 'OPEN', 'CLOSE', 'DEALLOCATE', 'EXECUTE', 'EXEC',
  'PROCEDURE', 'FUNCTION', 'LOOP', 'RETURNS', 'RETURN', 'LANGUAGE', 'PREPARE', 'WHILE',
  'ELSIF', 'RECORD', 'PERFORM', 'NOTICE', 'LOCAL', 'STATIC', 'PRINT', 'PARTITIONS', 'LESS', 'THAN',
  // tipe data umum
  'INTEGER', 'INT', 'TEXT', 'REAL', 'NUMERIC', 'BLOB', 'VARCHAR', 'CHAR', 'BOOLEAN',
  'DECIMAL', 'FLOAT', 'DOUBLE', 'DATETIME',
]);

export const FUNCTIONS: ReadonlySet<string> = new Set([
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'TOTAL', 'GROUP_CONCAT', 'ROUND', 'ABS', 'COALESCE',
  'IFNULL', 'NULLIF', 'IIF', 'UPPER', 'LOWER', 'LENGTH', 'SUBSTR', 'SUBSTRING', 'TRIM',
  'LTRIM', 'RTRIM', 'INSTR', 'PRINTF', 'FORMAT', 'STRFTIME', 'DATE', 'TIME', 'JULIANDAY',
  'UNIXEPOCH', 'TYPEOF', 'RANDOM', 'HEX', 'QUOTE', 'CHAR', 'UNICODE', 'ZEROBLOB',
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE',
  'NTH_VALUE', 'PERCENT_RANK', 'CUME_DIST', 'CEIL', 'CEILING', 'FLOOR', 'POWER', 'SQRT',
  'MOD', 'CONCAT', 'CONCAT_WS', 'LIKELIHOOD', 'CHANGES', 'LAST_INSERT_ROWID',
  'QUOTENAME', 'QUOTE_IDENT', 'QUOTE_LITERAL', 'GETDATE', 'NOW',
]);

const OPERATOR_CHARS = '=<>!+-*/%|&~^';
const MULTI_OPERATORS = ['<>', '<=', '>=', '!=', '==', '||', '<<', '>>', '->>', '->'];
const PUNCTUATION_CHARS = '(),;.[]';

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v';
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_À-￿]/.test(ch);
}

function isIdentPart(ch: string): boolean {
  return /[A-Za-z0-9_$À-￿]/.test(ch);
}

/** Indeks setelah karakter penutup `quote`, atau akhir string jika tidak ditutup. */
function scanQuoted(sql: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] !== quote) {
      i += 1;
      continue;
    }
    // Quote ganda ('' atau "") = escape, lanjutkan.
    if (sql[i + 1] === quote) {
      i += 2;
      continue;
    }
    return i + 1;
  }
  return sql.length;
}

function scanWhile(sql: string, start: number, predicate: (ch: string) => boolean): number {
  let i = start;
  while (i < sql.length && predicate(sql.charAt(i))) i += 1;
  return i;
}

function scanNumber(sql: string, start: number): number {
  // Hex literal: 0x1F
  if (sql[start] === '0' && (sql[start + 1] === 'x' || sql[start + 1] === 'X')) {
    return scanWhile(sql, start + 2, (ch) => /[0-9A-Fa-f]/.test(ch));
  }
  let i = scanWhile(sql, start, isDigit);
  if (sql[i] === '.') i = scanWhile(sql, i + 1, isDigit);
  const expChar = sql[i];
  if (expChar !== 'e' && expChar !== 'E') return i;
  let j = i + 1;
  if (sql[j] === '+' || sql[j] === '-') j += 1;
  if (!isDigit(sql.charAt(j))) return i;
  return scanWhile(sql, j, isDigit);
}

function classifyWord(word: string, sql: string, end: number): SqlTokenType {
  const upper = word.toUpperCase();
  if (FUNCTIONS.has(upper)) {
    // Fungsi hanya bila diikuti '(' (boleh dipisah spasi), agar kolom bernama "date" tidak ikut.
    const next = scanWhile(sql, end, (ch) => ch === ' ' || ch === '\t');
    if (sql[next] === '(') return 'function';
  }
  if (KEYWORDS.has(upper)) return 'keyword';
  return 'identifier';
}

interface Scan {
  type: SqlTokenType;
  end: number;
}

function scanToken(sql: string, i: number): Scan {
  const ch = sql.charAt(i);
  const next = sql.charAt(i + 1);

  if (isWhitespace(ch)) return { type: 'whitespace', end: scanWhile(sql, i, isWhitespace) };

  if (ch === '-' && next === '-') {
    const newline = sql.indexOf('\n', i);
    return { type: 'comment', end: newline === -1 ? sql.length : newline };
  }

  if (ch === '/' && next === '*') {
    const close = sql.indexOf('*/', i + 2);
    return { type: 'comment', end: close === -1 ? sql.length : close + 2 };
  }

  if (ch === "'") return { type: 'string', end: scanQuoted(sql, i, "'") };
  if (ch === '"' || ch === '`') return { type: 'identifier', end: scanQuoted(sql, i, ch) };

  if (isDigit(ch) || (ch === '.' && isDigit(next))) return { type: 'number', end: scanNumber(sql, i) };

  if (isIdentStart(ch)) {
    const end = scanWhile(sql, i, isIdentPart);
    return { type: classifyWord(sql.slice(i, end), sql, end), end };
  }

  // Parameter: ?, ?1, :nama, @nama, $nama
  if (ch === '?' || ch === ':' || ch === '@' || ch === '$') {
    return { type: 'identifier', end: Math.max(i + 1, scanWhile(sql, i + 1, isIdentPart)) };
  }

  if (OPERATOR_CHARS.includes(ch)) {
    const multi = MULTI_OPERATORS.find((op) => sql.startsWith(op, i));
    return { type: 'operator', end: i + (multi ? multi.length : 1) };
  }

  if (PUNCTUATION_CHARS.includes(ch)) return { type: 'punctuation', end: i + 1 };

  // Karakter lain (tak dikenal) — tetap disimpan agar lossless.
  return { type: 'identifier', end: i + 1 };
}

export function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let i = 0;
  while (i < sql.length) {
    const { type, end } = scanToken(sql, i);
    const safeEnd = end > i ? end : i + 1;
    const text = sql.slice(i, safeEnd);
    const last = tokens[tokens.length - 1];
    // Gabungkan token berurutan bertipe sama untuk whitespace agar DOM lebih ringkas.
    if (last && last.type === 'whitespace' && type === 'whitespace') {
      last.text += text;
    } else {
      tokens.push({ type, text });
    }
    i = safeEnd;
  }
  return tokens;
}
