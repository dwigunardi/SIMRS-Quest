/**
 * C8 — FAQ jalur: `course.faq` (judul + 6 pertanyaan; jawaban = satu paragraf per butir) dengan <Accordion>
 * (ui/Accordion.tsx — Radix: aria-expanded/aria-controls, panah atas/bawah, tinggi isi teranimasi), selebar bacaan
 * nyaman (±800 px), sama dengan FAQ Beranda. Pertanyaan pertama terbuka sejak awal.
 * Section id WAJIB COURSE_SECTION_IDS.faq ('faq'): tautan "Pertanyaan yang sering muncul" di footer menggulir ke sini.
 * Kedua varian (jalur 'segera' berisi pertanyaan jujur: kapan, sudah bisa dicoba, perlu instal apa, progres SQL).
 */
import { useId, useMemo } from 'react';
import { COURSE_SECTION_IDS } from '../../lib/pagesContent';
import { Accordion, type AccordionItem } from '../../ui/Accordion';
import { Reveal } from '../../ui/Reveal';
import { Section } from '../../ui/Section';
import { SectionHeading } from '../../ui/SectionHeading';
import type { CourseSectionProps } from './sectionProps';

export function CourseFaq({ course }: CourseSectionProps): JSX.Element {
  const headingId = useId();
  const { faq } = course;
  const items = useMemo<AccordionItem[]>(
    () =>
      faq.items.map((item) => ({
        id: item.id,
        question: item.question,
        answer: item.answer.map((paragraph) => <p key={paragraph}>{paragraph}</p>),
      })),
    [faq],
  );
  return (
    <Section id={COURSE_SECTION_IDS.faq} labelledBy={headingId}>
      <div className="mx-auto w-full max-w-[800px]">
        <Reveal>
          <SectionHeading id={headingId} title={faq.title} lead={faq.lead} />
        </Reveal>
        <Reveal delay={0.1} className="mt-10">
          <Accordion items={items} defaultOpenId={items[0]?.id} />
        </Reveal>
      </div>
    </Section>
  );
}
