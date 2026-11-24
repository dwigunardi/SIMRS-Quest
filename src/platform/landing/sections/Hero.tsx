/**
 * Bagian 2 — Hero. Judul "Belajar [kata berganti] gratis", angka kurikulum yang dihitung naik, satu tombol utama, lalu
 * panggungnya: bola dunia berpusat di Indonesia dengan penanda di kota asal pasien pada data latihan, Kapi mengintip
 * dari atasnya, dan (di layar lebar) sebuah query beserta hasilnya — kota-kota yang sama dengan penanda itu.
 *
 * Pengguna baru: "Mulai belajar". Pengguna lama: "Lanjutkan" + misi yang akan dibuka, lalu kartu "Hari ini" (lewat
 * `children`) tepat di bawah tombolnya — sebelum bola dunia, supaya masuk lipatan pertama. Semua misi tuntas, atau
 * ringkasan gagal dimuat: "Buka jalur SQL".
 *
 * Fokus otomatis ke tombol utama HANYA untuk pengguna lama (Enter langsung melanjutkan) dan hanya bila pengguna belum
 * memindahkan fokus sendiri. Pengunjung baru tidak diberi fokus otomatis: di halaman sepanjang ini Spasi dipakai untuk
 * menggulir, dan tombol yang terfokus akan menelannya lalu melempar pengunjung ke jalur.
 */
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { TrackGlance } from '../../tracks';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { Globe } from '../illustrations/Globe';
import { Mascot } from '../illustrations/Mascot';
import { EXPLORE, GLOBE_FOCUS, HERO, PATIENT_CITIES, SECTION_IDS, TRACKS } from '../lib/content';
import { Button3D } from '../ui/Button3D';
import { CountUp } from '../ui/CountUp';
import { Icon } from '../ui/Icon';
import { Section } from '../ui/Section';
import { CityQueryCode, CityQueryResult } from './hero/CityQuery';
import { RotatingWord } from './hero/RotatingWord';

export interface HeroProps {
  /** Ringkasan jalur utama; null selama dimuat atau bila gagal dimuat. */
  glance: TrackGlance | null;
  /** Ringkasan sudah selesai dimuat (berhasil atau gagal). Sebelum itu tombol utama belum ditampilkan. */
  ready: boolean;
  /** Tombol utama ditekan. */
  onStart: () => void;
  /** "Pulihkan" ditekan (buka pemilih file cadangan). */
  onRestore: () => void;
  /**
   * Petunjuk sebelum ringkasan siap: browser ini tampaknya sudah punya progres. Dipakai untuk MEMESAN tempat baris
   * "Lanjutkan" dan kartu "Hari ini", supaya isi hero tidak melompat turun saat ringkasan tiba.
   */
  expectReturning?: boolean;
  /** Isi tambahan tepat di bawah tautan pulihkan: panel hasil memilih file cadangan, kartu "Hari ini". */
  children?: ReactNode;
}

const TITLE_ID = 'hero-title';
const PRIMARY_TRACK = TRACKS.find((track) => track.status === 'tersedia');

/** Keadaan tombol utama Beranda (hero, navbar, CTA penutup memakai aturan yang sama). */
export type HomeMode = 'loading' | 'start' | 'resume' | 'open';
type Mode = HomeMode;

/** Teks tombol utama per keadaan ('loading' tidak menampilkan tombol). */
export const CTA_LABEL: Record<Mode, string> = { loading: HERO.cta.start, start: HERO.cta.start, resume: HERO.cta.resume, open: EXPLORE.cta };

/** Pemisah sebelum butir ke-`index` pada subjudul: "72 misi, 10 tier, dan 39 materi". */
function separator(index: number, count: number, joiner: string): string {
  if (index === 0) return '';
  return index === count - 1 ? `, ${joiner} ` : ', ';
}

export function modeOf(glance: TrackGlance | null, ready: boolean): Mode {
  if (!ready) return 'loading';
  if (glance === null) return 'open';
  if (!glance.started) return 'start';
  return glance.resume ? 'resume' : 'open';
}

export function Hero({ glance, ready, onStart, onRestore, expectReturning = false, children }: HeroProps): JSX.Element {
  const primaryRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const reduced = usePrefersReducedMotion();
  const [typed, setTyped] = useState(false);
  const mode = modeOf(glance, ready);

  useEffect(() => {
    if (mode !== 'resume' && mode !== 'open') return;
    const focused = document.activeElement;
    if (focused === null || focused === document.body) primaryRef.current?.focus({ preventScroll: true });
  }, [mode]);

  // Parallax ringan pada dua kartu samping saat hero digulir.
  const { scrollY } = useScroll();
  const leftY = useTransform(scrollY, [0, 700], [0, -36]);
  const rightY = useTransform(scrollY, [0, 700], [0, -72]);

  const { counts, joiner, tail } = HERO.subtitle;
  const trackTitle = PRIMARY_TRACK?.title ?? '';
  const resume = glance?.resume ?? null;
  const ctaLabel = CTA_LABEL[mode];
  const returning = glance?.started === true;

  return (
    <Section id={SECTION_IDS.hero} spacing="none" labelledBy={TITLE_ID} className="pt-10 sm:pt-12 lg:pt-10">
      <div className="flex flex-col items-center text-center">
        <h1 id={TITLE_ID} aria-label={`${HERO.titleBefore} ${HERO.rotatingWords[0]} ${HERO.titleAfter}`} className="w-full font-q-display text-q-hero font-extrabold text-q-ink lg:text-q-hero-lg">
          <span aria-hidden className="block">
            {HERO.titleBefore}
          </span>
          <span aria-hidden className="block text-q-primary-ink">
            <RotatingWord words={HERO.rotatingWords} intervalMs={HERO.rotateMs} className="h-12 lg:h-[66px]" />
          </span>
          <span aria-hidden className="block">
            {HERO.titleAfter}
          </span>
        </h1>

        <p className="mt-5 max-w-[36ch] text-pretty text-lg leading-relaxed text-q-ink-soft lg:mt-6 lg:max-w-none lg:text-xl">
          {counts.map((item, index) => (
            <Fragment key={item.label}>
              {separator(index, counts.length, joiner)}
              <span className="whitespace-nowrap font-bold text-q-ink">
                <CountUp value={item.value} duration={1.1} delay={0.15 * index} /> {item.label}
              </span>
            </Fragment>
          ))}{' '}
          {tail}
        </p>

        <div className="mt-8 flex w-full max-w-[360px] flex-col items-center gap-3">
          {/* Tempat baris "Lanjutkan" dipesan selama ringkasan pengguna lama masih dimuat. */}
          {mode === 'loading' && expectReturning ? <p aria-hidden className="m-0 h-5" /> : null}
          {mode === 'resume' && resume ? (
            <p className="flex max-w-full items-center gap-2 text-sm text-q-ink" data-testid="home-resume-line">
              <Icon name={PRIMARY_TRACK?.icon ?? 'database'} className="h-4 w-4 text-q-primary-ink" />
              <span className="truncate">{HERO.resumeLine(trackTitle, resume.order, resume.title)}</span>
            </p>
          ) : null}
          {mode === 'open' && glance !== null ? (
            <p className="flex items-center gap-2 text-sm text-q-ink" data-testid="home-resume-line">
              <Icon name="trophy" className="h-4 w-4 text-q-amber-ink" />
              {HERO.allDone(glance.total)}
            </p>
          ) : null}

          <div className="w-full pb-1">
            {mode === 'loading' ? (
              <div role="status" className="h-[52px] w-full animate-pulse rounded-q bg-q-muted motion-reduce:animate-none">
                <span className="sr-only">{HERO.loading}</span>
              </div>
            ) : (
              <Button3D ref={primaryRef} size="lg" fullWidth onClick={onStart} data-testid="home-primary" data-mode={mode}>
                {ctaLabel}
              </Button3D>
            )}
          </div>

          <p className="text-sm text-q-ink-soft">
            {HERO.restore.prompt}{' '}
            <button
              type="button"
              onClick={onRestore}
              data-testid="home-restore"
              className="rounded font-bold text-q-primary-ink underline decoration-q-primary-ink/40 underline-offset-4 transition-colors duration-150 hover:decoration-q-primary-ink"
            >
              {HERO.restore.action}
            </button>
          </p>
        </div>

        {children}
        {/* Tempat kartu "Hari ini" dipesan selama ringkasan pengguna lama masih dimuat. */}
        {mode === 'loading' && expectReturning ? <div aria-hidden className="mt-8 h-[190px] w-full max-w-[980px] rounded-q-lg bg-q-muted/60" data-testid="home-today-loading" /> : null}

        {/* Tiga jaminan untuk pengunjung baru; pengguna lama sudah tahu dan mendapat kartu "Hari ini" di tempat ini. */}
        {returning || (mode === 'loading' && expectReturning) ? null : (
          <ul className="m-0 mt-5 flex list-none flex-wrap items-center justify-center gap-x-6 gap-y-2 p-0 text-sm text-q-ink-soft">
            {HERO.assurances.map((item) => (
              <li key={item.text} className="inline-flex items-center gap-2">
                <Icon name={item.icon} className="h-4 w-4 text-q-primary-ink" />
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Panggung: query → bola dunia → hasil. Bagian bawah bola dunia sengaja terpotong oleh tepi section. */}
      <div className="relative mx-auto mt-8 w-full max-w-[1060px] lg:mt-2">
        <motion.div
          style={reduced ? undefined : { y: leftY }}
          className="absolute left-0 top-[34%] z-30 hidden w-[264px] lg:block wide:w-[292px] [@media(min-width:1024px)_and_(max-height:920px)]:top-[22%]"
        >
          <CityQueryCode onTyped={() => setTyped(true)} />
        </motion.div>
        {/* Di layar lebar yang pendek panggungnya lebih rendah: kartu hasil dinaikkan supaya tidak menjorok ke pita marquee. */}
        <motion.div
          style={reduced ? undefined : { y: rightY }}
          className="absolute right-0 top-[24%] z-30 hidden w-[216px] lg:block wide:right-6 [@media(min-width:1024px)_and_(max-height:920px)]:top-[2%]"
        >
          <CityQueryResult revealed={typed} />
        </motion.div>

        {/* Layar lebar yang pendek (laptop 1440×900): bola dunia dikecilkan supaya Indonesia & badge masuk lipatan pertama. */}
        <div className="mx-auto w-full max-w-[540px] [@media(min-width:1024px)_and_(max-height:920px)]:max-w-[430px]">
          <div className="relative overflow-hidden pt-[10%]">
            <div className="relative -mb-[13%] w-full sm:-mb-[22%]">
              <Mascot pose="peek" part="body" title={HERO.mascotLabel} className="absolute left-1/2 top-[-8.5%] z-0 w-[30%] -translate-x-1/2" />
              <Globe className="z-10" markers={PATIENT_CITIES} focus={GLOBE_FOCUS} label={HERO.globeLabel} />
              <Mascot pose="peek" part="hands" className="absolute left-1/2 top-[-8.5%] z-20 w-[30%] -translate-x-1/2" />
            </div>
            <p
              className="absolute bottom-3 left-1/2 z-30 m-0 inline-flex h-9 -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-q-pill border border-q-border bg-q-surface px-3.5 text-[13px] font-bold text-q-ink shadow-q-float sm:text-sm"
              data-testid="hero-badge"
            >
              <span aria-hidden className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="q-loop absolute inline-flex h-full w-full rounded-full bg-q-success opacity-70 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-q-success" />
              </span>
              {returning && glance !== null ? HERO.badge.returning(glance.completed, glance.streak.active) : HERO.badge.fresh}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
