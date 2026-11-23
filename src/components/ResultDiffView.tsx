import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpDown, Check, Minus, Plus, X } from 'lucide-react';
import { diffResults, type DiffColumn, type DiffRow, type DiffRowStatus, type ResultDiff } from '../lib/resultDiff';
import type { CellValue, QueryResult } from '../types';
import { CellContent } from './ResultTable';

export interface ResultDiffViewProps {
  expected: QueryResult;
  actual: QueryResult;
  orderMatters: boolean;
  actualLabel?: string;
  expectedLabel?: string;
}

/** Di atas jumlah baris "sama" ini, baris yang sama disembunyikan secara default. */
const HIDE_SAME_THRESHOLD = 8;

const ROW_STYLE: Record<DiffRowStatus, { row: string; marker: string; label: string; Icon: typeof Check }> = {
  same: { row: 'text-slate-500', marker: 'text-slate-600', label: 'sama', Icon: Check },
  changed: { row: 'bg-amber-500/10 text-slate-200', marker: 'text-amber-300', label: 'nilai berbeda', Icon: X },
  moved: { row: 'bg-violet-500/10 text-slate-200', marker: 'text-violet-300', label: 'urutan salah', Icon: ArrowUpDown },
  extra: { row: 'bg-sky-500/10 text-slate-200', marker: 'text-sky-300', label: 'berlebih', Icon: Plus },
  missing: { row: 'bg-rose-500/10 text-slate-300', marker: 'text-rose-300', label: 'kurang', Icon: Minus },
};

const CHIP_STYLE: Record<DiffRowStatus, string> = {
  same: 'border-slate-700 bg-slate-800/60 text-slate-300',
  changed: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  moved: 'border-violet-500/40 bg-violet-500/10 text-violet-200',
  extra: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  missing: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
};

const CHIP_TEXT: Record<DiffRowStatus, (n: number) => string> = {
  same: (n) => `${n} baris sama`,
  changed: (n) => `${n} baris nilainya berbeda`,
  moved: (n) => `${n} baris urutannya salah`,
  extra: (n) => `${n} baris berlebih`,
  missing: (n) => `${n} baris kurang`,
};

const CHIP_ORDER: readonly DiffRowStatus[] = ['changed', 'missing', 'extra', 'moved', 'same'];

function columnNotes(columns: readonly DiffColumn[]): string[] {
  const notes: string[] = [];
  for (const c of columns) {
    if (c.status === 'renamed') notes.push(`Kolom ke-${(c.expectedIndex ?? 0) + 1} bernama "${c.actualName ?? ''}", seharusnya "${c.name}".`);
    if (c.status === 'reordered') {
      notes.push(`Kolom "${c.name}" ada di posisi ke-${(c.actualIndex ?? 0) + 1}, seharusnya ke-${(c.expectedIndex ?? 0) + 1} (urutan kolom di SELECT).`);
    }
    if (c.status === 'missing') notes.push(`Kolom "${c.name}" tidak ada di hasil kamu.`);
    if (c.status === 'extra') notes.push(`Kolom "${c.name}" tidak diminta (berlebih).`);
  }
  return notes;
}

function Summary({ diff }: { diff: ResultDiff }): JSX.Element {
  const notes = columnNotes(diff.columns);
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-1.5" aria-label="Ringkasan perbedaan">
        {CHIP_ORDER.filter((status) => diff.counts[status] > 0).map((status) => (
          <li key={status} className={`rounded border px-2 py-0.5 text-[11px] font-medium ${CHIP_STYLE[status]}`}>
            {CHIP_TEXT[status](diff.counts[status])}
          </li>
        ))}
      </ul>
      {notes.length > 0 ? (
        <ul className="space-y-1 text-xs text-amber-200">
          {notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const HEADER_STYLE: Record<DiffColumn['status'], string> = {
  same: 'text-emerald-300',
  reordered: 'text-violet-300',
  renamed: 'text-amber-300',
  extra: 'text-sky-300',
  missing: 'text-rose-300',
};

function HeaderCell({ column }: { column: DiffColumn }): JSX.Element {
  let sub: ReactNode = null;
  if (column.status === 'renamed') sub = <span className="block text-[10px] font-normal text-amber-400/80">kamu: {column.actualName}</span>;
  if (column.status === 'reordered') {
    sub = <span className="block text-[10px] font-normal text-violet-400/80">kamu: kolom ke-{(column.actualIndex ?? 0) + 1}</span>;
  }
  if (column.status === 'extra') sub = <span className="block text-[10px] font-normal text-sky-400/80">berlebih</span>;
  if (column.status === 'missing') sub = <span className="block text-[10px] font-normal text-rose-400/80">tidak ada</span>;
  return (
    <th scope="col" className={`sticky top-0 z-10 whitespace-nowrap border-b border-slate-800 bg-slate-900 px-3 py-2 font-semibold ${HEADER_STYLE[column.status]}`}>
      {column.name}
      {sub}
    </th>
  );
}

function ValueCell({ row, index, column }: { row: DiffRow; index: number; column: DiffColumn }): JSX.Element {
  const value = row.cells[index];
  const absent = value === undefined && (column.status === 'missing' || (row.status === 'missing' && column.status === 'extra'));
  if (absent) {
    return <td className="whitespace-nowrap border-b border-slate-800/70 px-3 py-1.5 text-slate-700">—</td>;
  }
  if (row.changedColumns.includes(index)) {
    const expectedValue: CellValue | undefined = row.expectedCells[index];
    return (
      <td className="whitespace-nowrap border-b border-slate-800/70 bg-amber-500/15 px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-rose-300 line-through decoration-rose-400/70">
            <CellContent value={value} />
          </span>
          <ArrowRight className="h-3 w-3 shrink-0 text-slate-500" aria-label="seharusnya" />
          <span className="font-semibold text-emerald-300">
            <CellContent value={expectedValue} />
          </span>
        </span>
      </td>
    );
  }
  return (
    <td className={`max-w-[20rem] truncate whitespace-nowrap border-b border-slate-800/70 px-3 py-1.5 ${row.status === 'missing' ? 'italic' : ''}`}>
      <CellContent value={value} />
    </td>
  );
}

function MarkerCell({ row }: { row: DiffRow }): JSX.Element {
  const style = ROW_STYLE[row.status];
  const Icon = style.Icon;
  const position = row.actualIndex === null ? '—' : String(row.actualIndex + 1);
  const movedHint = row.status === 'moved' && row.expectedIndex !== null ? ` · harusnya ke-${row.expectedIndex + 1}` : '';
  return (
    <td className={`sticky left-0 z-[5] whitespace-nowrap border-b border-r border-slate-800/70 bg-slate-900 px-2 py-1.5 text-[11px] ${style.marker}`}>
      <span className="inline-flex items-center gap-1" title={`${style.label}${movedHint}`}>
        <Icon className="h-3 w-3" aria-hidden="true" />
        <span className="tabular-nums">{position}</span>
        <span className="sr-only">{style.label}</span>
        {movedHint ? <span className="text-[10px] text-violet-300/80">{movedHint.replace(' · ', '')}</span> : null}
      </span>
    </td>
  );
}

function Legend(): JSX.Element {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500" aria-label="Arti tanda">
      {(['changed', 'missing', 'extra', 'moved', 'same'] as const).map((status) => {
        const { Icon, marker, label } = ROW_STYLE[status];
        return (
          <li key={status} className="inline-flex items-center gap-1">
            <Icon className={`h-3 w-3 ${marker}`} aria-hidden="true" />
            {label}
          </li>
        );
      })}
      <li className="inline-flex items-center gap-1">
        <span className="text-rose-300 line-through">a</span>
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
        <span className="text-emerald-300">b</span>
        = nilai kamu → seharusnya
      </li>
    </ul>
  );
}

/**
 * Tab "Perbedaan": satu tabel yang menandai sel berbeda (nilai kamu → seharusnya), baris berlebih,
 * baris yang kurang, urutan yang salah, dan kolom yang salah nama/berlebih/kurang.
 */
export function ResultDiffView({ expected, actual, orderMatters, actualLabel = 'Hasil Kamu', expectedLabel = 'Expected Output' }: ResultDiffViewProps): JSX.Element {
  const diff = useMemo(() => diffResults(expected, actual, orderMatters), [expected, actual, orderMatters]);
  const [hideSame, setHideSame] = useState(diff.counts.same > HIDE_SAME_THRESHOLD);
  const presentRows = diff.rows.filter((r) => r.status !== 'missing' && !(hideSame && r.status === 'same'));
  const missingRows = diff.rows.filter((r) => r.status === 'missing');
  const hiddenCount = hideSame ? diff.counts.same : 0;
  const span = diff.columns.length + 1;

  if (diff.identical) {
    return (
      <p className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-400">
        Isi tabel {actualLabel} dan {expectedLabel} sama persis. Perbedaannya ada di bagian lain — baca pesan di atas.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <Summary diff={diff} />
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-400">
          <span className="font-medium text-slate-300">
            {actualLabel} dibandingkan dengan {expectedLabel}
          </span>
          {diff.counts.same > 0 ? (
            <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={hideSame} onChange={(e) => setHideSame(e.target.checked)} className="accent-emerald-500" />
              Sembunyikan baris yang sudah sama
            </label>
          ) : null}
        </div>
        <div className="scrollbar-thin max-h-96 overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-left font-mono text-[12.5px]">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 top-0 z-20 border-b border-r border-slate-800 bg-slate-900 px-2 py-2 text-[11px] font-medium text-slate-600">
                  #
                </th>
                {diff.columns.map((column, i) => (
                  <HeaderCell key={`${i}-${column.name}`} column={column} />
                ))}
              </tr>
            </thead>
            <tbody>
              {presentRows.map((row) => (
                <tr key={`a${row.actualIndex ?? -1}`} className={ROW_STYLE[row.status].row}>
                  <MarkerCell row={row} />
                  {diff.columns.map((column, i) => (
                    <ValueCell key={i} row={row} index={i} column={column} />
                  ))}
                </tr>
              ))}
              {hiddenCount > 0 ? (
                <tr>
                  <td colSpan={span} className="border-b border-slate-800/70 px-3 py-1.5 text-center text-[11px] text-slate-600">
                    … {hiddenCount} baris yang sudah sama disembunyikan
                  </td>
                </tr>
              ) : null}
              {missingRows.length > 0 ? (
                <tr>
                  <td colSpan={span} className="border-b border-rose-500/30 bg-rose-950/40 px-3 py-1.5 text-[11px] font-semibold text-rose-200">
                    Baris yang seharusnya ada, tetapi tidak muncul di hasil kamu:
                  </td>
                </tr>
              ) : null}
              {missingRows.map((row) => (
                <tr key={`e${row.expectedIndex ?? -1}`} className={ROW_STYLE.missing.row}>
                  <MarkerCell row={row} />
                  {diff.columns.map((column, i) => (
                    <ValueCell key={i} row={row} index={i} column={column} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Legend />
    </div>
  );
}
