/**
 * Verifikasi misi kind 'injection' (lab SQL injection) dan kind 'concept' (kartu materi + kuis).
 */
import type { SqlJsStatic } from 'sql.js';
import { runInjection } from '../../src/lib/injection';
import { checkQuiz } from '../../src/lib/quiz';
import { stripCommentsAndStrings } from '../../src/lib/sqlEngine';
import type { ConceptMission, InjectionMission, InjectionRun } from '../../src/types';
import { assert, describeCheck, fail, failureDetail, guard } from './report';

const STACKED_PAYLOAD = "x'; DROP TABLE pasien; --";

function rowCount(run: InjectionRun): number | null {
  if (!run.outcome.ok) return null;
  return run.outcome.results[run.outcome.results.length - 1]?.rows.length ?? 0;
}

function countPlaceholders(template: string): number {
  return (stripCommentsAndStrings(template).match(/\?/g) ?? []).length;
}

function verifyTemplates(mission: InjectionMission): void {
  const { lab } = mission;
  assert(lab.vulnerableTemplate.includes('{input}'), `${mission.id}: vulnerableTemplate tidak memuat {input}`);
  const placeholders = countPlaceholders(lab.safeTemplate);
  assert(placeholders === 1, `${mission.id}: safeTemplate harus punya tepat satu '?', ditemukan ${placeholders}`);
  assert(!lab.safeTemplate.includes('{input}'), `${mission.id}: safeTemplate tidak boleh memuat {input}`);
  const texts = [lab.formTitle, lab.inputLabel, lab.placeholder, lab.sampleInput, lab.goal.description, mission.solutionPayload];
  assert(texts.every((t) => t.trim().length > 0), `${mission.id}: ada field lab yang kosong`);
}

function verifySampleInput(SQL: SqlJsStatic, mission: InjectionMission): void {
  const { sampleInput } = mission.lab;
  const vulnerable = runInjection(SQL, mission, sampleInput, false);
  const safe = runInjection(SQL, mission, sampleInput, true);
  const vulnerableRows = rowCount(vulnerable);
  const safeRows = rowCount(safe);
  console.log(`    sampleInput '${sampleInput}': rentan ${vulnerableRows ?? 'ERROR'} baris, aman ${safeRows ?? 'ERROR'} baris`);

  assert(vulnerable.outcome.ok, `${mission.id}: sampleInput (mode rentan) error${failureDetail(vulnerable.check)}`);
  assert((vulnerableRows ?? 0) >= 1, `${mission.id}: sampleInput (mode rentan) harus menampilkan ≥1 baris`);
  assert(!vulnerable.goalMet, `${mission.id}: sampleInput sudah memenuhi target serangan (target terlalu mudah)`);
  assert(safe.outcome.ok, `${mission.id}: sampleInput (mode aman) error${failureDetail(safe.check)}`);
  assert(safeRows === vulnerableRows, `${mission.id}: untuk input normal, mode aman (${safeRows ?? 'ERROR'} baris) harus sama dengan mode rentan (${vulnerableRows ?? 'ERROR'} baris)`);
}

function verifySolutionPayload(SQL: SqlJsStatic, mission: InjectionMission): void {
  const vulnerable = runInjection(SQL, mission, mission.solutionPayload, false);
  console.log(`    payload: ${mission.solutionPayload}`);
  console.log(`    SQL rentan: ${vulnerable.executedSql}`);
  console.log(`    hasil rentan: ${rowCount(vulnerable) ?? 'ERROR'} baris, goalMet=${String(vulnerable.goalMet)}`);
  assert(vulnerable.goalMet, `${mission.id}: solutionPayload (mode rentan) tidak memenuhi target${failureDetail(vulnerable.check)}`);
  assert(vulnerable.check.kind === 'correct', `${mission.id}: solutionPayload (mode rentan) = '${describeCheck(vulnerable.check)}', seharusnya 'correct'`);

  const safe = runInjection(SQL, mission, mission.solutionPayload, true);
  assert(!safe.goalMet, `${mission.id}: solutionPayload (mode AMAN) masih memenuhi target`);
  assert(safe.check.kind !== 'correct', `${mission.id}: solutionPayload (mode AMAN) dinilai 'correct'`);
}

function verifyStackedPayload(SQL: SqlJsStatic, mission: InjectionMission): void {
  try {
    const stacked = runInjection(SQL, mission, STACKED_PAYLOAD, false);
    console.log(`    payload bertumpuk: ${describeCheck(stacked.check)}`);
  } catch (error) {
    fail(`${mission.id}: payload bertumpuk melempar exception — ${error instanceof Error ? error.message : String(error)}`);
  }
  const next = runInjection(SQL, mission, mission.solutionPayload, false);
  assert(next.goalMet, `${mission.id}: setelah payload bertumpuk, percobaan berikutnya tidak lagi berhasil (DB tidak segar?)`);
}

export function verifyInjectionMission(SQL: SqlJsStatic, mission: InjectionMission): void {
  console.log(`\n#${mission.order} ${mission.id} — ${mission.title} [injection/${mission.lab.goal.type}] (tier ${mission.tier}, ${mission.xpReward} XP)`);
  guard(`${mission.id} (template)`, () => verifyTemplates(mission));
  guard(`${mission.id} (sampleInput)`, () => verifySampleInput(SQL, mission));
  guard(`${mission.id} (solutionPayload)`, () => verifySolutionPayload(SQL, mission));
  guard(`${mission.id} (payload bertumpuk)`, () => verifyStackedPayload(SQL, mission));
}

/* ------------------------------------------------------------------ */
/* Concept                                                             */
/* ------------------------------------------------------------------ */

function verifySections(mission: ConceptMission): void {
  assert(mission.sections.length >= 2, `${mission.id}: minimal 2 section, ditemukan ${mission.sections.length}`);
  mission.sections.forEach((s, idx) => {
    assert(s.heading.trim().length > 0 && s.body.trim().length > 0, `${mission.id}: section #${idx + 1} heading/body kosong`);
    (s.examples ?? []).forEach((ex, exIdx) => {
      assert(ex.dialect.trim().length > 0 && ex.code.trim().length > 0, `${mission.id}: section #${idx + 1} contoh #${exIdx + 1} dialect/code kosong`);
    });
  });
  const examples = mission.sections.reduce((sum, s) => sum + (s.examples?.length ?? 0), 0);
  assert(examples >= 1, `${mission.id}: minimal 1 contoh kode di seluruh section`);
}

function verifyQuiz(mission: ConceptMission): void {
  const { quiz } = mission;
  assert(quiz.length >= 3 && quiz.length <= 5, `${mission.id}: jumlah soal kuis ${quiz.length}, harus 3–5`);
  const ids = quiz.map((q) => q.id);
  assert(new Set(ids).size === ids.length, `${mission.id}: id soal kuis tidak unik`);
  quiz.forEach((q) => {
    assert(q.question.trim().length > 0 && q.explanation.trim().length > 0, `${mission.id}/${q.id}: pertanyaan/penjelasan kosong`);
    assert(q.options.length >= 3, `${mission.id}/${q.id}: minimal 3 opsi`);
    assert(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length, `${mission.id}/${q.id}: correctIndex di luar rentang`);
    assert(new Set(q.options).size === q.options.length, `${mission.id}/${q.id}: ada opsi ganda`);
  });

  const correctAnswers = Object.fromEntries(quiz.map((q) => [q.id, q.correctIndex]));
  const right = checkQuiz(mission, correctAnswers);
  assert(right.correct && right.wrongIds.length === 0, `${mission.id}: checkQuiz(jawaban benar) tidak dinilai benar`);

  const wrongAnswers = Object.fromEntries(quiz.map((q) => [q.id, (q.correctIndex + 1) % Math.max(q.options.length, 1)]));
  const wrong = checkQuiz(mission, wrongAnswers);
  assert(!wrong.correct && wrong.wrongIds.length === quiz.length, `${mission.id}: checkQuiz(semua salah) harus salah dengan ${quiz.length} wrongIds`);

  const unanswered = checkQuiz(mission, {});
  assert(!unanswered.correct, `${mission.id}: checkQuiz(tanpa jawaban) dinilai benar`);
}

export function verifyConceptMission(mission: ConceptMission): void {
  console.log(`\n#${mission.order} ${mission.id} — ${mission.title} [concept] (tier ${mission.tier}, ${mission.xpReward} XP, ${mission.sections.length} section, ${mission.quiz.length} soal)`);
  guard(`${mission.id} (section)`, () => verifySections(mission));
  guard(`${mission.id} (kuis)`, () => verifyQuiz(mission));
}
