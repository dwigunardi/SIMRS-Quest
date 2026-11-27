import { ChartColumn, ClipboardCheck, Flame, Library, ListChecks, Moon, RotateCcw, Sun, Target, Terminal, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { getActiveStreak } from '../lib/progress';
import { BrandMark } from '../platform/BrandMark';
import { PRODUCT_NAME } from '../platform/brand';
import { THEME_TOGGLE_LABEL, useTheme } from '../platform/theme';
import type { AppMode, RankProgress, UserProgress } from '../types';

export interface HeaderProps {
  /** Kembali ke Beranda platform. Tanpa ini (App dirender berdiri sendiri) lambang produk hanya hiasan. */
  onHome?: () => void;
  progress: UserProgress;
  rankProgress: RankProgress;
  completedCount: number;
  totalCount: number;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onResetProgress: () => void;
  /** Sisa waktu ujian yang sedang berjalan ("12:34" / "aktif"), ditampilkan di tombol Ujian; null = tidak ada ujian. */
  examClock?: string | null;
  /** Jumlah misi yang jatuh tempo untuk latihan ulang (ditampilkan bila tidak ada ujian berjalan). */
  reviewDue?: number;
}

const RESET_CONFIRM =
  'Reset semua progres? XP, streak, status misi, riwayat Peta Kelemahan, tanda materi yang sudah dibaca, riwayat ujian, dan jadwal latihan ulang akan dihapus permanen dari browser ini.';

interface ModeOption {
  mode: AppMode;
  label: string;
  /** Label ringkas untuk layar sempit. */
  shortLabel?: string;
  icon: typeof Target;
}

const MODE_OPTIONS: ModeOption[] = [
  { mode: 'mission', label: 'Misi', icon: Target },
  { mode: 'playground', label: 'Free Playground', shortLabel: 'Playground', icon: Terminal },
  { mode: 'reference', label: 'Materi', icon: Library },
  { mode: 'progress', label: 'Progres', icon: ChartColumn },
  { mode: 'exam', label: 'Ujian', icon: ClipboardCheck },
];

export function Header({
  onHome,
  progress,
  rankProgress,
  completedCount,
  totalCount,
  mode,
  onModeChange,
  onResetProgress,
  examClock = null,
  reviewDue = 0,
}: HeaderProps) {
  const handleReset = () => {
    if (!window.confirm(RESET_CONFIRM)) return;
    onResetProgress();
  };
  const activeStreak = getActiveStreak(progress.streak, new Date());

  return (
    <header className="relative shrink-0 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      {/* Di bawah lg jarak & nama produk sedikit dirapatkan: pada lebar ±768px lambang + tombol mode (dengan jam ujian)
          harus tetap muat sebaris, sama seperti sebelum ada tombol Beranda. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 lg:gap-x-4">
        <Brand onHome={onHome} />
        {/* Ponsel sempit (< 394px): lambang produk selalu sendirian di baris pertama header (lambang + tombol mode tidak
            muat sebaris), jadi tombol tema ditaruh di ujung kanan baris itu — tidak menambah lebar baris pil XP/streak,
            sehingga header tetap setinggi sebelum ada tombol tema (mis. XP 4 digit di 375px tidak membuat baris baru).
            Posisinya absolut terhadap <header> (di luar alur flex, jadi tidak memengaruhi celah), tetapi di DOM ia tepat
            setelah lambang: urutan fokus keyboard = urutan tampilan (lambang → tema → tombol mode → …). */}
        <ThemeButton className={`${TOOL_BUTTON} absolute right-4 top-[13px] rounded-lg border border-slate-700 hover:bg-slate-800 hover:text-slate-200 min-[394px]:hidden`} />
        <ModeSwitch mode={mode} onModeChange={onModeChange} examClock={examClock} reviewDue={reviewDue} />
        <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
          <RankMeter rankProgress={rankProgress} xp={progress.xp} />
          {/* Tema terang: isian amber/oranye /10 berubah menjadi krem kusam yang nyaris sama; tint 950 (emas & persik
              pucat) menjaga kedua pil tetap berbeda. Label satuan di tema terang memakai warna penuh (alfa/opacity
              di atas latar terang turun di bawah AA). */}
          <StatPill
            title={`Total XP: ${progress.xp}`}
            className="border-amber-500/30 bg-amber-500/10 text-amber-300 light:border-amber-700/40 light:bg-amber-950/40"
          >
            <Zap className="h-4 w-4" aria-hidden />
            <span className="tabular-nums">{progress.xp}</span>
            <span className="text-xs text-amber-400/70 light:text-amber-500">XP</span>
          </StatPill>
          <StatPill
            title={`Streak harian 🔥 — terbaik: ${progress.streak.best} hari`}
            className={
              activeStreak > 0
                ? 'border-orange-500/30 bg-orange-500/10 text-orange-300 light:border-orange-700/40 light:bg-orange-950/50'
                : 'border-slate-700 bg-slate-800/60 text-slate-400'
            }
          >
            <Flame className="h-4 w-4" aria-hidden />
            <span className="tabular-nums">{activeStreak}</span>
            <span className="text-xs opacity-70 light:opacity-100">hari</span>
          </StatPill>
          <StatPill
            title="Misi selesai"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 light:bg-emerald-950/30"
          >
            <ListChecks className="h-4 w-4" aria-hidden />
            <span className="tabular-nums">
              {completedCount}/{totalCount}
            </span>
          </StatPill>
          <HeaderTools onReset={handleReset} />
        </div>
      </div>
    </header>
  );
}

const TOOL_BUTTON = 'p-2 text-slate-400 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300';
/** Garis fokus tombol di dalam kotak bersama digambar di atas tetangganya. */
const IN_BOX = 'focus-visible:relative focus-visible:z-10';

/**
 * Lebar ≥ 394px (varian `min-[394px]:`, ditulis utuh supaya terbaca Tailwind): tema & reset dalam satu kotak berbatas
 * bersama, bukan dua tombol berjarak — hemat ±13px, cukup supaya header di 640px dan 1366px tidak bertambah baris.
 * Di bawah 394px tombol tema pindah ke baris lambang (lihat Header) dan Reset kembali menjadi tombol berbatas sendiri,
 * persis seperti sebelum ada tombol tema.
 */
function HeaderTools({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex min-[394px]:rounded-lg min-[394px]:border min-[394px]:border-slate-700">
      <ThemeButton className={`${TOOL_BUTTON} ${IN_BOX} hidden rounded-l-[7px] hover:bg-slate-800 hover:text-slate-200 min-[394px]:block`} />
      <button
        type="button"
        onClick={onReset}
        title="Reset progres"
        aria-label="Reset progres"
        className={`${TOOL_BUTTON} ${IN_BOX} rounded-lg border border-slate-700 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300 min-[394px]:rounded-none min-[394px]:rounded-r-[7px] min-[394px]:border-0 min-[394px]:border-l min-[394px]:hover:border-slate-700`}
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Penukar tema terang/gelap. Tema berlaku untuk seluruh aplikasi (src/platform/theme.ts): pilihan di sini juga berlaku di
 * Beranda dan sebaliknya. Ikon = tema yang sedang aktif; aria-label & title = aksinya ("Ganti ke tema terang").
 */
function ThemeButton({ className }: { className: string }) {
  const { theme, toggleTheme } = useTheme();
  const label = THEME_TOGGLE_LABEL[theme];
  const Icon = theme === 'dark' ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      data-testid="track-theme-toggle"
      data-theme-current={theme}
      className={className}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

/**
 * Lambang + nama produk sebagai tombol pulang ke Beranda, diikuti chip jalur. Chip itulah judul halaman (h1) di dalam
 * jalur; nama produk tidak ditulis di sini melainkan diambil dari platform/brand.
 */
function Brand({ onHome }: { onHome?: () => void }) {
  const mark = (
    <>
      <BrandMark />
      <span className="whitespace-nowrap text-[15px] font-bold tracking-tight text-slate-100 lg:text-base">{PRODUCT_NAME}</span>
    </>
  );
  return (
    <div className="flex items-center gap-1.5 lg:gap-2">
      {onHome ? (
        <button
          type="button"
          onClick={onHome}
          aria-label="Beranda"
          title="Kembali ke Beranda"
          className="-m-1 flex items-center gap-2 rounded-xl p-1 transition hover:bg-slate-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 lg:gap-2.5"
        >
          {mark}
        </button>
      ) : (
        <div className="flex items-center gap-2 lg:gap-2.5">{mark}</div>
      )}
      {/* Tema terang (juga pil "misi selesai" dan mode aktif): hijau terpilih = mint pucat (tint 950, sekeluarga dengan
          --q-tint Beranda), bukan tint hijau tua /10–/15 yang menjadi abu-sage di atas latar terang. */}
      <h1 className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-bold tracking-wide text-emerald-300 light:bg-emerald-950/30">
        <span className="sr-only">Jalur </span>SQL
      </h1>
    </div>
  );
}

interface ModeSwitchProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  examClock: string | null;
  reviewDue: number;
}

function ModeSwitch({ mode, onModeChange, examClock, reviewDue }: ModeSwitchProps) {
  return (
    <div className="flex rounded-lg border border-slate-800 bg-slate-950/60 p-1" role="group" aria-label="Mode aplikasi">
      {MODE_OPTIONS.map((option) => {
        const active = option.mode === mode;
        const Icon = option.icon;
        return (
          <button
            key={option.mode}
            type="button"
            aria-pressed={active}
            onClick={() => onModeChange(option.mode)}
            title={option.label}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition sm:px-3 ${
              active
                ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 light:bg-emerald-950/35'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {/* Layar sempit: ikon saja; layar sedang: label ringkas; layar sangat lebar: label lengkap
                (nama lengkap tetap terbaca screen reader & tooltip). */}
            <span aria-hidden className="hidden sm:inline 2xl:hidden">
              {option.shortLabel ?? option.label}
            </span>
            <span className="sr-only 2xl:not-sr-only">{option.label}</span>
            {option.mode === 'exam' && examClock ? (
              <span className="rounded bg-amber-500/20 px-1.5 py-px font-mono text-[11px] tabular-nums text-amber-200 light:bg-amber-950/70" data-testid="header-exam-clock">
                <span className="sr-only">ujian berjalan, sisa waktu </span>
                {examClock}
              </span>
            ) : null}
            {option.mode === 'exam' && !examClock && reviewDue > 0 ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-sky-500 px-1 text-[11px] font-bold tabular-nums text-slate-950" data-testid="header-review-due">
                <span className="sr-only">latihan ulang jatuh tempo: </span>
                {reviewDue}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

interface RankMeterProps {
  rankProgress: RankProgress;
  xp: number;
}

function RankMeter({ rankProgress, xp }: RankMeterProps) {
  const { current, next, ratio, xpToNext } = rankProgress;
  const percent = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
  const caption = next ? `${xpToNext} XP lagi menuju ${next.title}` : 'Rank tertinggi tercapai!';

  return (
    <div
      className="flex min-w-[180px] items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1.5"
      title={`${current.title} • ${xp} XP • ${caption}`}
    >
      <span className="text-lg leading-none" aria-hidden>
        {current.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-xs font-semibold text-slate-200">{current.title}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-slate-500">{percent}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-[width] duration-700 light:from-amber-600 light:to-emerald-600"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={caption}
          />
        </div>
        <p className="mt-0.5 truncate text-[10px] text-slate-500">{caption}</p>
      </div>
    </div>
  );
}

interface StatPillProps {
  title: string;
  className: string;
  children: ReactNode;
}

function StatPill({ title, className, children }: StatPillProps) {
  return (
    <div
      title={title}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold ${className}`}
    >
      {children}
    </div>
  );
}
