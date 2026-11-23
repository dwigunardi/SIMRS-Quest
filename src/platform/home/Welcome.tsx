import type { RefObject } from 'react';
import { ArrowRight } from 'lucide-react';
import { PRODUCT_TAGLINE } from '../brand';
import type { TrackManifest } from '../tracks';
import { BTN_PRIMARY, LINK } from './ui';

export interface WelcomeProps {
  track: TrackManifest;
  onStart: () => void;
  /** Buka pemilih file cadangan. */
  onRestore: () => void;
  primaryRef: RefObject<HTMLButtonElement>;
}

/** Sambutan pengguna baru: satu kalimat tentang apa ini, satu tombol untuk mulai, dan jalan masuk bagi yang pindah perangkat. */
export function Welcome({ track, onStart, onRestore, primaryRef }: WelcomeProps): JSX.Element {
  return (
    <section
      aria-labelledby="home-welcome-title"
      data-testid="home-welcome"
      className="rounded-2xl border border-slate-800 bg-gradient-to-br from-emerald-500/[0.10] via-slate-900/80 to-slate-900/80 p-6 shadow-xl shadow-emerald-950/30 sm:p-10"
    >
      <h2 id="home-welcome-title" className="max-w-2xl text-balance text-2xl font-bold leading-tight tracking-tight text-slate-50 sm:text-4xl sm:leading-tight">
        {PRODUCT_TAGLINE}
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
        Belajar dari SQL sampai framework lewat kasus sistem informasi rumah sakit. Tanpa akun dan tanpa instalasi — semuanya berjalan dan
        tersimpan di browser ini.
      </p>
      <div className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
        <button ref={primaryRef} type="button" onClick={onStart} className={`${BTN_PRIMARY} sm:px-6 sm:py-3 sm:text-base`} data-testid="home-primary">
          Mulai dari {track.title}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
        <p className="text-sm text-slate-400">
          Punya file cadangan?{' '}
          <button type="button" onClick={onRestore} className={LINK} data-testid="home-restore">
            Pulihkan
          </button>
        </p>
      </div>
    </section>
  );
}
