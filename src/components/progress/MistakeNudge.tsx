import { createContext, useContext } from 'react';
import { BookOpen, Radar } from 'lucide-react';
import { ARTICLES, getArticleById } from '../../data/materi';
import { MISTAKE_INFO, type MistakeEvent, type MistakeKind } from '../../lib/mistakes';
import { mistakeNudge, NUDGE_DAYS } from '../../lib/weakness';
import { MateriLinkContext } from '../materi/MateriLinkContext';

export interface MistakeNudgeLinks {
  events: readonly MistakeEvent[];
  /** Buka mode Progres (Peta Kelemahan). */
  openProgress: () => void;
}

/** Disediakan App. Tanpa provider (mis. komponen diuji terpisah) penanda tidak ditampilkan. */
export const MistakeNudgeContext = createContext<MistakeNudgeLinks | null>(null);

export interface MistakeNudgeProps {
  missionId: string;
  /** Jenis kesalahan percobaan barusan; null = tidak ada (mis. mode aman lab injection). */
  kind: MistakeKind | null;
}

/**
 * Penanda kecil di bawah kartu jawaban salah: muncul bila jenis kesalahan yang sama sudah berulang minggu ini,
 * dengan tautan ke materi yang relevan dan ke Peta Kelemahan.
 */
export function MistakeNudge({ missionId, kind }: MistakeNudgeProps): JSX.Element | null {
  const nudgeLinks = useContext(MistakeNudgeContext);
  const materi = useContext(MateriLinkContext);
  if (!nudgeLinks || !kind) return null;
  const info = mistakeNudge(nudgeLinks.events, kind, missionId, ARTICLES, Date.now());
  if (!info) return null;
  const article = info.articleId ? getArticleById(info.articleId) : undefined;
  return (
    <div role="note" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs light:border-amber-700/40 light:bg-amber-950/25">
      <Radar className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <p className="min-w-0 flex-1 leading-relaxed text-slate-300">
        Kesalahan jenis <span className="font-semibold text-amber-200">"{MISTAKE_INFO[kind].label}"</span> sudah{' '}
        <span className="font-semibold tabular-nums text-amber-200">{info.count}×</span> dalam {NUDGE_DAYS} hari terakhir — mungkin
        konsepnya perlu diulang.
      </p>
      <span className="flex flex-wrap gap-1.5">
        {article && materi ? (
          <button
            type="button"
            onClick={() => materi.openArticle(article.id)}
            className="inline-flex items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-200 transition hover:bg-sky-500/20"
          >
            <BookOpen className="h-3 w-3" aria-hidden />
            Baca: {article.title}
          </button>
        ) : null}
        <button
          type="button"
          onClick={nudgeLinks.openProgress}
          className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 px-2 py-0.5 font-semibold text-amber-200 transition hover:bg-amber-500/15"
        >
          <Radar className="h-3 w-3" aria-hidden />
          Lihat Peta Kelemahan
        </button>
      </span>
    </div>
  );
}
