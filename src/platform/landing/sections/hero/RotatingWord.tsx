import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { useMotionPaused, useSystemReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { cn } from '../../lib/cn';

export interface RotatingWordProps {
  words: readonly string[];
  /** Jeda pergantian (ms). */
  intervalMs: number;
  /** Tinggi baris & ukuran huruf (barisnya bertinggi tetap supaya judul tidak melompat). */
  className?: string;
}

/**
 * Satu kata, dikecilkan (transform scale) hanya bila lebih lebar dari barisnya — "window function" di layar ponsel —
 * supaya kata pendek tetap sebesar baris judul lainnya dan tidak pernah ada yang terpotong atau turun baris.
 */
function FitWord({ word, frame }: { word: string; frame: RefObject<HTMLElement> }): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = frame.current;
    const inner = ref.current;
    if (!outer || !inner) return undefined;
    const fit = () => {
      const natural = inner.offsetWidth; // tidak terpengaruh transform
      setScale(natural > 0 ? Math.min(1, outer.clientWidth / natural) : 1);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    observer.observe(inner); // font display selesai dimuat → lebar berubah
    return () => observer.disconnect();
  }, [frame, word]);

  return (
    <span ref={ref} className="inline-block origin-center whitespace-nowrap" style={scale < 1 ? { transform: `scale(${scale.toFixed(4)})` } : undefined}>
      {word}
    </span>
  );
}

/**
 * Kata yang berganti di judul hero: keluar ke atas, masuk dari bawah (hanya transform & opacity). Selalu aria-hidden —
 * pembaca layar mendapat kalimat utuh dari aria-label judulnya. Diam di kata pertama bila sistem meminta gerak
 * dikurangi; berhenti berganti (di kata yang sedang tampil) saat pengguna menekan "Jeda animasi", saat hero di luar
 * layar, atau saat tab disembunyikan.
 */
export function RotatingWord({ words, intervalMs, className }: RotatingWordProps): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref);
  const reduced = useSystemReducedMotion();
  const paused = useMotionPaused();
  const [index, setIndex] = useState(0);
  const count = words.length;

  useEffect(() => {
    if (reduced) {
      setIndex(0);
      return undefined;
    }
    if (paused || !inView || count < 2) return undefined;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [reduced, paused, inView, count, intervalMs]);

  const word = words[index] ?? words[0] ?? '';

  return (
    <span ref={ref} aria-hidden data-rotating={reduced || paused ? 'paused' : 'running'} className={cn('relative block', className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={word}
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, y: '0.45em' }}
          animate={{ opacity: 1, y: '0em' }}
          exit={{ opacity: 0, y: '-0.45em' }}
          transition={{ duration: 0.26, ease: 'easeOut' }}
        >
          <FitWord word={word} frame={ref} />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
