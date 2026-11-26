/**
 * Status pengguna untuk halaman katalog & landing jalur: ringkasan jalur utama (SQL) dari useTrackGlance — dasar
 * tombol "Mulai belajar" / "Lanjutkan" di navbar, hero, dan CTA penutup.
 *
 * Penyedianya (PageStatusProvider) dipasang SEKALI untuk semua halaman landing oleh pages/LandingPages.tsx (tuan rumah
 * yang tetap ter-mount selama pengguna berpindah di antara halaman landing), BUKAN di tiap halaman: pindah dari katalog
 * ke landing jalur tidak memuat ulang ringkasan, jadi tombol navbar tidak berkedip hilang-muncul. Modul ini ringan
 * (tanpa data misi) dan ikut chunk halaman landing, bukan bundel Beranda.
 *
 *   const { mode, started, glance, primaryLabel, openPrimary } = usePageStatus();
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useTrackGlance } from '../../home/useTrackGlance';
import { navigate } from '../../router';
import { TRACKS, type TrackGlance, type TrackManifest } from '../../tracks';
import { CTA_LABEL, modeOf, type HomeMode } from '../sections/Hero';

/** Jalur utama: jalur 'tersedia' pertama di registri (sama dengan Beranda). */
const PRIMARY: TrackManifest | undefined = TRACKS.find((track) => track.status === 'tersedia');

export interface PageStatus {
  /** Ringkasan jalur utama; null selama dimuat atau bila gagal dimuat. */
  glance: TrackGlance | null;
  /**
   * Keadaan tombol utama, sama dengan Beranda: 'loading' (ringkasan belum siap — tombol belum ditampilkan),
   * 'start' (pengguna baru), 'resume' (sudah mulai, masih ada misi), 'open' (semua tuntas / ringkasan gagal).
   */
  mode: HomeMode;
  /** Ringkasan sudah selesai dimuat (berhasil atau gagal). */
  ready: boolean;
  /** Pengguna pernah mengerjakan jalur utama. */
  started: boolean;
  /** Teks tombol utama navbar untuk `mode` ("Mulai belajar" / "Lanjutkan" / "Buka jalur SQL"). */
  primaryLabel: string;
  /** Id & judul jalur utama ('sql', 'SQL'). */
  primary: { id: string; title: string } | null;
  /** Buka jalur utama ('#/sql'); jalur sendiri memilih misi "Lanjutkan". */
  openPrimary: () => void;
}

const PageStatusContext = createContext<PageStatus | null>(null);

export function PageStatusProvider({ children }: { children: ReactNode }): JSX.Element {
  const state = useTrackGlance(PRIMARY);
  const glance = state.status === 'ready' ? state.glance : null;
  const ready = state.status !== 'loading';
  const mode = modeOf(glance, ready);
  const openPrimary = useCallback(() => {
    if (PRIMARY) navigate({ kind: 'track', trackId: PRIMARY.id, rest: [] });
  }, []);
  const value = useMemo<PageStatus>(
    () => ({
      glance,
      mode,
      ready,
      started: glance?.started === true,
      primaryLabel: CTA_LABEL[mode],
      primary: PRIMARY ? { id: PRIMARY.id, title: PRIMARY.title } : null,
      openPrimary,
    }),
    [glance, mode, ready, openPrimary],
  );
  return <PageStatusContext.Provider value={value}>{children}</PageStatusContext.Provider>;
}

/**
 * Teks tombol utama halaman (hero, CTA penutup) menurut status: 'resume' → `labels.resume`; semua misi tuntas →
 * teks navbar ("Buka jalur SQL"); selain itu (pengguna baru, masih memuat, ringkasan gagal) → `labels.start`.
 *
 *   <Button3D href={course.hero.cta.href}>{ctaLabelFor(course.hero.cta, status)}</Button3D>
 */
export function ctaLabelFor(labels: { start: string; resume: string }, status: Pick<PageStatus, 'mode' | 'started' | 'primaryLabel'>): string {
  if (status.mode === 'resume') return labels.resume;
  if (status.mode === 'open' && status.started) return status.primaryLabel;
  return labels.start;
}

/** Status pengguna; hanya di dalam halaman katalog/landing jalur (di bawah PageStatusProvider). */
export function usePageStatus(): PageStatus {
  const status = useContext(PageStatusContext);
  if (!status) throw new Error('usePageStatus() harus dipakai di dalam <PageStatusProvider> (dipasang pages/LandingPages.tsx untuk halaman landing)');
  return status;
}
