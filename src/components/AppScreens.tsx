import { Hospital, RefreshCw, TriangleAlert } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="grid h-screen place-items-center bg-slate-950 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="grid h-16 w-16 animate-pulse place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-xl shadow-emerald-500/20">
          <Hospital className="h-8 w-8" aria-hidden />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-100">Menyiapkan database SIMRS…</p>
          <p className="mt-1 text-sm text-slate-500">Memuat SQLite (WebAssembly) dan data pasien dummy.</p>
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

export interface ErrorScreenProps {
  message: string | null;
}

export function ErrorScreen({ message }: ErrorScreenProps) {
  return (
    <div className="grid h-screen place-items-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
        <TriangleAlert className="mx-auto h-10 w-10 text-rose-400" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold text-slate-100">Gagal memuat database</h1>
        <p className="mt-2 text-sm text-slate-400">
          Mesin SQL (sql.js) tidak bisa dijalankan di browser ini. Coba muat ulang halaman.
        </p>
        {message && (
          <pre className="scrollbar-thin mt-4 overflow-x-auto rounded-lg bg-slate-950 p-3 text-left font-mono text-xs text-rose-300">
            {message}
          </pre>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Muat ulang
        </button>
      </div>
    </div>
  );
}
