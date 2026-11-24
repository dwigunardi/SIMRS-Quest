/**
 * Bagian 4 — "Belajar untuk pekerjaan, bukan sekadar bahasa": tab jalur + peta zig-zag 10 tier jalur SQL.
 * Jalur yang belum tersedia menampilkan keadaan "Segera" apa adanya (tanpa tanggal, tanpa isi karangan).
 *
 * `glance` (ringkasan progres jalur SQL dari Beranda) hanya dipakai untuk menandai tier tempat misi "Lanjutkan"
 * berada dan — bila semua misi tuntas — mencentang seluruh peta. Ringkasan itu tidak memuat rincian per tier, jadi
 * tier lain sengaja TIDAK ditandai "selesai": kemajuan tidak dikarang.
 */
import { useMemo, useState } from 'react';
import type { TrackGlance } from '../../tracks';
import { Mascot } from '../illustrations/Mascot';
import { cn } from '../lib/cn';
import { PATHS, SECTION_IDS, SOON_LABEL, TRACKS, type LandingTrack } from '../lib/content';
import { Button3D } from '../ui/Button3D';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { Reveal } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';
import { Tabs, type TabItem } from '../ui/Tabs';
import { RoadmapMap } from './Roadmap/RoadmapMap';

export interface RoadmapProps {
  /** Ringkasan jalur SQL; null = belum dimuat / tidak tersedia → peta tampil tanpa tanda kemajuan. */
  glance: TrackGlance | null;
}

const HEADING_ID = 'jalur-judul';
const CAPTION_ID = 'jalur-peta';

/** Tier tempat misi "Lanjutkan" berada, atau null bila tidak bisa dipastikan. */
function currentTierOf(glance: TrackGlance | null): number | null {
  if (!glance || !glance.started || !glance.resume) return null;
  const tiers = PATHS.roadmap.tiers;
  const labelled = /^Tier (\d+)/.exec(glance.resume.tierLabel);
  if (labelled) {
    const tier = Number(labelled[1]);
    return tiers.some((item) => item.tier === tier) ? tier : null;
  }
  // Cadangan: nomor urut misi dibandingkan dengan jumlah misi per tier.
  let end = 0;
  for (const tier of tiers) {
    end += tier.missions;
    if (glance.resume.order <= end) return tier.tier;
  }
  return null;
}

function SqlPanel({ glance }: RoadmapProps): JSX.Element {
  const started = glance !== null && glance.started;
  const allDone = started && glance.resume === null && glance.total > 0 && glance.completed >= glance.total;
  return (
    <div>
      <div className="mb-8 flex flex-col items-center gap-3 text-center sm:mb-4">
        <p id={CAPTION_ID} className="flex items-center gap-2 text-sm text-q-ink-soft">
          <Icon name="database" className="h-4 w-4 text-q-primary-ink" />
          {PATHS.roadmap.caption}
        </p>
        <p className="max-w-[56ch] text-pretty text-sm leading-relaxed text-q-ink-soft" data-testid="roadmap-boss-note">
          {PATHS.roadmap.bossNote}
        </p>
        {started ? (
          <Pill tone={allDone ? 'success' : 'primary'} icon={<Icon name={allDone ? 'trophy' : 'check'} className="h-4 w-4" />} className="font-bold">
            {allDone ? PATHS.roadmap.allDone : PATHS.roadmap.progress(glance.completed, glance.total)}
          </Pill>
        ) : null}
      </div>
      <RoadmapMap currentTier={currentTierOf(glance)} allDone={allDone} hereLabel={PATHS.roadmap.here} labelledBy={CAPTION_ID} />
    </div>
  );
}

function SoonPanel({ track }: { track: LandingTrack }): JSX.Element {
  return (
    <Card radius="lg" padding="lg" className="mx-auto flex max-w-[760px] flex-col items-center gap-6 border-2 border-dashed border-q-border-strong text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
      <Mascot expression="think" className="w-24 shrink-0 sm:w-28" />
      <div className="flex min-w-0 flex-col items-center gap-3 sm:items-start">
        <Pill tone="soon" size="sm" icon={<Icon name={track.icon} className="h-3.5 w-3.5" />}>
          {SOON_LABEL}
        </Pill>
        <h3 className="text-balance text-q-h3 font-bold text-q-ink">{PATHS.soon.title(track.title)}</h3>
        <p className="text-pretty leading-relaxed text-q-ink">{track.summary}</p>
        <p className="text-pretty text-sm leading-relaxed text-q-ink-soft">{PATHS.soon.body}</p>
        <div className="pb-1 pt-1">
          <Button3D href={PATHS.soon.href} variant="outline" iconLeft={<Icon name="database" className="h-4 w-4" />}>
            {PATHS.soon.cta}
          </Button3D>
        </div>
      </div>
    </Card>
  );
}

export function Roadmap({ glance }: RoadmapProps): JSX.Element {
  const [active, setActive] = useState<string>(TRACKS[0]?.id ?? '');

  const items = useMemo<TabItem[]>(
    () =>
      TRACKS.map((track) => ({
        value: track.id,
        label: track.title,
        // Penanda uji: tiap tombol tab membawa id jalurnya.
        data: { 'data-track': track.id },
        icon: <Icon name={track.icon} className="h-4 w-4" />,
        badge:
          track.status === 'segera' ? (
            // Di atas tab aktif (hijau) chip memakai warna teks tab supaya tetap terbaca.
            <Pill size="sm" tone="soon" className={cn('h-5 px-2 text-[11px]', track.id === active ? 'border-q-on-primary/70 text-q-on-primary' : '')}>
              {SOON_LABEL}
            </Pill>
          ) : undefined,
      })),
    [active],
  );

  return (
    <Section id={SECTION_IDS.paths} labelledBy={HEADING_ID}>
      <Reveal>
        <SectionHeading id={HEADING_ID} title={PATHS.title} lead={PATHS.lead} />
      </Reveal>
      <div className="mt-10">
        <Tabs items={items} value={active} onValueChange={setActive} ariaLabel={PATHS.tabsLabel} panelClassName="mt-10">
          {(value) => {
            const track = TRACKS.find((item) => item.id === value);
            if (!track) return null;
            return track.status === 'tersedia' ? <SqlPanel glance={glance} /> : <SoonPanel track={track} />;
          }}
        </Tabs>
      </div>
    </Section>
  );
}
