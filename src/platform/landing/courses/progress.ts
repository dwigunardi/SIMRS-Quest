/**
 * Progres pengguna untuk halaman landing jalur: misi yang sudah selesai (centang di silabus, pill "n dari 72"),
 * status tiap Boss (baris "Taklukkan Boss"), dan streak (baris "Bangun streak-mu").
 *
 * HANYA MEMBACA localStorage lewat parser yang sama dengan aplikasi (parseProgress di src/lib/progress.ts): tidak
 * pernah menulis (termasuk karantina — itu tugas pemuat di dalam jalur dan penjaga di Beranda) dan tidak melempar.
 * Nilai yang tidak terbaca diperlakukan seperti belum ada progres.
 *
 * Modul ini mengimpor data misi: hanya untuk halaman yang dimuat malas (pages/**).
 */
import { useCallback, useEffect, useState } from 'react';
import { MISSIONS } from '../../../data/missions';
import { isBoss } from '../../../lib/boss';
import { createEmptyProgress, getActiveStreak, isMissionUnlocked, parseProgress, toLocalDateKey } from '../../../lib/progress';
import { browserStorage } from '../../../lib/storageGuard';
import { PROGRESS_KEY } from '../../../lib/storageKeys';
import type { UserProgress } from '../../../types';

export type BossState = 'done' | 'open' | 'locked';

export interface CourseProgress {
  /** Ada progres jalur ini di browser (minimal satu percobaan atau XP > 0). */
  started: boolean;
  /** id misi yang sudah selesai. */
  completedIds: ReadonlySet<string>;
  completed: number;
  /** Jumlah misi jalur (0 untuk jalur yang belum punya misi). */
  total: number;
  /** Status Boss per id misi: selesai / terbuka / terkunci — aturan yang sama dengan aplikasi (isMissionUnlocked). */
  bossStates: Readonly<Record<string, BossState>>;
  streak: {
    /** Streak yang masih hidup (0 bila sudah putus). */
    active: number;
    best: number;
    /** Hari ini sudah dihitung aktif. */
    activeToday: boolean;
    /** Tanggal lokal terakhir aktif (YYYY-MM-DD) atau null. */
    lastActiveDate: string | null;
  };
}

const NO_IDS: ReadonlySet<string> = new Set<string>();

/** Progres kosong (pengguna baru, jalur 'segera', storage diblokir/rusak). */
export function emptyCourseProgress(total = 0, bossStates: Readonly<Record<string, BossState>> = {}): CourseProgress {
  return { started: false, completedIds: NO_IDS, completed: 0, total, bossStates, streak: { active: 0, best: 0, activeToday: false, lastActiveDate: null } };
}

function readProgress(storage: Pick<Storage, 'getItem'> | null): UserProgress | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    return raw === null ? null : parseProgress(JSON.parse(raw));
  } catch {
    return null;
  }
}

function sqlProgress(progress: UserProgress, now: Date): CourseProgress {
  const completedIds = new Set(Object.entries(progress.missions).filter(([, mp]) => mp.completed).map(([id]) => id));
  const bossStates: Record<string, BossState> = {};
  for (const boss of MISSIONS.filter(isBoss)) {
    bossStates[boss.id] = completedIds.has(boss.id) ? 'done' : isMissionUnlocked(MISSIONS, progress, boss.id) ? 'open' : 'locked';
  }
  return {
    started: Object.keys(progress.missions).length > 0 || progress.xp > 0,
    completedIds,
    // Hanya misi yang masih ada di kurikulum (id lama dari cadangan tidak dihitung).
    completed: MISSIONS.filter((m) => completedIds.has(m.id)).length,
    total: MISSIONS.length,
    bossStates,
    streak: {
      active: getActiveStreak(progress.streak, now),
      best: progress.streak.best,
      activeToday: progress.streak.lastActiveDate === toLocalDateKey(now),
      lastActiveDate: progress.streak.lastActiveDate,
    },
  };
}

/**
 * Progres jalur `courseId` dari `storage`. Saat ini hanya jalur 'sql' yang punya progres; jalur lain selalu kosong.
 * Fungsi murni: tidak menulis, tidak melempar, aman dijalankan di Node (scripts/verify/courses.ts).
 */
export function readCourseProgress(courseId: string, storage: Pick<Storage, 'getItem'> | null, now: Date): CourseProgress {
  if (courseId !== 'sql') return emptyCourseProgress();
  try {
    return sqlProgress(readProgress(storage) ?? createEmptyProgress(), now);
  } catch {
    return sqlProgress(createEmptyProgress(), now);
  }
}

function sameRecord(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/** Dua pembacaan progres sama isinya (dipakai supaya halaman tidak dirender ulang bila tidak ada yang berubah). */
export function sameCourseProgress(a: CourseProgress, b: CourseProgress): boolean {
  return (
    a.started === b.started &&
    a.completed === b.completed &&
    a.total === b.total &&
    a.completedIds.size === b.completedIds.size &&
    [...a.completedIds].every((id) => b.completedIds.has(id)) &&
    sameRecord(a.bossStates, b.bossStates) &&
    a.streak.active === b.streak.active &&
    a.streak.best === b.streak.best &&
    a.streak.activeToday === b.streak.activeToday &&
    a.streak.lastActiveDate === b.streak.lastActiveDate
  );
}

/**
 * Hook: progres jalur `courseId` di browser ini. Dibaca saat pertama tampil, saat tab lain mengubah KUNCI PROGRES
 * (bukan sembarang kunci — tema atau sesi ujian tab lain tidak relevan), dan saat tab ini kembali terlihat (mis.
 * pengguna menyelesaikan misi di tab lain). Objek lama dipertahankan bila isinya sama, jadi halaman hanya dirender ulang
 * bila progresnya benar-benar berubah. Hanya membaca.
 */
export function useCourseProgress(courseId: string): CourseProgress {
  const read = useCallback(() => readCourseProgress(courseId, browserStorage(), new Date()), [courseId]);
  const [progress, setProgress] = useState<CourseProgress>(read);

  useEffect(() => {
    const refresh = () => {
      const next = read();
      setProgress((prev) => (sameCourseProgress(prev, next) ? prev : next));
    };
    // Pembacaan pertama terjadi saat render; yang ini menangkap perubahan di antara render dan efek (atau id berganti).
    refresh();
    const onStorage = (event: StorageEvent) => {
      // key null = storage dikosongkan (localStorage.clear di tab lain): progres mungkin hilang.
      if (event.key === null || event.key === PROGRESS_KEY) refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [read]);

  return progress;
}
