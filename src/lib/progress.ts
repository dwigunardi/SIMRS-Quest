/**
 * Logika progres & gamifikasi (fungsi murni) + IO localStorage yang aman.
 */
import type {
  CompletionSummary,
  Mission,
  MissionProgress,
  StreakState,
  UserProgress,
} from '../types';
import { getRank } from './ranks';

export const STORAGE_KEY = 'simrs-sql-quest:progress:v1';
export const HINT_PENALTY = 0.2;

/* ------------------------------------------------------------------ */
/* Nilai default                                                       */
/* ------------------------------------------------------------------ */

function emptyMissionProgress(): MissionProgress {
  return {
    completed: false,
    earnedXp: 0,
    hintUsed: false,
    hintsRevealed: 0,
    solutionShown: false,
    attempts: 0,
    completedAt: null,
  };
}

export function createEmptyProgress(): UserProgress {
  return {
    version: 1,
    xp: 0,
    streak: { current: 0, best: 0, lastActiveDate: null },
    missions: {},
    lastMissionId: null,
  };
}

/* ------------------------------------------------------------------ */
/* Validasi bentuk data tersimpan                                      */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseStreak(value: unknown): StreakState | null {
  if (!isRecord(value)) return null;
  const { current, best, lastActiveDate } = value;
  if (!isCount(current) || !isCount(best) || !isNullableString(lastActiveDate)) return null;
  if (lastActiveDate !== null && !DATE_KEY_PATTERN.test(lastActiveDate)) return null;
  return { current: Math.floor(current), best: Math.floor(Math.max(best, current)), lastActiveDate };
}

function parseMissionProgress(value: unknown): MissionProgress | null {
  if (!isRecord(value)) return null;
  const { completed, earnedXp, hintUsed, hintsRevealed, solutionShown, attempts, completedAt } = value;
  if (typeof completed !== 'boolean' || typeof hintUsed !== 'boolean' || typeof solutionShown !== 'boolean') {
    return null;
  }
  if (!isCount(earnedXp) || !isCount(hintsRevealed) || !isCount(attempts) || !isNullableString(completedAt)) {
    return null;
  }
  return { completed, earnedXp, hintUsed, hintsRevealed, solutionShown, attempts, completedAt };
}

function parseMissions(value: unknown): Record<string, MissionProgress> | null {
  if (!isRecord(value)) return null;
  const missions: Record<string, MissionProgress> = {};
  for (const [id, entry] of Object.entries(value)) {
    const parsed = parseMissionProgress(entry);
    if (parsed) missions[id] = parsed;
  }
  return missions;
}

/** Validasi bentuk progres tersimpan (juga dipakai impor cadangan); null bila tidak valid. */
export function parseProgress(value: unknown): UserProgress | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const streak = parseStreak(value.streak);
  const missions = parseMissions(value.missions);
  if (!isCount(value.xp) || !streak || !missions || !isNullableString(value.lastMissionId)) return null;
  return { version: 1, xp: value.xp, streak, missions, lastMissionId: value.lastMissionId };
}

/* ------------------------------------------------------------------ */
/* IO localStorage                                                     */
/* ------------------------------------------------------------------ */

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadProgress(): UserProgress {
  try {
    const raw = getStorage()?.getItem(STORAGE_KEY);
    if (!raw) return createEmptyProgress();
    const parsed: unknown = JSON.parse(raw);
    return parseProgress(parsed) ?? createEmptyProgress();
  } catch {
    return createEmptyProgress();
  }
}

export function saveProgress(progress: UserProgress): void {
  try {
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* storage penuh/diblokir — progres tetap ada di memori */
  }
}

/* ------------------------------------------------------------------ */
/* Helper misi                                                         */
/* ------------------------------------------------------------------ */

export function getMissionProgress(progress: UserProgress, missionId: string): MissionProgress {
  return progress.missions[missionId] ?? emptyMissionProgress();
}

function withMission(
  progress: UserProgress,
  missionId: string,
  update: (mp: MissionProgress) => MissionProgress,
): UserProgress {
  const current = getMissionProgress(progress, missionId);
  return { ...progress, missions: { ...progress.missions, [missionId]: update(current) } };
}

export function calcReward(mission: Mission, mp: MissionProgress): number {
  if (mp.solutionShown) return 0;
  if (mp.hintUsed) return Math.round(mission.xpReward * (1 - HINT_PENALTY));
  return mission.xpReward;
}

/**
 * Menambah hitungan percobaan SAMPAI misi selesai. Latihan ulang misi yang sudah selesai tidak dihitung, sehingga
 * `attempts` berarti "jumlah percobaan sampai berhasil" (dipakai statistik "langsung benar").
 */
export function recordAttempt(progress: UserProgress, missionId: string): UserProgress {
  return withMission(progress, missionId, (mp) => (mp.completed ? mp : { ...mp, attempts: mp.attempts + 1 }));
}

export function markHintRevealed(progress: UserProgress, missionId: string, revealedCount: number): UserProgress {
  return withMission(progress, missionId, (mp) => ({
    ...mp,
    hintsRevealed: Math.max(mp.hintsRevealed, revealedCount),
    hintUsed: mp.completed ? mp.hintUsed : mp.hintUsed || revealedCount > 0,
  }));
}

export function markSolutionShown(progress: UserProgress, missionId: string): UserProgress {
  return withMission(progress, missionId, (mp) => (mp.completed ? mp : { ...mp, solutionShown: true }));
}

/* ------------------------------------------------------------------ */
/* Streak                                                              */
/* ------------------------------------------------------------------ */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function yesterdayKey(now: Date): string {
  // Siang hari lokal minus satu hari → aman dari pergeseran DST.
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0, 0);
  return toLocalDateKey(yesterday);
}

export function updateStreak(streak: StreakState, now: Date): { streak: StreakState; increased: boolean } {
  const today = toLocalDateKey(now);
  if (streak.lastActiveDate === today) return { streak, increased: false };

  const current = streak.lastActiveDate === yesterdayKey(now) ? streak.current + 1 : 1;
  return {
    streak: { current, best: Math.max(streak.best, current), lastActiveDate: today },
    increased: current > streak.current,
  };
}

/** Catat hari ini sebagai hari aktif (mis. setelah sesi latihan ulang / ujian), tanpa mengubah XP atau misi. */
export function recordActivity(progress: UserProgress, now: Date): UserProgress {
  const { streak } = updateStreak(progress.streak, now);
  return streak === progress.streak ? progress : { ...progress, streak };
}

/**
 * Streak yang masih "hidup" untuk ditampilkan: jika hari terakhir aktif bukan
 * hari ini atau kemarin, streak sudah putus sehingga ditampilkan 0
 * (nilai tersimpan baru di-reset saat misi berikutnya diselesaikan).
 */
export function getActiveStreak(streak: StreakState, now: Date): number {
  const last = streak.lastActiveDate;
  if (last === toLocalDateKey(now) || last === yesterdayKey(now)) return streak.current;
  return 0;
}

/* ------------------------------------------------------------------ */
/* Penyelesaian misi                                                   */
/* ------------------------------------------------------------------ */

export function completeMission(
  progress: UserProgress,
  mission: Mission,
  now: Date,
): { progress: UserProgress; summary: CompletionSummary } {
  const mp = getMissionProgress(progress, mission.id);
  const { streak, increased } = updateStreak(progress.streak, now);
  const firstCompletion = !mp.completed;
  const xpGained = firstCompletion ? calcReward(mission, mp) : 0;
  const xp = progress.xp + xpGained;

  const missions = firstCompletion
    ? {
        ...progress.missions,
        [mission.id]: { ...mp, completed: true, earnedXp: xpGained, completedAt: now.toISOString() },
      }
    : progress.missions;

  const before = getRank(progress.xp);
  const after = getRank(xp);

  return {
    progress: { ...progress, xp, streak, missions },
    summary: {
      missionId: mission.id,
      xpGained,
      firstCompletion,
      rankUp: after.id !== before.id ? after : null,
      streak,
      streakIncreased: increased,
    },
  };
}

function isBossMission(mission: Mission): boolean {
  return mission.kind === 'sql' && mission.boss !== undefined;
}

/**
 * Misi konsep (materi bacaan) SELALU terbuka. Boss Challenge terbuka setelah semua misi lain di tier-nya selesai.
 * Misi lain terbuka jika ia misi pertama, sudah pernah diselesaikan, atau misi non-boss sebelumnya (menurut
 * `order`) sudah selesai — boss tidak mengunci tier berikutnya.
 */
export function isMissionUnlocked(missions: Mission[], progress: UserProgress, missionId: string): boolean {
  const sorted = [...missions].sort((a, b) => a.order - b.order);
  const mission = sorted.find((m) => m.id === missionId);
  if (!mission) return false;
  if (mission.kind === 'concept') return true;
  if (getMissionProgress(progress, missionId).completed) return true;
  if (isBossMission(mission)) {
    return sorted.every((m) => m.tier !== mission.tier || m.id === mission.id || getMissionProgress(progress, m.id).completed);
  }

  const chain = sorted.filter((m) => !isBossMission(m));
  const index = chain.findIndex((m) => m.id === missionId);
  if (index === 0) return true;
  const previous = chain[index - 1];
  return previous ? getMissionProgress(progress, previous.id).completed : false;
}

export function getCompletedCount(progress: UserProgress): number {
  return Object.values(progress.missions).filter((mp) => mp.completed).length;
}
