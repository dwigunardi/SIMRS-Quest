import { PRODUCT_NAME } from '../../../brand';
import { cn } from '../../lib/cn';

export interface WordmarkProps {
  /** md = navbar, sm = footer. */
  size?: 'sm' | 'md';
  className?: string;
}

const MARK = { sm: 'h-6 w-6', md: 'h-7 w-7' } as const;
/**
 * Navbar: teal merek (logotype). Footer: teal versi teks (brand-ink) — ukurannya kecil dan latar footer lebih gelap,
 * teal merek di sana hanya 2,26:1; brand-ink 5,77:1 (terang) / 10,12:1 (gelap).
 */
const TEXT = { sm: 'text-[15px] text-q-brand-ink', md: 'text-[17px] text-q-brand' } as const;

/**
 * Logo kecil + wordmark SIMRS Quest: kapsul dua warna yang miring (bentuk dasar maskot Kapi, tanpa wajah) dan nama
 * produk dengan font display. Gambarnya hiasan; nama produk tetap berupa teks.
 */
export function Wordmark({ size = 'md', className }: WordmarkProps): JSX.Element {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg aria-hidden focusable="false" viewBox="0 0 32 32" className={cn('shrink-0', MARK[size])}>
        <g transform="rotate(38 16 16)">
          <path d="M9 16 V11 a7 7 0 0 1 14 0 V16 Z" fill="#14B8A6" />
          <path d="M9 16 V21 a7 7 0 0 0 14 0 V16 Z" fill="#FFFDF5" />
          <rect x={9} y={4} width={14} height={24} rx={7} fill="none" className="stroke-q-mascot-line" strokeWidth={2.4} />
          <line x1={9.6} y1={16} x2={22.4} y2={16} className="stroke-q-mascot-line" strokeWidth={2.2} />
          <path d="M12.6 9.2 q-1 2 -1 4" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
        </g>
      </svg>
      <span className={cn('whitespace-nowrap font-q-display font-extrabold leading-none tracking-[0.01em]', TEXT[size])}>{PRODUCT_NAME}</span>
    </span>
  );
}
