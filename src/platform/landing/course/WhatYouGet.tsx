/**
 * C5 — Judul deretan fitur (C6): eyebrow bergaris "Apa yang kamu dapat" (kapital lewat CSS) + H2 "Semua yang kamu
 * butuhkan untuk belajar {Nama}" dari `course.promise`. Hanya jalur 'tersedia'.
 *
 * Diletakkan DI DALAM section baris fitur (pages/course/CourseRows.tsx) dan menjadi nama aksesibel section itu.
 */
import type { AvailableCourse } from '../courses/types';
import { Eyebrow } from '../ui/Eyebrow';
import { Reveal } from '../ui/Reveal';
import { SectionHeading } from '../ui/SectionHeading';

export interface PromiseHeadingProps {
  course: AvailableCourse;
  /** id judul, untuk <Section labelledBy>. */
  id: string;
}

export function PromiseHeading({ course, id }: PromiseHeadingProps): JSX.Element {
  return (
    <Reveal className="flex flex-col items-center gap-5">
      <Eyebrow>{course.promise.eyebrow}</Eyebrow>
      <SectionHeading id={id} title={course.promise.title} />
    </Reveal>
  );
}
