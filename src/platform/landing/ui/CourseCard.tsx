/**
 * Kartu satu jalur (seluruh kartu = tautan ke '#/landing/<id>'): ikon, status, judul, tagline registri, dan
 * opsional chip "Langkah n" (urutan yang disarankan) serta tempat mengerjakannya (Di browser / VS Code).
 * Dipakai katalog (B2, B4), "Jalur yang terhubung" (C9), dan halaman 404.
 *
 *   {COURSES_BY_STEP.map((course) => <CourseCard key={course.id} course={course} step />)}
 *
 * Disorot: naik 2 px + bayangan (bayangannya lapisan yang memudar — hanya transform & opacity yang dianimasikan).
 */
import { useId } from 'react';
import { ArrowRight } from 'lucide-react';
import type { CourseSummary } from '../courses/catalog';
import { cn } from '../lib/cn';
import { COURSE_UI } from '../lib/pagesContent';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { Pill } from './Pill';

export interface CourseCardProps {
  course: CourseSummary;
  /** Tampilkan chip "Langkah n" (posisi di urutan yang disarankan). */
  step?: boolean;
  /** Tampilkan chip tempat mengerjakan (Di browser / VS Code). */
  showEnv?: boolean;
  /** Tingkat judul kartu (bawaan h3 — kartu berada di bawah h2 section). */
  headingLevel?: 'h2' | 'h3' | 'h4';
  className?: string;
}

export function CourseCard({ course, step = false, showEnv = false, headingLevel = 'h3', className }: CourseCardProps): JSX.Element {
  const Heading = headingLevel;
  const available = course.status === 'tersedia';
  const id = useId();
  const titleId = `${id}-judul`;
  const statusId = `${id}-status`;
  const textId = `${id}-teks`;
  return (
    // Nama tautan = nama jalur; status & ringkasan menjadi keterangannya (bukan dibacakan lebih dulu dari namanya).
    <a
      href={course.href}
      data-course={course.id}
      data-featured={available ? 'true' : undefined}
      aria-labelledby={titleId}
      aria-describedby={`${statusId} ${textId}`}
      className={cn(
        'group relative isolate flex h-full flex-col gap-3 rounded-q-lg border p-5 text-q-ink no-underline transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none sm:p-6',
        // Satu-satunya jalur yang sudah bisa dikerjakan tampil lebih tegas daripada kartu "Segera".
        available ? 'border-q-primary/50 bg-q-tint' : 'border-q-border bg-q-surface',
        className,
      )}
    >
      <span aria-hidden className="q-anim pointer-events-none absolute inset-0 -z-10 rounded-q-lg opacity-0 shadow-q-float transition-opacity duration-200 group-hover:opacity-100" />
      <span className="flex items-start justify-between gap-3">
        <span aria-hidden className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-q', available ? 'bg-q-primary text-q-on-primary' : 'bg-q-muted text-q-ink-soft')}>
          <Icon name={course.icon} className="h-6 w-6" />
        </span>
        <span id={statusId}>
          <Pill size="sm" tone={available ? 'success' : 'soon'}>
            {COURSE_UI.cardStatus[course.status]}
          </Pill>
        </span>
      </span>
      {step ? <Chip className="self-start">{COURSE_UI.related.step(course.step)}</Chip> : null}
      <Heading id={titleId} className="m-0 text-lg font-bold leading-snug text-q-ink">
        {course.title}
      </Heading>
      {/* Tagline registri (kalimat pendek yang utuh) — deskripsi panjang terpotong di tengah kata bila dijepit 2 baris. */}
      <p id={textId} className="m-0 text-pretty text-[15px] leading-relaxed text-q-ink-soft">
        {course.tagline}
      </p>
      <span className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        {showEnv ? <Chip icon={course.env === 'browser' ? 'app-window' : 'terminal'}>{COURSE_UI.env[course.env]}</Chip> : null}
        <span className="ml-auto inline-flex items-center gap-1 text-sm font-bold text-q-primary-ink">
          {COURSE_UI.related.open}
          <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
      </span>
    </a>
  );
}
