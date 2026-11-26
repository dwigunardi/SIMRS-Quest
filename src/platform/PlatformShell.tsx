/**
 * Cangkang platform: menerjemahkan rute menjadi layar.
 *
 *   Beranda ('' | '#/')   → <Home />
 *   '#/<jalur>[/…]'       → komponen jalur, dimuat malas dari manifest.load
 *   '#/landing'           → katalog semua jalur (landing/pages/CatalogPage, dimuat malas)
 *   '#/landing/<id>'      → landing jalur (landing/pages/CoursePage, dimuat malas); id tak dikenal → NotFoundPage
 *   '#/<jalur segera>'    → dialihkan (replace) ke '#/landing/<id>'
 *   '#/<tak dikenal>'     → dialihkan ke Beranda dengan pemberitahuan satu baris
 *
 * "Satu jalur hangat": jalur yang pernah dibuka TETAP ter-mount saat pengguna kembali ke Beranda atau membuka halaman
 * katalog/landing, hanya disembunyikan (atribut hidden). Dengan begitu draf editor, sesi Playground, dan timer ujian
 * (kumpul otomatis) tetap hidup. Beranda dan halaman landing sebaliknya di-unmount saat tidak tampil.
 *
 * Riwayat browser: Beranda → jalur dan jalur → Beranda adalah entri baru (tombol Kembali bekerja dua arah);
 * pengalihan (jalur tak dikenal / belum tersedia) dan perapian URL adalah replace.
 *
 * Judul tab: shell hanya menulis document.title untuk Beranda dan layar jalur. Halaman katalog/landing menulis
 * judulnya sendiri (usePageMeta) — efek anak berjalan sebelum efek induk, jadi shell tidak boleh menimpanya.
 */
import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
  type RefObject,
} from 'react';
import { PRODUCT_NAME } from './brand';
import { Home } from './Home';
import { PageErrorBoundary, PageLoading } from './landing/layout/PageFallback';
import { HOME_ROUTE, RESERVED_SEGMENTS, formatRoute, isLandingRoute, navigate, useRoute, type CourseRoute, type LandingRoute, type Route } from './router';
import { PlatformError, PlatformLoading } from './screens';
import { getTrack, type TrackManifest, type TrackProps } from './tracks';

type TrackLoader = NonNullable<TrackManifest['load']>;
type LoadableTrack = TrackManifest & { load: TrackLoader };

const NO_ENTRY: readonly string[] = [];
/** Batas panjang potongan URL yang ditampilkan kembali ke pengguna. */
const MAX_ECHO = 40;

/** Jalur yang bisa dibuka sekarang; undefined untuk id tak dikenal maupun jalur berstatus 'segera'. */
function openableTrack(trackId: string): LoadableTrack | undefined {
  const track = getTrack(trackId);
  return track?.status === 'tersedia' && track.load ? (track as LoadableTrack) : undefined;
}

// React.lazy harus dibuat SEKALI per jalur (bukan tiap render), jadi disimpan di tingkat modul.
const lazyTracks = new Map<string, LazyExoticComponent<ComponentType<TrackProps>>>();
function lazyTrack(track: LoadableTrack): LazyExoticComponent<ComponentType<TrackProps>> {
  let component = lazyTracks.get(track.id);
  if (!component) {
    component = lazy(track.load);
    lazyTracks.set(track.id, component);
  }
  return component;
}

function echo(text: string): string {
  return text.length > MAX_ECHO ? `${text.slice(0, MAX_ECHO)}…` : text;
}

/**
 * Halaman katalog/landing jalur: tuan rumahnya (landing/pages/LandingPages — status pengguna, gulir ke atas, ketiga
 * halaman yang masing-masing chunk sendiri) dimuat malas, jadi Beranda tidak membesar. Selama chunk diunduh tampil
 * layar sementara bertema (tema tidak berkedip ke latar gelap); bila gagal, layar gagal dengan "Muat ulang".
 *
 * React.lazy menyimpan kegagalan selamanya, jadi setelah gagal dibuat komponen lazy BARU: rute landing berikutnya
 * (batas galat dipulihkan lewat resetKey) benar-benar mengunduh ulang chunk-nya.
 */
function createLandingPages(): LazyExoticComponent<ComponentType<{ route: LandingRoute }>> {
  return lazy(() =>
    import('./landing/pages/LandingPages').catch((error: unknown) => {
      landingPages = createLandingPages();
      throw error;
    }),
  );
}
let landingPages = createLandingPages();

function LandingHost({ route }: { route: LandingRoute }): JSX.Element {
  const LandingPages = landingPages;
  return (
    <PageErrorBoundary resetKey={formatRoute(route)}>
      <Suspense fallback={<PageLoading />}>
        <LandingPages route={route} />
      </Suspense>
    </PageErrorBoundary>
  );
}

/** Segmen pertama hash apa adanya (huruf kecil), untuk menjelaskan kenapa sebuah tautan berakhir di Beranda. */
function firstSegment(hash: string): string | null {
  if (!hash.startsWith('#/')) return null;
  const part = hash.slice(2).split('/').find((p) => p !== '');
  if (part === undefined) return null;
  try {
    return decodeURIComponent(part).toLowerCase();
  } catch {
    return null;
  }
}

function goHome(): void {
  navigate(HOME_ROUTE);
}

/**
 * Hanya membaca rute; seluruh state layar ada di ShellScreens. Pemisahan ini DISENGAJA: ShellScreens memanggil setState
 * saat render (jalur hangat), dan di React 18 pembaruan saat render pada komponen yang sama dengan useSyncExternalStore
 * membuat catatan snapshot store-nya tertinggal — perubahan hash berikutnya (tombol Kembali browser) lalu dianggap
 * "tidak berubah" dan layar tidak berpindah.
 */
export function PlatformShell(): JSX.Element {
  return <ShellScreens route={useRoute()} />;
}

/** Jalur di registri yang belum tersedia → rute landing-nya (pengalihan); selain itu null. */
function soonRedirectOf(route: Route): CourseRoute | null {
  if (route.kind !== 'track') return null;
  const known = getTrack(route.trackId);
  return known !== undefined && known.status === 'segera' ? { kind: 'course', slug: known.id } : null;
}

function ShellScreens({ route }: { route: Route }): JSX.Element {
  const track = route.kind === 'track' ? openableTrack(route.trackId) : undefined;
  /**
   * Halaman landing yang tampil: rute katalog/landing, atau landing jalur 'segera' yang sedang dialihkan (dirender
   * langsung supaya Beranda tidak sempat ter-mount sebentar sebelum URL-nya diganti).
   */
  const landing: LandingRoute | null = isLandingRoute(route) ? route : soonRedirectOf(route);
  /** Jalur yang sedang "hangat" (ter-mount). Hanya satu: membuka jalur lain melepas yang lama. */
  const [warm, setWarm] = useState<LoadableTrack | null>(track ?? null);
  if (track && warm !== track) setWarm(track);
  /** Pemberitahuan satu baris di Beranda setelah pengalihan; hilang saat ditutup atau saat membuka jalur/halaman lain. */
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isLandingRoute(route)) {
      setNotice(null);
      // Rapikan variasi penulisan ('#/LANDING/SQL', '#/landing/', '#/landing/sql/x') ke bentuk kanonik.
      if (window.location.hash !== formatRoute(route)) navigate(route, { replace: true });
      return;
    }
    if (route.kind === 'track') {
      if (track) {
        setNotice(null);
        // Rapikan variasi penulisan ('#/SQL', '#/sql/') ke bentuk kanonik. Sisa segmen dibiarkan: itu "niat masuk"
        // yang dirapikan setelah diproses jalurnya (onEntryConsumed).
        if (route.rest.length === 0) navigate(route, { replace: true });
        return;
      }
      const redirect = soonRedirectOf(route);
      if (redirect) {
        // Jalur 'segera': halaman landing-nya menjelaskan rencananya — tanpa pemberitahuan, URL diganti (replace).
        setNotice(null);
        navigate(redirect, { replace: true });
        return;
      }
      setNotice(`Jalur "${echo(route.trackId)}" tidak ditemukan.`);
      navigate(HOME_ROUTE, { replace: true });
      return;
    }
    // Beranda. Hash kosong dibiarkan (URL bersih); hash lain yang berakhir di sini dirapikan menjadi '#/'.
    const hash = window.location.hash;
    if (hash === '' || hash === '#' || hash === '#/') return;
    const first = firstSegment(hash);
    if (first !== null && RESERVED_SEGMENTS.includes(first)) setNotice(`Halaman "${first}" belum tersedia.`);
    navigate(HOME_ROUTE, { replace: true });
  }, [route, track]);

  // Judul tab hanya untuk Beranda dan layar jalur; halaman landing memasang judulnya sendiri (usePageMeta) dan
  // efeknya berjalan lebih dulu — shell tidak boleh menimpanya. null = bukan urusan shell.
  let shellTitle: string | null = null;
  if (track) shellTitle = `${track.title} · ${PRODUCT_NAME}`;
  else if (route.kind === 'home') shellTitle = PRODUCT_NAME;
  useEffect(() => {
    if (shellTitle !== null) document.title = shellTitle;
  }, [shellTitle]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return (
    <>
      {track || landing ? null : <Home notice={notice} onDismissNotice={dismissNotice} />}
      {landing ? <LandingHost route={landing} /> : null}
      {warm ? <TrackHost key={warm.id} track={warm} active={warm === track} route={route} /> : null}
    </>
  );
}

interface TrackHostProps {
  track: LoadableTrack;
  active: boolean;
  route: Route;
}

/**
 * Pembungkus satu jalur. Elemen tersendiri TANPA kelas display: di Tailwind 3 kelas seperti 'flex'/'grid' mengalahkan
 * [hidden], sehingga jalur "tersembunyi" akan tetap tampil di atas Beranda.
 */
function TrackHost({ track, active, route }: TrackHostProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const entry = active && route.kind === 'track' ? route.rest : NO_ENTRY;
  const Track = lazyTrack(track);

  const consumeEntry = useCallback(() => {
    navigate({ kind: 'track', trackId: track.id, rest: [] }, { replace: true });
  }, [track.id]);

  // Saat disembunyikan, lepaskan fokus yang masih berada di dalam jalur. Popup yang hidup di luar pembungkus ini
  // (mis. saran autocomplete editor, di-portal ke <body>) menutup dirinya saat editornya kehilangan fokus — tanpa ini
  // popup tersebut tertinggal di atas Beranda bila pengguna pulang lewat tombol Kembali browser.
  useLayoutEffect(() => {
    if (active) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && hostRef.current?.contains(focused)) focused.blur();
  }, [active]);

  useScrollMemory(hostRef, active, entry.length > 0);

  return (
    <div ref={hostRef} hidden={!active} data-testid="track-host" data-track={track.id}>
      <TrackBoundary title={track.title} onHome={goHome}>
        <Suspense fallback={<PlatformLoading title={`Memuat jalur ${track.title}…`} onHome={goHome} />}>
          <Track active={active} entry={entry} onEntryConsumed={consumeEntry} onHome={goHome} />
        </Suspense>
      </TrackBoundary>
    </div>
  );
}

/**
 * Posisi gulir jalur hangat. Elemen yang disembunyikan kehilangan kotak tata letaknya, dan Beranda menggulir jendela ke
 * atas — jadi posisi gulir (jendela pada layar sempit, panel-panel jalur pada layar lebar) dicatat selama jalur tampil
 * dan dipulihkan saat tampil lagi. `startAtTop`: jalur dimasuki dengan niat khusus (mis. '#/sql/ujian'), layar yang
 * dituju berbeda dari yang ditinggalkan, jadi jendela mulai dari atas.
 */
function useScrollMemory(hostRef: RefObject<HTMLElement>, active: boolean, startAtTop: boolean): void {
  const memory = useRef({ windowY: 0, elements: new Map<Element, number>() });
  const activeRef = useRef(active);

  useEffect(() => {
    const onScroll = (event: Event) => {
      // Peristiwa gulir akibat penyembunyian (dokumen memendek) datang setelah activeRef dimatikan → diabaikan.
      if (!activeRef.current) return;
      const target = event.target;
      if (target === document) {
        memory.current.windowY = window.scrollY;
      } else if (target instanceof Element && hostRef.current?.contains(target)) {
        const { elements } = memory.current;
        elements.set(target, target.scrollTop);
        // Panel dibuat ulang saat pindah mode; buang catatan elemen yang sudah tidak ada.
        if (elements.size > 64) for (const el of [...elements.keys()]) if (!el.isConnected) elements.delete(el);
      }
    };
    // capture: peristiwa 'scroll' pada elemen tidak menggelembung.
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [hostRef]);

  useLayoutEffect(() => {
    activeRef.current = active;
    if (!active) return;
    const { windowY, elements } = memory.current;
    for (const [el, top] of elements) {
      if (!el.isConnected) elements.delete(el);
      else if (el.scrollTop !== top) el.scrollTop = top;
    }
    window.scrollTo(0, startAtTop ? 0 : windowY);
    // startAtTop sengaja tidak menjadi dependensi: hanya dibaca pada saat jalur menjadi aktif.
  }, [active]);
}

interface TrackBoundaryProps {
  title: string;
  onHome: () => void;
  children: ReactNode;
}

/** Jalur yang gagal dimuat (mis. jaringan putus saat mengambil chunk) atau melempar saat render tidak mematikan Beranda. */
class TrackBoundary extends Component<TrackBoundaryProps, { message: string | null }> {
  override state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: unknown): { message: string } {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override render(): ReactNode {
    if (this.state.message === null) return this.props.children;
    return (
      <PlatformError
        title={`Jalur ${this.props.title} gagal dimuat`}
        description="Periksa koneksi lalu muat ulang halaman. Progres yang sudah tersimpan tidak terpengaruh."
        message={this.state.message}
        onHome={this.props.onHome}
      />
    );
  }
}
