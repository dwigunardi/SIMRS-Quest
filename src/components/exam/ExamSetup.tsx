import { useState } from 'react';
import { ClipboardCheck, Clock, ListOrdered, Play, ShieldAlert } from 'lucide-react';
import { MISSIONS, TIERS } from '../../data/missions';
import { EXAM_COUNTS, EXAM_MINUTES, eligibleMissions, type ExamConfig } from '../../lib/exam';
import type { Tier, UserProgress } from '../../types';

export interface ExamSetupProps {
  progress: UserProgress;
  onStart: (config: ExamConfig) => { ok: true; shortBy: number } | { ok: false; message: string };
}

const OPTION = 'rounded-lg border px-3 py-1.5 text-sm font-medium transition';
const ON = 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200';
const OFF = 'border-slate-700 text-slate-300 hover:border-slate-500';
/**
 * Tier tanpa soal (terkunci) di tema terang: opacity-50 membuat teks di latar terang jauh di bawah AA, jadi diganti isian
 * abu-abu + teks redup slate-500 (tetap terbaca; checkbox nonaktif & "0 soal" menandai tidak bisa dipilih).
 */
const LOCKED_LIGHT = 'light:bg-slate-900 light:opacity-100';

/** Layar pengaturan ujian: pilih tier, jumlah soal, dan batas waktu. */
export function ExamSetup({ progress, onStart }: ExamSetupProps): JSX.Element {
  const available = new Map(TIERS.map((t) => [t.tier, eligibleMissions(MISSIONS, progress, [t.tier]).length]));
  const [tiers, setTiers] = useState<Tier[]>(() => TIERS.filter((t) => (available.get(t.tier) ?? 0) > 0).map((t) => t.tier));
  const [count, setCount] = useState<number>(10);
  const [minutes, setMinutes] = useState<number | null>(30);
  const [error, setError] = useState<string | null>(null);

  const pool = tiers.reduce((sum, t) => sum + (available.get(t) ?? 0), 0);
  const toggle = (tier: Tier) => setTiers((prev) => (prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier].sort((a, b) => a - b)));

  const start = () => {
    const result = onStart({ tiers, count, minutes });
    setError(result.ok ? null : result.message);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-50">
          <ClipboardCheck className="h-6 w-6 text-emerald-400" aria-hidden />
          Mode Ujian
        </h2>
        <p className="text-sm leading-relaxed text-slate-400">
          Soal acak dari misi yang sudah terbuka, tanpa hint dan tanpa tahu benar/salah sampai dikumpulkan — cocok untuk menguji
          ingatan atau persiapan tes kerja. Kamu boleh menjalankan query untuk melihat hasilnya, seperti ujian sungguhan.
        </p>
      </div>

      <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tier yang diujikan</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {TIERS.map((t) => {
            const n = available.get(t.tier) ?? 0;
            const checked = tiers.includes(t.tier);
            return (
              <label
                key={t.tier}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  n === 0 ? `cursor-not-allowed border-slate-800 opacity-50 ${LOCKED_LIGHT}` : checked ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <input type="checkbox" className="accent-emerald-500" checked={checked} disabled={n === 0} onChange={() => toggle(t.tier)} />
                <span className={`min-w-0 flex-1 truncate text-slate-200 ${n === 0 ? 'light:text-slate-500' : ''}`}>
                  Tier {t.tier}: {t.name}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">{n} soal</span>
              </label>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500">
          Soal berasal dari misi SQL, Perbaiki Bug, DDL, dan Tebak Hasil yang sudah terbuka. Kartu konsep, lab injection, dan
          Boss Challenge tidak ikut.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <ListOrdered className="h-3.5 w-3.5" aria-hidden /> Jumlah soal
          </h3>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Jumlah soal">
            {EXAM_COUNTS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={count === n} onClick={() => setCount(n)} className={`${OPTION} ${count === n ? ON : OFF}`}>
                {n} soal
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Clock className="h-3.5 w-3.5" aria-hidden /> Batas waktu
          </h3>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Batas waktu">
            {EXAM_MINUTES.map((m) => (
              <button key={String(m)} type="button" role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)} className={`${OPTION} ${minutes === m ? ON : OFF}`}>
                {m === null ? 'Tanpa batas' : `${m} menit`}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={pool === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 light:disabled:bg-slate-800 light:disabled:text-slate-500 light:disabled:opacity-100 light:disabled:shadow-none"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden />
          Mulai ujian
        </button>
        <span className="text-xs text-slate-400">
          {pool === 0
            ? 'Belum ada soal di tier yang dipilih.'
            : pool < count
              ? `Hanya ${pool} soal tersedia — ujian berisi ${pool} soal.`
              : `${count} soal dari ${pool} yang tersedia.`}
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      ) : null}

      <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-slate-300 light:border-amber-700/40 light:bg-amber-950/20">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        Ujian tidak memberi XP dan tidak mengubah status misi. Jawaban salah dicatat di Peta Kelemahan. Mode lain tetap bisa dibuka
        selama ujian — kejujuranmu yang membuat hasilnya bermakna. Waktu terus berjalan walau halaman di-refresh.
      </p>
    </div>
  );
}
