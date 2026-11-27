import { Award, Lock, X } from 'lucide-react';
import type { AchievementCategory, EvaluatedAchievement } from '../../lib/achievements';

const CATEGORIES: readonly AchievementCategory[] = ['Perjalanan', 'Boss', 'Ketepatan', 'Konsistensi', 'Ujian & Ulang', 'Materi'];

/*
 * Lencana yang diraih di tema terang: amber tua beralfa rendah menjadi krem kusam, jadi kartu & medali memakai emas
 * pucat (tint 950) dengan garis amber cerah (700) — tetap terbaca sebagai "emas" seperti di tema gelap.
 */
const EARNED_BORDER_LIGHT = 'light:border-amber-700/50';
const EARNED_LIGHT = `${EARNED_BORDER_LIGHT} light:bg-amber-950/30`;
const MEDAL_LIGHT = 'light:bg-amber-950/70 light:ring-amber-700/60';

/** Galeri lencana di mode Progres: yang sudah diraih berwarna, yang belum menampilkan kemajuannya. */
export function AchievementsPanel({ list }: { list: readonly EvaluatedAchievement[] }): JSX.Element {
  const earned = list.filter((a) => a.status.earned).length;
  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4" aria-label="Lencana pencapaian">
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5 text-amber-300" aria-hidden />
        <h2 className="text-base font-semibold text-slate-100">Lencana pencapaian</h2>
        <span className="ml-auto text-sm tabular-nums text-slate-400" data-testid="achievements-count">
          {earned}/{list.length} diraih
        </span>
      </div>
      {CATEGORIES.map((category) => {
        const items = list.filter((a) => a.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category} className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{category}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {items.map((a) => (
                <BadgeCard key={a.id} achievement={a} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function BadgeCard({ achievement: a }: { achievement: EvaluatedAchievement }) {
  const { earned, current, target } = a.status;
  const pct = target > 0 ? Math.round((current / target) * 100) : 0;
  return (
    <li
      className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${earned ? `border-amber-400/40 bg-amber-400/[0.07] ${EARNED_LIGHT}` : 'border-slate-800 bg-slate-950/40'}`}
      data-achievement={a.id}
      data-earned={earned ? 'ya' : 'tidak'}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl ${earned ? `bg-amber-400/20 ring-2 ring-amber-400/50 ${MEDAL_LIGHT}` : 'bg-slate-800 grayscale opacity-50'}`} aria-hidden>
        {a.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`flex items-center gap-1.5 text-sm font-semibold ${earned ? 'text-amber-100' : 'text-slate-300'}`}>
          {a.title}
          {earned ? null : <Lock className="h-3 w-3 text-slate-500" aria-label="belum diraih" />}
        </span>
        <span className="block text-[11.5px] leading-snug text-slate-400">{a.description}</span>
        {!earned && target > 1 ? (
          <span className="mt-1 flex items-center gap-2" aria-label={`kemajuan ${current} dari ${target}`}>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
              <span className="block h-full rounded-full bg-amber-400/70 light:bg-amber-700" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-[10.5px] tabular-nums text-slate-500">
              {current}/{target}
            </span>
          </span>
        ) : null}
      </span>
    </li>
  );
}

/** Notifikasi lencana baru (pojok kanan bawah), hilang sendiri setelah beberapa detik. */
export function AchievementToasts({ toasts, onDismiss }: { toasts: readonly EvaluatedAchievement[]; onDismiss: (id: string) => void }): JSX.Element | null {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
      {toasts.slice(0, 3).map((a) => (
        <div key={a.id} className={`pointer-events-auto flex animate-pop-in items-center gap-3 rounded-xl border border-amber-400/50 bg-slate-900/95 px-3 py-2.5 shadow-xl shadow-amber-500/10 light:bg-slate-950 light:shadow-slate-500/25 ${EARNED_BORDER_LIGHT}`} data-testid="achievement-toast">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-400/20 text-xl ring-2 ring-amber-400/60 ${MEDAL_LIGHT}`} aria-hidden>
            {a.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-amber-300">Lencana baru!</span>
            <span className="block truncate text-sm font-semibold text-slate-100">{a.title}</span>
            <span className="block truncate text-[11px] text-slate-400">{a.description}</span>
          </span>
          <button type="button" onClick={() => onDismiss(a.id)} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200" aria-label="Tutup notifikasi lencana">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
