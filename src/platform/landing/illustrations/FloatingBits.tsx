/**
 * Benda-benda kecil yang melayang sebagai hiasan (CTA penutup, sudut section): api streak, piala, lencana, centang,
 * dan tabel data — semuanya hal yang memang ada di aplikasi. Tiap benda berupa "ubin stiker" bertepi tebal, senada
 * dengan tombol 3D. Melayang naik-turun pelan; berhenti saat reduced motion / dijeda dan selama di luar layar.
 */
import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Award, Check, Flame, Table2, Trophy, type LucideIcon } from 'lucide-react';
import { useLoopMotion } from '../hooks/usePrefersReducedMotion';
import { cn } from '../lib/cn';

export type BitKind = 'flame' | 'trophy' | 'badge' | 'check' | 'table';

const BIT: Record<BitKind, { Icon: LucideIcon; tile: string; edge: string; fill: boolean }> = {
  flame: { Icon: Flame, tile: 'bg-q-amber-soft text-q-amber border-q-amber/50', edge: 'rgb(var(--q-amber) / 0.5)', fill: true },
  trophy: { Icon: Trophy, tile: 'bg-q-amber text-q-on-amber border-q-on-amber/20', edge: 'rgb(var(--q-on-amber) / 0.45)', fill: false },
  badge: { Icon: Award, tile: 'bg-q-brand text-white border-white/30', edge: 'rgb(var(--q-brand-ink) / 0.9)', fill: false },
  check: { Icon: Check, tile: 'bg-q-success text-q-on-success border-q-on-success/20', edge: 'rgb(var(--q-on-success) / 0.45)', fill: false },
  table: { Icon: Table2, tile: 'bg-q-surface text-q-primary-ink border-q-border', edge: 'rgb(var(--q-border-strong) / 0.6)', fill: false },
};

export interface BitProps {
  kind: BitKind;
  /** Sisi ubin dalam px (bawaan 56). */
  size?: number;
  className?: string;
}

/** Satu ubin stiker (diam). Hiasan: aria-hidden. */
export function Bit({ kind, size = 56, className }: BitProps): JSX.Element {
  const { Icon, tile, edge, fill } = BIT[kind];
  return (
    <span
      aria-hidden
      className={cn('grid place-items-center rounded-[30%] border-2', tile, className)}
      style={{ width: size, height: size, boxShadow: `0 ${Math.max(3, Math.round(size / 14))}px 0 ${edge}` }}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.4} fill={fill ? 'currentColor' : 'none'} fillOpacity={fill ? 0.3 : undefined} />
    </span>
  );
}

export interface FloatingBitItem {
  kind: BitKind;
  /** Kelas posisi (wadahnya absolute inset-0), mis. 'left-[6%] top-[18%]'. Boleh berisi kelas hidden/sm:block. */
  className: string;
  size?: number;
  /** Kemiringan awal (derajat). */
  tilt?: number;
  /** Jeda mulai (detik) supaya tidak bergerak serempak. */
  delay?: number;
}

/** Susunan bawaan: lima benda di tepi kiri & kanan, menyisakan tengah untuk teks. */
export const DEFAULT_BITS: readonly FloatingBitItem[] = [
  { kind: 'flame', className: 'left-[4%] top-[14%]', size: 60, tilt: -10, delay: 0 },
  { kind: 'table', className: 'left-[12%] bottom-[18%] hidden sm:block', size: 52, tilt: 8, delay: 0.8 },
  { kind: 'trophy', className: 'right-[5%] top-[10%]', size: 64, tilt: 9, delay: 0.4 },
  { kind: 'check', className: 'right-[14%] bottom-[22%] hidden sm:block', size: 48, tilt: -8, delay: 1.2 },
  { kind: 'badge', className: 'left-[24%] top-[6%] hidden lg:block', size: 44, tilt: 12, delay: 1.6 },
];

export interface FloatingBitsProps {
  items?: readonly FloatingBitItem[];
  className?: string;
}

/**
 * Lapisan hiasan: taruh di dalam wadah `relative` (lapisan ini absolute inset-0, tidak menangkap klik).
 * Pastikan wadahnya memotong luapan (Section sudah overflow-x-clip).
 */
export function FloatingBits({ items = DEFAULT_BITS, className }: FloatingBitsProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const floating = useLoopMotion(ref);
  return (
    <div ref={ref} aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      {items.map((item, index) => {
        const tilt = item.tilt ?? 0;
        return (
          <motion.div
            key={`${item.kind}-${index}`}
            className={cn('absolute', item.className)}
            style={{ rotate: tilt }}
            // Diam = nilai eksplisit + durasi 0 (animate={undefined} akan terus berulang dengan transition lama).
            animate={floating ? { y: [0, -12, 0], rotate: [tilt, tilt + 4, tilt] } : { y: 0, rotate: tilt }}
            transition={floating ? { duration: 5 + (index % 3), delay: item.delay ?? 0, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
          >
            <Bit kind={item.kind} size={item.size} />
          </motion.div>
        );
      })}
    </div>
  );
}
