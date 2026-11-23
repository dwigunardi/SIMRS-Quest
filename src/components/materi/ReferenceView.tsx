import { useEffect, useRef } from 'react';
import type { Database } from 'sql.js';
import { CircleCheck, Lock, Target } from 'lucide-react';
import { ARTICLES, getArticleById } from '../../data/materi';
import { getMissionById } from '../../data/missions';
import { ArticleView, type ExampleActions } from './ArticleView';

export type MissionAccess = 'locked' | 'open' | 'done';

export interface ReferenceViewProps extends ExampleActions {
  articleId: string | null;
  db: Database | null;
  onRead: (articleId: string) => void;
  missionAccess: (missionId: string) => MissionAccess;
  onOpenMission: (missionId: string) => void;
  /**
   * Gulir & fokus ke artikel saat pertama tampil — hanya bila datang lewat tautan. Saat mode Materi dibuka dari
   * header (tanpa pilihan), daftar & pencarian di atas tetap terlihat di layar sempit.
   */
  focusOnMount: boolean;
}

/** Panel kanan mode Materi: artikel lengkap + misi yang memakai konsepnya. */
export function ReferenceView({
  articleId,
  db,
  onRead,
  missionAccess,
  onOpenMission,
  onOpenInPlayground,
  onVisualize,
  focusOnMount,
}: ReferenceViewProps): JSX.Element | null {
  const rootRef = useRef<HTMLDivElement>(null);
  /** Artikel yang terakhir ditampilkan (undefined = belum pernah). */
  const shownId = useRef<string | undefined>(undefined);
  const article = (articleId ? getArticleById(articleId) : undefined) ?? ARTICLES[0];
  const id = article?.id;
  useEffect(() => {
    if (id) onRead(id);
  }, [id, onRead]);
  // Artikel baru → mulai dari atas (panel kanan menyimpan posisi gulir; di layar sempit artikel ada di bawah daftar),
  // dan fokus ke judul agar pengguna keyboard/screen reader ikut berpindah.
  useEffect(() => {
    const previous = shownId.current;
    shownId.current = id;
    if (previous === id) return; // artikel sama (termasuk efek yang dijalankan ulang StrictMode)
    if (previous === undefined && !focusOnMount) return; // tampil pertama kali lewat header
    rootRef.current?.scrollIntoView({ block: 'start' });
    rootRef.current?.querySelector<HTMLElement>('[data-article-heading]')?.focus({ preventScroll: true });
  }, [id, focusOnMount]);
  if (!article) return null;

  const missions = article.missions.flatMap((missionId) => {
    const mission = getMissionById(missionId);
    return mission ? [mission] : [];
  });

  return (
    <div ref={rootRef} className="mx-auto max-w-3xl scroll-mt-4 space-y-5">
      <ArticleView key={article.id} article={article} db={db} onOpenInPlayground={onOpenInPlayground} onVisualize={onVisualize} />

      <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-3">
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">
          <Target className="h-3.5 w-3.5" aria-hidden />
          Latih di misi
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {missions.map((mission) => {
            const access = missionAccess(mission.id);
            return (
              <button
                key={mission.id}
                type="button"
                disabled={access === 'locked'}
                onClick={() => onOpenMission(mission.id)}
                title={access === 'locked' ? 'Misi ini masih terkunci — selesaikan misi sebelumnya dulu' : undefined}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-xs text-slate-200 transition hover:border-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {access === 'done' ? <CircleCheck className="h-3.5 w-3.5 text-emerald-400" aria-label="selesai" /> : null}
                {access === 'locked' ? <Lock className="h-3.5 w-3.5 text-slate-500" aria-label="terkunci" /> : null}
                <span className="tabular-nums text-slate-500">#{mission.order}</span>
                {mission.title}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
