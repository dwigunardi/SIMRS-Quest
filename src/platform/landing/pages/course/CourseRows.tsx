/**
 * C5 + C6 — judul "Apa yang kamu dapat" lalu enam baris fitur bergantian (rows/*.tsx): a jalankan query sungguhan,
 * b streak (latar mint), c belajar di mana saja, d taklukkan Boss, e banyak cara belajar, f pangkat & lencana. Hanya
 * jalur 'tersedia'.
 *
 * Judul C5 (eyebrow bergaris `course.promise.eyebrow` + H2 `course.promise.title`, <PromiseHeading> dari
 * course/WhatYouGet.tsx) menjadi nama aksesibel section ini.
 *
 * Satu <section> (id COURSE_SECTION_IDS.rows); tiap baris = <article> berjudul h3. Section-nya `bleed` supaya pita mint
 * baris streak bisa selebar layar; setiap baris memasang Container-nya sendiri. Status Boss, streak, dan daftar tier di
 * ponsel dibaca dari props `progress` (useCourseProgress — hanya baca).
 */
import { useId } from 'react';
import { PromiseHeading } from '../../course/WhatYouGet';
import { COURSE_SECTION_IDS } from '../../lib/pagesContent';
import { Container, Section } from '../../ui/Section';
import { AnywhereRow } from './rows/AnywhereRow';
import { BossRow } from './rows/BossRow';
import { RanksRow } from './rows/RanksRow';
import { RunRow } from './rows/RunRow';
import { StreakRow } from './rows/StreakRow';
import { WaysRow } from './rows/WaysRow';
import type { CourseRowsProps } from './sectionProps';

export function CourseRows({ course, progress }: CourseRowsProps): JSX.Element {
  const headingId = useId();
  return (
    <Section id={COURSE_SECTION_IDS.rows} bleed labelledBy={headingId}>
      <Container>
        <PromiseHeading course={course} id={headingId} />
      </Container>
      {/* Latar berselang: putih → mint (streak) → putih → mint (Boss) → putih → putih, lalu "Kenapa" bermint. */}
      <div className="mt-14 flex flex-col gap-24 lg:mt-20 lg:gap-32">
        <RunRow course={course} started={progress.started} />
        <StreakRow course={course} progress={progress} />
        <AnywhereRow course={course} progress={progress} />
        <BossRow course={course} progress={progress} />
        <WaysRow course={course} />
        <RanksRow course={course} />
      </div>
    </Section>
  );
}
