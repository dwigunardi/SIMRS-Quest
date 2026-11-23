import { useState } from 'react';
import { CalendarCheck, Repeat } from 'lucide-react';
import { REVIEW_SESSION_SIZES, describeDue, type DueItem, type ReviewForecast } from '../../lib/review';
import type { ExamMission } from '../../lib/exam';

export interface ReviewStartProps {
  due: readonly DueItem[];
  forecast: ReviewForecast;
  today: string;
  onStart: (missions: readonly ExamMission[]) => void;
}

/** Kartu "Latihan ulang hari ini": misi yang jatuh tempo menurut jadwal, prioritas tertinggi lebih dulu. */
export function ReviewStart({ due, forecast, today, onStart }: ReviewStartProps): JSX.Element {
  const [size, setSize] = useState<number>(REVIEW_SESSION_SIZES[0]);
  const picked = due.slice(0, size);
  const weak = picked.filter((d) => d.recentMistakes > 0).length;
  const late = picked.filter((d) => d.overdue >= 3).length;

  return (
    <section className="mx-auto max-w-3xl space-y-3 rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-slate-900/40 p-4" aria-label="Latihan ulang hari ini">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-50">
        <Repeat className="h-5 w-5 text-sky-300" aria-hidden />
        Latihan ulang hari ini
      </h2>
      {forecast.total === 0 ? (
        <p className="text-sm text-slate-400">Belum ada misi untuk diulang. Misi yang kamu selesaikan akan muncul lagi di sini sehari kemudian.</p>
      ) : due.length === 0 ? (
        <p className="flex items-start gap-2 text-sm text-slate-300">
          <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
          <span>
            Semua jadwal hari ini sudah beres.
            {forecast.nextDate ? ` Berikutnya ${forecast.dueTomorrow > 0 ? `${forecast.dueTomorrow} misi besok` : `pada ${describeDue(forecast.nextDate, today)}`}.` : ''}
          </span>
        </p>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-slate-300">
            <span className="font-semibold text-sky-200" data-testid="review-due">
              {due.length} misi
            </span>{' '}
            jatuh tempo untuk diulang
            {weak > 0 || late > 0 ? ` — sesi ini mendahulukan ${[weak > 0 ? `${weak} yang sering salah` : '', late > 0 ? `${late} yang lama tidak disentuh` : ''].filter(Boolean).join(' dan ')}` : ''}.
            Jawab benar → muncul lagi makin jarang (3, 7, 14 hari…); salah → muncul lagi besok.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {due.length > REVIEW_SESSION_SIZES[0] ? (
              <div className="flex gap-1.5" role="radiogroup" aria-label="Jumlah soal latihan">
                {REVIEW_SESSION_SIZES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={size === n}
                    onClick={() => setSize(n)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${size === n ? 'border-sky-400/60 bg-sky-500/15 text-sky-100' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
                  >
                    {n} soal
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => onStart(picked.map((d) => d.mission))}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              <Repeat className="h-4 w-4" aria-hidden />
              Mulai latihan ulang ({picked.length} soal)
            </button>
            <span className="text-[11px] text-slate-500">Tanpa batas waktu · dihitung hari aktif untuk streak 🔥</span>
          </div>
        </>
      )}
    </section>
  );
}
