/**
 * Bagian 3 — Marquee di pita hijau pinus. Dua baris yang bergerak berlawanan arah, dan pembagiannya punya arti:
 * baris atas = topik SQL yang SUDAH tersedia, baris bawah = teknologi jalur berikutnya yang diberi tanda "Segera".
 *
 * Gerak berhenti saat pointer berada di atasnya, saat fokus keyboard berada di dalamnya, saat pita di luar layar, saat
 * pengguna menekan "Jeda animasi" di navbar (pita membeku di tempat), dan sepenuhnya bila SISTEM meminta gerak
 * dikurangi (pill lalu disusun membungkus di tengah). Pembaca layar hanya membaca satu salinan tiap baris.
 *
 * Setiap pill menaut ke landing jalur pemiliknya ('#/landing/<id>'). Hanya salinan pertama yang bisa difokus: salinan
 * pengisi sambungan disembunyikan dari pembaca layar dan dikeluarkan dari urutan Tab.
 *
 * Loop geraknya (requestAnimationFrame) hanya HIDUP selama pita benar-benar bergerak: di luar layar atau saat dijeda
 * tidak ada frame yang diminta sama sekali, jadi halaman bisa diam.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue } from 'framer-motion';
import { useMotionPaused, useSystemReducedMotion } from '../hooks/usePrefersReducedMotion';
import { cn } from '../lib/cn';
import { MARQUEE, ROUTES, SOON_LABEL, TRACKS, type MarqueeItem } from '../lib/content';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { Section } from '../ui/Section';

function landingOf(item: MarqueeItem): string {
  return TRACKS.find((track) => track.id === item.trackId)?.landingHref ?? ROUTES.catalog;
}

function MarqueePill({ item, focusable = true }: { item: MarqueeItem; focusable?: boolean }): JSX.Element {
  const soon = item.status === 'segera';
  return (
    <li className="shrink-0">
      <a href={landingOf(item)} tabIndex={focusable ? undefined : -1} className="block rounded-q-pill no-underline" data-track={item.trackId}>
        <Pill
          tone="surface"
          size="lg"
          icon={<Icon name={item.icon} className={cn('h-[18px] w-[18px]', soon ? 'text-q-ink-soft' : 'text-q-primary-ink')} />}
          className={cn('font-bold transition-colors duration-150 hover:border-q-primary hover:text-q-primary-ink', soon ? 'pr-2' : '')}
        >
          {item.label}
          {soon ? (
            <Pill size="sm" tone="soon" className="ml-1 font-normal">
              {SOON_LABEL}
            </Pill>
          ) : null}
        </Pill>
      </a>
    </li>
  );
}

/** Jarak minimum pill yang difokus dari tepi pita (px) — lebar pudaran tepi di layar lebar. */
const EDGE_PAD = 96;

interface RowProps {
  items: readonly MarqueeItem[];
  label: string;
  /** 1 = bergerak ke kiri, -1 = ke kanan. */
  direction: 1 | -1;
  /** Piksel per detik. */
  speed: number;
}

function MarqueeRow({ items, label, direction, speed }: RowProps): JSX.Element {
  const reduced = useSystemReducedMotion();
  const userPaused = useMotionPaused();
  const wrapRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLUListElement>(null);
  const inView = useInView(wrapRef, { margin: '80px' });
  const x = useMotionValue(0);
  const copyWidth = useRef(0);
  /** Pointer sedang di atas pita. */
  const [hovered, setHovered] = useState(false);
  /** Fokus keyboard berada di salah satu pill (pill yang bergerak sulit diikuti mata). */
  const [focused, setFocused] = useState(false);
  /** Banyaknya salinan: cukup untuk menutup layar selebar apa pun ditambah satu untuk sambungan. */
  const [copies, setCopies] = useState(2);

  useEffect(() => {
    const wrap = wrapRef.current;
    const copy = copyRef.current;
    if (reduced || !wrap || !copy) return undefined;
    const measure = () => {
      const width = copy.offsetWidth;
      if (width <= 0) return;
      copyWidth.current = width;
      setCopies(Math.max(2, Math.ceil(wrap.clientWidth / width) + 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [reduced]);

  const running = !reduced && !userPaused && !hovered && !focused && inView;
  useEffect(() => {
    if (!running) return undefined;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      // Lompatan waktu (tab baru kembali aktif) dibatasi supaya pita tidak meloncat.
      const delta = Math.min(now - last, 50);
      last = now;
      const width = copyWidth.current;
      if (width <= 0) return;
      let next = x.get() - direction * speed * (delta / 1000);
      if (next <= -width) next += width;
      if (next > 0) next -= width;
      x.set(next);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [running, direction, speed, x]);

  if (reduced) {
    return (
      <ul aria-label={label} className="m-0 flex list-none flex-wrap justify-center gap-3 px-q-gutter py-0">
        {items.map((item) => (
          <MarqueePill key={item.label} item={item} />
        ))}
      </ul>
    );
  }

  /**
   * Pill yang difokus (Tab) bisa berada di luar tepi pita. overflow-x: clip (bukan hidden) membuat pembungkus BUKAN
   * wadah gulir, jadi browser tidak menggesernya lewat scrollLeft (geseran yang tidak pernah kembali dan meninggalkan
   * celah kosong di setiap putaran). Gantinya pita sendiri digeser sampai pill itu terlihat, di luar tepi yang memudar.
   */
  const revealFocused = (target: EventTarget) => {
    const wrap = wrapRef.current;
    if (!wrap || !(target instanceof HTMLElement)) return;
    const box = wrap.getBoundingClientRect();
    const pill = target.getBoundingClientRect();
    const pad = Math.min(EDGE_PAD, box.width * 0.12);
    let shift = 0;
    if (pill.left < box.left + pad) shift = box.left + pad - pill.left;
    else if (pill.right > box.right - pad) shift = box.right - pad - pill.right;
    if (shift !== 0) x.set(Math.min(0, Math.max(-copyWidth.current + 1, x.get() + shift)));
  };

  return (
    <div
      ref={wrapRef}
      className="overflow-x-clip"
      data-marquee={running ? 'running' : 'paused'}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={(event) => {
        setFocused(true);
        revealFocused(event.target);
      }}
      onBlur={() => setFocused(false)}
    >
      <motion.div style={{ x }} className="flex w-max">
        {Array.from({ length: copies }, (_, index) => (
          <ul
            key={index}
            ref={index === 0 ? copyRef : undefined}
            aria-label={index === 0 ? label : undefined}
            aria-hidden={index === 0 ? undefined : true}
            className="m-0 flex shrink-0 list-none gap-3 py-0 pl-0 pr-3"
          >
            {items.map((item) => (
              <MarqueePill key={item.label} item={item} focusable={index === 0} />
            ))}
          </ul>
        ))}
      </motion.div>
    </div>
  );
}

const AVAILABLE = MARQUEE.items.filter((item) => item.status === 'tersedia');
const SOON = MARQUEE.items.filter((item) => item.status === 'segera');

export function CategoryMarquee(): JSX.Element {
  const reduced = useSystemReducedMotion();
  return (
    <Section tone="band" spacing="none" bleed ariaLabel={MARQUEE.ariaLabel} className="py-7">
      <div className="flex flex-col gap-3">
        <MarqueeRow items={AVAILABLE} label={MARQUEE.rows.available} direction={1} speed={38} />
        <MarqueeRow items={SOON} label={MARQUEE.rows.soon} direction={-1} speed={26} />
      </div>
      {/* Tepi kiri-kanan memudar ke warna pita (hanya saat pitanya bergerak). */}
      {reduced ? null : (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-q-band to-q-band/0 sm:w-24" />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-q-band to-q-band/0 sm:w-24" />
        </>
      )}
    </Section>
  );
}
