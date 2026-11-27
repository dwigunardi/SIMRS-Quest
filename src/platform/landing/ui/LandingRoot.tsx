import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { useMotionPaused } from '../hooks/usePrefersReducedMotion';
import { useLandingDocument } from '../hooks/useTheme';
import { stopConfetti } from '../illustrations/confetti';
import { cn } from '../lib/cn';
import '../styles/landing.css';

export interface LandingRootProps {
  children: ReactNode;
  className?: string;
  /** Untuk uji E2E. */
  'data-testid'?: string;
  'data-ready'?: 'true' | 'false';
  /** Halaman landing: 'catalog' | 'course' | 'not-found' (layout/PageLayout.tsx). */
  'data-page'?: string;
  /** Halaman landing jalur: id jalurnya. */
  'data-course'?: string;
}

/**
 * Pembungkus SELURUH landing. Selama ter-mount ia:
 * - memasang data-q-landing pada <html> (latar <body>, font, garis fokus; menahan palet terang layar jalur) dan
 *   melepasnya saat di-unmount — jadi layar jalur kembali ke palet jalur. data-theme (tema bersama seluruh aplikasi,
 *   src/platform/theme.ts) TETAP terpasang;
 * - membungkus isi dengan <MotionConfig reducedMotion="user"> (animasi transform mati bila pengguna memintanya);
 * - memasang data-q-motion="paused" pada <html> selama pengguna menekan "Jeda animasi" (mematikan animasi CSS
 *   berulang berkelas q-loop);
 * - saat di-unmount menghentikan confetti yang masih melayang (kanvasnya menempel di <body>, di luar pohon ini —
 *   tanpa ini serpihannya ikut tampil di atas layar jalur).
 * Semua komponen landing harus berada di dalamnya; token q-* tidak punya nilai di luar sini.
 */
export function LandingRoot({ children, className, ...rest }: LandingRootProps): JSX.Element {
  useLandingDocument();
  const paused = useMotionPaused();
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (paused) root.setAttribute('data-q-motion', 'paused');
    else root.removeAttribute('data-q-motion');
    return () => root.removeAttribute('data-q-motion');
  }, [paused]);
  useEffect(() => stopConfetti, []);
  return (
    <MotionConfig reducedMotion="user">
      <div className={cn('relative min-h-screen overflow-x-clip bg-q-bg font-q-body text-base text-q-ink antialiased', className)} {...rest}>
        {children}
      </div>
    </MotionConfig>
  );
}
