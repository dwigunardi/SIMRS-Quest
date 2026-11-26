import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface EyebrowProps {
  children: ReactNode;
  /** center (bawaan) = garis di kiri & kanan; start = garis hanya di kanan. */
  align?: 'center' | 'start';
  /** Tampilkan garis (bawaan true). */
  lines?: boolean;
  /** primary = hijau (bawaan), soft = abu. */
  tone?: 'primary' | 'soft';
  as?: 'p' | 'span' | 'div';
  id?: string;
  className?: string;
}

const LINE = 'h-px w-8 shrink-0 bg-current opacity-40 sm:w-14';

/**
 * Label kecil berhuruf kapital di atas judul section, diapit garis tipis (bagian C5 "APA YANG KAMU DAPAT"). Teks ditulis
 * kalimat biasa; kapital dibuat CSS. Garisnya hiasan.
 *
 *   <Eyebrow>{course.promise.eyebrow}</Eyebrow>
 *   <SectionHeading title={course.promise.title} />
 */
export function Eyebrow({ children, align = 'center', lines = true, tone = 'primary', as: Tag = 'p', id, className }: EyebrowProps): JSX.Element {
  return (
    <Tag
      id={id}
      className={cn(
        'm-0 flex items-center gap-3 font-q-body text-[13px] font-bold uppercase leading-none tracking-[0.14em]',
        align === 'center' ? 'justify-center text-center' : 'justify-start text-left',
        tone === 'primary' ? 'text-q-primary-ink' : 'text-q-ink-soft',
        className,
      )}
    >
      {lines && align === 'center' ? <span aria-hidden className={LINE} /> : null}
      <span>{children}</span>
      {lines ? <span aria-hidden className={LINE} /> : null}
    </Tag>
  );
}
