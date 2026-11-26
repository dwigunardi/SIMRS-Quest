/**
 * C10 — CTA penutup: `course.cta.title` ("Belajar {title} bersama Kapi") dengan huruf display besar, kalimat pendamping
 * sesuai status (`lead` / `leadResume` / `leadDone`), satu
 * Button3D ke `course.cta.href`, lalu "laut" teal tempat Kapi mengapung di antara benda yang memang ada di aplikasi —
 * komposisi yang sama dengan CTA penutup Beranda, jadi halaman jalur terasa satu keluarga. Teks tombol mengikuti status
 * pengguna (ctaLabelFor: Mulai belajar / Lanjutkan / Buka jalur SQL). Jalur 'segera' menaut ke jalur SQL.
 * Section id: COURSE_SECTION_IDS.cta. Kedua varian.
 */
import { useId } from 'react';
import { FloatingBits, type FloatingBitItem } from '../../illustrations/FloatingBits';
import { Mascot } from '../../illustrations/Mascot';
import { Wave } from '../../illustrations/Wave';
import { ctaLabelFor, usePageStatus } from '../../layout/pageStatus';
import { COURSE_SECTION_IDS } from '../../lib/pagesContent';
import { Button3D } from '../../ui/Button3D';
import { Reveal } from '../../ui/Reveal';
import { Section } from '../../ui/Section';
import type { CourseSectionProps } from './sectionProps';
import { keepDots } from './text';

/** Benda melayang di sekitar Kapi; yang paling pinggir disembunyikan di layar sempit. */
const BITS: readonly FloatingBitItem[] = [
  { kind: 'table', className: 'left-[4%] top-[10%] sm:left-[12%]', size: 54, tilt: -8, delay: 0.2 },
  { kind: 'trophy', className: 'right-[4%] top-[4%] sm:right-[13%]', size: 58, tilt: 9, delay: 0.7 },
  { kind: 'check', className: 'left-[27%] top-[42%] hidden sm:block', size: 44, tilt: 8, delay: 1.1 },
  { kind: 'flame', className: 'right-[26%] top-[46%] hidden sm:block', size: 46, tilt: -10, delay: 1.5 },
  { kind: 'badge', className: 'left-[3%] top-[54%] hidden lg:block', size: 46, tilt: 12, delay: 0.4 },
  { kind: 'badge', className: 'right-[3%] top-[58%] hidden lg:block', size: 40, tilt: -12, delay: 1.9 },
];

export function CourseCta({ course }: CourseSectionProps): JSX.Element {
  const titleId = useId();
  const status = usePageStatus();
  const { cta } = course;
  const available = course.status === 'tersedia';
  // Kalimat pendamping mengikuti tombolnya (ctaLabelFor): belum mulai / masih ada misi / semua misi tuntas.
  let lead = cta.lead;
  if (status.mode === 'resume') lead = cta.leadResume;
  else if (status.mode === 'open' && status.started) lead = cta.leadDone;
  return (
    <Section id={COURSE_SECTION_IDS.cta} spacing="none" bleed gap labelledBy={titleId} className="pt-q-section lg:pt-q-section-lg">
      <Reveal className="relative z-10 mx-auto flex w-full max-w-q-content flex-col items-center gap-5 px-q-gutter text-center">
        <h2 id={titleId} className="m-0 max-w-[18ch] text-balance font-q-display text-[34px] font-extrabold leading-[1.12] text-q-ink sm:text-q-h2 lg:text-q-hero-lg">
          {keepDots(cta.title)}
        </h2>
        <p className="m-0 max-w-[60ch] text-pretty text-lg text-q-ink-soft" data-testid="course-cta-lead">{lead}</p>
        <div className="mt-3 w-full max-w-[320px] pb-1">
          <Button3D href={cta.href} size="lg" fullWidth data-testid="course-cta">
            {ctaLabelFor(cta, status)}
          </Button3D>
        </div>
      </Reveal>

      {/* Laut: gelombang depan menutupi kaki Kapi, jadi ia tampak mengapung. */}
      <div className="relative mt-10 h-[230px] sm:h-[250px]">
        <FloatingBits items={BITS} />
        <Mascot
          pose={available ? 'cheer' : 'wave'}
          expression={available ? 'smile' : 'wink'}
          className="absolute bottom-[14px] left-1/2 w-[132px] -translate-x-1/2 sm:w-[150px]"
        />
        <Wave animated className="absolute inset-x-0 bottom-0 h-[84px] sm:h-[100px]" />
      </div>
      <div aria-hidden className="h-8 bg-q-brand" />
    </Section>
  );
}
