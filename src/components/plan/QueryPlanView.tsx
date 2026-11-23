import { CircleCheck, ListTree, RefreshCw, TriangleAlert } from 'lucide-react';
import type { AppliedSuggestion, PlanStaleness, PlaygroundPlan } from '../../hooks/usePlayground';
import { MAX_EXPLAINED_STATEMENTS } from '../../lib/planTree';
import { EXPLAIN_SHORTCUT_LABEL } from '../../lib/platform';
import { SqlErrorCard, keyForObject } from '../MissionOutput';
import { PlanStatementCard } from './PlanStatementCard';
import { LEGEND_TONES, TONE_STYLE } from './planStyle';

export interface QueryPlanViewProps {
  plan: PlaygroundPlan | null;
  staleness: PlanStaleness;
  applied: AppliedSuggestion | null;
  ready: boolean;
  onExplain: () => void;
  onApplySuggestion: (sql: string) => void;
}

function IdleState({ ready, onExplain }: { ready: boolean; onExplain: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-800 bg-slate-900/30 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 ring-1 ring-sky-500/30">
        <ListTree className="h-6 w-6 text-sky-400" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-slate-300">Bagaimana SQLite menjalankan query kamu?</p>
      <p className="max-w-md text-xs leading-relaxed text-slate-500">
        Explain menampilkan <span className="text-slate-300">query plan</span> sebagai pohon langkah: tabel mana yang dibaca
        seluruhnya (full scan), mana yang dicari lewat index, dan kapan hasil perlu diurutkan di memori. Query-nya{' '}
        <span className="text-slate-300">tidak dijalankan</span>, jadi aman juga untuk UPDATE/DELETE.
      </p>
      <button
        type="button"
        onClick={onExplain}
        disabled={!ready}
        className="inline-flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ListTree className="h-4 w-4" aria-hidden="true" />
        Explain query di editor
        <kbd className="hidden rounded bg-sky-900/50 px-1.5 py-px font-mono text-[10px] font-medium text-sky-100 sm:inline">
          {EXPLAIN_SHORTCUT_LABEL}
        </kbd>
      </button>
    </div>
  );
}

function Legend(): JSX.Element {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500" aria-label="Arti warna">
      {LEGEND_TONES.map((tone) => (
        <li key={tone} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${TONE_STYLE[tone].accent}`} aria-hidden="true" />
          {TONE_STYLE[tone].label}
        </li>
      ))}
    </ul>
  );
}

const STALE_MESSAGE: Record<Exclude<PlanStaleness, null>, string> = {
  sql: 'Query di editor sudah berubah sejak Explain terakhir.',
  db: 'Database berubah sejak Explain terakhir (mis. index baru, data diubah, atau Reset Database).',
};

function StaleBanner({ staleness, onExplain }: { staleness: Exclude<PlanStaleness, null>; onExplain: () => void }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-amber-500/40 bg-amber-950/25 px-3 py-2 text-xs text-amber-200">
      <TriangleAlert className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
      <span className="min-w-0 flex-1">{STALE_MESSAGE[staleness]} Plan di bawah mungkin sudah tidak sesuai.</span>
      <button
        type="button"
        onClick={onExplain}
        className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 px-2 py-0.5 font-semibold transition hover:bg-amber-500/15"
      >
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        Explain lagi
      </button>
    </div>
  );
}

function AppliedBanner({ applied }: { applied: AppliedSuggestion }): JSX.Element {
  if (!applied.outcome.ok) {
    return <SqlErrorCard title="Index gagal dibuat" friendlyError={applied.outcome.friendlyError} rawError={applied.outcome.rawError} />;
  }
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/25 px-3 py-2.5 text-xs text-emerald-100">
      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p>
          Dijalankan di database sesi: <code className="break-all font-mono text-emerald-300">{applied.sql}</code>
        </p>
        <p className="text-emerald-200/70">
          Plan di bawah sudah diperbarui — bandingkan dengan sebelumnya. Index ini bertahan sampai Reset Database.
        </p>
      </div>
    </div>
  );
}

export function QueryPlanView({ plan, staleness, applied, ready, onExplain, onApplySuggestion }: QueryPlanViewProps): JSX.Element {
  if (!plan) return <IdleState ready={ready} onExplain={onExplain} />;
  const { report } = plan;

  return (
    <div className="space-y-3">
      {staleness ? <StaleBanner staleness={staleness} onExplain={onExplain} /> : null}
      {applied ? <AppliedBanner key={keyForObject(applied)} applied={applied} /> : null}

      {!report.ok ? (
        <SqlErrorCard key={keyForObject(report)} title="Explain gagal" friendlyError={report.friendlyError} rawError={report.rawError} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-300">
              <ListTree className="h-4 w-4" aria-hidden="true" />
              Query plan — query tidak dijalankan
            </p>
            <Legend />
          </div>
          {report.statements.map((statement) => (
            <PlanStatementCard
              key={`${keyForObject(report)}-${statement.index}`}
              statement={statement}
              numbered={report.statements.length > 1 || report.omittedCount > 0 || report.stoppedAtError}
              onApplySuggestion={staleness ? undefined : onApplySuggestion}
            />
          ))}
          {report.stoppedAtError ? (
            <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs leading-relaxed text-slate-400">
              Analisis berhenti di statement yang gagal, jadi statement sesudahnya tidak dianalisis. Explain hanya mem-parse
              query tanpa menjalankannya: kalau statement itu memakai tabel/kolom/index yang baru dibuat oleh statement
              sebelumnya di skrip yang sama, klik <span className="font-semibold text-slate-200">Run</span> dulu, lalu Explain lagi.
            </p>
          ) : null}
          {report.omittedCount > 0 ? (
            <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
              {report.omittedCount} statement berikutnya tidak ditampilkan (batas {MAX_EXPLAINED_STATEMENTS} statement per
              Explain). Pisahkan skrip menjadi beberapa bagian untuk melihatnya.
              {report.errorAfterLimit
                ? ' Di bagian yang tidak ditampilkan juga ada statement yang gagal di-parse, jadi sisa skrip sesudahnya tidak ikut terhitung.'
                : ''}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
