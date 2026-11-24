/**
 * Bagian 10 — "Macet? Kapi menunjukkan di mana harus mencari.": empat bantuan yang memang ada di aplikasi, di samping
 * mockup hasil penilaian sebuah percobaan yang keliru (misi sungguhan, lihat STUCK.example di lib/content.ts).
 * Baris yang berlebih bergetar kecil, tab Perbedaan disorot, Hint bisa dibuka, dan contoh bisa dialihkan ke keadaan
 * "Benar". Mockup ini tidak menjalankan SQL.
 */
import { useId, useMemo, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { Diff } from 'lucide-react';
import { Mascot } from '../illustrations/Mascot';
import { cn } from '../lib/cn';
import { OUTPUT_CAPTIONS, OUTPUT_TABS, PRACTICE, ROUTES, SECTION_IDS, STUCK } from '../lib/content';
import { Button3D } from '../ui/Button3D';
import { CodeWindow } from '../ui/CodeWindow';
import { Icon } from '../ui/Icon';
import { Reveal, RevealItem } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';
import { DiffChips, HintButton, HintCard, MockTable, OutputTabs, RESULT_PANEL, Verdict, type MockRow, type OutputTab } from './PracticeSection/mock';

const HEADING_ID = 'bantuan-judul';

const TEXT = STUCK.ui;

type CompareView = 'diff' | 'yours' | 'expected';

const COMPARE_TABS: readonly OutputTab<CompareView>[] = [
  { id: 'diff', label: OUTPUT_TABS.diff, icon: <Diff aria-hidden className="h-3.5 w-3.5 shrink-0" /> },
  { id: 'yours', label: OUTPUT_TABS.yours },
  { id: 'expected', label: OUTPUT_TABS.expected },
];

const EXAMPLE = STUCK.example;
const STATUS_LABELS = { same: EXAMPLE.diff.sameLabel, extra: EXAMPLE.diff.extraLabel, missing: TEXT.missingLabel } as const;

/** Query setelah diperbaiki: baris yang keliru diganti baris perbaikannya. */
const FIXED_CODE = EXAMPLE.wrongCode
  .split('\n')
  .map((line, index) => (index + 1 === EXAMPLE.wrongLine ? EXAMPLE.fixedLine : line))
  .join('\n');

function HintMockup({ fixed, onFixedChange }: { fixed: boolean; onFixedChange: (fixed: boolean) => void }): JSX.Element {
  const [hintOpen, setHintOpen] = useState(false);
  const [view, setView] = useState<CompareView>('diff');
  /** Bertambah tiap kali contoh kembali ke keadaan salah → baris berlebih bergetar lagi. */
  const [attempt, setAttempt] = useState(1);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-120px' });
  const hintId = useId();

  const diffRows = useMemo<MockRow[]>(() => EXAMPLE.diff.rows.map((row) => ({ key: row.cells.join('|'), cells: row.cells, status: row.status })), []);
  const yourRows = useMemo<MockRow[]>(() => diffRows.map(({ key, cells }) => ({ key, cells })), [diffRows]);
  const expectedRows = useMemo<MockRow[]>(() => diffRows.filter((row) => row.status === 'same').map(({ key, cells }) => ({ key, cells })), [diffRows]);

  const setState = (next: boolean) => {
    if (next === fixed) return;
    onFixedChange(next);
    setView('diff');
    if (!next) setAttempt((value) => value + 1);
  };

  return (
    <div ref={ref}>
      <CodeWindow
        code={fixed ? FIXED_CODE : EXAMPLE.wrongCode}
        fileName={EXAMPLE.fileName}
        lineMarks={{ [EXAMPLE.wrongLine]: fixed ? 'success' : 'error' }}
        footer={
          <>
            <HintButton open={hintOpen} onToggle={() => setHintOpen((value) => !value)} controls={hintId} />
            <div role="group" aria-label={TEXT.stateLabel} className="ml-auto flex gap-1 rounded-q border border-q-code-border bg-q-code-deep/60 p-1 font-sans">
              {[
                { fixed: false, label: EXAMPLE.wrongLabel, active: 'bg-rose-500/20 text-rose-200' },
                { fixed: true, label: EXAMPLE.correctLabel, active: 'bg-emerald-500/20 text-emerald-200' },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={fixed === option.fixed}
                  onClick={() => setState(option.fixed)}
                  className={cn(
                    'h-7 rounded-lg px-2.5 text-xs font-semibold transition-colors duration-150',
                    fixed === option.fixed ? option.active : 'text-q-code-muted hover:text-q-code-ink',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        }
      >
        <div className={RESULT_PANEL}>
          <div id={hintId} className="empty:hidden">
            {hintOpen ? (
              <HintCard label={EXAMPLE.hintLabel}>
                <p>{EXAMPLE.hint}</p>
              </HintCard>
            ) : null}
          </div>

          {fixed ? (
            <>
              <div role="status">
                <Verdict tone="correct" title={EXAMPLE.correctMessage}>
                  {EXAMPLE.correctDetail}
                </Verdict>
              </div>
              <MockTable columns={EXAMPLE.diff.columns} rows={expectedRows} caption={OUTPUT_CAPTIONS.yours} count={PRACTICE.rowCount(expectedRows.length)} />
            </>
          ) : (
            <>
              <div role="status">
                <Verdict tone="wrong" title={EXAMPLE.wrongLabel}>
                  {EXAMPLE.wrongMessage}
                </Verdict>
              </div>
              <OutputTabs tabs={COMPARE_TABS} value={view} onChange={setView} ariaLabel={TEXT.compareLabel} spotlight="diff" />
              {view === 'diff' ? (
                <>
                  <DiffChips ariaLabel={TEXT.diffSummaryLabel} items={EXAMPLE.summary.map((text, index) => ({ text, flagged: index > 0 }))} />
                  <MockTable columns={EXAMPLE.diff.columns} rows={diffRows} statusLabels={STATUS_LABELS} shakeKey={inView ? attempt : undefined} />
                </>
              ) : null}
              {view === 'yours' ? <MockTable columns={EXAMPLE.diff.columns} rows={yourRows} caption={OUTPUT_CAPTIONS.yours} count={PRACTICE.rowCount(yourRows.length)} /> : null}
              {view === 'expected' ? (
                <MockTable columns={EXAMPLE.diff.columns} rows={expectedRows} caption={OUTPUT_CAPTIONS.expected} count={PRACTICE.rowCount(expectedRows.length)} />
              ) : null}
              {/* Keterangan landing (bukan tiruan layar): garis putus-putus membedakannya dari isi mockup. */}
              <p className="flex items-start gap-2.5 rounded-q border border-dashed border-slate-700 px-3 py-2.5 text-xs leading-relaxed text-slate-300">
                <Icon name="radar" className="mt-px h-4 w-4 text-teal-300" />
                <span>
                  {EXAMPLE.mistakeNote} <span className="font-semibold text-slate-100">“{EXAMPLE.mistakeKind}”</span>.
                </span>
              </p>
            </>
          )}
        </div>
      </CodeWindow>
    </div>
  );
}

export function MascotHint(): JSX.Element {
  const [fixed, setFixed] = useState(false);
  return (
    <Section id={SECTION_IDS.stuck} labelledBy={HEADING_ID}>
      <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        <div>
          <Reveal>
            <SectionHeading id={HEADING_ID} title={STUCK.title} lead={STUCK.lead} className="lg:items-start lg:text-left" />
          </Reveal>
          <Reveal group as="ul" className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-1 lg:gap-y-5">
            {STUCK.points.map((point) => (
              <RevealItem key={point.title} as="li" className="flex gap-3.5">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-q bg-q-tint text-q-primary-ink">
                  <Icon name={point.icon} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold leading-snug text-q-ink">{point.title}</h3>
                  <p className="mt-0.5 text-pretty text-[15px] leading-relaxed text-q-ink-soft">{point.text}</p>
                </div>
              </RevealItem>
            ))}
          </Reveal>
          <div className="mt-9 flex justify-center pb-1 lg:justify-start">
            <Button3D href={ROUTES.sql} size="lg">
              {STUCK.cta.label}
            </Button3D>
          </div>
        </div>

        <Reveal className="relative min-w-0 lg:pl-[88px]">
          {/* Layar sempit: Kapi mengintip dari tepi atas jendela. Layar lebar: berdiri di samping, menunjuk ke hasil. */}
          <Mascot pose="peek" expression={fixed ? 'smile' : 'think'} className="absolute right-8 top-0 z-10 w-[84px] -translate-y-[88%] lg:hidden" />
          <Mascot
            pose={fixed ? 'cheer' : 'point'}
            expression={fixed ? 'smile' : 'think'}
            className="absolute bottom-[106px] left-0 z-10 hidden w-[112px] lg:block"
          />
          <HintMockup fixed={fixed} onFixedChange={setFixed} />
          <p className="mt-4 text-center text-sm text-q-ink-soft">{TEXT.sampleNote}</p>
        </Reveal>
      </div>
    </Section>
  );
}
