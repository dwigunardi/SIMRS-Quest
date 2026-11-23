import { BookOpen, ListX } from 'lucide-react';
import { SuccessCelebration } from '../SuccessCelebration';
import { keyForObject } from '../MissionOutput';
import { ConceptQuiz } from './ConceptQuiz';
import { MistakeNudge } from '../progress/MistakeNudge';
import { ConceptSectionCard } from './ConceptSectionCard';
import { AssistButtons, WorkspaceHeader } from './WorkspaceChrome';
import type { CompletionSummary, ConceptMission, MissionProgress } from '../../types';
import type { MissionAttempt, QuizAnswers } from './missionAttempt';

type ConceptAttempt = Extract<MissionAttempt, { kind: 'concept' }>;

export interface ConceptWorkspaceProps {
  mission: ConceptMission;
  missionProgress: MissionProgress;
  totalCount: number;
  answers: QuizAnswers;
  onAnswer: (questionId: string, optionIndex: number) => void;
  onCheck: () => void;
  onHint: () => void;
  onShowSolution: () => void;
  attempt: ConceptAttempt | null;
  completion: CompletionSummary | null;
  runId: number;
  solutionVisible: boolean;
  hasNextMission: boolean;
  onNextMission: () => void;
}

export function ConceptWorkspace({
  mission,
  missionProgress,
  totalCount,
  answers,
  onAnswer,
  onCheck,
  onHint,
  onShowSolution,
  attempt,
  completion,
  runId,
  solutionVisible,
  hasNextMission,
  onNextMission,
}: ConceptWorkspaceProps) {
  return (
    <div className="flex flex-col gap-4">
      <WorkspaceHeader mission={mission} totalCount={totalCount} />

      <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-950/20 px-3 py-2 text-xs leading-relaxed text-slate-300">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden />
        <span>
          <span className="font-semibold text-sky-200">Kartu Konsep.</span> Materi ini dipelajari lewat bacaan dan contoh kode, bukan
          dengan menjalankan query di editor. Contohnya ditulis untuk bahasa pemrograman atau DBMS lain (SQL Server, PostgreSQL,
          MySQL) dan tidak dijalankan di sini — fitur seperti stored procedure, SQL dinamis, cursor, dan partisi tabel memang tidak
          ada di SQLite. Pelajari materinya, lalu jawab kuis di bawah untuk menyelesaikan misi. Kartu konsep selalu terbuka, jadi
          boleh dibaca kapan saja.
        </span>
      </div>

      {mission.sections.map((section, index) => (
        <ConceptSectionCard key={`${mission.id}-${index}`} section={section} index={index} />
      ))}

      <ConceptQuiz
        missionId={mission.id}
        quiz={mission.quiz}
        answers={answers}
        onAnswer={onAnswer}
        onCheck={onCheck}
        attempt={attempt}
        solutionVisible={solutionVisible}
      />

      <div className="flex flex-wrap items-center gap-2">
        <AssistButtons mission={mission} missionProgress={missionProgress} onHint={onHint} onShowSolution={onShowSolution} />
      </div>

      <QuizOutcome
        key={runId}
        missionId={mission.id}
        attempt={attempt}
        stale={isStaleAttempt(mission, answers, attempt)}
        total={mission.quiz.length}
        completion={completion}
        hasNextMission={hasNextMission}
        onNextMission={onNextMission}
      />
    </div>
  );
}

/** Jawaban sudah diubah sejak pemeriksaan terakhir? Ringkasan hasil lama tidak lagi berlaku. */
function isStaleAttempt(mission: ConceptMission, answers: QuizAnswers, attempt: ConceptAttempt | null): boolean {
  if (!attempt) return false;
  return mission.quiz.some((question) => answers[question.id] !== attempt.answers[question.id]);
}

interface QuizOutcomeProps {
  missionId: string;
  attempt: ConceptAttempt | null;
  /** true jika jawaban sudah berubah sejak attempt ini diperiksa. */
  stale: boolean;
  total: number;
  completion: CompletionSummary | null;
  hasNextMission: boolean;
  onNextMission: () => void;
}

function QuizOutcome({ missionId, attempt, stale, total, completion, hasNextMission, onNextMission }: QuizOutcomeProps) {
  if (!attempt) return null;
  if (stale) {
    return (
      <p role="status" className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
        Jawaban berubah sejak pemeriksaan terakhir. Tekan <span className="font-semibold text-sky-300">Periksa Jawaban</span> lagi
        untuk melihat hasil terbaru.
      </p>
    );
  }
  const { result } = attempt;

  if (result.correct) {
    return (
      <SuccessCelebration
        key={keyForObject(attempt)}
        title="Semua jawaban benar!"
        subtitle={`${total}/${total} soal tepat · konsep dikuasai`}
        completion={completion}
        hasNextMission={hasNextMission}
        onNextMission={onNextMission}
      />
    );
  }

  const unanswered = result.wrongIds.filter((id) => attempt.answers[id] === undefined).length;
  const correctCount = total - result.wrongIds.length;
  return (
    <div className="space-y-3">
      <div
        key={keyForObject(attempt)}
        role="status"
        className="animate-shake flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-950/25 px-4 py-3"
      >
        <ListX className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-rose-300">Masih ada jawaban yang belum tepat</p>
          <p className="text-sm leading-relaxed text-slate-200">
            {correctCount} dari {total} soal benar.
            {unanswered > 0 ? ` ${unanswered} soal belum dijawab.` : ''} Baca lagi bagian materi yang relevan, perbaiki soal yang
            ditandai, lalu periksa ulang.
          </p>
        </div>
      </div>
      <MistakeNudge missionId={missionId} kind="concept" />
    </div>
  );
}
