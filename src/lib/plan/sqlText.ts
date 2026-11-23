/** Explain: normalisasi & analisis teks SQL (tanpa database). */

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/* ------------------------------------------------------------------ */
/* Normalisasi teks SQL untuk analisis nama                            */
/* ------------------------------------------------------------------ */

export const SIMPLE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Indeks setelah penutup kutip `quote` yang dibuka di posisi `start` (kutip ganda = escape). */
export function skipQuote(sql: string, start: number, quote: string): number {
  let j = start + 1;
  while (j < sql.length) {
    if (sql[j] === quote) {
      if (sql[j + 1] === quote) {
        j += 2;
        continue;
      }
      return j + 1;
    }
    j += 1;
  }
  return sql.length;
}

/**
 * Seperti stripCommentsAndStrings, tetapi identifier ber-kutip sederhana ("kunjungan", `k`, [k])
 * dikembalikan menjadi nama polos agar alias/tabel ber-kutip tetap dikenali. Identifier yang tidak
 * sederhana (mis. berisi spasi) diganti placeholder netral `_q_`.
 */
export function normalizeSql(sql: string): string {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i] ?? '';
    const next = sql[i + 1];
    if (ch === '-' && next === '-') {
      const end = sql.indexOf('\n', i + 2);
      i = end === -1 ? sql.length : end;
      out += ' ';
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      out += ' ';
      continue;
    }
    if (ch === "'") {
      i = skipQuote(sql, i, "'");
      out += " '' ";
      continue;
    }
    if (ch === '"' || ch === '`' || ch === '[') {
      let inner: string;
      if (ch === '[') {
        const end = sql.indexOf(']', i + 1);
        inner = sql.slice(i + 1, end === -1 ? sql.length : end);
        i = end === -1 ? sql.length : end + 1;
      } else {
        const end = skipQuote(sql, i, ch);
        inner = sql.slice(i + 1, Math.max(i + 1, end - 1)).split(ch + ch).join(ch);
        i = end;
      }
      // Nama polos (termasuk yang berspasi, mis. "my tab") dipertahankan agar tabel/alias-nya tetap dikenali;
      // isi yang berisi tanda baca SQL diganti placeholder netral.
      out += SIMPLE_IDENTIFIER.test(inner) || /^[^'"`[\]();,]+$/.test(inner) ? inner : ' _q_ ';
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Teks dengan isi semua tanda kurung dikosongkan (kurungnya tetap) — untuk melihat klausa tingkat atas. */
export function topLevelText(clean: string, start: number): string {
  let depth = 0;
  let out = '';
  for (let i = start; i < clean.length; i++) {
    const ch = clean[i] ?? '';
    if (ch === '(') {
      if (depth === 0) out += ch;
      depth += 1;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      if (depth === 0) out += ch;
      continue;
    }
    out += depth === 0 ? ch : ' ';
  }
  return out;
}

export const MAIN_VERB = /^(SELECT|VALUES|INSERT|REPLACE|UPDATE|DELETE)\b/i;

/** Verb utama statement (melewati klausa WITH … AS (…), …) dan posisinya di teks ter-normalisasi. */
export function mainVerb(clean: string): { verb: string; start: number } {
  const lead = clean.length - clean.replace(/^\s+/, '').length;
  const head = clean.slice(lead);
  if (!/^WITH\b/i.test(head)) {
    return { verb: (/^([A-Za-z]+)/.exec(head)?.[1] ?? '').toUpperCase(), start: lead };
  }
  let depth = 0;
  for (let i = lead + 4; i < clean.length; i++) {
    const ch = clean[i] ?? '';
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && /[A-Za-z]/.test(ch) && !/\w/.test(clean[i - 1] ?? ' ')) {
      const verb = MAIN_VERB.exec(clean.slice(i))?.[1];
      if (verb) return { verb: verb.toUpperCase(), start: i };
    }
  }
  return { verb: 'WITH', start: lead };
}

export const DML_VERBS: ReadonlySet<string> = new Set(['INSERT', 'REPLACE', 'UPDATE', 'DELETE']);
export const DML_TARGET = /^(?:(?:INSERT|REPLACE)(?:\s+OR\s+\w+)?\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM)\s+(?:main\.)?([A-Za-z_][A-Za-z0-9_]*)/i;

export const CLAUSE_KEYWORD =
  /\b(WHERE|ON|HAVING|GROUP\s+BY|ORDER\s+BY|LIMIT|WINDOW|UNION|INTERSECT|EXCEPT|JOIN|SELECT|FROM|SET|VALUES|RETURNING|DO)\b/gi;

/** Gabungan teks klausa WHERE/ON/HAVING (tempat filter berada), dipisah " ; ". */
export function filterText(clean: string): string {
  const matches = [...clean.matchAll(CLAUSE_KEYWORD)];
  const parts: string[] = [];
  matches.forEach((match, i) => {
    const keyword = (match[1] ?? '').toUpperCase();
    if (keyword !== 'WHERE' && keyword !== 'ON' && keyword !== 'HAVING') return;
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[i + 1]?.index ?? clean.length;
    parts.push(clean.slice(start, end));
  });
  return parts.join(' ; ');
}
