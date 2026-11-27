import { ArrowUpRight, ChartColumn, CircleCheck, CircleMinus, CircleX, RotateCcw, Timer } from 'lucide-react';
import { MISSIONS, getMissionById } from '../../data/missions';
import { formatClock, summarizeExam, type ExamItemResult, type ExamRecord } from '../../lib/exam';
import { MISTAKE_INFO } from '../../lib/mistakes';
import { HighlightedCode } from '../HighlightedCode';

export interface ExamReportProps {
  record: ExamRecord;
  /** Kapan misi ini muncul lagi di latihan ulang (mis. "3 hari lagi (26 Nov)"); null bila tidak terjadwal. */
  nextReview?: (missionId: string) => string | null;
  onNewExam: () => void;
  onOpenMission: (missionId: string) => void;
  onOpenProgress: () => void;
}

/** Rapor ujian: skor, per tier, per jenis kesalahan, lalu tinjauan setiap soal (jawabanmu vs solusi). */
export function ExamReport({ record, nextReview, onNewExam, onOpenMission, onOpenProgress }: ExamReportProps): JSX.Element {
  const s = summarizeExam(record, MISSIONS);
  const tone = s.score >= 80 ? 'text-emerald-300' : s.score >= 50 ? 'text-amber-300' : 'text-rose-300';
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="flex flex-wrap items-center gap-5 rounded-xl border border-slate-800 bg-slate-900/60 p-5" aria-label="Ringkasan nilai">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{record.purpose === 'review' ? 'Latihan ulang' : 'Nilai ujian'}</p>
          <p className={`text-5xl font-bold tabular-nums ${tone}`} data-testid="exam-score">
            {s.score}
          </p>
        </div>
        <div className="space-y-1 text-sm text-slate-300">
          <p>
            <span className="font-semibold text-slate-100">{s.correct}</span> dari {s.total} soal benar
            {s.unanswered > 0 ? ` · ${s.unanswered} tidak dijawab` : ''}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Timer className="h-3.5 w-3.5" aria-hidden /> {formatClock(s.durationMs)}
            {record.timedOut ? ' · dikumpulkan otomatis karena waktu habis' : ''}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={onNewExam} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400">
            <RotateCcw className="h-4 w-4" aria-hidden /> Kembali
          </button>
          <button type="button" onClick={onOpenProgress} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
            <ChartColumn className="h-4 w-4" aria-hidden /> Peta Kelemahan
          </button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Per tier</h3>
          <ul className="space-y-2">
            {s.byTier.map((t) => (
              <li key={t.tier} className="space-y-1">
                <div className="flex text-xs text-slate-300">
                  Tier {t.tier}
                  <span className="ml-auto tabular-nums text-slate-400">
                    {t.correct}/{t.total}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden>
                  <div className="h-full rounded-full bg-emerald-400/80 light:bg-emerald-600" style={{ width: `${Math.round((t.correct / t.total) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Jenis kesalahan</h3>
          {s.byKind.length === 0 ? <p className="text-xs text-slate-500">{s.unanswered > 0 ? 'Tidak ada jawaban salah — hanya soal yang tidak dijawab.' : 'Tidak ada kesalahan. Mantap!'}</p> : null}
          <ul className="space-y-1.5">
            {s.byKind.map((k) => (
              <li key={k.kind} className="flex items-baseline gap-2 text-xs">
                <span className="text-slate-200">{MISTAKE_INFO[k.kind].label}</span>
                <span className="ml-auto tabular-nums text-slate-400">{k.count}×</span>
              </li>
            ))}
          </ul>
          {s.byKind.length > 0 ? <p className="text-[11px] text-slate-500">Sudah dicatat di Peta Kelemahan beserta saran materinya.</p> : null}
        </section>
      </div>

      <section className="space-y-2" aria-label="Tinjauan soal">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tinjauan soal</h3>
        <ol className="space-y-2">
          {record.items.map((item, i) => (
            <ItemRow key={item.missionId} item={item} number={i + 1} onOpenMission={onOpenMission} next={nextReview?.(item.missionId) ?? null} />
          ))}
        </ol>
      </section>
    </div>
  );
}

const STATUS = {
  correct: { icon: CircleCheck, label: 'Benar', cls: 'text-emerald-300', frame: 'border-emerald-500/30' },
  wrong: { icon: CircleX, label: 'Salah', cls: 'text-rose-300', frame: 'border-rose-500/30' },
  unanswered: { icon: CircleMinus, label: 'Tidak dijawab', cls: 'text-slate-400', frame: 'border-slate-800' },
} as const;

function ItemRow({ item, number, onOpenMission, next }: { item: ExamItemResult; number: number; onOpenMission: (id: string) => void; next: string | null }) {
  const mission = getMissionById(item.missionId);
  const st = STATUS[item.status];
  const Icon = st.icon;
  if (!mission) return null;
  const solution = mission.kind === 'sql' ? mission.solutionSql : mission.kind === 'predict' ? mission.query : '';
  return (
    <li className={`rounded-xl border bg-slate-900/40 p-3 ${st.frame}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs tabular-nums text-slate-500">#{number}</span>
        <Icon className={`h-4 w-4 ${st.cls}`} aria-hidden />
        <span className={`text-xs font-semibold ${st.cls}`}>{st.label}</span>
        <span className="text-sm font-medium text-slate-100">{mission.title}</span>
        <span className="text-[11px] text-slate-500">Tier {mission.tier}</span>
        {next ? (
          <span className="rounded bg-sky-500/10 px-1.5 py-px text-[11px] text-sky-200" title="Jadwal latihan ulang berikutnya">
            ulang {next}
          </span>
        ) : null}
        <button type="button" onClick={() => onOpenMission(mission.id)} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200">
          Buka misi <ArrowUpRight className="h-3 w-3" aria-hidden />
        </button>
      </div>
      {item.status === 'wrong' ? (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
          {item.kind ? <span className="font-semibold text-rose-200">{MISTAKE_INFO[item.kind].label}: </span> : null}
          {item.message}
        </p>
      ) : null}
      {item.status !== 'correct' || item.answer ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-200">Jawabanmu & solusi referensi</summary>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-950">
              <p className="border-b border-slate-800 px-3 py-1 text-[11px] text-slate-500">Jawabanmu</p>
              {item.answer ? <HighlightedCode code={item.answer} className="px-3 py-2 text-[12px]" /> : <p className="px-3 py-2 text-slate-500">(kosong)</p>}
            </div>
            <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-950">
              <p className="border-b border-slate-800 px-3 py-1 text-[11px] text-slate-500">{mission.kind === 'predict' ? 'Query yang ditebak (lihat penjelasannya di mode Misi)' : 'Solusi referensi'}</p>
              <HighlightedCode code={solution} className="px-3 py-2 text-[12px]" />
            </div>
          </div>
        </details>
      ) : null}
    </li>
  );
}
