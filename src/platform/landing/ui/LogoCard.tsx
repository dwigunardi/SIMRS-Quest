/**
 * Kartu logo putih membulat yang dimiringkan dan melayang pelan (y ±8 px, satu putaran 6 dtk). Dipakai di hero
 * landing jalur (satu kartu besar, radius 40 px) dan hero katalog (enam kartu kecil yang melayang bergantian lewat
 * `delay`). Opsional: parallax ringan saat halaman digulir.
 *
 *   <LogoCard icons={course.hero.logos} size="xl" tilt={-3} parallax={40} label={COURSE_UI.heroCardLabel(course.title)} />
 *   <LogoCard icons={['table']} size="md" tilt={4} delay={1.2} caption="Database SIMRS" sub="8 tabel" />
 *
 * Gerak melayang berhenti bila sistem meminta gerak dikurangi, bila pengguna menekan "Jeda animasi" di navbar, dan
 * selama kartu di luar layar (useLoopMotion). Parallax juga mati saat gerak dikurangi/dijeda. Hanya transform.
 */
import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useLoopMotion, usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import type { IconName } from '../lib/content';
import { cn } from '../lib/cn';
import { Icon } from './Icon';

export interface LogoCardProps {
  /** 1–3 logo (lucide atau simple-icons "si-…"). */
  icons: readonly IconName[];
  /** sm 64 px · md 96 px · lg 144 px · xl 224/256 px (radius 40 px). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Kemiringan dalam derajat (bawaan -3). */
  tilt?: number;
  /** Melayang (bawaan true). */
  float?: boolean;
  /** Jeda awal gerak melayang (detik) — beri nilai berbeda supaya beberapa kartu melayang bergantian. */
  delay?: number;
  /** Geser ke atas sejauh ini (px) selama 700 px pertama halaman digulir; 0 = tanpa parallax. */
  parallax?: number;
  /** Dengan label: kartu = gambar bernama (role="img"). Tanpa label: hiasan (aria-hidden). */
  label?: string;
  /** Teks di bawah logo, mis. "Database SIMRS". */
  caption?: string;
  /** Teks kecil di bawah caption, mis. "8 tabel". */
  sub?: string;
  /**
   * Hiasan yang ikut melayang & miring bersama kartu, diposisikan absolut terhadap kartunya (mis. Kapi yang mengintip
   * dari tepi atas). Diletakkan sesudah logo, jadi tergambar di atas tepi kartu.
   */
  children?: ReactNode;
  className?: string;
}

/** one = satu logo, many = dua logo, three = tiga logo (harus muat di lebar dalam kartu: kotak dikurangi p-3 kiri-kanan). */
const SIZE = {
  sm: { box: 'h-16 w-16 rounded-[20px]', one: 'h-7 w-7', many: 'h-5 w-5', three: 'h-2.5 w-2.5', gap: 'gap-1', caption: 'text-[10px]' },
  md: { box: 'h-24 w-24 rounded-[28px]', one: 'h-10 w-10', many: 'h-7 w-7', three: 'h-5 w-5', gap: 'gap-1.5', caption: 'text-[11px]' },
  lg: { box: 'h-36 w-36 rounded-[34px]', one: 'h-16 w-16', many: 'h-11 w-11', three: 'h-8 w-8', gap: 'gap-2', caption: 'text-sm' },
  xl: { box: 'h-56 w-56 rounded-[40px] sm:h-64 sm:w-64', one: 'h-24 w-24 sm:h-28 sm:w-28', many: 'h-14 w-14 sm:h-16 sm:w-16', three: 'h-14 w-14 sm:h-16 sm:w-16', gap: 'gap-3', caption: 'text-base' },
} as const;

/**
 * Warna logo. Logo teknologi memakai warna mereknya (hiasan, bukan teks); Next.js hitam-putih mengikuti tinta tema.
 * Ikon lucide memakai hijau tema. Kelas ditulis utuh supaya terbaca pemindai Tailwind.
 */
const LOGO_TONE: Partial<Record<IconName, string>> = {
  'si-javascript': 'text-[#F7DF1E]',
  'si-typescript': 'text-[#3178C6]',
  'si-react': 'text-[#149ECA]',
  'si-nestjs': 'text-[#E0234E]',
  'si-nextdotjs': 'text-q-ink',
  'si-laravel': 'text-[#FF2D20]',
};

function Logo({ name, className }: { name: IconName; className: string }): JSX.Element {
  const tone = LOGO_TONE[name] ?? 'text-q-primary-ink';
  if (name === 'si-javascript') {
    // Logo JS = kotak kuning dengan huruf berlubang: alas gelap di belakangnya membuat hurufnya hitam seperti aslinya.
    return (
      <span className={cn('relative inline-grid shrink-0 place-items-center', className)}>
        <span className="absolute inset-[14%] rounded-[2px] bg-[#1F1F1F]" />
        <Icon name={name} className={cn('relative h-full w-full', tone)} />
      </span>
    );
  }
  return <Icon name={name} className={cn(className, tone)} />;
}

export function LogoCard({ icons, size = 'md', tilt = -3, float = true, delay = 0, parallax = 0, label, caption, sub, children, className }: LogoCardProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const looping = useLoopMotion(ref, float);
  const reduced = usePrefersReducedMotion();
  const { scrollY } = useScroll();
  const shift = useTransform(scrollY, [0, 700], [0, -parallax]);
  const scale = SIZE[size];
  let iconClass: string = scale.one;
  if (icons.length >= 3) iconClass = scale.three;
  else if (icons.length === 2) iconClass = scale.many;

  return (
    <motion.div
      ref={ref}
      style={parallax > 0 && !reduced ? { y: shift } : undefined}
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      className={cn('relative inline-block', className)}
      data-floating={looping ? 'running' : 'paused'}
    >
      <motion.div
        animate={looping ? { y: [0, -8, 0, 8, 0] } : { y: 0 }}
        transition={looping ? { duration: 6, ease: 'easeInOut', repeat: Infinity, delay } : { duration: 0.4, ease: 'easeOut' }}
      >
        <div
          style={{ transform: `rotate(${tilt}deg)` }}
          className={cn('relative flex flex-col items-center justify-center gap-2 border border-q-border bg-q-surface p-3 text-center shadow-q-float', scale.box)}
        >
          <span className={cn('flex items-center justify-center', scale.gap)}>
            {icons.map((name) => (
              <Logo key={name} name={name} className={iconClass} />
            ))}
          </span>
          {caption !== undefined ? (
            <span className={cn('flex flex-col leading-tight', scale.caption)}>
              <span className="font-bold text-q-ink">{caption}</span>
              {sub !== undefined ? <span className="text-q-ink-soft">{sub}</span> : null}
            </span>
          ) : null}
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
