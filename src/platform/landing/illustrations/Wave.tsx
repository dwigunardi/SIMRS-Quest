import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useLoopMotion } from '../hooks/usePrefersReducedMotion';
import { cn } from '../lib/cn';

export interface WaveProps {
  /** Atur tinggi & warna di sini; warna mengikuti warna teks (bawaan text-q-brand, tinggi 72px). */
  className?: string;
  /** Balik atas-bawah (gelombang menggantung dari atas). */
  flip?: boolean;
  /** Dua lapis gelombang bergeser pelan ke kiri-kanan. Berhenti saat reduced motion / dijeda dan selama di luar layar. */
  animated?: boolean;
}

/**
 * Gelombang SVG selebar wadah (hiasan): lapis belakang transparan + lapis depan penuh, terisi sampai tepi bawah.
 * Letakkan di tepi bawah sebuah section; isi di bawahnya memakai warna yang sama dengan gelombang.
 */
export function Wave({ className, flip = false, animated = false }: WaveProps): JSX.Element {
  const ref = useRef<SVGSVGElement>(null);
  const drift = useLoopMotion(ref, animated);
  return (
    <svg
      ref={ref}
      aria-hidden
      focusable="false"
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      className={cn('pointer-events-none -mb-px block h-[72px] w-full overflow-hidden text-q-brand', flip ? 'rotate-180' : '', className)}
    >
      {/* Jalur dibuat lebih lebar dari bingkai (-120..1560) supaya tepinya tidak terlihat saat bergeser. */}
      <motion.path
        fill="currentColor"
        opacity={0.35}
        d="M-120 62 C 60 14, 280 14, 480 54 S 860 112, 1060 62 S 1340 20, 1560 58 V120 H-120 Z"
        // Diam = nilai eksplisit + durasi 0 (animate={undefined} akan terus berulang dengan transition lama).
        animate={drift ? { x: [0, 60, 0] } : { x: 0 }}
        transition={drift ? { duration: 14, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
      />
      <motion.path
        fill="currentColor"
        d="M-120 86 C 80 46, 340 110, 580 80 S 980 36, 1180 76 S 1420 104, 1560 82 V120 H-120 Z"
        animate={drift ? { x: [0, -60, 0] } : { x: 0 }}
        transition={drift ? { duration: 11, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
      />
    </svg>
  );
}
