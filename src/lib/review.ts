/**
 * Latihan ulang terjadwal (fungsi murni) — sistem kotak Leitner sederhana.
 *
 * - Setiap misi yang SUDAH SELESAI (jenis yang bisa diujikan: SQL non-boss & Tebak Hasil) punya kartu ulang. Misi yang belum
 *   pernah diulang memakai kartu bawaan: kotak 0, jatuh tempo sehari setelah diselesaikan.
 * - Jawaban benar menaikkan kotak (jarak tayang 1 → 3 → 7 → 14 → 30 → 60 hari); jawaban salah mengembalikan ke kotak 0
 *   (muncul lagi besok). Soal yang dilewati tidak mengubah jadwal.
 * - Sesi harian mengambil kartu yang jatuh tempo dengan prioritas: paling lama terlambat, sering salah akhir-akhir ini
 *   (Peta Kelemahan), dan sering gagal diulang.
 * Tanggal memakai tanggal LOKAL (YYYY-MM-DD) seperti streak, dan dihitung lewat siang hari agar aman dari pergeseran DST.
 */
import { isExamMission, type ExamItemStatus, type ExamMission } from './exam';
import type { MistakeEvent } from './mistakes';
import { getMissionProgress, toLocalDateKey } from './progress';
import type { Mission, UserProgress } from '../types';

export { REVIEW_KEY } from './storageKeys';
/** Jarak tayang (hari) per kotak. */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60] as const;
export const MAX_BOX = REVIEW_INTERVALS.length - 1;
export const REVIEW_SESSION_SIZES = [5, 10] as const;
/** Kesalahan di Peta Kelemahan yang dihitung untuk prioritas (hari terakhir). */
const RECENT_MISTAKE_DAYS = 30;

export interface ReviewCard {
  /** 0..MAX_BOX */
  box: number;
  /** Tanggal lokal jatuh tempo, YYYY-MM-DD. */
  due: string;
  /** Berapa kali sudah diulang (benar/salah). */
  reviews: number;
  /** Berapa kali gagal saat diulang. */
  lapses: number;
}

export type ReviewDeck = Readonly<Record<string, ReviewCard>>;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Tanggal lokal `dateKey` + `days` hari. */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return toLocalDateKey(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days, 12, 0, 0, 0));
}

/** Selisih hari kalender b − a (keduanya YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  const at = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((at(b) - at(a)) / 86_400_000);
}

/** Kartu misi: tersimpan, atau bawaan dari tanggal selesai. null bila misi belum selesai / bukan jenis yang bisa diulang. */
export function cardFor(deck: ReviewDeck, mission: Mission, progress: UserProgress): ReviewCard | null {
  if (!isExamMission(mission)) return null;
  const mp = getMissionProgress(progress, mission.id);
  if (!mp.completed) return null;
  const stored = Object.hasOwn(deck, mission.id) ? deck[mission.id] : undefined;
  if (stored) return stored;
  const completed = mp.completedAt && !Number.isNaN(Date.parse(mp.completedAt)) ? toLocalDateKey(new Date(mp.completedAt)) : null;
  return { box: 0, due: completed ? addDays(completed, REVIEW_INTERVALS[0]) : '1970-01-01', reviews: 0, lapses: 0 };
}

export interface DueItem {
  mission: ExamMission;
  card: ReviewCard;
  /** Hari keterlambatan (0 = jatuh tempo hari ini). */
  overdue: number;
  /** Kesalahan misi ini di Peta Kelemahan dalam 30 hari terakhir. */
  recentMistakes: number;
  priority: number;
}

/** Kartu yang jatuh tempo pada `today`, prioritas tertinggi lebih dulu (lalu urutan kurikulum). */
export function dueItems(missions: readonly Mission[], progress: UserProgress, deck: ReviewDeck, events: readonly MistakeEvent[], today: string): DueItem[] {
  const since = addDays(today, -RECENT_MISTAKE_DAYS);
  const mistakes = new Map<string, number>();
  for (const e of events) {
    if (Number.isNaN(Date.parse(e.at)) || toLocalDateKey(new Date(e.at)) < since) continue;
    mistakes.set(e.missionId, (mistakes.get(e.missionId) ?? 0) + 1);
  }
  const items: DueItem[] = [];
  for (const mission of missions) {
    const card = cardFor(deck, mission, progress);
    if (!card || card.due > today || !isExamMission(mission)) continue;
    const overdue = Math.max(0, daysBetween(card.due, today));
    const recentMistakes = mistakes.get(mission.id) ?? 0;
    items.push({ mission, card, overdue, recentMistakes, priority: overdue + 2 * recentMistakes + card.lapses });
  }
  return items.sort((a, b) => b.priority - a.priority || a.mission.order - b.mission.order);
}

export interface ReviewForecast {
  dueToday: number;
  /** Jatuh tempo besok (belum termasuk yang hari ini). */
  dueTomorrow: number;
  /** Tanggal jatuh tempo terdekat setelah hari ini, atau null bila tidak ada kartu. */
  nextDate: string | null;
  /** Jumlah misi yang punya jadwal ulang (sudah selesai & bisa diulang). */
  total: number;
}

export function forecast(missions: readonly Mission[], progress: UserProgress, deck: ReviewDeck, today: string): ReviewForecast {
  const tomorrow = addDays(today, 1);
  let dueToday = 0;
  let dueTomorrow = 0;
  let nextDate: string | null = null;
  let total = 0;
  for (const mission of missions) {
    const card = cardFor(deck, mission, progress);
    if (!card) continue;
    total += 1;
    if (card.due <= today) dueToday += 1;
    else {
      if (card.due === tomorrow) dueTomorrow += 1;
      if (nextDate === null || card.due < nextDate) nextDate = card.due;
    }
  }
  return { dueToday, dueTomorrow, nextDate, total };
}

/** Kartu setelah diulang pada `today`. */
export function applyReview(card: ReviewCard, correct: boolean, today: string): ReviewCard {
  if (!correct) return { box: 0, due: addDays(today, REVIEW_INTERVALS[0]), reviews: card.reviews + 1, lapses: card.lapses + 1 };
  const box = Math.min(card.box + 1, MAX_BOX);
  return { box, due: addDays(today, REVIEW_INTERVALS[box] ?? 1), reviews: card.reviews + 1, lapses: card.lapses };
}

/**
 * Perbarui deck dari hasil sesi (latihan ulang ATAU ujian): hanya misi yang sudah selesai; soal yang tidak dijawab
 * tidak mengubah jadwal.
 */
export function updateDeck(
  deck: ReviewDeck,
  missions: readonly Mission[],
  progress: UserProgress,
  items: ReadonlyArray<{ missionId: string; status: ExamItemStatus }>,
  today: string,
): ReviewDeck {
  const next: Record<string, ReviewCard> = { ...deck };
  const byId = new Map(missions.map((m) => [m.id, m]));
  for (const item of items) {
    if (item.status === 'unanswered') continue;
    const mission = byId.get(item.missionId);
    const card = mission ? cardFor(next, mission, progress) : null;
    if (card) next[item.missionId] = applyReview(card, item.status === 'correct', today);
  }
  return next;
}

/** Deck tersimpan; kartu rusak dilewati. */
export function parseDeck(value: unknown): ReviewDeck {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const deck: Record<string, ReviewCard> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const { box, due, reviews, lapses } = raw as Record<string, unknown>;
    const count = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
    if (!count(box) || box > MAX_BOX || typeof due !== 'string' || !DATE_KEY.test(due) || !count(reviews) || !count(lapses)) continue;
    deck[id] = { box, due, reviews, lapses };
  }
  return deck;
}

/** "hari ini", "besok", "3 hari lagi (26 Nov)". */
export function describeDue(due: string, today: string): string {
  const days = daysBetween(today, due);
  if (days <= 0) return 'hari ini';
  if (days === 1) return 'besok';
  const [y, m, d] = due.split('-').map(Number);
  const label = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return `${days} hari lagi (${label})`;
}
