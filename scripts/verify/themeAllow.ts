/**
 * Pasangan warna tema TERANG yang boleh di bawah AA untuk sementara/permanen (dibaca scripts/verify/theme.ts).
 *
 * Kunci pasangan = teks yang dicetak `npx tsx scripts/verify/theme.ts --table --fail`, mis.
 *   "text-emerald-50 @ bg-emerald-700/40 > bg-emerald-500".
 * Entri mencocokkan berkas + (`key` persis, ATAU `fg` = kelas teks di awal kunci, semua latar) + `state` opsional.
 *
 * - LIGHT_PENDING: menunggu perbaikan di komponen (varian `light:` atau perubahan kecil). Daftar ini HANYA BOLEH
 *   MENYUSUT: entri yang sudah tidak mengenai pasangan gagal mana pun membuat verify merah (hapus entrinya).
 * - LIGHT_EXEMPT: pengecualian permanen dengan alasan (mis. teks dekoratif aria-hidden, kontrol nonaktif — WCAG 1.4.3
 *   mengecualikan keduanya). Jangan dipakai untuk menyembunyikan teks yang memang harus terbaca.
 */
export interface AllowEntry {
  file: string;
  key?: string;
  fg?: string;
  state?: string;
  reason: string;
}

/** Ditemukan tahap fondasi (palet terang awal); dibereskan para pembangun layar. */
export const LIGHT_PENDING: AllowEntry[] = [];

export const LIGHT_EXEMPT: AllowEntry[] = [];
