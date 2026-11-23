import { CircleCheck, Clock, Database, RotateCcw, Terminal } from 'lucide-react';
import type { ExecOutcome, ExecSuccess } from '../types';
import { ResultTable } from './ResultTable';
import { RunningState, SqlErrorCard, formatElapsed, keyForObject } from './MissionOutput';

export interface PlaygroundOutputProps {
  outcome: ExecOutcome | null;
  running: boolean;
  /** Tombol "Hentikan" saat query berjalan. */
  onCancel?: () => void;
  /**
   * true jika skrip yang gagal mengandung statement pengubah data/skema. SQLite
   * (autocommit) sudah menjalankan statement sebelum error, jadi beri peringatan.
   */
  mayHavePartialChanges?: boolean;
}

const EXAMPLES = ['SELECT * FROM pasien LIMIT 10;', 'SELECT COUNT(*) AS jumlah FROM kunjungan;'];

function IdleState(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-800 bg-slate-900/30 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10 ring-1 ring-teal-500/30">
        <Terminal className="h-6 w-6 text-teal-400" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-slate-300">Free Playground</p>
      <p className="max-w-sm text-xs leading-relaxed text-slate-500">
        Jalankan query apa saja terhadap database SIMRS. Perubahan data (INSERT/UPDATE/DELETE) hanya berlaku di sesi ini
        dan bisa dikembalikan dengan Reset Database. Klik <span className="font-semibold text-sky-300">Explain</span>{' '}
        untuk melihat bagaimana SQLite menjalankan query (pakai index atau full scan) tanpa menjalankannya.
      </p>
      <div className="flex flex-col gap-1.5">
        {EXAMPLES.map((example) => (
          <code key={example} className="rounded border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-[11px] text-emerald-300">
            {example}
          </code>
        ))}
      </div>
    </div>
  );
}

function MutationNotice({ outcome }: { outcome: ExecSuccess }): JSX.Element {
  const message =
    outcome.rowsModified > 0
      ? `${outcome.rowsModified} baris diubah — klik Reset Database untuk mengembalikan data awal`
      : 'Struktur atau data database mungkin berubah — klik Reset Database untuk mengembalikan data awal';
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-950/25 px-3 py-2.5 text-sm text-amber-200">
      <Database className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
      <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/70" aria-hidden="true" />
    </div>
  );
}

function SuccessState({ outcome }: { outcome: ExecSuccess }): JSX.Element {
  const { results } = outcome;
  const multiple = results.length > 1;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
          <CircleCheck className="h-4 w-4" aria-hidden="true" /> Query berhasil
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {formatElapsed(outcome.elapsedMs)}
        </span>
        {multiple ? <span>{results.length} result set</span> : null}
      </div>

      {outcome.mutated ? <MutationNotice outcome={outcome} /> : null}

      {results.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-4 text-sm text-emerald-200">
          <CircleCheck className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
          Statement berhasil dijalankan
        </div>
      ) : (
        results.map((result, index) => (
          <ResultTable key={index} result={result} caption={multiple ? `Result set #${index + 1}` : undefined} />
        ))
      )}
    </div>
  );
}

function PartialChangeNotice(): JSX.Element {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-950/25 px-3 py-2.5 text-sm text-amber-200">
      <Database className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        Sebagian statement sebelum error mungkin sudah dijalankan dan mengubah database — cek Schema Explorer, atau
        klik Reset Database untuk mengembalikan data awal.
      </span>
    </div>
  );
}

export function PlaygroundOutput({ outcome, running, onCancel, mayHavePartialChanges = false }: PlaygroundOutputProps): JSX.Element {
  if (running) return <RunningState onCancel={onCancel} />;
  if (!outcome) return <IdleState />;
  if (!outcome.ok) {
    return (
      <div className="space-y-3">
        <SqlErrorCard key={keyForObject(outcome)} friendlyError={outcome.friendlyError} rawError={outcome.rawError} />
        {mayHavePartialChanges ? <PartialChangeNotice /> : null}
      </div>
    );
  }
  return <SuccessState outcome={outcome} />;
}
