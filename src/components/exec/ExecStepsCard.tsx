import { useCallback, useRef, useState } from 'react';
import type { Database } from 'sql.js';
import { Footprints, X } from 'lucide-react';
import { planExecution, stoppedPlan, type ExecPlan } from '../../lib/execSteps';
import { stoppedFailure } from '../../lib/sqlEngine';
import { sqlGuard } from '../../lib/sqlGuard';
import { ExecutionStepsView } from './ExecutionStepsView';

export interface ExecSteps {
  computed: { plan: ExecPlan; sql: string } | null;
  /** Hitung langkah untuk `sql` (di DB seed, hanya dibaca). */
  show: (sql: string) => void;
  close: () => void;
  /** true selama uji coba query di worker. */
  pending: boolean;
}

/** Status panel urutan eksekusi di workspace misi; dihitung hanya saat diminta. */
export function useExecSteps(db: Database | null): ExecSteps {
  const [computed, setComputed] = useState<ExecSteps['computed']>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const show = useCallback(
    (sql: string) => {
      if (!db || busy.current) return;
      busy.current = true;
      setPending(true);
      // Langkah-langkahnya dijalankan di thread utama — pastikan dulu query-nya selesai (worker, batas waktu).
      void sqlGuard
        .execOnSeed(sql)
        .then((guarded) => {
          if (guarded.status === 'cancelled') return;
          let plan: ExecPlan;
          if (guarded.status === 'timeout') plan = stoppedPlan(stoppedFailure('timeout'));
          else if (guarded.status === 'crashed') plan = stoppedPlan(stoppedFailure('crashed', guarded.message));
          else plan = planExecution(db, sql);
          setComputed({ plan, sql });
        })
        .finally(() => {
          busy.current = false;
          setPending(false);
        });
    },
    [db],
  );
  const close = useCallback(() => setComputed(null), []);
  return { computed, show, close, pending };
}

export interface ExecStepsCardProps {
  steps: ExecSteps;
  /** SQL saat ini (untuk mendeteksi langkah yang sudah usang). */
  currentSql: string;
}

/** Kartu "Urutan Eksekusi" untuk workspace misi (data = database awal, sama dengan data penilaian). */
export function ExecStepsCard({ steps, currentSql }: ExecStepsCardProps): JSX.Element | null {
  const { computed } = steps;
  if (!computed) return null;
  return (
    <section className="animate-pop-in space-y-3 rounded-xl border border-emerald-500/30 bg-slate-900/40 p-4" aria-label="Urutan eksekusi">
      <div className="flex items-center gap-2">
        <Footprints className="h-4 w-4 text-emerald-400" aria-hidden />
        <h3 className="text-sm font-semibold text-emerald-200">Urutan Eksekusi</h3>
        <span className="text-[11px] text-slate-500">dihitung di database awal (data yang sama dengan penilaian)</span>
        <button
          type="button"
          onClick={steps.close}
          className="ml-auto rounded-md p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
          aria-label="Tutup urutan eksekusi"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ExecutionStepsView plan={computed.plan} stale={computed.sql !== currentSql} onRefresh={() => steps.show(currentSql)} />
    </section>
  );
}
