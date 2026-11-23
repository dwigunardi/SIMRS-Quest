/**
 * Pemetaan pesan error SQLite → artikel Materi yang menjelaskan penyebabnya.
 * Dipakai kartu error (misi, Playground, urutan eksekusi) untuk tautan "Pelajari: …".
 */

export interface ErrorTopic {
  pattern: RegExp;
  /** ID artikel di src/data/materi, urut dari yang paling relevan. */
  articles: readonly string[];
}

export const ERROR_TOPICS: readonly ErrorTopic[] = [
  { pattern: /misuse of aggregate/i, articles: ['having', 'urutan-eksekusi'] },
  { pattern: /aggregate functions are not allowed in the GROUP BY/i, articles: ['group-by'] },
  { pattern: /HAVING clause on a non-aggregate query|GROUP BY clause is required before HAVING/i, articles: ['having'] },
  { pattern: /misuse of window function|window functions? (?:are|is) not allowed/i, articles: ['window-peringkat', 'urutan-eksekusi'] },
  { pattern: /ambiguous column name/i, articles: ['inner-join'] },
  { pattern: /no such column/i, articles: ['select', 'urutan-eksekusi'] },
  { pattern: /sub-select returns \d+ columns|row value misused/i, articles: ['subquery'] },
  { pattern: /cannot start a transaction within a transaction|no transaction is active/i, articles: ['transaksi'] },
  { pattern: /(?:NOT NULL|UNIQUE|CHECK|FOREIGN KEY|PRIMARY KEY) constraint failed/i, articles: ['insert', 'update-delete', 'create-table'] },
  { pattern: /foreign key mismatch|(?:table|view|trigger) \S+ already exists/i, articles: ['create-table'] },
  { pattern: /Cannot add a NOT NULL column|duplicate column name/i, articles: ['alter-table'] },
  { pattern: /because it is a view/i, articles: ['view'] },
  { pattern: /ON CONFLICT clause does not match/i, articles: ['upsert'] },
  { pattern: /malformed JSON|bad JSON path|json_\w+\(\)/i, articles: ['json'] },
  { pattern: /circular reference|recursive reference|recursive aggregate/i, articles: ['cte-rekursif'] },
  { pattern: /RIGHT and FULL OUTER JOINs|FULL OUTER JOIN/i, articles: ['join-lanjutan'] },
];

const MAX_LINKS = 2;

/** ID artikel yang relevan untuk pesan error mentah SQLite (maks. 2, tanpa duplikat). */
export function relatedArticleIds(rawError: string): string[] {
  const ids: string[] = [];
  for (const topic of ERROR_TOPICS) {
    if (!topic.pattern.test(rawError)) continue;
    for (const id of topic.articles) if (!ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, MAX_LINKS);
}
