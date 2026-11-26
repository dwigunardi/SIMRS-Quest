import type { SectionId } from './content';
import type { PageSectionId } from './pagesContent';

/** true bila pengguna meminta gerak dikurangi (dibaca saat dipanggil; untuk hook reaktif pakai usePrefersReducedMotion). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Gulir ke sebuah section landing lalu pindahkan fokus ke sana (untuk pembaca layar & keyboard).
 * Dipakai sebagai pengganti href="#id": router aplikasi berbasis hash, jadi "#faq" akan dianggap rute.
 * Mengembalikan false bila elemennya tidak ada (mis. section bawah belum selesai dimuat malas).
 * Untuk Beranda pakai SECTION_IDS (lib/content.ts); untuk katalog & landing jalur COURSE_SECTION_IDS /
 * CATALOG_SECTION_IDS (lib/pagesContent.ts).
 */
export function scrollToSection(id: SectionId | PageSectionId): boolean {
  const target = document.getElementById(id);
  if (!target) return false;
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  return true;
}
