/**
 * Semua data landing jalur. Satu objek per jalur di registri, urutan sama dengan registri (src/platform/tracks.ts).
 *
 *   import { getCourse } from '../courses';        // dari pages/** saja
 *   const course = getCourse('sql');               // CourseData | undefined
 *   if (course && isAvailableCourse(course)) …     // varian 'tersedia' (silabus, fitur, …) vs 'segera' (rencana, …)
 *
 * PERHATIAN: modul ini menjangkau courses/sql.ts yang mengimpor data misi & materi. Hanya boleh diimpor dari halaman
 * yang dimuat malas (pages/**). Untuk kartu jalur tanpa data misi pakai courses/catalog.ts.
 */
import { SQL_COURSE } from './sql';
import { SOON_COURSES } from './soon';
import type { CourseData } from './types';

export * from './types';
export { MISSION_KIND_LABEL, PLAYGROUND_EXAMPLE_COUNT, SQL_COURSE } from './sql';
export { SOON_COURSES } from './soon';

export const COURSES: readonly CourseData[] = [SQL_COURSE, ...SOON_COURSES];

export function getCourse(id: string): CourseData | undefined {
  return COURSES.find((course) => course.id === id);
}
