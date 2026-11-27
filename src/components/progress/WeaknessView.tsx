import { useState } from 'react';
import { BookOpen, ChevronDown, CircleCheck, Crosshair, Lock, Radar, RotateCcw } from 'lucide-react';
import { getArticleById } from '../../data/materi';
import { getMissionById } from '../../data/missions';
import { MISTAKE_INFO } from '../../lib/mistakes';
import type { CategoryReport, Recommendation, WeaknessReport } from '../../lib/weakness';
import { renderInline } from '../workspaces/RichText';
import type { MissionAccess } from '../materi/ReferenceView';

export interface WeaknessViewProps {
  report: WeaknessReport;
  missionAccess: (missionId: string) => MissionAccess;
  onOpenMission: (missionId: string) => void;
  onOpenArticle: (articleId: string) => void;
}

function missionLabel(missionId: string): string {
  const mission = getMissionById(missionId);
  return mission ? `#${mission.order} ${mission.title}` : missionId;
}

/** Satu batang horizontal: panjang = skor relatif; angka ditulis di sampingnya (bukan hanya lewat warna/panjang). */
function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80" title={label} aria-hidden>
      <div className="h-full rounded-full bg-amber-400/80 light:bg-amber-700" style={{ width: `${width}%` }} />
    </div>
  );
}

function RecommendationCard({ rec, missionAccess, onOpenMission, onOpenArticle }: { rec: Recommendation } & Omit<WeaknessViewProps, 'report'>) {
  const info = MISTAKE_INFO[rec.kind];
  if (rec.type === 'read') {
    const article = getArticleById(rec.articleId);
    if (!article) return null;
    return (
      <button
        type="button"
        onClick={() => onOpenArticle(article.id)}
        className="flex w-full items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/[0.06] p-3 text-left transition hover:bg-sky-500/10"
      >
        <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" aria-hidden />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-sky-100">Baca: {article.title}</span>
          <span className="block text-xs leading-relaxed text-slate-400">
            Untuk kelemahan "{info.label}" ({rec.count}× kesalahan). {article.summary}
          </span>
        </span>
      </button>
    );
  }
  const access = missionAccess(rec.missionId);
  return (
    <button
      type="button"
      disabled={access === 'locked'}
      onClick={() => onOpenMission(rec.missionId)}
      className="flex w-full items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-left transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50 light:disabled:border-slate-700 light:disabled:bg-slate-900 light:disabled:opacity-100"
    >
      <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-emerald-100">
          {rec.resolved ? 'Latih ulang' : 'Selesaikan'}: {missionLabel(rec.missionId)}
        </span>
        <span className="block text-xs leading-relaxed text-slate-400">
          {rec.count}× kesalahan "{info.label}" di misi ini
          {rec.resolved ? ' — sudah selesai, ulangi tanpa melihat jawaban untuk menguatkan (tidak menambah/mengurangi XP).' : ' — belum terselesaikan.'}
        </span>
      </span>
    </button>
  );
}

function CategoryRow({ category, max, missionAccess, onOpenMission, onOpenArticle }: { category: CategoryReport; max: number } & Omit<WeaknessViewProps, 'report'>) {
  const [open, setOpen] = useState(false);
  const info = MISTAKE_INFO[category.kind];
  const summary = `${category.count} kesalahan${category.recent > 0 ? `, ${category.recent} dalam 7 hari terakhir` : ''}`;
  return (
    <li className="rounded-lg border border-slate-800 bg-slate-900/40">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full space-y-1.5 px-3 py-2 text-left">
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-slate-200">{info.label}</span>
          <span className="ml-auto text-xs tabular-nums text-slate-400">{summary}</span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 self-center text-slate-500 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
        </span>
        <Bar value={category.score} max={max} label={`${info.label}: ${summary}`} />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-slate-800 px-3 py-2 text-xs">
          <p className="leading-relaxed text-slate-400">{renderInline(info.description)}</p>
          <div className="flex flex-wrap gap-1.5">
            {category.missions.map((m) => {
              const access = missionAccess(m.missionId);
              return (
                <button
                  key={m.missionId}
                  type="button"
                  disabled={access === 'locked'}
                  onClick={() => onOpenMission(m.missionId)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-0.5 text-slate-300 hover:border-emerald-500/50 disabled:opacity-50 light:disabled:border-slate-700 light:disabled:bg-slate-900 light:disabled:text-slate-500 light:disabled:opacity-100"
                  title={m.resolved ? 'Sudah diselesaikan setelah kesalahan terakhir' : 'Belum terselesaikan'}
                >
                  {m.resolved ? <CircleCheck className="h-3 w-3 text-emerald-400" aria-label="teratasi" /> : null}
                  {access === 'locked' ? <Lock className="h-3 w-3 text-slate-500" aria-label="terkunci" /> : null}
                  {missionLabel(m.missionId)}
                  <span className="tabular-nums text-slate-500">×{m.count}</span>
                </button>
              );
            })}
          </div>
          {category.articles.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500">Materi:</span>
              {category.articles.map((id) => {
                const article = getArticleById(id);
                return article ? (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onOpenArticle(id)}
                    className="inline-flex items-center gap-1 rounded-md border border-sky-500/40 px-2 py-0.5 text-sky-200 hover:bg-sky-500/10"
                  >
                    <BookOpen className="h-3 w-3" aria-hidden />
                    {article.title}
                  </button>
                ) : null;
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Peta Kelemahan: rekomendasi, jenis kesalahan (bar), dan topik materi yang paling sering salah. */
export function WeaknessView({ report, missionAccess, onOpenMission, onOpenArticle }: WeaknessViewProps): JSX.Element {
  const actions = { missionAccess, onOpenMission, onOpenArticle };
  const header = (
    <div className="flex items-center gap-2">
      <Radar className="h-5 w-5 text-amber-400" aria-hidden />
      <h2 className="text-base font-semibold text-slate-100">Peta Kelemahan</h2>
    </div>
  );

  if (report.totalMistakes === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header}
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-800 px-6 py-12 text-center">
          <Crosshair className="h-8 w-8 text-slate-600" aria-hidden />
          <p className="text-sm text-slate-300">Belum ada kesalahan yang tercatat.</p>
          <p className="max-w-md text-xs leading-relaxed text-slate-500">
            Setiap jawaban yang belum benar dicatat jenis kesalahannya (mis. baris kurang, pengurutan, agregat di WHERE). Setelah
            beberapa misi, halaman ini menunjukkan pola kesalahanmu beserta materi dan misi yang disarankan untuk diulang.
          </p>
        </div>
      </div>
    );
  }

  const maxCategory = Math.max(...report.categories.map((c) => c.score));
  const maxTopic = Math.max(...report.topics.map((t) => t.score));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        {header}
        <p className="text-xs leading-relaxed text-slate-400">
          Dihitung dari {report.totalMistakes} percobaan yang belum benar. Kesalahan terbaru dan yang misinya belum terselesaikan
          diberi bobot lebih besar; yang sudah lama atau sudah kamu atasi perlahan turun peringkatnya.
        </p>
      </div>

      {report.recommendations.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Saran berikutnya</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {report.recommendations.map((rec) => (
              <RecommendationCard key={rec.type === 'read' ? `r-${rec.articleId}` : `m-${rec.missionId}-${rec.kind}`} rec={rec} {...actions} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Jenis kesalahan</h3>
        <ul className="space-y-1.5">
          {report.categories.map((category) => (
            <CategoryRow key={category.kind} category={category} max={maxCategory} {...actions} />
          ))}
        </ul>
      </section>

      {report.topics.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Topik yang paling sering salah</h3>
          <ul className="space-y-1">
            {report.topics.slice(0, 8).map((topic) => {
              const article = getArticleById(topic.articleId);
              if (!article) return null;
              return (
                <li key={topic.articleId}>
                  <button
                    type="button"
                    onClick={() => onOpenArticle(topic.articleId)}
                    className="w-full space-y-1 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-900/70"
                  >
                    <span className="flex items-baseline gap-2 text-sm">
                      <span className="text-slate-200">{article.title}</span>
                      <span className="ml-auto text-xs tabular-nums text-slate-400">{topic.count} kesalahan</span>
                    </span>
                    <Bar value={topic.score} max={maxTopic} label={`${article.title}: ${topic.count} kesalahan`} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
