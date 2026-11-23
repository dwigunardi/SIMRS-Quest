import { DatabaseZap, Footprints, ListTree, Play, SquareTerminal, Table2 } from 'lucide-react';
import { SqlEditor } from './SqlEditor';
import { PlaygroundOutput } from './PlaygroundOutput';
import { RunningState } from './MissionOutput';
import { useDelayedFlag } from '../hooks/useDelayedFlag';
import { ExecutionStepsView } from './exec/ExecutionStepsView';
import { QueryPlanView } from './plan/QueryPlanView';
import { EXPLAIN_SHORTCUT_LABEL, RUN_SHORTCUT_LABEL } from '../lib/platform';
import type { CompletionSchema } from '../lib/sqlComplete';
import type { Playground, PlaygroundTab } from '../hooks/usePlayground';

export interface PlaygroundWorkspaceProps {
  playground: Playground;
  ready: boolean;
  isDirty: boolean;
  /** Tabel & kolom DB sesi untuk autocomplete editor. */
  schema: CompletionSchema;
}

const RESET_CONFIRM = 'Kembalikan database ke data awal? Semua perubahan (INSERT/UPDATE/DELETE/CREATE) akan hilang.';

const TABS: ReadonlyArray<{ id: PlaygroundTab; label: string; Icon: typeof Table2 }> = [
  { id: 'result', label: 'Hasil', Icon: Table2 },
  { id: 'plan', label: 'Query Plan', Icon: ListTree },
  { id: 'steps', label: 'Urutan Eksekusi', Icon: Footprints },
];

interface OutputTabsProps {
  active: PlaygroundTab;
  onChange: (tab: PlaygroundTab) => void;
  planStale: boolean;
  stepsStale: boolean;
}

function OutputTabs({ active, onChange, planStale, stepsStale }: OutputTabsProps) {
  return (
    <div role="tablist" aria-label="Output playground" className="flex gap-1 border-b border-slate-800">
      {TABS.map(({ id, label, Icon }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`playground-tab-${id}`}
            aria-selected={selected}
            aria-controls={selected ? `playground-panel-${id}` : undefined}
            onClick={() => onChange(id)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
              selected ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
            {id === 'plan' && planStale ? (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="plan usang" title="Plan usang — klik Explain lagi" />
            ) : null}
            {id === 'steps' && stepsStale ? (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="langkah usang" title="Query berubah — hitung ulang urutan eksekusi" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function PlaygroundWorkspace({ playground, ready, isDirty, schema }: PlaygroundWorkspaceProps) {
  const { sql, setSql, run, explain, visualize, tab, setTab } = playground;
  // Indikator & penonaktifan tombol baru muncul bila query berjalan > 250 ms (query cepat tidak berkedip).
  const busy = useDelayedFlag(playground.running);

  const handleReset = () => {
    if (!window.confirm(RESET_CONFIRM)) return;
    playground.resetDatabase();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SquareTerminal className="h-4 w-4 text-teal-400" aria-hidden />
        <h2 className="text-base font-semibold text-slate-100">Free Playground</h2>
        <span className="text-xs text-slate-500">Bebas bereksperimen — tidak ada penilaian, tidak memengaruhi XP.</span>
      </div>

      <SqlEditor
        value={sql}
        onChange={setSql}
        onRun={run}
        onExplain={explain}
        disabled={!ready}
        placeholder="Coba query apa saja, mis. SELECT * FROM pasien;"
        minHeightClass="min-h-[220px]"
        schema={schema}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={!ready || busy}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden />
          Run
          <kbd className="hidden rounded bg-emerald-700/40 px-1.5 py-px font-mono text-[10px] font-medium text-emerald-50 sm:inline">
            {RUN_SHORTCUT_LABEL}
          </kbd>
        </button>
        <button
          type="button"
          onClick={explain}
          disabled={!ready || busy}
          title="Tampilkan query plan tanpa menjalankan query"
          className="inline-flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ListTree className="h-4 w-4" aria-hidden />
          Explain
          <kbd className="hidden rounded bg-sky-900/50 px-1.5 py-px font-mono text-[10px] font-medium text-sky-100 lg:inline">
            {EXPLAIN_SHORTCUT_LABEL}
          </kbd>
        </button>
        <button
          type="button"
          onClick={visualize}
          disabled={!ready || busy}
          title="Lihat urutan SQLite menjalankan SELECT: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT"
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Footprints className="h-4 w-4" aria-hidden />
          Urutan Eksekusi
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={!ready || busy}
          className={`relative inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            isDirty
              ? 'animate-pulse border-amber-400 bg-amber-500/20 text-amber-200 ring-2 ring-amber-500/40 hover:animate-none'
              : 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10'
          }`}
        >
          <DatabaseZap className="h-4 w-4" aria-hidden />
          Reset Database
          {isDirty && (
            <span className="rounded-full bg-amber-400 px-1.5 py-px text-[10px] font-bold text-slate-950">Data berubah</span>
          )}
        </button>
      </div>

      <div className="space-y-3">
        <OutputTabs active={tab} onChange={setTab} planStale={playground.staleness !== null} stepsStale={playground.stepsStale} />
        <div role="tabpanel" id={`playground-panel-${tab}`} aria-labelledby={`playground-tab-${tab}`}>
          {tab === 'result' ? (
            <PlaygroundOutput
              outcome={playground.outcome}
              running={busy}
              onCancel={playground.cancel}
              mayHavePartialChanges={playground.partial}
            />
          ) : null}
          {tab === 'plan' ? (
            <QueryPlanView
              plan={playground.plan}
              staleness={playground.staleness}
              applied={playground.applied}
              ready={ready}
              onExplain={explain}
              onApplySuggestion={playground.applySuggestion}
            />
          ) : null}
          {tab === 'steps' ? (
            busy ? <RunningState label="Menguji query sebelum menghitung langkah…" onCancel={playground.cancel} /> : <StepsPanel playground={playground} ready={ready} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StepsPanel({ playground, ready }: { playground: Playground; ready: boolean }) {
  if (!playground.steps) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-800 bg-slate-900/30 px-6 py-10 text-center">
        <Footprints className="h-8 w-8 text-emerald-400" aria-hidden />
        <p className="max-w-md text-xs leading-relaxed text-slate-400">
          SQL ditulis mulai dari <span className="font-mono text-emerald-300">SELECT</span>, tetapi dijalankan mulai dari{' '}
          <span className="font-mono text-sky-300">FROM</span>. Klik <span className="font-semibold text-emerald-300">Urutan Eksekusi</span>{' '}
          untuk melihat isi tabel di setiap tahap: FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT.
        </p>
        <button
          type="button"
          onClick={playground.visualize}
          disabled={!ready}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
        >
          <Footprints className="h-4 w-4" aria-hidden />
          Visualisasikan query di editor
        </button>
      </div>
    );
  }
  return <ExecutionStepsView plan={playground.steps.plan} stale={playground.stepsStale} onRefresh={playground.visualize} />;
}
