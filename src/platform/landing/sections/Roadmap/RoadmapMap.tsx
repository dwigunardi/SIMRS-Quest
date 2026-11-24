/**
 * Peta zig-zag 10 tier jalur SQL. Node tier berselang kiri-kanan, dihubungkan garis putus-putus yang "tergambar"
 * mengikuti guliran; di antara dua tier ada tanda Boss, dan jalurnya berakhir di Final Boss.
 *
 * ARTI garis hijau: untuk pengguna yang sudah punya progres, hijau = "sudah ditempuh" — garisnya BERHENTI di tier
 * tempat misi "Lanjutkan" berada (tier sebelumnya diberi centang), tidak ikut memanjang sampai Final Boss saat
 * digulir. Untuk pengunjung baru (belum ada yang ditempuh) garisnya hiasan yang tergambar penuh.
 *
 * Cara menggambar: rutenya selalu turun (y bertambah), jadi "tergambar bertahap" = membuka rute hijau dari atas sampai
 * ketinggian tertentu. Itu dikerjakan dengan DUA transform yang saling meniadakan (pembungkus ber-overflow-hidden naik,
 * isinya turun sejauh yang sama) — murni transform, tanpa mask/pathLength yang mengecat ulang SVG besar tiap frame.
 *
 * Garisnya dihitung dari posisi node yang SEBENARNYA (diukur, lalu diukur ulang tiap ukuran wadah berubah), jadi
 * tetap menyambung walau teks melipat berbeda di tiap lebar layar. Yang diukur adalah pembungkus node yang diam —
 * animasi muncul ada di elemen dalamnya — supaya hasil ukur tidak ikut bergeser.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, useMotionValue, useScroll, useSpring, useTransform, type Variants } from 'framer-motion';
import { Check, MapPin } from 'lucide-react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { cn } from '../../lib/cn';
import { PATHS } from '../../lib/content';
import { spring, stagger, viewportOnce } from '../../lib/motion';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';

export interface RoadmapMapProps {
  /** Tier tempat misi "Lanjutkan" berada; null = tidak diketahui / pengguna baru (tidak ada yang ditandai). */
  currentTier: number | null;
  /** Semua misi tuntas. */
  allDone: boolean;
  /** Teks penanda tier saat ini. */
  hereLabel: string;
  /** id elemen yang menamai daftar tier. */
  labelledBy: string;
}

interface Point {
  x: number;
  y: number;
}

interface Geometry {
  width: number;
  height: number;
  points: Point[];
}

const NODE_ATTR = 'data-roadmap-node';

/** Node muncul membesar; teksnya memudar dari sisi luar. */
const POP: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  show: { opacity: 1, scale: 1, transition: spring },
};
const TEXT_IN: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: spring },
};

/** Tepi bawah "3D" + lingkar sewarna latar (menutup garis yang lewat di bawah node). */
function nodeShadow(lip: string, ring?: string): string {
  const halo = '0 0 0 6px rgb(var(--q-bg)), 0 5px 0 6px rgb(var(--q-bg))';
  if (ring === undefined) return `0 5px 0 0 ${lip}, ${halo}`;
  // Dengan cincin penanda: sela latar 3px, cincin 3px, tepi bawah, lalu lingkar latar yang lebih lebar.
  return `0 0 0 3px rgb(var(--q-bg)), 0 0 0 6px ${ring}, 0 5px 0 6px ${lip}, 0 0 0 10px rgb(var(--q-bg)), 0 5px 0 10px rgb(var(--q-bg))`;
}

const TIER_SHADOW = nodeShadow('rgb(var(--q-primary-shadow))');
/** Cincin "Kamu di sini" memakai amber-ink (≥ 3:1 terhadap latar di kedua tema; amber polos hanya 2,03:1 di putih). */
const TIER_SHADOW_HERE = nodeShadow('rgb(var(--q-primary-shadow))', 'rgb(var(--q-amber-ink))');
/** Merah tua tetap (tepi bawah node Final Boss) — sama di kedua tema seperti isian coral-strong-nya. */
const FINAL_SHADOW = nodeShadow('#8F1D22');

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Kurva S tegak di antara tiap dua node: titik tengahnya tepat di tengah kedua node (tempat gerbang Boss). */
function buildPath(points: readonly Point[]): string {
  const first = points[0];
  if (!first) return '';
  let d = `M ${round(first.x)} ${round(first.y)}`;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    if (!from || !to) continue;
    const midY = round((from.y + to.y) / 2);
    d += ` C ${round(from.x)} ${midY}, ${round(to.x)} ${midY}, ${round(to.x)} ${round(to.y)}`;
  }
  return d;
}

function sameGeometry(a: Geometry | null, b: Geometry): boolean {
  return (
    a !== null &&
    a.width === b.width &&
    a.height === b.height &&
    a.points.length === b.points.length &&
    a.points.every((point, index) => point.x === b.points[index]?.x && point.y === b.points[index]?.y)
  );
}

export function RoadmapMap({ currentTier, allDone, hereLabel, labelledBy }: RoadmapMapProps): JSX.Element {
  const { tiers, tierLabel, missionsLabel, bossLabel, finalBossLabel, doneLabel } = PATHS.roadmap;
  const lastTier = tiers[tiers.length - 1];
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const measure = () => {
      const box = wrap.getBoundingClientRect();
      const points = Array.from(wrap.querySelectorAll<HTMLElement>(`[${NODE_ATTR}]`)).map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: round(rect.left - box.left + rect.width / 2), y: round(rect.top - box.top + rect.height / 2) };
      });
      const next: Geometry = { width: round(box.width), height: round(box.height), points };
      setGeometry((previous) => (sameGeometry(previous, next) ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  // Garis berwarna mengikuti guliran: mulai saat peta masuk layar, penuh saat ujungnya melewati tengah layar.
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ['start 0.8', 'end 0.65'] });
  const drawn = useSpring(scrollYProgress, { stiffness: 140, damping: 32, restDelta: 0.001 });

  // Batas garis hijau (0..1 dari tinggi peta): node tier saat ini untuk pengguna berprogres; selain itu seluruh rute.
  const tierIndex = currentTier === null ? -1 : tiers.findIndex((item) => item.tier === currentTier);
  const capPoint = !allDone && tierIndex >= 0 ? geometry?.points[tierIndex] : undefined;
  const cap = geometry && capPoint ? Math.min(1, capPoint.y / Math.max(1, geometry.height)) : 1;
  // Dibaca lewat ref: transformer useTransform dibuat sekali, sedangkan batas & tinggi baru diketahui setelah diukur.
  const live = useRef({ cap, height: geometry?.height ?? 0, reduced });
  live.current = { cap, height: geometry?.height ?? 0, reduced };
  /** Tinggi (px) bagian bawah rute hijau yang masih tertutup. */
  const remeasured = useMotionValue(0);
  const covered = useTransform<number, number>([drawn, remeasured], ([value]) => {
    const state = live.current;
    const shown = state.reduced ? state.cap : Math.min(value ?? 0, state.cap);
    return Math.round((1 - shown) * state.height);
  });
  const lift = useTransform(covered, (value) => -value);
  // Ukuran/batas berubah tanpa guliran (pertama diukur, ganti lebar, progres tiba): hitung ulang sekali.
  useLayoutEffect(() => {
    remeasured.set(remeasured.get() + 1);
  }, [remeasured, cap, geometry, reduced]);

  const d = geometry ? buildPath(geometry.points) : '';
  // Gerbang Boss tier ke-n berada di tengah ruas tier n → tier n+1 (Boss tier terakhir = node Final Boss).
  const gates: Point[] = [];
  if (geometry) {
    for (let index = 0; index < tiers.length - 1; index += 1) {
      const from = geometry.points[index];
      const to = geometry.points[index + 1];
      if (from && to) gates.push({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
    }
  }

  return (
    <div ref={wrapRef} className="relative mx-auto max-w-[940px]" data-roadmap-cap={cap < 1 ? cap.toFixed(3) : 'full'}>
      {geometry && d !== '' ? (
        <>
          {/* Rute pucat selalu terlihat. */}
          <svg aria-hidden focusable="false" width={geometry.width} height={geometry.height} className="pointer-events-none absolute left-0 top-0 overflow-visible" fill="none">
            <path d={d} className="stroke-q-border-strong/45" strokeWidth={4} strokeLinecap="round" strokeDasharray="1 12" />
          </svg>
          {/* Rute hijau dibuka dari atas: pembungkus naik sejauh `covered`, isinya turun sejauh yang sama. */}
          <motion.div aria-hidden style={{ y: lift, width: geometry.width, height: geometry.height }} className="pointer-events-none absolute left-0 top-0 overflow-hidden">
            <motion.div style={{ y: covered }} data-testid="roadmap-progress">
              <svg focusable="false" width={geometry.width} height={geometry.height} className="block" fill="none">
                <path d={d} className="stroke-q-primary" strokeWidth={5} strokeLinecap="round" strokeDasharray="1 12" />
              </svg>
            </motion.div>
          </motion.div>
        </>
      ) : null}

      {gates.map((gate, index) => (
        <span key={index} aria-hidden className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-1/2" style={{ left: gate.x, top: gate.y }}>
          {/* Kemiringan belah ketupat ada di elemen DALAM (kelas biasa): yang dianimasikan framer hanya skala & opacity,
              jadi bentuknya tetap benar walau animasi transform dimatikan (reduced motion). */}
          <motion.span className="block" initial={{ opacity: 0, scale: 0.4 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: '-60px' }} transition={spring}>
            <span className="grid h-7 w-7 rotate-45 place-items-center rounded-[8px] bg-q-coral-strong text-q-on-coral sm:h-8 sm:w-8" style={{ boxShadow: '0 0 0 4px rgb(var(--q-bg))' }}>
              <Icon name="swords" className="h-4 w-4 -rotate-45" />
            </span>
          </motion.span>
        </span>
      ))}

      <motion.ol
        aria-labelledby={labelledBy}
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        className="relative grid gap-y-8 sm:auto-rows-[minmax(70px,auto)] sm:grid-cols-2 sm:gap-x-20 sm:gap-y-4 lg:gap-x-28"
      >
        {tiers.map((tier, index) => {
          const left = index % 2 === 0;
          const here = !allDone && currentTier === tier.tier;
          // Misi terbuka berurutan: semua tier sebelum tier "Lanjutkan" pasti sudah dilewati.
          const done = allDone || (currentTier !== null && tier.tier < currentTier);
          const isLast = tier === lastTier;
          return (
            <li
              key={tier.tier}
              data-tier={tier.tier}
              data-state={done ? 'done' : here ? 'here' : 'todo'}
              style={{ '--r': index + 1 } as CSSProperties}
              className={cn('flex items-center gap-4 sm:gap-5 sm:[grid-row:var(--r)_/_span_2]', left ? 'sm:col-start-1 sm:flex-row-reverse sm:text-right' : 'sm:col-start-2')}
            >
              {/* Rel node: di layar sempit node berselang kiri-kanan di dalam rel selebar 88px */}
              <div className={cn('flex w-[88px] shrink-0 sm:w-auto', left ? 'justify-start' : 'justify-end')}>
                <div {...{ [NODE_ATTR]: '' }} className="relative">
                  <motion.span
                    variants={POP}
                    aria-hidden
                    className="grid h-12 w-12 place-items-center rounded-full bg-q-primary font-q-display text-lg font-extrabold tabular-nums text-q-on-primary sm:h-14 sm:w-14 sm:text-xl"
                    style={{ boxShadow: here ? TIER_SHADOW_HERE : TIER_SHADOW }}
                  >
                    {tier.tier}
                  </motion.span>
                  {done ? (
                    <span aria-hidden className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-q-success text-q-on-success ring-2 ring-q-bg">
                      <Check className="h-3 w-3" strokeWidth={3.5} />
                    </span>
                  ) : null}
                </div>
              </div>

              <motion.div variants={TEXT_IN} className="min-w-0 flex-1 sm:max-w-[330px]">
                <p className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-q-ink-soft', left ? 'sm:justify-end' : '')}>
                  <span className="font-bold text-q-primary-ink">{tierLabel(tier.tier)}</span>
                  <span aria-hidden>·</span>
                  <span>{missionsLabel(tier.missions)}</span>
                  {done ? <span className="sr-only">, {doneLabel}</span> : null}
                  {here ? (
                    <Pill tone="amber" size="sm" icon={<MapPin aria-hidden className="h-3 w-3" />} className="font-bold">
                      {hereLabel}
                    </Pill>
                  ) : null}
                </p>
                <h3 className="mt-0.5 text-balance text-lg font-bold leading-snug text-q-ink">{tier.name}</h3>
                <p className="mt-1 text-pretty text-sm leading-relaxed text-q-ink-soft">{tier.topics}</p>
                {!isLast ? (
                  <p className={cn('mt-1.5 flex items-start gap-1.5 text-sm leading-snug text-q-coral-ink', left ? 'sm:flex-row-reverse' : '')}>
                    <Icon name="swords" className="mt-0.5 h-4 w-4" />
                    <span>
                      <span className="font-bold">{bossLabel}:</span> {tier.boss}
                    </span>
                  </p>
                ) : null}
              </motion.div>
            </li>
          );
        })}
      </motion.ol>

      {/* Ujung jalur: Boss tier terakhir */}
      {lastTier ? (
        <div className="relative mt-8 flex items-center gap-4 sm:mt-10 sm:flex-col sm:gap-4 sm:text-center">
          <div className="flex w-[88px] shrink-0 justify-center sm:w-auto">
            <div {...{ [NODE_ATTR]: '' }} className="relative">
              <motion.span
                aria-hidden
                className="grid h-16 w-16 place-items-center rounded-full bg-q-coral-strong text-q-on-coral sm:h-[76px] sm:w-[76px]"
                style={{ boxShadow: FINAL_SHADOW }}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={spring}
              >
                <Icon name="crown" className="h-8 w-8 sm:h-9 sm:w-9" />
              </motion.span>
              {allDone ? (
                <span aria-hidden className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-q-success text-q-on-success ring-2 ring-q-bg">
                  <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                </span>
              ) : null}
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="font-q-display text-xl font-extrabold text-q-ink sm:text-2xl">{finalBossLabel}</h3>
            <p className="mt-0.5 text-sm text-q-ink-soft sm:text-base">{lastTier.boss}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
