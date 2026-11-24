/**
 * Bagian 11 — "Belajar di layar mana pun.": mockup browser + ponsel bertumpuk dengan parallax ringan, dan tiga butir
 * fakta sebagai pengganti lencana toko aplikasi (aplikasi ini murni web: tidak ada yang dipasang).
 *
 * Isi kedua mockup adalah penyederhanaan layar misi sungguhan (misi t1-where dari PRACTICE.tabs.query): bilah atas
 * dengan pilihan mode, uraian misi, peta tier, editor, tombol Run & Check, dan tabel hasil. Tidak ada fitur karangan.
 */
import { useId, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { CircleCheck, Lightbulb, ListChecks, Map as MapIcon, Play, Table2, Target } from 'lucide-react';
import { HighlightedCode } from '../../../components/HighlightedCode';
import { BrandMark } from '../../BrandMark';
import { PRODUCT_NAME } from '../../brand';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { cn } from '../lib/cn';
import { DEVICES, MISSION_COUNT, NAV, OUTPUT_CAPTIONS, PATHS, PRACTICE, ROUTES, SECTION_IDS, TRACKS, type ResultTable } from '../lib/content';
import { BrowserMockup, PhoneMockup } from '../ui/Mockups';
import { Icon } from '../ui/Icon';
import { Reveal, RevealItem } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

export interface DevicesProps {
  /** Latar section (bawaan latar halaman). */
  tone?: 'default' | 'tint';
}

const APP_LABELS = DEVICES.appLabels;

const MISSION = PRACTICE.tabs.query;
/** Urutan misi contoh di kurikulum = jumlah misi selesai setelah misi ini benar (misi terbuka berurutan). */
const MISSION_ORDER = Number(/\d+/.exec(MISSION.fileName)?.[0] ?? 1);
const TRACK_CHIP = TRACKS[0]?.title ?? '';
/** Pilihan mode di bilah atas layar jalur; butir pertama (Misi) sedang aktif. */
const MODES: readonly string[] = [
  APP_LABELS.missions,
  ...[ROUTES.playground, ROUTES.articles, ROUTES.progress, ROUTES.exam].flatMap((href) => {
    const item = NAV.features.items.find((entry) => entry.href === href);
    return item ? [item.label] : [];
  }),
];
const TIERS = PATHS.roadmap.tiers.slice(0, 4);

/* ------------------------------------------------------------------ */
/* Potongan layar jalur (gelap tetap, kelas slate/emerald seperti aplikasinya)                                        */
/* ------------------------------------------------------------------ */

function ResultRows({ table, limit, dense = false }: { table: ResultTable; limit: number; dense?: boolean }): JSX.Element {
  return (
    <table className={cn('w-full border-collapse text-left font-mono', dense ? 'text-[10px]' : 'text-xs')}>
      <thead>
        <tr className="border-b border-slate-800 text-slate-400">
          {table.columns.map((column) => (
            <th key={column} className={cn('font-medium', dense ? 'px-2 py-1' : 'px-3 py-1.5')}>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.slice(0, limit).map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b border-slate-800/60 text-slate-200 last:border-b-0">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className={cn('whitespace-nowrap', dense ? 'px-2 py-1' : 'px-3 py-1.5')}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Verdict({ dense = false }: { dense?: boolean }): JSX.Element {
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200', dense ? 'px-2.5 py-2 text-[11px]' : 'px-3 py-2 text-sm')}>
      <CircleCheck className={cn('shrink-0 text-emerald-400', dense ? 'h-4 w-4' : 'h-5 w-5')} />
      <span className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold">{PRACTICE.verdict.correct}</span> <span className="text-emerald-200/80">{PRACTICE.verdict.correctDetail}</span>
      </span>
      <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-300">
        {PRACTICE.verdict.xp(MISSION.xp)}
      </span>
    </div>
  );
}

function RunButton({ dense = false }: { dense?: boolean }): JSX.Element {
  return (
    <span className={cn('inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 font-semibold text-slate-950', dense ? 'h-9 w-full text-xs' : 'px-4 py-2 text-sm')}>
      <Play className={cn('fill-current', dense ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      {PRACTICE.buttons.run}
    </span>
  );
}

/** Pudar di tepi bawah layar tiruan: isi yang terpotong tampak "berlanjut", bukan terbelah di tengah baris. */
function BottomFade(): JSX.Element {
  return <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 block h-12 bg-gradient-to-t from-slate-950 to-slate-950/0" />;
}

/** Layar misi di jendela browser. Disusun pada 960 × 580 lalu diskalakan BrowserMockup. */
function DesktopScreen(): JSX.Element {
  return (
    <div aria-hidden className="relative flex h-full w-full flex-col bg-slate-950 font-sans text-slate-200">
      <div className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-800 bg-slate-900/80 px-4">
        <span className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-base font-bold tracking-tight text-slate-100">{PRODUCT_NAME}</span>
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-bold tracking-wide text-emerald-300">{TRACK_CHIP}</span>
        </span>
        <span className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          {MODES.map((mode, index) => (
            <span key={mode} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', index === 0 ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400')}>
              {mode}
            </span>
          ))}
        </span>
        <span className="ml-auto flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold tabular-nums text-emerald-300">
          <ListChecks className="h-4 w-4" />
          {MISSION_ORDER}/{MISSION_COUNT}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)] gap-4 p-4">
        <div className="flex min-h-0 flex-col gap-3">
          <div>
            <span className="inline-block rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-xs font-medium text-teal-300">{MISSION.tierLabel}</span>
            <p className="mt-2 text-xl font-bold tracking-tight text-slate-50">{MISSION.missionTitle}</p>
          </div>
          <div className="flex gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <p className="text-sm leading-relaxed text-slate-100">{MISSION.task}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            <p className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-100">
              <MapIcon className="h-4 w-4 text-emerald-400" />
              {APP_LABELS.missionMap}
            </p>
            <div className="flex flex-col gap-2 border-t border-slate-800 px-3 pb-3 pt-2">
              {TIERS.map((tier, index) => {
                // Tier berikutnya digambar "belum dikerjakan" (0/n), BUKAN terkunci: di aplikasi gembok ada pada misi, tidak pada tier.
                const open = index === 0;
                return (
                  <div key={tier.tier} className="flex items-center gap-3 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2.5">
                    <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold', open ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400')}>
                      {tier.tier}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn('truncate text-sm font-semibold', open ? 'text-slate-200' : 'text-slate-500')}>{tier.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">
                          {open ? MISSION_ORDER : 0}/{tier.missions}
                        </span>
                      </span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-800">
                        <span className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: open ? `${(MISSION_ORDER / tier.missions) * 100}%` : '0%' }} />
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <p className="border-b border-slate-800 px-4 py-2 font-mono text-xs text-slate-400">{MISSION.fileName}</p>
            <HighlightedCode code={MISSION.code} className="!overflow-hidden px-4 py-3" />
          </div>
          <div className="flex items-center gap-2">
            <RunButton />
            <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300">
              <Lightbulb className="h-4 w-4" />
              {PRACTICE.buttons.hint}
            </span>
          </div>
          <Verdict />
          {/* Jawaban benar: aplikasi hanya menampilkan tabel "Hasil Kamu" (tab pembanding muncul saat jawaban salah). */}
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2 text-xs font-medium text-slate-300">
              <Table2 className="h-3.5 w-3.5 text-teal-400" />
              {OUTPUT_CAPTIONS.yours}
              <span className="ml-auto text-slate-500">{PRACTICE.rowCount(MISSION.result.rows.length)}</span>
            </div>
            <ResultRows table={MISSION.result} limit={6} />
          </div>
        </div>
      </div>
      <BottomFade />
    </div>
  );
}

/** Layar misi di ponsel (280 × 600, 48px teratas di belakang dynamic island). */
function PhoneScreen(): JSX.Element {
  return (
    <div aria-hidden className="relative flex h-full w-full flex-col gap-2.5 bg-slate-950 px-3 pb-3 pt-12 font-sans text-slate-200">
      <div className="flex items-center gap-2">
        <BrandMark />
        <span className="text-sm font-bold tracking-tight text-slate-100">{PRODUCT_NAME}</span>
        <span className="ml-auto flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold tabular-nums text-emerald-300">
          <ListChecks className="h-3.5 w-3.5" />
          {MISSION_ORDER}/{MISSION_COUNT}
        </span>
      </div>
      <div>
        <span className="inline-block rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium text-teal-300">{MISSION.tierLabel}</span>
        <p className="mt-1.5 text-[15px] font-bold leading-tight tracking-tight text-slate-50">{MISSION.missionTitle}</p>
      </div>
      <div className="flex gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
        <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
        <p className="text-[11px] leading-snug text-slate-100">{MISSION.task}</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <HighlightedCode code={MISSION.code} className="!overflow-hidden px-2.5 py-2.5 !text-[9px]" />
      </div>
      <RunButton dense />
      <Verdict dense />
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <ResultRows table={MISSION.result} limit={6} dense />
      </div>
      <BottomFade />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function Devices({ tone = 'default' }: DevicesProps): JSX.Element {
  const headingId = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  // Parallax ringan: jendela browser bergeser sedikit, ponsel (lebih "dekat") bergeser lebih jauh.
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start end', 'end start'] });
  const browserY = useTransform(scrollYProgress, [0, 1], [18, -18]);
  const phoneY = useTransform(scrollYProgress, [0, 1], [56, -56]);

  return (
    <Section id={SECTION_IDS.devices} tone={tone} labelledBy={headingId}>
      {/* Kolom eksplisit sejak layar tersempit: kolom implisit "auto" mengikuti min-content dan melebar melewati layar ≤ 344px. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <div className="flex min-w-0 flex-col items-center gap-8 lg:order-2 lg:items-start">
          <Reveal>
            <SectionHeading id={headingId} title={DEVICES.title} lead={DEVICES.lead} className="lg:items-start lg:text-left" />
          </Reveal>
          <Reveal as="ul" group className="m-0 flex w-full max-w-[420px] list-none flex-col gap-3 p-0">
            {DEVICES.notes.map((note) => (
              <RevealItem key={note.text} as="li" className="flex items-center gap-3.5 rounded-q border border-q-border bg-q-surface px-4 py-3">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-q bg-q-tint text-q-primary-ink">
                  <Icon name={note.icon} className="h-5 w-5" />
                </span>
                <span className="text-base font-bold leading-snug text-q-ink">{note.text}</span>
              </RevealItem>
            ))}
          </Reveal>
        </div>

        <Reveal className="min-w-0 lg:order-1">
          <div ref={stageRef} className="relative mx-auto w-full max-w-[760px] pb-[9%] pr-[5%] sm:pr-[6%]">
            <motion.div style={reduced ? undefined : { y: browserY }}>
              <BrowserMockup url={DEVICES.browserUrl} label={DEVICES.browserLabel} baseWidth={960} baseHeight={580}>
                <DesktopScreen />
              </BrowserMockup>
            </motion.div>
            <motion.div style={reduced ? undefined : { y: phoneY }} className="absolute bottom-0 right-0 w-[27%] min-w-[108px]">
              <PhoneMockup label={DEVICES.phoneLabel}>
                <PhoneScreen />
              </PhoneMockup>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
