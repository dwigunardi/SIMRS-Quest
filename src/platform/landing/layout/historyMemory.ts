/**
 * Ingatan halaman landing di entri riwayat browser (history.state): posisi gulir dan isian katalog. Tombol Kembali/Maju
 * kembali ke entri yang sama, jadi halaman bisa dipulihkan persis seperti ditinggalkan; navigasi baru membuat entri baru
 * tanpa state, jadi halaman mulai bersih dari atas. Pola yang sama dengan posisi gulir Beranda (src/platform/Home.tsx).
 *
 * Nilai hanya ditulis selama entri riwayat saat ini MASIH milik rute halaman itu — klik tautan bisa memicu tulisan
 * terakhir tepat sebelum hash berganti, dan tulisan itu tidak boleh jatuh ke entri rute berikutnya.
 */
import { formatRoute, parseRoute } from '../../router';

function historyState(): Record<string, unknown> {
  try {
    const state: unknown = window.history.state;
    return typeof state === 'object' && state !== null ? (state as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Rute kanonik entri riwayat saat ini, mis. '#/landing/sql'. */
export function currentRouteKey(): string {
  return formatRoute(parseRoute(window.location.hash));
}

/** Nilai `key` di entri riwayat saat ini, bila milik rute `route` dan lolos `guard`. */
export function readMemory<T>(key: string, route: string, guard: (value: unknown) => value is T): T | null {
  const entry = historyState()[key];
  if (typeof entry !== 'object' || entry === null) return null;
  const { route: owner, value } = entry as { route?: unknown; value?: unknown };
  return owner === route && guard(value) ? value : null;
}

/** Simpan `value` di entri riwayat saat ini — hanya bila entri itu memang rute `route`. */
export function writeMemory(key: string, route: string, value: unknown): void {
  if (currentRouteKey() !== route) return;
  const state = historyState();
  const previous = state[key];
  if (JSON.stringify(previous) === JSON.stringify({ route, value })) return;
  try {
    window.history.replaceState({ ...state, [key]: { route, value } }, '');
  } catch {
    /* dokumen tanpa origin: tidak diingat */
  }
}
