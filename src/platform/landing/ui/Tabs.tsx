/**
 * Tabs landing (Radix Tabs): daftar tab ber-indikator geser (layoutId) + panel yang berganti dengan crossfade 200 ms
 * (AnimatePresence mode="wait"). Di layar sempit daftar tab bisa digulir mendatar; tepi yang masih menyimpan tab
 * memudar supaya terlihat bahwa daftarnya berlanjut.
 *
 * Dua cara pakai:
 *   1. Serba ada — daftar di atas, panel di bawah:
 *        <Tabs items={items} ariaLabel="…">{(value) => <Panel value={value} />}</Tabs>
 *   2. Tata letak sendiri (mis. daftar di kiri, panel di kanan):
 *        <TabsRoot defaultValue="a"> … <TabsList items={items} ariaLabel="…" /> … <TabsPanels>{(value) => …}</TabsPanels> </TabsRoot>
 */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/cn';
import { crossfadeProps, spring } from '../lib/motion';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  /** Ikon di kiri label (hiasan). */
  icon?: ReactNode;
  /** Tambahan di kanan label, mis. <Pill size="sm" tone="soon">Segera</Pill>. */
  badge?: ReactNode;
  /** Atribut data pada tombol tab (penanda uji), mis. { 'data-track': 'sql' }. */
  data?: Readonly<Record<`data-${string}`, string>>;
}

interface TabsContextValue {
  value: string;
  /** Awalan unik untuk layoutId indikator, supaya dua Tabs di halaman yang sama tidak saling berebut. */
  layoutId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error(`<${component}> harus berada di dalam <TabsRoot> atau <Tabs>`);
  return context;
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

export interface TabsRootProps<T extends string> {
  /** Terkendali: nilai tab aktif. */
  value?: T;
  /** Tak terkendali: tab awal. */
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  children: ReactNode;
  className?: string;
}

export function TabsRoot<T extends string>({ value, defaultValue, onValueChange, children, className }: TabsRootProps<T>): JSX.Element {
  const [inner, setInner] = useState<string>(defaultValue ?? '');
  const current = value ?? inner;
  const layoutId = useId();
  const handleChange = useCallback(
    (next: string) => {
      setInner(next);
      onValueChange?.(next as T);
    },
    [onValueChange],
  );
  const context = useMemo(() => ({ value: current, layoutId }), [current, layoutId]);
  return (
    <TabsContext.Provider value={context}>
      <RadixTabs.Root value={current} onValueChange={handleChange} className={className}>
        {children}
      </RadixTabs.Root>
    </TabsContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Daftar tab                                                          */
/* ------------------------------------------------------------------ */

export interface TabsListProps<T extends string> {
  items: readonly TabItem<T>[];
  /** Nama aksesibel daftar tab. */
  ariaLabel: string;
  /** pill = kapsul hijau bergeser (bawaan); underline = garis bawah bergeser. */
  variant?: 'pill' | 'underline';
  size?: 'sm' | 'md';
  /** Posisi daftar bila lebih sempit dari wadahnya. */
  align?: 'center' | 'start';
  className?: string;
}

/** Lebar tepi yang memudar (px) saat daftar tab masih bisa digulir ke arah itu. */
const FADE_PX = 36;

function edgeMask(start: boolean, end: boolean): string | undefined {
  if (!start && !end) return undefined;
  return `linear-gradient(to right, ${start ? 'transparent' : '#000'} 0, #000 ${FADE_PX}px, #000 calc(100% - ${FADE_PX}px), ${end ? 'transparent' : '#000'} 100%)`;
}

const TRIGGER_SIZE = {
  pill: { sm: 'h-8 px-3.5 text-[13px]', md: 'h-10 px-5 text-sm' },
  underline: { sm: 'h-9 px-3 text-[13px]', md: 'h-11 px-4 text-sm' },
} as const;

export function TabsList<T extends string>({ items, ariaLabel, variant = 'pill', size = 'md', align = 'center', className }: TabsListProps<T>): JSX.Element {
  const { value, layoutId } = useTabsContext('TabsList');
  const scrollerRef = useRef<HTMLDivElement>(null);
  /** Masih ada tab di luar tepi kiri / kanan? (hanya saat daftar lebih lebar dari wadahnya) */
  const [more, setMore] = useState({ start: false, end: false });

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const update = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      const start = scroller.scrollLeft > 2;
      const end = scroller.scrollLeft < max - 2;
      setMore((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    return () => {
      scroller.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);
  const mask = edgeMask(more.start, more.end);

  // Tab aktif digeser masuk ke bagian yang terlihat (hanya gulir mendatar di dalam daftar; halaman tidak ikut bergeser).
  useEffect(() => {
    const scroller = scrollerRef.current;
    const active = scroller?.querySelector<HTMLElement>('[data-state="active"]');
    if (!scroller || !active) return;
    const margin = 24;
    const left = active.offsetLeft - margin;
    const right = active.offsetLeft + active.offsetWidth + margin;
    if (left < scroller.scrollLeft) scroller.scrollLeft = Math.max(0, left);
    else if (right > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = right - scroller.clientWidth;
  }, [value]);

  return (
    // layoutScroll: indikator ber-layoutId tetap tepat walau daftar sedang tergulir.
    <motion.div
      ref={scrollerRef}
      layoutScroll
      className={cn('q-no-scrollbar w-fit max-w-full overflow-x-auto', align === 'center' ? 'mx-auto' : '', className)}
      style={mask === undefined ? undefined : { maskImage: mask, WebkitMaskImage: mask }}
    >
      <RadixTabs.List
        aria-label={ariaLabel}
        className={cn(
          'relative flex w-max items-center',
          variant === 'pill' ? 'gap-1 rounded-q-pill border border-q-border bg-q-surface p-1' : 'gap-1 border-b border-q-border px-1 pt-1',
        )}
      >
        {items.map((item) => {
          const active = item.value === value;
          return (
            <RadixTabs.Trigger
              key={item.value}
              value={item.value}
              {...item.data}
              className={cn(
                'relative isolate inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-q-body font-bold transition-colors duration-150',
                TRIGGER_SIZE[variant][size],
                variant === 'pill'
                  ? 'rounded-q-pill text-q-ink-soft hover:text-q-ink data-[state=active]:text-q-on-primary'
                  : 'rounded-t-q text-q-ink-soft hover:text-q-ink data-[state=active]:text-q-primary-ink',
              )}
            >
              {active ? (
                <motion.span
                  layoutId={`${layoutId}-indicator`}
                  transition={spring}
                  aria-hidden
                  className={cn('absolute -z-10', variant === 'pill' ? 'inset-0 rounded-q-pill bg-q-primary' : 'inset-x-0 -bottom-px h-[3px] rounded-q-pill bg-q-primary')}
                />
              ) : null}
              {item.icon}
              <span>{item.label}</span>
              {item.badge}
            </RadixTabs.Trigger>
          );
        })}
      </RadixTabs.List>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export interface TabsPanelsProps<T extends string> {
  /** Isi panel untuk tab aktif. */
  children: (value: T) => ReactNode;
  className?: string;
}

/** Panel tab aktif. Pergantian isi: yang lama memudar keluar dulu, lalu yang baru memudar masuk (200 ms). */
export function TabsPanels<T extends string>({ children, className }: TabsPanelsProps<T>): JSX.Element {
  const { value } = useTabsContext('TabsPanels');
  return (
    <AnimatePresence mode="wait" initial={false}>
      {/* forceMount: panel lama tetap ada selama animasi keluar walau Radix sudah menganggapnya tidak aktif. */}
      <RadixTabs.Content key={value} value={value} forceMount asChild>
        <motion.div {...crossfadeProps} className={className}>
          {children(value as T)}
        </motion.div>
      </RadixTabs.Content>
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Serba ada                                                           */
/* ------------------------------------------------------------------ */

export interface TabsProps<T extends string> extends Omit<TabsRootProps<T>, 'children' | 'defaultValue'>, Omit<TabsListProps<T>, 'className'> {
  /** Tab awal (bawaan: butir pertama). */
  defaultValue?: T;
  children: (value: T) => ReactNode;
  listClassName?: string;
  panelClassName?: string;
}

export function Tabs<T extends string>({
  items,
  value,
  defaultValue,
  onValueChange,
  ariaLabel,
  variant,
  size,
  align,
  children,
  className,
  listClassName,
  panelClassName,
}: TabsProps<T>): JSX.Element {
  return (
    <TabsRoot value={value} defaultValue={defaultValue ?? items[0]?.value} onValueChange={onValueChange} className={className}>
      <TabsList items={items} ariaLabel={ariaLabel} variant={variant} size={size} align={align} className={listClassName} />
      <TabsPanels className={cn('mt-8', panelClassName)}>{children}</TabsPanels>
    </TabsRoot>
  );
}
