/**
 * B4 — "Urutan belajar yang kami sarankan": satu kartu berisi langkah 1–5 (COURSES_BY_STEP: SQL → JavaScript &
 * TypeScript → REST API → React → NestJS · Next.js · Laravel). Ini benar-benar urutan, jadi nomornya bermakna; daftar
 * berupa <ol>. Layar lebar: lima kolom dengan garis putus-putus di antara lingkaran nomor; layar sempit: garis menurun
 * di kiri. Lingkaran penuh = jalur yang sudah bisa dikerjakan, lingkaran bergaris putus-putus = Segera. Seluruh langkah
 * bisa diklik (tautan judulnya diperluas) dan menuju landing jalur itu.
 */
import { COURSES_BY_STEP } from '../courses/catalog';
import { cn } from '../lib/cn';
import { CATALOG, CATALOG_SECTION_IDS, COURSE_UI } from '../lib/pagesContent';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { Reveal, RevealItem } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

const TITLE_ID = 'catalog-order-title';

export function CatalogOrder(): JSX.Element {
  const { order } = CATALOG;
  const last = COURSES_BY_STEP.length - 1;
  return (
    <Section id={CATALOG_SECTION_IDS.order} labelledBy={TITLE_ID}>
      <Reveal>
        <SectionHeading id={TITLE_ID} title={order.title} lead={order.lead} />
      </Reveal>
      <div className="mt-10 rounded-q-lg border border-q-border bg-q-surface px-5 py-8 shadow-q-float sm:px-8 lg:mt-12 lg:px-10 lg:py-10">
        <Reveal as="ol" group className="m-0 grid list-none p-0 lg:grid-cols-5">
          {COURSES_BY_STEP.map((course, index) => {
            const available = course.status === 'tersedia';
            return (
              <RevealItem as="li" key={course.id} className={cn('group relative flex gap-4 lg:flex-col lg:pr-5', index < last ? 'pb-8 lg:pb-0' : '')}>
                {index < last ? (
                  <span
                    aria-hidden
                    className="absolute bottom-1 left-[23px] top-[56px] border-l-2 border-dashed border-q-border-strong lg:bottom-auto lg:left-[60px] lg:right-3 lg:top-[23px] lg:border-l-0 lg:border-t-2"
                  />
                ) : null}
                <span
                  aria-hidden
                  className={cn(
                    'relative grid h-12 w-12 shrink-0 place-items-center rounded-q-pill font-q-display text-lg font-bold',
                    available ? 'bg-q-primary text-q-on-primary' : 'border-2 border-dashed border-q-border-strong bg-q-surface text-q-ink-soft',
                  )}
                >
                  {course.step}
                </span>
                {/* Layar lebar: status menempel di dasar kolom, jadi kelima status sejajar walau panjang teksnya beda. */}
                <div className="flex min-w-0 flex-col items-start gap-2 pt-1 lg:flex-1 lg:pt-0">
                  <h3 className="m-0 text-lg font-bold leading-snug text-q-ink">
                    <a
                      href={course.href}
                      data-course={course.id}
                      className="inline-flex items-start gap-2 text-q-ink no-underline transition-colors duration-150 after:absolute after:inset-0 after:content-[''] group-hover:text-q-primary-ink"
                    >
                      <Icon name={course.icon} className={cn('mt-0.5 h-5 w-5 shrink-0', available ? 'text-q-primary-ink' : 'text-q-ink-soft')} />
                      <span>{course.title}</span>
                    </a>
                  </h3>
                  <p className="m-0 text-pretty text-[15px] leading-relaxed text-q-ink-soft">{course.stepNote}</p>
                  <Pill size="sm" tone={available ? 'success' : 'soon'} className="lg:mt-auto">
                    {COURSE_UI.cardStatus[course.status]}
                  </Pill>
                </div>
              </RevealItem>
            );
          })}
        </Reveal>
      </div>
    </Section>
  );
}
