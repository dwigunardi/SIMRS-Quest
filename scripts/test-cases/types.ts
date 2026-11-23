import type { MismatchReason } from '../../src/types';

/**
 * `answer` = jawaban user yang diuji:
 * - misi kind 'sql'       → teks SQL
 * - misi kind 'injection' → payload input form (dijalankan pada mode RENTAN)
 * (misi kind 'concept' & 'predict' diuji lewat integritas data, bukan test case.)
 */
export interface WrongCase {
  label: string;
  answer: string;
  /** Opsional: kunci alasan mismatch yang diharapkan. */
  reason?: MismatchReason;
}

export interface CorrectCase {
  label: string;
  answer: string;
}

export interface MissionTestCases {
  wrong: WrongCase[];
  correct: CorrectCase[];
}
