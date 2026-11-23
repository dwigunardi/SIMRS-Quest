/**
 * Verifikasi misi kind 'sql' per jenis grading ('result' | 'state' | 'index'),
 * plus isolasi mutasi antar-penilaian.
 */
import type { SqlJsStatic } from 'sql.js';
import { MISSIONS } from '../../src/data/missions';
import { analyzeColumnSearch, analyzeQueryPlan } from '../../src/lib/queryPlan';
import { isValidPattern } from '../../src/lib/requiredPatterns';
import { createSeededDatabase, executeSql, isMutatingSql, stripCommentsAndStrings } from '../../src/lib/sqlEngine';
import { checkMission, runSolution } from '../../src/lib/validator';
import type { QueryResult, SqlGrading, SqlMission } from '../../src/types';
import { compareResults } from '../../src/lib/compare';
import { TABLE_ORDER } from '../../src/db/seed';
import { readObjectFacts, runProbes } from '../../src/lib/schemaCheck';
import { assert, describeCheck, fail, failureDetail, guard, hasDuplicateRows, printResult, warn } from './report';

type ResultGrading = Extract<SqlGrading, { type: 'result' }>;
type StateGrading = Extract<SqlGrading, { type: 'state' }>;
type IndexGrading = Extract<SqlGrading, { type: 'index' }>;
type SchemaGrading = Extract<SqlGrading, { type: 'schema' }>;

const ORDER_BY = /\bORDER\s+BY\b/i;

function withDb<T>(SQL: SqlJsStatic, fn: (db: ReturnType<typeof createSeededDatabase>) => T): T {
  const db = createSeededDatabase(SQL);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

/**
 * Menyisipkan ulang baris setiap tabel dengan urutan rowid terbalik. Untuk tabel ber-PK TEXT (pasien, kunjungan,
 * dokter, poliklinik, struktur_organisasi) urutan fisik/scan jadi terbalik, sehingga baris yang "kembar" di
 * ORDER BY masuk ke sorter dengan urutan berbeda. (PRAGMA reverse_unordered_selects tidak berpengaruh bila ada ORDER BY.)
 */
const REVERSE_PHYSICAL_ORDER_SQL = [
  'PRAGMA foreign_keys = OFF;',
  ...TABLE_ORDER.map(
    (t) => `CREATE TEMP TABLE _rev AS SELECT * FROM ${t} ORDER BY rowid DESC; DELETE FROM ${t}; INSERT INTO ${t} SELECT * FROM _rev; DROP TABLE _rev;`,
  ),
  'PRAGMA foreign_keys = ON;',
].join('\n');

/** Result set terakhir dari `sql` pada DB segar; `reversed` = urutan fisik baris dibalik. */
function lastResultOf(SQL: SqlJsStatic, sql: string, reversed: boolean, setupSql?: string): QueryResult | null {
  return withDb(SQL, (db) => {
    if (reversed) db.exec(REVERSE_PHYSICAL_ORDER_SQL);
    if (setupSql) db.exec(setupSql);
    const outcome = executeSql(db, sql);
    if (!outcome.ok) return null;
    return outcome.results[outcome.results.length - 1] ?? null;
  });
}

/**
 * ORDER BY harus deterministik: jika ada nilai kunci yang kembar (tie), urutan baris bisa bergantung pada
 * query plan (mis. index yang dipakai), sehingga jawaban user yang benar bisa dinilai 'row-order'.
 * Deteksi: jalankan ulang pada DB dengan urutan fisik baris dibalik — hasil yang urutannya berubah berarti ada tie.
 */
function verifyDeterministicOrder(SQL: SqlJsStatic, mission: SqlMission, sql: string, setupSql?: string): void {
  const normal = lastResultOf(SQL, sql, false, setupSql);
  const reversed = lastResultOf(SQL, sql, true, setupSql);
  if (!normal || !reversed) {
    fail(`${mission.id}: gagal menjalankan query untuk uji determinisme urutan`);
    return;
  }
  const outcome = compareResults(normal, reversed, true);
  assert(
    outcome.match,
    `${mission.id}: urutan baris tidak deterministik (ada tie di ORDER BY; tambahkan tie-breaker) — ${outcome.message}`,
  );
}

function tableExists(SQL: SqlJsStatic, table: string): boolean {
  return withDb(SQL, (db) => {
    const outcome = executeSql(db, `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '${table.replace(/'/g, "''")}'`);
    return outcome.ok && (outcome.results[0]?.rows.length ?? 0) > 0;
  });
}

/* ------------------------------------------------------------------ */
/* Pemeriksaan umum                                                    */
/* ------------------------------------------------------------------ */

function verifyRequiredPatterns(mission: SqlMission): void {
  const stripped = stripCommentsAndStrings(mission.solutionSql);
  for (const p of mission.requiredPatterns ?? []) {
    if (!isValidPattern(p.pattern)) {
      fail(`${mission.id}: requiredPattern /${p.pattern}/ bukan regex valid`);
      continue;
    }
    assert(p.message.trim().length > 0, `${mission.id}: requiredPattern /${p.pattern}/ tanpa pesan`);
    // Pesan juga tampil sebagai catatan saat hasil MASIH SALAH, jadi tidak boleh mengklaim hasilnya benar.
    assert(!/^\s*hasil(nya)?\s+sudah/i.test(p.message), `${mission.id}: pesan requiredPattern /${p.pattern}/ tidak boleh diawali klaim "Hasilnya sudah ..."`);
    assert(new RegExp(p.pattern, 'i').test(stripped), `${mission.id}: solutionSql tidak memenuhi requiredPattern /${p.pattern}/`);
  }
}

function verifyCommonChecks(SQL: SqlJsStatic, mission: SqlMission): void {
  assert(mission.starterSql.trim().length > 0, `${mission.id}: starterSql kosong`);
  verifyRequiredPatterns(mission);

  const own = checkMission(SQL, mission, mission.solutionSql);
  assert(own.kind === 'correct', `${mission.id}: checkMission(solutionSql) = '${describeCheck(own)}', seharusnya 'correct'${failureDetail(own)}`);

  const empty = checkMission(SQL, mission, '-- belum ada query');
  assert(empty.kind === 'error', `${mission.id}: query kosong = '${describeCheck(empty)}', seharusnya 'error'`);

  const syntax = checkMission(SQL, mission, 'SELEC * FROM pasien');
  assert(syntax.kind === 'error', `${mission.id}: syntax error = '${describeCheck(syntax)}', seharusnya 'error'`);
}

/* ------------------------------------------------------------------ */
/* Grading 'result'                                                    */
/* ------------------------------------------------------------------ */

function verifyResultShape(mission: SqlMission, result: QueryResult): void {
  assert(result.rows.length >= 1, `${mission.id}: solusi menghasilkan 0 baris`);

  const lowerColumns = result.columns.map((column) => column.toLowerCase());
  assert(new Set(lowerColumns).size === lowerColumns.length, `${mission.id}: nama kolom hasil tidak unik`);

  const taskLower = mission.task.toLowerCase();
  lowerColumns.forEach((column) => {
    assert(taskLower.includes(column), `${mission.id}: kolom "${column}" tidak disebut di teks task`);
  });

  if (!mission.orderMatters) return;
  assert(ORDER_BY.test(mission.solutionSql), `${mission.id}: orderMatters=true tetapi solusi tanpa ORDER BY`);
  assert(!hasDuplicateRows(result), `${mission.id}: ada baris duplikat penuh — urutan tidak deterministik`);
}

type IndexRequirement = NonNullable<ResultGrading['requireIndexOn']>;

function verifySolutionUsesIndex(SQL: SqlJsStatic, mission: SqlMission, req: IndexRequirement): void {
  const { table, column } = req;
  assert(tableExists(SQL, table), `${mission.id}: requireIndexOn '${table}' bukan tabel yang ada`);
  withDb(SQL, (db) => {
    const outcome = executeSql(db, mission.solutionSql);
    if (!outcome.ok || !outcome.lastResultSql) {
      fail(`${mission.id}: solusi tidak punya statement result set untuk dianalisis plan-nya`);
      return;
    }
    const plan = analyzeColumnSearch(db, outcome.lastResultSql, table, column);
    if (!plan.ok) {
      fail(`${mission.id}: EXPLAIN solusi gagal — ${plan.rawError}`);
      return;
    }
    console.log(`    plan solusi: ${plan.lines.join(' | ')}`);
    assert(
      plan.noFullScan && plan.search === 'bounded',
      `${mission.id}: plan solusi tidak mencari ${table} lewat index ${column} dengan batas dua sisi/kesamaan: ${plan.lines.join(' | ')}`,
    );
  });
}

function verifyResultMission(SQL: SqlJsStatic, mission: SqlMission, grading: ResultGrading): void {
  const result = runSolution(SQL, mission);
  printResult(result);
  verifyResultShape(mission, result);
  if (mission.orderMatters) verifyDeterministicOrder(SQL, mission, mission.solutionSql);
  if (grading.requireIndexOn) verifySolutionUsesIndex(SQL, mission, grading.requireIndexOn);

  const dummy = checkMission(SQL, mission, 'SELECT 1');
  assert(dummy.kind === 'wrong', `${mission.id}: checkMission('SELECT 1') = '${describeCheck(dummy)}', seharusnya 'wrong'`);
}

/* ------------------------------------------------------------------ */
/* Grading 'state'                                                     */
/* ------------------------------------------------------------------ */

function pristineState(SQL: SqlJsStatic, verifySql: string): QueryResult | null {
  return withDb(SQL, (db) => {
    const outcome = executeSql(db, verifySql);
    if (!outcome.ok) return null;
    return outcome.results[outcome.results.length - 1] ?? null;
  });
}

function matchesBegin(mission: SqlMission): boolean {
  return (mission.requiredPatterns ?? []).some((p) => isValidPattern(p.pattern) && new RegExp(p.pattern, 'i').test('BEGIN'));
}

/** Solusi tanpa COMMIT terakhir (untuk menguji deteksi transaksi terbuka). */
function withoutLastCommit(sql: string): string | null {
  const matches = [...sql.matchAll(/\b(?:COMMIT(?:\s+TRANSACTION)?|END\s+TRANSACTION)\s*;?/gi)];
  const last = matches[matches.length - 1];
  if (!last || last.index === undefined) return null;
  return sql.slice(0, last.index) + sql.slice(last.index + last[0].length);
}

function verifyOpenTransactionDetection(SQL: SqlJsStatic, mission: SqlMission): void {
  if (!matchesBegin(mission)) return;
  const unfinished = withoutLastCommit(mission.solutionSql);
  if (!unfinished) {
    fail(`${mission.id}: requiredPatterns memuat BEGIN tetapi solusi tidak punya COMMIT untuk diuji`);
    return;
  }
  const result = checkMission(SQL, mission, unfinished);
  const reason = result.kind === 'wrong' ? result.compare.reason : null;
  assert(reason === 'open-transaction', `${mission.id}: solusi tanpa COMMIT = '${describeCheck(result)}', seharusnya 'wrong/open-transaction'`);
}

function verifyStateMission(SQL: SqlJsStatic, mission: SqlMission, grading: StateGrading): void {
  const { verifySql } = grading;
  assert(mission.orderMatters, `${mission.id}: misi 'state' harus orderMatters=true`);
  assert(ORDER_BY.test(verifySql), `${mission.id}: verifySql wajib punya ORDER BY`);
  assert(!isMutatingSql(verifySql), `${mission.id}: verifySql tidak boleh mengubah data`);
  assert(grading.label.trim().length > 0, `${mission.id}: label grading kosong`);
  if (/\bWHERE\b/i.test(stripCommentsAndStrings(verifySql))) {
    warn(`${mission.id}: verifySql memakai WHERE — pastikan tetap membaca SELURUH tabel terdampak agar kerusakan sampingan terdeteksi`);
  }

  const before = pristineState(SQL, verifySql);
  const after = runSolution(SQL, mission);
  printResult(after);
  if (!before) {
    fail(`${mission.id}: verifySql gagal dijalankan pada DB seed murni`);
    return;
  }
  assert(!compareResults(before, after, true).match, `${mission.id}: solusi TIDAK mengubah hasil verifySql dibanding DB seed murni`);
  assert(after.rows.length >= 1, `${mission.id}: hasil verifySql setelah solusi kosong`);
  assert(!hasDuplicateRows(after), `${mission.id}: hasil verifySql punya baris duplikat — urutan tidak deterministik`);
  verifyDeterministicOrder(SQL, mission, verifySql, mission.solutionSql);

  const dummy = checkMission(SQL, mission, 'SELECT 1');
  assert(dummy.kind === 'wrong', `${mission.id}: checkMission('SELECT 1') = '${describeCheck(dummy)}', seharusnya 'wrong'`);
  verifyOpenTransactionDetection(SQL, mission);
}

/* ------------------------------------------------------------------ */
/* Grading 'index'                                                     */
/* ------------------------------------------------------------------ */

function verifyIndexMission(SQL: SqlJsStatic, mission: SqlMission, grading: IndexGrading): void {
  assert(tableExists(SQL, grading.table), `${mission.id}: tabel '${grading.table}' tidak ada`);

  withDb(SQL, (db) => {
    const before = analyzeQueryPlan(db, grading.probeSql, grading.table);
    if (!before.ok) {
      fail(`${mission.id}: EXPLAIN probeSql gagal pada DB murni — ${before.rawError}`);
      return;
    }
    console.log(`    plan sebelum: ${before.lines.join(' | ')}`);
    assert(!before.usesIndex, `${mission.id}: probeSql SUDAH memakai index pada DB murni (misi tidak bermakna)`);

    const solution = executeSql(db, mission.solutionSql);
    if (!solution.ok) {
      fail(`${mission.id}: solutionSql gagal — ${solution.rawError}`);
      return;
    }
    const after = analyzeQueryPlan(db, grading.probeSql, grading.table);
    if (!after.ok) {
      fail(`${mission.id}: EXPLAIN probeSql gagal setelah solusi — ${after.rawError}`);
      return;
    }
    console.log(`    plan sesudah: ${after.lines.join(' | ')}`);
    assert(after.usesIndex, `${mission.id}: setelah solusi, probeSql belum memakai index ${grading.table}`);
  });

  const dummy = checkMission(SQL, mission, 'SELECT 1');
  const reason = dummy.kind === 'wrong' ? dummy.compare.reason : null;
  assert(reason === 'index-missing', `${mission.id}: checkMission('SELECT 1') = '${describeCheck(dummy)}', seharusnya 'wrong/index-missing'`);
}

/* ------------------------------------------------------------------ */
/* Grading 'schema' (DDL)                                              */
/* ------------------------------------------------------------------ */

function verifySchemaMission(SQL: SqlJsStatic, mission: SqlMission, grading: SchemaGrading): void {
  assert(mission.orderMatters, `${mission.id}: misi 'schema' harus orderMatters=true`);
  assert(ORDER_BY.test(grading.verifySql), `${mission.id}: verifySql wajib punya ORDER BY`);
  assert(!isMutatingSql(grading.verifySql), `${mission.id}: verifySql tidak boleh mengubah data`);
  assert(grading.label.trim().length > 0, `${mission.id}: label grading kosong`);
  assert(grading.objects.length >= 1, `${mission.id}: objects kosong`);
  assert(grading.probes.length >= 3, `${mission.id}: minimal 3 probe`);
  for (const probe of grading.probes) {
    assert(!/;\s*\S/.test(probe.sql.trim()), `${mission.id}: probe harus satu statement — ${probe.sql}`);
    assert(probe.description.trim().length > 0, `${mission.id}: probe tanpa keterangan — ${probe.sql}`);
  }

  withDb(SQL, (db) => {
    const before = new Map(grading.objects.map((o) => [o.name, JSON.stringify(readObjectFacts(db, o.name))]));
    const solution = executeSql(db, mission.solutionSql);
    if (!solution.ok) {
      fail(`${mission.id}: solutionSql gagal — ${solution.rawError}`);
      return;
    }
    for (const obj of grading.objects) {
      const after = readObjectFacts(db, obj.name);
      assert(after?.type === obj.type, `${mission.id}: setelah solusi, ${obj.name} bukan ${obj.type}`);
      assert(JSON.stringify(after) !== before.get(obj.name), `${mission.id}: solusi tidak mengubah struktur ${obj.name} (misi tidak bermakna)`);
    }
    const outcomes = runProbes(db, grading.probes);
    outcomes.forEach((o, i) => console.log(`    uji ${i + 1}: ${o.ok ? 'diterima' : `ditolak — ${o.error}`} · ${grading.probes[i]?.description ?? ''}`));
    assert(outcomes.some((o) => o.ok), `${mission.id}: minimal satu probe harus DITERIMA solusi (uji bahwa data sah tidak ikut ditolak)`);
    assert(outcomes.some((o) => !o.ok), `${mission.id}: minimal satu probe harus DITOLAK solusi (uji aturan)`);
  });

  const after = runSolution(SQL, mission);
  printResult(after);
  assert(after.rows.length >= 1, `${mission.id}: hasil verifySql setelah solusi kosong`);
  assert(!hasDuplicateRows(after), `${mission.id}: hasil verifySql punya baris duplikat — urutan tidak deterministik`);

  const dummy = checkMission(SQL, mission, 'SELECT 1');
  const reason = dummy.kind === 'wrong' ? dummy.compare.reason : null;
  assert(reason === 'schema-object' || reason === 'schema-structure', `${mission.id}: checkMission('SELECT 1') = '${describeCheck(dummy)}', seharusnya 'wrong/schema-object' atau 'wrong/schema-structure'`);
  const self = checkMission(SQL, mission, mission.solutionSql);
  assert(self.kind === 'correct', `${mission.id}: solusi sendiri dinilai '${describeCheck(self)}'${failureDetail(self)}`);
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export function verifySqlMission(SQL: SqlJsStatic, mission: SqlMission): void {
  const grading: SqlGrading = mission.grading ?? { type: 'result' };
  console.log(`\n#${mission.order} ${mission.id} — ${mission.title} [sql/${grading.type}] (tier ${mission.tier}, ${mission.xpReward} XP, orderMatters=${String(mission.orderMatters)})`);

  guard(`${mission.id} (grading)`, () => {
    switch (grading.type) {
      case 'result':
        verifyResultMission(SQL, mission, grading);
        return;
      case 'state':
        verifyStateMission(SQL, mission, grading);
        return;
      case 'index':
        verifyIndexMission(SQL, mission, grading);
        return;
      case 'schema':
        verifySchemaMission(SQL, mission, grading);
        return;
      default: {
        const unreachable: never = grading;
        fail(`${mission.id}: grading tidak dikenal ${JSON.stringify(unreachable)}`);
      }
    }
  });
  guard(`${mission.id} (umum)`, () => verifyCommonChecks(SQL, mission));
}

/** Query destruktif user tidak boleh memengaruhi penilaian berikutnya; result set TERAKHIR yang dinilai. */
export function verifyMutationIsolation(SQL: SqlJsStatic): void {
  const sqlMissions = MISSIONS.flatMap((m) => (m.kind === 'sql' ? [m] : []));
  const first = sqlMissions[0];
  if (!first) {
    fail('tidak ada misi sql untuk uji isolasi');
    return;
  }

  const destructive = checkMission(SQL, first, 'DELETE FROM diagnosa; DROP TABLE billing;');
  assert(
    destructive.kind === 'wrong' && destructive.compare.reason === 'no-result',
    `mutasi tanpa SELECT = '${describeCheck(destructive)}', seharusnya 'wrong/no-result'`,
  );

  const mutateThenSelect = checkMission(SQL, first, "UPDATE dokter SET spesialisasi = 'X'; SELECT nama_dokter, spesialisasi FROM dokter;");
  assert(mutateThenSelect.kind === 'wrong', `UPDATE lalu SELECT = '${describeCheck(mutateThenSelect)}', seharusnya 'wrong'`);

  const after = sqlMissions.map((mission) => ({ mission, result: checkMission(SQL, mission, mission.solutionSql) }));
  after
    .filter(({ result }) => result.kind !== 'correct')
    .forEach(({ mission, result }) => fail(`${mission.id}: setelah query destruktif, solusi dinilai '${describeCheck(result)}'`));

  const lastResultSet = checkMission(SQL, first, `SELECT 1; ${first.solutionSql}`);
  assert(lastResultSet.kind === 'correct', `result set TERAKHIR yang dinilai = '${describeCheck(lastResultSet)}', seharusnya 'correct'`);
  console.log(`    query destruktif tidak memengaruhi ${sqlMissions.length} penilaian berikutnya; result set terakhir yang dinilai`);
}
