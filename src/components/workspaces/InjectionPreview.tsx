import { useMemo } from 'react';
import { Lock, ServerCog } from 'lucide-react';
import { tokenizeSql, type SqlTokenType } from '../../lib/sqlHighlight';
import { HighlightedCode, TOKEN_CLASS } from '../HighlightedCode';
import type { InjectionLab } from '../../types';

const INPUT_MARKER = '{input}';

interface PreviewPiece {
  text: string;
  type: SqlTokenType;
  /** true jika potongan teks ini berasal dari input user. */
  injected: boolean;
}

interface Range {
  start: number;
  end: number;
}

/**
 * Gabungkan template dengan input persis seperti server yang rentan (string concatenation),
 * sekaligus catat posisi setiap potongan input di SQL hasil gabungan.
 * Memakai split/join (bukan String.replace) agar karakter `$` di input tidak ditafsirkan khusus.
 */
function buildWithRanges(template: string, input: string): { sql: string; ranges: Range[] } {
  const parts = template.split(INPUT_MARKER);
  const ranges: Range[] = [];
  let sql = '';
  parts.forEach((part, index) => {
    sql += part;
    if (index === parts.length - 1) return;
    ranges.push({ start: sql.length, end: sql.length + input.length });
    sql += input;
  });
  return { sql, ranges };
}

function isInjectedAt(position: number, ranges: Range[]): boolean {
  return ranges.some((range) => position >= range.start && position < range.end);
}

/** Batas potongan di dalam [start, end): awal/akhir setiap range input yang jatuh di tengah token. */
function cutPoints(start: number, end: number, ranges: Range[]): number[] {
  const points = new Set<number>([start, end]);
  for (const range of ranges) {
    if (range.start > start && range.start < end) points.add(range.start);
    if (range.end > start && range.end < end) points.add(range.end);
  }
  return [...points].sort((a, b) => a - b);
}

/**
 * Tokenisasi SQL UTUH (agar terlihat bagaimana payload mengubah struktur query — mis. string
 * yang tertutup lebih awal), lalu pecah token di batas input untuk diberi latar violet.
 */
function buildPieces(sql: string, ranges: Range[]): PreviewPiece[] {
  const pieces: PreviewPiece[] = [];
  let offset = 0;
  for (const token of tokenizeSql(sql)) {
    const tokenEnd = offset + token.text.length;
    const points = cutPoints(offset, tokenEnd, ranges);
    for (let i = 0; i < points.length - 1; i += 1) {
      const from = points[i] ?? offset;
      const to = points[i + 1] ?? tokenEnd;
      pieces.push({ text: sql.slice(from, to), type: token.type, injected: isInjectedAt(from, ranges) });
    }
    offset = tokenEnd;
  }
  return pieces;
}

function VulnerablePreview({ template, input }: { template: string; input: string }) {
  const pieces = useMemo(() => {
    const { sql, ranges } = buildWithRanges(template, input);
    return buildPieces(sql, ranges);
  }, [template, input]);

  return (
    <pre className="scrollbar-thin overflow-x-auto whitespace-pre-wrap break-all p-4 font-mono text-[13px] leading-relaxed">
      <code>
        {pieces.map((piece, index) => (
          <span
            key={index}
            className={`${TOKEN_CLASS[piece.type]} ${piece.injected ? 'rounded-sm bg-violet-500/30 ring-1 ring-violet-400/50' : ''}`}
          >
            {piece.text}
          </span>
        ))}
      </code>
    </pre>
  );
}

function SafePreview({ template, input }: { template: string; input: string }) {
  return (
    <div>
      <HighlightedCode code={template} />
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 px-4 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Parameter ?1 =
        </span>
        <code className="max-w-full break-all rounded bg-violet-500/20 px-1.5 py-0.5 font-mono text-violet-200 ring-1 ring-violet-400/40">
          {input === '' ? '(kosong)' : input}
        </code>
        <span className="text-slate-500">dikirim terpisah sebagai DATA — tidak pernah digabung ke teks SQL.</span>
      </div>
    </div>
  );
}

export interface InjectionPreviewProps {
  lab: InjectionLab;
  input: string;
  safeMode: boolean;
}

/** Pratinjau langsung SQL yang dibentuk server dari input form. */
export function InjectionPreview({ lab, input, safeMode }: InjectionPreviewProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/70 px-3 py-2 text-xs">
        <ServerCog className="h-3.5 w-3.5 text-violet-400" aria-hidden />
        <span className="font-medium text-slate-300">SQL yang dibentuk server</span>
        <span className="text-slate-500">· diperbarui saat kamu mengetik</span>
        <span
          className={`ml-auto rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider ${
            safeMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
          }`}
        >
          {safeMode ? 'Prepared statement' : 'String concatenation'}
        </span>
      </div>
      {safeMode ? <SafePreview template={lab.safeTemplate} input={input} /> : <VulnerablePreview template={lab.vulnerableTemplate} input={input} />}
      {safeMode ? null : (
        <p className="border-t border-slate-800 px-4 py-2 text-[11px] text-slate-500">
          <span className="rounded-sm bg-violet-500/30 px-1 text-violet-200 ring-1 ring-violet-400/50">Latar violet</span> = teks yang
          berasal dari input form. Perhatikan warna token di sekitarnya: jika input berhasil keluar dari tanda kutip, bagian itu
          berubah menjadi kode SQL.
        </p>
      )}
    </section>
  );
}
