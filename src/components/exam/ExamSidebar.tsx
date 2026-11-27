import { ClipboardCheck, Clock, History, Send, Trash2, X } from 'lucide-react';
import { MISSIONS, getMissionById } from '../../data/missions';
import { formatClock, isAnswered, isExamMission, summarizeExam, type ExamRecord } from '../../lib/exam';
import type { ExamApi } from '../../hooks/useExam';

export interface ExamSidebarProps {
  exam: ExamApi;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Panel kiri Mode Ujian: timer + navigasi soal saat ujian berjalan, atau riwayat ujian. */
export function ExamSidebar({ exam }: ExamSidebarProps): JSX.Element {
  const { session } = exam;
  if (!session) return <HistoryList exam={exam} />;

  const missions = session.missionIds.map((id) => getMissionById(id)).filter((m) => m !== undefined && isExamMission(m));
  const answered = missions.filter((m) => isExamMission(m) && isAnswered(m, session.answers[m.id])).length;
  const urgent = exam.remaining !== null && exam.remaining < 60_000;

  const submit = () => {
    const left = missions.length - answered;
    const ask = left > 0 ? `${left} soal belum dijawab dan akan dihitung salah. Kumpulkan sekarang?` : 'Kumpulkan semua jawaban sekarang?';
    if (window.confirm(ask)) exam.submit();
  };
  const abandon = () => {
    const what = session.purpose === 'review' ? 'latihan ulang ini? Jadwal tidak berubah' : 'ujian ini? Jawaban dibuang dan tidak dinilai';
    if (window.confirm(`Batalkan ${what}.`)) exam.abandon();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-emerald-400" aria-hidden />
        <h2 className="text-base font-semibold text-slate-100">{session.purpose === 'review' ? 'Latihan ulang' : 'Ujian berjalan'}</h2>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 ${urgent ? 'border-rose-500/50 bg-rose-500/10' : 'border-slate-800 bg-slate-900/60'}`}
        role="timer"
        aria-live={urgent ? 'assertive' : 'off'}
        aria-label="Sisa waktu"
      >
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Sisa waktu
        </p>
        <p className={`font-mono text-3xl font-bold tabular-nums ${urgent ? 'text-rose-300' : 'text-slate-100'}`} data-testid="exam-clock">
          {exam.remaining === null ? (session.purpose === 'review' ? 'Santai' : 'Tanpa batas') : formatClock(exam.remaining)}
        </p>
        <p className="text-xs text-slate-500">
          {answered}/{missions.length} soal dijawab
        </p>
      </div>

      <nav aria-label="Daftar soal" className="space-y-2">
        <div className="grid grid-cols-5 gap-2">
          {missions.map((m, i) => {
            const done = isExamMission(m) && isAnswered(m, session.answers[m.id]);
            const active = i === exam.current;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => exam.setCurrent(i)}
                aria-current={active ? 'step' : undefined}
                aria-label={`Soal ${i + 1}${done ? ', sudah dijawab' : ', belum dijawab'}`}
                className={`h-10 rounded-lg border text-sm font-semibold tabular-nums transition ${
                  done ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'
                } ${active ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950' : ''}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500">Hijau = sudah diisi (berbeda dari isi awal). Jawaban tersimpan otomatis.</p>
      </nav>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={exam.grading !== null}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50 light:disabled:bg-slate-800 light:disabled:text-slate-500 light:disabled:opacity-100 light:disabled:shadow-none"
        >
          <Send className="h-4 w-4" aria-hidden /> Kumpulkan jawaban
        </button>
        <button type="button" onClick={abandon} disabled={exam.grading !== null} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200">
          <X className="h-3.5 w-3.5" aria-hidden /> {session.purpose === 'review' ? 'Batalkan latihan' : 'Batalkan ujian'}
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Tanpa hint dan tanpa penilaian selama ujian. Saat waktu habis, jawaban dikumpulkan otomatis — juga bila kamu sedang membuka
        mode lain.
      </p>
    </div>
  );
}

function HistoryList({ exam }: { exam: ExamApi }) {
  const records = [...exam.history].reverse();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-sky-400" aria-hidden />
        <h2 className="text-base font-semibold text-slate-100">Riwayat ujian & latihan</h2>
        {records.length > 0 ? (
          <button
            type="button"
            onClick={() => window.confirm('Hapus seluruh riwayat ujian? Catatan di Peta Kelemahan tidak ikut terhapus.') && exam.clearHistory()}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          >
            <Trash2 className="h-3 w-3" aria-hidden /> Hapus
          </button>
        ) : null}
      </div>
      {records.length === 0 ? <p className="text-xs text-slate-500">Belum ada ujian. Hasil ujian yang dikumpulkan akan muncul di sini.</p> : null}
      <ul className="space-y-1.5">
        {records.map((r) => (
          <HistoryItem key={r.id} record={r} active={exam.report?.id === r.id} onOpen={() => exam.openReport(r.id)} />
        ))}
      </ul>
      {exam.report ? (
        <button type="button" onClick={() => exam.openReport(null)} className="w-full rounded-lg border border-emerald-500/40 px-3 py-1.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10">
          + Ujian baru
        </button>
      ) : null}
    </div>
  );
}

function HistoryItem({ record, active, onOpen }: { record: ExamRecord; active: boolean; onOpen: () => void }) {
  const s = summarizeExam(record, MISSIONS);
  const tone = s.score >= 80 ? 'text-emerald-300' : s.score >= 50 ? 'text-amber-300' : 'text-rose-300';
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? 'true' : undefined}
        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${active ? 'border-emerald-500/50 bg-slate-800/70' : 'border-slate-800 hover:bg-slate-800/50'}`}
      >
        <span className={`w-12 shrink-0 text-lg font-bold tabular-nums ${tone}`}>{s.score}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-slate-300">
            {record.purpose === 'review' ? <span className="mr-1.5 rounded bg-sky-500/15 px-1.5 py-px text-[10px] font-semibold text-sky-200">Latihan</span> : null}
            {formatDate(record.finishedAt)}
          </span>
          <span className="block text-[11px] text-slate-500">
            {s.correct}/{s.total} benar · {formatClock(s.durationMs)}
            {record.timedOut ? ' · waktu habis' : ''}
          </span>
        </span>
      </button>
    </li>
  );
}
