import {
  ArrowUpDown,
  Boxes,
  CircleHelp,
  Funnel,
  Hammer,
  KeyRound,
  Layers,
  ListOrdered,
  ScanLine,
  Search,
  type LucideIcon,
} from 'lucide-react';
import type { PlanNodeKind, PlanTableAccess, PlanTone } from '../../types';

export interface ToneStyle {
  /** Border + latar kartu. */
  card: string;
  /** Badge judul langkah. */
  badge: string;
  icon: string;
  /** Garis aksen kiri. */
  accent: string;
  label: string;
}

export const TONE_STYLE: Record<PlanTone, ToneStyle> = {
  good: {
    card: 'border-emerald-500/30 bg-emerald-950/20',
    badge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    icon: 'text-emerald-400',
    accent: 'bg-emerald-500',
    label: 'Memakai index',
  },
  warn: {
    card: 'border-amber-500/30 bg-amber-950/15',
    badge: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    icon: 'text-amber-400',
    accent: 'bg-amber-500',
    label: 'Ada biaya tambahan',
  },
  bad: {
    card: 'border-rose-500/40 bg-rose-950/25',
    badge: 'border-rose-500/50 bg-rose-500/15 text-rose-200',
    icon: 'text-rose-400',
    accent: 'bg-rose-500',
    label: 'Mahal (berulang)',
  },
  info: {
    card: 'border-sky-500/25 bg-sky-950/15',
    badge: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
    icon: 'text-sky-400',
    accent: 'bg-sky-500',
    label: 'Info',
  },
  neutral: {
    card: 'border-slate-800 bg-slate-900/50',
    badge: 'border-slate-700 bg-slate-800/60 text-slate-300',
    icon: 'text-slate-400',
    accent: 'bg-slate-600',
    label: 'Struktur',
  },
};

export const KIND_ICON: Record<PlanNodeKind, LucideIcon> = {
  'full-scan': ScanLine,
  'index-scan': ListOrdered,
  'index-search': Search,
  'rowid-search': KeyRound,
  'auto-index': Hammer,
  'temp-btree': ArrowUpDown,
  'bloom-filter': Funnel,
  'derived-scan': Layers,
  structure: Boxes,
  other: CircleHelp,
};

export const ACCESS_LABEL: Record<PlanTableAccess['kind'], string> = {
  'full-scan': 'Full scan',
  'index-scan': 'Scan index',
  'index-search': 'Search index',
  'rowid-search': 'Search PK',
  'auto-index': 'Index sementara',
};

/** Urutan legenda (dari baik ke mahal). */
export const LEGEND_TONES: readonly PlanTone[] = ['good', 'warn', 'bad', 'info', 'neutral'];
