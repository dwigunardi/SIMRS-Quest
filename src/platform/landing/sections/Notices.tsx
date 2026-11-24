/**
 * Pemberitahuan Beranda, ditumpuk tepat di bawah navbar (di atas hero) supaya tidak terlewat:
 * - NoticeBar        pemberitahuan satu baris dari shell (mis. tautan ke jalur yang belum tersedia)   role="status"
 * - GlanceErrorAlert ringkasan progres gagal dimuat                                                     role="alert"
 * - QuarantineAlert  sebagian data tersimpan tidak terbaca dan sudah diamankan                          role="alert"
 * - IntroNote        catatan sekali tampil untuk pengguna yang progresnya sudah ada sebelum Beranda
 *
 * Semuanya hanya tampilan: kapan muncul dan apa yang terjadi saat ditutup diputuskan Home.tsx. Judul peringatan
 * sengaja BUKAN heading: tumpukan ini berada sebelum h1 halaman, dan role="alert" sudah membuatnya dibacakan.
 */
import type { ReactNode } from 'react';
import { Info, Sparkles, TriangleAlert, X } from 'lucide-react';
import { cn } from '../lib/cn';
import { HOME } from '../lib/content';
import { Button3D } from '../ui/Button3D';
import { Container } from '../ui/Section';

type Tone = 'amber' | 'coral' | 'mint';

// Kelas ditulis utuh per warna supaya terbaca pemindai Tailwind.
const BOX: Record<Tone, string> = {
  amber: 'border-q-amber/60 bg-q-amber-soft',
  coral: 'border-q-coral/50 bg-q-coral-soft',
  mint: 'border-q-primary/30 bg-q-tint',
};
const ICON: Record<Tone, string> = {
  amber: 'text-q-amber-ink',
  coral: 'text-q-coral-ink',
  mint: 'text-q-primary-ink',
};

export interface NoticesProps {
  children: ReactNode;
}

/** Wadah tumpukan pemberitahuan. Render hanya bila ada isinya (jaraknya ikut hilang bila kosong). */
export function Notices({ children }: NoticesProps): JSX.Element {
  return (
    <Container className="pt-4">
      <div role="region" aria-label={HOME.noticesLabel} className="mx-auto flex w-full max-w-[980px] flex-col gap-3">
        {children}
      </div>
    </Container>
  );
}

function CloseButton({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-q text-q-ink transition-colors duration-150 hover:bg-q-ink/10"
    >
      <X aria-hidden className="h-4 w-4" />
    </button>
  );
}

export interface NoticeBarProps {
  text: string;
  onClose: () => void;
}

export function NoticeBar({ text, onClose }: NoticeBarProps): JSX.Element {
  return (
    <div role="status" className={cn('flex items-center gap-3 rounded-q border py-1.5 pl-4 pr-1.5 text-[15px] text-q-ink', BOX.amber)} data-testid="home-notice">
      <Info aria-hidden className={cn('h-[18px] w-[18px] shrink-0', ICON.amber)} />
      <p className="m-0 min-w-0 flex-1 break-words py-1.5 leading-snug">{text}</p>
      <CloseButton label={HOME.notice.close} onClick={onClose} />
    </div>
  );
}

export interface IntroNoteProps {
  /** Judul jalur utama (mis. "SQL"). */
  trackTitle: string;
  onClose: () => void;
}

export function IntroNote({ trackTitle, onClose }: IntroNoteProps): JSX.Element {
  return (
    <div className={cn('flex items-start gap-3 rounded-q border py-1.5 pl-4 pr-1.5 text-[15px] text-q-ink', BOX.mint)} data-testid="home-intro">
      <Sparkles aria-hidden className={cn('mt-2.5 h-[18px] w-[18px] shrink-0', ICON.mint)} />
      <p className="m-0 min-w-0 flex-1 py-2 leading-relaxed">
        <strong className="font-bold">{HOME.intro.lead}</strong> {HOME.intro.body(trackTitle)}
      </p>
      <CloseButton label={HOME.intro.close} onClick={onClose} />
    </div>
  );
}

interface AlertProps {
  testId: string;
  title: string;
  body: string;
  children: ReactNode;
}

function Alert({ testId, title, body, children }: AlertProps): JSX.Element {
  return (
    <div role="alert" className={cn('flex items-start gap-3.5 rounded-q border p-4 text-q-ink sm:p-5', BOX.coral)} data-testid={testId}>
      <TriangleAlert aria-hidden className={cn('mt-0.5 h-5 w-5 shrink-0', ICON.coral)} />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-base font-bold leading-snug text-q-ink">{title}</p>
        <p className="m-0 mt-1.5 max-w-[72ch] text-pretty text-[15px] leading-relaxed text-q-ink">{body}</p>
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-3 pb-1">{children}</div>
      </div>
    </div>
  );
}

export function GlanceErrorAlert(): JSX.Element {
  return (
    <Alert testId="home-glance-error" title={HOME.glanceError.title} body={HOME.glanceError.body}>
      <Button3D size="sm" variant="outline" onClick={() => window.location.reload()}>
        {HOME.glanceError.reload}
      </Button3D>
    </Alert>
  );
}

export interface QuarantineAlertProps {
  /** Waktu (ISO) data dikarantina. */
  at: string;
  onRestore: () => void;
  onDismiss: () => void;
}

export function QuarantineAlert({ at, onRestore, onDismiss }: QuarantineAlertProps): JSX.Element {
  const when = new Date(at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <Alert testId="home-quarantine" title={HOME.quarantine.title} body={HOME.quarantine.body(when)}>
      <Button3D size="sm" onClick={onRestore} data-testid="home-quarantine-restore">
        {HOME.quarantine.restore}
      </Button3D>
      <Button3D size="sm" variant="outline" onClick={onDismiss} data-testid="home-quarantine-dismiss">
        {HOME.quarantine.dismiss}
      </Button3D>
    </Alert>
  );
}
