import { useEffect, useRef, useState } from 'react';
import { animate, useMotionValue, useMotionValueEvent } from 'framer-motion';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface TypewriterOptions {
  /** false = belum mulai (teks kosong). Biasanya diisi "sudah terlihat". */
  active?: boolean;
  /** Milidetik per karakter (bawaan 26). */
  speed?: number;
  /** Jeda sebelum mulai, milidetik. */
  startDelay?: number;
  /** Ubah nilainya untuk mengetik ulang teks yang sama. */
  replayKey?: number | string;
  /** Dipanggil sekali tiap kali pengetikan selesai. */
  onDone?: () => void;
}

export interface TypewriterState {
  /** Bagian teks yang sudah "diketik". */
  shown: string;
  done: boolean;
}

/**
 * Efek mengetik: mengembalikan potongan `text` yang bertambah seiring waktu. Mengetik ulang bila `text` atau
 * `replayKey` berubah. Bila pengguna meminta gerak dikurangi, seluruh teks langsung tampil.
 */
export function useTypewriter(text: string, options: TypewriterOptions = {}): TypewriterState {
  const { active = true, speed = 26, startDelay = 0, replayKey, onDone } = options;
  const reduced = usePrefersReducedMotion();
  const progress = useMotionValue(0);
  const [count, setCount] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useMotionValueEvent(progress, 'change', (latest) => setCount(Math.round(latest)));

  useEffect(() => {
    if (reduced) {
      progress.set(text.length);
      setCount(text.length);
      if (active) onDoneRef.current?.();
      return undefined;
    }
    progress.set(0);
    setCount(0);
    if (!active) return undefined;
    const controls = animate(progress, text.length, {
      duration: (text.length * speed) / 1000,
      delay: startDelay / 1000,
      ease: 'linear',
      onComplete: () => onDoneRef.current?.(),
    });
    return () => controls.stop();
  }, [text, active, speed, startDelay, replayKey, reduced, progress]);

  const length = Math.min(count, text.length);
  return { shown: text.slice(0, length), done: length >= text.length };
}
