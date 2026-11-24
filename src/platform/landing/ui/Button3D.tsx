import { forwardRef, type ForwardedRef, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../lib/cn';
import { spring } from '../lib/motion';

const button = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-q border-2 font-q-body font-bold uppercase tracking-[0.06em] no-underline transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'border-transparent bg-q-primary text-q-on-primary hover:bg-q-primary-hover',
        outline: 'border-q-border bg-q-surface text-q-primary-ink hover:bg-q-muted',
      },
      size: {
        /** 36px */
        sm: 'h-9 px-4 text-[13px]',
        /** 44px */
        md: 'h-11 px-6 text-sm',
        /** 52px: CTA hero & penutup */
        lg: 'h-[52px] px-8 text-base',
      },
      fullWidth: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', fullWidth: false },
  },
);

/** Bayangan "tombol 3D": tepi bawah setebal 4px yang hilang saat ditekan. */
const SHADOW = {
  primary: { rest: '0px 4px 0px 0px rgb(var(--q-primary-shadow))', pressed: '0px 0px 0px 0px rgb(var(--q-primary-shadow))' },
  outline: { rest: '0px 4px 0px 0px rgb(var(--q-border))', pressed: '0px 0px 0px 0px rgb(var(--q-border))' },
} as const;

interface CommonProps extends VariantProps<typeof button> {
  children: ReactNode;
  /** Ikon di kiri / kanan teks (beri aria-hidden pada ikonnya). */
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
}

type ButtonOnlyProps = Omit<HTMLMotionProps<'button'>, 'children' | 'className' | 'ref'> & { href?: undefined };
type LinkOnlyProps = Omit<HTMLMotionProps<'a'>, 'children' | 'className' | 'ref'> & { href: string };

export type Button3DProps = CommonProps & (ButtonOnlyProps | LinkOnlyProps);

/**
 * Tombol utama landing bergaya 3D: naik 2px saat disorot, turun 4px saat ditekan (bayangan bawahnya ikut hilang).
 * Dengan `href` dirender sebagai <a> (tautan), tanpa `href` sebagai <button type="button">.
 * Sisakan ruang 4px di bawahnya — bayangan tidak ikut dihitung tata letak.
 */
export const Button3D = forwardRef(function Button3D(
  props: Button3DProps,
  ref: ForwardedRef<HTMLButtonElement | HTMLAnchorElement>,
): JSX.Element {
  const { children, iconLeft, iconRight, className, variant, size, fullWidth, ...rest } = props;
  const shadow = SHADOW[variant ?? 'primary'];
  const classes = cn(button({ variant, size, fullWidth }), className);
  const content = (
    <>
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </>
  );

  if (rest.href !== undefined) {
    const { style, ...anchor } = rest;
    return (
      <motion.a
        ref={ref as ForwardedRef<HTMLAnchorElement>}
        className={classes}
        rel={anchor.target === '_blank' ? 'noreferrer noopener' : undefined}
        whileHover={{ y: -2 }}
        whileTap={{ y: 4, boxShadow: shadow.pressed }}
        transition={spring}
        {...anchor}
        style={{ boxShadow: shadow.rest, ...style }}
      >
        {content}
      </motion.a>
    );
  }
  const { style, type, ...buttonProps } = rest;
  return (
    <motion.button
      ref={ref as ForwardedRef<HTMLButtonElement>}
      type={type ?? 'button'}
      className={classes}
      whileHover={{ y: -2 }}
      whileTap={{ y: 4, boxShadow: shadow.pressed }}
      transition={spring}
      {...buttonProps}
      style={{ boxShadow: shadow.rest, ...style }}
    >
      {content}
    </motion.button>
  );
});
