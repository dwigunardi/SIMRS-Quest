/**
 * Verifikasi diff hasil vs Expected Output (src/lib/resultDiff.ts) — tab "Perbedaan" saat jawaban salah.
 *
 * 1. Kasus unit: sel berbeda, baris kurang/berlebih, urutan salah (pindahan minimal), kolom salah nama /
 *    berlebih / kurang, duplikat, NULL, toleransi angka.
 * 2. Konsistensi dengan penilaian: untuk setiap jawaban salah di scripts/test-cases yang ditolak karena isi
 *    tabel (row-count / cell-values / row-order / column-*), diff harus menunjukkan perbedaan; untuk jawaban
 *    setara (correct) diff harus identik (tanpa urutan yang salah).
 */
import type { SqlJsStatic } from 'sql.js';
import { MISSIONS } from '../../src/data/missions';
import { diffResults, type DiffRowStatus, type ResultDiff } from '../../src/lib/resultDiff';
import { checkMission } from '../../src/lib/validator';
import type { CellValue, MismatchReason, QueryResult } from '../../src/types';
import { MISSION_TEST_CASES } from '../test-cases';
import { assert } from './report';

function table(columns: string[], rows: CellValue[][]): QueryResult {
  return { columns, rows };
}

const EXPECTED = table(
  ['no_rm', 'nama', 'total'],
  [
    ['RM-1', 'Ani', 100],
    ['RM-2', 'Budi', 200],
    ['RM-3', 'Citra', 300],
    ['RM-4', 'Dedi', null],
  ],
);

interface UnitCase {
  label: string;
  expected?: QueryResult;
  actual: QueryResult;
  orderMatters?: boolean;
  counts: Partial<Record<DiffRowStatus, number>>;
  identical?: boolean;
  check?: (diff: ResultDiff) => string | null;
}

const UNIT_CASES: readonly UnitCase[] = [
  { label: 'identik', actual: EXPECTED, counts: { same: 4 }, identical: true },
  {
    label: 'toleransi angka & teks di-trim',
    actual: table(['NO_RM', 'nama', 'total'], [['RM-1', ' Ani ', 100.004], ['RM-2', 'Budi', '200'], ['RM-3', 'Citra', 300], ['RM-4', 'Dedi', null]]),
    counts: { same: 4 },
    identical: true,
  },
  {
    label: 'satu sel berbeda → changed + kolom yang berbeda',
    actual: table(EXPECTED.columns, [['RM-1', 'Ani', 100], ['RM-2', 'Budi', 250], ['RM-3', 'Citra', 300], ['RM-4', 'Dedi', null]]),
    counts: { same: 3, changed: 1 },
    check: (d) => {
      const row = d.rows.find((r) => r.status === 'changed');
      if (!row) return 'tidak ada baris changed';
      if (row.changedColumns.join() !== '2') return `kolom berbeda ${row.changedColumns.join()}`;
      return row.expectedCells[2] === 200 && row.cells[2] === 250 ? null : 'nilai kamu/seharusnya salah';
    },
  },
  {
    label: 'NULL vs nilai dianggap berbeda',
    actual: table(EXPECTED.columns, [['RM-1', 'Ani', 100], ['RM-2', 'Budi', 200], ['RM-3', 'Citra', 300], ['RM-4', 'Dedi', 0]]),
    counts: { same: 3, changed: 1 },
  },
  {
    label: 'baris kurang & berlebih (tanpa sel yang sama)',
    actual: table(EXPECTED.columns, [['RM-1', 'Ani', 100], ['RM-2', 'Budi', 200], ['RM-3', 'Citra', 300], ['X', 'Y', 9]]),
    counts: { same: 3, extra: 1, missing: 1 },
    check: (d) => (d.rows[d.rows.length - 1]?.status === 'missing' ? null : 'baris kurang harus di akhir'),
  },
  {
    label: 'filter terlalu ketat → hanya kurang',
    actual: table(EXPECTED.columns, [['RM-1', 'Ani', 100], ['RM-2', 'Budi', 200]]),
    counts: { same: 2, missing: 2 },
  },
  {
    label: 'hasil kosong → semua kurang',
    actual: table(EXPECTED.columns, []),
    counts: { missing: 4 },
  },
  {
    label: 'urutan tidak dinilai → pertukaran baris bukan masalah',
    actual: table(EXPECTED.columns, [EXPECTED.rows[3] ?? [], EXPECTED.rows[0] ?? [], EXPECTED.rows[1] ?? [], EXPECTED.rows[2] ?? []]),
    counts: { same: 4 },
    identical: true,
  },
  {
    label: 'urutan dinilai → satu baris dipindah = 1 moved (pindahan minimal)',
    actual: table(EXPECTED.columns, [EXPECTED.rows[3] ?? [], EXPECTED.rows[0] ?? [], EXPECTED.rows[1] ?? [], EXPECTED.rows[2] ?? []]),
    orderMatters: true,
    counts: { same: 3, moved: 1 },
    check: (d) => {
      const moved = d.rows.find((r) => r.status === 'moved');
      return moved?.actualIndex === 0 && moved.expectedIndex === 3 ? null : 'baris yang dipindah salah';
    },
  },
  {
    label: 'urutan terbalik penuh → 3 moved',
    actual: table(EXPECTED.columns, [...EXPECTED.rows].reverse()),
    orderMatters: true,
    counts: { same: 1, moved: 3 },
  },
  {
    label: 'kolom salah nama (posisi sama) → renamed, nilai tetap dibandingkan',
    actual: table(['no_rm', 'nama_pasien', 'total'], EXPECTED.rows),
    counts: { same: 4 },
    check: (d) => (d.columns[1]?.status === 'renamed' && d.columns[1].actualName === 'nama_pasien' && !d.identical ? null : 'kolom renamed tidak terdeteksi'),
  },
  {
    label: 'kolom berlebih → extra, baris tetap dipasangkan per nama',
    actual: table(['no_rm', 'kota', 'nama', 'total'], EXPECTED.rows.map((r) => [r[0] ?? null, 'Bandung', r[1] ?? null, r[2] ?? null])),
    counts: { same: 4 },
    check: (d) => (d.columns.find((c) => c.status === 'extra')?.name === 'kota' ? null : 'kolom berlebih tidak terdeteksi'),
  },
  {
    label: 'kolom kurang → missing',
    actual: table(['nama', 'no_rm'], EXPECTED.rows.map((r) => [r[1] ?? null, r[0] ?? null])),
    counts: { same: 4 },
    check: (d) => (d.columns.find((c) => c.status === 'missing')?.name === 'total' ? null : 'kolom kurang tidak terdeteksi'),
  },
  {
    label: 'urutan kolom tertukar → reordered, nilai dicocokkan per nama',
    actual: table(['nama', 'no_rm', 'total'], EXPECTED.rows.map((r) => [r[1] ?? null, r[0] ?? null, r[2] ?? null])),
    counts: { same: 4 },
    check: (d) => (d.columns[0]?.status === 'reordered' && d.columns[1]?.status === 'reordered' && !d.identical ? null : 'urutan kolom tidak terdeteksi'),
  },
  {
    label: 'baris yang hanya kebetulan sama satu sel tidak dipasangkan',
    actual: table(EXPECTED.columns, [['RM-9', 'Zaki', 100], ['RM-2', 'Budi', 200], ['RM-3', 'Citra', 300], ['RM-4', 'Dedi', null]]),
    counts: { same: 3, extra: 1, missing: 1 },
  },
  {
    label: 'duplikat berlebih',
    expected: table(['kota'], [['Bandung'], ['Bogor']]),
    actual: table(['kota'], [['Bandung'], ['Bandung'], ['Bogor']]),
    counts: { same: 2, extra: 1 },
  },
  {
    label: 'baris berbeda dipasangkan ke baris paling mirip (kolom pertama diutamakan)',
    actual: table(EXPECTED.columns, [['RM-1', 'Ani', 100], ['RM-2', 'Budi', 999], ['RM-3', 'Cici', 300], ['RM-4', 'Dedi', null]]),
    counts: { same: 2, changed: 2 },
    check: (d) => {
      const changed = d.rows.filter((r) => r.status === 'changed');
      return changed.every((r) => r.cells[0] === r.expectedCells[0]) ? null : 'pasangan baris salah';
    },
  },
];

function verifyUnits(): number {
  for (const c of UNIT_CASES) {
    const diff = diffResults(c.expected ?? EXPECTED, c.actual, c.orderMatters ?? false);
    const where = `diff "${c.label}"`;
    for (const status of ['same', 'changed', 'moved', 'extra', 'missing'] as const) {
      const want = c.counts[status] ?? 0;
      assert(diff.counts[status] === want, `${where}: ${status}=${diff.counts[status]}, diharapkan ${want}`);
    }
    if (c.identical !== undefined) assert(diff.identical === c.identical, `${where}: identical=${String(diff.identical)}`);
    const problem = c.check?.(diff) ?? null;
    assert(problem === null, `${where}: ${problem ?? ''}`);
  }
  return UNIT_CASES.length;
}

const TABLE_REASONS: ReadonlySet<MismatchReason> = new Set(['row-count', 'cell-values', 'row-order', 'column-count', 'column-names']);

function verifyAgainstGrading(SQL: SqlJsStatic): number {
  let checked = 0;
  for (const mission of MISSIONS) {
    if (mission.kind !== 'sql') continue;
    const cases = MISSION_TEST_CASES[mission.id];
    for (const wrong of cases?.wrong ?? []) {
      const result = checkMission(SQL, mission, wrong.answer);
      if (result.kind !== 'wrong' || !result.actual || !result.expected) continue;
      const reason = result.compare.reason;
      if (!reason || !TABLE_REASONS.has(reason)) continue;
      checked += 1;
      const diff = diffResults(result.expected, result.actual, mission.orderMatters);
      const where = `diff ${mission.id} [salah: ${wrong.label}]`;
      assert(!diff.identical, `${where}: penilaian '${reason}' tetapi diff tidak menunjukkan perbedaan`);
      if (reason === 'row-order') {
        assert(diff.counts.moved > 0 && diff.counts.changed + diff.counts.extra + diff.counts.missing === 0, `${where}: row-order harus tampil sebagai baris 'urutan salah' saja`);
      }
      if (reason === 'row-count') {
        assert(diff.counts.extra + diff.counts.missing > 0, `${where}: row-count harus tampil sebagai baris kurang/berlebih`);
      }
    }
    // Misi 'index' dinilai dari keberadaan index (tabel pembandingnya boleh berbeda, mis. nama index lain).
    if (mission.grading?.type === 'index') continue;
    for (const correct of cases?.correct ?? []) {
      const result = checkMission(SQL, mission, correct.answer);
      if (result.kind !== 'correct' || !result.expected) continue;
      checked += 1;
      const diff = diffResults(result.expected, result.actual, mission.orderMatters);
      assert(diff.identical, `diff ${mission.id} [setara: ${correct.label}]: jawaban benar harus identik di diff`);
    }
  }
  return checked;
}

export function verifyResultDiff(SQL: SqlJsStatic): void {
  const units = verifyUnits();
  const graded = verifyAgainstGrading(SQL);
  console.log(`  ${units} kasus unit, ${graded} jawaban kurikulum konsisten dengan penilaian ✓`);
}
