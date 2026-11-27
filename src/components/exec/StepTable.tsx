import { useMemo } from 'react';
import type { StepTable as StepTableData } from '../../lib/execSteps';
import { CellContent } from '../ResultTable';

export interface StepTableProps {
  table: StepTableData;
  /** Kolom yang disorot (kolom baru, kunci grup, kolom hasil hitungan, kunci urut). */
  highlight?: readonly number[];
  /** Kolom nomor grup → baris diberi warna berselang per grup. */
  groupColumn?: number | null;
  /** Kolom status HAVING → baris 'dibuang' diredupkan. */
  statusColumn?: number | null;
  /** Nada tabel: 'removed' untuk daftar baris yang dibuang. */
  tone?: 'normal' | 'removed';
  maxHeightClass?: string;
  caption?: string;
}

/** Tabel antara satu langkah eksekusi (maks. DISPLAY_ROWS baris pertama). */
export function StepTable({
  table,
  highlight = [],
  groupColumn = null,
  statusColumn = null,
  tone = 'normal',
  maxHeightClass = 'max-h-80',
  caption,
}: StepTableProps): JSX.Element {
  const marked = useMemo(() => new Set(highlight), [highlight]);
  const numeric = useMemo(
    () => table.columns.map((_, c) => table.rows.some((r) => typeof r[c] === 'number') && table.rows.every((r) => r[c] === null || typeof r[c] === 'number')),
    [table],
  );
  const hidden = table.total - table.rows.length;

  if (table.columns.length === 0) {
    return <p className="rounded-lg border border-slate-800 px-4 py-6 text-center text-sm text-slate-500">Tidak ada kolom.</p>;
  }

  return (
    <div className={`overflow-hidden rounded-lg border ${tone === 'removed' ? 'border-rose-500/30' : 'border-slate-800'} bg-slate-900/40`}>
      {caption ? <p className="border-b border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-400">{caption}</p> : null}
      <div className={`scrollbar-thin overflow-auto ${maxHeightClass}`}>
        <table className="w-full border-separate border-spacing-0 text-left font-mono text-[12px]">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 top-0 z-20 w-9 border-b border-r border-slate-800 bg-slate-900 px-2 py-1.5 text-right text-[10.5px] font-medium text-slate-600">
                #
              </th>
              {table.columns.map((column, c) => (
                <th
                  key={`${c}-${column}`}
                  scope="col"
                  className={`sticky top-0 z-10 whitespace-nowrap border-b px-2.5 py-1.5 font-semibold ${numeric[c] ? 'text-right' : ''} ${
                    // Tema terang: emerald-950 padat = mint neon; kepala sticky butuh latar padat, jadi penandanya garis
                    // bawah hijau tebal + teks hijau (sel kolomnya tetap bertint).
                    marked.has(c)
                      ? 'border-emerald-500/50 bg-emerald-950 text-emerald-200 light:border-b-2 light:border-emerald-500 light:bg-slate-900'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => {
              const group = groupColumn === null ? null : Number(row[groupColumn] ?? 0);
              const dropped = statusColumn !== null && row[statusColumn] === 'dibuang';
              let rowClass = 'odd:bg-slate-900/30';
              if (group !== null) rowClass = group % 2 === 0 ? 'bg-fuchsia-500/[0.07]' : 'bg-slate-900/20';
              if (tone === 'removed' || dropped) rowClass = 'bg-rose-500/[0.06] text-slate-500';
              const groupStart = group !== null && r > 0 && Number(table.rows[r - 1]?.[groupColumn ?? 0] ?? 0) !== group;
              return (
                <tr key={r} className={rowClass}>
                  <td
                    className={`sticky left-0 z-[5] border-b border-r border-slate-800/70 bg-slate-900 px-2 py-1 text-right text-[10.5px] tabular-nums text-slate-600 ${
                      groupStart ? 'border-t border-t-fuchsia-500/40' : ''
                    }`}
                  >
                    {r + 1}
                  </td>
                  {table.columns.map((_, c) => {
                    const value = row[c];
                    const status = c === statusColumn;
                    let cellClass = tone === 'removed' || dropped ? 'text-slate-500' : 'text-slate-200';
                    if (status) cellClass = value === 'lolos' ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300';
                    return (
                      <td
                        key={c}
                        title={typeof value === 'string' && value.length > 32 ? value : undefined}
                        className={`max-w-[18rem] truncate whitespace-nowrap border-b border-slate-800/70 px-2.5 py-1 ${numeric[c] ? 'text-right tabular-nums' : ''} ${
                          marked.has(c) && !status ? 'bg-emerald-500/[0.08]' : ''
                        } ${groupStart ? 'border-t border-t-fuchsia-500/40' : ''} ${cellClass}`}
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
        {table.rows.length === 0 ? <p className="px-4 py-5 text-center text-sm text-slate-500">Tidak ada baris.</p> : null}
      </div>
      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/70 px-3 py-1 text-[10.5px] text-slate-500">
        <span className="tabular-nums">
          {table.totalCapped ? '≥' : ''}
          {table.total.toLocaleString('id-ID')} baris
          {hidden > 0 ? ` · ${table.rows.length} pertama ditampilkan` : ''}
        </span>
        <span className="tabular-nums">{table.columns.length} kolom</span>
      </div>
    </div>
  );
}
