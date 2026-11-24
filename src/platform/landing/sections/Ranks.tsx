/**
 * Bagian 8 — "Naik pangkat" (aplikasi ini tidak menerbitkan dokumen tanda tamat apa pun; yang ada adalah tangga
 * pangkat berbasis XP). Tiga pangkat dari tangga pangkat sungguhan digambar sebagai TANDA PENGENAL pegawai rumah sakit
 * (bertali, berfoto emoji pangkat), ditumpuk miring -4°/0°/4°; menyorot atau memfokus sebuah kartu meluruskannya.
 * Tiap kartu adalah tautan ke halaman Progres, tempat tangga pangkat lengkap berada.
 */
import { useId } from 'react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '../lib/cn';
import { RANKS, RANK_COUNT, RANK_LADDER, SECTION_IDS, type LandingRank } from '../lib/content';
import { spring, viewportOnce } from '../lib/motion';
import { Button3D } from '../ui/Button3D';
import { Icon } from '../ui/Icon';
import { Reveal } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

export interface RanksProps {
  /** Latar section (bawaan mint). */
  tone?: 'default' | 'tint';
}

/** Kemiringan & ketinggian tiap kartu dalam tumpukan (kiri, tengah, kanan). */
const POSE = [
  { rotate: -4, y: 10 },
  { rotate: 0, y: -14 },
  { rotate: 4, y: 10 },
] as const;

/** Warna kepala tanda pengenal: teal (awal), hijau (tengah), amber (puncak). Ditulis utuh untuk pemindai Tailwind. */
const HEAD = ['bg-q-brand', 'bg-q-primary', 'bg-q-amber'] as const;
const LAYER = ['z-10', 'z-20', 'z-10'] as const;
/** Isi kartu samping digeser menjauhi kartu tengah yang menindihnya, supaya teksnya tidak tertutup. */
const INSET = ['pl-2 pr-[14%] sm:pl-4 sm:pr-8', 'px-2 sm:px-5', 'pl-[14%] pr-2 sm:pl-8 sm:pr-4'] as const;

const deck: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

function cardVariants(index: number): Variants {
  const pose = POSE[index] ?? POSE[1];
  return {
    hidden: { opacity: 0, y: 48, rotate: 0 },
    show: { opacity: 1, y: pose.y, rotate: pose.rotate, transition: spring },
  };
}

interface RankCardProps {
  rank: LandingRank;
  /** Urutan pangkat pada tangga, mulai dari 1. */
  position: number;
  /** Posisi dalam tumpukan (0–2). */
  index: number;
}

function RankCard({ rank, position, index }: RankCardProps): JSX.Element {
  return (
    <li className={cn('relative w-[36%] max-w-[220px] shrink-0 hover:z-30 focus-within:z-30', index > 0 ? '-ml-[4%] sm:-ml-5' : '', LAYER[index])}>
      <motion.a
        href={RANKS.link.href}
        variants={cardVariants(index)}
        whileHover={{ rotate: 0, y: -22, scale: 1.04 }}
        whileFocus={{ rotate: 0, y: -22, scale: 1.04 }}
        transition={spring}
        className="relative block origin-top rounded-q-lg border border-q-border bg-q-surface text-center no-underline shadow-q-float"
      >
        {/* tali + penjepit */}
        <span aria-hidden className="absolute -top-9 left-1/2 h-12 w-3 -translate-x-1/2 rounded-t-sm bg-q-border-strong sm:-top-12 sm:h-16 sm:w-4" />
        <span aria-hidden className={cn('relative block h-11 rounded-t-[22px] sm:h-16', HEAD[index])}>
          <span className="absolute left-1/2 top-2 h-2 w-8 -translate-x-1/2 rounded-q-pill bg-q-border-strong ring-2 ring-q-surface sm:top-2.5 sm:h-2.5 sm:w-11" />
        </span>
        <span
          aria-hidden
          // Alas emoji terang di KEDUA tema (emoji berwarna tetap tenggelam di atas alas gelap).
          className="relative mx-auto -mt-6 grid h-12 w-12 place-items-center rounded-full border-4 border-q-surface bg-q-emoji-base text-2xl leading-none sm:-mt-9 sm:h-[76px] sm:w-[76px] sm:text-4xl"
        >
          {rank.icon}
        </span>
        <span className={cn('block pb-4 pt-2 sm:pb-6 sm:pt-3', INSET[index])}>
          <span className="block text-[11px] tabular-nums text-q-ink-soft sm:text-xs">
            {RANKS.cardLabel} {position}/{RANK_COUNT}
          </span>
          <span className="mt-1 block text-balance text-[13px] font-bold leading-snug text-q-ink sm:text-base">{rank.title}</span>
          <span className="mt-2 block text-[11px] leading-tight text-q-amber-ink sm:mt-4 sm:inline-block sm:rounded-q-pill sm:border sm:border-q-border sm:bg-q-muted sm:px-3 sm:py-1 sm:text-[13px] sm:text-q-ink">
            {RANKS.xpLabel(rank.minXp)}
          </span>
        </span>
      </motion.a>
    </li>
  );
}

export function Ranks({ tone = 'tint' }: RanksProps): JSX.Element {
  const headingId = useId();
  const featured = RANKS.featured.flatMap((ladderIndex) => {
    const rank = RANK_LADDER[ladderIndex];
    return rank ? [{ rank, position: ladderIndex + 1 }] : [];
  });

  return (
    <Section id={SECTION_IDS.ranks} tone={tone} labelledBy={headingId}>
      <div className="grid items-center gap-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        <Reveal className="flex flex-col items-center gap-7 lg:items-start">
          <SectionHeading id={headingId} title={RANKS.title} lead={RANKS.lead} className="lg:items-start lg:text-left" />
          <p className="flex items-center gap-2 text-sm text-q-ink">
            <Icon name="zap" className="h-4 w-4 text-q-amber-ink" />
            {RANKS.total}
          </p>
          <div className="pb-1">
            <Button3D href={RANKS.link.href} variant="outline">
              {RANKS.link.label}
            </Button3D>
          </div>
        </Reveal>

        <motion.ul
          variants={deck}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="m-0 flex list-none items-start justify-center p-0 pb-4 pt-6 sm:pt-10"
        >
          {featured.map((item, index) => (
            <RankCard key={item.rank.title} rank={item.rank} position={item.position} index={index} />
          ))}
        </motion.ul>
      </div>
    </Section>
  );
}
