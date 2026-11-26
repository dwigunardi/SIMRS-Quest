import { useEffect, useRef, type RefObject } from 'react';
import { animate, useInView, useMotionValue } from 'framer-motion';
import { formatNumber } from '../lib/content';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface CountUpOptions {
  /** Angka awal (bawaan 0). */
  from?: number;
  /** Lama hitungan dalam detik (bawaan 1,2). */
  duration?: number;
  /** Jeda sebelum mulai, detik. */
  delay?: number;
  /** Pemformat angka (bawaan: pemisah ribuan Indonesia). */
  format?: (value: number) => string;
}

/**
 * Angka hitung-naik. Pasang ref yang dikembalikan pada elemen teks (mis. <span>): begitu elemen terlihat, isinya
 * dihitung dari `from` ke `target` (useMotionValue + animate) dengan menulis textContent langsung, tanpa render ulang
 * React tiap frame. Bila pengguna meminta gerak dikurangi, angka akhir langsung tampil.
 *
 * Elemennya sebaiknya aria-hidden dan didampingi teks sr-only berisi angka akhir. Komponen <CountUp> (ui/CountUp.tsx)
 * sudah mengurus itu.
 */
export function useCountUp<T extends HTMLElement = HTMLSpanElement>(target: number, options: CountUpOptions = {}): RefObject<T> {
  const { from = 0, duration = 1.2, delay = 0, format = formatNumber } = options;
  const ref = useRef<T>(null);
  // Hanya tepi BAWAH yang dipersempit: margin '-40px' di keempat sisi membuat angka di gutter kiri ponsel (x < 40 px)
  // tidak pernah dianggap terlihat, sehingga tertahan di angka awal.
  const inView = useInView(ref, { once: true, margin: '0px 0px -40px 0px' });
  const reduced = usePrefersReducedMotion();
  const value = useMotionValue(from);
  // Pemformat biasanya fungsi inline; disimpan di ref supaya tidak mengulang animasi tiap render.
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    const write = (current: number) => {
      if (ref.current) ref.current.textContent = formatRef.current(Math.round(current));
    };
    if (reduced) {
      value.set(target);
      write(target);
      return undefined;
    }
    write(value.get());
    if (!inView) return undefined;
    const stopListening = value.on('change', write);
    const controls = animate(value, target, { duration, delay, ease: 'easeOut' });
    return () => {
      controls.stop();
      stopListening();
    };
  }, [inView, reduced, target, duration, delay, value]);

  return ref;
}
