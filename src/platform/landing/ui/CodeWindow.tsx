/**
 * Jendela editor gelap untuk mockup: bilah judul dengan tab berkas, nomor baris, isi yang disorot penyorot SQL
 * aplikasi (lib/sqlHighlight), slot footer (tombol) dan slot panel (hasil). Warnanya SAMA di tema terang dan gelap,
 * karena meniru layar jalur yang memang selalu gelap.
 *
 * Efek mengetik (`typing`): kode muncul huruf demi huruf begitu jendela terlihat; tinggi jendela sudah dipesan sejak
 * awal jadi tata letak tidak melompat. Dengan reduced motion kode langsung tampil utuh.
 */
import { useMemo, useRef, type ReactNode } from 'react';
import { useInView } from 'framer-motion';
import { TABLE_NAME_CLASS, TOKEN_CLASS } from '../../../components/HighlightedCode';
import { tokenizeSql, type SqlTokenType } from '../../../lib/sqlHighlight';
import { useTypewriter } from '../hooks/useTypewriter';
import { PRACTICE_TABLES } from '../lib/content';
import { cn } from '../lib/cn';

/** Warna token = penyorot aplikasi; komentar sedikit lebih terang supaya lolos kontras AA di landing. */
const TOKEN: Record<SqlTokenType, string> = { ...TOKEN_CLASS, comment: 'text-slate-400 italic' };
const TABLE_NAMES: ReadonlySet<string> = new Set(PRACTICE_TABLES.map((table) => table.name));

export type CodeLineMark = 'error' | 'success' | 'warn';

const MARK_CLASS: Record<CodeLineMark, { row: string; number: string }> = {
  error: { row: 'bg-rose-500/15 shadow-[inset_3px_0_0_0_rgb(251_113_133)]', number: 'text-rose-300' },
  success: { row: 'bg-emerald-500/15 shadow-[inset_3px_0_0_0_rgb(52_211_153)]', number: 'text-emerald-300' },
  warn: { row: 'bg-amber-500/15 shadow-[inset_3px_0_0_0_rgb(252_211_77)]', number: 'text-amber-300' },
};

export interface CodeWindowTab {
  id: string;
  label: string;
}

export interface CodeWindowProps {
  /** Isi editor. */
  code: string;
  /** 'sql' disorot; 'text' ditampilkan polos. */
  language?: 'sql' | 'text';
  /** Nama berkas pada tab tunggal (dipakai bila `tabs` kosong). */
  fileName?: string;
  /** Beberapa tab berkas. Dengan `onTabChange` tab menjadi tombol; tanpa itu hanya label. */
  tabs?: readonly CodeWindowTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /** Isi di kanan bilah judul (mis. <Pill>). */
  titleRight?: ReactNode;
  /** Efek mengetik saat jendela terlihat. */
  typing?: boolean;
  /** Milidetik per karakter (bawaan 26). */
  typingSpeed?: number;
  /** Jeda sebelum mengetik, milidetik. */
  typingDelay?: number;
  /** Ubah nilainya untuk mengetik ulang. */
  replayKey?: number | string;
  /** Dipanggil saat pengetikan selesai. */
  onTyped?: () => void;
  showLineNumbers?: boolean;
  /** Tanda per baris (nomor baris mulai dari 1): latar merah/hijau/kuning. */
  lineMarks?: Readonly<Record<number, CodeLineMark>>;
  /** Jumlah baris minimum yang dipesan (supaya beberapa contoh sama tinggi). */
  minLines?: number;
  /** Slot di bawah kode: bilah tombol (Hint, Run & Check, …). */
  footer?: ReactNode;
  /** Slot paling bawah: panel hasil. */
  children?: ReactNode;
  /** Nama aksesibel jendela (bawaan: nama berkas). */
  ariaLabel?: string;
  className?: string;
}

interface Piece {
  type: SqlTokenType;
  text: string;
}

/** Token → baris-baris token (token yang memuat baris baru dipecah). */
function toLines(code: string, language: 'sql' | 'text'): Piece[][] {
  const tokens: Piece[] = language === 'sql' ? tokenizeSql(code) : [{ type: 'identifier', text: code }];
  const lines: Piece[][] = [[]];
  for (const token of tokens) {
    const parts = token.text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part !== '') lines[lines.length - 1]?.push({ type: token.type, text: part });
    });
  }
  return lines;
}

function pieceClass(piece: Piece): string {
  if (piece.type === 'identifier' && TABLE_NAMES.has(piece.text.toLowerCase())) return TABLE_NAME_CLASS;
  return TOKEN[piece.type];
}

export function CodeWindow({
  code,
  language = 'sql',
  fileName = 'query.sql',
  tabs,
  activeTab,
  onTabChange,
  titleRight,
  typing = false,
  typingSpeed,
  typingDelay,
  replayKey,
  onTyped,
  showLineNumbers = true,
  lineMarks,
  minLines = 0,
  footer,
  children,
  ariaLabel,
  className,
}: CodeWindowProps): JSX.Element {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const typed = useTypewriter(code, { active: typing && inView, speed: typingSpeed, startDelay: typingDelay, replayKey, onDone: onTyped });
  const visible = typing ? typed.shown : code;
  const showCaret = typing && inView && !typed.done;

  const lines = useMemo(() => toLines(visible, language), [visible, language]);
  const totalLines = Math.max(code.split('\n').length, minLines, 1);
  const caretLine = lines.length - 1;
  const fileTabs: readonly CodeWindowTab[] = tabs !== undefined && tabs.length > 0 ? tabs : [{ id: fileName, label: fileName }];
  const currentTab = activeTab ?? fileTabs[0]?.id;

  return (
    <figure
      ref={ref}
      aria-label={ariaLabel ?? fileName}
      className={cn('q-on-dark m-0 overflow-hidden rounded-q-lg border border-q-code-border bg-q-code-bg text-left text-q-code-ink shadow-q-float', className)}
    >
      {/* Bilah judul: tiga titik hiasan + tab berkas */}
      <div className="flex h-11 items-stretch gap-3 border-b border-q-code-border bg-q-code-chrome pl-4 pr-3">
        <span aria-hidden className="flex shrink-0 items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-q-coral" />
          <span className="h-2.5 w-2.5 rounded-full bg-q-amber" />
          <span className="h-2.5 w-2.5 rounded-full bg-q-success" />
        </span>
        <div className="q-no-scrollbar flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
          {fileTabs.map((tab) => {
            const active = tab.id === currentTab;
            const tabClass = cn(
              'inline-flex h-9 shrink-0 items-center rounded-t-lg px-3 font-mono text-xs',
              active ? 'bg-q-code-bg text-q-code-ink' : 'text-q-code-muted',
              // Garis fokus digambar DI DALAM tab: penggulir di sekelilingnya memotong garis yang menjorok keluar.
              onTabChange ? 'transition-colors duration-150 hover:text-q-code-ink focus-visible:[outline-offset:-2px]' : '',
            );
            return onTabChange ? (
              <button key={tab.id} type="button" aria-pressed={active} onClick={() => onTabChange(tab.id)} className={tabClass}>
                {tab.label}
              </button>
            ) : (
              <span key={tab.id} className={tabClass}>
                {tab.label}
              </span>
            );
          })}
        </div>
        {titleRight !== undefined ? <div className="flex shrink-0 items-center">{titleRight}</div> : null}
      </div>

      {/* Kode: pembaca layar mendapat teks utuh; versi berwarna (yang sedang "diketik") disembunyikan dari mereka */}
      <pre className="sr-only">{code}</pre>
      {/*
        Layar sempit: huruf sedikit lebih kecil supaya baris terpanjang contoh nyaris muat, dan tepi kanan memudar
        (20px terakhir = padding kanan) sebagai tanda bahwa kodenya bisa digeser.
      */}
      <div
        aria-hidden
        className="scrollbar-thin overflow-x-auto py-3 font-mono text-xs leading-[1.7] [mask-image:linear-gradient(to_right,black_calc(100%-20px),transparent)] sm:text-[13px]"
      >
        <div className="w-max min-w-full">
          {Array.from({ length: totalLines }, (_, index) => {
            const mark = lineMarks?.[index + 1];
            const pieces = lines[index] ?? [];
            return (
              <div key={index} className={cn('flex min-h-[1.7em] pr-5', mark ? MARK_CLASS[mark].row : '')}>
                {showLineNumbers ? (
                  <span className={cn('w-8 shrink-0 select-none pr-2.5 text-right tabular-nums sm:w-11 sm:pr-3', mark ? MARK_CLASS[mark].number : 'text-q-code-muted/80')}>{index + 1}</span>
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <span className="whitespace-pre">
                  {pieces.map((piece, pieceIndex) =>
                    piece.type === 'whitespace' ? (
                      piece.text
                    ) : (
                      <span key={pieceIndex} className={pieceClass(piece)}>
                        {piece.text}
                      </span>
                    ),
                  )}
                  {showCaret && index === caretLine ? <span className="ml-px inline-block h-[1.1em] w-[2px] translate-y-[0.2em] animate-pulse bg-emerald-300" /> : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {footer !== undefined ? <div className="flex flex-wrap items-center gap-2 border-t border-q-code-border bg-q-code-chrome/50 px-4 py-3">{footer}</div> : null}
      {children !== undefined ? <div className="border-t border-q-code-border">{children}</div> : null}
    </figure>
  );
}
