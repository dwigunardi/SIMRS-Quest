import { createContext, useContext } from 'react';
import { BookOpen } from 'lucide-react';
import { getArticleById } from '../../data/materi';
import { relatedArticleIds } from '../../lib/errorTopics';

export interface MateriLinks {
  /** Buka artikel materi (di tab Materi saat mode Misi, atau di mode Materi). */
  openArticle: (articleId: string) => void;
  /** Buka artikel di mode Materi layar penuh (dengan pencarian). */
  openReference: (articleId: string) => void;
}

/** Disediakan App; null di luar aplikasi (mis. komponen dipakai tanpa provider) → tautan tidak ditampilkan. */
export const MateriLinkContext = createContext<MateriLinks | null>(null);

/** Tombol "Pelajari: …" untuk materi yang menjelaskan penyebab sebuah error SQLite. */
export function ErrorMateriLinks({ rawError }: { rawError: string }): JSX.Element | null {
  const links = useContext(MateriLinkContext);
  const articles = relatedArticleIds(rawError).flatMap((id) => {
    const article = getArticleById(id);
    return article ? [article] : [];
  });
  if (!links || articles.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-rose-500/20 bg-slate-950/40 px-4 py-2">
      <span className="text-[11px] text-slate-400">Pelajari penyebabnya:</span>
      {articles.map((article) => (
        <button
          key={article.id}
          type="button"
          onClick={() => links.openArticle(article.id)}
          className="inline-flex items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-500/20"
        >
          <BookOpen className="h-3 w-3" aria-hidden />
          {article.title}
        </button>
      ))}
    </div>
  );
}
