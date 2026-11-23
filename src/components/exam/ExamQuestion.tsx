import { useMemo, useState } from 'react';
import type { Database, SqlJsStatic } from 'sql.js';
import { ChevronLeft, ChevronRight, Loader2, Play, RotateCcw, Stethoscope, Target } from 'lucide-react';
import { SqlEditor } from '../SqlEditor';
import { ResultTable } from '../ResultTable';
import { SqlErrorCard } from '../MissionOutput';
import { HighlightedCode } from '../HighlightedCode';
import { MissionKindBadge, displayKind } from '../MissionKind';
import { ChoiceCard } from '../workspaces/PredictWorkspace';
import { SECONDARY_BUTTON } from '../workspaces/WorkspaceChrome';
import type { ExamAnswer, ExamMission } from '../../lib/exam';
import { buildPredictChoices } from '../../lib/predict';
import { createSeededDatabase, executeSql, stoppedFailure } from '../../lib/sqlEngine';
import { sqlGuard } from '../../lib/sqlGuard';
import type { CompletionSchema } from '../../lib/sqlComplete';
import type { ExecOutcome } from '../../types';

export interface ExamQuestionProps {
  mission: ExamMission;
  answer: ExamAnswer | undefined;
  index: number;
  total: number;
  onAnswer: (answer: ExamAnswer) => void;
  onNavigate: (index: number) => void;
  SQL: SqlJsStatic | null;
  referenceDb: Database | null;
  schema: CompletionSchema;
}

const LETTERS = 'ABCDEFGH';

/** Satu soal ujian: skenario + tugas, lalu editor (misi SQL) atau pilihan tabel (tebak hasil). Tanpa penilaian. */
export function ExamQuestion({ mission, answer, index, total, onAnswer, onNavigate, SQL, referenceDb, schema }: ExamQuestionProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-semibold tabular-nums text-emerald-300">
          Soal {index + 1}/{total}
        </span>
        <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 font-medium text-teal-300">Tier {mission.tier}</span>
        <MissionKindBadge kind={displayKind(mission)} />
      </div>
      <h2 className="text-lg font-bold text-slate-50">{mission.title}</h2>
      <section className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3">
        <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-teal-300">
          <Stethoscope className="h-3.5 w-3.5" aria-hidden /> Skenario
        </h3>
        <p className="text-sm leading-relaxed text-slate-300">{mission.story}</p>
      </section>
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
          <Target className="h-3.5 w-3.5" aria-hidden /> Tugas
        </h3>
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-100">
          {mission.kind === 'predict' ? 'Baca query di bawah tanpa menjalankannya, lalu pilih tabel hasil yang benar.' : mission.task}
        </p>
      </section>

      {mission.kind === 'sql' ? (
        <SqlAnswer key={mission.id} mission={mission} sql={answer?.kind === 'sql' ? answer.sql : mission.starterSql} onChange={(sql) => onAnswer({ kind: 'sql', sql })} SQL={SQL} schema={schema} />
      ) : (
        <PredictAnswer key={mission.id} mission={mission} choiceId={answer?.kind === 'predict' ? answer.choiceId : null} onChoose={(choiceId) => onAnswer({ kind: 'predict', choiceId })} db={referenceDb} />
      )}

      <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
        <button type="button" className={SECONDARY_BUTTON} disabled={index === 0} onClick={() => onNavigate(index - 1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden /> Sebelumnya
        </button>
        <button type="button" className={SECONDARY_BUTTON} disabled={index >= total - 1} onClick={() => onNavigate(index + 1)}>
          Berikutnya <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

type RunState = { status: 'idle' } | { status: 'running' } | { status: 'done'; outcome: ExecOutcome };

function SqlAnswer({ mission, sql, onChange, SQL, schema }: { mission: Extract<ExamMission, { kind: 'sql' }>; sql: string; onChange: (sql: string) => void; SQL: SqlJsStatic | null; schema: CompletionSchema }) {
  const [run, setRun] = useState<RunState>({ status: 'idle' });

  const execute = async () => {
    setRun({ status: 'running' });
    const outcome = await sqlGuard.execOnSeed(sql);
    if (outcome.status === 'done') return setRun({ status: 'done', outcome: outcome.value });
    if (outcome.status === 'unavailable' && SQL) {
      const db = createSeededDatabase(SQL);
      try {
        return setRun({ status: 'done', outcome: executeSql(db, sql) });
      } finally {
        db.close();
      }
    }
    const reason = outcome.status === 'crashed' ? 'crashed' : outcome.status === 'cancelled' ? 'cancelled' : 'timeout';
    return setRun({ status: 'done', outcome: stoppedFailure(reason, outcome.status === 'crashed' ? outcome.message : '') });
  };

  const last = run.status === 'done' && run.outcome.ok ? run.outcome.results[run.outcome.results.length - 1] : undefined;
  return (
    <div className="space-y-3">
      {mission.fix ? (
        <p className="text-xs text-rose-200">Editor berisi query bermasalah dengan {mission.fix.bugCount} bug — perbaiki seminimal mungkin.</p>
      ) : null}
      <SqlEditor value={sql} onChange={onChange} onRun={() => void execute()} placeholder="Tulis jawabanmu di sini…" minHeightClass="min-h-[200px]" schema={schema} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void execute()} disabled={run.status === 'running'} className={`${SECONDARY_BUTTON} border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10`}>
          {run.status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          Jalankan (tanpa penilaian)
        </button>
        <button type="button" onClick={() => onChange(mission.starterSql)} className={SECONDARY_BUTTON}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Isi awal
        </button>
        <span className="text-[11px] text-slate-500">Dijalankan di database bersih setiap kali; jawaban tersimpan otomatis.</span>
      </div>
      {run.status === 'done' && !run.outcome.ok ? <SqlErrorCard friendlyError={run.outcome.friendlyError} rawError={run.outcome.rawError} /> : null}
      {run.status === 'done' && run.outcome.ok ? (
        last ? (
          <ResultTable result={last} caption="Hasil statement terakhir (bukan penilaian)" maxHeightClass="max-h-72" />
        ) : (
          <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
            Berhasil dijalankan tanpa tabel hasil ({run.outcome.rowsModified} baris berubah). Perubahan tidak disimpan — setiap Jalankan memakai database bersih.
          </p>
        )
      ) : null}
    </div>
  );
}

function PredictAnswer({ mission, choiceId, onChoose, db }: { mission: Extract<ExamMission, { kind: 'predict' }>; choiceId: string | null; onChoose: (id: string) => void; db: Database | null }) {
  const built = useMemo(() => (db ? buildPredictChoices(db, mission) : null), [db, mission]);
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        <HighlightedCode code={mission.query} className="px-4 py-3 text-[13px]" />
      </div>
      {!built ? <p className="text-xs text-slate-500">Menyiapkan pilihan…</p> : null}
      {built && !built.ok ? <p className="text-xs text-rose-300">{built.message}</p> : null}
      {built?.ok ? (
        <div role="radiogroup" aria-label="Pilihan tabel hasil" className="grid gap-3 lg:grid-cols-2">
          {built.choices.map((choice, i) => (
            <ChoiceCard
              key={choice.id}
              choice={choice}
              letter={LETTERS[i] ?? '?'}
              selected={choice.id === choiceId}
              focusable={choice.id === choiceId || (choiceId === null && i === 0)}
              revealed={false}
              wrong={false}
              onChoose={() => onChoose(choice.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
