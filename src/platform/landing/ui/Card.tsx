import { forwardRef, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const card = cva('relative', {
  variants: {
    tone: {
      /** Kartu biasa di atas latar halaman. */
      surface: 'bg-q-surface text-q-ink',
      /** Isian netral lembut. */
      muted: 'bg-q-muted text-q-ink',
      /** Mint. */
      tint: 'bg-q-tint text-q-ink',
      /** Gelap tetap (seperti layar jalur): untuk potongan mockup aplikasi. */
      code: 'q-on-dark bg-q-code-bg text-q-code-ink',
    },
    radius: {
      /** 12px: kartu & kontrol. */
      md: 'rounded-q',
      /** 24px: kartu besar & mockup. */
      lg: 'rounded-q-lg',
    },
    border: { true: 'border', false: '' },
    shadow: {
      none: '',
      /** Bayangan mengambang baku landing. */
      float: 'shadow-q-float',
    },
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-5 sm:p-6',
      lg: 'p-6 sm:p-8',
    },
  },
  compoundVariants: [
    { border: true, tone: ['surface', 'muted', 'tint'], class: 'border-q-border' },
    { border: true, tone: 'code', class: 'border-q-code-border' },
  ],
  defaultVariants: { tone: 'surface', radius: 'md', border: true, shadow: 'none', padding: 'md' },
});

type CardTag = 'div' | 'article' | 'section' | 'li' | 'aside' | 'figure';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'children'>, VariantProps<typeof card> {
  children: ReactNode;
  as?: CardTag;
}

/** Wadah kartu landing. Semua varian memakai token q, jadi ikut tema terang/gelap. */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { children, as = 'div', tone, radius, border, shadow, padding, className, ...rest },
  ref,
): JSX.Element {
  const Tag = as as 'div';
  return (
    <Tag ref={ref as Ref<HTMLDivElement>} className={cn(card({ tone, radius, border, shadow, padding }), className)} {...rest}>
      {children}
    </Tag>
  );
});
