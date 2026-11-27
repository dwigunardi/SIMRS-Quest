/**
 * Beranda: landing satu halaman sekaligus tempat mendarat setiap kali aplikasi dibuka. Pengguna baru melihat apa isi
 * aplikasi ini; pengguna lama melihat "lanjut dari mana" dan apa yang relevan hari ini di bagian paling atas.
 *
 * Beranda RINGAN: tidak memuat mesin SQL dan tidak mengimpor data misi secara statis. Ringkasan progres diambil lewat
 * manifest.glance() (impor dinamis) yang hanya membaca localStorage. Bagian di bawah lipatan (landing/LandingBelow)
 * dimuat malas sebagai satu chunk.
 *
 * Posisi gulir: datang lewat navigasi biasa (tombol Beranda, tautan, pengalihan) → mulai dari atas; datang lewat
 * tombol Kembali/Maju browser → kembali ke posisi terakhir di halaman ini (disimpan di history.state entri Beranda).
 *
 * Tema terang/gelap berlaku untuk seluruh aplikasi (src/platform/theme.ts): pilihan di Beranda juga berlaku di layar
 * jalur dan sebaliknya. LandingRoot hanya menambahkan penanda data-q-landing selama Beranda tampil.
 *
 * Penanda untuk uji E2E: [data-testid="home"] dengan data-ready="true" setelah ringkasan siap.
 */
import { Component, Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { browserStorage } from '../lib/storageGuard';
import { HOME_INTRO_KEY, QUARANTINE_ACK_KEY, SQL_KEY_PREFIX } from '../lib/storageKeys';
import { useBackupRestore } from './home/useBackupRestore';
import { useTrackGlance } from './home/useTrackGlance';
import { HOME } from './landing/lib/content';
import { prefersReducedMotion } from './landing/lib/scroll';
import { CategoryMarquee } from './landing/sections/CategoryMarquee';
import { Footer } from './landing/sections/Footer';
import { Hero, modeOf } from './landing/sections/Hero';
import { Navbar } from './landing/sections/Navbar';
import { GlanceErrorAlert, IntroNote, NoticeBar, Notices, QuarantineAlert } from './landing/sections/Notices';
import { RestorePanel } from './landing/sections/RestorePanel';
import { TodayStrip } from './landing/sections/TodayStrip';
import { Button3D } from './landing/ui/Button3D';
import { LandingRoot } from './landing/ui/LandingRoot';
import { Container } from './landing/ui/Section';
import type { LandingBelowProps } from './landing/LandingBelow';
import { navigate, parseRoute } from './router';
import { TRACKS, getTrack, type TrackManifest } from './tracks';

export interface HomeProps {
  /** Pemberitahuan satu baris dari shell (mis. tautan ke jalur yang belum tersedia). */
  notice: string | null;
  onDismissNotice: () => void;
}

/** Jalur utama Beranda: jalur 'tersedia' pertama. Ringkasan, "Lanjutkan", dan "Hari ini" berasal dari sini. */
const PRIMARY: TrackManifest | undefined = TRACKS.find((t) => t.status === 'tersedia');

/** Awalan kunci localStorage tiap jalur (hanya dipakai sebagai petunjuk "pernah mulai" sebelum ringkasan siap). */
const TRACK_KEY_PREFIX: Readonly<Record<string, string>> = { sql: SQL_KEY_PREFIX };

/** Jeda sebelum chunk jalur utama dihangatkan bila browser tidak punya requestIdleCallback. */
const PREWARM_FALLBACK_MS = 800;

/**
 * Bagian 4–13: satu chunk terpisah. Pabrik lazy-nya dibuat ulang tiap "Coba muat lagi" (React.lazy menyimpan promise
 * yang gagal, jadi komponen lazy yang sama tidak akan pernah mencoba lagi).
 */
function lazyBelow(): ComponentType<LandingBelowProps> {
  return lazy(() => import('./landing/LandingBelow'));
}

/* ---- Posisi gulir Beranda di entri riwayatnya ---- */

const SCROLL_STATE_KEY = 'simrsQuestHomeScroll';
/** Jeda setelah guliran berhenti sebelum posisinya dicatat (history.replaceState dibatasi browser bila terlalu sering). */
const SCROLL_SAVE_MS = 150;

function historyState(): Record<string, unknown> {
  try {
    const state: unknown = window.history.state;
    return typeof state === 'object' && state !== null ? (state as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Posisi gulir yang tercatat di entri riwayat INI (ada hanya bila pengguna pernah menggulir Beranda di entri ini). */
function savedScroll(): number | null {
  const value = historyState()[SCROLL_STATE_KEY];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Catat posisi gulir di entri riwayat saat ini — hanya selama entri itu memang Beranda. */
function saveScroll(): void {
  if (parseRoute(window.location.hash).kind !== 'home') return;
  const y = Math.round(window.scrollY);
  const state = historyState();
  if (state[SCROLL_STATE_KEY] === y) return;
  try {
    window.history.replaceState({ ...state, [SCROLL_STATE_KEY]: y }, '');
  } catch {
    /* dokumen tanpa origin: posisi tidak dicatat */
  }
}

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

/** Buka jalur utama dari awal (tanpa tujuan khusus): jalur sendiri yang memilih misi "Lanjutkan". */
function openPrimary(): void {
  if (PRIMARY) navigate({ kind: 'track', trackId: PRIMARY.id, rest: [] });
}

export function Home({ notice, onDismissNotice }: HomeProps): JSX.Element {
  const state = useTrackGlance(PRIMARY);
  const glance = state.status === 'ready' ? state.glance : null;
  const ready = glance !== null;
  const started = glance?.started ?? null;
  const mode = modeOf(glance, state.status !== 'loading');
  // Petunjuk sinkron sebelum ringkasan tiba: jalur utama pernah menyimpan sesuatu di browser ini.
  const [expectReturning] = useState(() => PRIMARY !== undefined && hasStoredData(PRIMARY.id));

  // Navigasi biasa: mulai dari atas (posisi gulir jalur yang ditinggalkan tidak terbawa). Kembali/Maju browser ke entri
  // Beranda yang pernah digulir: pulihkan posisinya — sekarang (tinggi halaman sudah dipesan BelowFallback) dan sekali
  // lagi setelah bagian bawah benar-benar terpasang, selama pengguna belum menggulir sendiri.
  const restoreTo = useRef<number | null>(null);
  useLayoutEffect(() => {
    restoreTo.current = savedScroll();
    window.scrollTo(0, restoreTo.current ?? 0);
  }, []);
  const onBelowReady = useCallback(() => {
    const target = restoreTo.current;
    if (target === null) return;
    if (Math.abs(window.scrollY - target) < 400) window.scrollTo(0, target);
    restoreTo.current = null;
  }, []);
  useEffect(() => {
    let timer = 0;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(saveScroll, SCROLL_SAVE_MS);
    };
    // Klik (mis. tautan ke jalur) bisa datang sebelum jeda habis: catat dulu, selagi entri riwayatnya masih Beranda.
    const flush = () => {
      window.clearTimeout(timer);
      saveScroll();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', flush, true);
    document.addEventListener('keydown', flush, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', flush, true);
      document.removeEventListener('keydown', flush, true);
    };
  }, []);

  // Pemberitahuan rute muncul di puncak halaman: bawa pengguna ke sana (halaman ini panjang; tanpa ini pemberitahuan
  // bisa muncul ribuan piksel di atas layar dan yang terlihat hanya URL yang berubah).
  useEffect(() => {
    if (notice === null) return;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [notice]);

  /* ---- Bagian bawah (chunk malas) ---- */
  const [belowAttempt, setBelowAttempt] = useState(0);
  // Komponen lazy BARU tiap percobaan (belowAttempt sengaja menjadi satu-satunya dependensi).
  const LandingBelow = useMemo(lazyBelow, [belowAttempt]);
  const retryBelow = useCallback(() => setBelowAttempt((value) => value + 1), []);

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
  // Catatan dianggap sudah dibaca begitu pengguna melangkah ke sebuah jalur — lewat tombol maupun tautan mana pun di
  // halaman ini. Dicatat saat Beranda dilepas KARENA rutenya sudah berpindah ke jalur yang bisa dibuka: pengalihan
  // kembali ke Beranda (jalur belum tersedia) dan pelepasan semu StrictMode tidak memenuhi syarat itu. (Pendengar
  // 'hashchange' tidak bisa dipakai: shell sudah melepas Beranda sebelum pendengar itu sempat dipanggil.)
  useEffect(() => {
    if (!showIntro) return undefined;
    return () => {
      const route = parseRoute(window.location.hash);
      if (route.kind === 'track' && getTrack(route.trackId)?.status === 'tersedia') writeStored(HOME_INTRO_KEY, new Date().toISOString());
    };
  }, [showIntro]);

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

  /* ---- Pulihkan dari file cadangan ---- */
  // Memulihkan dari cadangan adalah tindak lanjut peringatan karantina, jadi peringatannya ikut dianggap selesai.
  const restore = useBackupRestore(ackQuarantine);
  /** Hasil memilih file tampil di dekat kontrol yang memicunya: di bawah peringatan karantina, atau di hero. */
  const [restoreOnTop, setRestoreOnTop] = useState(false);
  const pickFromHero = useCallback(() => {
    setRestoreOnTop(false);
    restore.pick();
  }, [restore.pick]);
  const pickFromAlert = useCallback(() => {
    setRestoreOnTop(true);
    restore.pick();
  }, [restore.pick]);
  const restoreActive = restore.state.kind !== 'idle';

  const hasNotices = notice !== null || state.status === 'error' || showQuarantine || showIntro || (restoreOnTop && restoreActive);

  return (
    <LandingRoot data-testid="home" data-ready={ready ? 'true' : 'false'}>
      <Navbar mode={mode} onStart={openPrimary} />

      <main>
        {hasNotices ? (
          <Notices>
            {notice !== null ? <NoticeBar text={notice} onClose={onDismissNotice} /> : null}
            {state.status === 'error' ? <GlanceErrorAlert /> : null}
            {showQuarantine && quarantinedAt !== null ? <QuarantineAlert at={quarantinedAt} onRestore={pickFromAlert} onDismiss={ackQuarantine} /> : null}
            {/* Hasil memilih file tampil tepat di bawah peringatan yang memicunya. */}
            {restoreOnTop && restoreActive ? <RestorePanel restore={restore} /> : null}
            {showIntro ? <IntroNote trackTitle={PRIMARY?.title ?? ''} onClose={markIntroSeen} /> : null}
          </Notices>
        ) : null}

        <Hero glance={glance} ready={state.status !== 'loading'} expectReturning={expectReturning} onStart={openPrimary} onRestore={pickFromHero}>
          {!restoreOnTop && restoreActive ? <RestorePanel restore={restore} className="mt-5 w-full max-w-[560px]" /> : null}
          {/* Pengguna lama: "Hari ini" tepat di bawah tombol Lanjutkan, sebelum bola dunia (masuk lipatan pertama). */}
          {glance ? <TodayStrip glance={glance} className="mt-8 w-full max-w-[980px]" /> : null}
        </Hero>
        <CategoryMarquee />

        <BelowBoundary key={belowAttempt} onRetry={retryBelow}>
          <Suspense fallback={<BelowFallback />}>
            <LandingBelow glance={glance} onStart={openPrimary} onReady={onBelowReady} />
          </Suspense>
        </BelowBoundary>
      </main>

      <Footer />

      <input
        ref={restore.inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label={HOME.restore.inputLabel}
        data-testid="home-restore-file"
        onChange={restore.onFile}
      />
    </LandingRoot>
  );
}

/* ------------------------------------------------------------------ */
/* Bagian bawah yang dimuat malas                                      */
/* ------------------------------------------------------------------ */

/**
 * Ruang cadangan selama chunk bagian bawah diunduh: kira-kira setinggi isinya di tiap lebar layar, supaya footer tidak
 * "naik" dulu lalu terdorong jauh ke bawah. Hanya hiasan — pembaca layar tidak perlu mendengarnya.
 */
function BelowFallback(): JSX.Element {
  return <div aria-hidden className="min-h-[12500px] sm:min-h-[11000px] lg:min-h-[9000px]" data-testid="home-below-loading" />;
}

/**
 * Bagian bawah gagal (chunk tidak terunduh: jaringan putus, atau tab lama setelah versi baru terbit): bagian atas —
 * tombol utama, "Hari ini", pemulihan cadangan — tetap berfungsi, jadi Beranda tidak dimatikan. Kegagalannya TIDAK
 * didiamkan: satu baris menjelaskan apa yang terjadi dan menawarkan mencoba lagi (induk memasang ulang batas ini
 * dengan komponen lazy baru) atau memuat ulang halaman.
 */
class BelowBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  override state: { failed: boolean } = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <Container className="py-12">
        <div role="alert" className="mx-auto flex max-w-[720px] flex-col items-start gap-3 rounded-q border border-q-amber/60 bg-q-amber-soft p-4 text-q-ink sm:flex-row sm:items-center sm:gap-4" data-testid="home-below-error">
          <p className="m-0 flex-1 text-[15px] leading-relaxed">{HOME.belowError.text}</p>
          <div className="flex shrink-0 flex-wrap gap-2 pb-1">
            <Button3D size="sm" onClick={this.props.onRetry} data-testid="home-below-retry">
              {HOME.belowError.retry}
            </Button3D>
            <Button3D size="sm" variant="outline" onClick={() => window.location.reload()}>
              {HOME.glanceError.reload}
            </Button3D>
          </div>
        </div>
      </Container>
    );
  }
}

/** Jalur `trackId` pernah menyimpan sesuatu di browser ini? (Hanya petunjuk tata letak; kebenarannya datang dari glance.) */
function hasStoredData(trackId: string): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    // Kunci jalur memakai awalan beku per jalur (lihat lib/storageKeys.ts); cukup satu yang cocok.
    const prefix = TRACK_KEY_PREFIX[trackId];
    if (prefix === undefined) return false;
    for (let index = 0; index < storage.length; index += 1) {
      if (storage.key(index)?.startsWith(prefix) === true) return true;
    }
  } catch {
    /* storage diblokir */
  }
  return false;
}
