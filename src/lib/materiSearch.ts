/**
 * Pencarian teks sederhana di pustaka Materi (judul, ringkasan, isi, contoh, jebakan, dialek).
 * Semua kata kunci harus ditemukan (AND); judul & ringkasan diberi bobot lebih tinggi.
 */
import type { Article } from '../types';

export interface SearchHit {
  article: Article;
  score: number;
  /** Potongan teks di sekitar kata kunci pertama (tanpa markup), atau null bila hanya cocok di judul/ringkasan. */
  snippet: string | null;
}

function plain(text: string): string {
  return text.replace(/\*\*|`/g, '').replace(/\s+/g, ' ');
}

interface Field {
  text: string;
  weight: number;
  /** Boleh dipakai sebagai cuplikan. */
  snippet: boolean;
}

function fieldsOf(article: Article): Field[] {
  return [
    { text: article.title, weight: 10, snippet: false },
    { text: article.summary, weight: 5, snippet: false },
    ...article.sections.flatMap((s) => [
      { text: s.heading, weight: 4, snippet: true },
      { text: plain(s.body), weight: 1, snippet: true },
      ...(s.examples ?? []).flatMap((e) => [
        { text: e.title, weight: 2, snippet: true },
        { text: e.sql, weight: 1, snippet: true },
      ]),
    ]),
    ...article.pitfalls.map((p) => ({ text: plain(p), weight: 2, snippet: true })),
    ...article.dialects.flatMap((d) => [
      { text: d.label, weight: 2, snippet: true },
      { text: Object.values(d.syntax).join(' · '), weight: 1, snippet: true },
    ]),
  ];
}

function snippetAround(text: string, at: number, length: number): string {
  const start = Math.max(0, at - 50);
  const end = Math.min(text.length, at + length + 70);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

export function searchArticles(articles: readonly Article[], query: string): SearchHit[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
  if (terms.length === 0) return articles.map((article) => ({ article, score: 0, snippet: null }));
  const hits: SearchHit[] = [];
  for (const article of articles) {
    const fields = fieldsOf(article);
    let score = 0;
    let snippet: string | null = null;
    const allFound = terms.every((term) => {
      let found = false;
      for (const field of fields) {
        const at = field.text.toLowerCase().indexOf(term);
        if (at < 0) continue;
        found = true;
        score += field.weight;
        if (snippet === null && field.snippet && term === terms[0]) snippet = snippetAround(field.text, at, term.length);
      }
      return found;
    });
    if (allFound) hits.push({ article, score, snippet });
  }
  return hits.sort((a, b) => b.score - a.score);
}
