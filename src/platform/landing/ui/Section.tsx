import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface ContainerProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'header' | 'footer' | 'nav';
}

/** Lebar konten landing: maks 1240px, padding samping 20px, di tengah. */
export function Container({ children, className, as: Tag = 'div' }: ContainerProps): JSX.Element {
  return <Tag className={cn('mx-auto w-full max-w-q-content px-q-gutter', className)}>{children}</Tag>;
}

const TONE = {
  /** Latar halaman. */
  default: 'bg-q-bg text-q-ink',
  /** Mint. */
  tint: 'bg-q-tint text-q-ink',
  /** Pita hijau pinus; teks terang, garis fokus terang. */
  band: 'q-on-dark bg-q-band text-q-band-ink',
  footer: 'bg-q-footer text-q-ink',
} as const;

const SPACING = {
  /** 96px (120px mulai lg) atas-bawah. */
  default: 'py-q-section lg:py-q-section-lg',
  /** Strip pendek. */
  tight: 'py-12 lg:py-16',
  none: '',
} as const;

export interface SectionProps {
  children: ReactNode;
  /** id elemen (SECTION_IDS dari lib/content.ts) — sasaran scrollToSection(). */
  id?: string;
  tone?: keyof typeof TONE;
  spacing?: keyof typeof SPACING;
  /** id judul section (SectionHeading id=...) supaya section punya nama aksesibel. */
  labelledBy?: string;
  /** Pengganti labelledBy bila section tidak punya judul yang terlihat. */
  ariaLabel?: string;
  /** true = isi tidak dibungkus Container (untuk elemen selebar layar, mis. marquee). */
  bleed?: boolean;
  /**
   * Untuk section ber-spacing 'none' yang mengatur padding atasnya sendiri lewat className: ikut aturan "jarak tunggal"
   * (lihat komentar komponen). Section ber-spacing 'default'/'tight' otomatis ikut.
   */
  gap?: boolean;
  className?: string;
  /** Kelas untuk Container di dalamnya. */
  containerClassName?: string;
}

/**
 * Satu <section> landing: latar selebar layar + Container di dalamnya. overflow-x dipotong di sini supaya hiasan yang
 * keluar bingkai tidak pernah memunculkan gulir mendatar. Jarak dari navbar yang menempel saat digulir ke sebuah section
 * diatur sekali untuk seluruh halaman (scroll-padding-top di styles/landing.css).
 *
 * Jarak tunggal: dua section BERLATAR SAMA yang bersebelahan hanya dipisah satu jarak (padding bawah section pertama),
 * bukan padding bawah + padding atas — aturannya di styles/landing.css, memakai data-q-tone & data-q-gap di sini.
 * Dengan begitu jarak antar-section seragam, siapa pun yang menyusun urutannya.
 */
export function Section({ children, id, tone = 'default', spacing = 'default', labelledBy, ariaLabel, bleed = false, gap, className, containerClassName }: SectionProps): JSX.Element {
  const joins = gap ?? spacing !== 'none';
  return (
    <section id={id} aria-labelledby={labelledBy} aria-label={ariaLabel} data-q-tone={tone} data-q-gap={joins ? '' : undefined} className={cn('relative overflow-x-clip', TONE[tone], SPACING[spacing], className)}>
      {bleed ? children : <Container className={containerClassName}>{children}</Container>}
    </section>
  );
}
