/**
 * Lencana pencapaian (fungsi murni). Semua lencana DIHITUNG dari data yang sudah ada — progres, riwayat kesalahan,
 * riwayat ujian/latihan ulang, jadwal ulang, dan materi yang dibaca — sehingga tidak ada state baru yang bisa rusak,
 * dan cadangan progres otomatis ikut memulihkannya. Yang disimpan terpisah hanya daftar lencana yang sudah
 * DIUMUMKAN (agar notifikasi "lencana baru" muncul sekali).
 */
import type { ExamRecord } from './exam';
import type { MistakeEvent } from './mistakes';
import { getMissionProgress } from './progress';
import { MAX_BOX, REVIEW_INTERVALS, type ReviewDeck } from './review';
import type { Mission, Tier, UserProgress } from '../types';

export { ACHIEVEMENTS_SEEN_KEY } from './storageKeys';

export type AchievementCategory = 'Perjalanan' | 'Boss' | 'Ketepatan' | 'Konsistensi' | 'Ujian & Ulang' | 'Materi';

export interface AchievementContext {
  missions: readonly Mission[];
  progress: UserProgress;
  mistakes: { events: readonly MistakeEvent[]; solved: Readonly<Record<string, string>> };
  exams: readonly ExamRecord[];
  reviewDeck: ReviewDeck;
  articlesRead: ReadonlySet<string>;
  articleCount: number;
}

export interface AchievementStatus {
  earned: boolean;
  /** Kemajuan menuju target (dibatasi target). */
  current: number;
  target: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  /** Emoji lencana. */
  icon: string;
  category: AchievementCategory;
  evaluate: (ctx: AchievementContext) => AchievementStatus;
}

function count(current: number, target: number): AchievementStatus {
  return { earned: current >= target, current: Math.min(current, target), target };
}

const isBoss = (m: Mission) => m.kind === 'sql' && m.boss !== undefined;
const done = (ctx: AchievementContext, m: Mission) => getMissionProgress(ctx.progress, m.id).completed;
const doneCount = (ctx: AchievementContext, list: readonly Mission[]) => list.filter((m) => done(ctx, m)).length;
const inTier = (ctx: AchievementContext, tier: Tier) => ctx.missions.filter((m) => m.tier === tier);
const lastTier = (ctx: AchievementContext) => Math.max(...ctx.missions.map((m) => m.tier)) as Tier;

/** Misi yang diselesaikan tanpa hint, tanpa solusi, pada percobaan pertama. */
function cleanFirstTry(ctx: AchievementContext): number {
  return ctx.missions.filter((m) => {
    const mp = getMissionProgress(ctx.progress, m.id);
    return mp.completed && mp.attempts <= 1 && !mp.hintUsed && !mp.solutionShown;
  }).length;
}

/** Tier yang semua misinya selesai tanpa hint & tanpa solusi. */
function independentTiers(ctx: AchievementContext): number {
  const tiers = [...new Set(ctx.missions.map((m) => m.tier))];
  return tiers.filter((t) =>
    inTier(ctx, t).every((m) => {
      const mp = getMissionProgress(ctx.progress, m.id);
      return mp.completed && !mp.hintUsed && !mp.solutionShown;
    }),
  ).length;
}

/** Misi yang pernah salah lalu dijawab benar setelah kesalahan terakhirnya. */
function bouncedBack(ctx: AchievementContext): number {
  const lastMistake = new Map<string, number>();
  for (const e of ctx.mistakes.events) {
    const at = Date.parse(e.at);
    if (!Number.isNaN(at)) lastMistake.set(e.missionId, Math.max(lastMistake.get(e.missionId) ?? 0, at));
  }
  let n = 0;
  for (const [id, at] of lastMistake) {
    const solved = ctx.mistakes.solved[id];
    if (solved && Date.parse(solved) > at) n += 1;
  }
  return n;
}

const examRecords = (ctx: AchievementContext) => ctx.exams.filter((r) => r.purpose === 'exam');
const reviewCorrect = (ctx: AchievementContext) =>
  ctx.exams.filter((r) => r.purpose === 'review').reduce((n, r) => n + r.items.filter((i) => i.status === 'correct').length, 0);

export const ACHIEVEMENTS: readonly Achievement[] = [
  // --- Perjalanan ---
  { id: 'hari-pertama', title: 'Hari Pertama', description: 'Selesaikan misi pertamamu.', icon: '🩺', category: 'Perjalanan', evaluate: (c) => count(doneCount(c, c.missions), 1) },
  { id: 'seperempat-jalan', title: 'Seperempat Jalan', description: 'Selesaikan 25% dari seluruh misi.', icon: '🧭', category: 'Perjalanan', evaluate: (c) => count(doneCount(c, c.missions), Math.ceil(c.missions.length / 4)) },
  { id: 'dasar-kokoh', title: 'Dasar Kokoh', description: 'Tuntaskan Tier 1–3 (query, JOIN, agregasi, kasus nyata).', icon: '🧱', category: 'Perjalanan', evaluate: (c) => { const l = c.missions.filter((m) => m.tier <= 3); return count(doneCount(c, l), l.length); } },
  { id: 'arsitek-data', title: 'Arsitek Data', description: 'Tuntaskan Tier 9: Desain Tabel & DDL.', icon: '📐', category: 'Perjalanan', evaluate: (c) => { const l = inTier(c, 9); return count(doneCount(c, l), l.length); } },
  { id: 'integrator', title: 'Integrator SATUSEHAT', description: 'Tuntaskan Tier 10: fungsi tanggal, teks & JSON.', icon: '🛰️', category: 'Perjalanan', evaluate: (c) => { const l = inTier(c, 10); return count(doneCount(c, l), l.length); } },
  { id: 'peretas-etis', title: 'Peretas Etis', description: 'Tembus kedua lab SQL injection (lalu pahami cara menutupnya).', icon: '🛡️', category: 'Perjalanan', evaluate: (c) => { const l = c.missions.filter((m) => m.kind === 'injection'); return count(doneCount(c, l), l.length); } },
  { id: 'tuntas', title: 'Tuntas Semua', description: 'Selesaikan seluruh misi SIMRS SQL Quest.', icon: '🏁', category: 'Perjalanan', evaluate: (c) => count(doneCount(c, c.missions), c.missions.length) },

  // --- Boss ---
  { id: 'boss-pertama', title: 'Boss Pertama Tumbang', description: 'Kalahkan satu Boss Challenge.', icon: '⚔️', category: 'Boss', evaluate: (c) => count(doneCount(c, c.missions.filter(isBoss)), 1) },
  {
    id: 'sekali-tebas',
    title: 'Sekali Tebas',
    description: 'Kalahkan sebuah boss pada percobaan pertama, tanpa membuka solusi.',
    icon: '🗡️',
    category: 'Boss',
    evaluate: (c) => count(c.missions.filter((m) => { const mp = getMissionProgress(c.progress, m.id); return isBoss(m) && mp.completed && mp.attempts <= 1 && !mp.solutionShown; }).length, 1),
  },
  { id: 'final-boss', title: 'Final Boss Tumbang', description: 'Kalahkan boss tier terakhir.', icon: '👑', category: 'Boss', evaluate: (c) => count(doneCount(c, c.missions.filter((m) => isBoss(m) && m.tier === lastTier(c))), 1) },
  { id: 'penakluk-boss', title: 'Penakluk Semua Boss', description: 'Kalahkan Boss Challenge di setiap tier.', icon: '🏆', category: 'Boss', evaluate: (c) => { const l = c.missions.filter(isBoss); return count(doneCount(c, l), l.length); } },

  // --- Ketepatan ---
  { id: 'tepat-sasaran', title: 'Tepat Sasaran', description: 'Selesaikan 10 misi pada percobaan pertama tanpa hint & solusi.', icon: '🎯', category: 'Ketepatan', evaluate: (c) => count(cleanFirstTry(c), 10) },
  { id: 'mandiri', title: 'Mandiri', description: 'Tuntaskan satu tier penuh tanpa hint dan tanpa solusi.', icon: '🦉', category: 'Ketepatan', evaluate: (c) => count(independentTiers(c), 1) },
  { id: 'bangkit', title: 'Bangkit Lagi', description: 'Jawab benar 5 misi yang sebelumnya pernah salah.', icon: '🔁', category: 'Ketepatan', evaluate: (c) => count(bouncedBack(c), 5) },

  // --- Konsistensi ---
  { id: 'streak-3', title: 'Pemanasan', description: 'Aktif 3 hari berturut-turut.', icon: '🔥', category: 'Konsistensi', evaluate: (c) => count(c.progress.streak.best, 3) },
  { id: 'streak-7', title: 'Seminggu Penuh', description: 'Aktif 7 hari berturut-turut.', icon: '📅', category: 'Konsistensi', evaluate: (c) => count(c.progress.streak.best, 7) },
  { id: 'streak-30', title: 'Kebiasaan Baru', description: 'Aktif 30 hari berturut-turut.', icon: '🌱', category: 'Konsistensi', evaluate: (c) => count(c.progress.streak.best, 30) },

  // --- Ujian & ulang ---
  { id: 'ujian-pertama', title: 'Berani Diuji', description: 'Kumpulkan satu Mode Ujian.', icon: '📝', category: 'Ujian & Ulang', evaluate: (c) => count(examRecords(c).length, 1) },
  {
    id: 'nilai-sempurna',
    title: 'Nilai Sempurna',
    description: 'Dapatkan nilai 100 di Mode Ujian berisi minimal 5 soal.',
    icon: '💯',
    category: 'Ujian & Ulang',
    evaluate: (c) => count(examRecords(c).filter((r) => r.items.length >= 5 && r.items.every((i) => i.status === 'correct')).length, 1),
  },
  { id: 'rajin-mengulang', title: 'Rajin Mengulang', description: 'Jawab benar 20 soal di latihan ulang.', icon: '🔂', category: 'Ujian & Ulang', evaluate: (c) => count(reviewCorrect(c), 20) },
  { id: 'ingatan-baja', title: 'Ingatan Baja', description: `Bawa satu misi ke kotak latihan ulang tertinggi (jarak ${REVIEW_INTERVALS[MAX_BOX]} hari).`, icon: '🧠', category: 'Ujian & Ulang', evaluate: (c) => count(Object.values(c.reviewDeck).some((card) => card.box >= MAX_BOX) ? 1 : 0, 1) },

  // --- Materi ---
  { id: 'rajin-membaca', title: 'Rajin Membaca', description: 'Buka 10 artikel materi.', icon: '📖', category: 'Materi', evaluate: (c) => count(c.articlesRead.size, 10) },
  { id: 'kutu-buku', title: 'Kutu Buku', description: 'Buka semua artikel materi.', icon: '📚', category: 'Materi', evaluate: (c) => count(c.articlesRead.size, c.articleCount) },
];

export interface EvaluatedAchievement extends Achievement {
  status: AchievementStatus;
}

export function evaluateAchievements(ctx: AchievementContext): EvaluatedAchievement[] {
  return ACHIEVEMENTS.map((a) => ({ ...a, status: a.evaluate(ctx) }));
}

/** Daftar id lencana yang sudah diumumkan (tersimpan); data rusak → null (anggap belum pernah dicatat). */
export function parseSeen(value: unknown): Set<string> | null {
  if (!Array.isArray(value)) return null;
  return new Set(value.filter((v): v is string => typeof v === 'string'));
}
