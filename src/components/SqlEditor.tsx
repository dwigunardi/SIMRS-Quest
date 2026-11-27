import { useCallback, useId, useMemo, useRef, type ChangeEvent, type KeyboardEvent, type UIEvent } from 'react';
import { EXPLAIN_SHORTCUT_LABEL, RUN_SHORTCUT_LABEL } from '../lib/platform';
import type { CompletionSchema } from '../lib/sqlComplete';
import { tokenizeSql } from '../lib/sqlHighlight';
import { CompletionPopup, optionId } from './editor/CompletionPopup';
import { insertAtSelection } from './editor/textInsert';
import { useAutocomplete } from './editor/useAutocomplete';
import { TABLE_NAME_CLASS, TOKEN_CLASS } from './HighlightedCode';

export interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  /** Jika diisi, Ctrl/Cmd + Shift + Enter memanggil ini (Explain) alih-alih onRun. */
  onExplain?: () => void;
  disabled?: boolean;
  placeholder?: string;
  minHeightClass?: string;
  /** Tabel & kolom untuk autocomplete dan pewarnaan nama tabel. Tanpa ini hanya keyword & fungsi yang ditawarkan. */
  schema?: CompletionSchema;
}

const INDENT = '  ';
const NO_SCHEMA: CompletionSchema = { tables: [] };

/**
 * Tipografi yang WAJIB identik antara textarea, lapisan highlight, dan gutter
 * agar overlay sejajar sempurna.
 */
const TYPOGRAPHY =
  'font-mono text-[13px] leading-6 tracking-normal whitespace-pre [font-variant-ligatures:none] [tab-size:2]';
/** Padding vertikal identik untuk ketiga lapisan. */
const PAD_Y = 'pt-3 pb-3';

export function SqlEditor({
  value,
  onChange,
  onRun,
  onExplain,
  disabled = false,
  placeholder,
  minHeightClass = 'min-h-[200px]',
  schema = NO_SCHEMA,
}: SqlEditorProps): JSX.Element {
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /**
   * Jalan keluar dari "keyboard trap": Tab biasanya menyisipkan indentasi, tetapi
   * setelah Escape ditekan, Tab berikutnya memindahkan fokus seperti biasa.
   */
  const tabEscapeRef = useRef(false);
  const autocomplete = useAutocomplete(textareaRef, schema, onChange, !disabled);

  const hintId = useId();
  const tokens = useMemo(() => tokenizeSql(value), [value]);
  const tableNames = useMemo(() => new Set(schema.tables.map((t) => t.name.toLowerCase())), [schema]);
  const lineCount = useMemo(() => value.split('\n').length, [value]);
  const lineNumbers = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1), [lineCount]);

  const handleScroll = useCallback((event: UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = event.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  }, []);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(event.target.value);
      autocomplete.handleInput(event);
    },
    [autocomplete, onChange],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (autocomplete.handleKeyDown(event)) {
        // Esc yang menutup popup tidak ikut mengaktifkan "Tab keluar editor".
        tabEscapeRef.current = false;
        return;
      }
      if (event.key === 'Escape') {
        tabEscapeRef.current = true;
        return;
      }
      const escaping = tabEscapeRef.current;
      tabEscapeRef.current = false;

      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        autocomplete.close();
        if (disabled) return;
        if (event.shiftKey && onExplain) onExplain();
        else onRun();
        return;
      }
      if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
      // Setelah Escape (atau saat editor nonaktif): biarkan browser memindahkan fokus.
      if (escaping || disabled) return;
      event.preventDefault();
      insertAtSelection(event.currentTarget, INDENT, onChange);
    },
    [autocomplete, disabled, onChange, onExplain, onRun],
  );

  const popup = autocomplete.state;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950 transition focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/30 light:focus-within:border-emerald-500/80 light:focus-within:ring-emerald-500 ${
        // Nonaktif (mesin SQL belum siap): gelap = diredupkan; terang = latar abu-abu khas input nonaktif, teks tetap
        // terbaca (opacity di atas latar putih membuat nomor baris & petunjuk jatuh di bawah AA).
        disabled ? 'opacity-60 light:bg-slate-900 light:opacity-100' : ''
      }`}
    >
      <div className={`relative flex flex-1 ${minHeightClass}`}>
        {/* Gutter nomor baris */}
        <div
          ref={gutterRef}
          aria-hidden="true"
          className={`${TYPOGRAPHY} ${PAD_Y} w-11 shrink-0 select-none overflow-hidden border-r border-slate-800/80 bg-slate-900/60 pr-2 text-right text-slate-600`}
        >
          {lineNumbers.map((n) => (
            <div key={n}>{n}</div>
          ))}
          {/* Ruang ekstra setara tinggi scrollbar horizontal textarea */}
          <div className="h-4" />
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Lapisan highlight */}
          <pre
            ref={preRef}
            aria-hidden="true"
            className={`${TYPOGRAPHY} ${PAD_Y} pointer-events-none absolute inset-0 m-0 overflow-hidden border-0 bg-transparent pl-3 pr-3 text-slate-200`}
          >
            <code className="block w-max min-w-full pb-4 pr-6">
              {tokens.map((token, index) => {
                if (token.type === 'whitespace') return token.text;
                const isTable = token.type === 'identifier' && tableNames.has(token.text.replaceAll('"', '').toLowerCase());
                return (
                  <span key={index} className={isTable ? TABLE_NAME_CLASS : TOKEN_CLASS[token.type]}>
                    {token.text}
                  </span>
                );
              })}
              {/* Spasi di akhir agar baris kosong terakhir ikut dirender */}
              {'\n '}
            </code>
          </pre>

          {/* Textarea transparan yang menerima input */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            onMouseDown={autocomplete.close}
            onBlur={() => {
              tabEscapeRef.current = false;
              autocomplete.close();
            }}
            readOnly={disabled}
            aria-disabled={disabled}
            aria-label="Editor SQL"
            aria-describedby={hintId}
            aria-autocomplete="list"
            aria-controls={popup ? autocomplete.listId : undefined}
            aria-activedescendant={popup ? optionId(autocomplete.listId, popup.selected) : undefined}
            placeholder={placeholder}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            wrap="off"
            className={`${TYPOGRAPHY} ${PAD_Y} scrollbar-thin absolute inset-0 m-0 h-full w-full resize-none overflow-auto border-0 bg-transparent pl-3 pr-3 text-transparent caret-emerald-400 outline-none placeholder:text-slate-600 selection:bg-emerald-500/30 focus:outline-none focus:ring-0 light:selection:bg-emerald-500/20`}
          />
        </div>
      </div>

      {popup ? (
        <CompletionPopup
          id={autocomplete.listId}
          result={popup.result}
          selected={popup.selected}
          anchor={popup.anchor}
          onSelect={autocomplete.select}
          onAccept={autocomplete.accept}
        />
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-slate-800 bg-slate-900/70 px-3 py-1.5 text-[11px] text-slate-500">
        <span className="flex min-w-0 items-center gap-1.5">
          <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-px font-mono text-[10px] text-slate-300">
            {RUN_SHORTCUT_LABEL}
          </kbd>
          <span>untuk menjalankan</span>
          {onExplain ? (
            <span className="hidden items-center gap-1.5 md:inline-flex">
              ·
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-px font-mono text-[10px] text-slate-300">
                {EXPLAIN_SHORTCUT_LABEL}
              </kbd>
              <span>untuk Explain</span>
            </span>
          ) : null}
          <span id={hintId} className="hidden truncate sm:inline">
            · Saran muncul saat mengetik (Tab/Enter untuk memilih, Ctrl+Space untuk memunculkan) · Tab = indentasi, Esc lalu
            Tab untuk keluar dari editor
          </span>
        </span>
        <span className="shrink-0 font-mono tabular-nums">
          {lineCount} baris · {value.length} karakter
        </span>
      </div>
    </div>
  );
}
