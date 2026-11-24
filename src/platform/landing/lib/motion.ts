/**
 * Preset animasi landing (framer-motion). Satu sumber supaya semua section bergerak dengan irama yang sama.
 * Hanya transform & opacity yang dianimasikan. <MotionConfig reducedMotion="user"> (di LandingRoot) mematikan animasi
 * transform bagi pengguna yang meminta gerak dikurangi; animasi tak berujung harus dihentikan sendiri
 * (lihat hooks/usePrefersReducedMotion).
 */
import type { Transition, Variants } from 'framer-motion';

/** Pegas baku: perpindahan indikator tab, tombol, kartu. */
export const spring = { type: 'spring', stiffness: 260, damping: 24 } as const satisfies Transition;

/** Ease-out 0,35 dtk: muncul/hilang sederhana. */
export const easeOut = { duration: 0.35, ease: 'easeOut' } as const satisfies Transition;

/** Crossfade 200 ms untuk pergantian isi (AnimatePresence mode="wait"). */
export const crossfade = { duration: 0.2, ease: 'easeOut' } as const satisfies Transition;

/** Muncul dari bawah: opacity 0→1, y 24→0. Pakai dengan initial="hidden" + whileInView/animate="show". */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: spring },
};

/** Hanya memudar (untuk isi yang tidak boleh bergeser, mis. di dalam mockup). */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: easeOut },
};

/** Induk yang memunculkan anak-anaknya (ber-variants fadeUp/fadeIn) bergiliran tiap 0,08 dtk. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

/** Viewport untuk whileInView: sekali saja, dipicu 80px setelah masuk layar. */
export const viewportOnce = { once: true, margin: '-80px' } as const;

/** Props crossfade siap pakai untuk anak AnimatePresence mode="wait". */
export const crossfadeProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: crossfade,
} as const;
