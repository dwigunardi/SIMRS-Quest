/**
 * B1 — Hero katalog. Kiri: pill eyebrow, satu-satunya h1, deskripsi, tombol utama berstatus pengguna + "(gratis)", dan
 * baris bukti nyata. Kanan (di ponsel: di bawah teks, lebih kecil): enam kartu logo putih membulat yang dimiringkan
 * dalam grid 3×2 — lima jalur registri + "Database SIMRS" — yang melayang bergantian (fase papan catur) dengan parallax
 * berbeda per kartu. Satu-satunya momen gerak halaman ini: kartu-kartunya muncul bergiliran saat halaman dibuka.
 *
 * Kartu logo hanya hiasan bernama (role="img" pada grid); tautan ke tiap jalur ada di "Telusuri semua jalur" tepat di
 * bawahnya, jadi tidak ada lima tab stop tambahan sebelum isi utama.
 */
import { motion, type Variants } from 'framer-motion';
import { Check } from 'lucide-react';
import { ctaLabelFor, usePageStatus } from '../layout/pageStatus';
import { CATALOG, CATALOG_SECTION_IDS } from '../lib/pagesContent';
import { Button3D } from '../ui/Button3D';
import { LogoCard } from '../ui/LogoCard';
import { Pill } from '../ui/Pill';
import { Section } from '../ui/Section';
import { useMinWidth } from './useMinWidth';

const TITLE_ID = 'catalog-hero-title';

/** Kemiringan tiap kartu (derajat), urut grid kiri-atas → kanan-bawah. */
const TILTS = [-6, 4, -3, 5, -4, 3] as const;
/** Parallax tiap kartu (px): kolom tengah paling "dekat", jadi bergeser paling jauh. */
const PARALLAX = [10, 28, 14, 18, 34, 10] as const;
/** Setengah putaran melayang LogoCard (6 dtk): kartu bertetangga berlawanan fase. */
const HALF_LOOP = 3;

const grid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } },
};

const cell: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } },
};

function floatDelay(index: number): number {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return ((column + row) % 2) * HALF_LOOP + index * 0.15;
}

export function CatalogHero(): JSX.Element {
  const status = usePageStatus();
  const roomy = useMinWidth(640);
  const { hero } = CATALOG;
  return (
    <Section
      id={CATALOG_SECTION_IDS.hero}
      spacing="none"
      labelledBy={TITLE_ID}
      className="q-page-hero pb-12 pt-8 sm:pb-16 sm:pt-10 lg:pb-16 lg:pt-12"
    >
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col items-start gap-5">
          <Pill tone="primary" size="sm" className="font-bold uppercase tracking-[0.08em]">
            {hero.eyebrow}
          </Pill>
          <h1 id={TITLE_ID} className="m-0 max-w-[16ch] text-balance font-q-display text-q-hero font-extrabold text-q-ink lg:text-q-hero-lg">
            {hero.title}
          </h1>
          <p className="m-0 max-w-[54ch] text-pretty text-lg leading-relaxed text-q-ink-soft">{hero.lead}</p>
          <div className="mt-2 flex w-full flex-col items-stretch gap-2 pb-1 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
            <Button3D href={hero.cta.href} size="lg" className="w-full sm:w-auto" data-testid="catalog-primary">
              {ctaLabelFor(hero.cta, status)}
            </Button3D>
            {/* "(gratis)" untuk pengunjung baru saja — sama dengan hero landing jalur. */}
            {status.started ? null : <span className="text-center text-sm text-q-ink-soft sm:text-left">{hero.cta.note}</span>}
          </div>
          <ul className="m-0 mt-1 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-[15px] text-q-ink" data-testid="catalog-proof">
            {hero.proof.map((item) => (
              <li key={item} className="inline-flex items-center gap-2">
                <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-q-pill bg-q-tint text-q-primary-ink">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center gap-5">
          {/* 1024–1279 px: kolom kanan paling sempit, jadi jarak antarkartu dirapatkan supaya tidak menyentuh tepi layar. */}
          <motion.div
            role="img"
            aria-label={hero.logosLabel}
            variants={grid}
            initial="hidden"
            animate="show"
            className="grid grid-cols-3 gap-x-4 gap-y-5 sm:gap-x-8 sm:gap-y-9 lg:gap-x-5 xl:gap-x-8"
            data-testid="catalog-logos"
          >
            {hero.logos.map((logo, index) => (
              <motion.div key={logo.trackId ?? logo.label} variants={cell} className={index % 3 === 1 ? 'mt-8 sm:mt-12' : ''}>
                <LogoCard
                  icons={logo.icons}
                  size={roomy ? 'lg' : 'md'}
                  tilt={TILTS[index % TILTS.length]}
                  delay={floatDelay(index)}
                  parallax={roomy ? PARALLAX[index % PARALLAX.length] : 0}
                  caption={roomy ? logo.label : undefined}
                  sub={roomy ? logo.sub : undefined}
                />
              </motion.div>
            ))}
          </motion.div>
          <p className="m-0 text-center text-sm text-q-ink-soft sm:hidden">{hero.logosCaption}</p>
        </div>
      </div>
    </Section>
  );
}
