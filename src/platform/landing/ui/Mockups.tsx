/**
 * Bingkai mockup perangkat: jendela browser dan ponsel. Isinya (children) disusun pada ukuran dasar tetap lalu
 * DISKALAKAN mengikuti lebar wadah — tidak pernah dipotong — sehingga mockup terlihat sama di semua lebar layar.
 *
 * Isi mockup adalah ilustrasi, bukan antarmuka sungguhan: beri `label` supaya pembaca layar mendapat satu kalimat
 * penjelasan (role="img") alih-alih membaca tombol-tombol tiruan.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/* ------------------------------------------------------------------ */
/* ScaledFrame                                                         */
/* ------------------------------------------------------------------ */

export interface ScaledFrameProps {
  /** Ukuran dasar isi (px). Isi dirender pada ukuran ini lalu diskalakan agar selebar wadah. */
  baseWidth: number;
  baseHeight: number;
  children: ReactNode;
  /** Kelas wadah luar — atur LEBAR di sini (mis. 'w-full max-w-[640px]'); tingginya mengikuti rasio. */
  className?: string;
}

/** Wadah berasio tetap yang menskalakan isinya (transform: scale) mengikuti lebar wadah. */
export function ScaledFrame({ baseWidth, baseHeight, children, className }: ScaledFrameProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const update = () => {
      const width = element.clientWidth;
      if (width > 0) setScale(width / baseWidth);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [baseWidth]);

  return (
    <div ref={ref} className={cn('relative w-full', className)} style={{ aspectRatio: `${baseWidth} / ${baseHeight}` }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: baseWidth, height: baseHeight, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BrowserMockup                                                       */
/* ------------------------------------------------------------------ */

export interface BrowserMockupProps {
  children: ReactNode;
  /** Teks di bilah alamat. */
  url?: string;
  /** Penjelasan untuk pembaca layar; bila diisi, seluruh mockup dianggap satu gambar. */
  label?: string;
  /**
   * Ukuran dasar ISI (di bawah bilah browser). Bila diisi, isi diskalakan mengikuti lebar mockup; bila tidak, isi
   * mengalir biasa (responsif sendiri).
   */
  baseWidth?: number;
  baseHeight?: number;
  /** Kelas wadah luar (atur lebar di sini). */
  className?: string;
  /** Kelas area isi. Bawaan: latar gelap layar jalur. */
  bodyClassName?: string;
}

/** Jendela browser: bilah dengan tiga titik + alamat, lalu isi. Sudut 24px, bayangan mengambang. */
export function BrowserMockup({ children, url, label, baseWidth, baseHeight, className, bodyClassName }: BrowserMockupProps): JSX.Element {
  const body = cn('q-on-dark bg-q-code-deep text-q-code-ink', bodyClassName);
  return (
    <div
      role={label !== undefined ? 'img' : undefined}
      aria-label={label}
      className={cn('overflow-hidden rounded-q-lg border border-q-border bg-q-surface shadow-q-float', className)}
    >
      <div aria-hidden className="flex h-10 items-center gap-3 border-b border-q-border bg-q-muted px-4">
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-q-coral" />
          <span className="h-2.5 w-2.5 rounded-full bg-q-amber" />
          <span className="h-2.5 w-2.5 rounded-full bg-q-success" />
        </span>
        {url !== undefined ? (
          <span className="mx-auto flex h-6 min-w-0 max-w-[70%] items-center truncate rounded-q-pill border border-q-border bg-q-surface px-3 font-q-body text-xs text-q-ink-soft">
            <span className="truncate">{url}</span>
          </span>
        ) : null}
        {/* penyeimbang lebar titik-titik supaya alamat tepat di tengah */}
        <span className="w-[42px] shrink-0" />
      </div>
      {baseWidth !== undefined && baseHeight !== undefined ? (
        <ScaledFrame baseWidth={baseWidth} baseHeight={baseHeight}>
          <div className={cn('h-full w-full overflow-hidden', body)}>{children}</div>
        </ScaledFrame>
      ) : (
        <div className={body}>{children}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PhoneMockup                                                         */
/* ------------------------------------------------------------------ */

/** Ukuran dasar ponsel (termasuk bezel). Layar di dalamnya 280 × 600. */
export const PHONE_BASE = { width: 300, height: 620, screenWidth: 280, screenHeight: 600 } as const;

export interface PhoneMockupProps {
  /** Isi layar, disusun untuk lebar 280px × tinggi 600px (40px teratas berada di belakang dynamic island). */
  children: ReactNode;
  /** Penjelasan untuk pembaca layar; bila diisi, seluruh mockup dianggap satu gambar. */
  label?: string;
  /** Kelas wadah luar — atur LEBAR ponsel di sini (mis. 'w-[220px] sm:w-[280px]'). */
  className?: string;
  /** Kelas layar. Bawaan: latar gelap layar jalur. */
  screenClassName?: string;
}

/** Ponsel: bezel gelap bersudut bulat, dynamic island, tombol samping. Diskalakan mengikuti lebar wadah. */
export function PhoneMockup({ children, label, className, screenClassName }: PhoneMockupProps): JSX.Element {
  return (
    <ScaledFrame baseWidth={PHONE_BASE.width} baseHeight={PHONE_BASE.height} className={className}>
      <div role={label !== undefined ? 'img' : undefined} aria-label={label} className="relative h-full w-full">
        {/* tombol samping */}
        <span aria-hidden className="absolute -left-[3px] top-[110px] h-8 w-[3px] rounded-l bg-slate-700" />
        <span aria-hidden className="absolute -left-[3px] top-[160px] h-14 w-[3px] rounded-l bg-slate-700" />
        <span aria-hidden className="absolute -right-[3px] top-[140px] h-20 w-[3px] rounded-r bg-slate-700" />
        {/* bezel */}
        <div className="h-full w-full rounded-[46px] bg-slate-950 p-[10px] shadow-q-float ring-1 ring-inset ring-slate-600">
          <div className={cn('q-on-dark relative h-full w-full overflow-hidden rounded-[36px] bg-q-code-deep text-q-code-ink', screenClassName)}>
            <span aria-hidden className="absolute left-1/2 top-[10px] z-10 h-[24px] w-[88px] -translate-x-1/2 rounded-full bg-black" />
            {children}
          </div>
        </div>
      </div>
    </ScaledFrame>
  );
}
