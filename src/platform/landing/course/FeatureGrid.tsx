/**
 * C2 — Grid fitur jalur: tepat enam fitur nyata dari `course.features` (ikon, judul, teks), 3 × 2 di layar lebar,
 * 2 kolom di tablet, 1 kolom di ponsel. Muncul bergiliran saat masuk layar (<Reveal group>).
 *
 * Sengaja TANPA kartu berbingkai: tiap fitur dibuka garis tipis di atasnya, supaya bagian ini terasa sebagai daftar
 * ringkas dan tidak bersaing dengan kartu tier silabus (C3) dan kartu "Isi jalur" (C4) yang bisa diklik. Supaya tidak
 * terbaca sebagai teks saja, setiap fitur membawa satu potongan antarmuka aplikasi yang benar-benar ada (`token`: kata
 * kunci SELECT, pill "−20% XP", tab "Perbedaan", kotak "Beda dialek", jadwal latihan ulang, jumlah pangkat) — hiasan
 * (aria-hidden), isinya sudah disebut di judul/teks fiturnya. Hanya jalur 'tersedia'.
 */
import type { AvailableCourse, FeatureToken } from '../courses/types';
import { COURSE_SECTION_IDS } from '../lib/pagesContent';
import { Icon } from '../ui/Icon';
import { Pill, type PillTone } from '../ui/Pill';
import { Reveal, RevealItem } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

export interface FeatureGridProps {
  course: AvailableCourse;
}

const TITLE_ID = 'course-features-title';

const TOKEN_TONE: Record<Exclude<FeatureToken['tone'], 'code'>, PillTone> = { amber: 'amber', primary: 'primary', neutral: 'neutral' };

function TokenView({ token }: { token: FeatureToken }): JSX.Element {
  if (token.tone === 'code') {
    // Kata kunci SQL seperti di editor aplikasi (jendela kode selalu gelap di kedua tema).
    return (
      <span aria-hidden className="q-on-dark inline-flex h-7 items-center rounded-md border border-q-code-border bg-q-code-bg px-2.5 font-mono text-[13px] font-bold tracking-wide text-q-code-ink">
        {token.text}
      </span>
    );
  }
  return (
    <span aria-hidden>
      <Pill size="sm" tone={TOKEN_TONE[token.tone]} className="font-bold tabular-nums">
        {token.text}
      </Pill>
    </span>
  );
}

export function FeatureGrid({ course }: FeatureGridProps): JSX.Element {
  const { features } = course;
  return (
    <Section id={COURSE_SECTION_IDS.features} labelledBy={TITLE_ID}>
      <Reveal>
        <SectionHeading id={TITLE_ID} title={features.title} lead={features.lead} />
      </Reveal>
      <Reveal as="ul" group className="m-0 mt-12 grid list-none gap-x-10 gap-y-10 p-0 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-y-14">
        {features.items.map((item) => (
          <RevealItem as="li" key={item.title} className="flex flex-col gap-3 border-t border-q-border pt-6">
            <span className="flex flex-wrap items-center justify-between gap-3">
              <span aria-hidden className="grid h-12 w-12 place-items-center rounded-q bg-q-tint text-q-primary-ink">
                <Icon name={item.icon} className="h-6 w-6" />
              </span>
              <TokenView token={item.token} />
            </span>
            <h3 className="m-0 mt-1 text-balance text-lg font-bold leading-snug text-q-ink">{item.title}</h3>
            <p className="m-0 text-pretty text-[15px] leading-relaxed text-q-ink-soft">{item.text}</p>
          </RevealItem>
        ))}
      </Reveal>
    </Section>
  );
}
