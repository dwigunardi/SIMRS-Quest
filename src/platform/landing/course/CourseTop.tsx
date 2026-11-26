/**
 * Bagian ATAS landing jalur ('#/landing/<id>'), dirakit dari data jalur (courses/*.ts) — satu template untuk semua jalur:
 *
 *   'tersedia': C1 CourseHero → C2 FeatureGrid → C3 Syllabus → C4 CourseParts
 *   'segera'  : C1 CourseHero → PlanTopics ("Rencana materi", pengganti C3) → HowItWorks ("Cara mengerjakannya",
 *               pengganti C4)
 *
 * Sesudahnya halaman melanjutkan dengan CourseBottom (course/CourseBottom.tsx): judul C5 + baris fitur C6 … CTA C10.
 * Judul C5 sengaja ada di section baris fitur (bukan di sini) supaya menjadi nama aksesibel section itu.
 *
 * State yang diurus di sini: tier silabus yang terbuka (Accordion terkendali) — tombol hero "Lihat silabus ⌄" menggulir
 * ke silabus DAN membuka tier pertama; "Lihat rencana ⌄" (jalur 'segera') hanya menggulir.
 *
 * Komponen ini RINGAN (tidak mengimpor data misi): data & progres datang lewat props dari halaman yang dimuat malas.
 *
 *   const progress = useCourseProgress(course.id);
 *   <CourseTop course={course} progress={progress} />
 *   <CourseBottom course={course} progress={progress} />
 */
import { useCallback, useState } from 'react';
import type { CourseProgress } from '../courses/progress';
import { isAvailableCourse, type CourseData } from '../courses/types';
import { scrollToSection } from '../lib/scroll';
import { CourseHero } from './CourseHero';
import { CourseParts } from './CourseParts';
import { FeatureGrid } from './FeatureGrid';
import { HowItWorks } from './HowItWorks';
import { PlanTopics } from './PlanTopics';
import { Syllabus } from './Syllabus';

export interface CourseTopProps {
  course: CourseData;
  /** Progres jalur di browser ini (useCourseProgress, hanya dibaca): centang misi & pill kemajuan di silabus. */
  progress: CourseProgress;
}

export function CourseTop({ course, progress }: CourseTopProps): JSX.Element {
  const [openTiers, setOpenTiers] = useState<string[]>([]);
  const firstTier = isAvailableCourse(course) ? course.syllabus.tiers[0]?.value : undefined;
  const target = course.hero.outline.target;

  const showOutline = useCallback(() => {
    if (firstTier !== undefined) setOpenTiers((open) => (open.includes(firstTier) ? open : [...open, firstTier]));
    scrollToSection(target);
  }, [firstTier, target]);

  return (
    <>
      <CourseHero course={course} onShowOutline={showOutline} />
      {isAvailableCourse(course) ? (
        <>
          <FeatureGrid course={course} />
          <Syllabus course={course} progress={progress} open={openTiers} onOpenChange={setOpenTiers} />
          <CourseParts course={course} />
        </>
      ) : (
        <>
          <PlanTopics course={course} />
          <HowItWorks course={course} />
        </>
      )}
    </>
  );
}
