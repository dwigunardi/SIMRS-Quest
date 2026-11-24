/**
 * Aturan "lanjut dari mana" (fungsi murni). Dipakai App saat memilih misi awal DAN ringkasan Beranda
 * (src/tracks/sql/glance.ts), supaya kartu "Lanjutkan" selalu menunjuk misi yang memang akan dibuka aplikasi.
 */
import { getMissionProgress, isMissionUnlocked } from './progress';
import type { Mission, UserProgress } from '../types';

/** Misi pertama menurut `order`. Melempar bila daftar misi kosong (kurikulum tidak boleh kosong). */
export function requireFirstMission(missions: readonly Mission[]): Mission {
  const first = [...missions].sort((a, b) => a.order - b.order)[0];
  if (!first) throw new Error('Data misi kosong: MISSIONS harus berisi minimal satu misi.');
  return first;
}

/**
 * Misi terbuka pertama (menurut order) yang belum selesai, selain `excludeId`; misi non-konsep didahulukan.
 * undefined berarti semua misi sudah selesai (misi terkunci selalu didahului misi terbuka yang belum selesai).
 */
export function findPendingMission(missions: readonly Mission[], progress: UserProgress, excludeId?: string): Mission | undefined {
  const all = [...missions];
  const sorted = [...all].sort((a, b) => a.order - b.order);
  const isPending = (m: Mission) =>
    m.id !== excludeId && !getMissionProgress(progress, m.id).completed && isMissionUnlocked(all, progress, m.id);
  return sorted.find((m) => m.kind !== 'concept' && isPending(m)) ?? sorted.find(isPending);
}

/**
 * Misi awal: lastMissionId (jika masih terbuka) → misi terbuka pertama yang belum selesai → misi pertama.
 * Kartu konsep selalu terbuka, jadi diabaikan saat mencari misi "berikutnya" agar user tidak
 * dilempar ke Tier 8 hanya karena kartunya belum dibaca.
 */
export function pickInitialMissionId(missions: readonly Mission[], progress: UserProgress): string {
  const all = [...missions];
  const last = progress.lastMissionId;
  if (last && all.some((m) => m.id === last) && isMissionUnlocked(all, progress, last)) return last;
  return findPendingMission(all, progress)?.id ?? requireFirstMission(all).id;
}
