/**
 * Varian 'segera', pengganti "Isi jalur" (C4) — "Cara mengerjakannya" (`course.how`): tempat jalur ini direncanakan
 * dikerjakan, sesuai keputusan pemilik — editor di browser (JavaScript & TypeScript, REST API, React) atau VS Code +
 * runner lokal yang melaporkan hasil test ke aplikasi (NestJS · Next.js · Laravel).
 *
 * Pill lingkungan (Di browser / VS Code), tiga langkah berikon, dan catatan `how.note` (detail masih bisa berubah) yang
 * WAJIB tampil. Untuk VS Code langkahnya memang berurutan (proyek → runner → hasil tercatat), jadi dirender sebagai <ol>
 * dengan panah penyambung; untuk browser ketiganya ciri yang setara (<ul>, tanpa panah).
 */
import { ArrowDown, ArrowRight } from 'lucide-react';
import type { SoonCourse } from '../courses/types';
import { cn } from '../lib/cn';
import { COURSE_SECTION_IDS, COURSE_UI } from '../lib/pagesContent';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { Reveal } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

export interface HowItWorksProps {
  course: SoonCourse;
}

const TITLE_ID = 'course-how-title';

export function HowItWorks({ course }: HowItWorksProps): JSX.Element {
  const { how } = course;
  const flow = how.env === 'vscode';
  const List = flow ? 'ol' : 'ul';
  return (
    <Section id={COURSE_SECTION_IDS.how} tone="tint" labelledBy={TITLE_ID}>
      <Reveal className="flex flex-col items-center gap-6">
        <SectionHeading id={TITLE_ID} title={how.title} lead={how.lead} />
        <span data-testid="course-how-env" data-env={how.env}>
          <Pill tone="surface" icon={<Icon name={flow ? 'terminal' : 'app-window'} className="h-4 w-4 text-q-primary-ink" />} className="font-bold">
            {COURSE_UI.env[how.env]}
          </Pill>
        </span>
      </Reveal>

      <Reveal className="mt-12">
        <List className={cn('m-0 grid list-none p-0 lg:grid-cols-3', flow ? 'gap-10 lg:gap-12' : 'gap-4 lg:gap-6')}>
          {how.steps.map((step, index) => (
            <li key={step.title} className="relative flex flex-col gap-3 rounded-q-lg border border-q-border bg-q-surface p-6 sm:p-7">
              <span aria-hidden className="grid h-12 w-12 place-items-center rounded-q bg-q-tint text-q-primary-ink">
                <Icon name={step.icon} className="h-6 w-6" />
              </span>
              <h3 className="m-0 mt-1 text-balance text-lg font-bold leading-snug text-q-ink">{step.title}</h3>
              <p className="m-0 text-pretty text-[15px] leading-relaxed text-q-ink-soft">{step.text}</p>
              {flow && index < how.steps.length - 1 ? <FlowArrow /> : null}
            </li>
          ))}
        </List>
      </Reveal>

      <p className="m-0 mx-auto mt-8 max-w-[60ch] text-pretty text-center text-sm leading-relaxed text-q-ink-soft" data-testid="course-how-note">
        {how.note}
      </p>
    </Section>
  );
}

/** Panah ke langkah berikutnya: ke bawah saat kartu bertumpuk, ke kanan mulai lg. Hiasan. */
function FlowArrow(): JSX.Element {
  return (
    <span
      aria-hidden
      className="absolute -bottom-[34px] left-1/2 z-10 grid h-7 w-7 -translate-x-1/2 place-items-center rounded-full border border-q-border bg-q-surface text-q-primary-ink lg:-right-[38px] lg:bottom-auto lg:left-auto lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0"
    >
      <ArrowDown className="h-4 w-4 lg:hidden" />
      <ArrowRight className="hidden h-4 w-4 lg:block" />
    </span>
  );
}
