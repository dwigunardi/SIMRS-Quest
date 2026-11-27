import { CircleCheck, CircleHelp, CircleX, ClipboardCheck, KeyRound } from 'lucide-react';
import { renderInline } from './RichText';
import type { QuizQuestion } from '../../types';
import type { MissionAttempt, QuizAnswers } from './missionAttempt';

type ConceptAttempt = Extract<MissionAttempt, { kind: 'concept' }>;

type QuestionStatus = 'pending' | 'unanswered' | 'correct' | 'wrong';

export interface ConceptQuizProps {
  missionId: string;
  quiz: QuizQuestion[];
  answers: QuizAnswers;
  onAnswer: (questionId: string, optionIndex: number) => void;
  onCheck: () => void;
  attempt: ConceptAttempt | null;
  /** Kunci jawaban ditampilkan (Show Solution). */
  solutionVisible: boolean;
}

/** Status umpan balik satu soal; 'pending' bila belum diperiksa atau jawabannya diubah setelah diperiksa. */
function statusOf(question: QuizQuestion, answers: QuizAnswers, attempt: ConceptAttempt | null): QuestionStatus {
  if (!attempt) return 'pending';
  const current = answers[question.id];
  if (attempt.answers[question.id] !== current) return 'pending';
  if (current === undefined) return 'unanswered';
  return attempt.result.wrongIds.includes(question.id) ? 'wrong' : 'correct';
}

const STATUS_CARD: Record<QuestionStatus, string> = {
  pending: 'border-slate-800 bg-slate-900/50',
  unanswered: 'border-amber-500/40 bg-amber-950/15',
  correct: 'border-emerald-500/40 bg-emerald-950/15',
  wrong: 'border-rose-500/40 bg-rose-950/15',
};

export function ConceptQuiz({ missionId, quiz, answers, onAnswer, onCheck, attempt, solutionVisible }: ConceptQuizProps) {
  const answeredCount = quiz.filter((question) => answers[question.id] !== undefined).length;

  return (
    <section className="space-y-3 rounded-xl border border-sky-500/30 bg-sky-950/10 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <CircleHelp className="h-4 w-4 text-sky-300" aria-hidden />
        <h3 className="text-sm font-semibold text-sky-200">Kuis pemahaman</h3>
        <span className="text-xs tabular-nums text-slate-500">
          {answeredCount}/{quiz.length} dijawab
        </span>
      </header>

      <ol className="space-y-3">
        {quiz.map((question, index) => (
          <li key={question.id}>
            <QuestionCard
              groupName={`${missionId}-${question.id}`}
              number={index + 1}
              question={question}
              selected={answers[question.id]}
              status={statusOf(question, answers, attempt)}
              solutionVisible={solutionVisible}
              onAnswer={(optionIndex) => onAnswer(question.id, optionIndex)}
            />
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={onCheck}
        className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
      >
        <ClipboardCheck className="h-4 w-4" aria-hidden />
        Periksa Jawaban
      </button>
    </section>
  );
}

interface QuestionCardProps {
  groupName: string;
  number: number;
  question: QuizQuestion;
  selected: number | undefined;
  status: QuestionStatus;
  solutionVisible: boolean;
  onAnswer: (optionIndex: number) => void;
}

function QuestionCard({ groupName, number, question, selected, status, solutionVisible, onAnswer }: QuestionCardProps) {
  // Penjelasan sering menyebut jawaban yang benar, jadi untuk jawaban salah cukup ditandai "Belum tepat";
  // jika tidak, kuis bisa ditebak ulang tanpa penalti hint/solusi.
  const showExplanation = solutionVisible || status === 'correct';
  return (
    <fieldset className={`rounded-lg border p-3 transition ${STATUS_CARD[status]}`}>
      {/* float-left + w-full: legend berperilaku seperti blok biasa (tidak menempel di garis border). */}
      <legend className="float-left mb-2 w-full text-sm font-medium leading-relaxed text-slate-100">
        <span className="mr-1.5 text-sky-300">{number}.</span>
        {renderInline(question.question)}
      </legend>
      <div className="clear-left space-y-1.5">
        {question.options.map((option, optionIndex) => {
          const checked = selected === optionIndex;
          const isKey = solutionVisible && optionIndex === question.correctIndex;
          return (
            <label
              key={optionIndex}
              className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm transition focus-within:ring-1 focus-within:ring-sky-400/60 light:focus-within:ring-sky-400 ${
                isKey
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-100'
                  : checked
                    ? 'border-sky-500/50 bg-sky-500/10 text-slate-100'
                    : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name={groupName}
                checked={checked}
                onChange={() => onAnswer(optionIndex)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-sky-500"
              />
              <span className="min-w-0 flex-1">{renderInline(option)}</span>
              {isKey ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-px text-[10px] font-semibold uppercase text-emerald-300">
                  <KeyRound className="h-3 w-3" aria-hidden />
                  Kunci
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      <QuestionFeedback status={status} />
      {showExplanation ? (
        <p className="mt-2 rounded-md bg-slate-950/50 px-3 py-2 text-xs leading-relaxed text-slate-300">
          <span className="font-semibold text-sky-300">Penjelasan: </span>
          {renderInline(question.explanation)}
        </p>
      ) : null}
    </fieldset>
  );
}

function QuestionFeedback({ status }: { status: QuestionStatus }) {
  switch (status) {
    case 'pending':
      return null;
    case 'unanswered':
      return <p className="mt-2 text-xs font-medium text-amber-300">Belum dijawab.</p>;
    case 'correct':
      return (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-300">
          <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Benar
        </p>
      );
    case 'wrong':
      return (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-rose-300">
          <CircleX className="h-3.5 w-3.5" aria-hidden /> Belum tepat — baca lagi bagian materi yang relevan, lalu coba pilih lagi.
          Penjelasan soal muncul setelah jawabanmu benar.
        </p>
      );
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}
