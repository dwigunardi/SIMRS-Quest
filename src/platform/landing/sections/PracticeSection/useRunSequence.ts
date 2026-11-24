import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

/**
 * idle → running (pemintal) → rows (baris hasil muncul bergiliran) → done (penilaian tampil).
 * Ini urutan TAMPILAN mockup; tidak ada SQL yang dijalankan di landing.
 */
export type RunPhase = 'idle' | 'running' | 'rows' | 'done';

/** Lama "menjalankan" (ms). */
const RUN_MS = 650;
/** Jeda antarbaris — sama dengan stagger landing (0,08 dtk). */
const ROW_MS = 80;
/** Napas setelah baris terakhir sebelum penilaian muncul. */
const SETTLE_MS = 360;

export interface RunSequence {
  phase: RunPhase;
  /** Mainkan urutannya sekali. `rowCount` = banyak baris hasil; `onDone` dipanggil sekali saat penilaian muncul. */
  run: (rowCount: number, onDone?: () => void) => void;
  reset: () => void;
}

/** Urutan "Run & Check" tiruan. Dengan reduced motion langsung ke hasil akhir. */
export function useRunSequence(): RunSequence {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<RunPhase>('idle');
  const timers = useRef<number[]>([]);

  const clear = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  useEffect(() => clear, [clear]);

  const run = useCallback(
    (rowCount: number, onDone?: () => void) => {
      clear();
      if (reduced) {
        setPhase('done');
        onDone?.();
        return;
      }
      setPhase('running');
      timers.current.push(window.setTimeout(() => setPhase('rows'), RUN_MS));
      timers.current.push(
        window.setTimeout(
          () => {
            setPhase('done');
            onDone?.();
          },
          RUN_MS + rowCount * ROW_MS + SETTLE_MS,
        ),
      );
    },
    [clear, reduced],
  );

  const reset = useCallback(() => {
    clear();
    setPhase('idle');
  }, [clear]);

  return { phase, run, reset };
}
