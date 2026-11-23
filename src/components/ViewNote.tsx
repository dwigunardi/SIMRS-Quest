import { Gauge, Info } from 'lucide-react';

/**
 * Catatan tambahan dari validator (CheckView.note). Baris yang berisi detail query plan
 * (SCAN / SEARCH) ditampilkan sebagai blok monospace dengan sorotan:
 * SCAN = rose (membaca seluruh tabel), SEARCH / USING INDEX = emerald (memakai index).
 */

/** Baris detail query plan: diawali kata kunci plan SQLite (boleh didahului indentasi / cabang pohon "|--"). */
const PLAN_LINE =
  /^\s*(?:[|`]--\s*)?(?:SCAN|SEARCH|USE TEMP B-TREE|CO-ROUTINE|MATERIALIZE|COMPOUND QUERY|(?:CORRELATED )?SCALAR SUBQUERY|LIST SUBQUERY|MULTI-INDEX OR|UNION ALL|LEFT-MOST SUBQUERY|BLOOM FILTER)\b/;
/** Judul seperti "Query plan (EXPLAIN QUERY PLAN):" sudah diwakili header kartu. */
const REDUNDANT_HEADING = /^\s*query plan\b[^:]*:\s*$/i;
/** Catatan validator yang sudah memuat penjelasan "SCAN = …" tidak perlu legenda tambahan. */
const LEGEND_IN_NOTE = /\bSCAN\s*=/;
const PLAN_TOKEN = /(\bSCAN\b|\bSEARCH\b|\bUSING (?:COVERING )?INDEX \S+|\bUSING (?:INTEGER )?PRIMARY KEY\b)/g;

type NoteBlock = { type: 'text'; lines: string[] } | { type: 'plan'; lines: string[] };

function groupLines(note: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  for (const line of note.split(/\r?\n/)) {
    if (REDUNDANT_HEADING.test(line)) continue;
    const type: NoteBlock['type'] = PLAN_LINE.test(line) ? 'plan' : 'text';
    const last = blocks[blocks.length - 1];
    if (last && last.type === type) {
      last.lines.push(line);
      continue;
    }
    blocks.push({ type, lines: [line] });
  }
  return blocks
    .map((block) => ({ ...block, lines: trimBlankEdges(block.lines) }))
    .filter((block) => block.lines.length > 0);
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && (lines[start] ?? '').trim() === '') start += 1;
  while (end > start && (lines[end - 1] ?? '').trim() === '') end -= 1;
  return lines.slice(start, end);
}

function tokenClass(token: string): string | null {
  if (token === 'SCAN') return 'rounded bg-rose-500/20 px-1 font-semibold text-rose-300';
  if (token === 'SEARCH' || token.startsWith('USING')) return 'rounded bg-emerald-500/15 px-1 font-semibold text-emerald-300';
  return null;
}

export function PlanLine({ line }: { line: string }) {
  const parts = line.split(PLAN_TOKEN);
  return (
    <span className="block">
      {parts.map((part, index) => {
        const cls = tokenClass(part);
        return cls ? (
          <span key={index} className={cls}>
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </span>
  );
}

export function ViewNote({ note }: { note: string }) {
  const blocks = groupLines(note);
  if (blocks.length === 0) return null;
  const hasPlan = blocks.some((block) => block.type === 'plan');
  const showLegend = hasPlan && !LEGEND_IN_NOTE.test(note);
  const Icon = hasPlan ? Gauge : Info;

  return (
    <div className="space-y-2 rounded-lg border border-sky-500/25 bg-sky-950/20 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-300">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {hasPlan ? 'Query plan (EXPLAIN QUERY PLAN)' : 'Catatan penilaian'}
      </p>
      {blocks.map((block, index) =>
        block.type === 'plan' ? (
          <pre
            key={index}
            className="scrollbar-thin overflow-x-auto rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 font-mono text-xs leading-relaxed text-slate-300"
          >
            {block.lines.map((line, lineIndex) => (
              <PlanLine key={lineIndex} line={line} />
            ))}
          </pre>
        ) : (
          <p key={index} className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
            {block.lines.join('\n')}
          </p>
        ),
      )}
      {showLegend ? (
        <p className="text-[11px] leading-relaxed text-slate-500">
          <span className="font-semibold text-rose-300">SCAN</span> = membaca seluruh tabel baris demi baris ·{' '}
          <span className="font-semibold text-emerald-300">SEARCH … USING INDEX</span> = langsung melompat ke baris yang cocok lewat index.
        </p>
      ) : null}
    </div>
  );
}
