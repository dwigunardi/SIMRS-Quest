/**
 * Kerangka satu baris fitur (C6, dan baris "Sambil menunggu" jalur segera): teks di satu sisi, visual di sisi lain.
 * Layar lebar: dua kolom; `flip` menukar sisinya supaya baris-baris berselang-seling. Layar sempit: satu kolom, teks
 * SELALU lebih dulu. `band` = latar mint selebar layar (baris streak).
 *
 * Judul baris default h3 (di bawah h2 "Semua yang kamu butuhkan…"); baris yang berdiri sendiri sebagai section
 * memakai h2. Teks & visual muncul sekali saat masuk layar (Reveal: opacity + y).
 */
import { useId, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { Reveal } from '../../../ui/Reveal';
import { Container } from '../../../ui/Section';

export interface FeatureRowProps {
  title: string;
  lead?: string;
  /** Isi tambahan di bawah kalimat pembuka (daftar butir, tombol). */
  extra?: ReactNode;
  /** Visual di sisi lain (mockup, kartu). */
  visual: ReactNode;
  /** true = visual di kiri pada layar lebar. */
  flip?: boolean;
  /** Latar mint selebar layar. */
  band?: boolean;
  /**
   * Teks di atas (rata tengah, ±720 px), visual selebar kontainer di bawahnya — juga di layar lebar. Untuk visual yang
   * butuh lebar (mockup tiga kolom "Jalankan query"), yang terpotong bila dijejalkan ke kolom 7/12.
   */
  stacked?: boolean;
  /** Tingkat judul (bawaan h3). */
  heading?: 'h2' | 'h3';
  /** id judul (bila section induk ingin memakainya sebagai aria-labelledby). */
  headingId?: string;
  /** Penanda uji, mis. "run". */
  name?: string;
  className?: string;
}

export function FeatureRow({ title, lead, extra, visual, flip = false, band = false, stacked = false, heading = 'h3', headingId, name, className }: FeatureRowProps): JSX.Element {
  const ownId = useId();
  const titleId = headingId ?? ownId;
  const Heading = heading;
  let columns = flip ? 'lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]' : 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]';
  if (stacked) columns = 'lg:gap-12';
  return (
    <div data-row={name} className={cn(band ? 'bg-q-tint py-20 lg:py-24' : '', className)}>
      <Container>
        <article aria-labelledby={titleId} className={cn('grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:gap-16', columns)}>
          <Reveal className={cn('flex flex-col gap-5', stacked ? 'items-start sm:mx-auto sm:max-w-[720px] sm:items-center sm:text-center' : 'items-start', flip && !stacked ? 'lg:order-2' : '')}>
            <Heading id={titleId} className="m-0 text-balance font-q-body text-[28px] font-bold leading-tight text-q-ink sm:text-[34px]">
              {title}
            </Heading>
            {lead !== undefined ? <p className="m-0 max-w-[52ch] text-pretty text-base leading-relaxed text-q-ink-soft sm:text-lg">{lead}</p> : null}
            {extra}
          </Reveal>
          <Reveal delay={0.1} className={cn('min-w-0', flip && !stacked ? 'lg:order-1' : '')}>
            {visual}
          </Reveal>
        </article>
      </Container>
    </div>
  );
}

/** Keterangan kecil berikon "i" di bawah mockup (contoh tampilan, sumber angka). */
export function RowNote({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }): JSX.Element {
  return (
    <p data-testid={testId} className={cn('m-0 mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-q-ink-soft', className)}>
      <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
