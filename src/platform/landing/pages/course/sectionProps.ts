/**
 * Props bagian-bagian BAWAH halaman landing jalur (CourseBottom.tsx). Setiap bagian = satu berkas di folder ini dan
 * HANYA merender dari `course` (data) + label bersama COURSE_UI (lib/pagesContent.ts) — tidak menulis teks jalur.
 * Bagian atas (hero, fitur, silabus, isi jalur, rencana, cara mengerjakan) ada di src/platform/landing/course/.
 */
import type { AvailableCourse, CourseData, SoonCourse } from '../../courses/types';
import type { CourseProgress } from '../../courses/progress';

export interface CourseSectionProps<C extends CourseData = CourseData> {
  course: C;
}

export type AvailableSectionProps = CourseSectionProps<AvailableCourse>;
export type SoonSectionProps = CourseSectionProps<SoonCourse>;

/** C6. Progres untuk kalender streak, kartu "Rekor terbaik / Hari ini", dan status Boss. */
export interface CourseRowsProps extends AvailableSectionProps {
  progress: CourseProgress;
}
