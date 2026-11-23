import { Hospital } from 'lucide-react';

export interface BrandMarkProps {
  /** md = header & bilah atas Beranda; lg = layar muat. */
  size?: 'md' | 'lg';
  /** Berdenyut pelan (layar muat). */
  pulse?: boolean;
}

// Kelas ditulis utuh per ukuran supaya terbaca pemindai Tailwind.
const BOX = {
  md: 'h-9 w-9 rounded-xl shadow-lg',
  lg: 'h-16 w-16 rounded-2xl shadow-xl',
} as const;
const ICON = { md: 'h-5 w-5', lg: 'h-8 w-8' } as const;

/** Lambang produk: kotak gradien emerald–teal berikon rumah sakit. Murni hiasan (nama produk ditulis pemanggil). */
export function BrandMark({ size = 'md', pulse = false }: BrandMarkProps): JSX.Element {
  return (
    <span
      className={`grid shrink-0 place-items-center bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-emerald-500/20 ${BOX[size]} ${
        pulse ? 'animate-pulse' : ''
      }`}
      aria-hidden
    >
      <Hospital className={ICON[size]} />
    </span>
  );
}
