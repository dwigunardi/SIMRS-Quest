/**
 * Tema landing (terang/gelap). Hanya berlaku di Beranda: nilainya ditulis ke atribut data-theme pada <html> oleh
 * useLandingDocument (dipakai LandingRoot) dan dilepas saat Beranda tidak tampil. Kelas "dark" di index.html dan
 * varian dark: Tailwind TIDAK dipakai/disentuh.
 *
 * Pilihan pengguna disimpan di localStorage 'simrs-quest:theme:v1'. Selama belum pernah memilih, tema mengikuti
 * prefers-color-scheme (dan ikut berubah bila pengaturan sistem diganti).
 *
 * State-nya satu untuk seluruh halaman (store tingkat modul), jadi useTheme() boleh dipanggil di banyak komponen.
 */
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { browserStorage } from '../../../lib/storageGuard';
import { THEME_KEY } from '../../../lib/storageKeys';

export type Theme = 'light' | 'dark';

/** Kunci tema: didefinisikan bersama semua kunci localStorage aplikasi di src/lib/storageKeys.ts. */
export const THEME_STORAGE_KEY = THEME_KEY;
const DARK_QUERY = '(prefers-color-scheme: dark)';

function isTheme(value: unknown): value is Theme {
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

function getSnapshot(): Theme {
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
  setTheme(getSnapshot() === 'dark' ? 'light' : 'dark');
}

export interface ThemeApi {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Tukar terang/gelap. */
  toggleTheme: () => void;
}

export function useTheme(): ThemeApi {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'light' as const);
  return { theme, setTheme, toggleTheme };
}

/**
 * Memasang penanda landing pada <html> selama komponen pemanggil ter-mount: data-q-landing (gaya global: latar <body>,
 * font, garis fokus) dan data-theme (token warna). Saat di-unmount keduanya dilepas, sehingga layar jalur kembali
 * persis seperti semula. Dipanggil SEKALI, oleh LandingRoot.
 */
export function useLandingDocument(): Theme {
  const { theme } = useTheme();
  // Layout effect: atribut terpasang sebelum browser menggambar, jadi tidak ada kilatan latar gelap aplikasi.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-q-landing', '');
    return () => {
      root.removeAttribute('data-q-landing');
      root.removeAttribute('data-theme');
    };
  }, []);
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return theme;
}
