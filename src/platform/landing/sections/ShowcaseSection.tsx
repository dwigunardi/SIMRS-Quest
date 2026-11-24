/**
 * Bagian 7 — "Lihat apa yang nanti bisa kamu lakukan.": korsel (embla) berisi contoh keluaran yang dibangun dari
 * query sungguhan di database latihan. Tiap slide: query di baliknya (CodeWindow) → tablet berisi cincin progres,
 * dua kartu statistik, dan diagram batang per poli.
 *
 * Kejujuran: aplikasi menampilkan hasil query sebagai TABEL, bukan dasbor — karena itu tablet diberi chip "Contoh"
 * dan OUTCOMES.note selalu tampil di bawah korsel. Semua angka berasal dari content.ts (diperiksa `npm run verify`).
 *
 * Putar otomatis hanya saat korsel terlihat, tidak disorot, tidak berfokus, pengguna belum menggeser sendiri, dan
 * pengguna tidak meminta gerak dikurangi.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { motion, useInView, type Variants } from 'framer-motion';
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { cn } from '../lib/cn';
import { OUTCOMES, SECTION_IDS, formatNumber, type OutcomeSlide } from '../lib/content';
import { spring } from '../lib/motion';
import { CodeWindow } from '../ui/CodeWindow';
import { CountUp } from '../ui/CountUp';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { Reveal } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

/** Jeda putar otomatis (ms). */
const AUTOPLAY_MS = 6500;
/** Baris kode yang dipesan supaya ketiga jendela query sama tinggi (query terpanjang 8 baris). */
const CODE_LINES = Math.max(...OUTCOMES.slides.map((slide) => slide.sql.split('\n').length));

const percentLabel = (value: number): string => `${value}%`;

/* ------------------------------------------------------------------ */
/* Cincin progres                                                      */
/* ------------------------------------------------------------------ */

const RING_RADIUS = 42;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ part, whole, active }: { part: number; whole: number; active: boolean }): JSX.Element {
  const reduced = usePrefersReducedMotion();
  const ratio = whole > 0 ? part / whole : 0;
  return (
    <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
      <svg viewBox="0 0 100 100" aria-hidden className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={RING_RADIUS} fill="none" strokeWidth="10" className="stroke-q-border" />
        <motion.circle
          cx="50"
          cy="50"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          className="stroke-q-primary"
          initial={false}
          animate={{ strokeDashoffset: active ? RING_LENGTH * (1 - ratio) : RING_LENGTH }}
          transition={reduced ? { duration: 0 } : { duration: 1.1, ease: 'easeOut', delay: active ? 0.15 : 0 }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xl font-bold tabular-nums text-q-ink sm:text-2xl">
        <CountUp value={Math.round(ratio * 100)} format={percentLabel} duration={1.1} delay={0.15} />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Diagram batang (satu seri → satu warna, tanpa legenda; nilai ditulis di tiap baris)                                */
/* ------------------------------------------------------------------ */

const barList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
};
const barGrow: Variants = {
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { duration: 0.6, ease: 'easeOut' } },
};

function BarChart({ bars, active }: { bars: OutcomeSlide['bars']; active: boolean }): JSX.Element {
  const max = Math.max(...bars.items.map((item) => item.value), 1);
  return (
    <div className="flex flex-col rounded-q border border-q-border bg-q-surface p-4">
      <p className="text-xs text-q-ink-soft">{bars.unit}</p>
      <motion.ul variants={barList} initial="hidden" animate={active ? 'show' : 'hidden'} className="m-0 mt-2 flex flex-1 list-none flex-col justify-between gap-2 p-0">
        {bars.items.map((item) => (
          <li key={item.label}>
            <div className="flex items-baseline justify-between gap-3 text-[13px] leading-tight">
              <span className="truncate text-q-ink">{item.label}</span>
              <span className="shrink-0 tabular-nums text-q-ink-soft">{formatNumber(item.value)}</span>
            </div>
            <div aria-hidden className="mt-1 h-2">
              <motion.div
                variants={barGrow}
                className="h-full min-w-[3px] origin-left rounded-r-[4px] bg-q-primary"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </motion.ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tablet berisi contoh keluaran                                       */
/* ------------------------------------------------------------------ */

function OutputTablet({ slide, active }: { slide: OutcomeSlide; active: boolean }): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[620px] rounded-[30px] bg-slate-900 p-2.5 shadow-q-float ring-1 ring-inset ring-slate-600 sm:p-3">
      <span aria-hidden className="mx-auto mb-2 block h-1.5 w-1.5 rounded-full bg-slate-600" />
      <div className="rounded-[20px] bg-q-muted p-3 text-left text-q-ink sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-q-ink">
            <Icon name="chart" className="h-4 w-4 text-q-primary-ink" />
            <span className="truncate">{slide.bars.label}</span>
          </p>
          <Pill size="sm" tone="amber">
            {OUTCOMES.sampleChip}
          </Pill>
        </div>
        <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 rounded-q border border-q-border bg-q-surface p-4 sm:flex-col sm:gap-3 sm:text-center">
              <ProgressRing part={slide.ring.part} whole={slide.ring.whole} active={active} />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-snug text-q-ink">{slide.ring.label}</p>
                <p className="mt-0.5 text-[13px] tabular-nums text-q-ink-soft">{OUTCOMES.ringOf(slide.ring.part, slide.ring.whole)}</p>
              </div>
            </div>
            <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-1">
              {slide.stats.map((stat) => (
                <div key={stat.label} className="flex flex-col-reverse justify-end gap-1 rounded-q border border-q-border bg-q-surface px-4 py-3">
                  <dt className="text-xs leading-snug text-q-ink-soft">{stat.label}</dt>
                  <dd className="m-0 text-lg font-bold leading-tight tabular-nums text-q-ink">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <BarChart bars={slide.bars} active={active} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tombol panah                                                        */
/* ------------------------------------------------------------------ */

function ArrowButton({ direction, label, onClick }: { direction: 'prev' | 'next'; label: string; onClick: () => void }): JSX.Element {
  const Glyph = direction === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-q-pill border border-q-border-strong bg-q-surface text-q-ink shadow-q-pop transition-colors duration-150 hover:bg-q-muted hover:text-q-primary-ink',
        'lg:absolute lg:top-1/2 lg:-translate-y-1/2',
        direction === 'prev' ? 'lg:left-0' : 'lg:right-0',
      )}
    >
      <Glyph aria-hidden className="h-5 w-5" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function ShowcaseSection(): JSX.Element {
  const headingId = useId();
  const pickerId = useId();
  const reduced = usePrefersReducedMotion();
  const slides = OUTCOMES.slides;

  // Plugin dibuat sekali; dijalankan/dihentikan sendiri (lihat efek di bawah), bukan oleh opsi bawaannya.
  const autoplay = useMemo(() => Autoplay({ delay: AUTOPLAY_MS, playOnInit: false, stopOnInteraction: false, stopOnMouseEnter: false, stopOnFocusIn: false }), []);
  const plugins = useMemo(() => (reduced ? [] : [autoplay]), [reduced, autoplay]);
  const [viewportRef, embla] = useEmblaCarousel({ loop: true, align: 'center', duration: 28 }, plugins);

  const regionRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(regionRef, { margin: '-80px' });
  const [seen, setSeen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  /** Begitu pengguna menggeser sendiri (panah, pill, seret, keyboard), putar otomatis berhenti seterusnya. */
  const [userDriven, setUserDriven] = useState(false);

  useEffect(() => {
    if (inView) setSeen(true);
  }, [inView]);

  useEffect(() => {
    if (!embla) return undefined;
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    const onPointerDown = () => setUserDriven(true);
    onSelect();
    embla.on('select', onSelect).on('reInit', onSelect).on('pointerDown', onPointerDown);
    return () => {
      embla.off('select', onSelect).off('reInit', onSelect).off('pointerDown', onPointerDown);
    };
  }, [embla]);

  // Slide yang tidak tampil dibuat inert: isinya (mis. jendela kode yang bisa digulir) tidak ikut urutan Tab.
  useEffect(() => {
    if (!embla) return;
    embla.slideNodes().forEach((node, index) => {
      node.inert = index !== selected;
    });
  }, [embla, selected]);

  // Pill aktif digeser masuk ke bagian yang terlihat (hanya gulir mendatar di dalam daftar pill).
  useEffect(() => {
    const scroller = pickerRef.current;
    const active = scroller?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!scroller || !active) return;
    const margin = 24;
    const left = active.offsetLeft - margin;
    const right = active.offsetLeft + active.offsetWidth + margin;
    if (left < scroller.scrollLeft) scroller.scrollLeft = Math.max(0, left);
    else if (right > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = right - scroller.clientWidth;
  }, [selected]);

  const shouldPlay = !reduced && inView && !hovered && !focused && !userDriven;
  useEffect(() => {
    if (!embla || reduced) return undefined;
    // Setelah reInit (pergantian daftar plugin) plugin baru siap pada tick berikutnya.
    const timer = window.setTimeout(() => {
      if (shouldPlay) autoplay.play();
      else autoplay.stop();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [embla, autoplay, reduced, shouldPlay]);

  const go = useCallback(
    (target: number | 'prev' | 'next') => {
      if (!embla) return;
      setUserDriven(true);
      if (target === 'prev') embla.scrollPrev(reduced);
      else if (target === 'next') embla.scrollNext(reduced);
      else embla.scrollTo(target, reduced);
    },
    [embla, reduced],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go('prev');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      go('next');
    }
  };

  return (
    <Section id={SECTION_IDS.outcomes} labelledBy={headingId}>
      <Reveal>
        <SectionHeading id={headingId} title={OUTCOMES.title} lead={OUTCOMES.lead} />
      </Reveal>

      <div
        ref={regionRef}
        role="region"
        aria-label={OUTCOMES.carouselLabel}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
        className="mt-10"
      >
        {/* Pill topik = pemilih slide */}
        <motion.div ref={pickerRef} layoutScroll className="q-no-scrollbar relative mx-auto w-fit max-w-full overflow-x-auto">
          <div className="flex w-max items-center gap-1 rounded-q-pill border border-q-border bg-q-surface p-1">
            {slides.map((slide, index) => {
              const active = index === selected;
              return (
                <button
                  key={slide.id}
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => go(index)}
                  className={cn(
                    'relative isolate inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-q-pill px-4 font-q-body text-sm font-bold transition-colors duration-150 sm:px-5',
                    active ? 'text-q-on-primary' : 'text-q-ink-soft hover:text-q-ink',
                  )}
                >
                  {active ? <motion.span layoutId={`${pickerId}-pill`} transition={spring} aria-hidden className="absolute inset-0 -z-10 rounded-q-pill bg-q-primary" /> : null}
                  {slide.topic}
                </button>
              );
            })}
          </div>
        </motion.div>

        <div className="relative mt-8 lg:px-16">
          <div ref={viewportRef} className="-mx-6 overflow-hidden">
            <div className="flex touch-pan-y">
              {slides.map((slide, index) => {
                const active = index === selected;
                return (
                  <div
                    key={slide.id}
                    role="group"
                    aria-label={slide.title}
                    aria-hidden={active ? undefined : true}
                    className="min-w-0 shrink-0 grow-0 basis-full px-6 pb-14 pt-2"
                  >
                    <div className="mx-auto grid max-w-[620px] items-center gap-5 wide:max-w-none wide:grid-cols-[minmax(0,476px)_auto_minmax(0,1fr)] wide:gap-6">
                      <div className="min-w-0">
                        <h3 className="text-balance text-q-h3 font-bold text-q-ink">{slide.title}</h3>
                        <p className="mt-1 text-sm text-q-ink-soft">{OUTCOMES.queryLabel}</p>
                        {/* Tanpa nomor baris dan 12px: baris terpanjang (60 karakter) muat tanpa gulir mendatar di tata letak dua kolom. */}
                        <CodeWindow
                          code={slide.sql}
                          fileName={`${slide.id}.sql`}
                          ariaLabel={OUTCOMES.queryLabel}
                          minLines={CODE_LINES}
                          showLineNumbers={false}
                          className="mt-4 [&_.font-mono]:text-xs"
                        />
                      </div>
                      <span aria-hidden className="mx-auto grid h-10 w-10 place-items-center rounded-q-pill border border-q-border bg-q-surface text-q-primary-ink">
                        <ArrowDown className="h-5 w-5 wide:hidden" />
                        <ArrowRight className="hidden h-5 w-5 wide:block" />
                      </span>
                      <OutputTablet slide={slide} active={active && seen} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="-mt-6 flex items-center justify-center gap-4 lg:mt-0 lg:contents">
            <ArrowButton direction="prev" label={OUTCOMES.prev} onClick={() => go('prev')} />
            <ArrowButton direction="next" label={OUTCOMES.next} onClick={() => go('next')} />
          </div>
        </div>

        <p className="mx-auto mt-6 flex max-w-[62ch] items-start justify-center gap-2 text-pretty text-sm leading-relaxed text-q-ink-soft lg:-mt-4">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{OUTCOMES.note}</span>
        </p>
      </div>
    </Section>
  );
}
