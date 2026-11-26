/**
 * C7 — "Kenapa belajar {title} di sini": `course.why` (judul + tepat 4 butir bercentang: title, text) dalam satu kolom
 * selebar bacaan nyaman (±720 px), di atas latar mint. Butir muncul bergiliran sekali saat terlihat.
 * Section id: COURSE_SECTION_IDS.why. Hanya jalur 'tersedia' (jalur 'segera' belum punya alasan yang bisa dibuktikan —
 * perannya diambil bagian "Sambil menunggu, mulai dari SQL").
 */
import { useId } from 'react';
import { Check } from 'lucide-react';
import { COURSE_SECTION_IDS } from '../../lib/pagesContent';
import { Reveal, RevealItem } from '../../ui/Reveal';
import { Section } from '../../ui/Section';
import { SectionHeading } from '../../ui/SectionHeading';
import type { AvailableSectionProps } from './sectionProps';

export function CourseWhy({ course }: AvailableSectionProps): JSX.Element {
  const headingId = useId();
  const { why } = course;
  return (
    <Section id={COURSE_SECTION_IDS.why} tone="tint" labelledBy={headingId}>
      <div className="mx-auto w-full max-w-[720px]">
        <Reveal>
          <SectionHeading id={headingId} title={why.title} />
        </Reveal>
        <Reveal as="ul" group className="m-0 mt-12 flex list-none flex-col gap-4 p-0">
          {why.items.map((item) => (
            <RevealItem as="li" key={item.title} className="flex gap-4 rounded-q-lg border border-q-border bg-q-surface p-5 sm:gap-5 sm:p-6">
              <span aria-hidden className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-q-primary text-q-on-primary">
                <Check className="h-[18px] w-[18px]" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <h3 className="m-0 text-pretty text-lg font-bold leading-snug text-q-ink">{item.title}</h3>
                <p className="m-0 mt-1.5 text-pretty text-[15px] leading-relaxed text-q-ink-soft">{item.text}</p>
              </span>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </Section>
  );
}
