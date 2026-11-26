/**
 * Layar sementara & layar gagal halaman katalog/landing jalur, dipakai shell (selama chunk tuan rumah halaman
 * diunduh) dan pages/LandingPages.tsx (selama chunk satu halaman diunduh). Keduanya di dalam LandingRoot, jadi tema
 * terang/gelap tidak berkedip ke latar gelap layar jalur. Modul ini ringan (ikut bundel awal bersama shell).
 */
import { Component, type ReactNode } from 'react';
import { HOME_ROUTE, navigate } from '../../router';
import { PAGE_SHELL } from '../lib/content';
import { Button3D } from '../ui/Button3D';
import { LandingRoot } from '../ui/LandingRoot';

/** Selama chunk halaman diunduh: latar bertema + tiga titik berdenyut (berhenti saat gerak dikurangi/dijeda). */
export function PageLoading(): JSX.Element {
  return (
    <LandingRoot data-testid="landing-page-loading">
      <div role="status" className="grid min-h-screen place-items-center px-q-gutter">
        <span className="sr-only">{PAGE_SHELL.loading}</span>
        <span aria-hidden className="flex gap-1.5">
          <span className="q-loop h-2.5 w-2.5 rounded-full bg-q-primary motion-safe:animate-pulse" />
          <span className="q-loop h-2.5 w-2.5 rounded-full bg-q-brand motion-safe:animate-pulse [animation-delay:150ms]" />
          <span className="q-loop h-2.5 w-2.5 rounded-full bg-q-primary motion-safe:animate-pulse [animation-delay:300ms]" />
        </span>
      </div>
    </LandingRoot>
  );
}

export interface PageErrorBoundaryProps {
  children: ReactNode;
  /**
   * Batas yang sedang menampilkan layar gagal dipulihkan (isi dirender ulang) saat nilai ini berubah — mis. rute
   * berikutnya di shell, yang memasang satu batas untuk semua halaman landing (tanpa key per rute, supaya tuan rumah
   * halamannya tetap ter-mount). pages/LandingPages.tsx memasang batasnya dengan key per rute.
   */
  resetKey?: string;
}

/**
 * Chunk halaman gagal diunduh (jaringan putus, atau tab lama setelah versi baru terbit) atau halaman melempar saat
 * render: pesan jelas + "Muat ulang" + jalan pulang ke Beranda. Pindah ke halaman lain memulai percobaan baru (lihat
 * `resetKey`; komponen lazy yang gagal dibuat ulang oleh pemuatnya, jadi chunk-nya benar-benar diunduh lagi).
 */
export class PageErrorBoundary extends Component<PageErrorBoundaryProps, { failed: boolean }> {
  override state: { failed: boolean } = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidUpdate(previous: PageErrorBoundaryProps): void {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <LandingRoot data-testid="landing-page-error">
        <div className="grid min-h-screen place-items-center px-q-gutter">
          <div role="alert" className="flex w-full max-w-[520px] flex-col items-center gap-4 rounded-q-lg border border-q-border bg-q-surface p-8 text-center shadow-q-float">
            <h1 className="m-0 text-q-h3 font-bold text-q-ink">{PAGE_SHELL.error.title}</h1>
            <p className="m-0 text-pretty leading-relaxed text-q-ink-soft">{PAGE_SHELL.error.body}</p>
            <div className="flex flex-wrap justify-center gap-3 pb-1 pt-2">
              <Button3D size="md" onClick={() => window.location.reload()}>
                {PAGE_SHELL.error.reload}
              </Button3D>
              <Button3D size="md" variant="outline" onClick={() => navigate(HOME_ROUTE)}>
                {PAGE_SHELL.error.home}
              </Button3D>
            </div>
          </div>
        </div>
      </LandingRoot>
    );
  }
}
