/**
 * Varian 'segera' — "Sambil menunggu, mulai dari SQL" (pengganti baris fitur C6): `course.waiting` (judul, kalimat,
 * alasan, tombol ke '#/sql') di satu sisi; di sisi lain cuplikan misi SQL SUNGGUHAN yang bisa dikerjakan hari ini
 * (PRACTICE.tabs.query — query diketik, lalu penilaiannya), dengan Kapi mengintip dari tepi jendela. Peragaan: tidak
 * ada SQL yang dijalankan di halaman ini. Section id: COURSE_SECTION_IDS.waiting.
 *
 * Latar halaman biasa (bukan mint): bagian sebelumnya, "Cara mengerjakannya" (course/HowItWorks.tsx), sudah bermint,
 * jadi warna latar tetap berselang-seling: rencana (putih) → cara (mint) → sambil menunggu (putih) → FAQ (putih, jarak
 * tunggal) → jalur terkait (mint) → CTA.
 */
import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Mascot } from '../../illustrations/Mascot';
import { OUTPUT_CAPTIONS, PRACTICE } from '../../lib/content';
import { crossfadeProps } from '../../lib/motion';
import { COURSE_SECTION_IDS } from '../../lib/pagesContent';
import { MockTable, RESULT_PANEL, Verdict, XpChip, toMockRows } from '../../sections/PracticeSection/mock';
import { Button3D } from '../../ui/Button3D';
import { CodeWindow } from '../../ui/CodeWindow';
import { Section } from '../../ui/Section';
import { FeatureRow, RowNote } from './rows/FeatureRow';
import type { SoonSectionProps } from './sectionProps';

const MISSION = PRACTICE.tabs.query;
/** Baris hasil yang ditampilkan (sisanya diringkas jumlah baris). */
const ROWS = 3;

function SqlGlimpse(): JSX.Element {
  const [typed, setTyped] = useState(false);
  return (
    <div className="mx-auto w-full max-w-[560px]">
      {/* Ruang kanan dipesan untuk Kapi yang mengintip dari tepi atas jendela. */}
      <p className="m-0 mb-3 flex min-w-0 flex-wrap items-center gap-2 pr-32 text-sm text-q-ink">
        <span className="rounded-q-pill bg-q-tint px-2.5 py-1 text-xs font-bold text-q-primary-ink">{MISSION.tierLabel}</span>
        <span className="font-bold">{MISSION.missionTitle}</span>
      </p>
      <div className="relative">
        <CodeWindow code={MISSION.code} fileName={MISSION.fileName} typing typingSpeed={22} onTyped={() => setTyped(true)}>
          <div className={RESULT_PANEL}>
            <AnimatePresence mode="wait" initial={false}>
              {typed ? (
                <motion.div key="hasil" {...crossfadeProps} className="flex flex-col gap-3">
                  <Verdict tone="correct" title={PRACTICE.verdict.correct} aside={<XpChip>{PRACTICE.verdict.xp(MISSION.xp)}</XpChip>}>
                    {PRACTICE.verdict.correctDetail}
                  </Verdict>
                  <MockTable
                    columns={MISSION.result.columns}
                    rows={toMockRows(MISSION.result.rows.slice(0, ROWS))}
                    caption={OUTPUT_CAPTIONS.yours}
                    count={PRACTICE.rowCount(MISSION.result.rows.length)}
                    animateRows
                  />
                </motion.div>
              ) : (
                <motion.div key="kosong" {...crossfadeProps} aria-hidden className="h-[188px] rounded-q border border-dashed border-slate-700" />
              )}
            </AnimatePresence>
          </div>
        </CodeWindow>
        {/* Sesudah jendela supaya tangan Kapi tergambar di atas tepinya. */}
        <Mascot pose="peek" expression="wink" className="absolute right-8 top-0 z-10 w-[92px] -translate-y-[88%]" />
      </div>
      <RowNote testId="waiting-note">{PRACTICE.sampleNote}</RowNote>
    </div>
  );
}

export function CourseWaiting({ course }: SoonSectionProps): JSX.Element {
  const headingId = useId();
  const { waiting } = course;
  return (
    <Section id={COURSE_SECTION_IDS.waiting} bleed labelledBy={headingId}>
      <FeatureRow
        name="waiting"
        heading="h2"
        headingId={headingId}
        title={waiting.title}
        lead={waiting.text}
        extra={
          <>
            <ul className="m-0 mt-1 flex list-none flex-col gap-3 p-0">
              {waiting.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-3 text-base leading-snug text-q-ink">
                  <span aria-hidden className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full bg-q-primary text-q-on-primary">
                    <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                  </span>
                  {reason}
                </li>
              ))}
            </ul>
            <div className="w-full pb-1 pt-3 sm:w-auto">
              <Button3D href={waiting.cta.href} size="lg" fullWidth className="sm:w-auto" data-testid="waiting-cta">
                {waiting.cta.label}
              </Button3D>
            </div>
          </>
        }
        visual={<SqlGlimpse />}
      />
    </Section>
  );
}
