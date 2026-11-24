import { prefersReducedMotion } from '../lib/scroll';

export interface ConfettiOptions {
  /** Titik asal: elemen (tengahnya dipakai) atau koordinat layar 0..1. Bawaan: tengah, sedikit di bawah. */
  origin?: Element | { x: number; y: number };
  /** Banyaknya serpihan (bawaan 60: "confetti kecil"). */
  particleCount?: number;
  /** Sebaran dalam derajat (bawaan 70). */
  spread?: number;
}

/** Fungsi reset pustaka, diisi setelah impor pertama (dipakai stopConfetti). */
let resetConfetti: (() => void) | null = null;

/**
 * Hentikan dan buang confetti yang masih melayang. canvas-confetti menaruh <canvas> fixed langsung di <body>, jadi
 * tanpa ini serpihannya masih tampil beberapa detik di layar berikutnya. Aman dipanggil kapan pun.
 */
export function stopConfetti(): void {
  try {
    resetConfetti?.();
  } catch {
    /* hiasan saja */
  }
}

/** Warna palet SIMRS Quest: hijau, teal, amber, coral, putih. */
const COLORS = ['#00875A', '#14B8A6', '#F5A623', '#E5484D', '#22C55E', '#FFFFFF'];

function resolveOrigin(origin: ConfettiOptions['origin']): { x: number; y: number } {
  if (origin === undefined) return { x: 0.5, y: 0.6 };
  if (!(origin instanceof Element)) return origin;
  const rect = origin.getBoundingClientRect();
  return {
    x: (rect.left + rect.width / 2) / Math.max(1, window.innerWidth),
    y: (rect.top + rect.height / 2) / Math.max(1, window.innerHeight),
  };
}

/**
 * Letupan confetti kecil (canvas-confetti, dimuat malas saat pertama dipakai). Tidak melakukan apa-apa bila pengguna
 * meminta gerak dikurangi. Tidak pernah melempar: gagal memuat pustakanya hanya berarti tanpa confetti.
 */
export async function fireConfetti(options: ConfettiOptions = {}): Promise<void> {
  if (typeof window === 'undefined' || prefersReducedMotion()) return;
  try {
    const { default: confetti } = await import('canvas-confetti');
    resetConfetti = () => confetti.reset();
    await confetti({
      particleCount: options.particleCount ?? 60,
      spread: options.spread ?? 70,
      startVelocity: 30,
      gravity: 1.1,
      ticks: 140,
      scalar: 0.9,
      origin: resolveOrigin(options.origin),
      colors: COLORS,
      disableForReducedMotion: true,
      zIndex: 70,
    });
  } catch {
    /* hiasan saja */
  }
}
