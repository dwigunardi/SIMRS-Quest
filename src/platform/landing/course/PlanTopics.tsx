/**
 * Varian 'segera', pengganti silabus (C3) — "Rencana materi": topik-topik yang SEDANG DIRENCANAKAN untuk jalur ini
 * (`course.plan`, 4–6 topik yang diturunkan dari deskripsi registri). Jujur soal statusnya:
 * - catatan `plan.note` ("ini rencana, bukan silabus…") WAJIB tampil, tepat di bawah judul;
 * - SETIAP topik membawa badge `plan.badge` ("Rencana") dan berbingkai putus-putus — bahasa visual yang sama dengan
 *   pill "Segera" — supaya tidak terbaca sebagai pelajaran yang sudah ada;
 * - tanpa nomor urut, tanpa jumlah pelajaran, tanpa tanggal.
 * Sasaran tombol hero "Lihat rencana ⌄" (COURSE_SECTION_IDS.plan).
 */
import { Info } from 'lucide-react';
import type { SoonCourse } from '../courses/types';
import { COURSE_SECTION_IDS } from '../lib/pagesContent';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { Reveal, RevealItem } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

export interface PlanTopicsProps {
  course: SoonCourse;
}

const TITLE_ID = 'course-plan-title';
const NOTE_ID = 'course-plan-note';

export function PlanTopics({ course }: PlanTopicsProps): JSX.Element {
  const { plan } = course;
  return (
    <Section id={COURSE_SECTION_IDS.plan} labelledBy={TITLE_ID}>
      <Reveal className="flex flex-col items-center gap-6">
        <SectionHeading id={TITLE_ID} title={plan.title} lead={plan.lead} />
        <p
          id={NOTE_ID}
          className="m-0 flex max-w-[680px] items-start gap-3 rounded-q border border-q-amber/50 bg-q-amber-soft px-4 py-3 text-left text-[15px] leading-relaxed text-q-ink"
          data-testid="course-plan-note"
        >
          <Info aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-q-amber-ink" />
          <span>{plan.note}</span>
        </p>
      </Reveal>

      <Reveal as="ul" group className="m-0 mt-12 flex list-none flex-wrap justify-center gap-4 p-0 lg:gap-6">
        {plan.topics.map((topic) => (
          <RevealItem
            as="li"
            key={topic.title}
            className="flex w-full flex-col gap-3 rounded-q-lg border-2 border-dashed border-q-border-strong/50 bg-q-surface p-6 sm:w-[calc(50%-8px)] lg:w-[calc((100%-48px)/3)]"
          >
            <span className="flex items-start justify-between gap-3">
              <span aria-hidden className="grid h-11 w-11 place-items-center rounded-q bg-q-muted text-q-ink-soft">
                <Icon name={topic.icon} className="h-[22px] w-[22px]" />
              </span>
              <Pill size="sm" tone="soon" className="font-bold">
                {plan.badge}
              </Pill>
            </span>
            <h3 className="m-0 mt-1 text-balance text-lg font-bold leading-snug text-q-ink">{topic.title}</h3>
            <p className="m-0 text-pretty text-[15px] leading-relaxed text-q-ink-soft">{topic.text}</p>
          </RevealItem>
        ))}
      </Reveal>
    </Section>
  );
}
