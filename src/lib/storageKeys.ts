/**
 * Semua kunci localStorage aplikasi, di satu tempat.
 *
 * Dua keluarga kunci:
 * - `simrs-sql-quest:*:v1` — milik jalur SQL. Awalannya nama produk LAMA dan sengaja dibiarkan: data pengguna yang
 *   sudah ada dipakai apa adanya (tanpa migrasi). JANGAN diganti nama; mengganti satu huruf saja berarti progres
 *   pengguna "hilang". scripts/verify/fixtures.ts memeriksa nilai-nilai ini terhadap fixture emas.
 * - `simrs-quest:*` — milik platform (lintas jalur). Awalan ini beku dan tidak terikat nama produk
 *   (src/platform/brand.ts boleh berubah; kunci ini tidak).
 *
 * Modul lama (lib/progress, lib/exam, lib/review, lib/achievements, hooks/useMistakes, hooks/useArticleReads) tetap
 * mengekspor nama konstanta lamanya dengan mengimpor dari sini, jadi pemanggil tidak perlu berubah.
 */

/* ------------------------------------------------------------------ */
/* Jalur SQL                                                           */
/* ------------------------------------------------------------------ */

/** Progres: XP, streak, status tiap misi, misi terakhir dibuka (UserProgress). */
export const PROGRESS_KEY = 'simrs-sql-quest:progress:v1';
/** Riwayat Peta Kelemahan: kejadian salah + waktu jawaban benar terakhir per misi (MistakeLog). */
export const MISTAKES_KEY = 'simrs-sql-quest:mistakes:v1';
/** Id materi yang sudah dibuka (string[]). */
export const ARTICLE_READS_KEY = 'simrs-sql-quest:materi-read:v1';
/** Pilihan lipat/buka Skenario & Tugas (preferensi tampilan). */
export const BRIEF_FOLD_KEY = 'simrs-sql-quest:brief-fold:v1';
/** Sesi ujian / latihan ulang yang sedang berjalan (ExamSession); dihapus saat dikumpulkan. */
export const EXAM_SESSION_KEY = 'simrs-sql-quest:exam-session:v1';
/** Riwayat ujian & latihan ulang (ExamRecord[]). */
export const EXAM_HISTORY_KEY = 'simrs-sql-quest:exams:v1';
/** Jadwal latihan ulang / deck Leitner (ReviewDeck). */
export const REVIEW_KEY = 'simrs-sql-quest:review:v1';
/** Id lencana yang sudah diumumkan (string[]). */
export const ACHIEVEMENTS_SEEN_KEY = 'simrs-sql-quest:achievements-seen:v1';

/** Semua kunci jalur SQL. */
export const SQL_TRACK_KEYS: readonly string[] = [
  PROGRESS_KEY,
  MISTAKES_KEY,
  ARTICLE_READS_KEY,
  BRIEF_FOLD_KEY,
  EXAM_SESSION_KEY,
  EXAM_HISTORY_KEY,
  REVIEW_KEY,
  ACHIEVEMENTS_SEEN_KEY,
];

/**
 * Kunci jalur SQL yang dijaga karantina (src/lib/storageGuard.ts): data pengguna yang tidak bisa dibangun ulang.
 * Tidak termasuk: sesi ujian (kedaluwarsa/tidak valid itu wajar), lipatan brief (preferensi tampilan), dan lencana
 * terlihat (impor cadangan memang sengaja menulis nilai tak-valid di sana).
 */
export const SQL_GUARDED_KEYS: readonly string[] = [PROGRESS_KEY, MISTAKES_KEY, ARTICLE_READS_KEY, EXAM_HISTORY_KEY, REVIEW_KEY];

/* ------------------------------------------------------------------ */
/* Platform                                                            */
/* ------------------------------------------------------------------ */

/** Sambutan Beranda sudah ditutup/dilihat. */
export const HOME_INTRO_KEY = 'simrs-quest:home-intro:v1';
/**
 * Waktu karantina (ISO) terakhir yang peringatannya sudah ditutup pengguna di Beranda. Salinan karantina sendiri tidak
 * pernah dihapus, jadi tanpa catatan ini peringatannya akan tampil selamanya; karantina yang LEBIH BARU tetap tampil.
 */
export const QUARANTINE_ACK_KEY = 'simrs-quest:quarantine-ack:v1';
