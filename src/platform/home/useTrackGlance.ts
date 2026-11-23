/**
 * Ringkasan sebuah jalur untuk Beranda. Fungsi glance jalur diimpor DINAMIS (ia menarik data misi), lalu dijalankan
 * terhadap localStorage — jalurnya sendiri tidak di-mount dan mesin SQL tidak dimuat.
 *
 * Dihitung ulang saat: pertama tampil, tab lain mengubah storage, tab ini kembali terlihat, dan — karena jalur yang
 * masih hangat di balik Beranda bisa mengumpulkan ujian sendiri — begitu tenggat ujian lewat, lalu berkala sampai sesi
 * ujian itu hilang dari storage.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { browserStorage } from '../../lib/storageGuard';
import type { GlanceFn, TrackGlance, TrackManifest } from '../tracks';

export type GlanceState = { status: 'loading' } | { status: 'ready'; glance: TrackGlance } | { status: 'error' };

const EMPTY_STORAGE: Pick<Storage, 'getItem'> = { getItem: () => null };
/** Selang pemeriksaan ulang setelah tenggat ujian lewat. */
const POLL_MS = 2000;
/** setTimeout hanya menerima jeda sampai ±24,8 hari. */
const MAX_TIMEOUT_MS = 2_000_000_000;

export function useTrackGlance(track: TrackManifest | undefined): GlanceState {
  const glanceFn = useRef<GlanceFn | null>(null);
  const [state, setState] = useState<GlanceState>({ status: 'loading' });

  const refresh = useCallback(() => {
    const fn = glanceFn.current;
    if (!fn) return;
    try {
      setState({ status: 'ready', glance: fn(browserStorage() ?? EMPTY_STORAGE, new Date()) });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    const load = track?.glance;
    if (!load) {
      setState({ status: 'error' });
      return undefined;
    }
    let cancelled = false;
    load()
      .then((mod) => {
        if (cancelled) return;
        glanceFn.current = mod.glance;
        refresh();
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [track, refresh]);

  useEffect(() => {
    const onStorage = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  // Sesi bertenggat: hitung ulang tepat setelah waktunya habis, lalu tiap POLL_MS selama sesinya masih tersimpan
  // (begitu jalur hangat selesai menilai, sesi dihapus → `deadline` menjadi null → efek ini berhenti sendiri).
  const deadline = state.status === 'ready' ? (state.glance.exam?.deadline ?? null) : null;
  useEffect(() => {
    if (deadline === null) return undefined;
    const due = Date.parse(deadline);
    if (Number.isNaN(due)) return undefined;
    let poll: number | undefined;
    const wait = Math.min(Math.max(0, due - Date.now()) + 250, MAX_TIMEOUT_MS);
    const timer = window.setTimeout(() => {
      refresh();
      poll = window.setInterval(refresh, POLL_MS);
    }, wait);
    return () => {
      window.clearTimeout(timer);
      if (poll !== undefined) window.clearInterval(poll);
    };
  }, [deadline, refresh]);

  return state;
}
