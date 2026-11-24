/**
 * Bagian landing di bawah lipatan (bagian 4–13), dalam SATU chunk yang dimuat malas oleh Home.tsx — supaya hero tampil
 * tanpa menunggu korsel, mockup, dan peta tier. Latar mint dipakai berselang (bagian 6, 8, 11); section putih yang
 * bersebelahan dipisah satu jarak saja (lihat ui/Section.tsx).
 */
import { useEffect } from 'react';
import type { TrackGlance } from '../tracks';
import { CatalogStrip } from './sections/CatalogStrip';
import { Devices } from './sections/Devices';
import { FAQ } from './sections/FAQ';
import { FinalCTA } from './sections/FinalCTA';
import { Gamification } from './sections/Gamification';
import { MascotHint } from './sections/MascotHint';
import { PracticeSection } from './sections/PracticeSection';
import { Ranks } from './sections/Ranks';
import { Roadmap } from './sections/Roadmap';
import { ShowcaseSection } from './sections/ShowcaseSection';

export interface LandingBelowProps {
  /** Ringkasan jalur utama; null selama dimuat atau bila gagal dimuat. */
  glance: TrackGlance | null;
  /** Tombol utama CTA penutup ditekan. */
  onStart: () => void;
  /** Dipanggil sekali setelah semua bagian terpasang (tinggi halaman sudah final): dipakai memulihkan posisi gulir. */
  onReady?: () => void;
}

export default function LandingBelow({ glance, onStart, onReady }: LandingBelowProps): JSX.Element {
  useEffect(() => {
    onReady?.();
    // Hanya saat terpasang (onReady tidak perlu memicu ulang).
  }, []);
  return (
    <>
      <Roadmap glance={glance} />
      <CatalogStrip />
      <PracticeSection />
      <ShowcaseSection />
      <Ranks />
      <Gamification glance={glance} />
      <MascotHint />
      <Devices tone="tint" />
      <FAQ />
      <FinalCTA started={glance?.started ?? null} glance={glance} onStart={onStart} />
    </>
  );
}
