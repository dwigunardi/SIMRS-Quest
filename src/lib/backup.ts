/**
 * Cadangan progres (ekspor/impor file JSON). Fungsi murni + akses storage lewat parameter, sehingga bisa diuji di Node.
 *
 * Yang dicadangkan: progres (XP, misi, streak), riwayat Peta Kelemahan, daftar materi yang sudah dibaca, riwayat ujian,
 * dan jadwal latihan ulang.
 * Tidak termasuk: draf editor (memang tidak disimpan), ujian yang sedang berjalan, dan preferensi tampilan (lipatan panel).
 * Setiap bagian divalidasi dengan validator yang sama seperti saat aplikasi memuat localStorage.
 */
import { ARTICLE_READS_STORAGE_KEY, parseArticleReads } from '../hooks/useArticleReads';
import { MISTAKES_STORAGE_KEY, parseMistakeLog, type MistakeLog } from '../hooks/useMistakes';
import { STORAGE_KEY as PROGRESS_STORAGE_KEY, createEmptyProgress, getCompletedCount, parseProgress } from './progress';
import { EXAM_HISTORY_KEY, parseHistory, type ExamRecord } from './exam';
import { REVIEW_KEY, parseDeck, type ReviewDeck } from './review';
import { ACHIEVEMENTS_SEEN_KEY } from './achievements';
import type { UserProgress } from '../types';

export const BACKUP_APP = 'simrs-sql-quest';
export const BACKUP_FORMAT = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  /** ISO timestamp saat file dibuat. */
  exportedAt: string;
  progress: UserProgress;
  mistakes: MistakeLog;
  materiRead: string[];
  /** Riwayat ujian (opsional di file lama). */
  exams: ExamRecord[];
  /** Jadwal latihan ulang per misi (opsional di file lama). */
  reviews: ReviewDeck;
}

export interface BackupSummary {
  xp: number;
  completed: number;
  mistakes: number;
  articlesRead: number;
  exams: number;
  exportedAt: string;
}

export type BackupStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type ParsedBackup = { ok: true; backup: BackupFile; summary: BackupSummary } | { ok: false; error: string };

function readJson(storage: BackupStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function readProgress(storage: BackupStorage): UserProgress {
  const raw = readJson(storage, PROGRESS_STORAGE_KEY);
  if (!raw) return createEmptyProgress();
  try {
    return parseProgress(JSON.parse(raw)) ?? createEmptyProgress();
  } catch {
    return createEmptyProgress();
  }
}

export function summarize(backup: Pick<BackupFile, 'progress' | 'mistakes' | 'materiRead' | 'exams' | 'exportedAt'>): BackupSummary {
  return {
    xp: backup.progress.xp,
    completed: getCompletedCount(backup.progress),
    mistakes: backup.mistakes.events.length,
    articlesRead: backup.materiRead.length,
    exams: backup.exams.length,
    exportedAt: backup.exportedAt,
  };
}

/** Kumpulkan data yang tersimpan menjadi satu objek cadangan. */
export function createBackup(storage: BackupStorage, now: Date): BackupFile {
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    progress: readProgress(storage),
    mistakes: parseMistakeLog(readJson(storage, MISTAKES_STORAGE_KEY)),
    materiRead: [...parseArticleReads(readJson(storage, ARTICLE_READS_STORAGE_KEY))],
    exams: readExams(storage),
    reviews: readReviews(storage),
  };
}

function readReviews(storage: BackupStorage): ReviewDeck {
  const raw = readJson(storage, REVIEW_KEY);
  if (!raw) return {};
  try {
    return parseDeck(JSON.parse(raw));
  } catch {
    return {};
  }
}

function readExams(storage: BackupStorage): ExamRecord[] {
  const raw = readJson(storage, EXAM_HISTORY_KEY);
  if (!raw) return [];
  try {
    return parseHistory(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Nama file unduhan, mis. simrs-sql-quest-progres-2026-11-22.json (tanggal lokal). */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${BACKUP_APP}-progres-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** Validasi isi file cadangan. Progres wajib valid; riwayat kesalahan & materi opsional (dibersihkan bila rusak). */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File ini bukan JSON yang valid. Pilih file cadangan yang diunduh dari tombol Ekspor.' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: 'Isi file tidak dikenali sebagai cadangan progres SIMRS SQL Quest.' };
  }
  const v = data as Record<string, unknown>;
  if (v.app !== BACKUP_APP) return { ok: false, error: 'File ini bukan cadangan progres SIMRS SQL Quest.' };
  if (typeof v.format !== 'number' || v.format > BACKUP_FORMAT) {
    return { ok: false, error: 'Cadangan ini dibuat oleh versi aplikasi yang lebih baru. Perbarui aplikasinya dulu.' };
  }
  if (v.format !== BACKUP_FORMAT) return { ok: false, error: 'Format cadangan tidak dikenal.' };
  const progress = parseProgress(v.progress);
  if (!progress) return { ok: false, error: 'Data progres di dalam file rusak atau tidak lengkap, jadi tidak diimpor.' };
  const exportedAt = typeof v.exportedAt === 'string' && !Number.isNaN(Date.parse(v.exportedAt)) ? v.exportedAt : '';
  const backup: BackupFile = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt,
    progress,
    mistakes: v.mistakes === undefined ? { events: [], solved: {} } : parseMistakeLog(JSON.stringify(v.mistakes)),
    materiRead: v.materiRead === undefined ? [] : [...parseArticleReads(JSON.stringify(v.materiRead))],
    exams: parseHistory(v.exams),
    reviews: parseDeck(v.reviews),
  };
  return { ok: true, backup, summary: summarize(backup) };
}

/**
 * Tulis cadangan ke storage (menimpa data saat ini). false bila browser menolak penyimpanan — dalam kasus itu
 * sebagian kunci mungkin sudah tertulis, jadi pemanggil sebaiknya tetap memuat ulang halaman.
 */
export function applyBackup(storage: BackupStorage, backup: BackupFile): boolean {
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(backup.progress));
    storage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(backup.mistakes));
    storage.setItem(ARTICLE_READS_STORAGE_KEY, JSON.stringify(backup.materiRead));
    storage.setItem(EXAM_HISTORY_KEY, JSON.stringify(backup.exams));
    storage.setItem(REVIEW_KEY, JSON.stringify(backup.reviews));
    // Lencana dihitung ulang dari data yang diimpor. Daftar "sudah diumumkan" dikosongkan ke nilai tak-valid agar
    // lencana hasil impor dicatat diam-diam (seperti pengguna lama), bukan memunculkan rentetan notifikasi.
    storage.setItem(ACHIEVEMENTS_SEEN_KEY, 'null');
    return true;
  } catch {
    return false;
  }
}
