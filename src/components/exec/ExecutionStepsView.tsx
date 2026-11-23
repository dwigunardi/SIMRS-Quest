import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Footprints, Info, ListOrdered, RefreshCw, TriangleAlert } from 'lucide-react';
import type { ExecPlan, ExecStep } from '../../lib/execSteps';
import { HighlightedCode } from '../HighlightedCode';
import { SqlErrorCard } from '../MissionOutput';
import { renderInline } from '../workspaces/RichText';
import { StepTable } from './StepTable';
import { STEP_STYLE } from './stepStyle';

export interface ExecutionStepsViewProps {
  plan: ExecPlan;
  /** true jika SQL editor sudah berubah sejak langkah dihitung. */
  stale?: boolean;
  onRefresh?: () => void;
}

/** Kata kunci pembuka klausa (sudah ditampilkan terpisah sebagai label berwarna). */
const LEADING_KEYWORD = /^\s*(?:WITH(?:\s+RECURSIVE)?|SELECT(?:\s+DISTINCT)?|FROM|WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT)\b/i;

function countLabel(step: ExecStep): string {
  if (step.rowsOut === null) return '–';
  const capped = step.table?.totalCapped && step.unit === 'baris' ? '≥' : '';
  return `${capped}${step.rowsOut.toLocaleString('id-ID')} ${step.unit}`;
}

/** Diagram "urutan ditulis" dengan nomor urutan dijalankan di setiap klausa. */
function WrittenOrder({ plan, active, onPick }: { plan: Extract<ExecPlan, { ok: true }>; active: number; onPick: (order: number) => void }) {
  const activeKind = plan.steps[active]?.kind;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <ListOrdered className="h-3.5 w-3.5" aria-hidden />
        Ditulis dari atas ke bawah · nomor = urutan dijalankan
      </p>
      <ol className="space-y-1">
        {plan.written.map((clause) => {
          const step = plan.steps.find((s) => s.order === clause.order);
          const style = step ? STEP_STYLE[step.kind] : STEP_STYLE.select;
          const isActive = step?.kind === activeKind || (activeKind === 'join' && step?.kind === 'from');
          return (
            <li key={clause.label}>
              <button
                type="button"
                onClick={() => onPick(clause.order)}
                className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left transition ${
                  isActive ? `${style.ring} bg-slate-900` : 'border-transparent hover:bg-slate-900/70'
                }`}
              >
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums ${style.badge}`}>{clause.order}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-slate-300">
                  <span className={`font-semibold ${style.text}`}>{clause.label}</span> {clause.text.replace(LEADING_KEYWORD, '').replace(/\s+/g, ' ').trim()}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepDetail({ step, panelId, tabId }: { step: ExecStep; panelId: string; tabId: string }) {
  const [showRemoved, setShowRemoved] = useState(false);
  const style = STEP_STYLE[step.kind];
  return (
    <section role="tabpanel" id={panelId} aria-labelledby={tabId} className={`animate-pop-in space-y-3 rounded-xl border ${style.ring} bg-slate-900/50 p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold tabular-nums ${style.badge}`}>{step.order}</span>
        <h3 className={`text-sm font-semibold ${style.text}`}>{step.title}</h3>
        {step.rowsIn !== null && step.rowsOut !== null ? (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-0.5 text-xs tabular-nums text-slate-300">
            {step.rowsIn.toLocaleString('id-ID')}
            <ArrowRight className="h-3 w-3 text-slate-500" aria-hidden />
            <span className="font-semibold text-slate-100">{countLabel(step)}</span>
          </span>
        ) : null}
      </div>

      {step.clause ? (
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/80">
          <HighlightedCode code={step.clause} className="max-h-40 px-3 py-2" />
        </div>
      ) : null}

      <p className="text-sm leading-relaxed text-slate-300">{renderInline(step.explanation)}</p>

      {step.notes.map((note) => (
        <p key={note} className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs leading-relaxed text-amber-100">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
          <span>{renderInline(note)}</span>
        </p>
      ))}

      {step.error ? <SqlErrorCard title="Langkah ini gagal dihitung" friendlyError={step.error.friendly} rawError={step.error.raw} /> : null}

      {step.table ? (
        <StepTable table={step.table} highlight={step.highlight} groupColumn={step.groupColumn} statusColumn={step.statusColumn} />
      ) : null}

      {step.removed && step.removed.total > 0 ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowRemoved((v) => !v)}
            aria-expanded={showRemoved}
            className="text-xs font-medium text-rose-300 underline-offset-2 hover:underline"
          >
            {showRemoved ? 'Sembunyikan' : 'Lihat'} {step.removed.total.toLocaleString('id-ID')} baris yang dibuang WHERE
          </button>
          {showRemoved ? <StepTable table={step.removed} tone="removed" maxHeightClass="max-h-60" caption="Baris yang kondisinya FALSE atau NULL" /> : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Visualisasi urutan eksekusi logis: diagram urutan tulis vs urutan jalan, navigasi langkah
 * (←/→ di daftar langkah), dan tabel antara di setiap langkah.
 */
export function ExecutionStepsView({ plan, stale = false, onRefresh }: ExecutionStepsViewProps): JSX.Element {
  const baseId = useId();
  const [active, setActive] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const steps = plan.ok ? plan.steps : [];

  // Rencana baru → mulai lagi dari langkah pertama.
  useEffect(() => setActive(0), [plan]);

  if (!plan.ok) {
    if (plan.reason === 'error' && plan.rawError) {
      return <SqlErrorCard title="Query belum bisa divisualisasikan" friendlyError={plan.message} rawError={plan.rawError} />;
    }
    return (
      <div className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <span>{plan.message}</span>
      </div>
    );
  }

  const current = steps[Math.min(active, steps.length - 1)];
  /** `focusTab` hanya untuk navigasi panah di daftar langkah; tombol lain tetap memegang fokusnya sendiri. */
  const go = (index: number, focusTab = false) => {
    const next = Math.max(0, Math.min(steps.length - 1, index));
    setActive(next);
    if (focusTab) tabsRef.current?.querySelector<HTMLElement>(`[data-step="${next}"]`)?.focus();
  };
  const onTabsKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: steps.length - 1 };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    go(target, true);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-2">
        <Footprints className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-400">
          Query <span className="text-slate-200">ditulis</span> mulai dari SELECT, tetapi database{' '}
          <span className="text-slate-200">menjalankannya</span> mulai dari FROM. Telusuri setiap langkah untuk melihat isi tabel di
          tahap itu.
        </p>
        {stale && onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Query berubah — hitung ulang
          </button>
        ) : null}
      </div>

      {plan.notes.map((note) => (
        <p key={note} className="flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden />
          {note}
        </p>
      ))}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <WrittenOrder plan={plan} active={active} onPick={(order) => go(order - 1)} />

        <div className="min-w-0 space-y-3">
          <div
            ref={tabsRef}
            role="tablist"
            aria-label="Langkah eksekusi"
            onKeyDown={onTabsKey}
            className="scrollbar-thin flex items-stretch gap-1 overflow-x-auto pb-1"
          >
            {steps.map((step, index) => {
              const style = STEP_STYLE[step.kind];
              const selected = index === active;
              return (
                <div key={`${step.order}-${step.kind}`} className="flex shrink-0 items-center gap-1">
                  {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-slate-600" aria-hidden /> : null}
                  <button
                    type="button"
                    role="tab"
                    id={`${baseId}-tab-${index}`}
                    data-step={index}
                    aria-selected={selected}
                    aria-controls={`${baseId}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActive(index)}
                    className={`flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition ${
                      selected ? `${style.ring} bg-slate-900` : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                    } ${step.error ? 'border-rose-500/60' : ''}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold tabular-nums ${style.badge}`}>{step.order}</span>
                      <span className={`text-[11px] font-semibold ${style.text}`}>{style.label}</span>
                    </span>
                    <span className="mt-0.5 text-[10.5px] tabular-nums text-slate-500">{countLabel(step)}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {current ? <StepDetail key={current.order} step={current} panelId={`${baseId}-panel`} tabId={`${baseId}-tab-${active}`} /> : null}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => go(active - 1)}
              disabled={active === 0}
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Sebelumnya
            </button>
            <span className="text-[11px] tabular-nums text-slate-500">
              Langkah {active + 1} dari {steps.length}
            </span>
            <button
              type="button"
              onClick={() => go(active + 1)}
              disabled={active >= steps.length - 1}
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              Berikutnya
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
