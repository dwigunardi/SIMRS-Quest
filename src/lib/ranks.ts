/**
 * Sistem rank berbasis total XP (total kurikulum 14800 XP termasuk boss).
 * Ambang disusun dari XP kumulatif akhir tiap tier (T1 450, T2 1350, T3 2850, T5 5825, T7 8800) dengan sedikit
 * kelonggaran untuk penalti hint, sehingga setiap rank kira-kira berarti "tier N tuntas". Rank tertinggi tetap bisa
 * dicapai walau SEMUA misi biasa memakai hint (10850 × 0,8 + 3950 boss = 12630 XP) — diperiksa di scripts/verify.
 */
import type { Rank, RankProgress } from '../types';

export const RANKS: Rank[] = [
  { id: 'intern', title: 'IT Intern', minXp: 0, icon: '🩺' },
  { id: 'junior', title: 'Junior Programmer RS', minXp: 300, icon: '💻' }, // ≈ Tier 1 tuntas
  { id: 'engineer', title: 'SIMRS Engineer', minXp: 1100, icon: '🏥' }, // ≈ Tier 2 tuntas
  { id: 'senior', title: 'Senior Healthcare Dev', minXp: 2600, icon: '🏆' }, // ≈ Tier 3 tuntas
  { id: 'specialist', title: 'Database Specialist RS', minXp: 5000, icon: '🗄️' }, // ≈ Tier 5 tuntas
  { id: 'architect', title: 'Health Informatics Architect', minXp: 8000, icon: '🧠' }, // ≈ Tier 7 tuntas
  { id: 'head', title: 'Kepala Instalasi SIMRS', minXp: 10200, icon: '👑' }, // ≈ Tier 9 tuntas
  { id: 'director', title: 'Direktur Transformasi Digital RS', minXp: 12500, icon: '🛰️' }, // ≈ Tier 10 tuntas
];

const FALLBACK_RANK: Rank = { id: 'intern', title: 'IT Intern', minXp: 0, icon: '🩺' };

function rankIndex(xp: number): number {
  let index = 0;
  RANKS.forEach((rank, idx) => {
    if (xp >= rank.minXp) index = idx;
  });
  return index;
}

export function getRank(xp: number): Rank {
  return RANKS[rankIndex(xp)] ?? FALLBACK_RANK;
}

export function getRankProgress(xp: number): RankProgress {
  const idx = rankIndex(xp);
  const current = RANKS[idx] ?? FALLBACK_RANK;
  const next = RANKS[idx + 1] ?? null;

  if (!next) return { current, next: null, ratio: 1, xpToNext: 0 };

  const span = next.minXp - current.minXp;
  const ratio = span > 0 ? (xp - current.minXp) / span : 1;
  return {
    current,
    next,
    ratio: Math.min(1, Math.max(0, ratio)),
    xpToNext: Math.max(0, next.minXp - xp),
  };
}
