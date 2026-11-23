/**
 * Kelas Tailwind bersama untuk Beranda. Ditulis UTUH (bukan dirangkai) supaya terbaca pemindai Tailwind.
 * Setiap kontrol punya cincin fokus yang terlihat saat dipakai lewat keyboard.
 */
export const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300';

/** Aksi utama halaman (hanya satu per layar). */
export const BTN_PRIMARY =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200';

/** Aksi pendamping di dalam kartu/baris. */
export const BTN_SECONDARY =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 hover:text-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300';

/** Tombol/tautan berwujud teks. */
export const LINK =
  'rounded font-medium text-emerald-300 underline decoration-emerald-500/40 underline-offset-4 transition hover:text-emerald-200 hover:decoration-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300';

/** Tombol ikon kecil (tutup catatan/pemberitahuan). */
export const BTN_ICON =
  'shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300';

export const SECTION_TITLE = 'text-base font-semibold text-slate-100';

/** Angka dengan pemisah ribuan Indonesia (1.250). */
export function formatNumber(value: number): string {
  return value.toLocaleString('id-ID');
}

/** Sisa waktu "12:34" (atau "1:02:03" bila lebih dari satu jam); tidak pernah negatif. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
