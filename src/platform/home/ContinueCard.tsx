import type { RefObject } from 'react';
import { ArrowRight, CircleCheckBig } from 'lucide-react';
import type { TrackGlance, TrackManifest } from '../tracks';
import { BTN_PRIMARY, formatNumber } from './ui';

export interface ContinueCardProps {
  track: TrackManifest;
  glance: TrackGlance;
  onOpen: () => void;
  /** Tombol utama halaman; Beranda memberinya fokus supaya Enter langsung masuk. */
  primaryRef: RefObject<HTMLButtonElement>;
}

/** Kartu paling menonjol untuk pengguna lama: satu klik (atau Enter) kembali ke misi terakhir. */
export function ContinueCard({ track, glance, onOpen, primaryRef }: ContinueCardProps): JSX.Element {
  const { resume, completed, total } = glance;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <section
      aria-labelledby="home-continue-title"
      data-testid="home-continue"
      className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-slate-900/80 to-slate-900/80 p-5 shadow-xl shadow-emerald-950/40 sm:p-7"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
            {resume ? null : <CircleCheckBig className="h-4 w-4" aria-hidden />}
            {resume ? 'Lanjut dari sini' : 'Jalur selesai'}
          </p>
          {resume ? (
            <>
              <h2 id="home-continue-title" className="mt-1.5 text-xl font-bold leading-snug tracking-tight text-slate-50 sm:text-2xl" data-testid="home-continue-title">
                {track.title} · Misi {resume.order} — {resume.title}
              </h2>
              <p className="mt-1 text-sm text-slate-400">{resume.tierLabel}</p>
            </>
          ) : (
            <>
              <h2 id="home-continue-title" className="mt-1.5 text-xl font-bold leading-snug tracking-tight text-slate-50 sm:text-2xl" data-testid="home-continue-title">
                Semua misi {track.title} tuntas
              </h2>
              <p className="mt-1 text-sm text-slate-400">Buka jalurnya untuk mengulang misi, bereksperimen di Playground, atau menguji diri di Mode Ujian.</p>
            </>
          )}
        </div>
        <button ref={primaryRef} type="button" onClick={onOpen} className={`${BTN_PRIMARY} sm:px-6 sm:py-3 sm:text-base`} data-testid="home-primary">
          {resume ? 'Lanjutkan' : `Buka jalur ${track.title}`}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-slate-800/80 pt-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-300">
              <span className="font-semibold tabular-nums text-slate-100" data-testid="home-continue-progress">
                {completed}/{total}
              </span>{' '}
              misi selesai
            </span>
            <span className="tabular-nums text-slate-400">{percent}%</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"
            role="progressbar"
            aria-label={`Kemajuan jalur ${track.title}`}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={completed}
            aria-valuetext={`${completed} dari ${total} misi selesai`}
          >
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <p className="flex shrink-0 items-center gap-2 text-sm text-slate-300" data-testid="home-continue-rank">
          <span className="text-xl leading-none" aria-hidden>
            {glance.rank.icon}
          </span>
          <span className="font-medium text-slate-100">{glance.rank.title}</span>
          <span className="text-slate-500" aria-hidden>
            ·
          </span>
          <span className="tabular-nums text-amber-300">{formatNumber(glance.xp)} XP</span>
        </p>
      </div>
    </section>
  );
}
