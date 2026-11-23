import { useState, type ReactNode } from 'react';
import { Clock, Columns2, Diff, LoaderCircle, Play, Square, Target, TriangleAlert } from 'lucide-react';
import { GUARD_TIMEOUT_MS } from '../lib/sqlGuard';
import { RUN_SHORTCUT_LABEL } from '../lib/platform';
import type { CheckResult, CheckView, CompletionSummary, QueryResult } from '../types';
import { ResultDiffView } from './ResultDiffView';
import { ResultTable } from './ResultTable';
import { SuccessCelebration } from './SuccessCelebration';
import { ViewNote } from './ViewNote';
import { ErrorMateriLinks } from './materi/MateriLinkContext';
import { getMismatchStyle } from './mismatchStyle';

export interface MissionOutputProps {
  check: CheckResult | null;
  completion: CompletionSummary | null;
  running: boolean;
  hasNextMission: boolean;
  onNextMission: () => void;
  /** Isi pengganti tampilan awal (sebelum ada percobaan). */
  idle?: ReactNode;
  /** Pesan saat percobaan tidak menghasilkan tabel. */
  noResultMessage?: ReactNode;
  /** Judul kartu sukses (default "Jawaban benar!"). */
  successTitle?: string;
  /** Keterangan sukses saat tidak ada Expected Output pembanding (expected = null). */
  successDetail?: string;
  /** Urutan baris dinilai (untuk menandai baris yang urutannya salah di tab Perbedaan). */
  orderMatters?: boolean;
  /** Ditampilkan di bawah kartu error / jawaban salah (mis. penanda Peta Kelemahan). */
  afterFeedback?: ReactNode;
  /** Tombol "Hentikan" saat penilaian berjalan. */
  onCancel?: () => void;
}

type WrongCheck = Extract<CheckResult, { kind: 'wrong' }>;
type CorrectCheck = Extract<CheckResult, { kind: 'correct' }>;
type CompareTab = 'diff' | 'actual' | 'expected' | 'compare';

/* ------------------------------------------------------------------ */
/* Utilitas                                                            */
/* ------------------------------------------------------------------ */

const renderKeys = new WeakMap<object, number>();
let renderKeySeq = 0;

/** Key stabil per objek hasil — dipakai agar animasi diputar ulang di setiap percobaan baru. */
export function keyForObject(value: object): number {
  const existing = renderKeys.get(value);
  if (existing !== undefined) return existing;
  renderKeySeq += 1;
  renderKeys.set(value, renderKeySeq);
  return renderKeySeq;
}

export function formatElapsed(ms: number): string {
  if (ms < 1) return '< 1 ms';
  if (ms < 1000) return `${ms.toFixed(ms < 10 ? 1 : 0)} ms`;
  return `${(ms / 1000).toFixed(2)} dtk`;
}

/* ------------------------------------------------------------------ */
/* Komponen bersama (juga dipakai PlaygroundOutput)                    */
/* ------------------------------------------------------------------ */

export interface RunningStateProps {
  label?: string;
  /** Jika diisi, tampil tombol "Hentikan" (menghentikan worker SQL). */
  onCancel?: () => void;
}

export function RunningState({ label = 'Menjalankan query…', onCancel }: RunningStateProps): JSX.Element {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-4 text-sm text-slate-300">
      <LoaderCircle className="h-5 w-5 animate-spin text-emerald-400" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {label}
        {onCancel ? (
          <span className="block text-xs text-slate-500">
            Query yang berjalan lebih dari {GUARD_TIMEOUT_MS / 1000} detik dihentikan otomatis.
          </span>
        ) : null}
      </span>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
        >
          <Square className="h-3 w-3 fill-current" aria-hidden="true" />
          Hentikan
        </button>
      ) : null}
    </div>
  );
}

export interface SqlErrorCardProps {
  friendlyError: string;
  rawError: string;
  title?: string;
}

export function SqlErrorCard({ friendlyError, rawError, title = 'Query gagal dijalankan' }: SqlErrorCardProps): JSX.Element {
  return (
    <div role="alert" className="animate-shake overflow-hidden rounded-lg border border-rose-500/40 bg-rose-950/30">
      <div className="flex items-start gap-3 px-4 py-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-rose-300">{title}</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">{friendlyError}</p>
        </div>
      </div>
      <div className="border-t border-rose-500/20 bg-slate-950/60 px-4 py-2.5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pesan asli SQLite</p>
        <code className="block whitespace-pre-wrap break-words font-mono text-xs text-rose-200/80">{rawError}</code>
      </div>
      <ErrorMateriLinks rawError={rawError} />
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Idle                                                                */
/* ------------------------------------------------------------------ */

function IdleState(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-800 bg-slate-900/30 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
        <Target className="h-6 w-6 text-emerald-400" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-slate-300">Siap menguji query kamu?</p>
      <p className="max-w-sm text-xs leading-relaxed text-slate-500">
        Tulis query di editor, lalu tekan{' '}
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
          <Play className="h-3 w-3" aria-hidden="true" /> Run &amp; Check
        </span>{' '}
        atau{' '}
        <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-px font-mono text-[10px] text-slate-300">
          {RUN_SHORTCUT_LABEL}
        </kbd>
        . Hasilmu akan dibandingkan dengan Expected Output.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Jawaban salah                                                       */
/* ------------------------------------------------------------------ */

const DEFAULT_ACTUAL_LABEL = 'Hasil Kamu';
const DEFAULT_EXPECTED_LABEL = 'Expected Output';

const TABS: { id: CompareTab; label: string }[] = [
  { id: 'diff', label: 'Perbedaan' },
  { id: 'actual', label: 'Hasil Kamu' },
  { id: 'expected', label: 'Seharusnya' },
  { id: 'compare', label: 'Berdampingan' },
];

function NoResultPlaceholder({ message }: { message?: ReactNode }): JSX.Element {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
      {message ?? (
        <>
          Query kamu tidak menghasilkan tabel. Pastikan statement terakhir adalah <code className="text-emerald-400">SELECT</code>.
        </>
      )}
    </div>
  );
}

interface ActualTableProps {
  actual: QueryResult | null;
  diff: WrongCheck['compare']['firstDiff'];
  caption?: string;
  noResultMessage?: ReactNode;
}

function ActualTable({ actual, diff, caption, noResultMessage }: ActualTableProps): JSX.Element {
  if (!actual) return <NoResultPlaceholder message={noResultMessage} />;
  return <ResultTable result={actual} highlightCell={diff} caption={caption} />;
}

function labelsOf(view: CheckView | undefined): { actual: string; expected: string } {
  return { actual: view?.actualLabel ?? DEFAULT_ACTUAL_LABEL, expected: view?.expectedLabel ?? DEFAULT_EXPECTED_LABEL };
}

interface CompareViewsProps {
  check: WrongCheck;
  expected: QueryResult;
  noResultMessage?: ReactNode;
  orderMatters: boolean;
}

/** Tab Perbedaan / Hasil Kamu / Seharusnya / Berdampingan — hanya bila ada Expected Output pembanding. */
function CompareViews({ check, expected, noResultMessage, orderMatters }: CompareViewsProps): JSX.Element {
  const defaultTab: CompareTab = check.actual ? 'diff' : 'expected';
  const tabs = check.actual ? TABS : TABS.filter((t) => t.id !== 'diff');
  // Tab di-reset otomatis setiap kali objek `check` berganti (percobaan baru).
  const [tabState, setTabState] = useState<{ owner: WrongCheck; tab: CompareTab }>({ owner: check, tab: defaultTab });
  const tab = tabState.owner === check ? tabState.tab : defaultTab;
  const diff = check.compare.firstDiff;
  // Indeks baris firstDiff merujuk ke hasil user. Pada perbandingan tanpa urutan, baris yang
  // sama di Expected belum tentu pasangannya, jadi di tabel Expected cukup kolomnya yang disorot
  // (kecuali 'row-order', di mana posisi baris memang yang dibandingkan).
  const expectedDiff = diff && check.compare.reason !== 'row-order' ? { row: -1, column: diff.column } : diff;
  const labels = labelsOf(check.view);
  // Caption tabel tunggal hanya bila validator memberi label khusus (mis. isi tabel setelah DML).
  const singleCaption = check.view ? labels : undefined;

  return (
    <>
      <div role="group" aria-label="Tampilan perbandingan hasil" className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
        {tabs.map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => setTabState({ owner: check, tab: id })}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                active ? 'bg-slate-800 text-emerald-300 shadow-sm' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              {id === 'compare' ? <Columns2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              {id === 'diff' ? <Diff className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'diff' && check.actual ? (
        <ResultDiffView
          expected={expected}
          actual={check.actual}
          orderMatters={orderMatters}
          actualLabel={labels.actual}
          expectedLabel={labels.expected}
        />
      ) : null}
      {tab === 'actual' ? (
        <ActualTable actual={check.actual} diff={diff} caption={singleCaption?.actual} noResultMessage={noResultMessage} />
      ) : null}
      {tab === 'expected' ? <ResultTable result={expected} highlightCell={expectedDiff} caption={singleCaption?.expected} /> : null}
      {tab === 'compare' ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <ActualTable actual={check.actual} diff={diff} caption={labels.actual} noResultMessage={noResultMessage} />
          <ResultTable result={expected} highlightCell={expectedDiff} caption={labels.expected} />
        </div>
      ) : null}
    </>
  );
}

function WrongState({ check, noResultMessage, orderMatters }: { check: WrongCheck; noResultMessage?: ReactNode; orderMatters: boolean }): JSX.Element {
  const style = getMismatchStyle(check.compare.reason);
  const Icon = style.icon;
  const note = check.view?.note;

  return (
    <div className="space-y-3">
      <div key={keyForObject(check)} role="status" className={`animate-shake flex items-start gap-3 rounded-lg border px-4 py-3 ${style.cardClass}`}>
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className={`text-sm font-semibold ${style.titleClass}`}>{style.title}</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">{check.compare.message}</p>
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <Clock className="h-3 w-3" aria-hidden="true" /> {formatElapsed(check.elapsedMs)}
          </p>
        </div>
      </div>

      {note ? <ViewNote note={note} /> : null}

      {check.expected ? (
        <CompareViews check={check} expected={check.expected} noResultMessage={noResultMessage} orderMatters={orderMatters} />
      ) : (
        <ActualTable
          actual={check.actual}
          diff={check.compare.firstDiff}
          caption={labelsOf(check.view).actual}
          noResultMessage={noResultMessage}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Jawaban benar                                                       */
/* ------------------------------------------------------------------ */

interface CorrectStateProps {
  check: CorrectCheck;
  completion: CompletionSummary | null;
  hasNextMission: boolean;
  onNextMission: () => void;
  title: string;
  successDetail?: string;
}

function CorrectState({ check, completion, hasNextMission, onNextMission, title, successDetail }: CorrectStateProps): JSX.Element {
  const detail = check.expected ? 'hasil cocok dengan Expected Output' : successDetail ?? 'target tercapai';
  const note = check.view?.note;
  return (
    <div className="space-y-3">
      <SuccessCelebration
        key={keyForObject(check)}
        title={title}
        subtitle={
          <>
            <Clock className="h-3 w-3" aria-hidden="true" /> {formatElapsed(check.elapsedMs)} · {detail}
          </>
        }
        completion={completion}
        hasNextMission={hasNextMission}
        onNextMission={onNextMission}
      />
      {note ? <ViewNote note={note} /> : null}
      <ResultTable result={check.actual} caption={labelsOf(check.view).actual} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Komponen utama                                                      */
/* ------------------------------------------------------------------ */

export function MissionOutput({
  check,
  completion,
  running,
  hasNextMission,
  onNextMission,
  idle,
  noResultMessage,
  successTitle = 'Jawaban benar!',
  successDetail,
  orderMatters = false,
  afterFeedback,
  onCancel,
}: MissionOutputProps): JSX.Element {
  if (running) return <RunningState label="Memeriksa jawaban…" onCancel={onCancel} />;
  if (!check) return <>{idle ?? <IdleState />}</>;

  switch (check.kind) {
    case 'error':
      return (
        <div className="space-y-3">
          <SqlErrorCard key={keyForObject(check)} friendlyError={check.friendlyError} rawError={check.rawError} />
          {afterFeedback}
        </div>
      );
    case 'wrong':
      return (
        <div className="space-y-3">
          <WrongState check={check} noResultMessage={noResultMessage} orderMatters={orderMatters} />
          {afterFeedback}
        </div>
      );
    case 'correct':
      return (
        <CorrectState
          check={check}
          completion={completion}
          hasNextMission={hasNextMission}
          onNextMission={onNextMission}
          title={successTitle}
          successDetail={successDetail}
        />
      );
    default: {
      const unreachable: never = check;
      return unreachable;
    }
  }
}
