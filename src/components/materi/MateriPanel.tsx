import { useContext, useEffect, useRef } from 'react';
import type { Database } from 'sql.js';
import { BookOpenCheck, Check, GraduationCap, Library, Maximize2 } from 'lucide-react';
import { ARTICLES, articlesForMission, getArticleById } from '../../data/materi';
import { TIERS } from '../../data/missions';
import type { Article, Mission } from '../../types';
import { ArticleView, type ExampleActions } from './ArticleView';
import { MateriLinkContext } from './MateriLinkContext';

export interface MateriPanelProps extends ExampleActions {
  mission: Mission;
  /** Artikel yang dipilih user; null = materi utama misi ini. */
  articleId: string | null;
  onSelectArticle: (articleId: string) => void;
  read: ReadonlySet<string>;
  onRead: (articleId: string) => void;
  db: Database | null;
  /** Bertambah setiap kali materi dibuka lewat tautan → gulir panel ke artikel & pindahkan fokus ke judulnya. */
  focusSignal?: number;
}

const GROUPS: ReadonlyArray<{ label: string; match: (a: Article) => boolean }> = [
  { label: 'Umum', match: (a) => a.id === 'urutan-eksekusi' },
  ...TIERS.map(({ tier }) => ({ label: `Tier ${tier}`, match: (a: Article) => a.tier === tier && a.id !== 'urutan-eksekusi' })),
];

function ArticleChip({ article, active, read, onClick }: { article: Article; active: boolean; read: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
        active ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 text-slate-300 hover:border-slate-500'
      }`}
    >
      {read ? <Check className="h-3 w-3 text-emerald-400" aria-label="sudah dibaca" /> : <span className="h-1.5 w-1.5 rounded-full bg-sky-400" role="img" aria-label="belum dibaca" />}
      {article.title}
    </button>
  );
}

/** Tab "Materi" di panel kiri: materi konsep misi aktif + daftar semua materi. Membaca materi gratis (tanpa penalti XP). */
export function MateriPanel({
  mission,
  articleId,
  onSelectArticle,
  read,
  onRead,
  db,
  onOpenInPlayground,
  onVisualize,
  focusSignal = 0,
}: MateriPanelProps): JSX.Element {
  const topRef = useRef<HTMLDivElement>(null);
  const links = useContext(MateriLinkContext);
  const linked = articlesForMission(mission);
  const current = (articleId ? getArticleById(articleId) : undefined) ?? linked[0] ?? ARTICLES[0];
  const currentId = current?.id;

  useEffect(() => {
    if (currentId) onRead(currentId);
  }, [currentId, onRead]);

  // Dibuka lewat tautan dari bagian lain halaman (mis. kartu error di panel kanan / di bawah pada layar sempit):
  // tanpa ini perubahannya terjadi di luar layar dan tombol terasa "tidak bereaksi".
  useEffect(() => {
    if (focusSignal === 0) return;
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    topRef.current?.querySelector<HTMLElement>('[data-article-heading]')?.focus({ preventScroll: true });
  }, [focusSignal]);

  const select = (id: string) => {
    onSelectArticle(id);
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <div ref={topRef} className="scroll-mt-4 space-y-4">
      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
        <div className="flex items-center gap-1.5">
          <GraduationCap className="h-4 w-4 text-emerald-400" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Materi untuk misi ini</p>
          {links && currentId ? (
            <button
              type="button"
              onClick={() => links.openReference(currentId)}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              title="Buka di mode Materi: layar lebih lebar + pencarian"
            >
              <Maximize2 className="h-3 w-3" aria-hidden />
              Layar penuh
            </button>
          ) : null}
        </div>
        {linked.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {linked.map((article) => (
              <ArticleChip key={article.id} article={article} active={article.id === currentId} read={read.has(article.id)} onClick={() => select(article.id)} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            {mission.kind === 'sql' && mission.boss
              ? 'Boss tidak punya materi khusus: bagian dari tantangannya adalah mengenali konsep mana yang dibutuhkan. Semua materi tetap boleh dibuka (gratis) dari daftar di bawah.'
              : 'Belum ada materi khusus untuk misi ini — lihat daftar semua materi di bawah.'}
          </p>
        )}
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
          <BookOpenCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" aria-hidden />
          Gratis: membaca materi tidak mengurangi XP. Contohnya memakai kasus lain, bukan jawaban misi — tekan Jalankan untuk melihat
          hasilnya di database awal.
        </p>
      </div>

      {current ? <ArticleView key={current.id} article={current} db={db} onOpenInPlayground={onOpenInPlayground} onVisualize={onVisualize} /> : null}

      <details className="group rounded-xl border border-slate-800 bg-slate-900/40">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-300 hover:text-slate-100">
          <Library className="h-4 w-4 text-sky-400" aria-hidden />
          Semua materi
          <span className="ml-auto text-xs font-normal tabular-nums text-slate-500">
            {ARTICLES.filter((a) => read.has(a.id)).length}/{ARTICLES.length} dibaca
          </span>
        </summary>
        <div className="space-y-3 border-t border-slate-800 px-3 py-3">
          {GROUPS.map((group) => {
            const items = ARTICLES.filter(group.match);
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
                <ul className="space-y-0.5">
                  {items.map((article) => (
                    <li key={article.id}>
                      <button
                        type="button"
                        onClick={() => select(article.id)}
                        className={`flex w-full items-start gap-2 rounded-md px-2 py-1 text-left transition hover:bg-slate-800/60 ${
                          article.id === currentId ? 'bg-slate-800/80' : ''
                        }`}
                      >
                        {read.has(article.id) ? (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label="sudah dibaca" />
                        ) : (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" role="img" aria-label="belum dibaca" />
                        )}
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-200">{article.title}</span>
                          <span className="block text-xs leading-snug text-slate-500">{article.summary}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
