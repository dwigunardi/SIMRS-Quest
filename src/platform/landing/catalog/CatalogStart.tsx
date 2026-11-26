/**
 * B3 — Kartu "Belum tahu mulai dari mana?": jawaban yang jujur dan satu arah — mulai dari SQL, karena semua jalur memakai
 * database SIMRS yang sama dan baru SQL yang sudah bisa dikerjakan. Section mint dengan kartu putih radius 40 px; di layar lebar Kapi berdiri
 * di kiri menunjuk ke isinya, di samping kartu logo SQL. Tombol utama "Mulai dari SQL" ('#/sql') + tombol kedua ke
 * landing jalur SQL. Teks: CATALOG.start.
 */
import { Check } from 'lucide-react';
import { Mascot } from '../illustrations/Mascot';
import { CATALOG, CATALOG_SECTION_IDS } from '../lib/pagesContent';
import { Button3D } from '../ui/Button3D';
import { LogoCard } from '../ui/LogoCard';
import { Reveal } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

const TITLE_ID = 'catalog-start-title';

export function CatalogStart(): JSX.Element {
  const { start } = CATALOG;
  return (
    <Section id={CATALOG_SECTION_IDS.start} tone="tint" labelledBy={TITLE_ID}>
      <Reveal className="grid items-center gap-10 rounded-[40px] border border-q-border bg-q-surface px-6 py-10 shadow-q-float sm:px-10 sm:py-12 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-16 lg:px-16 lg:py-14">
        {/* Hiasan: Kapi menunjuk ke isi kartu, kartu logo SQL melayang di belakangnya. */}
        <div aria-hidden className="relative mx-auto hidden h-[260px] w-[260px] lg:block">
          <LogoCard icons={['database']} size="lg" tilt={7} delay={1.4} className="absolute right-0 top-0" />
          <Mascot pose="point" expression="smile" className="absolute bottom-0 left-2 w-[150px]" />
        </div>

        <div className="flex flex-col items-start gap-6">
          <SectionHeading id={TITLE_ID} title={start.title} lead={start.text} align="start" />
          <ul className="m-0 flex list-none flex-col gap-3 p-0 text-base text-q-ink">
            {start.reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-3">
                <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-q-pill bg-q-primary text-q-on-primary">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
          <div className="flex w-full flex-col gap-3 pb-1 sm:w-auto sm:flex-row">
            <Button3D href={start.cta.href} size="lg" className="w-full sm:w-auto" data-testid="catalog-start-sql">
              {start.cta.label}
            </Button3D>
            <Button3D href={start.secondary.href} size="lg" variant="outline" className="w-full sm:w-auto">
              {start.secondary.label}
            </Button3D>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
