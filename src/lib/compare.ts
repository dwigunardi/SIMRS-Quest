/**
 * Membandingkan hasil query user dengan expected output (murni, tanpa DOM).
 */
import type { CellValue, CompareOutcome, QueryResult } from '../types';

const NUMERIC_TOLERANCE = 0.01;

/* ------------------------------------------------------------------ */
/* Normalisasi & kesetaraan sel                                        */
/* ------------------------------------------------------------------ */

/** Mengubah string numerik (mis. " 12.50 ") menjadi angka; null jika bukan angka. */
function numericValue(value: CellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((byte, idx) => byte === b[idx]);
}

/** Kesetaraan sel: NULL hanya = NULL, angka toleran ±0.01 (string numerik ikut), teks di-trim. */
export function cellsEqual(a: CellValue, b: CellValue): boolean {
  if (a === null || b === null) return a === b;
  if (a instanceof Uint8Array || b instanceof Uint8Array) {
    return a instanceof Uint8Array && b instanceof Uint8Array && bytesEqual(a, b);
  }
  if (typeof a === 'number' || typeof b === 'number') {
    const na = numericValue(a);
    const nb = numericValue(b);
    if (na === null || nb === null) return false;
    return Math.abs(na - nb) <= NUMERIC_TOLERANCE;
  }
  return a.trim() === b.trim();
}

function rowsEqual(a: CellValue[], b: CellValue[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((cell, idx) => cellsEqual(cell, b[idx] ?? null));
}

/** Kunci kanonik bertipe untuk sorting stabil (angka dibulatkan 2 desimal). */
function cellKey(value: CellValue): [string, string | number] {
  if (value === null) return ['0', ''];
  if (value instanceof Uint8Array) return ['3', Array.from(value).join(',')];
  // String numerik di-key sebagai angka agar sejajar dengan pasangan numeriknya.
  const num = numericValue(value);
  if (num !== null) {
    const rounded = Math.round(num * 100) / 100;
    return ['1', rounded === 0 ? 0 : rounded];
  }
  return ['2', typeof value === 'string' ? value.trim() : String(value)];
}

function rowKey(row: CellValue[]): string {
  return JSON.stringify(row.map(cellKey));
}

function compareKeys(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortRows(rows: CellValue[][]): CellValue[][] {
  return rows
    .map((row) => ({ row, key: rowKey(row) }))
    .sort((x, y) => compareKeys(x.key, y.key))
    .map((entry) => entry.row);
}

/* ------------------------------------------------------------------ */
/* Format pesan                                                        */
/* ------------------------------------------------------------------ */

function formatCell(value: CellValue | undefined): string {
  if (value === undefined || value === null) return 'NULL';
  if (value instanceof Uint8Array) return `<BLOB ${value.length} bytes>`;
  if (typeof value === 'number') return String(value);
  return `"${value}"`;
}

function formatColumns(columns: string[]): string {
  return columns.length === 0 ? '(tidak ada)' : columns.join(', ');
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function mismatch(
  reason: NonNullable<CompareOutcome['reason']>,
  message: string,
  firstDiff: CompareOutcome['firstDiff'] = null,
): CompareOutcome {
  return { match: false, reason, message, firstDiff };
}

const MATCH: CompareOutcome = {
  match: true,
  reason: null,
  message: 'Hasil query kamu sama persis dengan expected output.',
  firstDiff: null,
};

/* ------------------------------------------------------------------ */
/* Pencocokan baris                                                    */
/* ------------------------------------------------------------------ */

function firstDiffColumn(a: CellValue[], b: CellValue[]): number {
  const idx = a.findIndex((cell, col) => !cellsEqual(cell, b[col] ?? null));
  return idx === -1 ? 0 : idx;
}

function countEqualCells(a: CellValue[], b: CellValue[]): number {
  return a.reduce<number>((acc, cell, col) => (cellsEqual(cell, b[col] ?? null) ? acc + 1 : acc), 0);
}

interface UnmatchedRow {
  actualIndex: number;
  closestExpected: CellValue[] | null;
}

/**
 * Pencocokan multiset serakah (toleran terhadap selisih angka kecil).
 * Mengembalikan baris actual pertama yang tidak punya pasangan, atau null jika semua cocok.
 */
function findUnmatchedRow(expected: CellValue[][], actual: CellValue[][]): UnmatchedRow | null {
  const used = new Array<boolean>(expected.length).fill(false);

  for (let a = 0; a < actual.length; a += 1) {
    const row = actual[a] ?? [];
    const matchIdx = expected.findIndex((exp, idx) => !used[idx] && rowsEqual(exp, row));
    if (matchIdx !== -1) {
      used[matchIdx] = true;
      continue;
    }
    const candidates = expected.filter((_, idx) => !used[idx]);
    const closest = candidates.reduce<CellValue[] | null>((best, exp) => {
      if (!best) return exp;
      return countEqualCells(exp, row) > countEqualCells(best, row) ? exp : best;
    }, null);
    return { actualIndex: a, closestExpected: closest };
  }
  return null;
}

function cellValuesMessage(columns: string[], row: number, col: number, exp: CellValue | undefined, act: CellValue | undefined): string {
  const name = columns[col] ?? `#${col + 1}`;
  return `Ada nilai yang berbeda di baris ke-${row + 1}, kolom "${name}": diharapkan ${formatCell(exp)}, hasil kamu ${formatCell(act)}. Periksa kembali kondisi filter, JOIN, atau perhitunganmu.`;
}

function compareUnordered(expected: QueryResult, actual: QueryResult): CompareOutcome {
  const sortedExp = sortRows(expected.rows);
  const sortedAct = sortRows(actual.rows);
  if (sortedExp.every((row, idx) => rowsEqual(row, sortedAct[idx] ?? []))) return MATCH;

  const unmatched = findUnmatchedRow(expected.rows, actual.rows);
  if (!unmatched) return MATCH;

  const actRow = actual.rows[unmatched.actualIndex] ?? [];
  const expRow = unmatched.closestExpected ?? [];
  const col = firstDiffColumn(expRow, actRow);
  const name = actual.columns[col] ?? `#${col + 1}`;
  const message = `Baris ke-${unmatched.actualIndex + 1} pada hasil kamu tidak ada di expected output. Perbedaan terdekat ada di kolom "${name}": diharapkan ${formatCell(expRow[col])}, hasil kamu ${formatCell(actRow[col])}. Periksa kembali kondisi filter, JOIN, atau perhitunganmu.`;
  return mismatch('cell-values', message, { row: unmatched.actualIndex, column: col });
}

function compareOrdered(expected: QueryResult, actual: QueryResult): CompareOutcome {
  const diffRow = expected.rows.findIndex((row, idx) => !rowsEqual(row, actual.rows[idx] ?? []));
  if (diffRow === -1) return MATCH;

  if (!findUnmatchedRow(expected.rows, actual.rows)) {
    return mismatch(
      'row-order',
      `Isi datanya sudah benar, tetapi urutan barisnya berbeda (mulai baris ke-${diffRow + 1}). Periksa klausa ORDER BY: kolom yang diurutkan dan arahnya (ASC/DESC).`,
      { row: diffRow, column: 0 },
    );
  }

  const expRow = expected.rows[diffRow] ?? [];
  const actRow = actual.rows[diffRow] ?? [];
  const col = firstDiffColumn(expRow, actRow);
  return mismatch('cell-values', cellValuesMessage(actual.columns, diffRow, col, expRow[col], actRow[col]), {
    row: diffRow,
    column: col,
  });
}

/* ------------------------------------------------------------------ */
/* API publik                                                          */
/* ------------------------------------------------------------------ */

export function compareResults(expected: QueryResult, actual: QueryResult | null, orderMatters: boolean): CompareOutcome {
  if (!actual) {
    return mismatch(
      'no-result',
      'Query kamu tidak menghasilkan tabel hasil. Misi ini membutuhkan query SELECT yang mengembalikan data.',
    );
  }

  if (expected.columns.length !== actual.columns.length) {
    return mismatch(
      'column-count',
      `Jumlah kolom berbeda: diharapkan ${expected.columns.length} kolom (${formatColumns(expected.columns)}), hasil kamu ${actual.columns.length} kolom (${formatColumns(actual.columns)}).`,
    );
  }

  const nameDiff = expected.columns.findIndex((col, idx) => normalizeName(col) !== normalizeName(actual.columns[idx] ?? ''));
  if (nameDiff !== -1) {
    return mismatch(
      'column-names',
      `Nama/urutan kolom belum sesuai. Diharapkan: ${formatColumns(expected.columns)}. Hasil kamu: ${formatColumns(actual.columns)}. Gunakan alias (AS) persis seperti yang diminta.`,
    );
  }

  if (expected.rows.length !== actual.rows.length) {
    return mismatch(
      'row-count',
      `Jumlah baris berbeda: diharapkan ${expected.rows.length} baris, hasil kamu ${actual.rows.length} baris. Periksa kondisi WHERE, JOIN, GROUP BY, atau LIMIT.`,
    );
  }

  return orderMatters ? compareOrdered(expected, actual) : compareUnordered(expected, actual);
}
