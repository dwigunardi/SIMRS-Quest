/**
 * Tema landing = tema aplikasi (src/platform/theme.ts): satu kunci, satu store, satu atribut html[data-theme] untuk
 * Beranda, halaman katalog/landing jalur, dan layar jalur. Modul ini hanya meneruskannya untuk komponen landing dan
 * menambahkan penanda khusus landing (data-q-landing).
 */
import { useLayoutEffect } from 'react';
import { useTheme, type Theme } from '../../theme';

export { THEME_STORAGE_KEY, THEME_TOGGLE_LABEL, useTheme, type Theme, type ThemeApi } from '../../theme';

/**
 * Memasang penanda landing data-q-landing pada <html> selama komponen pemanggil ter-mount (gaya global landing: latar
 * <body>, font, garis fokus; dan menahan palet terang layar jalur di src/theme.css supaya kelas palet di landing tidak
 * ikut berubah). Saat di-unmount penanda itu dilepas, tetapi data-theme TETAP — tema berlaku untuk seluruh aplikasi dan
 * dijaga cangkang platform (useDocumentTheme). Dipanggil SEKALI, oleh LandingRoot.
 */
export function useLandingDocument(): Theme {
  const { theme } = useTheme();
  // Layout effect: atribut terpasang sebelum browser menggambar, jadi tidak ada kilatan palet layar jalur.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-q-landing', '');
    return () => root.removeAttribute('data-q-landing');
  }, []);
  // Halaman landing juga bisa dirender tanpa cangkang (mis. pratinjau): tema tetap terpasang.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return theme;
}
