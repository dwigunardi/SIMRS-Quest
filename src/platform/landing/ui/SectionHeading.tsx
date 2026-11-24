import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface SectionHeadingProps {
  title: ReactNode;
  /** Satu-dua kalimat di bawah judul. */
  lead?: ReactNode;
  /** h2 = judul section (bawaan), h3 = judul di dalam section. */
  as?: 'h2' | 'h3';
  /** lg = 44px (32px di mobile); sm = 22px. Bawaan mengikuti `as` (h2 → lg, h3 → sm). */
  size?: 'lg' | 'sm';
  align?: 'center' | 'start';
  /** id judul, untuk <Section labelledBy>. */
  id?: string;
  /** onBand = di atas pita hijau pinus / latar gelap tetap. */
  tone?: 'default' | 'onBand';
  className?: string;
}

/**
 * Judul section: Varela Round tebal (tebal sintetis browser, sesuai rancangan), 44px/32px, dengan kalimat pembuka
 * abu-abu selebar bacaan nyaman. Halaman hanya punya SATU h1 (di hero) — komponen ini tidak pernah merender h1.
 */
export function SectionHeading({ title, lead, as, size, align = 'center', id, tone = 'default', className }: SectionHeadingProps): JSX.Element {
  const Tag = as ?? 'h2';
  const scale = size ?? (Tag === 'h2' ? 'lg' : 'sm');
  return (
    <div className={cn('flex flex-col gap-4', align === 'center' ? 'items-center text-center' : 'items-start text-left', className)}>
      <Tag
        id={id}
        className={cn(
          'text-balance font-q-body font-bold',
          scale === 'lg' ? 'max-w-[20ch] text-q-h2-sm sm:max-w-[24ch] lg:text-q-h2' : 'text-q-h3',
          tone === 'onBand' ? 'text-q-band-ink' : 'text-q-ink',
        )}
      >
        {title}
      </Tag>
      {lead !== undefined ? (
        <p className={cn('max-w-[60ch] text-pretty text-base leading-relaxed', tone === 'onBand' ? 'text-q-band-soft' : 'text-q-ink-soft')}>{lead}</p>
      ) : null}
    </div>
  );
}
