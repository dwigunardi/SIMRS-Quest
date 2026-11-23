/**
 * Langkah impor cadangan yang dipakai bersama oleh kartu "Cadangan progres" (mode Progres) dan tautan "Pulihkan" di
 * Beranda: baca file → validasi (parseBackup) → ringkasan isi file dan isi browser saat ini → tulis (applyBackup).
 * Konfirmasi dan muat ulang halaman tetap urusan pemanggil, karena tampilannya berbeda di dua tempat itu.
 *
 * Beranda mengimpor modul ini secara DINAMIS (modul cadangan menarik semua validator data jalur SQL).
 */
import { applyBackup, createBackup, parseBackup, summarize, type BackupFile, type BackupStorage, type BackupSummary } from './backup';

export const STORAGE_BLOCKED_IMPORT = 'Browser ini tidak mengizinkan akses penyimpanan, jadi cadangan tidak bisa diimpor.';
export const WRITE_FAILED_MESSAGE = 'Browser menolak menyimpan data (penyimpanan penuh atau diblokir). Progres mungkin hanya terimpor sebagian.';
export const FILE_UNREADABLE = 'File tidak bisa dibaca. Pilih file cadangan (.json) yang diunduh dari tombol Ekspor.';

/** Satu baris ringkasan isi cadangan, mis. "760 XP, 12 misi selesai, …". */
export function describeSummary(s: BackupSummary): string {
  return `${s.xp.toLocaleString('id-ID')} XP, ${s.completed} misi selesai, ${s.mistakes} catatan kesalahan, ${s.articlesRead} materi dibaca, ${s.exams} ujian`;
}

export function formatBackupDate(iso: string): string {
  if (!iso) return 'tanggal tidak diketahui';
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Tidak ada apa pun yang akan tertimpa (browser masih kosong). */
export function isEmptySummary(s: BackupSummary): boolean {
  return s.xp === 0 && s.completed === 0 && s.mistakes === 0 && s.articlesRead === 0 && s.exams === 0;
}

export type BackupCandidate =
  | { ok: true; backup: BackupFile; summary: BackupSummary; /** Isi browser saat ini (yang akan DIGANTI). */ current: BackupSummary }
  | { ok: false; error: string };

/** Baca & validasi file pilihan pengguna. Tidak menulis apa pun; file yang salah menghasilkan pesan yang jelas. */
export async function readBackupFile(file: Pick<File, 'text'>, storage: BackupStorage | null, now: Date = new Date()): Promise<BackupCandidate> {
  if (!storage) return { ok: false, error: STORAGE_BLOCKED_IMPORT };
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: FILE_UNREADABLE };
  }
  const parsed = parseBackup(text);
  if (!parsed.ok) return parsed;
  return { ok: true, backup: parsed.backup, summary: parsed.summary, current: summarize(createBackup(storage, now)) };
}

/** Tulis cadangan (menimpa data saat ini). false = browser menolak; sebagian kunci mungkin sudah tertulis. */
export function restoreBackup(storage: BackupStorage, backup: BackupFile): boolean {
  return applyBackup(storage, backup);
}
