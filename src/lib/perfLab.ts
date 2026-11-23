/**
 * Lab Performa (fungsi murni): menjalankan skrip di database besar dan mengukur waktunya dengan cara yang bisa
 * dibandingkan antar-run.
 *
 * - Semua baris hasil dihitung (database benar-benar mengerjakan seluruh query), tetapi hanya LAB_PREVIEW_ROWS baris
 *   pertama yang disimpan untuk ditampilkan — tidak ada ratusan ribu baris yang dikirim ke halaman.
 * - Skrip yang hanya membaca dijalankan LAB_TIMED_RUNS kali dan waktu MEDIAN-nya yang dilaporkan (run pertama sering
 *   lebih lambat karena cache masih dingin). Skrip pengubah (CREATE INDEX, UPDATE, …) dijalankan sekali; bila diakhiri
 *   SELECT, SELECT itu diukur ulang sendiri sehingga waktu MEMBUAT index tidak tercampur dengan waktu MEMAKAI-nya
 *   (waktu sisanya dilaporkan sebagai `setupMs`).
 * - Query plan statement SELECT terakhir ikut dikembalikan, dengan ringkasan SCAN/SEARCH per baris plan.
 */
import type { Database } from 'sql.js';
import type { CellValue, ExecFailure } from '../types';
import { EMPTY_QUERY_FAILURE, explainQueryPlan, finalizeIterator, getTotalChanges, isReadOnlyScript, toFriendlyError } from './sqlEngine';

export const LAB_PREVIEW_ROWS = 50;
export const LAB_TIMED_RUNS = 3;

export type PlanAccess = 'scan' | 'search' | 'other';

export interface PlanLine {
  detail: string;
  /** scan = membaca seluruh tabel/index; search = melompat lewat index/primary key. */
  access: PlanAccess;
}

export interface LabSuccess {
  ok: true;
  /** Kolom & cuplikan baris result set TERAKHIR (kosong bila skrip tidak menghasilkan tabel). */
  columns: string[];
  rows: CellValue[][];
  /** Jumlah baris sebenarnya dari result set terakhir. */
  rowCount: number;
  /**
   * Waktu eksekusi (ms): median dari `runs` kali untuk skrip baca (atau untuk SELECT penutup skrip pengubah);
   * satu kali untuk skrip pengubah tanpa SELECT penutup.
   */
  elapsedMs: number;
  runs: number;
  /** Skrip pengubah yang diakhiri SELECT: waktu bagian pengubahnya (mis. CREATE INDEX), dijalankan sekali. Selain itu null. */
  setupMs: number | null;
  mutated: boolean;
  rowsModified: number;
  plan: PlanLine[];
}

export type LabResult = LabSuccess | ExecFailure;

/** SCAN (termasuk "SCAN … USING INDEX": tetap seluruh index dibaca) vs SEARCH; baris lain (sorter, subquery) = other. */
export function classifyPlanLine(detail: string): PlanAccess {
  if (/^SCAN\b/i.test(detail)) return 'scan';
  if (/^SEARCH\b/i.test(detail)) return 'search';
  return 'other';
}

interface Counted {
  columns: string[];
  rows: CellValue[][];
  rowCount: number;
  lastSql: string | null;
}

function runCounting(db: Database, sql: string): Counted {
  let last: Counted = { columns: [], rows: [], rowCount: 0, lastSql: null };
  const iterator = db.iterateStatements(sql);
  try {
    for (const stmt of iterator) {
      try {
        const columns = stmt.getColumnNames();
        const rows: CellValue[][] = [];
        let rowCount = 0;
        while (stmt.step()) {
          if (rowCount < LAB_PREVIEW_ROWS) rows.push(stmt.get());
          rowCount += 1;
        }
        if (columns.length > 0) last = { columns, rows, rowCount, lastSql: stmt.getSQL().trim() };
      } finally {
        stmt.free();
      }
    }
  } catch (err) {
    finalizeIterator(iterator);
    throw err;
  }
  return last;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function planOf(db: Database, sql: string | null): PlanLine[] {
  if (!sql || /^\s*EXPLAIN\b/i.test(sql)) return [];
  const outcome = explainQueryPlan(db, sql);
  if (!outcome.ok) return [];
  const result = outcome.results[0];
  const detailIndex = result?.columns.indexOf('detail') ?? -1;
  if (!result || detailIndex < 0) return [];
  return result.rows.map((row) => {
    const detail = String(row[detailIndex] ?? '');
    return { detail, access: classifyPlanLine(detail) };
  });
}

/** Jalankan `sql` di `db` (database besar) dan ukur. Error SQL dikembalikan sebagai ExecFailure, tidak dilempar. */
export function runLab(db: Database, sql: string): LabResult {
  if (sql.trim() === '') return EMPTY_QUERY_FAILURE;
  const readOnly = isReadOnlyScript(sql);
  const runs = readOnly ? LAB_TIMED_RUNS : 1;
  const changesBefore = getTotalChanges(db);
  try {
    const times: number[] = [];
    let counted: Counted = { columns: [], rows: [], rowCount: 0, lastSql: null };
    for (let i = 0; i < runs; i += 1) {
      const start = performance.now();
      counted = runCounting(db, sql);
      times.push(performance.now() - start);
    }
    let elapsedMs = median(times);
    let timedRuns = runs;
    let setupMs: number | null = null;
    // Skrip pengubah yang diakhiri SELECT murni: ukur SELECT-nya sendiri (aman diulang karena hanya membaca).
    if (!readOnly && counted.lastSql && isReadOnlyScript(counted.lastSql)) {
      const selectTimes: number[] = [];
      for (let i = 0; i < LAB_TIMED_RUNS; i += 1) {
        const start = performance.now();
        runCounting(db, counted.lastSql);
        selectTimes.push(performance.now() - start);
      }
      const selectMs = median(selectTimes);
      setupMs = Math.max(0, elapsedMs - selectMs);
      elapsedMs = selectMs;
      timedRuns = LAB_TIMED_RUNS;
    }
    return {
      ok: true,
      columns: counted.columns,
      rows: counted.rows,
      rowCount: counted.rowCount,
      elapsedMs,
      runs: timedRuns,
      setupMs,
      mutated: !readOnly,
      rowsModified: Math.max(0, getTotalChanges(db) - changesBefore),
      plan: planOf(db, counted.lastSql),
    };
  } catch (err) {
    const rawError = err instanceof Error ? err.message : String(err);
    return { ok: false, rawError, friendlyError: toFriendlyError(rawError) };
  }
}

/** Ringkasan satu kata untuk riwayat: ada SCAN → 'scan'; semua akses tabel lewat SEARCH → 'search'; tanpa plan → 'other'. */
export function planSummary(plan: readonly PlanLine[]): PlanAccess {
  if (plan.some((line) => line.access === 'scan')) return 'scan';
  return plan.some((line) => line.access === 'search') ? 'search' : 'other';
}

/** Contoh percobaan siap pakai. Urutannya membentuk cerita: ukur → perbaiki → ukur lagi. */
export const LAB_PRESETS: ReadonlyArray<{ id: string; title: string; note: string; sql: string }> = [
  {
    id: 'sep-scan',
    title: '1a. Cari satu SEP (tanpa index)',
    note: 'Kolom no_sep belum punya index: database membaca 200.000 kunjungan untuk menemukan satu baris.',
    sql: "SELECT no_rawat, no_rm, tgl_kunjungan\nFROM kunjungan\nWHERE no_sep = '0301R00100000123456';",
  },
  {
    id: 'sep-index',
    title: '1b. Buat index, cari lagi',
    note: 'Setelah CREATE INDEX, pencarian yang sama melompat langsung ke barisnya (SEARCH). Bandingkan waktunya di riwayat.',
    sql: "CREATE INDEX IF NOT EXISTS idx_kunjungan_sep ON kunjungan (no_sep);\n\nSELECT no_rawat, no_rm, tgl_kunjungan\nFROM kunjungan\nWHERE no_sep = '0301R00100000123456';",
  },
  {
    id: 'bulan-fungsi',
    title: '2a. Laporan bulanan dengan strftime',
    note: 'Index idx_kunjungan_tgl sudah ada, tetapi kolomnya dibungkus fungsi — index tidak terpakai (SCAN).',
    sql: "SELECT COUNT(*) AS kunjungan_oktober\nFROM kunjungan\nWHERE strftime('%Y-%m', tgl_kunjungan) = '2026-10';",
  },
  {
    id: 'bulan-rentang',
    title: '2b. Laporan yang sama, sargable',
    note: 'Rentang langsung pada kolom memakai index yang sama sekali tidak tersentuh di 2a.',
    sql: "SELECT COUNT(*) AS kunjungan_oktober\nFROM kunjungan\nWHERE tgl_kunjungan >= '2026-10-01'\n  AND tgl_kunjungan < '2026-11-01';",
  },
  {
    id: 'icd-like',
    title: '3a. Penyakit jantung koroner dengan LIKE',
    note: "LIKE 'I2%' tidak bisa memakai index biasa di SQLite, dan diagnosa.kode_icd10 memang belum ber-index.",
    sql: "SELECT COUNT(*) AS jumlah\nFROM diagnosa\nWHERE kode_icd10 LIKE 'I2%';",
  },
  {
    id: 'icd-rentang',
    title: '3b. Index + rentang kode',
    note: 'Index pada kode_icd10 ditambah rentang >= … AND < … menggantikan LIKE.',
    sql: "CREATE INDEX IF NOT EXISTS idx_diagnosa_icd10 ON diagnosa (kode_icd10);\n\nSELECT COUNT(*) AS jumlah\nFROM diagnosa\nWHERE kode_icd10 >= 'I20' AND kode_icd10 < 'I26';",
  },
];
