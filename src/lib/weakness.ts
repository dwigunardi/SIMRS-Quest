/**
 * Peta kelemahan — bagian 2: merangkum riwayat kesalahan menjadi laporan + rekomendasi.
 *
 * Skor setiap kesalahan = bobot kebaruan × bobot status:
 * - kebaruan: ≤ 7 hari = 1, ≤ 30 hari = 0,5, lebih lama = 0,25
 * - status: misi sudah diselesaikan SETELAH kesalahan itu = 0,5 ("sudah teratasi"), selain itu 1
 * Jadi kelemahan yang baru dan belum teratasi naik ke atas; yang lama dan sudah dikuasai perlahan turun.
 */
import type { Article, Mission, UserProgress } from '../types';
import { isMistakeKind, MISTAKE_INFO, type MistakeEvent, type MistakeKind } from './mistakes';

const DAY = 24 * 60 * 60 * 1000;

export interface MissionMistakes {
  missionId: string;
  count: number;
  /** Misi sudah diselesaikan setelah kesalahan terakhirnya. */
  resolved: boolean;
}

export interface CategoryReport {
  kind: MistakeKind;
  count: number;
  /** Kesalahan 7 hari terakhir. */
  recent: number;
  score: number;
  missions: MissionMistakes[];
  /** Materi yang disarankan (umum untuk jenis ini + materi misi yang terlibat bila jenisnya spesifik misi). */
  articles: string[];
}

export interface TopicReport {
  articleId: string;
  count: number;
  score: number;
}

export type Recommendation =
  | { type: 'read'; articleId: string; kind: MistakeKind; count: number }
  | { type: 'retry'; missionId: string; kind: MistakeKind; count: number; resolved: boolean };

export interface WeaknessReport {
  totalMistakes: number;
  recentMistakes: number;
  categories: CategoryReport[];
  topics: TopicReport[];
  recommendations: Recommendation[];
  stats: {
    completed: number;
    attempts: number;
    /** Misi selesai yang benar di percobaan pertama. */
    firstTry: number;
  };
}

function recencyWeight(at: number, now: number): number {
  const age = now - at;
  if (age <= 7 * DAY) return 1;
  if (age <= 30 * DAY) return 0.5;
  return 0.25;
}

/**
 * Waktu terakhir misi dijawab BENAR: yang paling baru dari penyelesaian pertama (progres) dan jawaban benar terakhir
 * (riwayat `solved`, termasuk latihan ulang). Kesalahan sebelum waktu ini dianggap sudah teratasi.
 */
function lastSolved(progress: UserProgress, solved: Readonly<Record<string, string>>, missionId: string): number | null {
  const times = [progress.missions[missionId]?.completedAt, solved[missionId]]
    .map((iso) => (iso ? Date.parse(iso) : Number.NaN))
    .filter((t) => !Number.isNaN(t));
  return times.length > 0 ? Math.max(...times) : null;
}

/** Artikel utama misi: artikel yang memperkenalkan konsepnya di misi itu, atau artikel pertama yang menautkannya. */
function primaryArticle(articles: readonly Article[], missionId: string): string | null {
  return (articles.find((a) => a.missions[0] === missionId) ?? articles.find((a) => a.missions.includes(missionId)))?.id ?? null;
}

export function buildWeaknessReport(
  events: readonly MistakeEvent[],
  /** missionId → ISO waktu jawaban benar terakhir (useMistakes().solved). */
  solved: Readonly<Record<string, string>>,
  progress: UserProgress,
  missions: readonly Mission[],
  articles: readonly Article[],
  now: number,
): WeaknessReport {
  const known = new Set(missions.map((m) => m.id));
  const valid = events.filter((e) => known.has(e.missionId) && isMistakeKind(e.kind) && !Number.isNaN(Date.parse(e.at)));

  const byKind = new Map<MistakeKind, { count: number; recent: number; score: number; missions: Map<string, { count: number; last: number }> }>();
  const byTopic = new Map<string, { count: number; score: number }>();
  for (const event of valid) {
    const at = Date.parse(event.at);
    const done = lastSolved(progress, solved, event.missionId);
    const score = recencyWeight(at, now) * (done !== null && done > at ? 0.5 : 1);
    const entry = byKind.get(event.kind) ?? { count: 0, recent: 0, score: 0, missions: new Map() };
    entry.count += 1;
    entry.score += score;
    if (now - at <= 7 * DAY) entry.recent += 1;
    const m = entry.missions.get(event.missionId) ?? { count: 0, last: 0 };
    m.count += 1;
    m.last = Math.max(m.last, at);
    entry.missions.set(event.missionId, m);
    byKind.set(event.kind, entry);

    const topic = primaryArticle(articles, event.missionId);
    if (topic) {
      const t = byTopic.get(topic) ?? { count: 0, score: 0 };
      t.count += 1;
      t.score += score;
      byTopic.set(topic, t);
    }
  }

  const knownArticles = new Set(articles.map((a) => a.id));
  const categories: CategoryReport[] = [...byKind.entries()]
    .map(([kind, entry]) => {
      const missionList = [...entry.missions.entries()]
        .map(([missionId, m]) => {
          const done = lastSolved(progress, solved, missionId);
          return { missionId, count: m.count, resolved: done !== null && done > m.last };
        })
        .sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.count - a.count);
      // Jenis yang spesifik misi (konstruksi wajib, kuis) → materi misi-misi itu.
      const general = MISTAKE_INFO[kind].articles;
      const fromMissions = missionList.flatMap((m) => {
        const id = primaryArticle(articles, m.missionId);
        return id ? [id] : [];
      });
      const suggested = [...new Set(general.length > 0 ? general : fromMissions)].filter((id) => knownArticles.has(id));
      return { kind, count: entry.count, recent: entry.recent, score: entry.score, missions: missionList, articles: suggested };
    })
    .sort((a, b) => b.score - a.score || b.count - a.count);

  const topics: TopicReport[] = [...byTopic.entries()]
    .map(([articleId, t]) => ({ articleId, count: t.count, score: t.score }))
    .sort((a, b) => b.score - a.score || b.count - a.count);

  // Rekomendasi: untuk 3 jenis teratas, satu materi (belum pernah disarankan) + satu misi untuk dilatih ulang.
  const recommendations: Recommendation[] = [];
  const usedArticles = new Set<string>();
  for (const category of categories.slice(0, 3)) {
    const articleId = category.articles.find((id) => !usedArticles.has(id));
    if (articleId) {
      usedArticles.add(articleId);
      recommendations.push({ type: 'read', articleId, kind: category.kind, count: category.count });
    }
    const target = category.missions[0];
    if (target) recommendations.push({ type: 'retry', missionId: target.missionId, kind: category.kind, count: target.count, resolved: target.resolved });
  }

  const entries = Object.entries(progress.missions).filter(([id]) => known.has(id));
  const completed = entries.filter(([, mp]) => mp.completed);
  return {
    totalMistakes: valid.length,
    recentMistakes: valid.filter((e) => now - Date.parse(e.at) <= 7 * DAY).length,
    categories,
    topics,
    recommendations,
    stats: {
      completed: completed.length,
      attempts: entries.reduce((sum, [, mp]) => sum + mp.attempts, 0),
      firstTry: completed.filter(([, mp]) => mp.attempts === 1).length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Penanda di kartu jawaban salah                                      */
/* ------------------------------------------------------------------ */

/** Penanda muncul bila jenis kesalahan yang sama terjadi minimal sekian kali dalam NUDGE_DAYS hari. */
export const NUDGE_THRESHOLD = 3;
export const NUDGE_DAYS = 7;

export interface MistakeNudgeInfo {
  kind: MistakeKind;
  /** Jumlah kesalahan jenis ini dalam NUDGE_DAYS hari terakhir (termasuk percobaan barusan). */
  count: number;
  /** Materi yang paling relevan untuk misi ini, atau null. */
  articleId: string | null;
}

/**
 * Info penanda "Kesalahan jenis X sudah N× minggu ini" untuk percobaan salah di `missionId`, atau null bila belum
 * berulang. Materi dipilih dari materi umum jenis kesalahan itu yang JUGA terkait misi ini (paling relevan), lalu materi
 * umum pertama, lalu materi utama misi (untuk jenis yang spesifik misi seperti konstruksi wajib/kuis).
 */
export function mistakeNudge(
  events: readonly MistakeEvent[],
  kind: MistakeKind,
  missionId: string,
  articles: readonly Article[],
  now: number,
): MistakeNudgeInfo | null {
  const count = events.filter((e) => e.kind === kind && now - Date.parse(e.at) <= NUDGE_DAYS * DAY).length;
  if (count < NUDGE_THRESHOLD) return null;
  const known = new Set(articles.map((a) => a.id));
  const general = MISTAKE_INFO[kind].articles.filter((id) => known.has(id));
  const forMission = new Set(articles.filter((a) => a.missions.includes(missionId)).map((a) => a.id));
  const articleId = general.find((id) => forMission.has(id)) ?? general[0] ?? primaryArticle(articles, missionId);
  return { kind, count, articleId };
}
