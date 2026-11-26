/**
 * Bagian BAWAH landing jalur — pasangan CourseTop di folder ini. Isinya tinggal di pages/course/ (CourseBottom.tsx,
 * CourseRows.tsx + rows/*.tsx, CourseWaiting, CourseWhy, CourseFaq, CourseRelated, CourseCta); berkas ini hanya
 * mengekspornya ulang supaya kedua paruh halaman bisa diimpor dari satu folder (pages/CoursePage.tsx):
 *
 *   import { CourseTop } from '../course/CourseTop';
 *   import { CourseBottom } from '../course/CourseBottom';
 *
 *   <CourseTop course={course} progress={progress} />
 *   <CourseBottom course={course} progress={progress} />
 */
export { CourseBottom, type CourseBottomProps } from '../pages/course/CourseBottom';
