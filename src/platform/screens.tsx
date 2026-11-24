/**
 * Layar penuh bersama: memuat dan gagal. Dipakai shell (jalur sedang/ gagal dimuat) dan jalur itu sendiri
 * (mis. mesin SQL sedang disiapkan), supaya pergantian di antara keduanya tidak terasa sebagai dua layar berbeda.
 * Keduanya selalu menyediakan jalan pulang ke Beranda bila `onHome` diberikan — pengguna tidak boleh terjebak.
 */
import { ArrowLeft, Home, RefreshCw, TriangleAlert } from 'lucide-react';
import { BrandMark } from './BrandMark';

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300';

export interface PlatformLoadingProps {
  title: string;
  detail?: string;
  onHome?: () => void;
}

export function PlatformLoading({ title, detail, onHome }: PlatformLoadingProps): JSX.Element {
  return (
    <div className="relative grid h-screen place-items-center bg-slate-950 px-4">
      {onHome ? (
        <button
          type="button"
          onClick={onHome}
          className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100 ${FOCUS_RING}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Beranda
        </button>
      ) : null}
      <div className="flex flex-col items-center gap-4 text-center" role="status">
        <BrandMark size="lg" pulse />
        <div>
          <p className="text-lg font-semibold text-slate-100">{title}</p>
          {detail ? <p className="mt-1 text-sm text-slate-400">{detail}</p> : null}
        </div>
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal-400 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export interface PlatformErrorProps {
  title: string;
  description: string;
  /** Pesan teknis (opsional), ditampilkan apa adanya. */
  message?: string | null;
  onHome?: () => void;
}

export function PlatformError({ title, description, message, onHome }: PlatformErrorProps): JSX.Element {
  return (
    <div className="grid h-screen place-items-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-center" role="alert">
        <TriangleAlert className="mx-auto h-10 w-10 text-rose-400" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold text-slate-100">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
        {message ? (
          <pre className="scrollbar-thin mt-4 overflow-x-auto rounded-lg bg-slate-950 p-3 text-left font-mono text-xs text-rose-300">{message}</pre>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 ${FOCUS_RING}`}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Muat ulang
          </button>
          {onHome ? (
            <button
              type="button"
              onClick={onHome}
              className={`inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 ${FOCUS_RING}`}
            >
              <Home className="h-4 w-4" aria-hidden />
              Beranda
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
