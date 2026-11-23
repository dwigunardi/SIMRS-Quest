/**
 * Penilaian jawaban misi SQL. SqlJsStatic di-inject agar bisa berjalan di Node juga.
 *
 * Setiap penilaian memakai database seed SEGAR (solusi dan jawaban user di DB terpisah)
 * dan selalu menutup DB-nya, sehingga query destruktif tidak memengaruhi apa pun.
 */
import type { Database, SqlJsStatic } from 'sql.js';
import type {
  CheckResult,
  CheckView,
  CompareOutcome,
  ExecFailure,
  ExecSuccess,
  MismatchReason,
  QueryResult,
  SqlGrading,
  SqlMission,
} from '../types';
import { compareResults } from './compare';
import {
  analyzeColumnSearch,
  analyzeQueryPlan,
  columnIndexStatus,
  findWrappingFunction,
  formatPlanNote,
  planToResult,
} from './queryPlan';
import { findMissingPatterns, missingConstructMessage, missingConstructNote } from './requiredPatterns';
import { createSeededDatabase, executeSql, readIndexes } from './sqlEngine';
import { findTableDamage, snapshotTables, type TableDamage, type TableSnapshot } from './tableSnapshot';
import {
  firstProbeMismatch,
  objectProblem,
  probeMessage,
  probesResult,
  readObjectFacts,
  runProbes,
  structureResult,
  tableDifferences,
  type ObjectFacts,
  type ProbeOutcome,
} from './schemaCheck';
import { isTransactionActive, traceTransactions } from './transactionTrace';

type ResultGrading = Extract<SqlGrading, { type: 'result' }>;
type StateGrading = Extract<SqlGrading, { type: 'state' }>;
type IndexGrading = Extract<SqlGrading, { type: 'index' }>;
type SchemaGrading = Extract<SqlGrading, { type: 'schema' }>;
type IndexRequirement = NonNullable<ResultGrading['requireIndexOn']>;

export const SOLUTION_BUG_MESSAGE =
  'Terjadi kesalahan internal pada kunci jawaban misi ini (bukan salahmu). Coba muat ulang halaman.';

const DEFAULT_LABELS = { actualLabel: 'Hasil Kamu', expectedLabel: 'Expected Output' } as const;

const OPEN_TRANSACTION_MESSAGE =
  'Transaksi kamu masih terbuka: ada BEGIN tanpa COMMIT atau ROLLBACK di akhir. Perubahan yang belum di-COMMIT belum permanen, tidak terlihat oleh koneksi lain, dan otomatis dibatalkan saat koneksi terputus. Tabel di bawah menunjukkan isi tabel setelah transaksi itu dibatalkan. Akhiri transaksi dengan COMMIT (simpan) atau ROLLBACK (batalkan).';

/* ------------------------------------------------------------------ */
/* Helper umum                                                         */
/* ------------------------------------------------------------------ */

function gradingOf(mission: SqlMission): SqlGrading {
  return mission.grading ?? { type: 'result' };
}

function assertNever(value: never): never {
  throw new Error(`Jenis grading tidak dikenal: ${JSON.stringify(value)}`);
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function withFreshDb<T>(SQL: SqlJsStatic, fn: (db: Database) => T): T {
  const db = createSeededDatabase(SQL);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function lastResult(outcome: ExecSuccess): QueryResult | null {
  return outcome.results[outcome.results.length - 1] ?? null;
}

function mismatch(reason: MismatchReason, message: string): CompareOutcome {
  return { match: false, reason, message, firstDiff: null };
}

function errorResult(outcome: ExecFailure): CheckResult {
  return { kind: 'error', rawError: outcome.rawError, friendlyError: outcome.friendlyError };
}

function wrong(
  actual: QueryResult | null,
  expected: QueryResult | null,
  compare: CompareOutcome,
  elapsedMs: number,
  view?: CheckView,
): CheckResult {
  return view ? { kind: 'wrong', actual, expected, compare, elapsedMs, view } : { kind: 'wrong', actual, expected, compare, elapsedMs };
}

function correct(actual: QueryResult, expected: QueryResult, elapsedMs: number, view?: CheckView): CheckResult {
  return view ? { kind: 'correct', actual, expected, elapsedMs, view } : { kind: 'correct', actual, expected, elapsedMs };
}

function withNote(view: CheckView | undefined, note: string | undefined): CheckView | undefined {
  if (!note) return view;
  const base = view ?? { ...DEFAULT_LABELS };
  return { ...base, note: base.note ? `${base.note}\n\n${note}` : note };
}

function rollbackQuietly(db: Database): void {
  try {
    db.exec('ROLLBACK');
  } catch {
    /* tidak ada transaksi aktif */
  }
}

/* ------------------------------------------------------------------ */
/* Expected output per jenis grading                                   */
/* ------------------------------------------------------------------ */

function runOrThrow(db: Database, sql: string, what: string): ExecSuccess {
  const outcome = executeSql(db, sql);
  if (!outcome.ok) throw new Error(`${what} gagal dijalankan: ${outcome.rawError}`);
  return outcome;
}

/** Fakta pembanding misi DDL: struktur objek setelah solusi dan hasil setiap probe. */
interface SchemaSolution {
  facts: ReadonlyMap<string, ObjectFacts>;
  probes: readonly ProbeOutcome[];
}

interface Solved {
  expected: QueryResult;
  schema: SchemaSolution | null;
}

function solveSchema(db: Database, grading: SchemaGrading, label: string): Solved {
  const facts = new Map<string, ObjectFacts>();
  for (const obj of grading.objects) {
    const found = readObjectFacts(db, obj.name);
    if (!found || found.type !== obj.type) throw new Error(`${label}: solutionSql tidak membuat ${obj.type} ${obj.name}.`);
    facts.set(obj.name, found);
  }
  const probes = runProbes(db, grading.probes);
  const result = lastResult(runOrThrow(db, grading.verifySql, `${label}: verifySql`));
  if (!result) throw new Error(`${label}: verifySql tidak menghasilkan result set.`);
  return { expected: result, schema: { facts, probes } };
}

function solve(db: Database, mission: SqlMission): Solved {
  const label = `Misi "${mission.id}"`;
  const solution = runOrThrow(db, mission.solutionSql, `${label}: solutionSql`);
  const grading = gradingOf(mission);

  switch (grading.type) {
    case 'result': {
      const result = lastResult(solution);
      if (!result) throw new Error(`${label}: solutionSql tidak menghasilkan result set.`);
      return { expected: result, schema: null };
    }
    case 'state': {
      const result = lastResult(runOrThrow(db, grading.verifySql, `${label}: verifySql`));
      if (!result) throw new Error(`${label}: verifySql tidak menghasilkan result set.`);
      return { expected: result, schema: null };
    }
    case 'index': {
      const plan = analyzeQueryPlan(db, grading.probeSql, grading.table);
      if (!plan.ok) throw new Error(`${label}: EXPLAIN probeSql gagal: ${plan.rawError}`);
      return { expected: planToResult(plan.lines), schema: null };
    }
    case 'schema':
      return solveSchema(db, grading, label);
    default:
      return assertNever(grading);
  }
}

/**
 * Expected output misi: result set solusi ('result'), hasil verifySql ('state'; 'schema' setelah probe), atau query
 * plan probeSql ('index').
 */
export function runSolution(SQL: SqlJsStatic, mission: SqlMission): QueryResult {
  return withFreshDb(SQL, (db) => solve(db, mission).expected);
}

interface SolutionRun {
  expected: QueryResult;
  /** Isi seluruh tabel setelah solutionSql (dan probe, untuk 'schema') — pembanding kerusakan kolateral. */
  snapshot: TableSnapshot;
  schema: SchemaSolution | null;
}

function runSolutionWithSnapshot(SQL: SqlJsStatic, mission: SqlMission): SolutionRun {
  return withFreshDb(SQL, (db) => {
    const { expected, schema } = solve(db, mission);
    return { expected, schema, snapshot: snapshotTables(db) };
  });
}

/* ------------------------------------------------------------------ */
/* Konteks penilaian                                                   */
/* ------------------------------------------------------------------ */

interface GradeContext {
  SQL: SqlJsStatic;
  /** DB segar tempat SQL user sudah dijalankan. */
  db: Database;
  mission: SqlMission;
  userSql: string;
  outcome: ExecSuccess;
  solution: SolutionRun;
}

/* ------------------------------------------------------------------ */
/* Kerusakan kolateral (state & index)                                 */
/* ------------------------------------------------------------------ */

function damageMessage(damage: TableDamage): string {
  const { table, actual, expected, compare } = damage;
  const advice =
    'Soal hanya meminta perubahan yang disebutkan; tabel dan baris lain tidak boleh tersentuh. Periksa setiap statement INSERT/UPDATE/DELETE beserta kondisi WHERE-nya, lalu hapus statement yang tidak diminta.';
  if (!actual) {
    return `Tabel ${table} tidak bisa dibaca lagi setelah query kamu dijalankan (terhapus atau strukturnya rusak?). ${advice}`;
  }
  switch (compare.reason) {
    case 'row-count':
      return `Ada perubahan nyasar di tabel ${table}: jumlah barisnya menjadi ${actual.rows.length}, seharusnya tetap ${expected.rows.length}. ${advice}`;
    case 'column-count':
    case 'column-names':
      return `Struktur tabel ${table} berubah (kolomnya berbeda). Misi ini hanya meminta perubahan DATA, jangan mengubah struktur tabel (ALTER/DROP). ${advice}`;
    default:
      return `Ada perubahan nyasar di tabel ${table}: sebagian nilainya berubah, padahal tabel itu tidak termasuk perubahan yang diminta. ${advice}`;
  }
}

function damageView(table: string): CheckView {
  return {
    actualLabel: `Isi tabel ${table} — hasil query kamu`,
    expectedLabel: `Isi tabel ${table} — seharusnya (tidak berubah)`,
    note: `Penilaian juga membandingkan ISI SEMUA TABEL. Bagian yang diminta soal sudah benar, tetapi tabel ${table} ikut berubah.`,
  };
}

/** CheckResult 'wrong' jika ada tabel yang isinya berbeda dari kondisi setelah solusi; null jika tidak ada. */
function checkCollateralDamage(ctx: GradeContext): CheckResult | null {
  const damage = findTableDamage(ctx.solution.snapshot, snapshotTables(ctx.db));
  if (!damage) return null;
  const reason: MismatchReason = damage.compare.reason ?? 'cell-values';
  return wrong(damage.actual, damage.expected, mismatch(reason, damageMessage(damage)), ctx.outcome.elapsedMs, damageView(damage.table));
}

/* ------------------------------------------------------------------ */
/* Grading 'result'                                                    */
/* ------------------------------------------------------------------ */

function planScanResultMessage(req: IndexRequirement): string {
  return `Hasil query kamu sudah benar, tetapi tabel ${req.table} tidak dicari lewat index yang diawali kolom ${req.column}: database membaca seluruh tabel baris demi baris (full SCAN) atau memakai index lain yang tidak menyaring kolom ${req.column}. Penyebab paling umum: kolom ${req.column} dibungkus fungsi (mis. strftime(), substr(), date()) atau dipakai dengan LIKE. Tulis kondisi yang membandingkan kolomnya secara langsung (sargable), misalnya dengan rentang >= ... AND < ..., agar SQLite bisa melompat langsung ke bagian index yang relevan. Lihat query plan di catatan: SCAN = membaca semua baris, SEARCH ... USING INDEX = memakai index.`;
}

function oneSidedMessage(req: IndexRequirement): string {
  return `Hampir! Index pada ${req.column} memang dipakai, tetapi hanya dengan batas di satu sisi (lihat ${req.column}>? atau ${req.column}<? di query plan). Artinya SQLite tetap membaca semua baris dari batas itu sampai ujung index, lalu menyaring sisanya satu per satu. Untuk data bertahun-tahun, itu hampir sama lambatnya dengan full SCAN. Beri batas bawah DAN batas atas langsung pada kolom ${req.column} (mis. >= awal bulan AND < awal bulan berikutnya), lalu buang filter lain yang membungkus kolom itu dengan fungsi.`;
}

function wrappedColumnMessage(req: IndexRequirement, fn: string): string {
  return `Hasil query kamu sudah benar, tetapi kolom ${req.column} masih dibungkus fungsi ${fn}(...). Kondisi seperti itu tidak sargable: SQLite harus menghitung ${fn}() untuk SETIAP baris sebelum bisa membandingkan, sehingga index pada ${req.column} tidak bisa dipakai untuk kondisi tersebut. Hapus pembungkus fungsinya dan nyatakan filter sebagai rentang langsung pada kolom ${req.column}.`;
}

/** Bagian SQL setelah FROM pertama (daftar kolom SELECT luar tidak ikut diperiksa). */
function afterFirstFrom(sql: string): string {
  const match = /\bFROM\b/i.exec(sql);
  return match ? sql.slice(match.index) : sql;
}

function gradeIndexRequirement(ctx: GradeContext, req: IndexRequirement, actual: QueryResult, expected: QueryResult): CheckResult {
  const { db, outcome } = ctx;
  const unreadable = (detail: string): CheckResult =>
    wrong(actual, expected, mismatch('plan-scan', `Query plan statement terakhirmu tidak bisa dianalisis${detail}. Pastikan statement terakhir adalah SELECT biasa.`), outcome.elapsedMs);
  const sql = outcome.lastResultSql;
  if (!sql) return unreadable('');
  const plan = analyzeColumnSearch(db, sql, req.table, req.column);
  if (!plan.ok) return unreadable(` (${plan.rawError})`);

  const view = withNote(undefined, formatPlanNote(plan.lines));
  const wrapper = findWrappingFunction(afterFirstFrom(sql), req.column);
  if (wrapper) return wrong(actual, expected, mismatch('plan-scan', wrappedColumnMessage(req, wrapper)), outcome.elapsedMs, view);
  if (!plan.noFullScan || plan.search === 'none') {
    return wrong(actual, expected, mismatch('plan-scan', planScanResultMessage(req)), outcome.elapsedMs, view);
  }
  if (plan.search === 'one-sided') return wrong(actual, expected, mismatch('plan-scan', oneSidedMessage(req)), outcome.elapsedMs, view);

  const praise = `Mantap: tabel ${req.table} dicari lewat index pada ${req.column} dengan batas yang jelas (SEARCH), bukan full SCAN.`;
  return correct(actual, expected, outcome.elapsedMs, withNote(view, praise));
}

function gradeResult(ctx: GradeContext, grading: ResultGrading): CheckResult {
  const { mission, outcome } = ctx;
  const { expected } = ctx.solution;
  const actual = lastResult(outcome);
  const missing = findMissingPatterns(ctx.userSql, mission.requiredPatterns);
  const compare = compareResults(expected, actual, mission.orderMatters);

  if (!compare.match || !actual) {
    const note = missing.length > 0 ? missingConstructNote(missing) : undefined;
    return wrong(actual, expected, compare, outcome.elapsedMs, withNote(undefined, note));
  }
  if (missing.length > 0) {
    return wrong(actual, expected, mismatch('missing-construct', missingConstructMessage(missing)), outcome.elapsedMs);
  }

  const req = grading.requireIndexOn;
  if (!req) return correct(actual, expected, outcome.elapsedMs);
  return gradeIndexRequirement(ctx, req, actual, expected);
}

/* ------------------------------------------------------------------ */
/* Grading 'state'                                                     */
/* ------------------------------------------------------------------ */

const GENERIC_DIFF_TIP = 'Periksa kembali kondisi filter, JOIN, atau perhitunganmu.';
const STATE_DIFF_TIP = 'Periksa nilai yang kamu INSERT/SET dan kondisi WHERE-nya: apakah perubahan mengenai baris yang tepat, tidak lebih dan tidak kurang?';

function stateView(grading: StateGrading): CheckView {
  return {
    actualLabel: `${grading.label} — hasil query kamu`,
    expectedLabel: `${grading.label} — seharusnya`,
    note: 'Penilaian berdasarkan ISI TABEL setelah query kamu dijalankan, bukan dari hasil SELECT yang kamu tulis.',
  };
}

function stateMessage(compare: CompareOutcome, expected: QueryResult, actual: QueryResult | null): string {
  switch (compare.reason) {
    case 'row-count':
      return `Jumlah baris di tabel berbeda: seharusnya ${expected.rows.length} baris, setelah query kamu ada ${actual?.rows.length ?? 0} baris. Periksa apakah INSERT/DELETE sudah dijalankan, dan apakah kondisi WHERE terlalu luas atau terlalu sempit.`;
    case 'column-count':
    case 'column-names':
      return 'Struktur tabel berubah (kolomnya berbeda dari seharusnya). Misi ini hanya meminta perubahan DATA, jangan mengubah struktur tabel (ALTER/DROP).';
    case 'cell-values':
      return `Isi tabel setelah query kamu belum sesuai. ${compare.message.replace(GENERIC_DIFF_TIP, STATE_DIFF_TIP)}`;
    default:
      return compare.message;
  }
}

function readState(db: Database, verifySql: string): { ok: true; result: QueryResult | null } | ExecFailure {
  const outcome = executeSql(db, verifySql);
  if (!outcome.ok) return outcome;
  return { ok: true, result: lastResult(outcome) };
}

const MAX_LISTED_STATEMENTS = 3;

function autocommitMessage(statements: readonly string[]): string {
  const listed = statements
    .slice(0, MAX_LISTED_STATEMENTS)
    .map((s) => `"${s.replace(/\s+/g, ' ')}"`)
    .join(', ');
  const more = statements.length > MAX_LISTED_STATEMENTS ? ` (dan ${statements.length - MAX_LISTED_STATEMENTS} lainnya)` : '';
  return `Isi tabel akhirnya sudah benar, tetapi tidak semua perubahan terjadi di dalam transaksi. Statement berikut berjalan dalam mode autocommit (di luar BEGIN … COMMIT), sehingga langsung permanen sendiri-sendiri: ${listed}${more}. Jika koneksi putus atau listrik padam di antara statement, data bisa tertinggal setengah jadi, persis kondisi yang ingin dicegah misi ini. Letakkan SEMUA perubahan di antara BEGIN dan COMMIT.`;
}

const NOTHING_ROLLED_BACK_MESSAGE =
  'Isi tabel akhirnya sudah benar, tetapi ROLLBACK di skrip kamu tidak membatalkan perubahan apa pun: tidak ada baris yang berubah di dalam transaksi sebelum ROLLBACK dijalankan. Misi ini melatih alur penyelamatan: jalankan dulu UPDATE yang keliru di dalam transaksi (BEGIN; lalu UPDATE tanpa WHERE seperti di cerita), lihat dampaknya, baru batalkan dengan ROLLBACK;. Setelah itu lakukan perubahan yang benar dalam transaksi baru dan COMMIT.';

/** Pelanggaran aturan transaksi (dilacak per statement di DB segar terpisah), atau null jika aman. */
function transactionViolation(ctx: GradeContext, rules: NonNullable<StateGrading['transaction']>): string | null {
  const trace = withFreshDb(ctx.SQL, (db) => traceTransactions(db, ctx.userSql));
  if ('ok' in trace) return null; // tidak terjadi: SQL yang sama sudah sukses di DB penilaian
  if (trace.autocommitChanges.length > 0) return autocommitMessage(trace.autocommitChanges);
  if (rules.requireRolledBackChange && trace.rolledBackChanges === 0) return NOTHING_ROLLED_BACK_MESSAGE;
  return null;
}

function gradeState(ctx: GradeContext, grading: StateGrading): CheckResult {
  const { db, mission } = ctx;
  const { expected } = ctx.solution;
  const { elapsedMs } = ctx.outcome;
  const view = stateView(grading);

  if (isTransactionActive(db)) {
    rollbackQuietly(db);
    const state = readState(db, grading.verifySql);
    const actual = state.ok ? state.result : null;
    return wrong(actual, expected, mismatch('open-transaction', OPEN_TRANSACTION_MESSAGE), elapsedMs, view);
  }

  const state = readState(db, grading.verifySql);
  if (!state.ok) {
    const message = `Isi tabel tidak bisa dibaca setelah query kamu dijalankan (${state.rawError}). Apakah ada tabel atau kolom yang terhapus/diubah? Misi ini hanya meminta perubahan data.`;
    return wrong(null, expected, mismatch('no-result', message), elapsedMs, view);
  }

  const actual = state.result;
  const compare = compareResults(expected, actual, mission.orderMatters);
  const missing = findMissingPatterns(ctx.userSql, mission.requiredPatterns);

  if (!compare.match || !actual) {
    const note = missing.length > 0 ? missingConstructNote(missing) : undefined;
    const reworded: CompareOutcome = { ...compare, message: stateMessage(compare, expected, actual) };
    return wrong(actual, expected, reworded, elapsedMs, withNote(view, note));
  }

  const damage = checkCollateralDamage(ctx);
  if (damage) return damage;
  if (missing.length > 0) {
    return wrong(actual, expected, mismatch('missing-construct', missingConstructMessage(missing)), elapsedMs, view);
  }

  const violation = grading.transaction ? transactionViolation(ctx, grading.transaction) : null;
  if (violation) return wrong(actual, expected, mismatch('transaction-flow', violation), elapsedMs, view);
  return correct(actual, expected, elapsedMs, view);
}

/* ------------------------------------------------------------------ */
/* Grading 'index'                                                     */
/* ------------------------------------------------------------------ */

function indexView(grading: IndexGrading): CheckView {
  return {
    actualLabel: 'Query plan setelah query kamu',
    expectedLabel: 'Query plan seharusnya',
    note: `Query uji: ${grading.probeSql.trim()}\nKeterangan: SCAN berarti membaca seluruh tabel baris demi baris; SEARCH ... USING INDEX berarti langsung melompat ke baris yang cocok lewat index.`,
  };
}

function describeIndexes(db: Database, table: string): string {
  const indexes = readIndexes(db, table);
  if (indexes.length === 0) return '(belum ada)';
  return indexes.map((idx) => `${idx.name} (${idx.columns.join(', ')})${idx.partial ? ' [partial]' : ''}`).join('; ');
}

function indexMissingMessage(db: Database, grading: IndexGrading): string {
  return `Belum ada index pada tabel ${grading.table} yang diawali kolom ${grading.column}. Index yang ada di tabel itu sekarang: ${describeIndexes(db, grading.table)}. Ingat: kolom yang difilter harus menjadi kolom PERTAMA di index; index komposit (a, b) tidak membantu pencarian yang hanya memfilter b.`;
}

function partialIndexMessage(grading: IndexGrading): string {
  return `Index pada ${grading.table}(${grading.column}) yang kamu buat adalah partial index (CREATE INDEX ... WHERE ...), jadi hanya mencakup baris yang memenuhi kondisi WHERE-nya. Pencarian di luar kondisi itu (mis. nilai ${grading.column} lain yang juga sering dicari) tetap harus membaca seluruh tabel. Buat index biasa tanpa klausa WHERE agar semua baris tercakup.`;
}

function planScanIndexMessage(grading: IndexGrading): string {
  return `Index pada ${grading.table}(${grading.column}) sudah ada, tetapi query uji masih melakukan full SCAN. Pastikan index itu tidak memakai COLLATE yang berbeda dari kolomnya (mis. COLLATE NOCASE), karena perbandingan = biasa memakai collation bawaan kolom.`;
}

function gradeIndex(ctx: GradeContext, grading: IndexGrading): CheckResult {
  const { db, mission } = ctx;
  const { expected } = ctx.solution;
  const { elapsedMs } = ctx.outcome;
  const view = indexView(grading);
  const openTransaction = isTransactionActive(db);
  if (openTransaction) rollbackQuietly(db);

  const plan = analyzeQueryPlan(db, grading.probeSql, grading.table);
  if (!plan.ok) {
    const message = `Query uji tidak bisa dianalisis setelah query kamu dijalankan (${plan.rawError}). Apakah tabel ${grading.table} atau kolomnya terhapus/diubah?`;
    return wrong(null, expected, mismatch('no-result', message), elapsedMs, view);
  }

  const actual = planToResult(plan.lines);
  if (openTransaction) {
    return wrong(actual, expected, mismatch('open-transaction', OPEN_TRANSACTION_MESSAGE), elapsedMs, view);
  }
  const status = columnIndexStatus(db, grading.table, grading.column);
  if (status === 'none') return wrong(actual, expected, mismatch('index-missing', indexMissingMessage(db, grading)), elapsedMs, view);
  if (status === 'partial-only') return wrong(actual, expected, mismatch('index-missing', partialIndexMessage(grading)), elapsedMs, view);
  if (!plan.usesIndex) return wrong(actual, expected, mismatch('plan-scan', planScanIndexMessage(grading)), elapsedMs, view);

  const damage = checkCollateralDamage(ctx);
  if (damage) return damage;
  const missing = findMissingPatterns(ctx.userSql, mission.requiredPatterns);
  if (missing.length > 0) {
    return wrong(actual, expected, mismatch('missing-construct', missingConstructMessage(missing)), elapsedMs, view);
  }
  return correct(actual, expected, elapsedMs, view);
}

/* ------------------------------------------------------------------ */
/* Grading 'schema' (DDL)                                              */
/* ------------------------------------------------------------------ */

function schemaView(grading: SchemaGrading): CheckView {
  return {
    actualLabel: `${grading.label} — hasil skripmu`,
    expectedLabel: `${grading.label} — seharusnya`,
    note: 'Penilaian DDL: (1) objek & struktur tabel, (2) uji perilaku — INSERT/UPDATE yang harus diterima atau ditolak, dijalankan penilai setelah skripmu, (3) isi akhir setelah uji.',
  };
}

function structureView(table: string): CheckView {
  return {
    actualLabel: `Struktur ${table} — skripmu`,
    expectedLabel: `Struktur ${table} — seharusnya`,
    note: 'Kolom diurutkan menurut nama. CHECK dan DEFAULT tidak tampil di sini — keduanya dinilai lewat uji perilaku setelah strukturnya sesuai.',
  };
}

const PROBE_VIEW: CheckView = {
  actualLabel: 'Uji perilaku — tabelmu',
  expectedLabel: 'Uji perilaku — seharusnya',
  note: 'Setiap uji dijalankan berurutan setelah skripmu. "ditolak" berarti database menolak statement itu (constraint atau trigger); uji yang ditolak tidak meninggalkan perubahan.',
};

function gradeSchema(ctx: GradeContext, grading: SchemaGrading): CheckResult {
  const { db, mission } = ctx;
  const { expected } = ctx.solution;
  const { elapsedMs } = ctx.outcome;
  const view = schemaView(grading);
  const solution = ctx.solution.schema;
  if (!solution) return { kind: 'error', rawError: 'fakta skema solusi tidak tersedia', friendlyError: SOLUTION_BUG_MESSAGE };

  if (isTransactionActive(db)) {
    rollbackQuietly(db);
    return wrong(null, expected, mismatch('open-transaction', OPEN_TRANSACTION_MESSAGE), elapsedMs, view);
  }

  for (const obj of grading.objects) {
    const want = solution.facts.get(obj.name);
    if (!want) continue;
    const got = readObjectFacts(db, obj.name);
    const problem = objectProblem(obj.name, obj.type, want, got);
    if (problem) return wrong(null, expected, mismatch('schema-object', problem), elapsedMs, view);
    if (want.type === 'table' && got?.type === 'table') {
      const diff = tableDifferences(obj.name, want, got);
      if (diff) {
        const exp = structureResult(want);
        const act = structureResult(got);
        const compare: CompareOutcome = { ...compareResults(exp, act, false), match: false, reason: 'schema-structure', message: diff };
        return wrong(act, exp, compare, elapsedMs, structureView(obj.name));
      }
    }
  }

  const outcomes = runProbes(db, grading.probes);
  const index = firstProbeMismatch(solution.probes, outcomes);
  const probe = grading.probes[index];
  const wantOutcome = solution.probes[index];
  const gotOutcome = outcomes[index];
  if (probe && wantOutcome && gotOutcome) {
    const exp = probesResult(grading.probes, solution.probes);
    const act = probesResult(grading.probes, outcomes);
    const compare: CompareOutcome = { ...compareResults(exp, act, true), match: false, reason: 'probe-mismatch', message: probeMessage(probe, index, wantOutcome, gotOutcome) };
    return wrong(act, exp, compare, elapsedMs, PROBE_VIEW);
  }

  const state = readState(db, grading.verifySql);
  if (!state.ok) {
    const message = `Hasil akhir tidak bisa dibaca setelah skripmu dan uji perilaku dijalankan (${state.rawError}).`;
    return wrong(null, expected, mismatch('no-result', message), elapsedMs, view);
  }
  const actual = state.result;
  const compare = compareResults(expected, actual, mission.orderMatters);
  const missing = findMissingPatterns(ctx.userSql, mission.requiredPatterns);
  if (!compare.match || !actual) {
    const note = missing.length > 0 ? missingConstructNote(missing) : undefined;
    return wrong(actual, expected, compare, elapsedMs, withNote(view, note));
  }
  const damage = checkCollateralDamage(ctx);
  if (damage) return damage;
  if (missing.length > 0) {
    return wrong(actual, expected, mismatch('missing-construct', missingConstructMessage(missing)), elapsedMs, view);
  }
  return correct(actual, expected, elapsedMs, view);
}

/* ------------------------------------------------------------------ */
/* API publik                                                          */
/* ------------------------------------------------------------------ */

/**
 * Urutan pemeriksaan: error SQL user → (state/index: transaksi terbuka) → pembandingan
 * sesuai grading → (state/index: kerusakan kolateral di tabel lain) → requiredPatterns
 * (hanya jika hasil sudah cocok; jika hasil masih salah, pola yang kurang ditampilkan sebagai
 * catatan) → (state+transaction: alur transaksi per statement) → (result+requireIndexOn: query plan).
 */
export function checkMission(SQL: SqlJsStatic, mission: SqlMission, userSql: string): CheckResult {
  let solution: SolutionRun;
  try {
    solution = runSolutionWithSnapshot(SQL, mission);
  } catch (err) {
    return { kind: 'error', rawError: errorText(err), friendlyError: SOLUTION_BUG_MESSAGE };
  }

  return withFreshDb(SQL, (db) => {
    const outcome = executeSql(db, userSql);
    if (!outcome.ok) return errorResult(outcome);

    const ctx: GradeContext = { SQL, db, mission, userSql, outcome, solution };
    const grading = gradingOf(mission);
    switch (grading.type) {
      case 'result':
        return gradeResult(ctx, grading);
      case 'state':
        return gradeState(ctx, grading);
      case 'index':
        return gradeIndex(ctx, grading);
      case 'schema':
        return gradeSchema(ctx, grading);
      default:
        return assertNever(grading);
    }
  });
}
