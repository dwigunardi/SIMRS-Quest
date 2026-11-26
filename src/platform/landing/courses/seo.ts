/**
 * JSON-LD (schema.org) halaman katalog & landing jalur — SATU objek `@graph` per halaman, dipasang usePageMeta di
 * satu <script type="application/ld+json">. Fungsi murni (tanpa React, tanpa DOM); `baseUrl` = alamat aplikasi tanpa
 * hash (pageBaseUrl() di browser), sehingga tautannya selalu menunjuk ke tempat aplikasi ini sedang dibuka.
 *
 * Isinya hanya fakta yang ada di data halaman: nama, deskripsi, gratis, bahasa, penyedia, breadcrumb, dan FAQ yang
 * memang tampil di halaman. Tanpa nilai ulasan, jumlah peserta, atau durasi — semuanya tidak ada di aplikasi.
 */
import { PRODUCT_NAME } from '../../brand';
import { CATALOG_ROUTE, HOME_ROUTE, courseHref, formatRoute } from '../../router';
import { GITHUB_URL, type FaqItem } from '../lib/content';
import { CATALOG, CATALOG_META, COURSE_UI } from '../lib/pagesContent';
import type { CourseSummary } from './catalog';
import type { CourseData } from './types';

export type JsonLd = Record<string, unknown>;

/** Alamat aplikasi tanpa hash, mis. "https://contoh.id/" (di luar browser: string kosong). */
export function pageBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

const PROVIDER: JsonLd = { '@type': 'Organization', name: PRODUCT_NAME, url: GITHUB_URL };

function faqPage(items: readonly FaqItem[]): JsonLd {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer.join(' ') },
    })),
  };
}

function breadcrumb(baseUrl: string, items: ReadonlyArray<{ name: string; hash: string }>): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: `${baseUrl}${item.hash}` })),
  };
}

/**
 * Landing satu jalur: BreadcrumbList + FAQPage, ditambah node Course (gratis, penyedia, isi tier) HANYA untuk jalur
 * 'tersedia'. Jalur 'segera' belum ada sebagai kursus — menandainya Course dengan harga 0 berarti mengklaim kursus yang
 * belum dibuka.
 */
export function courseJsonLd(course: CourseData, baseUrl: string): JsonLd {
  const url = `${baseUrl}${courseHref(course.id)}`;
  const trail = breadcrumb(baseUrl, [
    { name: COURSE_UI.breadcrumb.home, hash: formatRoute(HOME_ROUTE) },
    { name: COURSE_UI.breadcrumb.catalog, hash: formatRoute(CATALOG_ROUTE) },
    { name: course.title, hash: courseHref(course.id) },
  ]);
  const faq = faqPage(course.faq.items);
  if (course.status !== 'tersedia') return { '@context': 'https://schema.org', '@graph': [trail, faq] };
  const courseNode: JsonLd = {
    '@type': 'Course',
    name: COURSE_UI.h1(course.title),
    description: course.meta.description,
    url,
    inLanguage: 'id',
    isAccessibleForFree: true,
    provider: PROVIDER,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR', category: 'Free' },
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'Online' },
    teaches: course.syllabus.tiers.map((tier) => tier.title),
  };
  return { '@context': 'https://schema.org', '@graph': [courseNode, trail, faq] };
}

/** ItemList (semua jalur) + BreadcrumbList + FAQPage untuk katalog. */
export function catalogJsonLd(courses: readonly CourseSummary[], baseUrl: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        name: CATALOG_META.ogTitle,
        itemListElement: courses.map((course, index) => ({ '@type': 'ListItem', position: index + 1, name: course.title, url: `${baseUrl}${course.href}` })),
      },
      breadcrumb(baseUrl, [
        { name: COURSE_UI.breadcrumb.home, hash: formatRoute(HOME_ROUTE) },
        { name: COURSE_UI.breadcrumb.catalog, hash: formatRoute(CATALOG_ROUTE) },
      ]),
      faqPage(CATALOG.faq.items),
    ],
  };
}
