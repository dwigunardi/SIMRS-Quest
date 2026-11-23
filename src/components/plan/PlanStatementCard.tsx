import { CircleSlash, Lightbulb, TriangleAlert } from 'lucide-react';
import type { PlanSummary, StatementPlan } from '../../types';
import { HighlightedCode } from '../HighlightedCode';
import { SqlErrorCard } from '../MissionOutput';
import { PlanTree } from './PlanTree';
import { ACCESS_LABEL, TONE_STYLE } from './planStyle';

export interface PlanStatementCardProps {
  statement: StatementPlan;
  /** Tampilkan nomor statement (hanya jika skrip berisi >1 statement). */
  numbered: boolean;
  onApplySuggestion?: (sql: string) => void;
}

function SummaryCard({ summary }: { summary: PlanSummary }): JSX.Element {
  const style = TONE_STYLE[summary.tone];
  return (
    <div className={`space-y-2.5 rounded-lg border px-3.5 py-3 ${style.card}`}>
      <p className="text-sm font-semibold text-slate-100">{summary.headline}</p>
      {summary.tables.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Akses per tabel">
          {summary.tables.map((access) => (
            <li key={access.table} className={`rounded border px-2 py-0.5 text-[11px] font-medium ${TONE_STYLE[access.tone].badge}`}>
              {access.table} · {ACCESS_LABEL[access.kind]}
              {access.rows !== null ? ` · ${access.rows} baris` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      {summary.tips.length > 0 ? (
        <ul className="space-y-1.5 border-t border-slate-800/80 pt-2.5">
          {summary.tips.map((tip) => (
            <li key={tip} className="flex gap-2 text-xs leading-relaxed text-slate-300">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RawPlan({ statement }: { statement: Extract<StatementPlan, { status: 'plan' }> }): JSX.Element {
  return (
    <details className="group rounded-lg border border-slate-800 bg-slate-950/60">
      <summary className="cursor-pointer select-none px-3 py-1.5 text-[11px] font-medium text-slate-500 transition hover:text-slate-300">
        Output mentah EXPLAIN QUERY PLAN ({statement.rows.length} baris)
      </summary>
      <div className="scrollbar-thin overflow-x-auto border-t border-slate-800 px-3 py-2">
        <table className="w-full font-mono text-[11px] text-slate-300">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pr-4 font-medium">id</th>
              <th className="pr-4 font-medium">parent</th>
              <th className="font-medium">detail</th>
            </tr>
          </thead>
          <tbody>
            {statement.rows.map((row) => (
              <tr key={row.id}>
                <td className="pr-4 tabular-nums">{row.id}</td>
                <td className="pr-4 tabular-nums">{row.parent}</td>
                <td className="whitespace-pre">{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function StatementBody({ statement, onApplySuggestion }: Omit<PlanStatementCardProps, 'numbered'>): JSX.Element {
  switch (statement.status) {
    case 'plan':
      return (
        <div className="space-y-3">
          {statement.afterUnappliedDdl ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-950/25 px-3 py-2 text-xs leading-relaxed text-amber-200">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
              <span>
                Ada CREATE/DROP/ALTER sebelum statement ini di skrip yang sama, tetapi Explain tidak menjalankannya — plan ini
                dihitung terhadap skema <span className="font-semibold">sebelum</span> perubahan itu. Untuk melihat efeknya
                (mis. index baru), klik Run dulu, lalu Explain lagi.
              </span>
            </p>
          ) : null}
          <SummaryCard summary={statement.summary} />
          <PlanTree nodes={statement.roots} onApplySuggestion={onApplySuggestion} />
          <RawPlan statement={statement} />
        </div>
      );
    case 'no-plan':
      return (
        <div className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-xs text-slate-400">
          <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <span>{statement.reason}</span>
        </div>
      );
    case 'error':
      return <SqlErrorCard title="Statement ini tidak bisa dianalisis" friendlyError={statement.friendlyError} rawError={statement.rawError} />;
    default: {
      const unreachable: never = statement;
      return unreachable;
    }
  }
}

export function PlanStatementCard({ statement, numbered, onApplySuggestion }: PlanStatementCardProps): JSX.Element {
  return (
    <article className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
      <header className="space-y-1.5">
        {numbered ? (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Statement #{statement.index}</p>
        ) : null}
        <div className="scrollbar-thin max-h-32 overflow-y-auto rounded-md border border-slate-800 bg-slate-950">
          <HighlightedCode code={statement.sql} className="px-3 py-2" />
        </div>
      </header>
      <StatementBody statement={statement} onApplySuggestion={onApplySuggestion} />
    </article>
  );
}
