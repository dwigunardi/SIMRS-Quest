import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const pill = cva('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-q-pill border font-q-body leading-none', {
  variants: {
    tone: {
      /** Abu lembut: keterangan biasa. */
      neutral: 'border-transparent bg-q-muted text-q-ink-soft',
      /** Putih/kartu: pill di atas pita (band) atau latar berwarna. */
      surface: 'border-q-border bg-q-surface text-q-ink',
      /** Hijau lembut: topik, hal yang tersedia. */
      primary: 'border-transparent bg-q-tint text-q-primary-ink',
      /** Hijau penuh. */
      solid: 'border-transparent bg-q-primary text-q-on-primary',
      amber: 'border-transparent bg-q-amber-soft text-q-amber-ink',
      coral: 'border-transparent bg-q-coral-soft text-q-coral-ink',
      success: 'border-transparent bg-q-success-soft text-q-success-ink',
      /** Garis putus-putus: "Segera". */
      soon: 'border-dashed border-q-border-strong bg-transparent text-q-ink-soft',
    },
    size: {
      sm: 'h-6 px-2.5 text-xs',
      md: 'h-8 px-3.5 text-sm',
      lg: 'h-10 px-4 text-[15px]',
    },
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
});

export type PillTone = NonNullable<VariantProps<typeof pill>['tone']>;

export interface PillProps extends VariantProps<typeof pill> {
  children: ReactNode;
  /** Ikon di kiri teks. */
  icon?: ReactNode;
  as?: 'span' | 'li' | 'div';
  className?: string;
}

/**
 * Chip/pill tak-interaktif: label topik, status "Segera", XP, dan sejenisnya.
 * Untuk pilihan yang bisa diklik pakai <Tabs variant="pill">.
 */
export function Pill({ children, icon, as: Tag = 'span', tone, size, className }: PillProps): JSX.Element {
  return (
    <Tag className={cn(pill({ tone, size }), className)}>
      {icon}
      {children}
    </Tag>
  );
}
