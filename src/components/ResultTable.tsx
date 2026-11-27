import { useEffect, useMemo, useRef } from 'react';
import { Table2 } from 'lucide-react';
import type { CellValue, QueryResult } from '../types';

export interface ResultTableProps {
  result: QueryResult;
  highlightCell?: { row: number; column: number } | null;
  highlightRow?: number | null;
  maxHeightClass?: string;
  caption?: string;
}

function isNumericColumn(rows: CellValue[][], column: number): boolean {
  let sawNumber = false;
  for (const row of rows) {
    const cell = row[column];
    if (cell === null || cell === undefined) continue;
    if (typeof cell !== 'number') return false;
    sawNumber = true;
  }
  return sawNumber;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  // Hindari ekor floating point panjang seperti 0.30000000000000004.
  return String(Number(value.toFixed(6)));
}

export function CellContent({ value }: { value: CellValue | undefined }): JSX.Element {
  if (value === null || value === undefined) {
    // Tema terang: slate-600 di atas sel yang disorot (tint amber/rose) jatuh di bawah AA — pakai slate-500.
    return <span className="italic text-slate-600 light:text-slate-500">NULL</span>;
  }
  if (value instanceof Uint8Array) {
    return <span className="italic text-slate-500">{`<BLOB ${value.length} bytes>`}</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-sky-300">{formatNumber(value)}</span>;
  }
  return <>{value}</>;
}

function cellTitle(value: CellValue | undefined): string | undefined {
  if (typeof value === 'string' && value.length > 40) return value;
  return undefined;
}

export function ResultTable({
  result,
  highlightCell = null,
  highlightRow = null,
  maxHeightClass = 'max-h-80',
  caption,
}: ResultTableProps): JSX.Element {
  const { columns, rows } = result;
  const highlightRef = useRef<HTMLTableCellElement | null>(null);

  const numericColumns = useMemo(() => columns.map((_, index) => isNumericColumn(rows, index)), [columns, rows]);

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [highlightCell?.row, highlightCell?.column, result]);

  const header = caption ? (
    <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-300">
      <Table2 className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
      <span>{caption}</span>
    </div>
  ) : null;

  if (columns.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
        {header}
        <p className="px-4 py-6 text-center text-sm text-slate-500">
          Query berhasil, tetapi tidak ada baris yang dikembalikan
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
      {header}
      <div className={`scrollbar-thin overflow-auto ${maxHeightClass}`}>
        <table className="w-full border-separate border-spacing-0 text-left font-mono text-[12.5px]">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-20 w-10 border-b border-r border-slate-800 bg-slate-900 px-2 py-2 text-right text-[11px] font-medium text-slate-600"
              >
                #
              </th>
              {columns.map((column, index) => (
                <th
                  key={`${index}-${column}`}
                  scope="col"
                  className={`sticky top-0 z-10 whitespace-nowrap border-b border-slate-800 px-3 py-2 font-semibold ${
                    numericColumns[index] ? 'text-right' : ''
                  } ${highlightCell?.column === index ? 'bg-rose-950 text-rose-300' : 'bg-slate-900 text-emerald-300'}`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const rowHighlighted = highlightRow === rowIndex || highlightCell?.row === rowIndex;
              return (
                <tr
                  key={rowIndex}
                  className={rowHighlighted ? 'bg-rose-500/10' : 'odd:bg-slate-900/30 hover:bg-slate-800/40'}
                >
                  <td className="sticky left-0 z-[5] border-b border-r border-slate-800/70 bg-slate-900 px-2 py-1.5 text-right text-[11px] tabular-nums text-slate-600">
                    {rowIndex + 1}
                  </td>
                  {columns.map((_, columnIndex) => {
                    const value = row[columnIndex];
                    const isTarget = highlightCell?.row === rowIndex && highlightCell.column === columnIndex;
                    return (
                      <td
                        key={columnIndex}
                        ref={isTarget ? highlightRef : undefined}
                        title={cellTitle(value)}
                        className={`max-w-[24rem] truncate whitespace-nowrap border-b border-slate-800/70 px-3 py-1.5 text-slate-200 ${
                          numericColumns[columnIndex] ? 'text-right tabular-nums' : ''
                        } ${isTarget ? 'bg-rose-500/25 ring-1 ring-inset ring-rose-400 light:bg-rose-950' : ''}`}
                      >
                        <CellContent value={value} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            Query berhasil, tetapi tidak ada baris yang dikembalikan
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/70 px-3 py-1.5 text-[11px] text-slate-500">
        <span className="tabular-nums">{rows.length} baris</span>
        <span className="tabular-nums">{columns.length} kolom</span>
      </div>
    </div>
  );
}
