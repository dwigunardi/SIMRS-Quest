import { useSyncExternalStore, type RefObject } from 'react';
import { useInView } from 'framer-motion';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribeSystem(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function systemSnapshot(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

/* ---- Jeda dari pengguna (tombol "Jeda animasi" di navbar) ---- */

const pauseListeners = new Set<() => void>();
/** Berlaku selama halaman terbuka (tidak disimpan): pengaturan permanen adalah milik sistem operasi. */
let paused = false;

function subscribePause(listener: () => void): () => void {
  pauseListeners.add(listener);
  return () => pauseListeners.delete(listener);
}

function pauseSnapshot(): boolean {
  return paused;
}

/** Hentikan / jalankan lagi semua animasi tak berujung di landing. */
export function setMotionPaused(next: boolean): void {
  if (next === paused) return;
  paused = next;
  for (const listener of pauseListeners) listener();
}

/** true bila pengguna menekan "Jeda animasi". */
export function useMotionPaused(): boolean {
  return useSyncExternalStore(subscribePause, pauseSnapshot, () => false);
}

/** true bila SISTEM meminta gerak dikurangi; ikut berubah saat pengaturan sistem diganti. */
export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribeSystem, systemSnapshot, () => false);
}

/**
 * true bila gerak harus dikurangi: diminta sistem, ATAU dijeda pengguna lewat tombol di navbar (WCAG 2.2.2).
 * Pakai untuk MENGHENTIKAN animasi tak berujung (marquee, melayang, bola dunia berayun, kedipan maskot) dan efek
 * mengetik. Animasi sekali jalan cukup mengandalkan <MotionConfig reducedMotion="user"> di LandingRoot.
 */
export function usePrefersReducedMotion(): boolean {
  const system = useSystemReducedMotion();
  const byUser = useMotionPaused();
  return system || byUser;
}

/**
 * Bolehkah animasi TAK BERUJUNG pada elemen `ref` berjalan sekarang? Hanya bila gerak tidak dikurangi/dijeda DAN
 * elemennya ada di (dekat) layar — animasi berulang di luar layar membuat halaman tidak pernah diam (boros baterai).
 * Elemen display:none tidak pernah "terlihat", jadi salinan tersembunyi ikut diam.
 */
export function useLoopMotion(ref: RefObject<Element>, enabled = true): boolean {
  const reduced = usePrefersReducedMotion();
  const inView = useInView(ref, { margin: '120px' });
  return enabled && !reduced && inView;
}
