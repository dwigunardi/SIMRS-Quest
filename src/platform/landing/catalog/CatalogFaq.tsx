/**
 * B5 — FAQ katalog: CATALOG.faq dengan <Accordion> (Radix, satu terbuka sekaligus), selebar bacaan nyaman seperti FAQ
 * Beranda. Section id WAJIB CATALOG_SECTION_IDS.faq ('faq') — tautan "Pertanyaan yang sering muncul" di footer
 * menggulir ke sini.
 */
import { CATALOG, CATALOG_SECTION_IDS } from '../lib/pagesContent';
import { Accordion } from '../ui/Accordion';
import { Reveal } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

const TITLE_ID = 'catalog-faq-title';

const ITEMS = CATALOG.faq.items.map((item) => ({
  id: item.id,
  question: item.question,
  answer: item.answer.map((paragraph) => <p key={paragraph}>{paragraph}</p>),
}));

export function CatalogFaq(): JSX.Element {
  return (
    <Section id={CATALOG_SECTION_IDS.faq} labelledBy={TITLE_ID}>
      <div className="mx-auto w-full max-w-[800px]">
        <Reveal>
          <SectionHeading id={TITLE_ID} title={CATALOG.faq.title} />
        </Reveal>
        <Reveal delay={0.1} className="mt-10">
          <Accordion items={ITEMS} defaultOpenId={ITEMS[0]?.id} />
        </Reveal>
      </div>
    </Section>
  );
}
