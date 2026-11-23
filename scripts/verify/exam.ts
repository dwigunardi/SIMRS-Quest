/**
 * Verifikasi Mode Ujian (src/lib/exam.ts): soal yang boleh keluar, sebaran antar tier, sesi & tenggat, rapor,
 * validasi data tersimpan, dan riwayat ujian di file cadangan.
 */
import { MISSIONS, TIERS } from '../../src/data/missions';
import { applyBackup, createBackup, parseBackup, type BackupStorage } from '../../src/lib/backup';
import {
  EXAM_HISTORY_KEY,
  MAX_HISTORY,
  buildExam,
  eligibleMissions,
  formatClock,
  isAnswered,
  isExamMission,
  parseHistory,
  parseSession,
  pickExamMissions,
  remainingMs,
  summarizeExam,
  type ExamRecord,
} from '../../src/lib/exam';
import { createEmptyProgress } from '../../src/lib/progress';
import type { Tier, UserProgress } from '../../src/types';
import { assert } from './report';

/** PRNG deterministik (mulberry32) agar pemeriksaan acak bisa diulang. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function allDone(): UserProgress {
  const done = { completed: true, earnedXp: 0, hintUsed: false, hintsRevealed: 0, solutionShown: false, attempts: 1, completedAt: '2026-11-20T00:00:00.000Z' };
  return { ...createEmptyProgress(), missions: Object.fromEntries(MISSIONS.map((m) => [m.id, done])) };
}

const ALL_TIERS: Tier[] = TIERS.map((t) => t.tier);
const NOW = new Date('2026-11-23T09:00:00+07:00');

class MemoryStorage implements BackupStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

export function verifyExam(): void {
  let checks = 0;
  const ok = (cond: boolean, msg: string) => {
    checks += 1;
    assert(cond, `ujian: ${msg}`);
  };

  // --- Soal yang boleh keluar ---
  const fresh = eligibleMissions(MISSIONS, createEmptyProgress(), ALL_TIERS);
  ok(fresh.length === 1 && fresh[0]?.id === 't1-select', `progres kosong: hanya misi pertama yang terbuka (dapat ${fresh.map((m) => m.id).join(', ')})`);
  const everything = eligibleMissions(MISSIONS, allDone(), ALL_TIERS);
  const expectedPool = MISSIONS.filter(isExamMission).length;
  ok(everything.length === expectedPool, `semua selesai: ${everything.length} soal, seharusnya ${expectedPool}`);
  ok(everything.every((m) => (m.kind === 'sql' && !m.boss) || m.kind === 'predict'), 'kartu konsep, lab injection, dan boss tidak boleh ikut');
  ok(!everything.some((m) => m.tier === 8), 'tier 8 (kartu konsep + boss) tidak punya soal ujian');

  // --- Sebaran & jumlah ---
  const tiersWithPool = [...new Set(everything.map((m) => m.tier))];
  for (let seed = 1; seed <= 25; seed += 1) {
    const picked = pickExamMissions(everything, 10, seeded(seed));
    const tiers = new Set(picked.map((m) => m.tier));
    ok(picked.length === 10 && new Set(picked.map((m) => m.id)).size === 10, `seed ${seed}: 10 soal unik`);
    ok(tiersWithPool.every((t) => tiers.has(t)), `seed ${seed}: setiap tier yang punya soal terwakili (${[...tiers].sort().join(',')})`);
  }
  const orders = new Set(Array.from({ length: 10 }, (_, i) => pickExamMissions(everything, 5, seeded(100 + i)).map((m) => m.id).join()));
  ok(orders.size > 1, 'pemilihan soal benar-benar acak antar sesi');

  // --- Sesi ---
  const built = buildExam(MISSIONS, allDone(), { tiers: [1, 9], count: 15, minutes: 30 }, seeded(7), NOW);
  ok(built.ok, 'buildExam tier 1 & 9 harus berhasil');
  if (!built.ok) return;
  const { session } = built;
  const pool19 = eligibleMissions(MISSIONS, allDone(), [1, 9]).length;
  ok(session.missionIds.length === Math.min(15, pool19) && built.shortBy === Math.max(0, 15 - pool19), `jumlah soal ${session.missionIds.length}, kekurangan ${built.shortBy}`);
  ok(session.config.count === session.missionIds.length, 'config.count disesuaikan dengan soal yang benar-benar ada');
  ok(Date.parse(session.deadline ?? '') - NOW.getTime() === 30 * 60_000, 'tenggat = mulai + 30 menit');
  const missions = session.missionIds.map((id) => MISSIONS.find((m) => m.id === id));
  ok(missions.every((m) => m !== undefined && isExamMission(m) && !isAnswered(m, session.answers[m.id])), 'jawaban awal (isi editor / tanpa pilihan) dihitung belum dijawab');
  const sqlMission = missions.find((m) => m?.kind === 'sql');
  if (sqlMission && isExamMission(sqlMission)) ok(isAnswered(sqlMission, { kind: 'sql', sql: 'SELECT 1' }), 'SQL yang diubah dihitung sudah dijawab');
  ok(remainingMs(session, NOW.getTime() + 60_000) === 29 * 60_000 && remainingMs(session, NOW.getTime() + 99 * 60_000) === 0, 'sisa waktu berkurang dan tidak negatif');
  ok(formatClock(29 * 60_000 + 5_000) === '29:05' && formatClock(3_725_000) === '1:02:05', 'format jam');
  const none = buildExam(MISSIONS, createEmptyProgress(), { tiers: [9], count: 10, minutes: null }, seeded(1), NOW);
  ok(!none.ok, 'tier tanpa misi terbuka harus ditolak dengan pesan');
  const noLimit = buildExam(MISSIONS, allDone(), { tiers: [2], count: 5, minutes: null }, seeded(2), NOW);
  ok(noLimit.ok && noLimit.session.deadline === null && remainingMs(noLimit.session, Date.now()) === null, 'tanpa batas waktu: deadline null');

  // --- Data tersimpan ---
  const roundTrip = parseSession(JSON.parse(JSON.stringify(session)), MISSIONS);
  ok(JSON.stringify(roundTrip) === JSON.stringify(session), 'sesi tersimpan bisa dibaca ulang utuh');
  ok(parseSession({ ...session, missionIds: ['misi-hilang'] }, MISSIONS) === null, 'sesi dengan misi yang tidak dikenal dibuang');
  ok(parseSession({ ...session, missionIds: ['t1-select', 't7-prepared-statement'] }, MISSIONS) === null, 'sesi berisi kartu konsep dibuang');
  ok(parseSession('rusak', MISSIONS) === null && parseSession({ ...session, deadline: 'kapan' }, MISSIONS) === null, 'sesi rusak dibuang');

  // --- Rapor ---
  const [a = 't1-select', b = 't1-where', c = 't1-like'] = session.missionIds;
  const record: ExamRecord = {
    id: session.id,
    purpose: 'exam',
    startedAt: session.startedAt,
    finishedAt: new Date(NOW.getTime() + 12 * 60_000).toISOString(),
    timedOut: false,
    config: session.config,
    items: [
      { missionId: a, status: 'correct', kind: null, message: 'Benar.', answer: 'SELECT 1' },
      { missionId: b, status: 'wrong', kind: 'rows-missing', message: 'x', answer: 'SELECT 2' },
      { missionId: c, status: 'unanswered', kind: null, message: 'Tidak dijawab.', answer: '' },
    ],
  };
  const summary = summarizeExam(record, MISSIONS);
  ok(summary.total === 3 && summary.correct === 1 && summary.unanswered === 1 && summary.score === 33, `ringkasan nilai ${JSON.stringify(summary)}`);
  ok(summary.durationMs === 12 * 60_000 && summary.byKind.length === 1 && summary.byKind[0]?.kind === 'rows-missing', 'durasi & jenis kesalahan');
  ok(summary.byTier.reduce((n, t) => n + t.total, 0) === 3, 'per tier menjumlah ke total soal');

  const history = parseHistory([record, { rusak: true }, { ...record, id: 'x2', items: [{ missionId: a, status: 'aneh' }] }]);
  ok(history.length === 1 && history[0]?.id === record.id, 'riwayat: entri rusak dilewati');
  const many = parseHistory(Array.from({ length: 30 }, (_, i) => ({ ...record, id: `r${i}` })));
  ok(many.length === MAX_HISTORY && many[many.length - 1]?.id === 'r29', `riwayat dibatasi ${MAX_HISTORY} terbaru`);

  // --- Riwayat ujian ikut cadangan ---
  const src = new MemoryStorage();
  src.setItem(EXAM_HISTORY_KEY, JSON.stringify([record]));
  const parsed = parseBackup(JSON.stringify(createBackup(src, NOW)));
  ok(parsed.ok && parsed.summary.exams === 1, 'cadangan memuat riwayat ujian');
  const dst = new MemoryStorage();
  if (parsed.ok) applyBackup(dst, parsed.backup);
  ok(dst.getItem(EXAM_HISTORY_KEY) === src.getItem(EXAM_HISTORY_KEY), 'impor cadangan memulihkan riwayat ujian');
  const old = parseBackup(JSON.stringify({ app: 'simrs-sql-quest', format: 1, progress: createEmptyProgress() }));
  ok(old.ok && old.summary.exams === 0, 'file cadangan lama (tanpa riwayat ujian) tetap bisa diimpor');

  console.log(`  ${checks} pemeriksaan mode ujian ✓`);
}
