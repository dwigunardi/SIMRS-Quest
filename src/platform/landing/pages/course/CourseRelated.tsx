/**
 * C9 — "Jalur yang terhubung dengan {title}": paragraf `course.related.lead` + grid <CourseCard step showEnv /> untuk
 * jalur lain di registri, urut langkah yang DISARANKAN (relatedCourses — SQL → JavaScript & TypeScript → REST API →
 * React → NestJS · Next.js · Laravel). Posisi jalur ini di urutan itu ditandai satu chip, dan `related.note`
 * menegaskan bahwa urutannya saran, bukan syarat. Section id: COURSE_SECTION_IDS.related. Kedua varian.
 */
import { useId } from 'react';
import { Route } from 'lucide-react';
import { courseSummary, relatedCourses } from '../../courses/catalog';
import { COURSE_SECTION_IDS, COURSE_UI } from '../../lib/pagesContent';
import { Chip } from '../../ui/Chip';
import { CourseCard } from '../../ui/CourseCard';
import { Reveal, RevealItem } from '../../ui/Reveal';
import { Section } from '../../ui/Section';
import { SectionHeading } from '../../ui/SectionHeading';
import type { CourseSectionProps } from './sectionProps';
import { keepDots } from './text';

export function CourseRelated({ course }: CourseSectionProps): JSX.Element {
  const headingId = useId();
  const { related } = course;
  const here = courseSummary(course.id);
  const others = relatedCourses(course.id);
  return (
    <Section id={COURSE_SECTION_IDS.related} tone="tint" labelledBy={headingId}>
      <Reveal className="flex flex-col items-center gap-5">
        <SectionHeading id={headingId} title={keepDots(related.title)} lead={related.lead} />
        <p className="m-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-sm text-q-ink-soft">
          {here ? (
            <Chip tone="primary" size="md" data={{ 'data-testid': 'related-here' }}>
              {COURSE_UI.related.here}: {COURSE_UI.related.step(here.step)}
            </Chip>
          ) : null}
          {/* Ikon mengalir bersama teks, jadi tetap menempel pada kata pertama saat kalimatnya terlipat. */}
          <span>
            <Route aria-hidden className="mr-1.5 inline-block h-4 w-4 -translate-y-px align-middle text-q-primary-ink" />
            {related.note}
          </span>
        </p>
      </Reveal>
      <Reveal as="ul" group className="m-0 mt-10 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {others.map((other) => (
          <RevealItem as="li" key={other.id} className="min-w-0">
            <CourseCard course={other} step showEnv />
          </RevealItem>
        ))}
      </Reveal>
    </Section>
  );
}
