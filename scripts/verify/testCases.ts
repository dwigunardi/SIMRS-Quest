/**
 * Uji negatif & formulasi setara dari scripts/test-cases/*.ts.
 * - sql       → checkMission(answer)
 * - injection → runInjection(answer, mode RENTAN)
 * - concept / predict → tidak didukung (kuis & tebak hasil diuji lewat integritas data)
 * Cakupan: tier 1–3 ≥1 kasus salah; tier 4–7 ≥2 salah & ≥1 setara (gagal jika kurang);
 * misi 'state' wajib menguji UPDATE/DELETE tanpa WHERE, misi transaksi wajib menguji transaksi terbuka.
 * Misi "Perbaiki Query": starterSql (query bermasalah) otomatis diuji harus dinilai salah.
 * Boss Challenge (tanpa hint): ≥3 jebakan ditolak & ≥2 formulasi setara diterima, dan starterSql tidak boleh lolos.
 */
import type { SqlJsStatic } from 'sql.js';
import { MISSIONS } from '../../src/data/missions';
import { runInjection } from '../../src/lib/injection';
import { stripCommentsAndStrings } from '../../src/lib/sqlEngine';
import { checkMission } from '../../src/lib/validator';
import type { CheckResult, Mission, SqlMission } from '../../src/types';
import { MISSION_TEST_CASES, type CorrectCase, type MissionTestCases, type WrongCase } from '../test-cases';
import { assert, describeCheck, fail, failureDetail, guard } from './report';

/** Tier inti: kasus uji wajib ada (≥1 salah). */
const CORE_TIERS: ReadonlySet<number> = new Set([1, 2, 3]);
/** Tier lanjutan (sql & injection): minimal kasus uji WAJIB terpenuhi. */
const MIN_WRONG_ADVANCED = 2;
const MIN_CORRECT_ADVANCED = 1;
const MIN_CORE_MISSIONS_WITH_CORRECT = 5;
const MIN_WRONG_BOSS = 3;
const MIN_CORRECT_BOSS = 2;

type GradableMission = Exclude<Mission, { kind: 'concept' } | { kind: 'predict' }>;

function isGradable(mission: Mission): mission is GradableMission {
  return mission.kind === 'sql' || mission.kind === 'injection';
}

function grade(SQL: SqlJsStatic, mission: GradableMission, answer: string): CheckResult {
  switch (mission.kind) {
    case 'sql':
      return checkMission(SQL, mission, answer);
    case 'injection':
      return runInjection(SQL, mission, answer, false).check;
    default: {
      const unreachable: never = mission;
      throw new Error(`kind tidak dikenal: ${JSON.stringify(unreachable)}`);
    }
  }
}

function verifyWrongCase(SQL: SqlJsStatic, mission: GradableMission, wrongCase: WrongCase): void {
  const result = grade(SQL, mission, wrongCase.answer);
  const label = `${mission.id} [salah: ${wrongCase.label}]`;
  if (result.kind === 'correct') {
    fail(`${label}: dinilai 'correct', seharusnya 'wrong'/'error'`);
    return;
  }
  if (!wrongCase.reason) return;
  const reason = result.kind === 'wrong' ? result.compare.reason : null;
  assert(reason === wrongCase.reason, `${label}: hasil '${describeCheck(result)}', seharusnya 'wrong/${wrongCase.reason}'${failureDetail(result)}`);
}

function verifyCorrectCase(SQL: SqlJsStatic, mission: GradableMission, correctCase: CorrectCase): void {
  const result = grade(SQL, mission, correctCase.answer);
  assert(
    result.kind === 'correct',
    `${mission.id} [setara: ${correctCase.label}]: dinilai '${describeCheck(result)}', seharusnya 'correct'${failureDetail(result)}`,
  );
}

/** Misi Perbaiki Query: query bermasalah di editor tidak boleh langsung lolos penilaian. */
function verifyFixStarter(SQL: SqlJsStatic, mission: SqlMission): void {
  const result = checkMission(SQL, mission, mission.starterSql);
  assert(result.kind !== 'correct', `${mission.id}: starterSql (query bermasalah) dinilai 'correct' — bug-nya tidak terdeteksi penilaian`);
}

function checkCoverage(mission: GradableMission, cases: MissionTestCases | undefined): void {
  if (mission.kind === 'sql' && mission.boss) {
    const wrong = cases?.wrong.length ?? 0;
    const correct = cases?.correct.length ?? 0;
    assert(
      wrong >= MIN_WRONG_BOSS && correct >= MIN_CORRECT_BOSS,
      `${mission.id}: boss wajib punya ≥${MIN_WRONG_BOSS} jebakan & ≥${MIN_CORRECT_BOSS} formulasi setara (ada ${wrong} & ${correct})`,
    );
    if (cases) checkStateCoverage(mission, cases);
    return;
  }
  if (CORE_TIERS.has(mission.tier)) {
    if (!cases) {
      fail(`${mission.id}: belum punya kasus uji di scripts/test-cases`);
      return;
    }
    assert(cases.wrong.length >= 1, `${mission.id}: minimal 1 jawaban salah harus diuji`);
    return;
  }
  const wrongCount = cases?.wrong.length ?? 0;
  const correctCount = cases?.correct.length ?? 0;
  assert(
    wrongCount >= MIN_WRONG_ADVANCED && correctCount >= MIN_CORRECT_ADVANCED,
    `${mission.id}: cakupan kasus uji kurang (${wrongCount} salah, ${correctCount} setara; minimal ${MIN_WRONG_ADVANCED} salah & ${MIN_CORRECT_ADVANCED} setara)`,
  );
  if (mission.kind === 'sql' && cases) checkStateCoverage(mission, cases);
}

/** Ada statement UPDATE/DELETE tanpa WHERE (perubahan massal)? */
function hasUnfilteredMutation(sql: string): boolean {
  return stripCommentsAndStrings(sql)
    .split(';')
    .some((statement) => /^\s*(UPDATE|DELETE)\b/i.test(statement) && !/\bWHERE\b/i.test(statement));
}

function requiresTransaction(mission: SqlMission): boolean {
  return (mission.requiredPatterns ?? []).some((p) => new RegExp(p.pattern, 'i').test('BEGIN'));
}

/**
 * Misi 'state' wajib menguji kerusakan kolateral (UPDATE/DELETE tanpa WHERE), dan misi transaksi
 * wajib menguji transaksi yang dibiarkan terbuka.
 */
function checkStateCoverage(mission: SqlMission, cases: MissionTestCases): void {
  if (mission.grading?.type !== 'state') return;
  assert(
    cases.wrong.some((c) => hasUnfilteredMutation(c.answer)),
    `${mission.id}: misi 'state' wajib punya kasus salah berupa UPDATE/DELETE tanpa WHERE (perubahan massal)`,
  );
  if (!requiresTransaction(mission)) return;
  assert(
    cases.wrong.some((c) => c.reason === 'open-transaction'),
    `${mission.id}: misi transaksi wajib punya kasus salah dengan reason 'open-transaction'`,
  );
}

export function verifyTestCases(SQL: SqlJsStatic): void {
  const byId = new Map(MISSIONS.map((mission) => [mission.id, mission]));
  Object.keys(MISSION_TEST_CASES).forEach((id) => {
    const mission = byId.get(id);
    if (!mission) {
      fail(`MISSION_TEST_CASES memuat id tak dikenal: ${id}`);
      return;
    }
    assert(isGradable(mission), `MISSION_TEST_CASES memuat misi ${mission.kind} ${id} (kuis/tebak hasil tidak diuji lewat test case)`);
  });

  let wrongCount = 0;
  let correctCount = 0;
  let coreWithCorrect = 0;

  let fixStarters = 0;
  for (const mission of MISSIONS) {
    if (!isGradable(mission)) continue;
    if (mission.kind === 'sql' && (mission.fix || mission.boss)) {
      fixStarters += 1;
      guard(`${mission.id} [query bermasalah awal]`, () => verifyFixStarter(SQL, mission));
    }
    const cases = MISSION_TEST_CASES[mission.id];
    checkCoverage(mission, cases);
    if (!cases) continue;

    if (CORE_TIERS.has(mission.tier) && cases.correct.length > 0) coreWithCorrect += 1;
    cases.wrong.forEach((c) => guard(`${mission.id} [salah: ${c.label}]`, () => verifyWrongCase(SQL, mission, c)));
    cases.correct.forEach((c) => guard(`${mission.id} [setara: ${c.label}]`, () => verifyCorrectCase(SQL, mission, c)));
    wrongCount += cases.wrong.length;
    correctCount += cases.correct.length;
  }

  assert(
    coreWithCorrect >= MIN_CORE_MISSIONS_WITH_CORRECT,
    `hanya ${coreWithCorrect} misi tier 1–3 punya uji formulasi setara (minimal ${MIN_CORE_MISSIONS_WITH_CORRECT})`,
  );
  console.log(
    `    ${wrongCount} jawaban salah ditolak, ${correctCount} formulasi setara diterima, ${fixStarters} query awal (Perbaiki Query & boss) ditolak`,
  );
}
