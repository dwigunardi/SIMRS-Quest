/**
 * Halaman landing satu jalur ('#/landing/<id>') — SATU template untuk semua jalur, dirender dari data
 * (courses/*.ts). Dimuat malas oleh pages/LandingPages.tsx sebagai chunk sendiri; LandingPages pula yang memutuskan 404
 * (id yang tidak ada di registri → NotFoundPage), jadi halaman ini tidak memuat chunk 404.
 *
 * Dua paruh:
 *   CourseTop    (course/CourseTop.tsx)        'tersedia': C1 hero → C2 fitur → C3 silabus → C4 isi jalur
 *                                              'segera'  : C1 hero → rencana materi → cara mengerjakannya
 *   CourseBottom (pages/course/CourseBottom.tsx) 'tersedia': C5 judul + C6 baris fitur → C7 alasan → C8 FAQ → C9 → C10
 *                                              'segera'  : sambil menunggu → C8 FAQ → C9 terkait → C10 CTA (ke SQL)
 *
 * Halaman ini hanya menyambungkan: meta & JSON-LD halaman, dan progres jalur di browser ini (HANYA DIBACA,
 * useCourseProgress) yang dipakai kedua paruh — centang silabus, status Boss, streak. Tidak ada teks jalur di sini.
 */
import { useMemo } from 'react';
import { getCourse } from '../courses';
import { useCourseProgress } from '../courses/progress';
import { courseJsonLd, pageBaseUrl } from '../courses/seo';
import type { CourseData } from '../courses/types';
import { CourseBottom } from '../course/CourseBottom';
import { CourseTop } from '../course/CourseTop';
import { usePageMeta } from '../hooks/usePageMeta';
import { PageLayout } from '../layout/PageLayout';

export interface CoursePageProps {
  /** Id jalur di registri (huruf kecil). */
  courseId: string;
}

export default function CoursePage({ courseId }: CoursePageProps): JSX.Element {
  const course = getCourse(courseId);
  // LandingPages sudah menyaring slug lewat registri (yang tidak dikenal → NotFoundPage), dan verify menjamin setiap
  // jalur registri punya data. Sampai di sini tanpa data = data rusak: biarkan batas galat per rute menampilkannya.
  if (!course) throw new Error(`Data landing jalur "${courseId}" tidak ada.`);
  return <CourseTemplate course={course} />;
}

function CourseTemplate({ course }: { course: CourseData }): JSX.Element {
  const jsonLd = useMemo(() => courseJsonLd(course, pageBaseUrl()), [course]);
  usePageMeta({ ...course.meta, jsonLd });
  const progress = useCourseProgress(course.id);

  return (
    <PageLayout current={{ page: 'course', id: course.id }}>
      <CourseTop course={course} progress={progress} />
      <CourseBottom course={course} progress={progress} />
    </PageLayout>
  );
}
