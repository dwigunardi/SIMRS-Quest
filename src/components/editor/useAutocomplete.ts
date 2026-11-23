import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from 'react';
import { getCompletions, identifierEnd, isNoopCompletion, type CompletionItem, type CompletionResult, type CompletionSchema } from '../../lib/sqlComplete';
import type { CompletionAnchor } from './CompletionPopup';
import { caretViewportPoint, insertAtSelection } from './textInsert';

export interface AutocompleteState {
  result: CompletionResult;
  selected: number;
  anchor: CompletionAnchor;
}

export interface Autocomplete {
  state: AutocompleteState | null;
  listId: string;
  /** Dipanggil dari onChange textarea (setelah nilai diteruskan ke pemilik state). */
  handleInput: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  /** Dipanggil paling awal di onKeyDown. true = tombol sudah ditangani autocomplete. */
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  select: (index: number) => void;
  accept: (item: CompletionItem) => void;
  close: () => void;
}

const PAGE = 8;
/** Karakter yang memicu/memperbarui saran saat diketik. */
const TRIGGER = /[A-Za-z0-9_$.À-￿]$/;

function inputTypeOf(event: ChangeEvent<HTMLTextAreaElement>): string {
  const native = event.nativeEvent;
  return typeof InputEvent !== 'undefined' && native instanceof InputEvent ? native.inputType : '';
}

function insertedData(event: ChangeEvent<HTMLTextAreaElement>): string {
  const native = event.nativeEvent;
  return typeof InputEvent !== 'undefined' && native instanceof InputEvent ? (native.data ?? '') : '';
}

/**
 * Autocomplete ala IDE untuk textarea SQL: muncul saat mengetik nama (atau setelah `alias.`),
 * Ctrl+Space untuk memunculkan manual, ↑/↓ memilih, Tab/Enter menyisipkan, Esc menutup.
 */
export function useAutocomplete(
  textareaRef: RefObject<HTMLTextAreaElement>,
  schema: CompletionSchema,
  onChange: (value: string) => void,
  enabled: boolean,
): Autocomplete {
  const listId = useId();
  const [state, setState] = useState<AutocompleteState | null>(null);
  /** Input yang berasal dari sisipan saran sendiri tidak boleh memunculkan popup lagi. */
  const suppressInput = useRef(false);

  const close = useCallback(() => setState(null), []);

  const refresh = useCallback(
    (explicit: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea || !enabled || textarea.selectionStart !== textarea.selectionEnd) {
        setState(null);
        return;
      }
      const result = getCompletions(textarea.value, textarea.selectionStart, schema, explicit);
      if (!result) {
        setState(null);
        return;
      }
      setState((prev) => {
        // Pertahankan pilihan yang sama bila masih ada di daftar baru.
        const keep = prev ? prev.result.items[prev.selected]?.label : undefined;
        const index = keep ? result.items.findIndex((item) => item.label === keep) : -1;
        return { result, selected: Math.max(0, index), anchor: caretViewportPoint(textarea, result.from) };
      });
    },
    [enabled, schema, textareaRef],
  );

  const handleInput = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      if (suppressInput.current) {
        setState(null);
        return;
      }
      const type = inputTypeOf(event);
      if (type === 'insertText' && TRIGGER.test(insertedData(event))) refresh(false);
      else if (type === 'deleteContentBackward' && state) refresh(false);
      else setState(null);
    },
    [refresh, state],
  );

  const accept = useCallback(
    (item: CompletionItem) => {
      const textarea = textareaRef.current;
      if (!textarea || !state) return;
      textarea.focus();
      textarea.setSelectionRange(state.result.from, identifierEnd(textarea.value, textarea.selectionStart));
      // execCommand memicu event input SINKRON → abaikan selama sisipan saja, agar popup tidak langsung muncul
      // lagi. Flag dimatikan sesudahnya walau tidak ada event (mis. teks yang disisipkan sama persis).
      suppressInput.current = true;
      insertAtSelection(textarea, item.insert, onChange, item.caretBack);
      suppressInput.current = false;
      setState(null);
    },
    [onChange, state, textareaRef],
  );

  const select = useCallback((index: number) => {
    setState((prev) => (prev ? { ...prev, selected: index } : prev));
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (event.key === ' ' && event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        refresh(true);
        return true;
      }
      if (!state) return false;
      const count = state.result.items.length;
      const move = (delta: number, wrap: boolean) => {
        event.preventDefault();
        const next = state.selected + delta;
        const clamped = wrap ? (next + count) % count : Math.max(0, Math.min(count - 1, next));
        select(clamped);
      };
      const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
      switch (event.key) {
        case 'ArrowDown':
          move(1, true);
          return true;
        case 'ArrowUp':
          move(-1, true);
          return true;
        case 'PageDown':
          move(PAGE, false);
          return true;
        case 'PageUp':
          move(-PAGE, false);
          return true;
        case 'Escape':
          event.preventDefault();
          close();
          return true;
        case 'Enter':
        case 'Tab': {
          const item = state.result.items[state.selected];
          // Kata yang sudah lengkap (mis. "AND"): Enter = baris baru, Tab = indentasi seperti biasa.
          if (!plain || !item || isNoopCompletion(state.result, item)) {
            close();
            return false;
          }
          event.preventDefault();
          accept(item);
          return true;
        }
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'Home':
        case 'End':
          close();
          return false;
        default:
          return false;
      }
    },
    [accept, close, refresh, select, state],
  );

  // Popup memakai position: fixed → hitung ulang posisinya saat halaman/editor di-scroll atau di-resize.
  const open = state !== null;
  useEffect(() => {
    if (!open) return undefined;
    const reposition = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      setState((prev) => (prev ? { ...prev, anchor: caretViewportPoint(textarea, prev.result.from) } : prev));
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, textareaRef]);

  return { state, listId, handleInput, handleKeyDown, select, accept, close };
}
