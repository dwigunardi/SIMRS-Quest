/**
 * Sisipkan teks di posisi seleksi textarea. Memakai execCommand agar riwayat undo browser tetap
 * terjaga (Ctrl+Z membatalkan sisipan). `caretBack` memundurkan caret dari akhir sisipan, mis. 1
 * untuk meletakkan caret di dalam "()". Mengembalikan true jika sisipan lewat execCommand (memicu event
 * input seperti ketikan biasa), false jika lewat onChange langsung (tanpa event input).
 */
export function insertAtSelection(
  textarea: HTMLTextAreaElement,
  text: string,
  onChange: (value: string) => void,
  caretBack = 0,
): boolean {
  textarea.focus();
  const start = textarea.selectionStart;
  const caret = start + text.length - caretBack;
  // execCommand sudah deprecated, namun masih satu-satunya cara yang menjaga undo stack.
  const inserted = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
  if (inserted) {
    if (caretBack > 0) textarea.setSelectionRange(caret, caret);
    return true;
  }

  const { selectionEnd, value } = textarea;
  onChange(value.slice(0, start) + text + value.slice(selectionEnd));
  requestAnimationFrame(() => textarea.setSelectionRange(caret, caret));
  return false;
}

/** Lebar satu karakter font monospace textarea (px), diukur sekali per font. */
const charWidthCache = new Map<string, number>();

function charWidth(style: CSSStyleDeclaration): number {
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const cached = charWidthCache.get(font);
  if (cached !== undefined) return cached;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return Number.parseFloat(style.fontSize) * 0.6;
  context.font = font;
  const width = context.measureText('M'.repeat(100)).width / 100;
  charWidthCache.set(font, width);
  return width;
}

/** Kolom visual (tab dihitung sampai tab stop berikutnya). */
function visualColumn(line: string, tabSize: number): number {
  let col = 0;
  for (const ch of line) col = ch === '\t' ? col + tabSize - (col % tabSize) : col + 1;
  return col;
}

/**
 * Posisi karakter ke-`index` textarea dalam koordinat viewport. Mengandalkan font monospace dan
 * `wrap="off"` (tanpa pindah baris otomatis), seperti editor SQL aplikasi ini.
 */
export function caretViewportPoint(textarea: HTMLTextAreaElement, index: number): { left: number; top: number; lineHeight: number } {
  const style = getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5;
  const before = textarea.value.slice(0, index);
  const lineStart = before.lastIndexOf('\n') + 1;
  const line = before.length - before.replaceAll('\n', '').length;
  const tabSize = Number.parseInt(style.tabSize, 10) || 8;
  const column = visualColumn(before.slice(lineStart), tabSize);
  const rect = textarea.getBoundingClientRect();
  return {
    left: rect.left + textarea.clientLeft + Number.parseFloat(style.paddingLeft) + column * charWidth(style) - textarea.scrollLeft,
    top: rect.top + textarea.clientTop + Number.parseFloat(style.paddingTop) + line * lineHeight - textarea.scrollTop,
    lineHeight,
  };
}
