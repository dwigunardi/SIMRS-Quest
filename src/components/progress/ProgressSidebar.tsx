import { ChartColumn } from 'lucide-react';
import { BackupCard } from './BackupCard';
import { getMissionProgress } from '../../lib/progress';
import type { WeaknessReport } from '../../lib/weakness';
import type { Mission, TierInfo, UserProgress } from '../../types';

export interface ProgressSidebarProps {
  report: WeaknessReport;
  missions: readonly Mission[];
  tiers: readonly TierInfo[];
  progress: UserProgress;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-100">{value}</p>
      {hint ? <p className="text-[10.5px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

/** Ringkasan progres: angka utama + misi selesai per tier. */
export function ProgressSidebar({ report, missions, tiers, progress }: ProgressSidebarProps): JSX.Element {
  const { stats } = report;
  const firstTryRate = stats.completed > 0 ? Math.round((stats.firstTry / stats.completed) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ChartColumn className="h-5 w-5 text-emerald-400" aria-hidden />
        <h2 className="text-base font-semibold text-slate-100">Progres Belajar</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Misi selesai" value={`${stats.completed}/${missions.length}`} />
        <Stat label="Total percobaan" value={stats.attempts.toLocaleString('id-ID')} />
        <Stat label="Langsung benar" value={`${firstTryRate}%`} hint={`${stats.firstTry} misi selesai dengan satu kali percobaan`} />
        <Stat label="Kesalahan 7 hari" value={report.recentMistakes.toLocaleString('id-ID')} hint={`${report.totalMistakes} tercatat seluruhnya`} />
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Per tier</h3>
        <ul className="space-y-2">
          {tiers.map((tier) => {
            const inTier = missions.filter((m) => m.tier === tier.tier);
            const done = inTier.filter((m) => getMissionProgress(progress, m.id).completed).length;
            const pct = inTier.length > 0 ? Math.round((done / inTier.length) * 100) : 0;
            return (
              <li key={tier.tier} className="space-y-1">
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-slate-300">
                    Tier {tier.tier} · {tier.name}
                  </span>
                  <span className="ml-auto tabular-nums text-slate-400">
                    {done}/{inTier.length}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden>
                  <div className="h-full rounded-full bg-emerald-400/80 light:bg-emerald-600" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <BackupCard />

      <p className="text-[11px] leading-relaxed text-slate-500">
        Riwayat kesalahan disimpan di browser ini saja dan ikut terhapus saat progres direset.
      </p>
    </div>
  );
}
