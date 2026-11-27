import { useMemo, useState } from 'react';
import { Check, Library, Search, X } from 'lucide-react';
import { ARTICLES } from '../../data/materi';
import { TIERS } from '../../data/missions';
import { searchArticles } from '../../lib/materiSearch';
import type { Article } from '../../types';

export interface ReferenceSidebarProps {
  activeId: string | null;
  onSelect: (articleId: string) => void;
  read: ReadonlySet<string>;
}

const GROUPS: ReadonlyArray<{ label: string; match: (a: Article) => boolean }> = [
  { label: 'Umum', match: (a) => a.id === 'urutan-eksekusi' },
  ...TIERS.map(({ tier }) => ({ label: `Tier ${tier}`, match: (a: Article) => a.tier === tier && a.id !== 'urutan-eksekusi' })),
];

function ArticleRow({ article, active, read, snippet, onSelect }: { article: Article; active: boolean; read: boolean; snippet?: string | null; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'page' : undefined}
        className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-800/60 ${active ? 'bg-slate-800 ring-1 ring-emerald-500/40' : ''}`}
      >
        {read ? (
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label="sudah dibaca" />
        ) : (
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" role="img" aria-label="belum dibaca" />
        )}
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-200">{article.title}</span>
          <span className="block text-xs leading-snug text-slate-500">{snippet ?? article.summary}</span>
        </span>
      </button>
    </li>
  );
}

/** Panel kiri mode Materi: pencarian + daftar artikel per tier. */
export function ReferenceSidebar({ activeId, onSelect, read }: ReferenceSidebarProps): JSX.Element {
  const [query, setQuery] = useState('');
  const hits = useMemo(() => (query.trim() ? searchArticles(ARTICLES, query) : null), [query]);
  const readCount = ARTICLES.filter((a) => read.has(a.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Library className="h-5 w-5 text-sky-400" aria-hidden />
        <h2 className="text-base font-semibold text-slate-100">Materi SQL</h2>
        <span className="ml-auto text-xs tabular-nums text-slate-500">
          {readCount}/{ARTICLES.length} dibaca
        </span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
        {/* Tema terang: batas slate-700 terlalu pucat di atas putih (< 3:1) dan cincin fokus /30 nyaris hilang → batas &
            cincin lebih pekat (sama dengan editor SQL & input portal injection). */}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari: LEFT JOIN, NULL, TOP, ROLLBACK…"
          aria-label="Cari materi"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-8 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 light:border-slate-600/80 light:focus:border-emerald-500/80 light:focus:ring-emerald-500"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-slate-200"
            aria-label="Hapus pencarian"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {hits ? (
        <div>
          <p className="mb-1.5 text-xs text-slate-500" role="status">
            {hits.length > 0 ? `${hits.length} materi cocok` : 'Tidak ada materi yang cocok. Coba kata kunci lain, mis. nama fungsi atau klausa.'}
          </p>
          <ul className="space-y-0.5">
            {hits.map((hit) => (
              <ArticleRow
                key={hit.article.id}
                article={hit.article}
                active={hit.article.id === activeId}
                read={read.has(hit.article.id)}
                snippet={hit.snippet}
                onSelect={() => onSelect(hit.article.id)}
              />
            ))}
          </ul>
        </div>
      ) : (
        GROUPS.map((group) => {
          const items = ARTICLES.filter(group.match);
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
              <ul className="space-y-0.5">
                {items.map((article) => (
                  <ArticleRow key={article.id} article={article} active={article.id === activeId} read={read.has(article.id)} onSelect={() => onSelect(article.id)} />
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}
