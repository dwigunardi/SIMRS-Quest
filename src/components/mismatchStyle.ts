import { CircleX, DraftingCompass, Gauge, Layers, ListX, LockOpen, type LucideIcon, Puzzle, ShieldX } from 'lucide-react';
import type { MismatchReason } from '../types';

export interface MismatchStyle {
  icon: LucideIcon;
  title: string;
  /** Kelas kartu (border + background). */
  cardClass: string;
  iconClass: string;
  titleClass: string;
}

const AMBER = {
  cardClass: 'border-amber-500/40 bg-amber-950/25',
  iconClass: 'text-amber-400',
  titleClass: 'text-amber-300',
} as const;

const SKY = {
  cardClass: 'border-sky-500/40 bg-sky-950/25',
  iconClass: 'text-sky-400',
  titleClass: 'text-sky-300',
} as const;

const DEFAULT_STYLE: MismatchStyle = { icon: CircleX, title: 'Belum tepat — hampir sampai!', ...AMBER };

/** Ikon, judul, dan warna kartu umpan balik untuk setiap alasan jawaban belum benar. */
export function getMismatchStyle(reason: MismatchReason | null): MismatchStyle {
  switch (reason) {
    case 'missing-construct':
      return { icon: Puzzle, title: 'Hasilnya sudah keluar, tapi konstruksi wajib belum dipakai', ...AMBER };
    case 'open-transaction':
      return { icon: LockOpen, title: 'Transaksi masih terbuka', ...AMBER };
    case 'transaction-flow':
      return { icon: Layers, title: 'Isi tabel benar, tapi alur transaksinya belum tepat', ...AMBER };
    case 'index-missing':
      return { icon: Gauge, title: 'Index yang diminta belum ditemukan', ...SKY };
    case 'plan-scan':
      return { icon: Gauge, title: 'Hasil benar, tapi index belum dipakai secara efektif', ...SKY };
    case 'goal-not-met':
      return {
        icon: ShieldX,
        title: 'Target serangan belum tercapai',
        cardClass: 'border-violet-500/40 bg-violet-950/25',
        iconClass: 'text-violet-400',
        titleClass: 'text-violet-300',
      };
    case 'schema-object':
    case 'schema-structure':
    case 'probe-mismatch':
      return {
        icon: DraftingCompass,
        title: 'Desain tabel belum sesuai',
        cardClass: 'border-cyan-500/40 bg-cyan-950/25',
        iconClass: 'text-cyan-400',
        titleClass: 'text-cyan-300',
      };
    case 'quiz-wrong':
    case 'predict-wrong':
      return {
        icon: ListX,
        title: 'Masih ada jawaban yang belum tepat',
        cardClass: 'border-rose-500/40 bg-rose-950/25',
        iconClass: 'text-rose-400',
        titleClass: 'text-rose-300',
      };
    case 'no-result':
    case 'column-count':
    case 'column-names':
    case 'row-count':
    case 'cell-values':
    case 'row-order':
    case null:
      return DEFAULT_STYLE;
    default: {
      const unreachable: never = reason;
      return unreachable;
    }
  }
}
