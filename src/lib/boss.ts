/**
 * Aturan Boss Challenge (fungsi murni).
 * - Boss terbuka setelah SEMUA misi lain di tier-nya selesai (kartu konsep juga).
 * - Tanpa hint; solusi baru bisa dibuka setelah BOSS_SOLUTION_AFTER percobaan (atau setelah selesai).
 */
import { TIERS } from '../data/missions';
import type { Mission, MissionProgress, SqlMission, UserProgress } from '../types';
import { getMissionProgress } from './progress';

export const BOSS_SOLUTION_AFTER = 3;

export type BossMission = SqlMission & { boss: NonNullable<SqlMission['boss']> };

export function isBoss(mission: Mission): mission is BossMission {
  return mission.kind === 'sql' && mission.boss !== undefined;
}

/** Tier terakhir kurikulum; boss-nya disebut "Final Boss". */
const LAST_TIER = Math.max(...TIERS.map((t) => t.tier));

/** "Final Boss" untuk boss tier terakhir, selain itu "Boss Tier N". */
export function bossLabel(tier: number): string {
  return tier === LAST_TIER ? 'Final Boss' : `Boss Tier ${tier}`;
}

/** Misi lain di tier boss yang belum selesai (urut order). Kosong = boss boleh dibuka. */
export function bossBlockers(missions: readonly Mission[], progress: UserProgress, boss: Mission): Mission[] {
  return missions
    .filter((m) => m.tier === boss.tier && m.id !== boss.id && !getMissionProgress(progress, m.id).completed)
    .sort((a, b) => a.order - b.order);
}

/** Sisa percobaan sebelum solusi boss boleh dibuka; 0 = boleh (juga untuk misi non-boss). */
export function solutionAttemptsLeft(mission: Mission, mp: MissionProgress): number {
  if (!isBoss(mission) || mp.completed || mp.solutionShown) return 0;
  return Math.max(0, BOSS_SOLUTION_AFTER - mp.attempts);
}
