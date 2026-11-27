import { useState } from 'react';
import type { Database } from 'sql.js';
import { CircleAlert, DatabaseZap, Footprints, Languages, Play, SquareTerminal, X } from 'lucide-react';
import { executeReadOnly, stripCommentsAndStrings } from '../../lib/sqlEngine';
import type { Article, ArticleExample, ExecOutcome, SqlDialect } from '../../types';
import { HighlightedCode } from '../HighlightedCode';
import { ResultTable } from '../ResultTable';
import { RichText, renderInline } from '../workspaces/RichText';

export interface ExampleActions {
  /** Muat SQL contoh ke editor Playground dan pindah ke mode Playground. */
  onOpenInPlayground: (sql: string) => void;
  /** Muat SQL contoh ke Playground dan langsung tampilkan Urutan Eksekusi-nya. */
  onVisualize: (sql: string) => void;
}

export interface ArticleViewProps extends ExampleActions {
  article: Article;
  /** DB seed (hanya dibaca) untuk menjalankan contoh di tempat. */
  db: Database | null;
}

export const DIALECT_LABEL: Record<SqlDialect, string> = {
  sqlite: 'SQLite (aplikasi ini)',
  sqlServer: 'SQL Server',
  mysql: 'MySQL / MariaDB',
  postgresql: 'PostgreSQL',
  oracle: 'Oracle',
};
const DIALECTS: readonly SqlDialect[] = ['sqlite', 'sqlServer', 'mysql', 'postgresql', 'oracle'];

const ACTION_BUTTON =
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 light:disabled:border-slate-700 light:disabled:bg-slate-900 light:disabled:text-slate-500 light:disabled:opacity-100';

function ExampleBlock({ example, db, onOpenInPlayground, onVisualize }: { example: ArticleExample; db: Database | null } & ExampleActions) {
  const [outcome, setOutcome] = useState<ExecOutcome | null>(null);
  const run = () => {
    if (!db) return;
    setOutcome(executeReadOnly(db, example.sql));
  };
  const result = outcome?.ok ? outcome.results[outcome.results.length - 1] : undefined;
  if (example.run === 'playground') return <PlaygroundExampleBlock example={example} onOpenInPlayground={onOpenInPlayground} />;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 bg-slate-900/70 px-2.5 py-1.5">
        <span className="mr-auto text-[11px] font-semibold text-slate-300">{example.title}</span>
        <button type="button" onClick={run} disabled={!db} className={`${ACTION_BUTTON} border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/15`}>
          <Play className="h-3 w-3 fill-current" aria-hidden />
          Jalankan
        </button>
        {/^\s*EXPLAIN\b/i.test(stripCommentsAndStrings(example.sql)) ? null : (
          <button
            type="button"
            onClick={() => onVisualize(example.sql)}
            className={`${ACTION_BUTTON} border-slate-700 text-slate-300 hover:bg-slate-800`}
            title="Buka di Playground dan tampilkan urutan eksekusinya"
          >
            <Footprints className="h-3 w-3" aria-hidden />
            Urutan Eksekusi
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenInPlayground(example.sql)}
          className={`${ACTION_BUTTON} border-slate-700 text-slate-300 hover:bg-slate-800`}
          title="Salin ke editor Playground untuk diutak-atik"
        >
          <SquareTerminal className="h-3 w-3" aria-hidden />
          Playground
        </button>
      </div>
      <HighlightedCode code={example.sql} className="px-3 py-2 text-[12px]" />
      {example.note ? <p className="border-t border-slate-800/80 px-3 py-2 text-xs leading-relaxed text-slate-400">{renderInline(example.note)}</p> : null}
      {outcome ? (
        <div className="space-y-1 border-t border-slate-800 p-2">
          <div className="flex items-center justify-between text-[10.5px] text-slate-500">
            <span>Hasil (database awal)</span>
            <button type="button" onClick={() => setOutcome(null)} className="rounded p-0.5 hover:bg-slate-800 hover:text-slate-300" aria-label="Tutup hasil">
              <X className="h-3 w-3" aria-hidden />
            </button>
          </div>
          {result ? <ResultTable result={result} maxHeightClass="max-h-60" /> : null}
          {outcome.ok ? null : <p className="text-xs text-rose-300">{outcome.friendlyError}</p>}
        </div>
      ) : null}
    </div>
  );
}

/** Contoh yang mengubah data: tidak dijalankan di tempat (database awal dijaga tetap bersih), hanya dibuka di Playground. */
function PlaygroundExampleBlock({ example, onOpenInPlayground }: { example: ArticleExample; onOpenInPlayground: (sql: string) => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-amber-500/30 bg-slate-950">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 bg-slate-900/70 px-2.5 py-1.5">
        <span className="mr-auto text-[11px] font-semibold text-slate-300">{example.title}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
          <DatabaseZap className="h-3 w-3" aria-hidden />
          Mengubah data
        </span>
        <button
          type="button"
          onClick={() => onOpenInPlayground(example.sql)}
          className={`${ACTION_BUTTON} border-amber-500/40 text-amber-100 hover:bg-amber-500/15`}
          title="Buka di Playground — perubahan bisa dikembalikan dengan Reset Database"
        >
          <SquareTerminal className="h-3 w-3" aria-hidden />
          Coba di Playground
        </button>
      </div>
      <HighlightedCode code={example.sql} className="px-3 py-2 text-[12px]" />
      {example.note ? <p className="border-t border-slate-800/80 px-3 py-2 text-xs leading-relaxed text-slate-400">{renderInline(example.note)}</p> : null}
      <p className="border-t border-slate-800/80 px-3 py-1.5 text-[10.5px] text-slate-500">
        Contoh ini mengubah isi tabel, jadi tidak dijalankan di sini. Di Playground, klik Run lalu cek hasilnya; Reset Database
        mengembalikan data awal.
      </p>
    </div>
  );
}

function DialectBox({ article }: { article: Article }) {
  return (
    <section className="rounded-xl border border-sky-500/25 bg-sky-500/[0.04] p-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-300">
        <Languages className="h-3.5 w-3.5" aria-hidden />
        Beda dialek
      </h4>
      <div className="space-y-3">
        {article.dialects.map((note) => (
          <div key={note.label}>
            <p className="mb-1 text-xs font-semibold text-slate-200">{note.label}</p>
            <dl className="divide-y divide-slate-800/80 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
              {DIALECTS.map((dialect) => (
                <div key={dialect} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 px-2 py-1 text-[11.5px]">
                  <dt className={dialect === 'sqlite' ? 'font-semibold text-emerald-300' : 'text-slate-400'}>{DIALECT_LABEL[dialect]}</dt>
                  <dd className="break-words font-mono text-slate-200">{note.syntax[dialect]}</dd>
                </div>
              ))}
            </dl>
            {note.note ? <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{renderInline(note.note)}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Isi satu artikel materi: bagian + contoh interaktif, jebakan umum, dan beda dialek. */
export function ArticleView({ article, db, onOpenInPlayground, onVisualize }: ArticleViewProps): JSX.Element {
  return (
    <article className="space-y-4" aria-label={`Materi: ${article.title}`}>
      <header className="space-y-1">
        <h3 data-article-heading tabIndex={-1} className="text-lg font-bold tracking-tight text-slate-50 outline-none">
          {article.title}
        </h3>
        <p className="text-sm leading-relaxed text-slate-400">{article.summary}</p>
      </header>

      {article.sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h4 className="text-sm font-semibold text-emerald-300">{section.heading}</h4>
          <div className="space-y-2 text-sm leading-relaxed text-slate-300">
            <RichText text={section.body} />
          </div>
          {(section.examples ?? []).map((example) => (
            <ExampleBlock key={example.title} example={example} db={db} onOpenInPlayground={onOpenInPlayground} onVisualize={onVisualize} />
          ))}
        </section>
      ))}

      <section className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3">
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300">
          <CircleAlert className="h-3.5 w-3.5" aria-hidden />
          Jebakan umum
        </h4>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-300">
          {article.pitfalls.map((pitfall) => (
            <li key={pitfall}>{renderInline(pitfall)}</li>
          ))}
        </ul>
      </section>

      <DialectBox article={article} />
    </article>
  );
}
