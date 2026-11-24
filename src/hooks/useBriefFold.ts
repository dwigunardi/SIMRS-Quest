import { useCallback, useState } from 'react';
import { BRIEF_FOLD_KEY } from '../lib/storageKeys';

/**
 * Pilihan lipat/buka Skenario & Tugas, diingat di browser (berlaku untuk semua misi).
 * Default: Skenario dilipat (pratinjau beberapa baris), Tugas terbuka penuh.
 * localStorage bisa tidak tersedia (mode privat, diblokir) — selalu jatuh ke default.
 */
const STORAGE_KEY = BRIEF_FOLD_KEY;

export interface BriefFold {
  storyExpanded: boolean;
  taskExpanded: boolean;
}

const DEFAULT_FOLD: BriefFold = { storyExpanded: false, taskExpanded: true };

/** Baca pilihan lipatan dari teks JSON tersimpan; yang tidak ada / tidak terbaca jatuh ke default. */
export function parseBriefFold(raw: string | null): BriefFold {
  try {
    if (!raw) return DEFAULT_FOLD;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_FOLD;
    const story = 'storyExpanded' in parsed ? parsed.storyExpanded : undefined;
    const task = 'taskExpanded' in parsed ? parsed.taskExpanded : undefined;
    return {
      storyExpanded: typeof story === 'boolean' ? story : DEFAULT_FOLD.storyExpanded,
      taskExpanded: typeof task === 'boolean' ? task : DEFAULT_FOLD.taskExpanded,
    };
  } catch {
    return DEFAULT_FOLD;
  }
}

function readFold(): BriefFold {
  try {
    return parseBriefFold(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_FOLD;
  }
}

function writeFold(fold: BriefFold): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fold));
  } catch {
    /* penyimpanan tidak tersedia — pilihan hanya berlaku di sesi ini */
  }
}

export function useBriefFold(): BriefFold & { setStoryExpanded: (v: boolean) => void; setTaskExpanded: (v: boolean) => void } {
  const [fold, setFold] = useState<BriefFold>(readFold);

  const update = useCallback((patch: Partial<BriefFold>) => {
    setFold((prev) => {
      const next = { ...prev, ...patch };
      writeFold(next);
      return next;
    });
  }, []);

  const setStoryExpanded = useCallback((v: boolean) => update({ storyExpanded: v }), [update]);
  const setTaskExpanded = useCallback((v: boolean) => update({ taskExpanded: v }), [update]);
  return { ...fold, setStoryExpanded, setTaskExpanded };
}
