/**
 * Tema aplikasi (terang/gelap) — SATU untuk seluruh aplikasi: Beranda, halaman katalog/landing jalur, dan layar jalur.
 *
 * - Pilihan pengguna disimpan di localStorage THEME_KEY ('simrs-quest:theme:v1', teks polos 'light' | 'dark'). Selama
 *   belum pernah memilih, tema mengikuti prefers-color-scheme (dan ikut berubah bila pengaturan sistem diganti).
 * - Nilainya dipasang sebagai atribut data-theme pada <html> untuk SEMUA rute: lebih dulu oleh skrip pra-gambar di
 *   index.html (sebelum gambar pertama, jadi tidak ada kedipan), lalu dijaga useDocumentTheme() di cangkang platform.
 * - Halaman landing memakai token q-* sendiri (src/platform/landing/styles/tokens.css, dipilih html[data-theme]);
 *   layar jalur memakai palet Tailwind berbasis variabel (src/theme.css), yang versi terangnya hanya aktif bila
 *   html[data-theme='light'] DAN tidak ada html[data-q-landing].
 * - Kelas "dark" di index.html dan varian dark: Tailwind TIDAK dipakai/disentuh. Penyesuaian khusus tema terang di
 *   komponen jalur memakai varian `light:` (tailwind.config.js).
 *
 * State-nya satu untuk seluruh halaman (store tingkat modul), jadi useTheme() boleh dipanggil di banyak komponen; tab
 * lain yang mengganti tema ikut terbaca lewat event 'storage'.
 */
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { browserStorage } from '../lib/storageGuard';
import { THEME_KEY } from '../lib/storageKeys';

export type Theme = 'light' | 'dark';

/** Kunci tema: didefinisikan bersama semua kunci localStorage aplikasi di src/lib/storageKeys.ts. */
export const THEME_STORAGE_KEY = THEME_KEY;
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

function readStored(): Theme | null {
  try {
    const raw = browserStorage()?.getItem(THEME_STORAGE_KEY) ?? null;
    return isTheme(raw) ? raw : null;
  } catch {
    return null; // penyimpanan diblokir
  }
}

function systemTheme(): Theme {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

const listeners = new Set<() => void>();
/** Pilihan eksplisit pengguna; undefined = belum dibaca dari storage. */
let chosen: Theme | null | undefined;
let stopWatching: (() => void) | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

/** Tema yang berlaku sekarang (pilihan tersimpan, atau tema sistem). */
export function currentTheme(): Theme {
  if (chosen === undefined) chosen = readStored();
  return chosen ?? systemTheme();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (stopWatching === null) {
    // Tab lain mengganti tema: ikut berubah. event.key null = storage dikosongkan seluruhnya.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
      chosen = readStored();
      emit();
    };
    window.addEventListener('storage', onStorage);
    const media = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
    media?.addEventListener('change', emit);
    stopWatching = () => {
      window.removeEventListener('storage', onStorage);
      media?.removeEventListener('change', emit);
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stopWatching !== null) {
      stopWatching();
      stopWatching = null;
    }
  };
}

function setTheme(theme: Theme): void {
  chosen = theme;
  try {
    browserStorage()?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* penyimpanan penuh/diblokir: cukup berlaku untuk sesi ini */
  }
  emit();
}

function toggleTheme(): void {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

/** Label tombol tema: menyebut AKSI-nya (ikon menunjukkan tema yang sedang aktif). Sama dengan tombol di Beranda. */
export const THEME_TOGGLE_LABEL: Readonly<Record<Theme, string>> = {
  dark: 'Ganti ke tema terang',
  light: 'Ganti ke tema gelap',
};

export interface ThemeApi {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Tukar terang/gelap. */
  toggleTheme: () => void;
}

export function useTheme(): ThemeApi {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'light' as const);
  return { theme, setTheme, toggleTheme };
}

/**
 * Menjaga html[data-theme] sesuai tema yang berlaku, untuk seluruh aplikasi. Dipanggil SEKALI, oleh cangkang platform
 * (PlatformShell). Atribut tidak pernah dilepas: skrip pra-gambar di index.html sudah memasangnya sebelum React jalan,
 * dan layout effect ini memperbaruinya sebelum browser menggambar ulang (tanpa kilatan tema lama).
 */
export function useDocumentTheme(): Theme {
  const { theme } = useTheme();
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return theme;
}
