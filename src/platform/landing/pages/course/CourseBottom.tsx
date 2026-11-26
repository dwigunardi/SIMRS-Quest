/**
 * Bagian BAWAH landing jalur dalam satu komponen. Pasangannya CourseTop (src/platform/landing/course/CourseTop.tsx,
 * bagian atas: C1–C4 / rencana materi + cara mengerjakannya):
 *
 *   const progress = useCourseProgress(course.id);
 *   <CourseTop course={course} progress={progress} />
 *   <CourseBottom course={course} progress={progress} />
 *
 * 'tersedia': C5 judul + C6 baris fitur a–f (CourseRows, id 'yang-kamu-dapat') → C7 alasan (CourseWhy) → C8 FAQ →
 *             C9 jalur terkait → C10 CTA.
 * 'segera'  : "Sambil menunggu, mulai dari SQL" (CourseWaiting, satu baris pengganti C6) → C8 FAQ → C9 jalur terkait
 *             → C10 CTA (ke jalur SQL). Tanpa C7: data jalur 'segera' sengaja tidak punya alasan (jalurnya belum ada);
 *             perannya diambil butir alasan di "Sambil menunggu".
 *
 * `progress` = useCourseProgress(course.id) (hanya baca; kosong untuk jalur 'segera').
 */
import type { CourseProgress } from '../../courses/progress';
import { isAvailableCourse, type CourseData } from '../../courses/types';
import { CourseCta } from './CourseCta';
import { CourseFaq } from './CourseFaq';
import { CourseRelated } from './CourseRelated';
import { CourseRows } from './CourseRows';
import { CourseWaiting } from './CourseWaiting';
import { CourseWhy } from './CourseWhy';

export interface CourseBottomProps {
  course: CourseData;
  progress: CourseProgress;
}

export function CourseBottom({ course, progress }: CourseBottomProps): JSX.Element {
  return (
    <>
      {isAvailableCourse(course) ? (
        <>
          <CourseRows course={course} progress={progress} />
          <CourseWhy course={course} />
        </>
      ) : (
        <CourseWaiting course={course} />
      )}
      <CourseFaq course={course} />
      <CourseRelated course={course} />
      <CourseCta course={course} />
    </>
  );
}
