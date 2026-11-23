/**
 * Deteksi platform untuk label shortcut keyboard. Aman dipanggil di luar browser
 * (mengembalikan non-Mac jika `navigator` tidak tersedia).
 */
function detectMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

export const IS_MAC: boolean = detectMac();

/** Label shortcut untuk menjalankan query (Ctrl/Cmd + Enter keduanya berfungsi). */
export const RUN_SHORTCUT_LABEL: string = IS_MAC ? '⌘ + Enter' : 'Ctrl + Enter';

/** true untuk Ctrl+Enter (Windows/Linux) atau Cmd+Enter (Mac) — shortcut "jalankan/kirim". */
export function isRunShortcut(event: { key: string; ctrlKey: boolean; metaKey: boolean }): boolean {
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey);
}

/** Label shortcut untuk Explain di Playground. */
export const EXPLAIN_SHORTCUT_LABEL: string = IS_MAC ? '⌘ + Shift + Enter' : 'Ctrl + Shift + Enter';
