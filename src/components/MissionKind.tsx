import { BookOpen, Bug, Crown, Database, ScanSearch, ShieldAlert, type LucideIcon } from 'lucide-react';
import type { Mission } from '../types';

/** Jenis misi untuk tampilan: misi SQL "Perbaiki Query" dan Boss Challenge dibedakan dari misi SQL biasa. */
export type MissionKind = Mission['kind'] | 'fix' | 'boss';

export function displayKind(mission: Mission): MissionKind {
  if (mission.kind === 'sql' && mission.boss) return 'boss';
  return mission.kind === 'sql' && mission.fix ? 'fix' : mission.kind;
}

export interface MissionKindMeta {
  /** Label singkat untuk badge, mis. "Lab Keamanan". */
  label: string;
  icon: LucideIcon;
  /** Kelas badge (border + background + teks) sesuai aksen jenis misi. */
  badgeClass: string;
  /** Kelas warna ikon saja. */
  iconClass: string;
  /** Kelas chip nomor misi di header workspace. */
  chipClass: string;
}

export const MISSION_KIND_META: Record<MissionKind, MissionKindMeta> = {
  sql: {
    label: 'SQL',
    icon: Database,
    badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    iconClass: 'text-emerald-400',
    chipClass: 'bg-emerald-500/15 text-emerald-300',
  },
  fix: {
    label: 'Perbaiki Bug',
    icon: Bug,
    badgeClass: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    iconClass: 'text-rose-400',
    chipClass: 'bg-rose-500/15 text-rose-300',
  },
  boss: {
    label: 'Boss',
    icon: Crown,
    badgeClass: 'border-yellow-400/50 bg-yellow-400/10 text-yellow-200 light:border-yellow-700/50 light:bg-yellow-950/40',
    iconClass: 'text-yellow-300',
    chipClass: 'bg-yellow-400/15 text-yellow-200 light:bg-yellow-950/50',
  },
  predict: {
    label: 'Tebak Hasil',
    icon: ScanSearch,
    badgeClass: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
    iconClass: 'text-orange-400',
    chipClass: 'bg-orange-500/15 text-orange-300',
  },
  injection: {
    label: 'Lab Keamanan',
    icon: ShieldAlert,
    badgeClass: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
    iconClass: 'text-violet-400',
    chipClass: 'bg-violet-500/15 text-violet-300',
  },
  concept: {
    label: 'Kartu Konsep',
    icon: BookOpen,
    badgeClass: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    iconClass: 'text-sky-400',
    chipClass: 'bg-sky-500/15 text-sky-300',
  },
};

export function MissionKindBadge({ kind }: { kind: MissionKind }) {
  const meta = MISSION_KIND_META[kind];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.badgeClass}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

/** Ikon jenis misi dengan warna aksennya (untuk daftar misi). */
export function KindIcon({ kind, className = 'h-3.5 w-3.5' }: { kind: MissionKind; className?: string }) {
  const meta = MISSION_KIND_META[kind];
  const Icon = meta.icon;
  return <Icon className={`${className} ${meta.iconClass}`} aria-label={meta.label} />;
}
