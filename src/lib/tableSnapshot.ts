/**
 * Sidik jari isi SELURUH tabel seed. Dipakai penilaian 'state' dan 'index' untuk menangkap
 * kerusakan kolateral di tabel yang tidak ditampilkan verifySql, mis. `DELETE FROM billing;`
 * yang diselipkan setelah INSERT pasien yang benar.
 */
import type { Database } from 'sql.js';
import type { CompareOutcome, QueryResult } from '../types';
import { TABLE_ORDER } from '../db/seed';
import { compareResults } from './compare';
import { executeSql } from './sqlEngine';

/** Isi setiap tabel (null = tabel tidak bisa dibaca, mis. sudah di-DROP). */
export type TableSnapshot = ReadonlyMap<string, QueryResult | null>;

export interface TableDamage {
  table: string;
  actual: QueryResult | null;
  expected: QueryResult;
  compare: CompareOutcome;
}

function readTable(db: Database, table: string): QueryResult | null {
  const outcome = executeSql(db, `SELECT * FROM "${table}" ORDER BY rowid;`);
  if (!outcome.ok) return null;
  return outcome.results[0] ?? null;
}

export function snapshotTables(db: Database): TableSnapshot {
  return new Map(TABLE_ORDER.map((table) => [table, readTable(db, table)]));
}

const MISSING_TABLE: CompareOutcome = {
  match: false,
  reason: 'no-result',
  message: 'Tabel tidak bisa dibaca lagi.',
  firstDiff: null,
};

/**
 * Tabel pertama (urutan TABLE_ORDER) yang isinya berbeda dari snapshot solusi, atau null jika semua sama.
 * Baris dibandingkan sebagai multiset, jadi menghapus lalu menyisipkan ulang baris yang sama tidak dianggap rusak.
 */
export function findTableDamage(expected: TableSnapshot, actual: TableSnapshot): TableDamage | null {
  for (const table of TABLE_ORDER) {
    const expectedRows = expected.get(table);
    if (!expectedRows) continue;
    const actualRows = actual.get(table) ?? null;
    if (!actualRows) return { table, actual: null, expected: expectedRows, compare: MISSING_TABLE };
    const compare = compareResults(expectedRows, actualRows, false);
    if (!compare.match) return { table, actual: actualRows, expected: expectedRows, compare };
  }
  return null;
}
