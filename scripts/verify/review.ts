/**
 * Verifikasi latihan ulang terjadwal (src/lib/review.ts): aritmetika tanggal lokal, kartu bawaan dari tanggal selesai,
 * prioritas sesi, aturan kotak Leitner, pembaruan dari hasil sesi, validasi data, sesi review, streak, dan cadangan.
 */
import { MISSIONS } from '../../src/data/missions';
import { applyBackup, createBackup, parseBackup, type BackupStorage } from '../../src/lib/backup';
import { buildReviewSession, isExamMission } from '../../src/lib/exam';
import type { MistakeEvent } from '../../src/lib/mistakes';
import { createEmptyProgress, recordActivity } from '../../src/lib/progress';
import {
  MAX_BOX,
  REVIEW_INTERVALS,
  REVIEW_KEY,
  addDays,
  applyReview,
  cardFor,
  daysBetween,
  describeDue,
  dueItems,
  forecast,
  parseDeck,
  updateDeck,
  type ReviewCard,
} from '../../src/lib/review';
import type { MissionProgress, UserProgress } from '../../src/types';
import { assert } from './report';

class MemoryStorage implements BackupStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

function done(completedAt: string): MissionProgress {
  return { completed: true, earnedXp: 0, hintUsed: false, hintsRevealed: 0, solutionShown: false, attempts: 1, completedAt };
}

/** Misi selesai pada tanggal lokal tertentu (jam 10 pagi waktu lokal). */
function progressDone(entries: Record<string, string>): UserProgress {
  const missions: Record<string, MissionProgress> = {};
  for (const [id, day] of Object.entries(entries)) {
    const [y, m, d] = day.split('-').map(Number);
    missions[id] = done(new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1, 10).toISOString());
  }
  return { ...createEmptyProgress(), missions };
}

export function verifyReview(): void {
  let checks = 0;
  const ok = (cond: boolean, msg: string) => {
    checks += 1;
    assert(cond, `latihan ulang: ${msg}`);
  };

  // --- Tanggal ---
  ok(addDays('2026-10-31', 1) === '2026-11-01' && addDays('2026-12-31', 1) === '2027-01-01' && addDays('2028-02-28', 1) === '2028-02-29', 'addDays melewati akhir bulan/tahun/kabisat');
  ok(addDays('2026-03-08', 1) === '2026-03-09' && addDays('2026-11-01', -1) === '2026-10-31', 'addDays aman di sekitar pergantian DST & mundur');
  ok(daysBetween('2026-11-20', '2026-11-23') === 3 && daysBetween('2026-12-30', '2027-01-02') === 3, 'daysBetween');
  ok(describeDue('2026-11-23', '2026-11-23') === 'hari ini' && describeDue('2026-11-24', '2026-11-23') === 'besok' && describeDue('2026-11-26', '2026-11-23').startsWith('3 hari lagi'), 'describeDue');

  // --- Kartu bawaan ---
  const today = '2026-11-23';
  const progress = progressDone({ 't1-select': '2026-11-10', 't1-where': '2026-11-22', 't1-like': '2026-11-23', 't1-predict-distinct': '2026-11-15', 'boss-t1-skrining': '2026-11-01', 't7-prepared-statement': '2026-11-01' });
  const mission = (id: string) => {
    const m = MISSIONS.find((x) => x.id === id);
    if (!m) throw new Error(`misi ${id} tidak ada`);
    return m;
  };
  ok(cardFor({}, mission('t1-where'), progress)?.due === '2026-11-23', 'misi selesai kemarin jatuh tempo hari ini (kotak 0 = 1 hari)');
  ok(cardFor({}, mission('t1-like'), progress)?.due === '2026-11-24', 'misi selesai hari ini baru jatuh tempo besok');
  ok(cardFor({}, mission('t1-order-limit'), progress) === null, 'misi belum selesai tidak punya jadwal');
  ok(cardFor({}, mission('boss-t1-skrining'), progress) === null && cardFor({}, mission('t7-prepared-statement'), progress) === null, 'boss & kartu konsep tidak diulang');

  // --- Prioritas ---
  const events: MistakeEvent[] = [
    { missionId: 't1-where', kind: 'rows-missing', at: new Date(2026, 10, 21, 9).toISOString() },
    { missionId: 't1-where', kind: 'rows-missing', at: new Date(2026, 10, 22, 9).toISOString() },
    { missionId: 't1-select', kind: 'columns', at: new Date(2026, 8, 1, 9).toISOString() },
  ];
  const due = dueItems(MISSIONS, progress, {}, events, today);
  ok(due.map((d) => d.mission.id).join() === 't1-select,t1-predict-distinct,t1-where', `urutan prioritas: ${due.map((d) => `${d.mission.id}(${d.priority})`).join(', ')}`);
  ok(due.find((d) => d.mission.id === 't1-where')?.recentMistakes === 2 && due.find((d) => d.mission.id === 't1-select')?.recentMistakes === 0, 'kesalahan lebih dari 30 hari lalu tidak dihitung');
  ok(due.every((d) => isExamMission(d.mission)), 'hanya jenis misi yang bisa diujikan');
  const fc = forecast(MISSIONS, progress, {}, today);
  ok(fc.dueToday === 3 && fc.dueTomorrow === 1 && fc.nextDate === '2026-11-24' && fc.total === 4, `forecast ${JSON.stringify(fc)}`);

  // --- Aturan kotak ---
  let card: ReviewCard = { box: 0, due: today, reviews: 0, lapses: 0 };
  const dues: string[] = [];
  for (let i = 0; i < MAX_BOX + 2; i += 1) {
    card = applyReview(card, true, today);
    dues.push(`${card.box}:${daysBetween(today, card.due)}`);
  }
  ok(dues.join(' ') === `1:3 2:7 3:14 4:30 5:60 5:60 5:60`, `benar berturut-turut menaikkan kotak dan berhenti di ${MAX_BOX}: ${dues.join(' ')}`);
  const lapsed = applyReview(card, false, today);
  ok(lapsed.box === 0 && lapsed.due === '2026-11-24' && lapsed.lapses === 1 && lapsed.reviews === card.reviews + 1, 'salah → kotak 0, besok, lapses +1');
  ok(REVIEW_INTERVALS[0] === 1, 'kotak 0 = 1 hari');

  // --- Pembaruan dari hasil sesi ---
  const deck = updateDeck(
    {},
    MISSIONS,
    progress,
    [
      { missionId: 't1-select', status: 'correct' },
      { missionId: 't1-where', status: 'wrong' },
      { missionId: 't1-predict-distinct', status: 'unanswered' },
      { missionId: 't1-order-limit', status: 'correct' },
    ],
    today,
  );
  ok(deck['t1-select']?.box === 1 && deck['t1-select']?.due === '2026-11-26', 'benar → kotak 1, 3 hari lagi');
  ok(deck['t1-where']?.box === 0 && deck['t1-where']?.due === '2026-11-24', 'salah → besok');
  ok(!('t1-predict-distinct' in deck) && !('t1-order-limit' in deck), 'tidak dijawab / misi belum selesai: jadwal tidak berubah');
  const after = dueItems(MISSIONS, progress, deck, events, today);
  ok(after.map((d) => d.mission.id).join() === 't1-predict-distinct', 'setelah sesi, hanya yang belum diulang yang masih jatuh tempo');

  // --- Data tersimpan ---
  ok(JSON.stringify(parseDeck(JSON.parse(JSON.stringify(deck)))) === JSON.stringify(deck), 'deck bisa dibaca ulang utuh');
  const dirty = parseDeck({ a: { box: 9, due: today, reviews: 0, lapses: 0 }, b: { box: 1, due: 'besok', reviews: 0, lapses: 0 }, c: 'x', d: { box: 2, due: today, reviews: 3, lapses: 1 } });
  ok(Object.keys(dirty).join() === 'd', 'kartu rusak dilewati');
  ok(Object.keys(parseDeck(null)).length === 0 && Object.keys(parseDeck([1, 2])).length === 0, 'deck rusak → kosong');

  // --- Sesi review ---
  const session = buildReviewSession(due.map((d) => d.mission), () => 0.5, new Date(2026, 10, 23, 9));
  ok(session !== null && session.purpose === 'review' && session.deadline === null, 'sesi latihan ulang tanpa batas waktu');
  ok(session?.missionIds.join() === due.map((d) => d.mission.id).join(), 'urutan prioritas dipertahankan di sesi');
  ok(buildReviewSession([], () => 0.5, new Date()) === null, 'tanpa misi jatuh tempo tidak ada sesi');

  // --- Streak dari aktivitas ---
  const base = { ...createEmptyProgress(), streak: { current: 2, best: 2, lastActiveDate: '2026-11-22' } };
  const active = recordActivity(base, new Date(2026, 10, 23, 9));
  ok(active.streak.current === 3 && active.streak.lastActiveDate === '2026-11-23' && active.xp === base.xp, 'sesi hari ini menambah streak tanpa XP');
  ok(recordActivity(active, new Date(2026, 10, 23, 20)) === active, 'sesi kedua di hari yang sama tidak mengubah apa pun');

  // --- Cadangan ---
  const src = new MemoryStorage();
  src.setItem(REVIEW_KEY, JSON.stringify(deck));
  const parsed = parseBackup(JSON.stringify(createBackup(src, new Date())));
  const dst = new MemoryStorage();
  if (parsed.ok) applyBackup(dst, parsed.backup);
  ok(parsed.ok && dst.getItem(REVIEW_KEY) === src.getItem(REVIEW_KEY), 'jadwal latihan ulang ikut ekspor/impor cadangan');

  console.log(`  ${checks} pemeriksaan latihan ulang terjadwal ✓`);
}
