/**
 * Router hash buatan sendiri (tanpa dependensi).
 *
 *   ''  |  '#'  |  '#/'      → Beranda
 *   '#/sql'                  → jalur "sql"
 *   '#/sql/ujian'            → jalur "sql", sisa segmen ['ujian'] (diserahkan ke jalurnya)
 *
 * Bagian murni (parseRoute/formatRoute) tidak mengenal daftar jalur: id yang tidak terdaftar tetap menghasilkan rute
 * 'track', dan shell-lah yang memutuskan (mis. kembali ke Beranda). Membuka aplikasi tanpa hash selalu ke Beranda;
 * tautan langsung ke jalur tetap dihormati.
 *
 * Store-nya menerima "lingkungan" (hash + riwayat) sebagai parameter supaya bisa diuji di Node
 * (scripts/verify/platform.ts); di browser dipakai satu store bersama lewat navigate()/useRoute().
 */
import { useSyncExternalStore } from 'react';

export type Route = { kind: 'home' } | { kind: 'track'; trackId: string; rest: readonly string[] };

/** Segmen pertama yang dicadangkan untuk halaman platform kelak; tidak boleh menjadi id jalur. */
export const RESERVED_SEGMENTS: readonly string[] = ['profil', 'cari', 'pengaturan', 'runner'];

export const HOME_ROUTE: Route = { kind: 'home' };

/* ------------------------------------------------------------------ */
/* Bagian murni                                                        */
/* ------------------------------------------------------------------ */

/**
 * Hash → rute. Tidak pernah melempar; apa pun yang tidak dipahami menjadi Beranda:
 * - tidak diawali '#/' (termasuk '#sql'),
 * - segmen yang gagal di-decode ('%E0%A4%A'),
 * - segmen pertama yang dicadangkan (halamannya belum ada).
 * Garis miring ganda/akhir diabaikan. Id jalur dinormalkan ke huruf kecil ('#/SQL' = '#/sql'); sisa segmen dibiarkan
 * apa adanya karena maknanya milik jalur.
 */
export function parseRoute(hash: string): Route {
  if (!hash.startsWith('#/')) return HOME_ROUTE;
  const segments: string[] = [];
  for (const part of hash.slice(2).split('/')) {
    if (part === '') continue;
    try {
      segments.push(decodeURIComponent(part));
    } catch {
      return HOME_ROUTE;
    }
  }
  const [first, ...rest] = segments;
  if (first === undefined) return HOME_ROUTE;
  const trackId = first.toLowerCase();
  if (RESERVED_SEGMENTS.includes(trackId)) return HOME_ROUTE;
  return { kind: 'track', trackId, rest };
}

/** Rute → hash kanonik ('#/', '#/sql', '#/sql/ujian'). Segmen kosong dibuang; karakter khusus di-encode. */
export function formatRoute(route: Route): string {
  if (route.kind === 'home' || route.trackId === '') return '#/';
  const segments = [route.trackId.toLowerCase(), ...route.rest].filter((s) => s !== '');
  return `#/${segments.map(encodeURIComponent).join('/')}`;
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
}

export function createRouteStore(env: RouterEnv): RouteStore {
  const listeners = new Set<() => void>();
  let stopListening: (() => void) | null = null;
  let cachedHash: string | null = null;
  let cachedRoute: Route = HOME_ROUTE;

  const getRoute = (): Route => {
    const hash = env.getHash();
    if (hash !== cachedHash) {
      cachedHash = hash;
      cachedRoute = parseRoute(hash);
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

  return { getRoute, subscribe, navigate };
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

/** Rute saat ini; komponen dirender ulang saat hash berubah (tombol Kembali/Maju, tautan, navigate). */
export function useRoute(): Route {
  return useSyncExternalStore(store.subscribe, store.getRoute, store.getRoute);
}
