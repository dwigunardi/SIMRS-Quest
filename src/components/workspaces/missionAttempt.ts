import type { CheckResult, InjectionRun, QuizResult } from '../../types';

/** Jawaban kuis satu misi konsep: questionId → indeks opsi yang dipilih. */
export type QuizAnswers = Readonly<Record<string, number>>;

/** Hasil percobaan terakhir di panel kanan, sesuai jenis misi. */
export type MissionAttempt =
  | { kind: 'sql'; missionId: string; check: CheckResult }
  | { kind: 'injection'; missionId: string; run: InjectionRun }
  /** `answers` = salinan jawaban saat diperiksa, agar umpan balik basi tidak ditampilkan setelah jawaban diubah. */
  | { kind: 'concept'; missionId: string; result: QuizResult; answers: QuizAnswers }
  /** Misi tebak hasil: pilihan tabel yang diperiksa. */
  | { kind: 'predict'; missionId: string; choiceId: string; correct: boolean };
