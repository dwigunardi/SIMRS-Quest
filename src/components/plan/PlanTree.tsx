import type { ReactNode } from 'react';
import { Hammer, Repeat } from 'lucide-react';
import type { PlanNode } from '../../types';
import { KIND_ICON, TONE_STYLE } from './planStyle';

export interface PlanTreeProps {
  nodes: readonly PlanNode[];
  /** Menjalankan SQL saran (mis. CREATE INDEX) lalu Explain ulang. */
  onApplySuggestion?: (sql: string) => void;
  depth?: number;
}

function Chip({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-medium ${className}`}>{children}</span>
  );
}

function NodeChips({ node }: { node: PlanNode }): JSX.Element | null {
  const chips: JSX.Element[] = [];
  if (node.table) {
    const label = node.object && node.object.toLowerCase() !== node.table.toLowerCase() ? `${node.table} (alias ${node.object})` : node.table;
    chips.push(
      <Chip key="table" className="border-slate-700 bg-slate-900 text-slate-300">
        tabel {label}
        {node.tableRows !== null ? ` · ${node.tableRows} baris` : ''}
      </Chip>,
    );
  }
  if (node.index && node.indexColumns.length > 0) {
    chips.push(
      <Chip key="index" className="border-slate-700 bg-slate-900 font-mono text-slate-300">
        {node.index} ({node.indexColumns.join(', ')})
      </Chip>,
    );
  }
  if (node.covering) {
    chips.push(
      <Chip key="covering" className="border-teal-500/40 bg-teal-500/10 text-teal-200">
        COVERING
      </Chip>,
    );
  }
  if (node.innerLoop || node.repeated) {
    chips.push(
      <Chip key="loop" className="border-rose-500/40 bg-rose-500/10 text-rose-200">
        <Repeat className="h-3 w-3" aria-hidden="true" />
        {node.repeated ? 'diulang per baris query luar' : 'nested loop'}
      </Chip>,
    );
  }
  if (node.fkCheck) {
    chips.push(
      <Chip key="fk" className="border-violet-500/40 bg-violet-500/10 text-violet-200">
        <Repeat className="h-3 w-3" aria-hidden="true" />
        cek FOREIGN KEY per baris
      </Chip>,
    );
  }
  if (node.stopsEarly) {
    chips.push(
      <Chip key="limit" className="border-sky-500/40 bg-sky-500/10 text-sky-200">
        berhenti setelah LIMIT
      </Chip>,
    );
  }
  if (chips.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5">{chips}</div>;
}

function Suggestion({ sql, onApply }: { sql: string; onApply?: (sql: string) => void }): JSX.Element {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-950/70 px-2.5 py-1.5">
      <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-emerald-300">{sql}</code>
      {onApply ? (
        <button
          type="button"
          onClick={() => onApply(sql)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
        >
          <Hammer className="h-3 w-3" aria-hidden="true" />
          Buat index ini &amp; Explain ulang
        </button>
      ) : null}
    </div>
  );
}

function PlanTreeNode({ node, onApplySuggestion, depth }: { node: PlanNode; onApplySuggestion?: (sql: string) => void; depth: number }): JSX.Element {
  const style = TONE_STYLE[node.tone];
  const Icon = KIND_ICON[node.kind];
  return (
    <li className="relative">
      <div className={`relative overflow-hidden rounded-lg border px-3 py-2 pl-4 ${style.card}`}>
        <span className={`absolute inset-y-0 left-0 w-1 ${style.accent}`} aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-2">
          <Icon className={`h-4 w-4 shrink-0 ${style.icon}`} aria-hidden="true" />
          <span className={`rounded border px-1.5 py-px text-[11px] font-semibold ${style.badge}`}>{node.title}</span>
          <code className="min-w-0 break-all font-mono text-[12px] text-slate-200">{node.detail}</code>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{node.explanation}</p>
        <div className="mt-1.5 space-y-1">
          <NodeChips node={node} />
          {node.suggestion ? <Suggestion sql={node.suggestion} onApply={onApplySuggestion} /> : null}
        </div>
      </div>
      {node.children.length > 0 ? <PlanTree nodes={node.children} onApplySuggestion={onApplySuggestion} depth={depth + 1} /> : null}
    </li>
  );
}

/** Pohon langkah plan: anak ditampilkan menjorok dengan garis penghubung. */
export function PlanTree({ nodes, onApplySuggestion, depth = 0 }: PlanTreeProps): JSX.Element {
  return (
    <ol className={`space-y-2 ${depth > 0 ? 'ml-3 mt-2 border-l border-dashed border-slate-700 pl-4' : ''}`}>
      {nodes.map((node) => (
        <PlanTreeNode key={node.id} node={node} onApplySuggestion={onApplySuggestion} depth={depth} />
      ))}
    </ol>
  );
}
