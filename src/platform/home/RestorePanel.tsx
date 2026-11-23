import { useEffect, useRef } from 'react';
import { FileCheck2, TriangleAlert } from 'lucide-react';
import type { BackupRestore } from './useBackupRestore';
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS_RING } from './ui';

/**
 * Hasil memilih file cadangan di Beranda: pesan penolakan (file salah — tidak ada yang berubah) atau ringkasan isi file
 * dengan konfirmasi. Konfirmasi ada di halaman (bukan dialog browser) supaya ringkasannya bisa dibaca dengan tenang.
 */
export function RestorePanel({ restore }: { restore: BackupRestore }): JSX.Element | null {
  const { state } = restore;
  const confirmRef = useRef<HTMLDivElement>(null);
  const confirming = state.kind === 'confirm';

  // Konfirmasi muncul jauh dari tombol yang memicunya (lewat pemilih file) — pindahkan fokus ke sana.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  if (state.kind === 'idle') return null;

  if (state.kind === 'reading') {
    return (
      <p role="status" className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
        Membaca file cadangan…
      </p>
    );
  }

  if (state.kind === 'error') {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] px-4 py-3.5 sm:flex-row sm:items-center" data-testid="home-restore-error">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-rose-100">File tidak dipulihkan</p>
            <p className="mt-0.5 text-rose-200/90">{state.text} Tidak ada data yang diubah.</p>
          </div>
        </div>
        <div className="flex gap-2 pl-7 sm:pl-0">
          <button type="button" onClick={restore.pick} className={BTN_SECONDARY}>
            Pilih file lain
          </button>
          <button type="button" onClick={restore.cancel} className={BTN_SECONDARY}>
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={confirmRef}
      tabIndex={-1}
      role="group"
      aria-labelledby="home-restore-title"
      className={`rounded-xl border border-sky-500/30 bg-sky-500/[0.07] p-4 sm:p-5 ${FOCUS_RING}`}
      data-testid="home-restore-confirm"
    >
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 id="home-restore-title" className="text-base font-semibold text-slate-100">
            Pulihkan cadangan dari {state.exportedAt}?
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="font-medium text-slate-200">Isi file</dt>
              <dd className="text-slate-300" data-testid="home-restore-summary">
                {state.incoming}.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-200">Di browser ini sekarang</dt>
              <dd className="text-slate-300">
                {state.current === null ? 'Belum ada progres, jadi tidak ada yang tertimpa.' : `${state.current}. Semuanya akan DIGANTI (tidak digabung) dengan isi file.`}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-slate-400">Setelah dipulihkan, halaman dimuat ulang.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={restore.confirm} className={BTN_PRIMARY} data-testid="home-restore-apply">
              Ya, pulihkan
            </button>
            <button type="button" onClick={restore.cancel} className={BTN_SECONDARY} data-testid="home-restore-cancel">
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
