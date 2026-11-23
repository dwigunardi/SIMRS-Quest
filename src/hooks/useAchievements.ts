/**
 * Lencana: dievaluasi dari data yang ada setiap render (murah), lalu lencana yang BARU diraih diumumkan sekali lewat
 * toast. Daftar yang sudah diumumkan disimpan di localStorage; saat pertama kali (kunci belum ada) semua lencana yang
 * sudah diraih dicatat diam-diam agar pengguna lama tidak dibanjiri notifikasi.
 */
import { useEffect, useRef, useState } from 'react';
import { ACHIEVEMENTS_SEEN_KEY, evaluateAchievements, parseSeen, type AchievementContext, type EvaluatedAchievement } from '../lib/achievements';

function readSeen(): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(ACHIEVEMENTS_SEEN_KEY);
    return raw === null ? null : parseSeen(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveSeen(seen: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(ACHIEVEMENTS_SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* penyimpanan penuh / tidak tersedia */
  }
}

export interface AchievementsApi {
  list: EvaluatedAchievement[];
  earnedCount: number;
  /** Lencana baru yang sedang diumumkan (toast). */
  toasts: EvaluatedAchievement[];
  dismiss: (id: string) => void;
  reset: () => void;
}

const TOAST_MS = 7000;

export function useAchievements(ctx: AchievementContext, ready: boolean): AchievementsApi {
  const list = evaluateAchievements(ctx);
  const earnedIds = list.filter((a) => a.status.earned).map((a) => a.id);
  const earnedKey = earnedIds.join('|');
  const seenRef = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<EvaluatedAchievement[]>([]);
  const listRef = useRef(list);
  listRef.current = list;

  useEffect(() => {
    if (!ready) return;
    if (seenRef.current === null) {
      const stored = readSeen();
      if (stored === null) {
        // Pertama kali: catat lencana yang sudah diraih tanpa mengumumkannya.
        seenRef.current = new Set(earnedKey ? earnedKey.split('|') : []);
        saveSeen(seenRef.current);
        return;
      }
      seenRef.current = stored;
    }
    const seen = seenRef.current;
    const fresh = listRef.current.filter((a) => a.status.earned && !seen.has(a.id));
    if (fresh.length === 0) return;
    for (const a of fresh) seen.add(a.id);
    saveSeen(seen);
    setToasts((prev) => [...prev, ...fresh.filter((a) => !prev.some((p) => p.id === a.id))]);
  }, [earnedKey, ready]);

  useEffect(() => {
    if (toasts.length === 0) return undefined;
    const timer = window.setTimeout(() => setToasts((prev) => prev.slice(1)), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  return {
    list,
    earnedCount: earnedIds.length,
    toasts,
    dismiss: (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    reset: () => {
      seenRef.current = new Set();
      saveSeen(seenRef.current);
      setToasts([]);
    },
  };
}
