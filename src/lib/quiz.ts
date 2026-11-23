/**
 * Penilaian kuis pilihan ganda pada misi konsep.
 */
import type { ConceptMission, QuizResult } from '../types';

/** `answers`: id pertanyaan → indeks opsi yang dipilih. Pertanyaan yang belum dijawab dihitung salah. */
export function checkQuiz(mission: ConceptMission, answers: Readonly<Record<string, number>>): QuizResult {
  const wrongIds = mission.quiz.filter((q) => answers[q.id] !== q.correctIndex).map((q) => q.id);
  return { correct: wrongIds.length === 0, wrongIds };
}
