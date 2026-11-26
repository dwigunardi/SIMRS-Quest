/**
 * Router hash buatan sendiri (tanpa dependensi).
 *
 *   ''  |  '#'  |  '#/'      → Beranda
 *   '#/sql'                  → jalur "sql"
 *   '#/sql/ujian'            → jalur "sql", sisa segmen ['ujian'] (diserahkan ke jalurnya)
 *   '#/landing'              → katalog semua jalur
 *   '#/landing/sql'          → halaman landing jalur "sql" (slug huruf kecil; segmen sesudahnya diabaikan)
 *
 * Bagian murni (parseRoute/formatRoute) tidak mengenal daftar jalur: id yang tidak terdaftar tetap menghasilkan rute
 * 'track' / 'course', dan shell-lah yang memutuskan (mis. kembali ke Beranda atau halaman 404). Membuka aplikasi tanpa
 * hash selalu ke Beranda; tautan langsung ke jalur tetap dihormati.
 *
 * Store-nya menerima "lingkungan" (hash + riwayat) sebagai parameter supaya bisa diuji di Node
 * (scripts/verify/platform.ts); di browser dipakai satu store bersama lewat navigate()/useRoute().
 */
import { useSyncExternalStore } from 'react';

export type HomeRoute = { kind: 'home' };
/** Katalog semua jalur ('#/landing'). */
export type CatalogRoute = { kind: 'catalog' };
/** Halaman landing satu jalur ('#/landing/<slug>'); slug yang tidak ada di registri → halaman 404 (keputusan shell). */
export type CourseRoute = { kind: 'course'; slug: string };
export type TrackRoute = { kind: 'track'; trackId: string; rest: readonly string[] };
export type Route = HomeRoute | CatalogRoute | CourseRoute | TrackRoute;
/** Rute yang dilayani halaman landing (katalog, landing jalur, 404 jalur). */
export type LandingRoute = CatalogRoute | CourseRoute;

/** Segmen pertama halaman katalog & landing jalur. */
export const LANDING_SEGMENT = 'landing';

/**
 * Segmen pertama yang dicadangkan untuk halaman platform; tidak boleh menjadi id jalur. 'landing' sudah dipakai
 * (katalog & landing jalur); sisanya untuk halaman kelak — sebelum halamannya ada, alamat itu berakhir di Beranda.
 */
export const RESERVED_SEGMENTS: readonly string[] = [LANDING_SEGMENT, 'profil', 'cari', 'pengaturan', 'runner'];

export const HOME_ROUTE: HomeRoute = { kind: 'home' };
export const CATALOG_ROUTE: CatalogRoute = { kind: 'catalog' };

export function isLandingRoute(route: Route): route is LandingRoute {
  return route.kind === 'catalog' || route.kind === 'course';
}

/** Hash kanonik halaman landing sebuah jalur: courseHref('sql') = '#/landing/sql'. */
export function courseHref(slug: string): string {
  return formatRoute({ kind: 'course', slug });
}

/* ------------------------------------------------------------------ */
/* Bagian murni                                                        */
/* ------------------------------------------------------------------ */

/** decodeURIComponent yang tidak melempar: null bila urutan %-nya rusak. */
function decodeSegment(part: string): string | null {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
}

/**
 * Hash → rute. Tidak pernah melempar; apa pun yang tidak dipahami menjadi Beranda:
 * - tidak diawali '#/' (termasuk '#sql'),
 * - segmen yang gagal di-decode ('%E0%A4%A'),
 * - segmen pertama yang dicadangkan dan halamannya belum ada ('#/profil').
 * Garis miring ganda/akhir diabaikan. Id jalur dinormalkan ke huruf kecil ('#/SQL' = '#/sql'); sisa segmen dibiarkan
 * apa adanya karena maknanya milik jalur. Di bawah '#/landing' segmen pertama dan slug juga dinormalkan ke huruf kecil
 * ('#/LANDING/SQL' = '#/landing/sql'), dan segmen setelah slug diabaikan. Slug landing yang gagal di-decode
 * ('#/landing/100%') dipakai apa adanya — tidak ada jalur seperti itu, jadi pengguna melihat halaman 404 jalur, bukan
 * dipindah diam-diam ke Beranda.
 */
export function parseRoute(hash: string): Route {
  if (!hash.startsWith('#/')) return HOME_ROUTE;
  const [firstRaw, ...restRaw] = hash
    .slice(2)
    .split('/')
    .filter((part) => part !== '');
  if (firstRaw === undefined) return HOME_ROUTE;
  const first = decodeSegment(firstRaw);
  if (first === null) return HOME_ROUTE;
  const trackId = first.toLowerCase();
  if (trackId === LANDING_SEGMENT) {
    const slugRaw = restRaw[0];
    if (slugRaw === undefined) return CATALOG_ROUTE;
    return { kind: 'course', slug: (decodeSegment(slugRaw) ?? slugRaw).toLowerCase() };
  }
  if (RESERVED_SEGMENTS.includes(trackId)) return HOME_ROUTE;
  const rest: string[] = [];
  for (const part of restRaw) {
    const decoded = decodeSegment(part);
    if (decoded === null) return HOME_ROUTE;
    rest.push(decoded);
  }
  return { kind: 'track', trackId, rest };
}

/**
 * Rute → hash kanonik ('#/', '#/sql', '#/sql/ujian', '#/landing', '#/landing/sql'). Segmen kosong dibuang; karakter
 * khusus di-encode. Landing tanpa slug sama dengan katalog.
 */
export function formatRoute(route: Route): string {
  switch (route.kind) {
    case 'home':
      return '#/';
    case 'catalog':
      return `#/${LANDING_SEGMENT}`;
    case 'course': {
      const slug = route.slug.toLowerCase();
      return slug === '' ? `#/${LANDING_SEGMENT}` : `#/${LANDING_SEGMENT}/${encodeURIComponent(slug)}`;
    }
    case 'track': {
      if (route.trackId === '') return '#/';
      const segments = [route.trackId.toLowerCase(), ...route.rest].filter((s) => s !== '');
      return `#/${segments.map(encodeURIComponent).join('/')}`;
    }
    default: {
      const unreachable: never = route;
      throw new Error(`rute tidak dikenal: ${JSON.stringify(unreachable)}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

/** Yang dibutuhkan store dari browser. */
export interface RouterEnv {
  getHash: () => string;
  /** Pindah dengan entri riwayat baru (location.hash = …). */
  pushHash: (hash: string) => void;
  /** Ganti entri riwayat saat ini (history.replaceState) — TIDAK memicu 'hashchange'. */
  replaceHash: (hash: string) => void;
  /** Berlangganan 'hashchange'; mengembalikan fungsi berhenti. */
  onHashChange: (listener: () => void) => () => void;
}

export interface NavigateOptions {
  /** Ganti entri riwayat saat ini alih-alih menambah (tombol Kembali tidak melewati rute lama). */
  replace?: boolean;
}

export interface RouteStore {
  /** Rute saat ini. Objek yang sama dikembalikan selama hash tidak berubah (syarat useSyncExternalStore). */
  getRoute: () => Route;
  subscribe: (listener: () => void) => () => void;
  navigate: (route: Route, options?: NavigateOptions) => void;
  /**
   * Berapa kali rute (bentuk kanoniknya) sudah berganti sejak rute pertama dibaca. 0 = halaman ini adalah tujuan
   * pemuatan dokumen; > 0 = pengguna sudah berpindah di dalam aplikasi (dipakai untuk memindahkan fokus ke judul
   * halaman baru). Perapian URL ('#/landing/' → '#/landing') tidak dihitung.
   */
  changes: () => number;
}

export function createRouteStore(env: RouterEnv): RouteStore {
  const listeners = new Set<() => void>();
  let stopListening: (() => void) | null = null;
  let cachedHash: string | null = null;
  let cachedRoute: Route = HOME_ROUTE;
  let changeCount = 0;

  const getRoute = (): Route => {
    const hash = env.getHash();
    if (hash !== cachedHash) {
      const next = parseRoute(hash);
      if (cachedHash !== null && formatRoute(next) !== formatRoute(cachedRoute)) changeCount += 1;
      cachedHash = hash;
      cachedRoute = next;
    }
    return cachedRoute;
  };

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    stopListening ??= env.onHashChange(notify);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && stopListening !== null) {
        stopListening();
        stopListening = null;
      }
    };
  };

  const navigate = (route: Route, options: NavigateOptions = {}) => {
    const target = formatRoute(route);
    const current = env.getHash();
    if (current === target) return;
    if (options.replace === true) {
      env.replaceHash(target);
    } else {
      // Sudah di rute yang sama (mis. hash kosong = Beranda): jangan menambah entri riwayat yang tidak berarti.
      if (formatRoute(parseRoute(current)) === target) return;
      env.pushHash(target);
    }
    // replaceState tidak memicu 'hashchange', dan 'hashchange' setelah location.hash baru datang belakangan —
    // pelanggan diberi tahu sekarang supaya layar langsung berpindah. Event yang menyusul tidak mengubah apa-apa
    // (getRoute mengembalikan objek yang sama).
    notify();
  };

  return { getRoute, subscribe, navigate, changes: () => changeCount };
}

/** Lingkungan browser sungguhan; di luar browser (Node) hash selalu kosong dan navigasi diabaikan. */
function browserEnv(): RouterEnv {
  const hasWindow = () => typeof window !== 'undefined';
  return {
    getHash: () => (hasWindow() ? window.location.hash : ''),
    pushHash: (hash) => {
      if (hasWindow()) window.location.hash = hash;
    },
    replaceHash: (hash) => {
      if (!hasWindow()) return;
      try {
        window.history.replaceState(window.history.state, '', hash);
      } catch {
        // Dokumen tanpa origin (file://, sandbox) bisa menolak replaceState.
        window.location.replace(hash);
      }
    },
    onHashChange: (listener) => {
      if (!hasWindow()) return () => undefined;
      window.addEventListener('hashchange', listener);
      return () => window.removeEventListener('hashchange', listener);
    },
  };
}

const store = createRouteStore(browserEnv());

/** Pindah rute. Aman dipanggil dari mana saja (event handler, efek). */
export function navigate(route: Route, options?: NavigateOptions): void {
  store.navigate(route, options);
}

/** Berapa kali pengguna sudah berpindah rute di dalam aplikasi sejak dokumen dimuat (lihat RouteStore.changes). */
export function routeChanges(): number {
  store.getRoute();
  return store.changes();
}

/** Rute saat ini; komponen dirender ulang saat hash berubah (tombol Kembali/Maju, tautan, navigate). */
export function useRoute(): Route {
  return useSyncExternalStore(store.subscribe, store.getRoute, store.getRoute);
}
