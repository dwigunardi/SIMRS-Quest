import { cn } from '../lib/cn';
import { CountUp } from './CountUp';

export interface StatItem {
  value: number;
  /** Satuan sesudah angka, mis. "misi", "Boss", "XP". */
  label: string;
}

export interface StatRowProps {
  items: readonly StatItem[];
  /** Nama aksesibel daftar, mis. "Jalur SQL dalam angka". */
  label?: string;
  /** md = 18px (bawaan), lg = 24px/28px. */
  size?: 'md' | 'lg';
  align?: 'start' | 'center';
  className?: string;
}

const NUMBER_SIZE = { md: 'text-lg', lg: 'text-2xl sm:text-[28px]' } as const;
const LABEL_SIZE = { md: 'text-base', lg: 'text-base sm:text-lg' } as const;

/**
 * Baris statistik: angka tebal yang dihitung naik saat terlihat (pemisah ribuan Indonesia), satuan abu, dipisah titik
 * tengah. Pembaca layar mendengar angka akhirnya ("72 misi"); titik pemisah hanya hiasan.
 *
 * Di layar sempit (< sm) butirnya disusun dua kolom tanpa titik pemisah: empat angka tidak muat sebaris, dan baris yang
 * patah di tengah meninggalkan titik menggantung di ujung baris pertama.
 *
 *   <StatRow items={course.stats} label={COURSE_UI.statsLabel(course.title)} />
 */
export function StatRow({ items, label, size = 'md', align = 'start', className }: StatRowProps): JSX.Element {
  return (
    <ul
      aria-label={label}
      className={cn(
        'm-0 grid list-none grid-cols-2 items-baseline gap-x-6 gap-y-1.5 p-0 font-q-body sm:flex sm:flex-wrap sm:gap-x-3',
        align === 'center' ? 'justify-items-center sm:justify-center' : 'justify-start',
        className,
      )}
    >
      {items.map((item, index) => (
        <li key={item.label} className="inline-flex items-baseline gap-x-3 whitespace-nowrap">
          <span>
            <CountUp value={item.value} duration={1.1} delay={0.12 * index} className={cn('font-bold text-q-ink', NUMBER_SIZE[size])} />{' '}
            <span className={cn('text-q-ink-soft', LABEL_SIZE[size])}>{item.label}</span>
          </span>
          {/* Titik menempel di belakang butir (bukan di depan butir berikutnya): saat baris patah, baris baru tidak diawali titik. */}
          {index < items.length - 1 ? (
            <span aria-hidden className="hidden text-q-ink-soft sm:inline">
              ·
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
