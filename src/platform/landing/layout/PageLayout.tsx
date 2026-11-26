/**
 * Kerangka bersama halaman katalog ('#/landing'), landing jalur ('#/landing/<id>'), dan 404 jalur:
 * LandingRoot (tema terang/gelap yang sama dengan Beranda, MotionConfig reducedMotion="user", jeda animasi) +
 * Navbar + <main> yang memudar masuk 150 ms + Footer.
 *
 *   export default function CatalogPage(): JSX.Element {
 *     usePageMeta({ ... });
 *     return (
 *       <PageLayout current={{ page: 'catalog' }}>
 *         <CatalogHero /> …
 *       </PageLayout>
 *     );
 *   }
 *
 * Status pengguna (tombol "Mulai belajar" / "Lanjutkan") dibaca dari usePageStatus() — penyedianya dipasang
 * pages/LandingPages.tsx untuk semua halaman landing. Halaman sendiri juga boleh memanggil usePageStatus() (hero, CTA).
 *
 * Gulir ke atas saat berpindah halaman diurus pages/LandingPages.tsx (setiap rute di-mount ulang dengan key-nya sendiri).
 *
 * Penanda uji E2E: [data-testid="landing-page"][data-page="catalog|course|not-found"][data-course="<id>"]
 * dengan data-ready="true" setelah ringkasan progres siap.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { routeChanges } from '../../router';
import { PAGE_UI } from '../lib/pagesContent';
import { Footer } from '../sections/Footer';
import { Navbar, type NavCurrent } from '../sections/Navbar';
import { LandingRoot } from '../ui/LandingRoot';
import { usePageStatus } from './pageStatus';

/** Halaman landing yang sedang dibuka. */
export type PageCurrent = { page: 'catalog' } | { page: 'course'; id: string } | { page: 'not-found' };

export interface PageLayoutProps {
  current: PageCurrent;
  children: ReactNode;
  /**
   * Halaman punya section FAQ ber-id 'faq' (COURSE_SECTION_IDS.faq / CATALOG_SECTION_IDS.faq), jadi tautan
   * "Pertanyaan yang sering muncul" di footer ditampilkan. Bawaan true; 404 memakai false.
   */
  faqLink?: boolean;
}

/** Pudar masuk saat halaman berganti (hanya opacity, jadi tetap berlaku saat gerak dikurangi). */
const PAGE_FADE = { duration: 0.15, ease: 'easeOut' } as const;

function navCurrentOf(current: PageCurrent): NavCurrent {
  return current.page === 'not-found' ? { page: 'other' } : current;
}

/**
 * Fokus ke judul halaman (h1 di dalam <main>), tanpa menggulir. Dipakai setelah pindah halaman di dalam aplikasi —
 * tautan yang baru diklik ikut hilang bersama halaman lama, jadi tanpa ini fokus jatuh ke <body> dan pembaca layar
 * tidak mengumumkan apa pun — dan oleh tombol "Lewati ke isi utama".
 */
function focusHeading(main: HTMLElement | null): void {
  const target = main?.querySelector<HTMLElement>('h1') ?? main;
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

export function PageLayout({ current, children, faqLink = true }: PageLayoutProps): JSX.Element {
  const status = usePageStatus();
  const navCurrent = navCurrentOf(current);
  const mainRef = useRef<HTMLElement>(null);

  // Halaman ini dibuka lewat navigasi di dalam aplikasi (bukan tujuan pemuatan dokumen): umumkan dengan memindahkan
  // fokus ke judulnya. Pemuatan pertama dibiarkan (pembaca layar sudah membacakan dokumen baru).
  useEffect(() => {
    if (routeChanges() > 0) focusHeading(mainRef.current);
  }, []);

  const skip = () => {
    focusHeading(mainRef.current);
    mainRef.current?.scrollIntoView({ block: 'start' });
  };

  return (
    <LandingRoot data-testid="landing-page" data-page={current.page} data-course={current.page === 'course' ? current.id : undefined} data-ready={status.ready ? 'true' : 'false'}>
      {/* Terlihat hanya saat difokus (Tab pertama): lompati navbar langsung ke judul halaman. */}
      <button
        type="button"
        onClick={skip}
        className="sr-only left-3 top-3 z-[60] rounded-q-pill bg-q-primary px-4 py-2 text-sm font-bold text-q-on-primary shadow-q-pop focus:not-sr-only focus:fixed"
        data-testid="skip-to-content"
      >
        {PAGE_UI.skipToContent}
      </button>
      <Navbar mode={status.mode} onStart={status.openPrimary} current={navCurrent} />
      <motion.main ref={mainRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={PAGE_FADE}>
        {children}
      </motion.main>
      <Footer current={navCurrent} faqLink={faqLink} />
    </LandingRoot>
  );
}

export { ctaLabelFor, usePageStatus, type PageStatus } from './pageStatus';
