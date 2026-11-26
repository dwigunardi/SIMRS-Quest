import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import type { IconName } from '../lib/content';
import { cn } from '../lib/cn';
import { Icon } from './Icon';

const chip = cva(
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-q-pill font-q-body font-bold uppercase leading-none tracking-[0.08em] no-underline',
  {
    variants: {
      tone: {
        /** Abu (bawaan): hitungan, keterangan. */
        neutral: 'bg-q-muted text-q-ink-soft',
        /** Mint: hal yang tersedia / aktif. */
        primary: 'bg-q-tint text-q-primary-ink',
        amber: 'bg-q-amber-soft text-q-amber-ink',
        coral: 'bg-q-coral-soft text-q-coral-ink',
        /** Putih bergaris: di atas latar berwarna (mint, gradien hero). */
        surface: 'border border-q-border bg-q-surface text-q-ink-soft',
      },
      size: {
        /** 24px */
        sm: 'h-6 px-2.5 text-[11px]',
        /** 28px */
        md: 'h-7 px-3 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'sm' },
  },
);

export type ChipTone = NonNullable<VariantProps<typeof chip>['tone']>;

export interface ChipProps extends VariantProps<typeof chip> {
  children: ReactNode;
  /** Ikon di kiri teks (hiasan). */
  icon?: IconName;
  /** Dengan href: chip menjadi tautan (mis. chip jalur di baris "Terhubung dengan"). */
  href?: string;
  as?: 'span' | 'li';
  className?: string;
  /** Penanda uji, mis. { 'data-track': 'js' }. */
  data?: Readonly<Record<`data-${string}`, string>>;
}

/**
 * Chip kecil berhuruf kapital: "8 MISI", "1 BOSS", "LANGKAH 2", chip jalur. Abu bawaan; teks ditulis kalimat biasa
 * (kapital dibuat CSS, jadi pembaca layar membaca kata biasa). Untuk label status/topik yang lebih besar pakai <Pill>.
 */
export function Chip({ children, icon, href, as: Tag = 'span', tone, size, className, data }: ChipProps): JSX.Element {
  const classes = cn(chip({ tone, size }), className);
  const body = (
    <>
      {icon !== undefined ? <Icon name={icon} className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} /> : null}
      {children}
    </>
  );
  if (href === undefined) {
    return (
      <Tag className={classes} {...data}>
        {body}
      </Tag>
    );
  }
  const link = (
    <a href={href} className={cn(classes, 'transition-colors duration-150 hover:bg-q-tint hover:text-q-primary-ink')} {...data}>
      {body}
    </a>
  );
  return Tag === 'li' ? <li className="inline-flex">{link}</li> : link;
}
