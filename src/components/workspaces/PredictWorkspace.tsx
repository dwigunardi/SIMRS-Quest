import { useMemo, type KeyboardEvent } from 'react';
import type { Database } from 'sql.js';
import { CircleCheck, CircleX, Footprints, ScanSearch, SearchCheck } from 'lucide-react';
import { buildPredictChoices, type PredictChoice } from '../../lib/predict';
import type { CompletionSummary, MissionProgress, PredictMission, QueryResult } from '../../types';
import { ExecStepsCard, useExecSteps } from '../exec/ExecStepsCard';
import { HighlightedCode } from '../HighlightedCode';
import { keyForObject } from '../MissionOutput';
import { CellContent } from '../ResultTable';
import { SuccessCelebration } from '../SuccessCelebration';
import { MistakeNudge } from '../progress/MistakeNudge';
import type { MissionAttempt } from './missionAttempt';
import { renderInline } from './RichText';
import { AssistButtons, WorkspaceHeader } from './WorkspaceChrome';

type PredictAttempt = Extract<MissionAttempt, { kind: 'predict' }>;

export interface PredictWorkspaceProps {
  mission: PredictMission;
  missionProgress: MissionProgress;
  totalCount: number;
  /** DB seed (hanya dibaca) untuk menghitung tabel setiap pilihan. */
  db: Database | null;
  choiceId: string | null;
  onChoose: (choiceId: string) => void;
  onCheck: (choice: PredictChoice) => void;
  onHint: () => void;
  onShowSolution: () => void;
  attempt: PredictAttempt | null;
  completion: CompletionSummary | null;
  runId: number;
  solutionVisible: boolean;
  hasNextMission: boolean;
  onNextMission: () => void;
}

const LETTERS = 'ABCDEFGH';

function MiniTable({ result }: { result: QueryResult }) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-left font-mono text-[12px]">
        <thead>
          <tr>
            {result.columns.map((column, c) => (
              <th key={`${c}-${column}`} scope="col" className="whitespace-nowrap border-b border-slate-700 px-2 py-1 font-semibold text-slate-400">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, r) => (
            <tr key={r} className="odd:bg-slate-900/40">
              {result.columns.map((_, c) => (
                <td key={c} className="whitespace-nowrap border-b border-slate-800/70 px-2 py-1 text-slate-200">
                  <CellContent value={row[c]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length === 0 ? <p className="px-2 py-2 text-xs italic text-slate-500">(tidak ada baris)</p> : null}
    </div>
  );
}

export interface ChoiceCardProps {
  choice: PredictChoice;
  letter: string;
  selected: boolean;
  /** Roving tabindex: hanya satu pilihan yang bisa dicapai dengan Tab. */
  focusable: boolean;
  /** Jawaban sudah dibuka (benar / solusi dilihat / misi sudah selesai). */
  revealed: boolean;
  /** Pilihan ini baru saja diperiksa dan salah. */
  wrong: boolean;
  onChoose: () => void;
}

export function ChoiceCard({ choice, letter, selected, focusable, revealed, wrong, onChoose }: ChoiceCardProps) {
  let frame = selected ? 'border-orange-400/70 bg-orange-500/[0.07] ring-1 ring-orange-400/40' : 'border-slate-800 bg-slate-900/40 hover:border-slate-600';
  if (revealed && choice.correct) frame = 'border-emerald-500/70 bg-emerald-500/[0.07] ring-1 ring-emerald-500/40';
  else if (wrong) frame = 'border-rose-500/60 bg-rose-500/[0.06]';
  const showWhy = wrong || revealed;
  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border transition ${frame}`}>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        tabIndex={focusable ? 0 : -1}
        data-choice={choice.id}
        onClick={onChoose}
        className="flex items-center gap-2 px-3 py-2 text-left"
      >
        <span
          className={`grid h-5 w-5 place-items-center rounded-full border text-[11px] font-bold ${
            selected ? 'border-orange-300 bg-orange-400 text-slate-950' : 'border-slate-600 text-slate-400'
          }`}
          aria-hidden
        >
          {letter}
        </span>
        <span className="text-sm font-semibold text-slate-200">Pilihan {letter}</span>
        <span className="text-[11px] text-slate-500">{choice.result.rows.length} baris</span>
        {revealed && choice.correct ? (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
            <CircleCheck className="h-4 w-4" aria-hidden /> Benar
          </span>
        ) : null}
        {wrong ? (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-rose-300">
            <CircleX className="h-4 w-4" aria-hidden /> Belum tepat
          </span>
        ) : null}
      </button>
      <div className="border-t border-slate-800/80 bg-slate-950/40 px-1 py-1">
        <MiniTable result={choice.result} />
      </div>
      {showWhy ? (
        <div className="space-y-2 border-t border-slate-800/80 px-3 py-2 text-xs leading-relaxed">
          <p className={choice.correct ? 'text-emerald-100' : 'text-rose-100'}>
            <span className="font-semibold">{choice.correct ? 'Kenapa benar: ' : 'Salah paham di balik pilihan ini: '}</span>
            {renderInline(choice.explanation)}
          </p>
          {revealed ? (
            <details className="group">
              <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-200">
                {choice.correct ? 'Query misi (menghasilkan tabel ini)' : 'Query yang sebenarnya menghasilkan tabel ini'}
              </summary>
              <div className="mt-1 overflow-hidden rounded-md border border-slate-800 bg-slate-950">
                <HighlightedCode code={choice.sql} className="px-3 py-2 text-[12px]" />
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PredictWorkspace({
  mission,
  missionProgress,
  totalCount,
  db,
  choiceId,
  onChoose,
  onCheck,
  onHint,
  onShowSolution,
  attempt,
  completion,
  runId,
  solutionVisible,
  hasNextMission,
  onNextMission,
}: PredictWorkspaceProps) {
  const built = useMemo(() => (db ? buildPredictChoices(db, mission) : null), [db, mission]);
  const steps = useExecSteps(db);
  const choices = built?.ok ? built.choices : [];
  const selected = choices.find((c) => c.id === choiceId) ?? null;
  // Hasil pemeriksaan hanya berlaku selama pilihan belum diganti.
  const current = attempt && attempt.choiceId === choiceId ? attempt : null;
  const revealed = solutionVisible || missionProgress.completed || current?.correct === true;

  // Pola radiogroup: panah memindah pilihan (dan fokus), Tab masuk/keluar grup sebagai satu kesatuan.
  const onRadioKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (delta === undefined || choices.length === 0) return;
    event.preventDefault();
    const index = Math.max(0, choices.findIndex((c) => c.id === choiceId));
    const next = choices[(index + delta + choices.length) % choices.length];
    if (!next) return;
    onChoose(next.id);
    event.currentTarget.querySelector<HTMLElement>(`[data-choice="${next.id}"]`)?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <WorkspaceHeader mission={mission} totalCount={totalCount} />

      <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-950/20 px-3 py-2 text-xs leading-relaxed text-slate-300">
        <ScanSearch className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" aria-hidden />
        <span>
          <span className="font-semibold text-orange-200">Tebak Hasil.</span> Jangan jalankan query-nya: baca, bayangkan prosesnya, lalu
          pilih tabel hasil yang benar. Ikuti urutan eksekusinya —{' '}
          <span className="font-mono text-slate-200">FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT</span>.
        </span>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80">
        <p className="border-b border-slate-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Query</p>
        <HighlightedCode code={mission.query} className="px-4 py-3" />
      </section>

      {built && !built.ok ? (
        <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/25 px-4 py-3 text-sm text-rose-200">
          {built.message}
        </p>
      ) : null}

      <div role="radiogroup" aria-label="Pilihan tabel hasil" onKeyDown={onRadioKey} className="grid gap-3 md:grid-cols-2">
        {choices.map((choice, index) => (
          <ChoiceCard
            key={choice.id}
            choice={choice}
            letter={LETTERS[index] ?? String(index + 1)}
            selected={choice.id === choiceId}
            focusable={selected ? choice.id === choiceId : index === 0}
            revealed={revealed}
            wrong={current !== null && !current.correct && current.choiceId === choice.id}
            onChoose={() => onChoose(choice.id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => selected && onCheck(selected)}
          disabled={!selected}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-orange-500/20 transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SearchCheck className="h-4 w-4" aria-hidden />
          Periksa Jawaban
        </button>
        <AssistButtons mission={mission} missionProgress={missionProgress} onHint={onHint} onShowSolution={onShowSolution} />
        {revealed ? (
          <button
            type="button"
            onClick={() => steps.show(mission.query)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            <Footprints className="h-4 w-4" aria-hidden />
            Urutan Eksekusi Query
          </button>
        ) : (
          <span className="text-[11px] text-slate-500">Urutan eksekusi query terbuka setelah jawaban benar.</span>
        )}
      </div>

      {current ? (
        current.correct ? (
          <SuccessCelebration
            key={runId}
            title="Tebakanmu tepat!"
            subtitle="Kamu membaca query seperti database menjalankannya"
            completion={completion}
            hasNextMission={hasNextMission}
            onNextMission={onNextMission}
          />
        ) : (
          <div key={keyForObject(current)} role="status" className="animate-shake flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-950/25 px-4 py-3">
            <CircleX className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-rose-300">Belum tepat</p>
              <p className="text-sm leading-relaxed text-slate-200">
                Baca penjelasan salah paham di kartu pilihanmu, telusuri lagi query-nya langkah demi langkah, lalu pilih tabel lain.
              </p>
            </div>
          </div>
        )
      ) : null}

      {current && !current.correct ? <MistakeNudge missionId={mission.id} kind="reading" /> : null}

      {revealed ? <ExecStepsCard steps={steps} currentSql={mission.query} /> : null}
    </div>
  );
}
