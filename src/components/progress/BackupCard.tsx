import { useRef, useState, type ChangeEvent } from 'react';
import { Download, HardDriveDownload, Upload } from 'lucide-react';
import { applyBackup, backupFileName, createBackup, parseBackup, summarize, type BackupStorage, type BackupSummary } from '../../lib/backup';

function getStorage(): BackupStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function describe(s: BackupSummary): string {
  return `${s.xp.toLocaleString('id-ID')} XP, ${s.completed} misi selesai, ${s.mistakes} catatan kesalahan, ${s.articlesRead} materi dibaca, ${s.exams} ujian`;
}

function formatDate(iso: string): string {
  if (!iso) return 'tanggal tidak diketahui';
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

type Status = { kind: 'error' | 'info'; text: string } | null;

/** Ekspor/impor progres sebagai file JSON — progres hanya tersimpan di browser ini. */
export function BackupCard(): JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);

  const exportBackup = () => {
    const storage = getStorage();
    if (!storage) {
      setStatus({ kind: 'error', text: 'Browser ini tidak mengizinkan akses penyimpanan, jadi tidak ada progres yang bisa diekspor.' });
      return;
    }
    const now = new Date();
    const backup = createBackup(storage, now);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName(now);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({ kind: 'info', text: `Cadangan diunduh: ${link.download} (${describe(summarize(backup))}).` });
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // file yang sama bisa dipilih lagi
    if (!file) return;
    const storage = getStorage();
    if (!storage) {
      setStatus({ kind: 'error', text: 'Browser ini tidak mengizinkan akses penyimpanan, jadi cadangan tidak bisa diimpor.' });
      return;
    }
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setStatus({ kind: 'error', text: parsed.error });
      return;
    }
    const current = summarize(createBackup(storage, new Date()));
    const ok = window.confirm(
      `Impor cadangan dari ${formatDate(parsed.summary.exportedAt)}?\n\n` +
        `Cadangan: ${describe(parsed.summary)}.\n` +
        `Saat ini: ${describe(current)}.\n\n` +
        'Progres saat ini akan DIGANTI (tidak digabung), lalu halaman dimuat ulang. Ekspor dulu bila ingin menyimpan progres saat ini.',
    );
    if (!ok) return;
    const written = applyBackup(storage, parsed.backup);
    // Pesan di halaman akan hilang saat dimuat ulang, jadi kegagalan ditampilkan lewat alert.
    if (!written) window.alert('Browser menolak menyimpan data (penyimpanan penuh atau diblokir). Progres mungkin hanya terimpor sebagian.');
    window.location.reload();
  };

  return (
    <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <HardDriveDownload className="h-4 w-4 text-sky-400" aria-hidden />
        Cadangan progres
      </h3>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Progres, riwayat kesalahan, materi yang sudah dibaca, dan riwayat ujian hanya tersimpan di browser ini. Ekspor ke file untuk
        berjaga-jaga atau untuk pindah ke komputer lain, lalu impor di sana.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportBackup}
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Ekspor ke file
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          Impor dari file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Pilih file cadangan progres"
          data-testid="backup-file"
          onChange={(event) => void importBackup(event)}
        />
      </div>
      {status ? (
        <p role={status.kind === 'error' ? 'alert' : 'status'} className={`text-[11px] leading-relaxed ${status.kind === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>
          {status.text}
        </p>
      ) : null}
    </section>
  );
}
