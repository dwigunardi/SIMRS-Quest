/**
 * Halaman 404 jalur ('#/landing/<slug tidak dikenal>'): tetap dengan navbar & footer, satu h1, Kapi yang sedang
 * berpikir di depan angka 404 besar, alamat yang dicari ditampilkan kembali (sudah dipotong oleh pages/LandingPages.tsx,
 * di-escape React, dan boleh patah di mana saja supaya slug panjang tanpa spasi tidak melebarkan halaman), lalu tiga
 * jalan keluar: katalog, Beranda, dan langsung ke jalur SQL — ditambah kartu semua jalur. Tidak untuk diindeks (meta
 * robots noindex). Dimuat malas oleh shell sebagai chunk sendiri.
 */
import { ArrowRight } from 'lucide-react';
import { COURSES_BY_STEP } from '../courses/catalog';
import { usePageMeta } from '../hooks/usePageMeta';
import { Mascot } from '../illustrations/Mascot';
import { PageLayout } from '../layout/PageLayout';
import { NOT_FOUND, NOT_FOUND_META } from '../lib/pagesContent';
import { Button3D } from '../ui/Button3D';
import { CourseCard } from '../ui/CourseCard';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

export interface NotFoundPageProps {
  /** Slug yang diminta (sudah dipotong bila terlalu panjang). */
  slug: string;
}

const TITLE_ID = 'not-found-title';
const SUGGESTIONS_ID = 'not-found-suggestions';

export default function NotFoundPage({ slug }: NotFoundPageProps): JSX.Element {
  usePageMeta(NOT_FOUND_META);
  return (
    <PageLayout current={{ page: 'not-found' }} faqLink={false}>
      <Section spacing="none" labelledBy={TITLE_ID} className="q-page-hero pb-12 pt-8 sm:pb-16 sm:pt-10 lg:pb-16 lg:pt-12">
        <div className="mx-auto flex max-w-[640px] flex-col items-center gap-5 text-center">
          {/* Ilustrasi: angka 404 besar dengan Kapi berpikir di depannya (satu gambar bernama). */}
          <div role="img" aria-label={NOT_FOUND.mascotLabel} className="relative grid h-[150px] w-full place-items-center sm:h-[180px]">
            <span aria-hidden className="select-none font-q-display text-[112px] font-extrabold leading-none tracking-[0.04em] text-q-primary/15 sm:text-[150px]">
              404
            </span>
            <Mascot expression="think" className="absolute bottom-0 left-1/2 w-24 -translate-x-1/2 sm:w-28" />
          </div>
          <h1 id={TITLE_ID} className="m-0 text-balance font-q-display text-[34px] font-extrabold leading-[1.12] text-q-ink sm:text-q-h2">
            {NOT_FOUND.title}
          </h1>
          <p className="m-0 max-w-[52ch] text-pretty text-lg leading-relaxed text-q-ink-soft [overflow-wrap:anywhere]" data-testid="not-found-text">
            {slug.trim() === '' ? NOT_FOUND.textGeneric : NOT_FOUND.text(slug)}
          </p>
          <div className="mt-1 flex w-full flex-col items-stretch justify-center gap-3 pb-1 sm:w-auto sm:flex-row">
            <Button3D href={NOT_FOUND.catalog.href} size="lg" data-testid="not-found-catalog">
              {NOT_FOUND.catalog.label}
            </Button3D>
            <Button3D href={NOT_FOUND.home.href} size="lg" variant="outline" data-testid="not-found-home">
              {NOT_FOUND.home.label}
            </Button3D>
          </div>
          <a
            href={NOT_FOUND.sql.href}
            className="group inline-flex items-center gap-1.5 rounded-q py-1 font-bold text-q-primary-ink underline decoration-q-primary/40 decoration-2 underline-offset-4 transition-colors duration-150 hover:decoration-q-primary"
            data-testid="not-found-sql"
          >
            {NOT_FOUND.sql.label}
            <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </a>
        </div>
      </Section>
      <Section spacing="tight" labelledBy={SUGGESTIONS_ID}>
        <SectionHeading id={SUGGESTIONS_ID} title={NOT_FOUND.suggestionsTitle} size="sm" />
        <ul className="m-0 mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {COURSES_BY_STEP.map((course) => (
            <li key={course.id}>
              <CourseCard course={course} />
            </li>
          ))}
        </ul>
      </Section>
    </PageLayout>
  );
}
