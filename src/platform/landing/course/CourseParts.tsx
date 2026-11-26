/**
 * C4 — "Isi jalur {Nama}": grid 2 kolom (1 kolom di ponsel) kartu bagian aplikasi yang SUDAH ada — Misi, Materi, Free
 * Playground, Lab Performa, Mode Ujian & latihan ulang, Progres (`course.parts`). Setiap kartu = satu tautan ke hash
 * bagian itu (data, diperiksa verify): judul, deskripsi, garis, lalu ikon + hitungan dan panah.
 *
 * Disorot: naik 2 px + bayangan. Bayangannya lapisan yang memudar (hanya transform & opacity yang dianimasikan), sama
 * dengan CourseCard. Hanya jalur 'tersedia'.
 */
import { ArrowRight } from 'lucide-react';
import type { AvailableCourse } from '../courses/types';
import { COURSE_SECTION_IDS } from '../lib/pagesContent';
import { Icon } from '../ui/Icon';
import { Reveal, RevealItem } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

export interface CoursePartsProps {
  course: AvailableCourse;
}

const TITLE_ID = 'course-parts-title';

export function CourseParts({ course }: CoursePartsProps): JSX.Element {
  const { parts } = course;
  return (
    <Section id={COURSE_SECTION_IDS.parts} labelledBy={TITLE_ID}>
      <Reveal>
        <SectionHeading id={TITLE_ID} title={parts.title} lead={parts.lead} />
      </Reveal>
      <Reveal as="ul" group className="m-0 mt-12 grid list-none gap-4 p-0 md:grid-cols-2 lg:gap-6">
        {parts.items.map((part) => (
          <RevealItem as="li" key={part.id}>
            <a
              href={part.href}
              data-part={part.id}
              className="group relative isolate flex h-full flex-col rounded-q-lg border border-q-border bg-q-surface p-6 text-q-ink no-underline transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none sm:p-7"
            >
              <span aria-hidden className="q-anim pointer-events-none absolute inset-0 -z-10 rounded-q-lg opacity-0 shadow-q-float transition-opacity duration-200 group-hover:opacity-100" />
              <h3 className="m-0 text-q-h3 font-bold text-q-ink">{part.title}</h3>
              <p className="m-0 mt-2 text-pretty text-[15px] leading-relaxed text-q-ink-soft">{part.text}</p>
              <span aria-hidden className="mb-4 mt-5 block h-px w-full bg-q-border" />
              <span className="mt-auto flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2.5 text-[15px] font-bold text-q-ink">
                  <span aria-hidden className="grid h-9 w-9 place-items-center rounded-q bg-q-tint text-q-primary-ink">
                    <Icon name={part.icon} className="h-[18px] w-[18px]" />
                  </span>
                  {part.count}
                </span>
                <ArrowRight
                  aria-hidden
                  className="h-5 w-5 shrink-0 text-q-primary-ink transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </span>
            </a>
          </RevealItem>
        ))}
      </Reveal>
    </Section>
  );
}
