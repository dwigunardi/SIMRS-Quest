/**
 * Ringkasan jalur SQL untuk Beranda, dihitung langsung dari storage tanpa me-mount jalurnya (tanpa mesin SQL).
 *
 * `glance` fungsi murni dan HANYA MEMBACA: tidak menulis apa pun (termasuk karantina), tidak melempar, dan aman
 * dijalankan di Node (scripts/verify). Seluruh aturan dipinjam dari modul yang juga dipakai aplikasi (parser, resume,
 * jadwal ulang, peta kelemahan, rank, streak), jadi angka di Beranda selalu sama dengan angka di dalam jalur.
 *
 * `guard` adalah langkah TERPISAH yang dijalankan Beranda sekali sebelum glance pertama: ia mengkarantina nilai
 * tersimpan yang tidak terbaca dengan aturan yang sama seperti pemuat di dalam jalur (parser + "kosong setelah
 * dibersihkan"), supaya peringatannya tampil sejak Beranda dibuka — tanpa menunggu pengguna masuk ke jalur.
 */
import { ARTICLES } from '../../data/materi';
import { MISSIONS, TIERS } from '../../data/missions';
import { parseArticleReads } from '../../hooks/useArticleReads';
import { isEmptyLog, parseMistakeLog } from '../../hooks/useMistakes';
import { isAnswered, isExamMission, parseHistory, parseSession } from '../../lib/exam';
import { MISTAKE_INFO } from '../../lib/mistakes';
import { createEmptyProgress, getActiveStreak, getCompletedCount, parseProgress, toLocalDateKey } from '../../lib/progress';
import { getRank } from '../../lib/ranks';
import { findPendingMission, pickInitialMissionId } from '../../lib/resume';
import { dueItems, parseDeck } from '../../lib/review';
import { lastQuarantinedAt, readGuarded } from '../../lib/storageGuard';
import { ARTICLE_READS_KEY, EXAM_HISTORY_KEY, EXAM_SESSION_KEY, MISTAKES_KEY, PROGRESS_KEY, REVIEW_KEY, SQL_GUARDED_KEYS } from '../../lib/storageKeys';
import { buildWeaknessReport } from '../../lib/weakness';
import type { GlanceFn, GuardFn, TrackGlance } from '../../platform/tracks';
import type { Mission } from '../../types';

type Reader = Pick<Storage, 'getItem'>;

function readRaw(storage: Reader, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Nilai JSON di `key`; undefined bila tidak ada atau bukan JSON. */
function readJson(storage: Reader, key: string): unknown {
  const raw = readRaw(storage, key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function tierLabel(mission: Mission): string {
  const info = TIERS.find((t) => t.tier === mission.tier);
  return info ? `Tier ${info.tier}: ${info.name}` : `Tier ${mission.tier}`;
}

function resumeOf(mission: Mission | undefined): TrackGlance['resume'] {
  return mission ? { missionId: mission.id, order: mission.order, title: mission.title, tierLabel: tierLabel(mission) } : null;
}

/**
 * Karantina nilai yang tidak terbaca di SETIAP kunci yang dijaga (SQL_GUARDED_KEYS), dengan parser dan aturan "kosong"
 * yang sama seperti pemuatnya masing-masing: loadProgress, readStoredMistakes, readStoredDeck, readStoredArticleReads,
 * readStoredHistory. scripts/verify/platform.ts memeriksa bahwa daftar di sini mencakup semua kunci yang dijaga.
 * readGuarded tidak pernah melempar dan tidak menyentuh kunci aslinya.
 */
export const guard: GuardFn = (storage, now) => {
  readGuarded(storage, PROGRESS_KEY, (raw) => parseProgress(JSON.parse(raw)), undefined, now);
  readGuarded(storage, MISTAKES_KEY, parseMistakeLog, isEmptyLog, now);
  readGuarded(storage, ARTICLE_READS_KEY, parseArticleReads, (ids) => ids.size === 0, now);
  readGuarded(storage, EXAM_HISTORY_KEY, (raw) => parseHistory(JSON.parse(raw)), (records) => records.length === 0, now);
  readGuarded(storage, REVIEW_KEY, (raw) => parseDeck(JSON.parse(raw)), (deck) => Object.keys(deck).length === 0, now);
};

export const glance: GlanceFn = (storage, now) => {
  const progress = parseProgress(readJson(storage, PROGRESS_KEY)) ?? createEmptyProgress();
  const mistakes = parseMistakeLog(readRaw(storage, MISTAKES_KEY));
  const deck = parseDeck(readJson(storage, REVIEW_KEY));
  const session = parseSession(readJson(storage, EXAM_SESSION_KEY), MISSIONS);
  const today = toLocalDateKey(now);

  // "Lanjutkan" = misi yang akan dibuka App (aturan yang sama); null hanya bila tidak ada lagi misi yang tersisa.
  const allDone = findPendingMission(MISSIONS, progress) === undefined;
  const resumeId = allDone ? null : pickInitialMissionId(MISSIONS, progress);
  const byId = new Map(MISSIONS.map((m) => [m.id, m]));

  const rank = getRank(progress.xp);
  const report = buildWeaknessReport(mistakes.events, mistakes.solved, progress, MISSIONS, ARTICLES, now.getTime());
  const topCategory = report.recentMistakes > 0 ? report.categories[0] : undefined;

  let exam: TrackGlance['exam'] = null;
  if (session) {
    const answered = session.missionIds.filter((id) => {
      const mission = byId.get(id);
      return mission !== undefined && isExamMission(mission) && isAnswered(mission, session.answers[id]);
    }).length;
    exam = { purpose: session.purpose, deadline: session.deadline, answered, total: session.missionIds.length };
  }

  return {
    started: Object.keys(progress.missions).length > 0 || progress.xp > 0,
    completed: getCompletedCount(progress),
    total: MISSIONS.length,
    xp: progress.xp,
    rank: { title: rank.title, icon: rank.icon },
    resume: resumeOf(resumeId === null ? undefined : byId.get(resumeId)),
    streak: {
      active: getActiveStreak(progress.streak, now),
      best: progress.streak.best,
      activeToday: progress.streak.lastActiveDate === today,
    },
    reviewDue: dueItems(MISSIONS, progress, deck, mistakes.events, today).length,
    exam,
    weakness: topCategory ? { label: MISTAKE_INFO[topCategory.kind].label, count: topCategory.count } : null,
    quarantinedAt: lastQuarantinedAt(storage, SQL_GUARDED_KEYS),
  };
};
