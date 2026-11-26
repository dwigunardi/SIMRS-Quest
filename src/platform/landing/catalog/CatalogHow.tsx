/**
 * B5 — "Cara kerja": tiga langkah berurutan (01 Pilih jalur → 02 Kerjakan misi di browser dan langsung dinilai →
 * 03 Naik pangkat & cadangkan progresmu). Sengaja tenang: tanpa kartu, hanya garis atas, nomor besar font display, judul,
 * dan satu kalimat — supaya tidak bersaing dengan kartu urutan jalur di atasnya. Teks: CATALOG.how.
 */
import { CATALOG, CATALOG_SECTION_IDS } from '../lib/pagesContent';
import { Reveal, RevealItem } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

const TITLE_ID = 'catalog-how-title';

export function CatalogHow(): JSX.Element {
  const { how } = CATALOG;
  return (
    <Section id={CATALOG_SECTION_IDS.how} tone="tint" labelledBy={TITLE_ID}>
      <Reveal>
        <SectionHeading id={TITLE_ID} title={how.title} />
      </Reveal>
      <Reveal as="ol" group className="m-0 mt-12 grid list-none gap-10 p-0 md:grid-cols-3 md:gap-8 lg:gap-12">
        {how.steps.map((step) => (
          <RevealItem as="li" key={step.number} className="flex flex-col gap-3 border-t-2 border-q-border pt-6">
            <span aria-hidden className="font-q-display text-[44px] font-extrabold leading-none text-q-primary-ink">
              {step.number}
            </span>
            <h3 className="m-0 text-balance text-q-h3 font-bold text-q-ink">{step.title}</h3>
            <p className="m-0 max-w-[40ch] text-pretty leading-relaxed text-q-ink-soft">{step.text}</p>
          </RevealItem>
        ))}
      </Reveal>
    </Section>
  );
}
