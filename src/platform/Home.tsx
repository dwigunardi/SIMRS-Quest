/**
 * Beranda belajar: tempat mendarat setiap kali aplikasi dibuka. Bukan halaman pemasaran — isinya "lanjut dari mana",
 * apa yang relevan hari ini, dan jalur yang ada.
 *
 * Beranda RINGAN: tidak memuat mesin SQL dan tidak mengimpor data misi secara statis. Ringkasan diambil lewat
 * manifest.glance() (impor dinamis) yang hanya membaca localStorage; selama itu berlangsung tampil kerangka.
 * Penanda untuk uji E2E: [data-testid="home"] dengan data-ready="true" setelah ringkasan siap.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Flame, Info, Sparkles, TriangleAlert, X } from 'lucide-react';
import { browserStorage } from '../lib/storageGuard';
import { HOME_INTRO_KEY, QUARANTINE_ACK_KEY } from '../lib/storageKeys';
import { BrandMark } from './BrandMark';
import { PRODUCT_NAME } from './brand';
import { ContinueCard } from './home/ContinueCard';
import { RestorePanel } from './home/RestorePanel';
import { Today, hasTodayItems } from './home/Today';
import { TrackList } from './home/TrackList';
import { BTN_ICON, BTN_PRIMARY, BTN_SECONDARY, LINK } from './home/ui';
import { useBackupRestore } from './home/useBackupRestore';
import { useTrackGlance } from './home/useTrackGlance';
import { Welcome } from './home/Welcome';
import { formatRoute, navigate, type Route } from './router';
import { TRACKS, type TrackGlance, type TrackManifest } from './tracks';

export interface HomeProps {
  /** Pemberitahuan satu baris dari shell (mis. tautan ke jalur yang belum tersedia). */
  notice: string | null;
  onDismissNotice: () => void;
}

/** Jalur utama Beranda: jalur 'tersedia' pertama. Ringkasan, "Lanjutkan", dan "Hari ini" berasal dari sini. */
const PRIMARY: TrackManifest | undefined = TRACKS.find((t) => t.status === 'tersedia');

/** Jeda sebelum chunk jalur utama dihangatkan bila browser tidak punya requestIdleCallback. */
const PREWARM_FALLBACK_MS = 800;

function readStored(key: string): string | null {
  try {
    return browserStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    browserStorage()?.setItem(key, value);
  } catch {
    /* penyimpanan penuh/diblokir — cukup berlaku untuk sesi ini */
  }
}

/** Waktu (ms) dari nilai tersimpan berupa ISO polos atau string JSON; NaN bila tidak terbaca. */
function storedTime(raw: string | null): number {
  if (raw === null) return Number.NaN;
  let text = raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'string') text = parsed;
  } catch {
    /* ISO polos */
  }
  return Date.parse(text);
}

function trackRoute(track: TrackManifest, ...rest: string[]): Route {
  return { kind: 'track', trackId: track.id, rest };
}

export function Home({ notice, onDismissNotice }: HomeProps): JSX.Element {
  const state = useTrackGlance(PRIMARY);
  const glance = state.status === 'ready' ? state.glance : null;
  const ready = glance !== null;
  const started = glance?.started ?? null;
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Beranda selalu mulai dari atas (posisi gulir jalur yang ditinggalkan tidak terbawa).
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Tombol utama mendapat fokus begitu ringkasan siap, supaya Enter langsung masuk — kecuali pengguna sudah
  // memindahkan fokus sendiri selama kerangka tampil.
  useEffect(() => {
    if (!ready) return;
    const focused = document.activeElement;
    if (focused === null || focused === document.body) primaryRef.current?.focus({ preventScroll: true });
  }, [ready]);

  // Saat Beranda diam, ambil chunk jalur utama lebih dulu supaya "Lanjutkan" terasa seketika. Ini hanya mengunduh kode;
  // mesin SQL (WASM) baru dimuat ketika jalurnya benar-benar dibuka.
  useEffect(() => {
    const load = PRIMARY?.load;
    if (!ready || !load) return undefined;
    const warm = () => {
      void load().catch(() => undefined); // gagal di sini tidak apa-apa; dicoba lagi saat jalur dibuka
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(warm, PREWARM_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [ready]);

  /* ---- Catatan sekali tampil untuk pengguna lama ---- */
  const [introSeen, setIntroSeen] = useState(() => readStored(HOME_INTRO_KEY) !== null);
  const markIntroSeen = useCallback(() => {
    writeStored(HOME_INTRO_KEY, new Date().toISOString());
    setIntroSeen(true);
  }, []);
  // Pengguna baru tidak perlu diberi tahu bahwa Beranda itu baru: kuncinya langsung diisi tanpa menampilkan catatan.
  useEffect(() => {
    if (started === false && !introSeen) markIntroSeen();
  }, [started, introSeen, markIntroSeen]);
  const showIntro = started === true && !introSeen;

  /* ---- Peringatan karantina ---- */
  const [ackAt, setAckAt] = useState(() => storedTime(readStored(QUARANTINE_ACK_KEY)));
  const quarantinedAt = glance?.quarantinedAt ?? null;
  const quarantineTime = quarantinedAt === null ? Number.NaN : Date.parse(quarantinedAt);
  const showQuarantine = quarantinedAt !== null && !(quarantineTime <= ackAt);
  const ackQuarantine = useCallback(() => {
    if (quarantinedAt === null) return;
    writeStored(QUARANTINE_ACK_KEY, quarantinedAt);
    setAckAt(Date.parse(quarantinedAt));
  }, [quarantinedAt]);

  // Memulihkan dari cadangan adalah tindak lanjut peringatan karantina, jadi peringatannya ikut dianggap selesai.
  const restore = useBackupRestore(ackQuarantine);

  /** Pindah lewat kontrol Beranda. Catatan sekali tampil dianggap sudah dibaca begitu pengguna melangkah. */
  const go = (route: Route) => {
    if (showIntro) markIntroSeen();
    navigate(route);
  };

  const restorePanel = <RestorePanel restore={restore} />;
  /** Pengguna baru melihat hasil memilih file di bawah sambutan; pengguna lama di kelompok pemberitahuan paling atas. */
  const restoreOnTop = started === true && restore.state.kind !== 'idle';

  return (
    <div data-testid="home" data-ready={ready ? 'true' : 'false'} className="relative min-h-screen bg-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-emerald-500/[0.07] to-transparent" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-[960px] flex-col gap-8 px-4 pb-10 pt-5 sm:px-6 sm:pb-14 sm:pt-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-100">{PRODUCT_NAME}</h1>
          </div>
          <StreakPill streak={glance?.streak ?? null} />
        </header>

        <main className="flex flex-col gap-8">
          {notice !== null || showQuarantine || restoreOnTop ? (
            <div className="flex flex-col gap-3">
              {notice !== null ? (
                <div role="status" className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] py-2 pl-4 pr-2 text-sm text-amber-100" data-testid="home-notice">
                  <Info className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                  <p className="min-w-0 flex-1 break-words">{notice}</p>
                  <button type="button" onClick={onDismissNotice} className={BTN_ICON} aria-label="Tutup pemberitahuan">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : null}
              {showQuarantine && quarantinedAt !== null ? <QuarantineAlert at={quarantinedAt} onRestore={restore.pick} onDismiss={ackQuarantine} /> : null}
              {/* Untuk pengguna lama, hasil memilih file tampil tepat di bawah peringatan yang memicunya. */}
              {restoreOnTop ? restorePanel : null}
            </div>
          ) : null}

          {state.status === 'error' ? (
            <GlanceError
              track={PRIMARY}
              onOpen={() => {
                if (PRIMARY) go(trackRoute(PRIMARY));
              }}
              primaryRef={primaryRef}
            />
          ) : glance === null || PRIMARY === undefined ? (
            <HomeSkeleton />
          ) : glance.started ? (
            <>
              {showIntro ? (
                <div className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/[0.08] py-2.5 pl-4 pr-2 text-sm text-sky-100" data-testid="home-intro">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden />
                  <p className="min-w-0 flex-1 py-0.5 leading-relaxed">
                    <strong className="font-semibold">Sekarang ada Beranda.</strong> Progres {PRIMARY.title}-mu utuh — tekan Lanjutkan untuk kembali ke misi terakhir.
                  </p>
                  <button type="button" onClick={markIntroSeen} className={BTN_ICON} aria-label="Tutup catatan">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : null}
              <ContinueCard track={PRIMARY} glance={glance} onOpen={() => go(trackRoute(PRIMARY))} primaryRef={primaryRef} />
              <Today glance={glance} onOpenExam={() => go(trackRoute(PRIMARY, 'ujian'))} onOpenProgress={() => go(trackRoute(PRIMARY, 'progres'))} />
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <Welcome track={PRIMARY} onStart={() => go(trackRoute(PRIMARY))} onRestore={restore.pick} primaryRef={primaryRef} />
                {restorePanel}
              </div>
              {hasTodayItems(glance) ? (
                <Today glance={glance} onOpenExam={() => go(trackRoute(PRIMARY, 'ujian'))} onOpenProgress={() => go(trackRoute(PRIMARY, 'progres'))} />
              ) : null}
            </>
          )}

          <TrackList tracks={TRACKS} glanceTrackId={PRIMARY?.id} glance={glance} onOpen={(track) => go(trackRoute(track))} />
        </main>

        <footer className="border-t border-slate-800/80 pt-5 text-sm text-slate-400">
          <p>
            Progres tersimpan hanya di browser ini.
            {PRIMARY ? (
              <>
                {' '}
                <a
                  href={formatRoute(trackRoute(PRIMARY, 'progres'))}
                  onClick={() => {
                    if (showIntro) markIntroSeen();
                  }}
                  className={`${LINK} whitespace-nowrap`}
                  data-testid="home-backup-link"
                >
                  Cadangkan progres
                </a>
              </>
            ) : null}
          </p>
        </footer>
      </div>

      <input
        ref={restore.inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Pilih file cadangan progres"
        data-testid="home-restore-file"
        onChange={restore.onFile}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bagian kecil                                                        */
/* ------------------------------------------------------------------ */

function StreakPill({ streak }: { streak: TrackGlance['streak'] | null }): JSX.Element {
  if (streak === null) return <div className="h-9 w-24 shrink-0 animate-pulse rounded-lg bg-slate-800/70" aria-hidden />;
  const lit = streak.active > 0;
  return (
    <div
      title={`Streak harian — terbaik: ${streak.best} hari`}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold ${
        lit ? 'border-orange-500/30 bg-orange-500/10 text-orange-300' : 'border-slate-700 bg-slate-800/60 text-slate-400'
      }`}
      data-testid="home-streak"
    >
      <Flame className="h-4 w-4" aria-hidden />
      <span className="sr-only">Streak </span>
      <span className="tabular-nums">{streak.active}</span>
      <span className="text-xs opacity-80">hari</span>
    </div>
  );
}

/** Kerangka selama ringkasan dimuat; tingginya mendekati kartu sesungguhnya supaya isi di bawahnya tidak melompat. */
function HomeSkeleton(): JSX.Element {
  return (
    <div role="status" data-testid="home-skeleton">
      <span className="sr-only">Memuat ringkasan belajar…</span>
      <div className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:h-56 sm:p-7" aria-hidden>
        <div className="h-4 w-32 rounded bg-slate-800" />
        <div className="mt-4 h-7 w-3/4 rounded bg-slate-800" />
        <div className="mt-3 h-4 w-40 rounded bg-slate-800" />
        <div className="mt-10 h-2 w-full rounded-full bg-slate-800" />
      </div>
    </div>
  );
}

function GlanceError({ track, onOpen, primaryRef }: { track: TrackManifest | undefined; onOpen: () => void; primaryRef: RefObject<HTMLButtonElement> }): JSX.Element {
  return (
    <section role="alert" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7" data-testid="home-glance-error">
      <h2 className="text-lg font-semibold text-slate-100">Ringkasan belajar tidak bisa dimuat</h2>
      <p className="mt-1.5 text-sm text-slate-400">Progresmu tidak terpengaruh. Coba muat ulang halaman{track ? ', atau langsung buka jalurnya' : ''}.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {track ? (
          <button ref={primaryRef} type="button" onClick={onOpen} className={BTN_PRIMARY} data-testid="home-primary">
            Buka jalur {track.title}
          </button>
        ) : null}
        <button type="button" onClick={() => window.location.reload()} className={BTN_SECONDARY}>
          Muat ulang
        </button>
      </div>
    </section>
  );
}

function QuarantineAlert({ at, onRestore, onDismiss }: { at: string; onRestore: () => void; onDismiss: () => void }): JSX.Element {
  const when = new Date(at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-4" data-testid="home-quarantine">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-rose-100">Sebagian data progres tersimpan tidak bisa dibaca</h2>
          <p className="mt-1 text-sm leading-relaxed text-rose-100/90">
            Terdeteksi pada {when}. Salinan aslinya sudah diamankan di browser ini dan tidak dihapus, tetapi bagian itu sekarang mulai dari kosong.
            Sebaiknya pulihkan dari file cadangan bila punya.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onRestore} className={BTN_SECONDARY} data-testid="home-quarantine-restore">
              Pulihkan dari file cadangan
            </button>
            <button type="button" onClick={onDismiss} className={BTN_SECONDARY} data-testid="home-quarantine-dismiss">
              Mengerti, tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
