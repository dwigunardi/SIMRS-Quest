/**
 * Hasil memilih file cadangan di Beranda: pesan penolakan (file salah — tidak ada yang berubah) atau ringkasan isi file
 * dengan konfirmasi. Konfirmasi ada di halaman (bukan dialog browser) supaya ringkasannya bisa dibaca dengan tenang.
 * Alurnya sendiri (baca → validasi → tulis → muat ulang) ada di platform/home/useBackupRestore.ts.
 */
import { useEffect, useRef } from 'react';
import { FileCheck2, TriangleAlert } from 'lucide-react';
import type { BackupRestore } from '../../home/useBackupRestore';
import { cn } from '../lib/cn';
import { HOME } from '../lib/content';
import { Button3D } from '../ui/Button3D';

export interface RestorePanelProps {
  restore: BackupRestore;
  className?: string;
}

const TEXT = HOME.restore;
const TITLE_ID = 'home-restore-title';

export function RestorePanel({ restore, className }: RestorePanelProps): JSX.Element | null {
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
      <p role="status" className={cn('m-0 rounded-q border border-q-border bg-q-muted px-4 py-3 text-left text-[15px] text-q-ink', className)}>
        {TEXT.reading}
      </p>
    );
  }

  if (state.kind === 'error') {
    return (
      <div
        role="alert"
        className={cn('flex flex-col gap-4 rounded-q border border-q-coral/50 bg-q-coral-soft p-4 text-left text-q-ink sm:flex-row sm:items-center', className)}
        data-testid="home-restore-error"
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <TriangleAlert aria-hidden className="mt-0.5 h-[18px] w-[18px] shrink-0 text-q-coral-ink" />
          <div className="min-w-0 text-[15px] leading-relaxed">
            <p className="m-0 font-bold">{TEXT.errorTitle}</p>
            <p className="m-0 mt-0.5">
              {state.text} {TEXT.errorTail}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pb-1 pl-[30px] sm:pl-0">
          <Button3D size="sm" variant="outline" onClick={restore.pick}>
            {TEXT.pickAnother}
          </Button3D>
          <Button3D size="sm" variant="outline" onClick={restore.cancel}>
            {TEXT.close}
          </Button3D>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={confirmRef}
      tabIndex={-1}
      role="group"
      aria-labelledby={TITLE_ID}
      className={cn('rounded-q border border-q-primary/40 bg-q-surface p-4 text-left text-q-ink shadow-q-float sm:p-5', className)}
      data-testid="home-restore-confirm"
    >
      <div className="flex items-start gap-3.5">
        <FileCheck2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-q-primary-ink" />
        <div className="min-w-0 flex-1">
          {/* Bukan heading: panel ini bisa tampil di tumpukan pemberitahuan, sebelum h1 halaman. */}
          <p id={TITLE_ID} className="m-0 text-base font-bold leading-snug text-q-ink">
            {TEXT.confirmTitle(state.exportedAt)}
          </p>
          <dl className="m-0 mt-3 flex flex-col gap-2.5 text-[15px] leading-relaxed">
            <div>
              <dt className="font-bold text-q-ink">{TEXT.incomingLabel}</dt>
              <dd className="m-0 text-q-ink-soft" data-testid="home-restore-summary">
                {state.incoming}.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-q-ink">{TEXT.currentLabel}</dt>
              <dd className="m-0 text-q-ink-soft">{state.current === null ? TEXT.currentEmpty : TEXT.currentReplaced(state.current)}</dd>
            </div>
          </dl>
          <p className="m-0 mt-3 text-sm text-q-ink-soft">{TEXT.reloadNote}</p>
          <div className="mt-4 flex flex-wrap gap-3 pb-1">
            <Button3D size="sm" onClick={restore.confirm} data-testid="home-restore-apply">
              {TEXT.apply}
            </Button3D>
            <Button3D size="sm" variant="outline" onClick={restore.cancel} data-testid="home-restore-cancel">
              {TEXT.cancel}
            </Button3D>
          </div>
        </div>
      </div>
    </div>
  );
}
