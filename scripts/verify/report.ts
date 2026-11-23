/**
 * Pencatatan hasil verifikasi: kegagalan (exit code 1) dan peringatan (informasi saja).
 */
import type { CellValue, CheckResult, QueryResult } from '../../src/types';

export const failures: string[] = [];
export const warnings: string[] = [];

export function fail(message: string): void {
  failures.push(message);
  console.error(`  ✗ ${message}`);
}

export function warn(message: string): void {
  warnings.push(message);
  console.warn(`  ⚠ ${message}`);
}

export function assert(condition: boolean, message: string): void {
  if (!condition) fail(message);
}

export function section(title: string): void {
  console.log(`\n== ${title} ==`);
}

/** Menjalankan satu blok pemeriksaan; exception dicatat sebagai kegagalan, bukan menghentikan seluruh run. */
export function guard(label: string, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    fail(`${label}: exception — ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function describeCheck(result: CheckResult): string {
  if (result.kind === 'wrong') return `wrong/${result.compare.reason ?? '-'}`;
  return result.kind;
}

export function failureDetail(result: CheckResult): string {
  if (result.kind === 'wrong') return ` — ${result.compare.message}`;
  if (result.kind === 'error') return ` — ${result.rawError}`;
  return '';
}

export function formatCell(value: CellValue | undefined): string {
  if (value === undefined || value === null) return 'NULL';
  if (value instanceof Uint8Array) return `<BLOB ${value.length} bytes>`;
  return String(value);
}

export function rowKey(row: readonly CellValue[]): string {
  return JSON.stringify(row.map(formatCell));
}

export function hasDuplicateRows(result: QueryResult): boolean {
  const keys = result.rows.map(rowKey);
  return new Set(keys).size !== keys.length;
}

export function printResult(result: QueryResult, maxRows = 3): void {
  console.log(`    ${result.rows.length} baris | kolom: ${result.columns.join(', ')}`);
  result.rows.slice(0, maxRows).forEach((row, index) => {
    console.log(`    [${index}] ${row.map(formatCell).join(' | ')}`);
  });
  if (result.rows.length > maxRows) console.log(`    ... (${result.rows.length - maxRows} baris lagi)`);
}
