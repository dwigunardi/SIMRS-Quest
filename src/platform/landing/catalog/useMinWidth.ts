/**
 * true bila jendela minimal selebar `px` (media query min-width), ikut berubah saat jendela diubah ukurannya.
 * Untuk komponen yang ukurannya berupa prop (mis. LogoCard size), bukan kelas Tailwind responsif.
 */
import { useCallback, useSyncExternalStore } from 'react';

function matches(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => matches(query),
    () => false,
  );
}
