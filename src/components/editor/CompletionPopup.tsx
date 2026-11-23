import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CompletionItem, CompletionKind, CompletionResult } from '../../lib/sqlComplete';

/** Titik acuan popup dalam koordinat viewport (position: fixed). */
export interface CompletionAnchor {
  left: number;
  top: number;
  lineHeight: number;
}

export interface CompletionPopupProps {
  id: string;
  result: CompletionResult;
  selected: number;
  anchor: CompletionAnchor;
  onSelect: (index: number) => void;
  onAccept: (item: CompletionItem) => void;
}

const KIND_BADGE: Record<CompletionKind, { text: string; className: string; label: string }> = {
  column: { text: 'C', className: 'bg-sky-500/15 text-sky-300', label: 'kolom' },
  table: { text: 'T', className: 'bg-fuchsia-500/15 text-fuchsia-300', label: 'tabel' },
  alias: { text: 'A', className: 'bg-amber-500/15 text-amber-300', label: 'alias' },
  function: { text: 'ƒ', className: 'bg-teal-500/15 text-teal-300', label: 'fungsi' },
  keyword: { text: 'K', className: 'bg-emerald-500/15 text-emerald-300', label: 'keyword' },
};

const WIDTH = 304;
const ROW_HEIGHT = 28;
const VISIBLE_ROWS = 8;
const FOOTER_HEIGHT = 26;

export function optionId(listId: string, index: number): string {
  return `${listId}-opt-${index}`;
}

/** Label dengan bagian yang cocok dengan ketikan dicetak tebal. */
function MatchedLabel({ label, prefix }: { label: string; prefix: string }): JSX.Element {
  const at = prefix ? label.toLowerCase().indexOf(prefix.toLowerCase()) : -1;
  if (at < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, at)}
      <span className="font-semibold text-white">{label.slice(at, at + prefix.length)}</span>
      {label.slice(at + prefix.length)}
    </>
  );
}

/**
 * Daftar saran autocomplete di bawah caret editor (dipindah ke atas bila mepet bawah layar).
 * Dirender lewat portal agar tidak terpotong `overflow-hidden` milik bingkai editor.
 */
export function CompletionPopup({ id, result, selected, anchor, onSelect, onAccept }: CompletionPopupProps): JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const option = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(id, selected))}`);
    option?.scrollIntoView({ block: 'nearest' });
  }, [id, selected]);

  const height = Math.min(result.items.length, VISIBLE_ROWS) * ROW_HEIGHT + FOOTER_HEIGHT + 2;
  const below = anchor.top + anchor.lineHeight + 2;
  const top = below + height > window.innerHeight - 8 ? Math.max(8, anchor.top - height - 2) : below;
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - WIDTH - 8));

  return createPortal(
    <div
      // Klik/seret di popup (scrollbar, footer) tidak boleh mencuri fokus dari editor — blur menutup popup.
      onMouseDown={(event) => event.preventDefault()}
      className="fixed z-50 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/95 shadow-2xl shadow-black/50 backdrop-blur"
      style={{ top, left, width: WIDTH }}
    >
      <ul
        ref={listRef}
        id={id}
        role="listbox"
        aria-label="Saran autocomplete"
        className="scrollbar-thin overflow-y-auto py-0.5"
        style={{ maxHeight: VISIBLE_ROWS * ROW_HEIGHT + 2 }}
      >
        {result.items.map((item, index) => {
          const badge = KIND_BADGE[item.kind];
          const active = index === selected;
          return (
            <li
              key={`${item.kind}:${item.label}`}
              id={optionId(id, index)}
              role="option"
              aria-selected={active}
              onMouseDown={(event) => {
                // Jangan curi fokus dari textarea.
                event.preventDefault();
                onAccept(item);
              }}
              onMouseMove={() => {
                if (!active) onSelect(index);
              }}
              className={`flex cursor-pointer items-center gap-2 px-2 font-mono text-[12.5px] ${
                active ? 'bg-emerald-500/20 text-slate-50' : 'text-slate-300'
              }`}
              style={{ height: ROW_HEIGHT }}
            >
              <span
                className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded text-[10px] font-bold ${badge.className}`}
                title={badge.label}
                aria-hidden
              >
                {badge.text}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <MatchedLabel label={item.label} prefix={result.prefix} />
              </span>
              <span className="max-w-[45%] shrink-0 truncate font-sans text-[10.5px] text-slate-500">{item.detail}</span>
            </li>
          );
        })}
      </ul>
      <div
        className="flex items-center gap-2 border-t border-slate-800 bg-slate-950/60 px-2 text-[10.5px] text-slate-500"
        style={{ height: FOOTER_HEIGHT }}
      >
        <span>
          <kbd className="font-mono text-slate-400">↑↓</kbd> pilih
        </span>
        <span>
          <kbd className="font-mono text-slate-400">Tab</kbd>/<kbd className="font-mono text-slate-400">Enter</kbd> sisipkan
        </span>
        <span>
          <kbd className="font-mono text-slate-400">Esc</kbd> tutup
        </span>
      </div>
    </div>,
    document.body,
  );
}
