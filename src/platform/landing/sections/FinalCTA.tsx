/**
 * Bagian 13 — CTA penutup: judul besar font display, satu tombol, lalu "laut" teal tempat Kapi mengapung di antara
 * benda-benda yang memang ada di aplikasi (api streak, piala Boss, lencana, centang, tabel data).
 */
import type { TrackGlance } from '../../tracks';
import { FloatingBits, type FloatingBitItem } from '../illustrations/FloatingBits';
import { Mascot } from '../illustrations/Mascot';
import { Wave } from '../illustrations/Wave';
import { CTA, EXPLORE, SECTION_IDS } from '../lib/content';
import { Button3D } from '../ui/Button3D';
import { Reveal } from '../ui/Reveal';
import { Section } from '../ui/Section';

export interface FinalCTAProps {
  /** Pengguna sudah pernah mengerjakan jalur? null = belum diketahui (diperlakukan seperti pengguna baru). */
  started: boolean | null;
  /** Tombol ditekan. */
  onStart: () => void;
  /** Ringkasan jalur (opsional): bila semua misi tuntas, tombolnya tidak lagi berbunyi "Lanjutkan". */
  glance?: TrackGlance | null;
}

const TITLE_ID = 'cta-title';

/** Benda melayang di sekitar Kapi; yang paling pinggir disembunyikan di layar sempit. */
const BITS: readonly FloatingBitItem[] = [
  { kind: 'flame', className: 'left-[4%] top-[8%] sm:left-[12%]', size: 54, tilt: -10, delay: 0 },
  { kind: 'trophy', className: 'right-[4%] top-[2%] sm:right-[13%]', size: 60, tilt: 9, delay: 0.5 },
  { kind: 'table', className: 'left-[26%] top-[40%] hidden sm:block', size: 46, tilt: 8, delay: 0.9 },
  { kind: 'check', className: 'right-[27%] top-[44%] hidden sm:block', size: 44, tilt: -8, delay: 1.3 },
  { kind: 'badge', className: 'left-[2%] top-[52%] hidden lg:block', size: 48, tilt: 12, delay: 1.7 },
  { kind: 'badge', className: 'right-[3%] top-[56%] hidden lg:block', size: 40, tilt: -12, delay: 0.3 },
];

export function FinalCTA({ started, onStart, glance }: FinalCTAProps): JSX.Element {
  const allDone = started === true && glance != null && glance.resume === null;
  const resuming = started === true && !allDone;
  let title: string = CTA.title;
  let button: string = CTA.button.start;
  if (allDone) {
    title = CTA.allDone.title;
    button = EXPLORE.cta;
  } else if (resuming) {
    title = CTA.titleReturning;
    button = CTA.button.resume;
  }
  return (
    <Section id={SECTION_IDS.cta} spacing="none" bleed gap labelledBy={TITLE_ID} className="pt-q-section lg:pt-q-section-lg">
      <Reveal className="relative z-10 mx-auto flex w-full max-w-q-content flex-col items-center gap-5 px-q-gutter text-center">
        <h2 id={TITLE_ID} className="m-0 max-w-[18ch] text-balance font-q-display text-[34px] font-extrabold leading-[1.12] text-q-ink sm:text-q-h2 lg:text-q-hero-lg">
          {title}
        </h2>
        <p className="m-0 text-lg text-q-ink-soft">{allDone ? CTA.allDone.lead : CTA.lead}</p>
        <div className="mt-3 w-full max-w-[320px] pb-1">
          <Button3D size="lg" fullWidth onClick={onStart} data-testid="cta-primary">
            {button}
          </Button3D>
        </div>
      </Reveal>

      {/* Laut: gelombang depan menutupi kaki Kapi, jadi ia tampak mengapung. */}
      <div className="relative mt-10 h-[230px] sm:h-[250px]">
        <FloatingBits items={BITS} />
        <Mascot pose="cheer" expression="smile" className="absolute bottom-[14px] left-1/2 w-[132px] -translate-x-1/2 sm:w-[150px]" />
        <Wave animated className="absolute inset-x-0 bottom-0 h-[84px] sm:h-[100px]" />
      </div>
      <div aria-hidden className="h-8 bg-q-brand" />
    </Section>
  );
}
