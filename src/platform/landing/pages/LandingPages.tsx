/**
 * Tuan rumah halaman katalog ('#/landing'), landing jalur ('#/landing/<id>'), dan 404 jalur. Dimuat malas oleh shell
 * (src/platform/PlatformShell.tsx) sebagai chunk tersendiri, jadi Beranda tidak membesar; ketiga halamannya pun
 * masing-masing chunk sendiri (React.lazy).
 *
 * Komponen ini TETAP ter-mount selama pengguna berpindah di antara halaman landing:
 * - status pengguna (ringkasan jalur utama untuk tombol "Mulai belajar"/"Lanjutkan") dimuat SEKALI di sini;
 * - setiap rute di-mount ulang dengan key-nya sendiri (state halaman bersih, pudar masuk 150 ms di PageLayout) dan
 *   jendela digulir ke atas — kecuali lewat tombol Kembali/Maju ke entri yang pernah digulir: posisinya dipulihkan;
 * - fokus pindah ke judul halaman baru setelah navigasi di dalam aplikasi (PageLayout);
 * - begitu chunk sebuah halaman pernah dimuat, komponennya dirender langsung (tanpa layar sementara lagi), dan chunk
 *   katalog & landing jalur dipramuat saat browser diam.
 *
 * Milik FONDASI. Pembangun halaman tidak perlu menyentuh berkas ini.
 */
import { Suspense, lazy, useEffect, useLayoutEffect, type ComponentType, type LazyExoticComponent } from 'react';
import { formatRoute, type LandingRoute } from '../../router';
import { getTrack } from '../../tracks';
import { readMemory, writeMemory } from '../layout/historyMemory';
import { PageErrorBoundary, PageLoading } from '../layout/PageFallback';
import { PageStatusProvider } from '../layout/pageStatus';

interface PageModule<P> {
  default: ComponentType<P>;
}

interface PageLoader<P> {
  /** Unduh chunk halaman (sekali; hasilnya disimpan). Gagal → boleh dicoba lagi. */
  fetch: () => Promise<PageModule<P>>;
  /** Komponen yang dirender: komponen asli bila chunk sudah dimuat (tanpa Suspense lagi), selain itu versi lazy. */
  component: () => ComponentType<P> | LazyExoticComponent<ComponentType<P>>;
}

function pageLoader<P>(load: () => Promise<PageModule<P>>): PageLoader<P> {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<PageModule<P>> | null = null;
  const fetch = (): Promise<PageModule<P>> => {
    pending ??= load().then(
      (mod) => {
        loaded = mod.default;
        return mod;
      },
      (error: unknown) => {
        pending = null;
        throw error;
      },
    );
    return pending;
  };
  // React.lazy menyimpan kegagalan selamanya: setelah gagal dibuat komponen lazy BARU, jadi rute berikutnya (batas galat
  // baru, key per rute) benar-benar mengunduh ulang chunk-nya.
  const createLazy = (): LazyExoticComponent<ComponentType<P>> =>
    lazy(() =>
      fetch().catch((error: unknown) => {
        Lazy = createLazy();
        throw error;
      }),
    );
  let Lazy = createLazy();
  return { fetch, component: () => loaded ?? Lazy };
}

const catalogPage = pageLoader(() => import('./CatalogPage'));
const coursePage = pageLoader(() => import('./CoursePage'));
const notFoundPage = pageLoader(() => import('./NotFoundPage'));

/** Batas panjang slug yang ditampilkan kembali di halaman 404. */
const MAX_ECHO = 40;
/** Jeda sebelum chunk halaman lain dipramuat bila browser tidak punya requestIdleCallback. */
const PREFETCH_FALLBACK_MS = 1200;

function echo(text: string): string {
  return text.length > MAX_ECHO ? `${text.slice(0, MAX_ECHO)}…` : text;
}

function LandingPage({ route }: { route: LandingRoute }): JSX.Element {
  if (route.kind === 'catalog') {
    const Catalog = catalogPage.component();
    return <Catalog />;
  }
  const track = getTrack(route.slug);
  if (track) {
    const Course = coursePage.component();
    return <Course courseId={track.id} />;
  }
  const NotFound = notFoundPage.component();
  return <NotFound slug={echo(route.slug)} />;
}

export interface LandingPagesProps {
  route: LandingRoute;
}

/** Kunci history.state untuk posisi gulir halaman landing (lihat layout/historyMemory.ts). */
const SCROLL_MEMORY = 'simrsQuestLandingScroll';
/** Jeda setelah guliran berhenti sebelum posisinya dicatat (replaceState dibatasi browser bila terlalu sering). */
const SCROLL_SAVE_MS = 150;
/** Batas usaha memulihkan posisi selagi halaman (chunk, bagian yang muncul belakangan) belum setinggi itu. */
const RESTORE_FRAMES = 90;

function isScrollY(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Posisi gulir per entri riwayat: navigasi baru (tautan, menu) mulai dari atas; tombol Kembali/Maju ke entri halaman
 * landing yang pernah digulir kembali ke posisi itu — pola yang sama dengan Beranda. Halaman bisa belum setinggi posisi
 * tujuannya (chunk masih dimuat), jadi pemulihan dicoba beberapa frame sampai tercapai, dan berhenti begitu pengguna
 * menggulir sendiri.
 */
function useScrollMemory(key: string): void {
  useLayoutEffect(() => {
    const target = readMemory(SCROLL_MEMORY, key, isScrollY);
    window.scrollTo(0, target ?? 0);
    if (target === null) return undefined;
    let frame = 0;
    let tries = 0;
    const stop = () => cancelAnimationFrame(frame);
    const tick = () => {
      if (Math.abs(window.scrollY - target) < 2 || tries >= RESTORE_FRAMES) return;
      tries += 1;
      window.scrollTo(0, target);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const options = { passive: true, once: true } as const;
    window.addEventListener('wheel', stop, options);
    window.addEventListener('touchstart', stop, options);
    window.addEventListener('keydown', stop, { once: true });
    return () => {
      stop();
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
    };
  }, [key]);

  useEffect(() => {
    let timer = 0;
    const save = () => writeMemory(SCROLL_MEMORY, key, Math.round(window.scrollY));
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(save, SCROLL_SAVE_MS);
    };
    // Klik tautan bisa datang sebelum jeda habis: catat dulu, selagi entri riwayatnya masih halaman ini.
    const flush = () => {
      window.clearTimeout(timer);
      save();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', flush, true);
    document.addEventListener('keydown', flush, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', flush, true);
      document.removeEventListener('keydown', flush, true);
    };
  }, [key]);
}

export default function LandingPages({ route }: LandingPagesProps): JSX.Element {
  const key = formatRoute(route);
  useScrollMemory(key);

  useEffect(() => {
    const warm = () => {
      void catalogPage.fetch().catch(() => undefined);
      void coursePage.fetch().catch(() => undefined);
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(warm, PREFETCH_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <PageStatusProvider>
      <PageErrorBoundary key={key}>
        <Suspense fallback={<PageLoading />}>
          <LandingPage route={route} />
        </Suspense>
      </PageErrorBoundary>
    </PageStatusProvider>
  );
}
