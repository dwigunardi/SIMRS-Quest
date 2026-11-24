/**
 * Potongan kecil "layar jalur" untuk mockup di landing: tombol, kartu penilaian, tab hasil, dan tabel hasil.
 * Semuanya berlatar gelap tetap (dipasang di dalam CodeWindow) dan meniru tampilan aplikasi (slate/emerald, Inter),
 * tetapi TIDAK menjalankan SQL apa pun: isinya datang dari lib/content.ts.
 * Dipakai PracticeSection dan MascotHint.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, CircleCheck, CircleX, Lightbulb, LoaderCircle, Minus, Plus, Table2, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { PRACTICE } from '../../lib/content';
import { easeOut, fadeIn, stagger } from '../../lib/motion';

/* ------------------------------------------------------------------ */
/* Tombol                                                              */
/* ------------------------------------------------------------------ */

const BUTTON_TONE = {
  /** Tombol utama aplikasi (Run & Check). */
  run: 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400',
  ghost: 'border border-q-code-border text-q-code-ink hover:bg-q-code-chrome',
  /** Hint yang sedang terbuka. */
  amber: 'border border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25',
} as const;

export interface MockButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type'> {
  tone?: keyof typeof BUTTON_TONE;
  icon?: ReactNode;
  className?: string;
}

/** Tombol 36px di dalam mockup gelap. */
export function MockButton({ tone = 'ghost', icon, children, className, ...rest }: MockButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-q px-3.5 font-sans text-[13px] font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
        BUTTON_TONE[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/** Tombol Hint: menyala kuning selama hint terbuka. */
export function HintButton({ open, onToggle, controls }: { open: boolean; onToggle: () => void; controls: string }): JSX.Element {
  return (
    <MockButton tone={open ? 'amber' : 'ghost'} aria-expanded={open} aria-controls={controls} onClick={onToggle} icon={<Lightbulb aria-hidden className="h-4 w-4" />}>
      {PRACTICE.buttons.hint}
    </MockButton>
  );
}

/** Kartu hint kuning yang turun dari atas area hasil. */
export function HintCard({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={easeOut}
      className="flex gap-3 rounded-q border border-amber-400/40 bg-amber-500/10 px-3.5 py-3"
    >
      <Lightbulb aria-hidden className="mt-px h-5 w-5 shrink-0 text-amber-300" />
      <div className="min-w-0 text-[13px] leading-relaxed text-slate-200">
        <p className="text-xs font-semibold text-amber-300">{label}</p>
        {children}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Wadah panel hasil                                                   */
/* ------------------------------------------------------------------ */

/** Kelas dasar area hasil di bawah editor. */
export const RESULT_PANEL = 'flex flex-col gap-3 bg-q-code-deep/50 p-4 font-sans';

/**
 * Keadaan awal panel hasil: kerangka redup tabel "Hasil Kamu" (judul kolom sungguhan, isi berupa batang kosong) +
 * ajakan menekan tombol — supaya panelnya sudah terbaca sebagai tempat hasil, bukan kotak gelap kosong.
 * Di layar sempit hanya tiga baris kerangka yang tampil supaya guliran tidak memanjang.
 */
export function IdleResult({ columns, rows, caption, children, icon }: { columns: readonly string[]; rows: number; caption?: string; children: ReactNode; icon?: ReactNode }): JSX.Element {
  const widths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-3/5', 'w-2/5'] as const;
  return (
    <div className="m-auto flex w-full flex-col gap-4">
      <div aria-hidden className="overflow-hidden rounded-q border border-dashed border-slate-700 bg-slate-900/30">
        <div className="flex items-center gap-2 border-b border-slate-800/80 px-3 py-2 text-xs font-medium text-slate-500">
          <Table2 className="h-3.5 w-3.5" />
          {caption}
        </div>
        <div className="grid font-mono text-xs" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((column) => (
            <span key={column} className="truncate border-b border-slate-800/80 px-3 py-2 font-semibold text-emerald-300/60">
              {column}
            </span>
          ))}
          {Array.from({ length: rows }, (_, row) =>
            columns.map((column, index) => (
              <span key={`${row}-${column}`} className={cn('items-center px-3 py-[9px]', row >= 3 ? 'hidden lg:flex' : 'flex')}>
                <span className={cn('block h-2 rounded-full bg-slate-700/60', widths[(row * 2 + index) % widths.length])} />
              </span>
            )),
          )}
        </div>
      </div>
      <p className="flex items-center justify-center gap-2.5 text-center text-[13px] leading-relaxed text-q-code-muted">
        {icon !== undefined ? <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">{icon}</span> : null}
        <span>{children}</span>
      </p>
    </div>
  );
}

/** Keadaan awal tanpa kerangka (panel yang tidak menampilkan tabel hasil). */
export function IdleNote({ children, icon }: { children: ReactNode; icon?: ReactNode }): JSX.Element {
  return (
    <div className="m-auto flex max-w-[34ch] flex-col items-center gap-3 px-4 py-4 text-center">
      {icon !== undefined ? <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">{icon}</span> : null}
      <p className="text-[13px] leading-relaxed text-q-code-muted">{children}</p>
    </div>
  );
}

export function RunningNote({ children }: { children: ReactNode }): JSX.Element {
  return (
    <p role="status" className="m-auto flex items-center gap-2.5 text-[13px] text-q-code-ink">
      <LoaderCircle aria-hidden className="h-5 w-5 animate-spin text-emerald-400" />
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Kartu penilaian                                                     */
/* ------------------------------------------------------------------ */

const VERDICT: Record<'correct' | 'wrong', { card: string; icon: string; title: string; Icon: LucideIcon }> = {
  correct: { card: 'border-emerald-500/40 bg-emerald-500/10', icon: 'text-emerald-400', title: 'text-emerald-300', Icon: CircleCheck },
  wrong: { card: 'border-rose-500/40 bg-rose-950/40', icon: 'text-rose-400', title: 'text-rose-300', Icon: CircleX },
};

export interface VerdictProps {
  tone: 'correct' | 'wrong';
  title: string;
  /** Penjelasan di bawah judul. */
  children?: ReactNode;
  /** Isi di kanan (mis. XP). */
  aside?: ReactNode;
  className?: string;
}

/** Kartu hasil penilaian: hijau = benar, merah = belum tepat. */
export function Verdict({ tone, title, children, aside, className }: VerdictProps): JSX.Element {
  const style = VERDICT[tone];
  return (
    <div className={cn('flex items-start gap-3 rounded-q border px-3.5 py-3', style.card, className)}>
      <style.Icon aria-hidden className={cn('mt-px h-5 w-5 shrink-0', style.icon)} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold leading-snug', style.title)}>{title}</p>
        {children !== undefined ? <p className="mt-0.5 text-[13px] leading-relaxed text-slate-200">{children}</p> : null}
      </div>
      {aside}
    </div>
  );
}

/** XP di dalam mockup gelap. */
export function XpChip({ children }: { children: ReactNode }): JSX.Element {
  return <span className="shrink-0 rounded-q-pill bg-amber-400/15 px-2.5 py-1 font-sans text-xs font-bold tabular-nums text-amber-300">{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Tab hasil                                                           */
/* ------------------------------------------------------------------ */

export interface OutputTab<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

export interface OutputTabsProps<T extends string> {
  tabs: readonly OutputTab<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Tab yang diberi titik sorotan (tanpa mengubah pilihan). */
  spotlight?: T;
}

/** Tab Perbedaan / Hasil Kamu / Expected Output seperti di aplikasi (tombol tekan, bukan tablist). */
export function OutputTabs<T extends string>({ tabs, value, onChange, ariaLabel, spotlight }: OutputTabsProps<T>): JSX.Element {
  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-1 rounded-q border border-slate-800 bg-slate-900/70 p-1">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-center text-xs font-medium leading-tight transition-colors duration-150',
              active ? 'bg-slate-800 text-emerald-300' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200',
            )}
          >
            {tab.icon}
            {tab.label}
            {spotlight === tab.id ? <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabel hasil                                                         */
/* ------------------------------------------------------------------ */

export type MockRowStatus = 'same' | 'extra' | 'missing';

export interface MockRow {
  key: string;
  cells: ReadonlyArray<string | number>;
  /** Hanya untuk tampilan Perbedaan. */
  status?: MockRowStatus;
}

const ROW_STATUS: Record<MockRowStatus, { row: string; marker: string; Icon: LucideIcon }> = {
  same: { row: 'text-slate-400', marker: 'text-slate-400', Icon: Check },
  extra: { row: 'bg-rose-500/15 text-slate-100', marker: 'text-rose-300', Icon: Plus },
  missing: { row: 'bg-rose-500/10 italic text-slate-300', marker: 'text-rose-300', Icon: Minus },
};

export interface MockTableProps {
  columns: readonly string[];
  rows: readonly MockRow[];
  /** Judul di atas tabel (mis. "Hasil Kamu"). */
  caption?: string;
  /** Keterangan di kanan judul (mis. "6 baris"); boleh tanpa judul. */
  count?: string;
  /** true = baris muncul bergiliran saat tabel dipasang. */
  animateRows?: boolean;
  /** Label status per baris; bila diisi, tabel menjadi tampilan Perbedaan dengan kolom tanda. */
  statusLabels?: Readonly<Record<MockRowStatus, string>>;
  /** Ubah nilainya untuk menggetarkan baris yang bermasalah (extra/missing). */
  shakeKey?: number | string;
  className?: string;
}

const SHAKE = { duration: 0.45, delay: 0.5, ease: 'easeInOut' } as const;
const CELL = 'whitespace-nowrap border-b border-slate-800/70 px-2 py-1.5 sm:px-3';

/** Tabel hasil query tiruan. Angka berwarna langit seperti di aplikasi. */
export function MockTable({ columns, rows, caption, count, animateRows = false, statusLabels, shakeKey, className }: MockTableProps): JSX.Element {
  return (
    <div className={cn('overflow-hidden rounded-q border border-slate-800 bg-slate-900/40', className)}>
      {caption !== undefined || count !== undefined ? (
        <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-300">
          <Table2 aria-hidden className="h-3.5 w-3.5 text-teal-400" />
          {caption !== undefined ? <span>{caption}</span> : null}
          {count !== undefined ? <span className="ml-auto tabular-nums text-slate-400">{count}</span> : null}
        </div>
      ) : null}
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full border-collapse text-left font-mono text-xs text-slate-200">
          <thead>
            <tr>
              {statusLabels !== undefined ? (
                <th scope="col" className="w-px border-b border-slate-800 bg-slate-900 px-2 py-2 sm:px-3">
                  <span className="sr-only">{PRACTICE.ui.statusColumnLabel}</span>
                </th>
              ) : null}
              {columns.map((column) => (
                <th key={column} scope="col" className="whitespace-nowrap border-b border-slate-800 bg-slate-900 px-2 py-2 sm:px-3 font-semibold text-emerald-300">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <motion.tbody variants={stagger} initial={animateRows ? 'hidden' : false} animate="show">
            {rows.map((row) => {
              const status = statusLabels !== undefined ? (row.status ?? 'same') : undefined;
              const style = status !== undefined ? ROW_STATUS[status] : undefined;
              const shake = (status === 'extra' || status === 'missing') && shakeKey !== undefined;
              return (
                <motion.tr
                  key={shake ? `${row.key}-${shakeKey}` : row.key}
                  // Baris bermasalah bergetar kecil (transform dimatikan otomatis saat reduced motion); baris lain ikut irama induk.
                  {...(shake
                    ? { initial: { opacity: animateRows ? 0 : 1, x: 0 }, animate: { opacity: 1, x: [0, -5, 5, -3, 3, 0] }, transition: SHAKE }
                    : { variants: fadeIn })}
                  className={style?.row}
                >
                  {style !== undefined && status !== undefined && statusLabels !== undefined ? (
                    <td className={cn(CELL, 'font-sans text-[11px] not-italic', style.marker)}>
                      <span className="inline-flex items-center gap-1">
                        <style.Icon aria-hidden className="h-3 w-3" />
                        <span className="sr-only sm:not-sr-only">{statusLabels[status]}</span>
                      </span>
                    </td>
                  ) : null}
                  {row.cells.map((cell, index) => (
                    <td key={index} className={cn(CELL, typeof cell === 'number' ? 'tabular-nums text-sky-300' : '')}>
                      {cell}
                    </td>
                  ))}
                </motion.tr>
              );
            })}
          </motion.tbody>
        </table>
      </div>
    </div>
  );
}

/** Baris ResultTable (content.ts) → baris MockTable. */
export function toMockRows(rows: ReadonlyArray<ReadonlyArray<string | number>>, status?: MockRowStatus): MockRow[] {
  return rows.map((cells) => ({ key: cells.join('|'), cells, status }));
}

/** Chip ringkasan perbedaan ("6 baris sama", "1 baris berlebih"). */
export function DiffChips({ items, ariaLabel }: { items: ReadonlyArray<{ text: string; flagged: boolean }>; ariaLabel: string }): JSX.Element {
  return (
    <ul aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item.text}
          className={cn(
            'rounded-md border px-2 py-0.5 text-[11px] font-medium',
            item.flagged ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-slate-700 bg-slate-800/60 text-slate-300',
          )}
        >
          {item.text}
        </li>
      ))}
    </ul>
  );
}
