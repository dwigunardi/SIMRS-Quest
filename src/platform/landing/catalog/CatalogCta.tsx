/**
 * B5 — CTA penutup katalog: judul besar font display, satu tombol ke jalur SQL, lalu "laut" teal tempat Kapi mengapung
 * — penutup yang sama dengan Beranda, supaya katalog terasa satu rumah dengannya. Judul & tombol mengikuti status
 * pengguna: baru → "Misi pertamamu sudah menunggu" / Mulai belajar; sudah mulai → "Lanjutkan dari misi terakhirmu" /
 * Lanjutkan; semua misi tuntas → judul "tuntas" Beranda (CTA.allDone) / Buka jalur SQL.
 */
import { FloatingBits, type FloatingBitItem } from '../illustrations/FloatingBits';
import { Mascot } from '../illustrations/Mascot';
import { Wave } from '../illustrations/Wave';
import { ctaLabelFor, usePageStatus } from '../layout/pageStatus';
import { CTA } from '../lib/content';
import { CATALOG, CATALOG_SECTION_IDS } from '../lib/pagesContent';
import { Button3D } from '../ui/Button3D';
import { Reveal } from '../ui/Reveal';
import { Section } from '../ui/Section';

const TITLE_ID = 'catalog-cta-title';

/** Benda di sekitar Kapi — semuanya ada di aplikasi (tabel data, centang, api streak, piala Boss). */
const BITS: readonly FloatingBitItem[] = [
  { kind: 'table', className: 'left-[5%] top-[10%] sm:left-[14%]', size: 50, tilt: -8, delay: 0 },
  { kind: 'check', className: 'right-[6%] top-[4%] sm:right-[15%]', size: 46, tilt: 10, delay: 0.6 },
  { kind: 'flame', className: 'left-[27%] top-[44%] hidden sm:block', size: 44, tilt: 8, delay: 1.1 },
  { kind: 'trophy', className: 'right-[26%] top-[46%] hidden sm:block', size: 48, tilt: -9, delay: 1.6 },
];

export function CatalogCta(): JSX.Element {
  const status = usePageStatus();
  const { cta } = CATALOG;
  const allDone = status.mode === 'open' && status.started;
  let title: string = cta.title;
  let lead: string = cta.lead;
  if (allDone) {
    title = CTA.allDone.title;
    lead = CTA.allDone.lead;
  } else if (status.mode === 'resume') {
    title = cta.titleReturning;
  }
  return (
    <Section id={CATALOG_SECTION_IDS.cta} spacing="none" bleed gap labelledBy={TITLE_ID} className="pt-q-section lg:pt-q-section-lg">
      <Reveal className="relative z-10 mx-auto flex w-full max-w-q-content flex-col items-center gap-5 px-q-gutter text-center">
        <h2 id={TITLE_ID} className="m-0 max-w-[18ch] text-balance font-q-display text-[34px] font-extrabold leading-[1.12] text-q-ink sm:text-q-h2 lg:text-q-hero-lg">
          {title}
        </h2>
        <p className="m-0 text-pretty text-lg text-q-ink-soft">{lead}</p>
        <div className="mt-3 w-full max-w-[320px] pb-1">
          <Button3D href={cta.href} size="lg" fullWidth data-testid="catalog-cta-primary">
            {ctaLabelFor(cta, status)}
          </Button3D>
        </div>
      </Reveal>

      {/* Laut: gelombang depan menutupi kaki Kapi, jadi ia tampak mengapung. */}
      <div className="relative mt-10 h-[210px] sm:h-[230px]">
        <FloatingBits items={BITS} />
        <Mascot pose="wave" expression="smile" className="absolute bottom-[14px] left-1/2 w-[124px] -translate-x-1/2 sm:w-[140px]" />
        <Wave animated className="absolute inset-x-0 bottom-0 h-[84px] sm:h-[100px]" />
      </div>
      <div aria-hidden className="h-8 bg-q-brand" />
    </Section>
  );
}
