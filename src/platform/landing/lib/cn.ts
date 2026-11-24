import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge perlu diberi tahu kelas buatan landing, kalau tidak `text-q-h2` (ukuran) dan `text-q-ink` (warna)
 * dianggap satu kelompok dan saling menghapus.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['q-hero', 'q-hero-lg', 'q-h2', 'q-h2-sm', 'q-h3'] }],
      'font-family': [{ font: ['q-body', 'q-display'] }],
      rounded: [{ rounded: ['q', 'q-lg', 'q-pill'] }],
      shadow: [{ shadow: ['q-float', 'q-pop'] }],
    },
  },
});

/** Gabungkan nama kelas (clsx) lalu selesaikan bentrokan utilitas Tailwind (kelas terakhir menang). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
