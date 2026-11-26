/**
 * C6a — "Jalankan query SQL sungguhan": tab jenis latihan (pill) + jendela kode gelap yang mengetik query misi
 * sungguhan, lalu panel bawah bertab HASIL / KONSOL dengan tiga kolom mini (input · hasil kamu · seharusnya).
 *
 * Ini PERAGAAN: tidak ada SQL yang dijalankan di halaman ini (halaman landing tidak memuat mesin SQL). Isi tiap contoh
 * berasal dari rows/runExamples.ts (data terverifikasi), dan keterangan wajib `run.note` selalu tampil di bawahnya.
 * Urutan tampilan: kode diketik → "menjalankan" → baris hasil muncul → penilaian. Dengan gerak dikurangi semuanya
 * langsung tampil utuh.
 *
 * Setiap tab dinilai seperti di aplikasinya: Tebak Hasil TIDAK menjalankan query (tanpa "Menjalankan query…", konsolnya
 * mengatakan itu, kolomnya "Pilihanmu / Jawaban yang benar"); di Lab Injection kebocoran di mode rentan adalah tujuan misi
 * ("Serangan berhasil!", kolom "Mode rentan / Mode aman"), bukan jawaban salah. Barisnya bertumpuk (teks di atas,
 * mockup selebar kontainer) supaya tiga tabel mini tidak terpotong di layar lebar.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, RotateCcw, Table2, Wrench, X } from 'lucide-react';
import type { AvailableCourse } from '../../../courses/types';
import { cn } from '../../../lib/cn';
import { OUTPUT_CAPTIONS, PRACTICE, STUCK, type PracticeTabId } from '../../../lib/content';
import { crossfadeProps } from '../../../lib/motion';
import { MockButton, RESULT_PANEL, RunningNote, Verdict, XpChip } from '../../../sections/PracticeSection/mock';
import { useRunSequence } from '../../../sections/PracticeSection/useRunSequence';
import { Button3D } from '../../../ui/Button3D';
import { CodeWindow } from '../../../ui/CodeWindow';
import { Icon } from '../../../ui/Icon';
import { Tabs, type TabItem } from '../../../ui/Tabs';
import { FeatureRow, RowNote } from './FeatureRow';
import { RUN_EXAMPLES, RUN_MIN_LINES, type RunExample, type RunInput, type RunTable } from './runExamples';

type Run = AvailableCourse['rows']['run'];

/** Baris yang ditampilkan per tabel mini (sisanya diringkas "n baris"). */
const MINI_ROWS = 3;

/* ------------------------------------------------------------------ */
/* Tabel mini (di atas latar gelap tetap)                              */
/* ------------------------------------------------------------------ */

function MiniHeading({ children }: { children: ReactNode }): JSX.Element {
  return <p className="m-0 font-q-body text-[11px] font-bold uppercase tracking-[0.14em] text-q-code-muted">{children}</p>;
}

function MiniTable({ table, rows, caption, animate }: { table: RunTable['table']; rows: number; caption?: string; animate: boolean }): JSX.Element {
  const shown = table.rows.slice(0, MINI_ROWS);
  return (
    <div className="overflow-hidden rounded-q border border-slate-800 bg-slate-900/50">
      <div className="flex items-center gap-1.5 border-b border-slate-800 px-2.5 py-1.5 text-[11px] text-q-code-muted">
        <Table2 aria-hidden className="h-3 w-3 shrink-0 text-teal-400" />
        <span className="min-w-0 flex-1 truncate">{caption ?? ''}</span>
        <span className="shrink-0 tabular-nums">{PRACTICE.rowCount(rows)}</span>
      </div>
      <div className="q-no-scrollbar overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-16px),transparent)]">
        <table className="w-full border-collapse text-left font-mono text-[11px] text-q-code-ink">
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th key={column} scope="col" className="whitespace-nowrap border-b border-slate-800 px-2 py-1.5 font-semibold text-emerald-300">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, rowIndex) => (
              <motion.tr
                key={row.join('|')}
                initial={animate ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: animate ? rowIndex * 0.08 : 0 }}
                className="border-b border-slate-800/60 last:border-b-0"
              >
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={cn('whitespace-nowrap px-2 py-1', typeof cell === 'number' ? 'tabular-nums text-sky-300' : '')}>
                    {typeof cell === 'number' ? cell.toLocaleString('id-ID') : cell}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 ? <p className="m-0 px-2.5 py-3 text-[11px] italic text-q-code-muted">{PRACTICE.rowCount(0)}</p> : null}
      </div>
    </div>
  );
}

function InputCell({ input }: { input: RunInput }): JSX.Element {
  if (input.kind === 'field') {
    return (
      <div className="flex flex-col gap-1.5 rounded-q border border-slate-800 bg-slate-900/50 p-2.5">
        <span className="text-[11px] text-q-code-muted">{input.label}</span>
        <span className="truncate rounded-md border border-amber-400/40 bg-slate-950 px-2 py-1.5 font-mono text-xs text-amber-200">{input.value}</span>
      </div>
    );
  }
  return <MiniTable table={input.table} rows={input.total} caption={`${PRACTICE.ui.tablePreview} ${input.name}`} animate={false} />;
}

/** `fallbackCaption`: judul tabel bila contohnya tidak punya judul sendiri (Hasil Kamu / Expected Output, seperti di aplikasi). */
function ResultCell({ side, animate, fallbackCaption }: { side: RunTable | { text: string }; animate: boolean; fallbackCaption: string }): JSX.Element {
  if ('text' in side) {
    return <p className="m-0 rounded-q border border-dashed border-slate-700 p-2.5 text-[12px] leading-relaxed text-q-code-muted">{side.text}</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <MiniTable table={side.table} rows={side.rows} caption={side.caption ?? fallbackCaption} animate={animate} />
      {side.note !== undefined ? <p className="m-0 text-[11px] leading-snug text-q-code-muted">{side.note}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel hasil & konsol                                                */
/* ------------------------------------------------------------------ */

type PanelView = 'result' | 'console';

/** Tanda di tab HASIL setelah penilaian: centang/silang + nama penilaian untuk pembaca layar (judul kartunya). */
function verdictMark(example: RunExample | null): ReactNode {
  if (example === null || example.verdict === 'none') return null;
  const match = example.verdict === 'match';
  const spoken = example.verdictText?.title ?? (match ? STUCK.example.correctLabel : STUCK.example.wrongLabel);
  return (
    <>
      {match ? <Check aria-hidden className="h-3.5 w-3.5 text-emerald-400" strokeWidth={3} /> : <X aria-hidden className="h-3.5 w-3.5 text-rose-400" strokeWidth={3} />}
      <span className="sr-only">{spoken}</span>
    </>
  );
}

function PanelTabs({ run, view, onChange, judged }: { run: Run; view: PanelView; onChange: (view: PanelView) => void; judged: RunExample | null }): JSX.Element {
  const items: ReadonlyArray<{ id: PanelView; label: string; icon: ReactNode }> = [
    { id: 'result', label: run.panels.result, icon: verdictMark(judged) },
    { id: 'console', label: run.panels.console, icon: null },
  ];
  return (
    <div role="group" aria-label={`${run.panels.result} / ${run.panels.console}`} className="flex items-stretch gap-1 border-b border-q-code-border bg-q-code-chrome/40 px-3">
      {items.map((item) => {
        const active = item.id === view;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative inline-flex h-10 items-center gap-1.5 px-2.5 font-q-body text-[11px] font-bold uppercase tracking-[0.14em] transition-colors duration-150 focus-visible:[outline-offset:-2px]',
              active ? 'text-q-code-ink' : 'text-q-code-muted hover:text-q-code-ink',
            )}
          >
            {item.label}
            {item.icon}
            {active ? <span aria-hidden className="absolute inset-x-1 -bottom-px h-[2px] rounded-q-pill bg-emerald-400" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function ConsoleView({ run, example }: { run: Run; example: RunExample }): JSX.Element {
  // Tebak Hasil tidak menjalankan query: konsolnya mengatakan itu. Selain itu baris ketiga konsol menyebut penilaian
  // dari hasil — hanya berlaku untuk misi yang query-nya kamu tulis sendiri.
  const lines = example.executes ? run.consoleLines(example.yours.rows).slice(0, example.graded ? undefined : 2) : [run.consoleNoRun];
  return (
    <ol className="m-0 flex list-none flex-col gap-1.5 p-0 font-mono text-xs leading-relaxed text-q-code-ink">
      {lines.map((line, index) => (
        <motion.li key={line} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: index * 0.12 }} className="flex gap-2">
          <span aria-hidden className="select-none text-emerald-400">›</span>
          <span>{line}</span>
        </motion.li>
      ))}
    </ol>
  );
}

/** Judul tiga kolom: bawaan (Input / Hasil kamu / Seharusnya) atau pengganti per tab (Tebak Hasil, Lab Injection). */
function columnsFor(run: Run, example: RunExample): Run['columns'] {
  return { ...run.columns, ...run.columnsByTab[example.id] };
}

function ResultView({ run, example, done }: { run: Run; example: RunExample; done: boolean }): JSX.Element {
  const animate = !done;
  const columns = columnsFor(run, example);
  return (
    <div className="flex flex-col gap-3">
      {/* Penilaian muncul setelah baris hasil terakhir (urutan yang sama dengan aplikasi). */}
      {done && example.verdict !== 'none' && example.verdictText !== undefined ? (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
          <Verdict
            tone={example.verdict === 'match' ? 'correct' : 'wrong'}
            title={example.verdictText.title}
            aside={example.verdict === 'match' && example.xp !== undefined ? <XpChip>{PRACTICE.verdict.xp(example.xp)}</XpChip> : undefined}
          >
            {example.verdictText.detail}
          </Verdict>
        </motion.div>
      ) : null}
      {/* Layar sempit: tiga kolom digeser mendatar (kolom berikutnya mengintip); mulai sm berdampingan. */}
      <div className="q-no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:overflow-visible sm:px-0">
        <div className="flex w-[78%] shrink-0 snap-start flex-col gap-2 sm:w-auto" data-column="input">
          <MiniHeading>{columns.input}</MiniHeading>
          <InputCell input={example.input} />
        </div>
        <div className="flex w-[78%] shrink-0 snap-start flex-col gap-2 sm:w-auto" data-column="yours">
          <MiniHeading>{columns.yours}</MiniHeading>
          <ResultCell side={example.yours} animate={animate} fallbackCaption={OUTPUT_CAPTIONS.yours} />
        </div>
        <div className="flex w-[78%] shrink-0 snap-start flex-col gap-2 sm:w-auto" data-column="expected">
          <MiniHeading>{columns.expected}</MiniHeading>
          <ResultCell side={example.expected} animate={animate} fallbackCaption={OUTPUT_CAPTIONS.expected} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Satu contoh                                                         */
/* ------------------------------------------------------------------ */

function RunPanel({ run, base }: { run: Run; base: RunExample }): JSX.Element {
  const [fixed, setFixed] = useState(false);
  const example = fixed && base.fixed !== undefined ? base.fixed : base;
  const [round, setRound] = useState(0);
  const [view, setView] = useState<PanelView>('result');
  const sequence = useRunSequence();
  const { run: play, reset } = sequence;
  const rows = Math.min(example.yours.rows, MINI_ROWS);
  const onTyped = useCallback(() => play(rows), [play, rows]);
  const replay = useCallback(() => {
    reset();
    setRound((value) => value + 1);
  }, [reset]);
  const showFix = useCallback(() => {
    reset();
    setFixed(true);
    setRound((value) => value + 1);
  }, [reset]);

  const done = sequence.phase === 'done';
  // Tebak Hasil tidak "menjalankan" apa pun: tanpa pemintal, pilihan & jawabannya langsung tampil setelah kode terbaca.
  const running = sequence.phase === 'running' && example.executes;
  const shown = sequence.phase === 'rows' || done || (sequence.phase === 'running' && !example.executes);
  const idleColumns = columnsFor(run, example);

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 flex min-w-0 flex-wrap items-center gap-2 text-sm text-q-ink">
        {example.label !== undefined ? (
          <span className="rounded-q-pill bg-q-tint px-2.5 py-1 text-xs font-bold text-q-primary-ink">{example.label}</span>
        ) : null}
        <span className="font-bold">{example.title}</span>
      </p>
      <CodeWindow
        code={example.code}
        fileName={example.fileName}
        typing
        typingSpeed={20}
        replayKey={round}
        onTyped={onTyped}
        lineMarks={done ? example.marks : undefined}
        minLines={RUN_MIN_LINES}
        footer={
          <>
            <MockButton tone="ghost" onClick={replay} icon={<RotateCcw aria-hidden className="h-4 w-4" />}>
              {PRACTICE.buttons.replay}
            </MockButton>
            {base.fixed !== undefined && !fixed ? (
              <MockButton tone="run" onClick={showFix} icon={<Wrench aria-hidden className="h-4 w-4" />}>
                {PRACTICE.ui.showFix}
              </MockButton>
            ) : null}
          </>
        }
      >
        <PanelTabs run={run} view={view} onChange={setView} judged={done ? example : null} />
        {/* Tinggi dipesan kira-kira setinggi tampilan hasil, supaya berganti ke Konsol tidak menggeser halaman. */}
        <div className={cn(RESULT_PANEL, 'min-h-[300px] sm:min-h-[320px]')} data-example={example.id} data-verdict={done ? example.verdict : undefined}>
          <AnimatePresence mode="wait" initial={false}>
            {running ? (
              <motion.div key="running" {...crossfadeProps} className="m-auto">
                <RunningNote>{PRACTICE.ui.running}</RunningNote>
              </motion.div>
            ) : shown ? (
              <motion.div key={`${view}-${round}`} {...crossfadeProps}>
                {view === 'result' ? <ResultView run={run} example={example} done={done} /> : <ConsoleView run={run} example={example} />}
              </motion.div>
            ) : (
              // Selama kode diketik: kerangka redup tiga kolom (hiasan).
              <motion.div key="idle" {...crossfadeProps} aria-hidden className="grid grid-cols-3 gap-3 opacity-60">
                {[idleColumns.input, idleColumns.yours, idleColumns.expected].map((column) => (
                  <div key={column} className="flex flex-col gap-2">
                    <MiniHeading>{column}</MiniHeading>
                    <span className="block h-24 rounded-q border border-dashed border-slate-700" />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CodeWindow>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Baris                                                               */
/* ------------------------------------------------------------------ */

export function RunRow({ course, started }: { course: AvailableCourse; started: boolean }): JSX.Element {
  const { run } = course.rows;
  const items: readonly TabItem<PracticeTabId>[] = run.tabs.map((tab) => ({
    value: tab.id,
    label: tab.label,
    icon: <Icon name={PRACTICE.tabs[tab.id].icon} className="h-4 w-4" />,
  }));
  return (
    <FeatureRow
      name="run"
      stacked
      title={run.title}
      lead={run.lead}
      extra={
        <div className="pb-1 pt-2">
          {/* '#/sql' membuka misi "Lanjutkan": misi pertama bagi pengguna baru, misi yang sedang berjalan bagi yang sudah mulai. */}
          <Button3D href={run.link.href} variant="outline" data-testid="run-link">
            {started ? run.link.resume : run.link.label}
          </Button3D>
        </div>
      }
      visual={
        <div className="mx-auto w-full max-w-[1000px]">
          <Tabs<PracticeTabId> items={items} ariaLabel={run.tabsLabel} size="sm" defaultValue={run.tabs[0]?.id} panelClassName="mt-5">
            {(value) => <RunPanel run={run} base={RUN_EXAMPLES[value]} />}
          </Tabs>
          <RowNote testId="run-note">{run.note}</RowNote>
        </div>
      }
    />
  );
}
