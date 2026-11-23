/**
 * Agregator kurikulum. Setiap tier tinggal di file sendiri agar mudah dirawat:
 * tier1-3.ts (inti), tier4.ts … tier8.ts (lanjutan).
 */
import type { Mission, TierInfo } from '../../types';
import { MISSIONS_CORE, TIERS_CORE } from './tier1-3';
import { MISSIONS_TIER4, TIER4 } from './tier4';
import { MISSIONS_TIER5, TIER5 } from './tier5';
import { MISSIONS_TIER6, TIER6 } from './tier6';
import { MISSIONS_TIER7, TIER7 } from './tier7';
import { MISSIONS_TIER8, TIER8 } from './tier8';
import { MISSIONS_TIER9, TIER9 } from './tier9';
import { MISSIONS_TIER10, TIER10 } from './tier10';
import { MISSIONS_BOSS } from './bosses';

export const TIERS: TierInfo[] = [...TIERS_CORE, TIER4, TIER5, TIER6, TIER7, TIER8, TIER9, TIER10];

export const MISSIONS: Mission[] = [
  ...MISSIONS_CORE,
  ...MISSIONS_TIER4,
  ...MISSIONS_TIER5,
  ...MISSIONS_TIER6,
  ...MISSIONS_TIER7,
  ...MISSIONS_TIER8,
  ...MISSIONS_TIER9,
  ...MISSIONS_TIER10,
  ...MISSIONS_BOSS,
].sort((a, b) => a.order - b.order);

export function getMissionById(id: string): Mission | undefined {
  return MISSIONS.find((mission) => mission.id === id);
}

export function getNextMission(id: string): Mission | undefined {
  const current = getMissionById(id);
  if (!current) return undefined;
  return MISSIONS.find((mission) => mission.order === current.order + 1);
}

export const TOTAL_XP: number = MISSIONS.reduce((sum, mission) => sum + mission.xpReward, 0);
