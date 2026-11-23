/**
 * Misi "Tebak Hasil": membangun pilihan jawaban (tabel hasil) dan menilainya.
 * Tabel setiap pilihan dihitung dengan menjalankan SQL-nya di database (DB seed), jadi kunci jawaban
 * tidak pernah bisa salah ketik.
 */
import type { Database } from 'sql.js';
import { compareResults } from './compare';
import { executeSql } from './sqlEngine';
import type { PredictMission, QueryResult } from '../types';

export interface PredictChoice {
  /** ID stabil: 'answer' untuk hasil query, 'd0', 'd1', … untuk pengecoh. */
  id: string;
  correct: boolean;
  /** SQL yang menghasilkan tabel ini (diperlihatkan setelah dijawab). */
  sql: string;
  /** Untuk pengecoh: salah paham yang diwakili. Untuk jawaban benar: penjelasan misi. */
  explanation: string;
  result: QueryResult;
}

export type PredictChoices = { ok: true; choices: PredictChoice[] } | { ok: false; message: string };

function lastResult(db: Database, sql: string): QueryResult | string {
  const outcome = executeSql(db, sql);
  if (!outcome.ok) return outcome.rawError;
  const result = outcome.results[outcome.results.length - 1];
  return result ?? 'query tidak menghasilkan tabel';
}

/** Hash FNV-1a kecil untuk urutan acak yang stabil per misi. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Urutan pilihan diacak secara deterministik (sama di setiap render & sesi) berdasarkan id misi. */
function stableShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  let state = hash(seed) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) >>> 0;
    state = (state ^ (state >>> 12)) >>> 0;
    const j = state % (i + 1);
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** true jika dua tabel dianggap sama menurut aturan penilaian (urutan baris hanya dihitung bila orderMatters). */
export function sameResult(a: QueryResult, b: QueryResult, orderMatters: boolean): boolean {
  return compareResults(a, b, orderMatters).match;
}

/**
 * Pilihan jawaban misi tebak hasil. `db` harus berisi data seed (mis. engine.referenceDb) dan hanya
 * dibaca (semua SQL misi adalah SELECT).
 */
export function buildPredictChoices(db: Database, mission: PredictMission): PredictChoices {
  const answer = lastResult(db, mission.query);
  if (typeof answer === 'string') return { ok: false, message: `Query misi gagal dijalankan: ${answer}` };

  const choices: PredictChoice[] = [{ id: 'answer', correct: true, sql: mission.query, explanation: mission.explanation, result: answer }];
  for (const [index, distractor] of mission.distractors.entries()) {
    const result = lastResult(db, distractor.sql);
    if (typeof result === 'string') return { ok: false, message: `Pengecoh #${index + 1} gagal dijalankan: ${result}` };
    choices.push({ id: `d${index}`, correct: false, sql: distractor.sql, explanation: distractor.misconception, result });
  }
  return { ok: true, choices: stableShuffle(choices, mission.id) };
}
