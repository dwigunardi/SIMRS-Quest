/**
 * Verifikasi lencana pencapaian (src/lib/achievements.ts): definisi konsisten, tidak ada lencana "mati" (target 0 atau
 * mustahil), progres kosong tidak meraih apa pun, kurikulum tuntas meraih semua lencana perjalanan & boss, dan aturan
 * khusus (percobaan pertama, tanpa bantuan, bangkit lagi, nilai sempurna, kotak tertinggi) dihitung dengan benar.
 */
import { ARTICLES } from '../../src/data/materi';
import { MISSIONS } from '../../src/data/missions';
import { ACHIEVEMENTS, ACHIEVEMENTS_SEEN_KEY, evaluateAchievements, parseSeen, type AchievementContext } from '../../src/lib/achievements';
import { applyBackup, createBackup, type BackupStorage } from '../../src/lib/backup';
import type { ExamRecord } from '../../src/lib/exam';
import { createEmptyProgress } from '../../src/lib/progress';
import { MAX_BOX } from '../../src/lib/review';
import type { MissionProgress, UserProgress } from '../../src/types';
import { assert } from './report';

function mp(over: Partial<MissionProgress> = {}): MissionProgress {
  return { completed: true, earnedXp: 0, hintUsed: false, hintsRevealed: 0, solutionShown: false, attempts: 1, completedAt: '2026-11-20T00:00:00.000Z', ...over };
}

function progressOf(entries: Record<string, MissionProgress>, best = 0): UserProgress {
  return { ...createEmptyProgress(), missions: entries, streak: { current: best, best, lastActiveDate: best > 0 ? '2026-11-20' : null } };
}

function ctx(over: Partial<AchievementContext> = {}): AchievementContext {
  return { missions: MISSIONS, progress: createEmptyProgress(), mistakes: { events: [], solved: {} }, exams: [], reviewDeck: {}, articlesRead: new Set(), articleCount: ARTICLES.length, ...over };
}

function exam(purpose: 'exam' | 'review', statuses: Array<'correct' | 'wrong' | 'unanswered'>, id: string): ExamRecord {
  return {
    id,
    purpose,
    startedAt: '2026-11-20T01:00:00.000Z',
    finishedAt: '2026-11-20T01:10:00.000Z',
    timedOut: false,
    config: { tiers: [1], count: statuses.length, minutes: null },
    items: statuses.map((status, i) => ({ missionId: MISSIONS[i]?.id ?? 'x', status, kind: null, message: '', answer: '' })),
  };
}

class MemoryStorage implements BackupStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

export function verifyAchievements(): void {
  let checks = 0;
  const ok = (cond: boolean, msg: string) => {
    checks += 1;
    assert(cond, `lencana: ${msg}`);
  };
  const earned = (c: AchievementContext) => new Set(evaluateAchievements(c).filter((a) => a.status.earned).map((a) => a.id));

  // --- Definisi ---
  const ids = ACHIEVEMENTS.map((a) => a.id);
  ok(new Set(ids).size === ids.length, 'id lencana harus unik');
  ok(ACHIEVEMENTS.every((a) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.id) && a.title.trim() !== '' && a.description.trim() !== '' && a.icon.trim() !== ''), 'id kebab-case, judul/deskripsi/ikon terisi');
  const empty = evaluateAchievements(ctx());
  ok(empty.every((a) => a.status.target >= 1), `tidak boleh ada lencana bertarget 0 (${empty.filter((a) => a.status.target < 1).map((a) => a.id).join(', ')})`);
  ok(empty.every((a) => !a.status.earned && a.status.current === 0), 'progres kosong tidak meraih lencana apa pun');

  // --- Kurikulum tuntas (semua sekali coba, tanpa bantuan) ---
  const allDone = progressOf(Object.fromEntries(MISSIONS.map((m) => [m.id, mp()])), 30);
  const full = earned(ctx({ progress: allDone }));
  for (const id of ['hari-pertama', 'seperempat-jalan', 'dasar-kokoh', 'arsitek-data', 'integrator', 'peretas-etis', 'tuntas', 'boss-pertama', 'sekali-tebas', 'final-boss', 'penakluk-boss', 'tepat-sasaran', 'mandiri', 'streak-3', 'streak-7', 'streak-30']) {
    ok(full.has(id), `kurikulum tuntas tanpa bantuan harus meraih '${id}'`);
  }
  ok(!full.has('ujian-pertama') && !full.has('kutu-buku') && !full.has('ingatan-baja'), 'lencana ujian/materi/ulang tidak ikut teraih hanya dari misi');
  ok(evaluateAchievements(ctx({ progress: allDone })).every((a) => a.status.current <= a.status.target), 'kemajuan tidak pernah melebihi target');

  // --- Aturan khusus ---
  const boss = MISSIONS.find((m) => m.kind === 'sql' && m.boss);
  const tier1 = MISSIONS.filter((m) => m.tier === 1);
  if (boss) {
    ok(!earned(ctx({ progress: progressOf({ [boss.id]: mp({ attempts: 3 }) }) })).has('sekali-tebas'), 'boss dengan 3 percobaan bukan "Sekali Tebas"');
    ok(earned(ctx({ progress: progressOf({ [boss.id]: mp({ attempts: 3 }) }) })).has('boss-pertama'), 'boss yang selesai tetap "Boss Pertama"');
    ok(!earned(ctx({ progress: progressOf({ [boss.id]: mp({ solutionShown: true }) }) })).has('sekali-tebas'), 'boss dengan solusi dibuka bukan "Sekali Tebas"');
  }
  const tier1Hint = progressOf(Object.fromEntries(tier1.map((m, i) => [m.id, mp({ hintUsed: i === 0 })])));
  ok(!earned(ctx({ progress: tier1Hint })).has('mandiri'), 'satu hint di tier itu membatalkan "Mandiri"');
  ok(earned(ctx({ progress: progressOf(Object.fromEntries(tier1.map((m) => [m.id, mp({ attempts: 4 })]))) })).has('mandiri'), '"Mandiri" boleh dengan banyak percobaan asal tanpa hint/solusi');
  const nine = progressOf(Object.fromEntries(MISSIONS.slice(0, 9).map((m) => [m.id, mp()])));
  ok(!earned(ctx({ progress: nine })).has('tepat-sasaran') && evaluateAchievements(ctx({ progress: nine })).find((a) => a.id === 'tepat-sasaran')?.status.current === 9, '"Tepat Sasaran" 9/10 belum teraih dan kemajuannya 9');

  const events = MISSIONS.slice(0, 5).map((m) => ({ missionId: m.id, kind: 'values' as const, at: '2026-11-10T00:00:00.000Z' }));
  const solvedAfter = Object.fromEntries(MISSIONS.slice(0, 5).map((m) => [m.id, '2026-11-11T00:00:00.000Z']));
  const solvedBefore = Object.fromEntries(MISSIONS.slice(0, 5).map((m) => [m.id, '2026-11-09T00:00:00.000Z']));
  ok(earned(ctx({ mistakes: { events, solved: solvedAfter } })).has('bangkit'), '"Bangkit Lagi": 5 misi benar SETELAH kesalahan terakhir');
  ok(!earned(ctx({ mistakes: { events, solved: solvedBefore } })).has('bangkit'), 'benar SEBELUM kesalahan terakhir tidak dihitung bangkit');

  const perfect5 = exam('exam', ['correct', 'correct', 'correct', 'correct', 'correct'], 'a');
  const perfect3 = exam('exam', ['correct', 'correct', 'correct'], 'b');
  const almost = exam('exam', ['correct', 'correct', 'correct', 'correct', 'unanswered'], 'c');
  ok(earned(ctx({ exams: [perfect5] })).has('nilai-sempurna') && earned(ctx({ exams: [perfect5] })).has('ujian-pertama'), 'ujian 5/5 = "Nilai Sempurna"');
  ok(!earned(ctx({ exams: [perfect3] })).has('nilai-sempurna'), 'ujian sempurna di bawah 5 soal tidak dihitung');
  ok(!earned(ctx({ exams: [almost] })).has('nilai-sempurna'), 'soal tidak dijawab membatalkan nilai sempurna');
  const reviews = Array.from({ length: 4 }, (_, i) => exam('review', ['correct', 'correct', 'correct', 'correct', 'correct'], `r${i}`));
  ok(earned(ctx({ exams: reviews })).has('rajin-mengulang') && !earned(ctx({ exams: reviews })).has('ujian-pertama'), 'latihan ulang dihitung terpisah dari ujian');
  ok(!earned(ctx({ exams: [exam('review', ['correct', 'correct', 'correct', 'correct', 'correct'], 'x')] })).has('nilai-sempurna'), 'latihan ulang sempurna bukan "Nilai Sempurna" ujian');

  ok(earned(ctx({ reviewDeck: { a: { box: MAX_BOX, due: '2027-01-01', reviews: 6, lapses: 0 } } })).has('ingatan-baja'), 'kotak tertinggi = "Ingatan Baja"');
  ok(!earned(ctx({ reviewDeck: { a: { box: MAX_BOX - 1, due: '2027-01-01', reviews: 5, lapses: 0 } } })).has('ingatan-baja'), 'kotak di bawah tertinggi belum "Ingatan Baja"');
  ok(earned(ctx({ articlesRead: new Set(ARTICLES.map((a) => a.id)) })).has('kutu-buku') && !earned(ctx({ articlesRead: new Set(ARTICLES.slice(0, 10).map((a) => a.id)) })).has('kutu-buku'), '"Kutu Buku" butuh semua artikel');
  ok(earned(ctx({ progress: progressOf({}, 7) })).has('streak-7') && !earned(ctx({ progress: progressOf({}, 6) })).has('streak-7'), 'streak memakai rekor terbaik');

  // --- Daftar "sudah diumumkan" ---
  ok(parseSeen(['a', 1, 'b'])?.size === 2 && parseSeen(null) === null && parseSeen('x') === null, 'parseSeen: array → set, selain itu null');
  const storage = new MemoryStorage();
  storage.setItem(ACHIEVEMENTS_SEEN_KEY, JSON.stringify(['hari-pertama']));
  applyBackup(storage, createBackup(new MemoryStorage(), new Date()));
  ok(parseSeen(JSON.parse(storage.getItem(ACHIEVEMENTS_SEEN_KEY) ?? '[]')) === null, 'impor cadangan mengosongkan daftar lencana yang diumumkan (dicatat ulang diam-diam)');

  console.log(`  ${ACHIEVEMENTS.length} lencana, ${checks} pemeriksaan ✓`);
}
