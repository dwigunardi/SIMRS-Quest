/**
 * Diff hasil query user vs Expected Output (murni, tanpa DOM) — untuk tab "Perbedaan".
 *
 * - Kolom dipasangkan per NAMA dulu (case-insensitive; posisi berbeda = "urutan kolom salah"). Bila jumlah kolom
 *   sama, sisa kolom dipasangkan per POSISI (= "salah nama"); selain itu kolom user tanpa pasangan = "berlebih",
 *   kolom expected tanpa pasangan = "kurang".
 * - Baris dipasangkan seperti penilaian (multiset, toleransi angka ±0.01 lewat cellsEqual):
 *   1) pasangan persis → 'same';
 *   2) sisa baris dipasangkan dengan kemiripan terbesar — hanya bila kolom pertama (biasanya kunci) sama atau
 *      minimal separuh selnya sama — → 'changed' beserta kolom yang berbeda;
 *   3) sisanya: baris user → 'extra', baris expected → 'missing'.
 * - Bila urutan dinilai, baris yang berpasangan tetapi keluar dari urutan relatif (di luar
 *   longest increasing subsequence posisi expected) ditandai 'moved' — jumlah pindahan minimal.
 */
import type { CellValue, QueryResult } from '../types';
import { cellsEqual } from './compare';

export type DiffColumnStatus = 'same' | 'reordered' | 'renamed' | 'extra' | 'missing';

export interface DiffColumn {
  /** Nama yang ditampilkan (nama di Expected, atau nama kolom user untuk kolom berlebih). */
  name: string;
  status: DiffColumnStatus;
  /** Nama kolom di hasil user (untuk 'renamed'). */
  actualName: string | null;
  /** Indeks di Expected (null untuk 'extra'). */
  expectedIndex: number | null;
  /** Indeks di hasil user (null untuk 'missing'). */
  actualIndex: number | null;
}

export type DiffRowStatus = 'same' | 'changed' | 'moved' | 'extra' | 'missing';

export interface DiffRow {
  status: DiffRowStatus;
  /** Posisi di hasil user (0-based), null untuk 'missing'. */
  actualIndex: number | null;
  /** Posisi pasangan di Expected (0-based), null untuk 'extra'. */
  expectedIndex: number | null;
  /** Nilai per kolom tampilan (mengikuti `columns`): nilai user, atau nilai Expected untuk 'missing'. */
  cells: Array<CellValue | undefined>;
  /** Nilai Expected per kolom tampilan (hanya untuk baris berpasangan; undefined untuk kolom 'extra'). */
  expectedCells: Array<CellValue | undefined>;
  /** Indeks kolom tampilan yang nilainya berbeda (hanya 'changed'). */
  changedColumns: number[];
}

export interface DiffCounts {
  same: number;
  changed: number;
  moved: number;
  extra: number;
  missing: number;
}

export interface ResultDiff {
  columns: DiffColumn[];
  /** Baris user sesuai urutannya, lalu baris Expected yang tidak muncul ('missing'). */
  rows: DiffRow[];
  counts: DiffCounts;
  /** true jika tidak ada perbedaan kolom maupun baris. */
  identical: boolean;
}

/** Di atas batas ini, pemasangan berdasarkan kemiripan dilewati (O(n·m)); baris tak berpasangan jadi extra/missing. */
const SIMILARITY_PAIRING_LIMIT = 400;

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function alignColumns(expected: readonly string[], actual: readonly string[]): DiffColumn[] {
  const used = new Set<number>();
  const columns: DiffColumn[] = expected.map((name, i) => {
    const match = actual.findIndex((a, j) => !used.has(j) && normalizeName(a) === normalizeName(name));
    if (match === -1) return { name, status: 'missing', actualName: null, expectedIndex: i, actualIndex: null };
    used.add(match);
    return { name, status: match === i ? 'same' : 'reordered', actualName: actual[match] ?? name, expectedIndex: i, actualIndex: match };
  });
  if (expected.length === actual.length) {
    // Jumlah kolom sama: kolom yang namanya tidak cocok dipasangkan berurutan (= salah nama/alias).
    const leftover = actual.map((_, j) => j).filter((j) => !used.has(j));
    for (const column of columns) {
      if (column.status !== 'missing') continue;
      const j = leftover.shift();
      if (j === undefined) break;
      used.add(j);
      column.status = 'renamed';
      column.actualName = actual[j] ?? '';
      column.actualIndex = j;
    }
  }
  actual.forEach((name, j) => {
    if (!used.has(j)) columns.push({ name, status: 'extra', actualName: name, expectedIndex: null, actualIndex: j });
  });
  return columns;
}

/** Kolom yang bisa dibandingkan nilainya (ada di kedua sisi). */
function comparable(columns: readonly DiffColumn[]): Array<{ display: number; expected: number; actual: number }> {
  const out: Array<{ display: number; expected: number; actual: number }> = [];
  columns.forEach((c, display) => {
    if (c.expectedIndex !== null && c.actualIndex !== null) out.push({ display, expected: c.expectedIndex, actual: c.actualIndex });
  });
  return out;
}

type Pairs = ReadonlyArray<{ display: number; expected: number; actual: number }>;

function rowsEqual(exp: readonly CellValue[], act: readonly CellValue[], pairs: Pairs): boolean {
  return pairs.every((p) => cellsEqual(exp[p.expected] ?? null, act[p.actual] ?? null));
}

/**
 * Skor kemiripan dua baris; 0 = tidak layak dipasangkan. Layak bila kolom pertama (biasanya kunci/ID/nama)
 * sama, atau minimal separuh sel sama — agar baris yang kebetulan sama di satu kolom (mis. status "Lunas")
 * tidak ditampilkan sebagai "nilai berbeda".
 */
function similarity(exp: readonly CellValue[], act: readonly CellValue[], pairs: Pairs): number {
  let equal = 0;
  let firstEqual = false;
  pairs.forEach((p, i) => {
    if (!cellsEqual(exp[p.expected] ?? null, act[p.actual] ?? null)) return;
    equal += 1;
    if (i === 0) firstEqual = true;
  });
  const eligible = equal > 0 && ((firstEqual && pairs.length >= 2) || equal * 2 >= pairs.length);
  return eligible ? equal + (firstEqual ? 0.5 : 0) : 0;
}

/** Indeks (dalam `values`) yang membentuk longest increasing subsequence. */
function longestIncreasing(values: readonly number[]): Set<number> {
  const tails: number[] = [];
  const prev = new Array<number>(values.length).fill(-1);
  values.forEach((value, i) => {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((values[tails[mid] ?? 0] ?? 0) < value) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1] ?? -1;
    tails[lo] = i;
  });
  const keep = new Set<number>();
  for (let i = tails[tails.length - 1] ?? -1; i !== -1; i = prev[i] ?? -1) keep.add(i);
  return keep;
}

export function diffResults(expected: QueryResult, actual: QueryResult, orderMatters: boolean): ResultDiff {
  const columns = alignColumns(expected.columns, actual.columns);
  const pairs = comparable(columns);
  const pairedExpected = new Array<number | null>(actual.rows.length).fill(null);
  const exactPair = new Array<boolean>(actual.rows.length).fill(false);
  const usedExpected = new Set<number>();

  // 1) Pasangan persis (urut sesuai posisi agar duplikat dipasangkan stabil).
  actual.rows.forEach((row, a) => {
    const match = expected.rows.findIndex((exp, e) => !usedExpected.has(e) && rowsEqual(exp, row, pairs));
    if (match === -1) return;
    usedExpected.add(match);
    pairedExpected[a] = match;
    exactPair[a] = true;
  });

  // 2) Sisa baris: pasangkan berdasarkan kemiripan terbesar (minimal satu sel sama).
  const restActual = actual.rows.map((_, a) => a).filter((a) => pairedExpected[a] === null);
  const restExpected = expected.rows.map((_, e) => e).filter((e) => !usedExpected.has(e));
  if (restActual.length * restExpected.length <= SIMILARITY_PAIRING_LIMIT * SIMILARITY_PAIRING_LIMIT) {
    const candidates: Array<{ a: number; e: number; score: number }> = [];
    for (const a of restActual) {
      for (const e of restExpected) {
        const score = similarity(expected.rows[e] ?? [], actual.rows[a] ?? [], pairs);
        if (score > 0) candidates.push({ a, e, score });
      }
    }
    candidates.sort((x, y) => y.score - x.score || Math.abs(x.a - x.e) - Math.abs(y.a - y.e) || x.a - y.a);
    for (const { a, e } of candidates) {
      if (pairedExpected[a] !== null || usedExpected.has(e)) continue;
      pairedExpected[a] = e;
      usedExpected.add(e);
    }
  }

  // 3) Baris yang keluar dari urutan relatif (hanya bila urutan dinilai).
  const outOfOrder = new Set<number>();
  if (orderMatters) {
    const matched = pairedExpected.map((e, a) => ({ a, e })).filter((x): x is { a: number; e: number } => x.e !== null);
    const keep = longestIncreasing(matched.map((x) => x.e));
    matched.forEach((x, i) => {
      if (!keep.has(i)) outOfOrder.add(x.a);
    });
  }

  const displayCells = (source: readonly CellValue[], side: 'expected' | 'actual'): Array<CellValue | undefined> =>
    columns.map((c) => {
      const index = side === 'expected' ? c.expectedIndex : c.actualIndex;
      return index === null ? undefined : source[index];
    });

  const rows: DiffRow[] = actual.rows.map((row, a) => {
    const e = pairedExpected[a] ?? null;
    const cells = displayCells(row, 'actual');
    if (e === null) return { status: 'extra', actualIndex: a, expectedIndex: null, cells, expectedCells: [], changedColumns: [] };
    const expectedRow = expected.rows[e] ?? [];
    const changedColumns = exactPair[a]
      ? []
      : pairs.filter((p) => !cellsEqual(expectedRow[p.expected] ?? null, row[p.actual] ?? null)).map((p) => p.display);
    let status: DiffRowStatus = changedColumns.length > 0 ? 'changed' : 'same';
    if (status === 'same' && outOfOrder.has(a)) status = 'moved';
    return { status, actualIndex: a, expectedIndex: e, cells, expectedCells: displayCells(expectedRow, 'expected'), changedColumns };
  });
  expected.rows.forEach((row, e) => {
    if (usedExpected.has(e)) return;
    rows.push({ status: 'missing', actualIndex: null, expectedIndex: e, cells: displayCells(row, 'expected'), expectedCells: [], changedColumns: [] });
  });

  const counts: DiffCounts = { same: 0, changed: 0, moved: 0, extra: 0, missing: 0 };
  for (const row of rows) counts[row.status] += 1;
  const identical = columns.every((c) => c.status === 'same') && rows.every((r) => r.status === 'same');
  return { columns, rows, counts, identical };
}
