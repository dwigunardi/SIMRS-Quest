/**
 * "Hari ini": hanya butir yang memang relevan sekarang — sesi ujian/latihan yang masih berjalan, latihan ulang yang
 * jatuh tempo, saran dari Peta Kelemahan, dan keadaan streak. Bila tidak ada satu pun, cukup satu kalimat tenang.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ClipboardCheck, Flame, RotateCcw, Target, type LucideIcon } from 'lucide-react';
import type { TrackGlance } from '../tracks';
import { BTN_SECONDARY, SECTION_TITLE, formatCountdown } from './ui';

export interface TodayProps {
  glance: TrackGlance;
  /** Ke layar ujian/latihan jalur. */
  onOpenExam: () => void;
  /** Ke Peta Kelemahan jalur. */
  onOpenProgress: () => void;
}

/** Ada butir yang layak ditampilkan? (Dipakai Beranda untuk menyembunyikan seluruh bagian bagi pengguna baru.) */
export function hasTodayItems(glance: TrackGlance): boolean {
  return glance.exam !== null || glance.reviewDue > 0 || glance.weakness !== null || glance.streak.active > 0;
}

export function Today({ glance, onOpenExam, onOpenProgress }: TodayProps): JSX.Element {
  const { exam, reviewDue, weakness, streak } = glance;

  return (
    <section aria-labelledby="home-today-title" data-testid="home-today">
      <h2 id="home-today-title" className={SECTION_TITLE}>
        Hari ini
      </h2>
      {hasTodayItems(glance) ? (
        <ul className="mt-3 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
          {exam ? <ExamItem exam={exam} onOpen={onOpenExam} /> : null}
          {reviewDue > 0 ? (
            <Item
              testId="home-today-review"
              icon={RotateCcw}
              tone="border-sky-500/30 bg-sky-500/10 text-sky-300"
              title={`${reviewDue} misi jatuh tempo`}
              detail={
                exam
                  ? 'Latihan ulang bisa dimulai setelah sesi yang sedang berjalan selesai.'
                  : 'Latihan ulang singkat supaya yang sudah dipelajari tidak menguap.'
              }
              action={
                exam ? null : (
                  <button type="button" onClick={onOpenExam} className={BTN_SECONDARY} data-testid="home-review-go">
                    Mulai latihan ulang
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )
              }
            />
          ) : null}
          {weakness ? (
            <Item
              testId="home-today-weakness"
              icon={Target}
              tone="border-rose-500/30 bg-rose-500/10 text-rose-300"
              title={`Paling sering keliru minggu ini: ${weakness.label} (${weakness.count}×)`}
              detail="Peta Kelemahan menunjukkan misi dan materi untuk memperbaikinya."
              action={
                <button type="button" onClick={onOpenProgress} className={BTN_SECONDARY} data-testid="home-weakness-go">
                  Lihat Peta Kelemahan
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              }
            />
          ) : null}
          {streak.active > 0 ? (
            <Item
              testId="home-today-streak"
              icon={Flame}
              tone={streak.activeToday ? 'border-orange-500/30 bg-orange-500/10 text-orange-300' : 'border-slate-700 bg-slate-800/60 text-slate-400'}
              title={
                streak.activeToday ? `Streak ${streak.active} hari — sudah aktif hari ini` : `Streak ${streak.active} hari — belum aktif hari ini`
              }
              detail={
                streak.activeToday
                  ? `Sampai jumpa besok. Rekor terbaikmu ${streak.best} hari.`
                  : 'Selesaikan satu misi atau satu sesi latihan hari ini supaya streak tidak putus.'
              }
              action={null}
            />
          ) : null}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3.5 text-sm text-slate-400" data-testid="home-today-empty">
          Tidak ada yang mendesak hari ini. Lanjutkan misi kapan pun kamu siap.
        </p>
      )}
    </section>
  );
}

interface ItemProps {
  testId: string;
  icon: LucideIcon;
  /** Kelas warna kotak ikon (border, latar, teks) — ditulis utuh oleh pemanggil. */
  tone: string;
  title: ReactNode;
  detail: ReactNode;
  action: ReactNode;
}

function Item({ testId, icon: Icon, tone, title, detail, action }: ItemProps): JSX.Element {
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4" data-testid={testId}>
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${tone}`} aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100">{title}</p>
          <p className="mt-0.5 text-sm text-slate-400">{detail}</p>
        </div>
      </div>
      {action ? <div className="pl-12 sm:pl-0">{action}</div> : null}
    </li>
  );
}

function ExamItem({ exam, onOpen }: { exam: NonNullable<TrackGlance['exam']>; onOpen: () => void }): JSX.Element {
  const remaining = useRemaining(exam.deadline);
  const expired = remaining !== null && remaining <= 0;
  const isExam = exam.purpose === 'exam';
  const answered = `${exam.answered}/${exam.total} dijawab`;

  let detail: ReactNode;
  if (expired) {
    detail = 'Waktu habis — buka untuk mengumpulkan dan melihat nilai';
  } else if (remaining === null) {
    detail = `${answered} · tanpa batas waktu`;
  } else {
    detail = (
      <>
        {answered} · sisa waktu{' '}
        <span className="font-mono font-semibold tabular-nums text-amber-200" data-testid="home-exam-clock">
          {formatCountdown(remaining)}
        </span>
      </>
    );
  }

  return (
    <Item
      testId="home-today-exam"
      icon={ClipboardCheck}
      tone="border-amber-500/30 bg-amber-500/10 text-amber-300"
      title={expired ? (isExam ? 'Ujian menunggu dikumpulkan' : 'Latihan ulang menunggu dikumpulkan') : isExam ? 'Ujian sedang berjalan' : 'Latihan ulang sedang berjalan'}
      detail={detail}
      action={
        <button type="button" onClick={onOpen} className={BTN_SECONDARY} data-testid="home-exam-go">
          {isExam ? 'Kembali ke ujian' : 'Kembali ke latihan'}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      }
    />
  );
}

/** Sisa waktu (ms) menuju `deadline`, diperbarui tiap detik; null bila tanpa batas waktu. */
function useRemaining(deadline: string | null): number | null {
  const due = deadline === null ? Number.NaN : Date.parse(deadline);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Number.isNaN(due)) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    // Lebih rapat dari satu detik supaya angka tidak tampak melompat dua detik.
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [due]);
  return Number.isNaN(due) ? null : Math.max(0, due - now);
}
