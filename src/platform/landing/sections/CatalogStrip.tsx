/**
 * Bagian 5 — Strip "Jelajahi 72 misi": panel hijau pinus dengan peta mini kurikulum. Satu BARIS per tier (label di
 * kiri, lalu kotak-kotaknya), dua kolom di layar lebar: tier 1–5 di kiri, 6–10 di kanan. Tiap kotak = satu misi;
 * belah ketupat di ujung tiap baris = Boss tier itu. Jumlahnya diambil dari
 * PATHS.roadmap.tiers (dicocokkan dengan kurikulum oleh verify), jadi gambarnya selalu sama dengan isi aplikasi.
 */
import { motion } from 'framer-motion';
import { cn } from '../lib/cn';
import { EXPLORE, PATHS } from '../lib/content';
import { viewportOnce } from '../lib/motion';
import { Button3D } from '../ui/Button3D';
import { Section } from '../ui/Section';

const TITLE_ID = 'catalog-title';

const group = {
  hidden: {},
  show: { transition: { staggerChildren: 0.012 } },
} as const;

const dot = {
  hidden: { opacity: 0, scale: 0.4 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 22 } },
} as const;

function MissionDot({ boss }: { boss: boolean }): JSX.Element {
  return (
    <motion.span variants={dot} className="grid h-3.5 w-3.5 place-items-center">
      <span className={cn('block', boss ? 'h-3 w-3 rotate-45 rounded-[3px] bg-q-amber' : 'h-3 w-3 rounded-[4px] bg-q-brand')} />
    </motion.span>
  );
}

export function CatalogStrip(): JSX.Element {
  const { tiers, caption, tierLabel } = PATHS.roadmap;
  return (
    <Section spacing="tight" labelledBy={TITLE_ID}>
      <div className="q-on-dark grid items-center gap-8 rounded-q-lg bg-q-band px-6 py-8 text-q-band-ink sm:px-10 sm:py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:px-12">
        <div className="flex flex-col items-start gap-3">
          <h2 id={TITLE_ID} className="m-0 text-balance text-q-h2-sm font-bold text-q-band-ink lg:text-q-h2">
            {EXPLORE.title}
          </h2>
          <p className="m-0 text-base leading-relaxed text-q-band-soft">{EXPLORE.lead}</p>
          <div className="mt-3 flex flex-wrap gap-3 pb-1">
            <Button3D href={EXPLORE.href} variant="outline" size="md" data-testid="catalog-open">
              {EXPLORE.cta}
            </Button3D>
            <Button3D href={EXPLORE.allTracks.href} variant="outline" size="md" data-testid="catalog-all-tracks">
              {EXPLORE.allTracks.label}
            </Button3D>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <motion.div
            role="img"
            aria-label={caption}
            variants={group}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            data-testid="catalog-map"
            className="grid grid-cols-1 gap-y-2.5 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-5 sm:gap-x-10"
          >
            {tiers.map((tier) => (
              <span key={tier.tier} aria-hidden title={`${tierLabel(tier.tier)}: ${tier.name}`} className="flex items-center gap-3">
                <span className="w-12 shrink-0 font-mono text-[11px] leading-none text-q-band-soft">{tierLabel(tier.tier)}</span>
                <span className="flex gap-1">
                  {Array.from({ length: tier.missions }, (_, index) => (
                    <MissionDot key={index} boss={index === tier.missions - 1} />
                  ))}
                </span>
              </span>
            ))}
          </motion.div>
          <p aria-hidden className="m-0 flex items-center gap-5 text-[13px] text-q-band-soft">
            <span className="inline-flex items-center gap-2">
              <span className="block h-3 w-3 rounded-[4px] bg-q-brand" />
              {EXPLORE.legendMission}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="block h-3 w-3 rotate-45 rounded-[3px] bg-q-amber" />
              {PATHS.roadmap.bossLabel}
            </span>
          </p>
        </div>
      </div>
    </Section>
  );
}
