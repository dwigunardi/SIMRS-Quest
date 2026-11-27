import type { StepKind } from '../../lib/execSteps';

export interface StepStyle {
  /** Label kata kunci, mis. "WHERE". */
  label: string;
  /** Kelas lingkaran nomor langkah. */
  badge: string;
  /** Kelas teks aksen. */
  text: string;
  /** Kelas border kartu/pil aktif. */
  ring: string;
}

/** Satu warna per tahap, dipakai konsisten di diagram urutan tulis, navigasi langkah, dan kartu detail. */
export const STEP_STYLE: Record<StepKind, StepStyle> = {
  with: { label: 'WITH', badge: 'bg-violet-500/20 text-violet-200', text: 'text-violet-300', ring: 'border-violet-500/60' },
  from: { label: 'FROM', badge: 'bg-sky-500/20 text-sky-200', text: 'text-sky-300', ring: 'border-sky-500/60' },
  join: { label: 'JOIN', badge: 'bg-sky-500/20 text-sky-200', text: 'text-sky-300', ring: 'border-sky-500/60' },
  where: { label: 'WHERE', badge: 'bg-amber-500/20 text-amber-200 light:bg-amber-950/70', text: 'text-amber-300', ring: 'border-amber-500/60' },
  group: { label: 'GROUP BY', badge: 'bg-fuchsia-500/20 text-fuchsia-200', text: 'text-fuchsia-300', ring: 'border-fuchsia-500/60' },
  having: { label: 'HAVING', badge: 'bg-orange-500/20 text-orange-200', text: 'text-orange-300', ring: 'border-orange-500/60' },
  select: { label: 'SELECT', badge: 'bg-emerald-500/20 text-emerald-200', text: 'text-emerald-300', ring: 'border-emerald-500/60' },
  distinct: { label: 'DISTINCT', badge: 'bg-emerald-500/20 text-emerald-200', text: 'text-emerald-300', ring: 'border-emerald-500/60' },
  order: { label: 'ORDER BY', badge: 'bg-teal-500/20 text-teal-200', text: 'text-teal-300', ring: 'border-teal-500/60' },
  limit: { label: 'LIMIT', badge: 'bg-slate-500/25 text-slate-200', text: 'text-slate-300', ring: 'border-slate-400/60' },
};
