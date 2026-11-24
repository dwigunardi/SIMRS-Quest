/**
 * Bagian 12 — FAQ: tanya-jawab (Radix Accordion lewat ui/Accordion) selebar bacaan nyaman (maks ±800px).
 * Chevron berputar dan tinggi isi dianimasikan oleh komponen Accordion; semua pertanyaan & jawaban dari content.ts.
 */
import { useId } from 'react';
import { FAQ as FAQ_CONTENT, SECTION_IDS } from '../lib/content';
import { Accordion } from '../ui/Accordion';
import { Reveal } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

const ITEMS = FAQ_CONTENT.items.map((item) => ({
  id: item.id,
  question: item.question,
  answer: item.answer.map((paragraph) => <p key={paragraph}>{paragraph}</p>),
}));

export function FAQ(): JSX.Element {
  const headingId = useId();
  return (
    <Section id={SECTION_IDS.faq} labelledBy={headingId}>
      <div className="mx-auto w-full max-w-[800px]">
        <Reveal>
          <SectionHeading id={headingId} title={FAQ_CONTENT.title} />
        </Reveal>
        <Reveal delay={0.1} className="mt-10">
          <Accordion items={ITEMS} defaultOpenId={ITEMS[0]?.id} />
        </Reveal>
      </div>
    </Section>
  );
}
