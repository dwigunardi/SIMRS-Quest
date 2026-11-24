/**
 * Isi tiap tab "Belajar sambil praktik": ringkasan misi di kiri, mockup editor di kanan.
 * Contohnya misi SUNGGUHAN dari lib/content.ts (diperiksa verifikasi terhadap kurikulum). Tidak ada SQL yang
 * dijalankan di sini — "Run & Check" hanya memutar urutan tampilan: menjalankan → baris hasil → penilaian → confetti.
 */
import { useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { ArrowRight, CircleCheck, CircleX, Diff, Lock, LockOpen, Play, RotateCcw, Send } from 'lucide-react';
import { useTypewriter } from '../../hooks/useTypewriter';
import { fireConfetti } from '../../illustrations/confetti';
import { Mascot } from '../../illustrations/Mascot';
import { cn } from '../../lib/cn';
import { HINT_PENALTY_PERCENT, OUTPUT_CAPTIONS, OUTPUT_TABS, PRACTICE, PRACTICE_TABLES, STUCK, TABLE_PREVIEWS, type PracticeTabId, type PracticeTable, type ResultTable } from '../../lib/content';
import { crossfade } from '../../lib/motion';
import { Card } from '../../ui/Card';
import { CodeWindow, type CodeLineMark } from '../../ui/CodeWindow';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { DiffChips, HintButton, HintCard, IdleNote, IdleResult, MockButton, MockTable, OutputTabs, RESULT_PANEL, RunningNote, Verdict, XpChip, toMockRows, type OutputTab } from './mock';
import { useRunSequence } from './useRunSequence';

/* ------------------------------------------------------------------ */
/* Teks lokal                                                          */
/* ------------------------------------------------------------------ */

const TEXT = PRACTICE.ui;

const STATUS_LABELS = { same: STUCK.example.diff.sameLabel, extra: STUCK.example.diff.extraLabel, missing: TEXT.missingLabel } as const;

/** XP setelah hint dibuka (aturan aplikasi: dibulatkan). */
function afterHint(xp: number): number {
  return Math.round((xp * (100 - HINT_PENALTY_PERCENT)) / 100);
}

/**
 * Tinggi minimum area hasil di layar lebar supaya jendela tidak melompat saat hasil muncul. Di layar sempit tinggi
 * ini TIDAK dipesan (panel kosong setinggi itu hanya memanjangkan guliran): kelas RESULT_MIN membacanya dari variabel.
 */
function resultMinHeight(rowCount: number, withVerdict: boolean, extra = 0): CSSProperties {
  return { '--q-result-min': `${32 + (withVerdict ? 62 : 0) + 72 + rowCount * 29 + extra}px` } as CSSProperties;
}
const RESULT_MIN = 'lg:min-h-[var(--q-result-min)]';

/** Tabel database latihan yang dibaca sebuah query (tabel pertama setelah FROM). */
function tableOf(sql: string): PracticeTable | undefined {
  const name = /\bFROM\s+([a-z_]+)/i.exec(sql)?.[1]?.toLowerCase();
  return PRACTICE_TABLES.find((table) => table.name === name);
}

interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Titik tengah sebuah elemen dalam koordinat layar 0..1. Diambil SAAT tombol diklik (tombolnya pasti terlihat),
 * karena saat penilaian muncul tombol itu bisa sudah berganti.
 */
function centerOf(element: Element): ScreenPoint {
  const rect = element.getBoundingClientRect();
  return {
    x: (rect.left + rect.width / 2) / Math.max(1, window.innerWidth),
    y: (rect.top + rect.height / 2) / Math.max(1, window.innerHeight),
  };
}

/** Confetti kecil, sekali per klik (fireConfetti sendiri diam saat reduced motion). */
function celebrate(origin: ScreenPoint): void {
  void fireConfetti({ origin, particleCount: 48, spread: 64 });
}

/* ------------------------------------------------------------------ */
/* Kerangka bersama                                                    */
/* ------------------------------------------------------------------ */

function PanelLayout({ brief, children }: { brief: ReactNode; children: ReactNode }): JSX.Element {
  return (
    // Layar lebar: kartu soal direntangkan setinggi jendela kode (tanpa ruang mint kosong di bawahnya).
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-stretch lg:gap-10">
      {brief}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface BriefProps {
  /** "Tier 1 · Misi 2". */
  label?: string;
  title: string;
  task: string;
  /** XP misi; `xpNow` berbeda bila hint sudah dibuka. */
  xp?: number;
  xpNow?: number;
  /** Tabel yang dipakai misi ini (keterangan satu baris). */
  table?: PracticeTable;
  children?: ReactNode;
}

/** Cuplikan isi tabel yang dibaca misi: seperti apa datanya sebelum query ditulis. */
function TablePreview({ table, preview }: { table: PracticeTable; preview: ResultTable }): JSX.Element {
  return (
    <figure className="m-0 w-full overflow-hidden rounded-q border border-q-border" data-testid="practice-table-preview">
      <figcaption className="flex items-center gap-2 border-b border-q-border bg-q-muted px-3 py-2 text-[13px] text-q-ink-soft">
        <Icon name="table" className="h-4 w-4 shrink-0 text-q-primary-ink" />
        <span className="min-w-0 flex-1 truncate">
          {TEXT.tablePreview}{' '}
          <code className="font-mono text-[13px] font-medium text-q-ink">{table.name}</code>
        </span>
        <span className="shrink-0 tabular-nums">{TEXT.tablePreviewMore(preview.rows.length, table.rows)}</span>
      </figcaption>
      {/* Layar sempit: kolom terakhir bisa di luar bingkai — tepi kanan memudar sebagai tanda tabelnya bisa digeser. */}
      <div className="q-no-scrollbar overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] sm:[mask-image:none]">
        <table className="w-full border-collapse text-left font-mono text-xs text-q-ink">
          <thead>
            <tr>
              {preview.columns.map((column) => (
                <th key={column} scope="col" className="whitespace-nowrap border-b border-q-border px-3 py-2 font-semibold text-q-primary-ink">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-q-border/70 last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="whitespace-nowrap px-3 py-1.5 tabular-nums last:pr-8 sm:last:pr-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Kartu ringkasan misi: apa yang diminta, seperti apa datanya, dan berapa XP-nya. */
function Brief({ label, title, task, xp, xpNow, table, children }: BriefProps): JSX.Element {
  const reduced = xp !== undefined && xpNow !== undefined && xpNow !== xp;
  const preview = table !== undefined ? TABLE_PREVIEWS[table.name] : undefined;
  return (
    <Card as="article" radius="lg" padding="lg" className="flex h-full flex-col items-start gap-4">
      {label !== undefined ? (
        <Pill tone="primary" size="sm">
          {label}
        </Pill>
      ) : null}
      <div>
        <h3 className="text-balance text-q-h3 font-bold text-q-ink">{title}</h3>
        <p className="mt-2 text-pretty leading-relaxed text-q-ink-soft">{task}</p>
      </div>
      {children}
      {table !== undefined && preview !== undefined ? <TablePreview table={table} preview={preview} /> : null}
      {table !== undefined && preview === undefined ? (
        <p className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 border-t border-q-border pt-4 text-sm text-q-ink-soft">
          <Icon name="table" className="h-4 w-4 text-q-primary-ink" />
          <code className="font-mono text-[13px] font-medium text-q-ink">{table.name}</code>
          <span aria-hidden>·</span>
          <span>{PRACTICE.rowCount(table.rows)}</span>
          <span className="w-full">{table.about}</span>
        </p>
      ) : null}
      {table !== undefined && preview !== undefined ? <p className="-mt-1 text-sm text-q-ink-soft">{table.about}.</p> : null}
      {xp !== undefined ? (
        // Di kartu yang direntangkan (layar lebar), XP menempel di dasar kartu dan Kapi menunjuk ke editor di sebelahnya.
        <div className="mt-auto flex w-full items-end gap-x-3 pt-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
          <Pill tone="amber" icon={<Icon name="zap" className="h-3.5 w-3.5" />} className="font-bold tabular-nums">
            {reduced ? (
              <>
                <span className="sr-only">{TEXT.xpBefore} </span>
                <del className="font-normal">{PRACTICE.verdict.xp(xp)}</del>
                <span className="sr-only">, {TEXT.xpNow}</span>{' '}
              </>
            ) : null}
            {PRACTICE.verdict.xp(xpNow ?? xp)}
          </Pill>
          {reduced ? <span className="text-sm text-q-ink-soft">{TEXT.hintCost}</span> : null}
          </div>
          <Mascot pose="point" expression={reduced ? 'think' : 'smile'} className="-mb-2 hidden w-[72px] shrink-0 lg:inline-block" />
        </div>
      ) : null}
    </Card>
  );
}

/** Kartu penilaian yang memudar masuk; tempatnya sudah dipesan sejak baris hasil mulai muncul. */
function VerdictSlot({ shown, children }: { shown: boolean; children: ReactNode }): JSX.Element {
  return (
    <div role="status">
      <motion.div initial={false} animate={{ opacity: shown ? 1 : 0, scale: shown ? 1 : 0.98 }} transition={crossfade} className={shown ? '' : 'invisible'}>
        {children}
      </motion.div>
    </div>
  );
}

function tableRows(table: ResultTable): ReturnType<typeof toMockRows> {
  return toMockRows(table.rows);
}

/* ------------------------------------------------------------------ */
/* Query                                                               */
/* ------------------------------------------------------------------ */

function QueryPanel(): JSX.Element {
  const tab = PRACTICE.tabs.query;
  // Klik pertama pada Hint membuka hint PERTAMA misi ini (hint keduanya diceritakan di bagian "Macet?").
  const hint = { text: tab.hint, label: tab.hintLabel };
  const [replay, setReplay] = useState(0);
  const [typing, setTyping] = useState(true);
  const [hintOpen, setHintOpen] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const seq = useRunSequence();
  const hintId = useId();
  const rows = useMemo(() => tableRows(tab.result), [tab.result]);
  const busy = seq.phase === 'running' || seq.phase === 'rows';
  const done = seq.phase === 'done';
  const xpNow = hintUsed ? afterHint(tab.xp) : tab.xp;

  const run = (button: Element) => {
    const origin = centerOf(button);
    setTyping(false);
    seq.run(rows.length, () => celebrate(origin));
  };
  const replayAll = () => {
    seq.reset();
    setHintOpen(false);
    setHintUsed(false);
    setTyping(true);
    setReplay((value) => value + 1);
  };
  const toggleHint = () => {
    setHintOpen((value) => !value);
    // Hint yang dibuka setelah misi lolos tidak lagi memengaruhi XP.
    if (!done) setHintUsed(true);
  };

  return (
    <PanelLayout brief={<Brief label={tab.tierLabel} title={tab.missionTitle} task={tab.task} xp={tab.xp} xpNow={xpNow} table={tableOf(tab.code)} />}>
      <CodeWindow
        code={tab.code}
        fileName={tab.fileName}
        typing={typing}
        replayKey={replay}
        footer={
          <>
            <HintButton open={hintOpen} onToggle={toggleHint} controls={hintId} />
            {done ? (
              <MockButton className="ml-auto" onClick={replayAll} icon={<RotateCcw aria-hidden className="h-4 w-4" />}>
                {PRACTICE.buttons.replay}
              </MockButton>
            ) : (
              <MockButton tone="run" className="ml-auto" disabled={busy} onClick={(event) => run(event.currentTarget)} icon={<Play aria-hidden className="h-4 w-4 fill-current" />}>
                {PRACTICE.buttons.run}
              </MockButton>
            )}
          </>
        }
      >
        <div className={cn(RESULT_PANEL, RESULT_MIN)} style={resultMinHeight(rows.length, true)}>
          <div id={hintId} className="empty:hidden">
            <AnimatePresence initial={false}>
              {hintOpen ? (
                <HintCard key="hint" label={hint.label}>
                  <p>{hint.text}</p>
                </HintCard>
              ) : null}
            </AnimatePresence>
          </div>
          {seq.phase === 'idle' ? (
            <IdleResult columns={tab.result.columns} rows={rows.length} caption={OUTPUT_CAPTIONS.yours} icon={<Play className="h-4 w-4" />}>
              {TEXT.idleCheck}
            </IdleResult>
          ) : null}
          {seq.phase === 'running' ? <RunningNote>{TEXT.running}</RunningNote> : null}
          {seq.phase === 'rows' || done ? (
            <>
              <VerdictSlot shown={done}>
                <Verdict tone="correct" title={PRACTICE.verdict.correct} aside={<XpChip>{PRACTICE.verdict.xp(xpNow)}</XpChip>}>
                  {PRACTICE.verdict.correctDetail}
                </Verdict>
              </VerdictSlot>
              <MockTable columns={tab.result.columns} rows={rows} caption={OUTPUT_CAPTIONS.yours} count={PRACTICE.rowCount(rows.length)} animateRows />
            </>
          ) : null}
        </div>
      </CodeWindow>
    </PanelLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Perbaiki Query                                                      */
/* ------------------------------------------------------------------ */

type FixVariant = 'buggy' | 'fixed';
type CompareView = 'diff' | 'yours' | 'expected';

const COMPARE_TABS: readonly OutputTab<CompareView>[] = [
  { id: 'diff', label: OUTPUT_TABS.diff, icon: <Diff aria-hidden className="h-3.5 w-3.5 shrink-0" /> },
  { id: 'yours', label: OUTPUT_TABS.yours },
  { id: 'expected', label: OUTPUT_TABS.expected },
];

function FixPanel(): JSX.Element {
  const tab = PRACTICE.tabs.fix;
  const [variant, setVariant] = useState<FixVariant>('buggy');
  const [view, setView] = useState<CompareView>('diff');
  const [hintOpen, setHintOpen] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  /** Perbaikan sedang "diketik" (sampai selesai atau sampai Run ditekan). */
  const [typing, setTyping] = useState(false);
  const [typeKey, setTypeKey] = useState(0);
  const seq = useRunSequence();
  const hintId = useId();
  const expectedRows = useMemo(() => tableRows(tab.result), [tab.result]);
  const missingRows = useMemo(() => toMockRows(tab.result.rows, 'missing'), [tab.result]);
  const busy = seq.phase === 'running' || seq.phase === 'rows';
  const done = seq.phase === 'done';
  const fixed = variant === 'fixed';
  const xpNow = hintUsed ? afterHint(tab.xp) : tab.xp;

  // Baris pada versi perbaikan yang berbeda dari query rekan → ditandai hijau setelah lolos.
  const fixedMarks = useMemo(() => {
    const original = new Set(tab.buggyCode.split('\n'));
    const marks: Record<number, CodeLineMark> = {};
    tab.fixedCode.split('\n').forEach((line, index) => {
      if (!original.has(line)) marks[index + 1] = 'success';
    });
    return marks;
  }, [tab.buggyCode, tab.fixedCode]);
  const bugMarks = useMemo(() => {
    const marks: Record<number, CodeLineMark> = {};
    for (const bug of tab.bugs) marks[bug.line] = 'warn';
    return marks;
  }, [tab.bugs]);
  const lineMarks = fixed ? (done ? fixedMarks : undefined) : hintOpen ? bugMarks : undefined;
  const lineCount = Math.max(tab.buggyCode.split('\n').length, tab.fixedCode.split('\n').length);

  const switchTo = (next: string) => {
    if (next === variant || (next !== 'buggy' && next !== 'fixed')) return;
    seq.reset();
    setView('diff');
    setHintOpen(false);
    setVariant(next);
    setTyping(next === 'fixed');
    if (next === 'fixed') setTypeKey((value) => value + 1);
  };
  const run = (button: Element) => {
    const origin = centerOf(button);
    setTyping(false);
    if (fixed) seq.run(expectedRows.length, () => celebrate(origin));
    else seq.run(0);
  };
  const toggleHint = () => {
    setHintOpen((value) => !value);
    setHintUsed(true);
  };

  return (
    <PanelLayout brief={<Brief label={tab.tierLabel} title={tab.missionTitle} task={tab.task} xp={tab.xp} xpNow={xpNow} table={tableOf(tab.fixedCode)} />}>
      <CodeWindow
        code={fixed ? tab.fixedCode : tab.buggyCode}
        tabs={[
          { id: 'buggy', label: tab.fileName },
          { id: 'fixed', label: TEXT.fixFile },
        ]}
        activeTab={variant}
        onTabChange={switchTo}
        typing={fixed && typing}
        replayKey={typeKey}
        onTyped={() => setTyping(false)}
        lineMarks={lineMarks}
        minLines={lineCount}
        ariaLabel={fixed ? TEXT.fixFile : tab.fileName}
        footer={
          <>
            {/* Hint menunjuk baris pada query rekan, jadi hanya ada di tab itu. */}
            {fixed ? null : <HintButton open={hintOpen} onToggle={toggleHint} controls={hintId} />}
            <MockButton tone="run" className="ml-auto" disabled={busy} onClick={(event) => run(event.currentTarget)} icon={<Play aria-hidden className="h-4 w-4 fill-current" />}>
              {PRACTICE.buttons.run}
            </MockButton>
          </>
        }
      >
        <div className={cn(RESULT_PANEL, RESULT_MIN)} style={resultMinHeight(expectedRows.length, true, 96)}>
          <div id={hintId} className="empty:hidden">
            <AnimatePresence initial={false}>
              {hintOpen ? (
                <HintCard key="hint" label={TEXT.bugCount(tab.bugCount)}>
                  <ul className="mt-1 space-y-1">
                    {tab.bugs.map((bug) => (
                      <li key={bug.line}>
                        <span className="font-mono text-xs font-semibold text-amber-200">{TEXT.bugLine(bug.line)}</span> {bug.text}
                      </li>
                    ))}
                  </ul>
                </HintCard>
              ) : null}
            </AnimatePresence>
          </div>
          {seq.phase === 'idle' ? (
            <IdleResult columns={tab.result.columns} rows={expectedRows.length} caption={OUTPUT_CAPTIONS.yours} icon={<Play className="h-4 w-4" />}>
              {TEXT.idleCheck}
            </IdleResult>
          ) : null}
          {seq.phase === 'running' ? <RunningNote>{TEXT.running}</RunningNote> : null}

          {fixed && (seq.phase === 'rows' || done) ? (
            <>
              <VerdictSlot shown={done}>
                <Verdict tone="correct" title={PRACTICE.verdict.correct} aside={<XpChip>{PRACTICE.verdict.xp(xpNow)}</XpChip>}>
                  {PRACTICE.verdict.correctDetail}
                </Verdict>
              </VerdictSlot>
              <MockTable columns={tab.result.columns} rows={expectedRows} caption={OUTPUT_CAPTIONS.yours} count={PRACTICE.rowCount(expectedRows.length)} animateRows />
            </>
          ) : null}

          {!fixed && (seq.phase === 'rows' || done) ? (
            <>
              <motion.div role="status" initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: [0, -5, 5, -3, 3, 0] }} transition={{ duration: 0.45, ease: 'easeInOut' }}>
                <Verdict tone="wrong" title={STUCK.example.wrongLabel}>
                  {tab.buggyNote}
                </Verdict>
              </motion.div>
              <OutputTabs tabs={COMPARE_TABS} value={view} onChange={setView} ariaLabel={TEXT.compareLabel} />
              {view === 'diff' ? (
                <>
                  <DiffChips ariaLabel={TEXT.diffSummaryLabel} items={[{ text: TEXT.missingRows(missingRows.length), flagged: true }]} />
                  <MockTable columns={tab.result.columns} rows={missingRows} statusLabels={STATUS_LABELS} animateRows />
                </>
              ) : null}
              {view === 'yours' ? <MockTable columns={tab.result.columns} rows={[]} caption={OUTPUT_CAPTIONS.yours} count={PRACTICE.rowCount(0)} /> : null}
              {view === 'expected' ? (
                <MockTable columns={tab.result.columns} rows={expectedRows} caption={OUTPUT_CAPTIONS.expected} count={PRACTICE.rowCount(expectedRows.length)} />
              ) : null}
              <MockButton className="self-start" onClick={() => switchTo('fixed')} icon={<ArrowRight aria-hidden className="h-4 w-4" />}>
                {TEXT.showFix}
              </MockButton>
            </>
          ) : null}
        </div>
      </CodeWindow>
    </PanelLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Tebak Hasil                                                         */
/* ------------------------------------------------------------------ */

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

function PredictPanel(): JSX.Element {
  const tab = PRACTICE.tabs.predict;
  const [picked, setPicked] = useState<number | null>(null);
  const choice = picked === null ? undefined : tab.options[picked];

  const pick = (index: number, target: Element) => {
    if (index === picked) return;
    setPicked(index);
    if (tab.options[index]?.correct === true) celebrate(centerOf(target));
  };

  return (
    <PanelLayout brief={<Brief label={tab.tierLabel} title={tab.missionTitle} task={tab.task} xp={tab.xp} table={tableOf(tab.code)} />}>
      <CodeWindow code={tab.code} fileName={tab.fileName}>
        <div className={RESULT_PANEL}>
          <div className="grid gap-3 sm:grid-cols-3">
            {tab.options.map((option, index) => {
              const selected = picked === index;
              const letter = LETTERS[index] ?? String(index + 1);
              return (
                <motion.button
                  key={letter}
                  type="button"
                  aria-pressed={selected}
                  onClick={(event) => pick(index, event.currentTarget)}
                  // Pilihan yang salah bergetar kecil.
                  animate={selected && !option.correct ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className={cn(
                    'flex flex-col overflow-hidden rounded-q border text-left transition-colors duration-150',
                    selected
                      ? option.correct
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-rose-400 bg-rose-500/10'
                      : 'border-slate-700 bg-slate-900/50 hover:border-slate-500',
                  )}
                >
                  <span className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-200">
                    {tab.optionLabel(letter)}
                    {selected ? (
                      option.correct ? (
                        <CircleCheck aria-hidden className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <CircleX aria-hidden className="h-4 w-4 text-rose-400" />
                      )
                    ) : (
                      <span aria-hidden className="h-4 w-4 rounded-full border-2 border-slate-500" />
                    )}
                  </span>
                  <span className="grid font-mono text-xs" style={{ gridTemplateColumns: `repeat(${option.table.columns.length}, auto)` }}>
                    {option.table.columns.map((column) => (
                      <span key={column} className="border-b border-slate-800 px-3 py-1.5 font-semibold text-emerald-300">
                        {column}
                      </span>
                    ))}
                    {option.table.rows.flatMap((row, rowIndex) =>
                      row.map((cell, cellIndex) => (
                        <span key={`${rowIndex}-${cellIndex}`} className="px-3 py-1 text-slate-200">
                          {cell}
                        </span>
                      )),
                    )}
                  </span>
                </motion.button>
              );
            })}
          </div>
          <div role="status" className="flex min-h-[84px] flex-col justify-center">
            {choice === undefined ? (
              <IdleNote>{TEXT.pickPrompt}</IdleNote>
            ) : (
              <Verdict
                key={picked}
                tone={choice.correct ? 'correct' : 'wrong'}
                title={choice.correct ? STUCK.example.correctLabel : STUCK.example.wrongLabel}
                aside={choice.correct ? <XpChip>{PRACTICE.verdict.xp(tab.xp)}</XpChip> : undefined}
              >
                {choice.why}
              </Verdict>
            )}
          </div>
        </div>
      </CodeWindow>
    </PanelLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Lab Injection                                                       */
/* ------------------------------------------------------------------ */

/** Hanya untuk tampilan: pecah query satu baris menjadi tiga supaya muat di layar sempit (maknanya sama). */
function breakLines(sql: string): string {
  return sql.replace(' FROM ', '\nFROM ').replace(' WHERE ', '\nWHERE ');
}

function InjectionPanel(): JSX.Element {
  const tab = PRACTICE.tabs.injection;
  const [safe, setSafe] = useState(false);
  const seq = useRunSequence();
  const formRef = useRef<HTMLDivElement>(null);
  const inView = useInView(formRef, { once: true, margin: '-80px' });
  const typed = useTypewriter(tab.payload, { active: inView, speed: 90, startDelay: 400 });
  const inputId = useId();
  const busy = seq.phase === 'running' || seq.phase === 'rows';
  const done = seq.phase === 'done';
  const mode = safe ? tab.safe : tab.vulnerable;

  // SQL di server mengikuti isi kolom input, persis seperti di lab: input disambung mentah-mentah ke template rentan.
  const at = tab.builtSql.lastIndexOf(tab.payload);
  const liveSql = at < 0 ? tab.builtSql : `${tab.builtSql.slice(0, at)}${typed.shown}${tab.builtSql.slice(at + tab.payload.length)}`;

  const setMode = (next: boolean) => {
    if (next === safe) return;
    seq.reset();
    setSafe(next);
  };

  return (
    <PanelLayout brief={<Brief label={tab.tierLabel} title={tab.missionTitle} task={tab.task} xp={tab.xp} table={tableOf(tab.builtSql)} />}>
      <div className="flex flex-col gap-4">
        {/* Formulir portal yang sedang diuji */}
        <Card ref={formRef} tone="code" radius="lg" shadow="float" padding="none" className="overflow-hidden font-sans">
          <p className="flex items-center gap-2 border-b border-q-code-border bg-q-code-chrome px-4 py-3 text-sm font-semibold text-q-code-ink">
            <Icon name="shield-alert" className="h-4 w-4 text-teal-300" />
            {tab.formTitle}
          </p>
          <div className="flex flex-col gap-3 p-4">
            <div>
              <label htmlFor={inputId} className="block text-xs font-medium text-slate-300">
                {tab.inputLabel}
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id={inputId}
                  type="text"
                  readOnly
                  value={typed.shown}
                  spellCheck={false}
                  className="h-9 min-w-0 flex-1 rounded-q border border-q-code-border bg-q-code-deep px-3 font-mono text-sm text-amber-300"
                />
                <MockButton tone="run" disabled={busy || !typed.done} onClick={() => seq.run(0)} icon={<Send aria-hidden className="h-4 w-4" />}>
                  {TEXT.send}
                </MockButton>
              </div>
            </div>
            <div role="group" aria-label={TEXT.modeLabel} className="flex flex-col gap-1 rounded-q border border-slate-800 bg-slate-900/70 p-1 sm:flex-row">
              {[
                { safe: false, label: tab.vulnerable.label, Icon: LockOpen, active: 'bg-rose-500/15 text-rose-200' },
                { safe: true, label: tab.safe.label, Icon: Lock, active: 'bg-emerald-500/15 text-emerald-200' },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={safe === option.safe}
                  onClick={() => setMode(option.safe)}
                  className={cn(
                    'flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-center text-xs font-medium transition-colors duration-150',
                    safe === option.safe ? option.active : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200',
                  )}
                >
                  <option.Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <CodeWindow code={breakLines(safe ? tab.safeSql : liveSql)} fileName={tab.fileName} minLines={3}>
          <div className={cn(RESULT_PANEL, 'min-h-[104px]')}>
            {seq.phase === 'idle' ? <IdleNote>{TEXT.idleSend}</IdleNote> : null}
            {busy ? <RunningNote>{TEXT.sending}</RunningNote> : null}
            {done ? (
              <motion.div
                role="status"
                className="my-auto"
                initial={{ opacity: 0, x: 0 }}
                animate={safe ? { opacity: 1 } : { opacity: 1, x: [0, -5, 5, -3, 3, 0] }}
                transition={{ duration: 0.45, ease: 'easeInOut' }}
              >
                <Verdict tone={safe ? 'correct' : 'wrong'} title={mode.outcome} aside={<XpChipLike>{PRACTICE.rowCount(mode.rows)}</XpChipLike>} />
              </motion.div>
            ) : null}
          </div>
        </CodeWindow>
      </div>
    </PanelLayout>
  );
}

/** Chip netral di dalam kartu penilaian (jumlah baris). */
function XpChipLike({ children }: { children: ReactNode }): JSX.Element {
  return <span className="shrink-0 rounded-q-pill bg-slate-800 px-2.5 py-1 font-mono text-xs tabular-nums text-slate-200">{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Playground                                                          */
/* ------------------------------------------------------------------ */

function PlaygroundPanel(): JSX.Element {
  const tab = PRACTICE.tabs.playground;
  const [replay, setReplay] = useState(0);
  const [typing, setTyping] = useState(true);
  const seq = useRunSequence();
  const rows = useMemo(() => tableRows(tab.result), [tab.result]);
  const busy = seq.phase === 'running' || seq.phase === 'rows';
  const done = seq.phase === 'done';

  const run = () => {
    setTyping(false);
    seq.run(rows.length);
  };
  const replayAll = () => {
    seq.reset();
    setTyping(true);
    setReplay((value) => value + 1);
  };

  return (
    <PanelLayout
      brief={
        <Brief title={tab.title} task={tab.task}>
          <dl className="grid w-full gap-3 border-t border-q-border pt-4">
            {tab.tools.map((tool) => (
              <div key={tool.label}>
                <dt className="text-[15px] font-bold text-q-ink">{tool.label}</dt>
                <dd className="text-sm leading-relaxed text-q-ink-soft">{tool.text}</dd>
              </div>
            ))}
          </dl>
        </Brief>
      }
    >
      <CodeWindow
        code={tab.code}
        fileName={tab.fileName}
        typing={typing}
        replayKey={replay}
        footer={
          done ? (
            <MockButton className="ml-auto" onClick={replayAll} icon={<RotateCcw aria-hidden className="h-4 w-4" />}>
              {PRACTICE.buttons.replay}
            </MockButton>
          ) : (
            <MockButton tone="run" className="ml-auto" disabled={busy} onClick={run} icon={<Play aria-hidden className="h-4 w-4 fill-current" />}>
              {PRACTICE.buttons.runPlayground}
            </MockButton>
          )
        }
      >
        <div className={cn(RESULT_PANEL, RESULT_MIN)} style={resultMinHeight(rows.length, false)}>
          {seq.phase === 'idle' ? (
            <IdleResult columns={tab.result.columns} rows={rows.length} icon={<Play className="h-4 w-4" />}>
              {TEXT.idleRun}
            </IdleResult>
          ) : null}
          {seq.phase === 'running' ? <RunningNote>{TEXT.running}</RunningNote> : null}
          {seq.phase === 'rows' || done ? (
            <MockTable columns={tab.result.columns} rows={rows} count={PRACTICE.rowCount(rows.length)} animateRows />
          ) : null}
        </div>
      </CodeWindow>
    </PanelLayout>
  );
}

/* ------------------------------------------------------------------ */

const PANELS: Record<PracticeTabId, () => JSX.Element> = {
  query: QueryPanel,
  fix: FixPanel,
  predict: PredictPanel,
  injection: InjectionPanel,
  playground: PlaygroundPanel,
};

/** Isi panel untuk satu tab. State-nya (ketikan, hasil) kembali ke awal tiap kali tab dibuka lagi. */
export function PracticePanel({ tab }: { tab: PracticeTabId }): JSX.Element {
  const Panel = PANELS[tab];
  return <Panel />;
}
