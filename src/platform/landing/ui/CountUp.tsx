import { formatNumber } from '../lib/content';
import { useCountUp, type CountUpOptions } from '../hooks/useCountUp';
import { cn } from '../lib/cn';

export interface CountUpProps extends CountUpOptions {
  value: number;
  className?: string;
}

/**
 * Angka hitung-naik yang aksesibel: pembaca layar selalu mendapat angka akhir (sr-only), sedangkan angka yang bergerak
 * disembunyikan dari mereka. Lebar digit tetap (tabular-nums) supaya teks di sekitarnya tidak bergoyang.
 */
export function CountUp({ value, className, ...options }: CountUpProps): JSX.Element {
  const ref = useCountUp<HTMLSpanElement>(value, options);
  const format = options.format ?? formatNumber;
  return (
    <span className={cn('tabular-nums', className)}>
      <span className="sr-only">{format(value)}</span>
      <span ref={ref} aria-hidden>
        {format(options.from ?? 0)}
      </span>
    </span>
  );
}
