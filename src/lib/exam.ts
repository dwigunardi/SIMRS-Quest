/**
 * Mode Ujian (fungsi murni): memilih soal, sesi ujian dengan tenggat, ringkasan rapor, dan validasi data tersimpan.
 *
 * Aturan:
 * - Soal diambil dari misi SQL (termasuk Perbaiki Bug & DDL) dan Tebak Hasil yang SUDAH TERBUKA di tier yang dipilih.
 *   Kartu konsep, lab injection, dan Boss Challenge tidak ikut (bentuknya bukan soal singkat).
 * - Soal disebar merata antar tier (round-robin dari kumpulan yang diacak), lalu urutannya diacak.
 * - Selama ujian tidak ada penilaian/hint; semua jawaban dinilai saat dikumpulkan atau waktu habis.
 * - Ujian tidak memberi XP; hasilnya masuk riwayat ujian dan Peta Kelemahan.
 */
import { classifyCheck, isMistakeKind, type MistakeKind } from './mistakes';
import { isMissionUnlocked } from './progress';
import type { CheckResult, Mission, Tier, UserProgress } from '../types';

export const EXAM_COUNTS = [5, 10, 15] as const;
/** Batas waktu (menit); null = tanpa batas. */
export const EXAM_MINUTES = [15, 30, 45, null] as const;
export const MAX_HISTORY = 20;
export const EXAM_SESSION_KEY = 'simrs-sql-quest:exam-session:v1';
export const EXAM_HISTORY_KEY = 'simrs-sql-quest:exams:v1';

export type ExamMission = Extract<Mission, { kind: 'sql' } | { kind: 'predict' }>;

export interface ExamConfig {
  tiers: Tier[];
  count: number;
  minutes: number | null;
}

/** Jawaban: teks SQL (misi sql) atau id pilihan tabel (misi tebak hasil, null = belum memilih). */
export type ExamAnswer = { kind: 'sql'; sql: string } | { kind: 'predict'; choiceId: string | null };

/** 'exam' = Mode Ujian; 'review' = latihan ulang terjadwal (tanpa batas waktu, soal dari jadwal ulang). */
export type SessionPurpose = 'exam' | 'review';

export interface ExamSession {
  id: string;
  purpose: SessionPurpose;
  config: ExamConfig;
  missionIds: string[];
  answers: Record<string, ExamAnswer>;
  /** ISO timestamp. */
  startedAt: string;
  /** ISO timestamp batas waktu, atau null bila tanpa batas. */
  deadline: string | null;
}

export type ExamItemStatus = 'correct' | 'wrong' | 'unanswered';

export interface ExamItemResult {
  missionId: string;
  status: ExamItemStatus;
  /** Jenis kesalahan untuk Peta Kelemahan (null bila benar / tidak dijawab). */
  kind: MistakeKind | null;
  /** Penjelasan singkat hasil penilaian (pesan mismatch / error). */
  message: string;
  /** Jawaban yang dikumpulkan (SQL, atau huruf pilihan tebak hasil) untuk ditinjau di rapor. */
  answer: string;
}

const MAX_ANSWER_CHARS = 4000;

/** Butir rapor dari hasil penilaian misi SQL. */
export function itemFromCheck(mission: ExamMission, check: CheckResult, answer: string): ExamItemResult {
  const trimmed = answer.slice(0, MAX_ANSWER_CHARS);
  if (check.kind === 'correct') return { missionId: mission.id, status: 'correct', kind: null, message: 'Benar.', answer: trimmed };
  const message = check.kind === 'error' ? check.friendlyError : check.compare.message;
  return { missionId: mission.id, status: 'wrong', kind: classifyCheck(mission, check) ?? 'values', message, answer: trimmed };
}

export function unansweredItem(mission: ExamMission): ExamItemResult {
  return { missionId: mission.id, status: 'unanswered', kind: null, message: 'Tidak dijawab.', answer: '' };
}

export interface ExamRecord {
  id: string;
  purpose: SessionPurpose;
  startedAt: string;
  finishedAt: string;
  /** true bila dikumpulkan otomatis karena waktu habis. */
  timedOut: boolean;
  config: ExamConfig;
  items: ExamItemResult[];
}

/* ------------------------------------------------------------------ */
/* Pemilihan soal                                                      */
/* ------------------------------------------------------------------ */

export function isExamMission(mission: Mission): mission is ExamMission {
  if (mission.kind === 'predict') return true;
  return mission.kind === 'sql' && mission.boss === undefined;
}

/** Misi yang boleh keluar di ujian untuk tier tertentu: jenis yang didukung dan sudah terbuka. */
export function eligibleMissions(missions: readonly Mission[], progress: UserProgress, tiers: readonly Tier[]): ExamMission[] {
  const wanted = new Set(tiers);
  const all = [...missions];
  return missions.filter((m): m is ExamMission => wanted.has(m.tier) && isExamMission(m) && isMissionUnlocked(all, progress, m.id));
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** Ambil `count` misi, sebisa mungkin merata antar tier, lalu acak urutannya. */
export function pickExamMissions(pool: readonly ExamMission[], count: number, random: () => number): ExamMission[] {
  const byTier = new Map<number, ExamMission[]>();
  for (const m of shuffle(pool, random)) byTier.set(m.tier, [...(byTier.get(m.tier) ?? []), m]);
  const queues = shuffle([...byTier.values()], random);
  const picked: ExamMission[] = [];
  while (picked.length < count && queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next && picked.length < count) picked.push(next);
    }
  }
  return shuffle(picked, random);
}

export type BuildExamResult = { ok: true; session: ExamSession; shortBy: number } | { ok: false; message: string };

/** Susun sesi ujian baru. `shortBy` > 0 bila soal yang tersedia lebih sedikit dari yang diminta. */
export function buildExam(missions: readonly Mission[], progress: UserProgress, config: ExamConfig, random: () => number, now: Date): BuildExamResult {
  if (config.tiers.length === 0) return { ok: false, message: 'Pilih minimal satu tier.' };
  const pool = eligibleMissions(missions, progress, config.tiers);
  if (pool.length === 0) return { ok: false, message: 'Belum ada misi yang terbuka di tier yang dipilih. Selesaikan misi di mode Misi dulu, atau pilih tier lain.' };
  const picked = pickExamMissions(pool, config.count, random);
  return {
    ok: true,
    shortBy: Math.max(0, config.count - picked.length),
    session: sessionFor('exam', picked, config.tiers, config.minutes, random, now),
  };
}

function sessionFor(purpose: SessionPurpose, picked: readonly ExamMission[], tiers: readonly Tier[], minutes: number | null, random: () => number, now: Date): ExamSession {
  const answers: Record<string, ExamAnswer> = {};
  for (const m of picked) answers[m.id] = m.kind === 'sql' ? { kind: 'sql', sql: m.starterSql } : { kind: 'predict', choiceId: null };
  const prefix = purpose === 'exam' ? 'ujian' : 'ulang';
  return {
    id: `${prefix}-${now.getTime().toString(36)}-${Math.floor(random() * 1e6).toString(36)}`,
    purpose,
    config: { tiers: [...tiers], count: picked.length, minutes },
    missionIds: picked.map((m) => m.id),
    answers,
    startedAt: now.toISOString(),
    deadline: minutes === null ? null : new Date(now.getTime() + minutes * 60_000).toISOString(),
  };
}

/** Sesi latihan ulang dari misi yang sudah dipilih jadwal (urutan prioritas dipertahankan), tanpa batas waktu. */
export function buildReviewSession(picked: readonly ExamMission[], random: () => number, now: Date): ExamSession | null {
  if (picked.length === 0) return null;
  const tiers = [...new Set(picked.map((m) => m.tier))].sort((a, b) => a - b);
  return sessionFor('review', picked, tiers, null, random, now);
}

/** Sisa waktu (ms), atau null bila tanpa batas. Tidak pernah negatif. */
export function remainingMs(session: ExamSession, now: number): number | null {
  if (!session.deadline) return null;
  return Math.max(0, Date.parse(session.deadline) - now);
}

/** "mm:ss" (atau "h:mm:ss" bila ≥ 1 jam). */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Jawaban dianggap belum diisi bila sama dengan isi awal editor / tanpa pilihan. */
export function isAnswered(mission: ExamMission, answer: ExamAnswer | undefined): boolean {
  if (!answer) return false;
  if (answer.kind === 'predict') return answer.choiceId !== null;
  const strip = (sql: string) => sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  return mission.kind === 'sql' && strip(answer.sql) !== '' && strip(answer.sql) !== strip(mission.starterSql);
}

/* ------------------------------------------------------------------ */
/* Rapor                                                               */
/* ------------------------------------------------------------------ */

export interface ExamSummary {
  total: number;
  correct: number;
  unanswered: number;
  /** 0–100, dibulatkan. */
  score: number;
  durationMs: number;
  byTier: Array<{ tier: Tier; total: number; correct: number }>;
  /** Jenis kesalahan terbanyak lebih dulu. */
  byKind: Array<{ kind: MistakeKind; count: number }>;
}

export function summarizeExam(record: ExamRecord, missions: readonly Mission[]): ExamSummary {
  const tierOf = new Map(missions.map((m) => [m.id, m.tier]));
  const tiers = new Map<Tier, { total: number; correct: number }>();
  const kinds = new Map<MistakeKind, number>();
  for (const item of record.items) {
    const tier = tierOf.get(item.missionId);
    if (tier !== undefined) {
      const t = tiers.get(tier) ?? { total: 0, correct: 0 };
      t.total += 1;
      if (item.status === 'correct') t.correct += 1;
      tiers.set(tier, t);
    }
    if (item.kind) kinds.set(item.kind, (kinds.get(item.kind) ?? 0) + 1);
  }
  const total = record.items.length;
  const correct = record.items.filter((i) => i.status === 'correct').length;
  return {
    total,
    correct,
    unanswered: record.items.filter((i) => i.status === 'unanswered').length,
    score: total > 0 ? Math.round((correct / total) * 100) : 0,
    durationMs: Math.max(0, Date.parse(record.finishedAt) - Date.parse(record.startedAt)),
    byTier: [...tiers.entries()].sort((a, b) => a[0] - b[0]).map(([tier, v]) => ({ tier, ...v })),
    byKind: [...kinds.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([kind, count]) => ({ kind, count })),
  };
}

/* ------------------------------------------------------------------ */
/* Validasi data tersimpan (localStorage / file cadangan)              */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isIso = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const TIERS_ALL: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function parseConfig(value: unknown): ExamConfig | null {
  if (!isRecord(value)) return null;
  const { tiers, count, minutes } = value;
  if (!Array.isArray(tiers) || !tiers.every((t) => typeof t === 'number' && TIERS_ALL.includes(t))) return null;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return null;
  if (minutes !== null && (typeof minutes !== 'number' || minutes <= 0)) return null;
  return { tiers: tiers as Tier[], count, minutes };
}

/** Data lama (sebelum latihan ulang ada) selalu ujian. */
function parsePurpose(value: unknown): SessionPurpose {
  return value === 'review' ? 'review' : 'exam';
}

function parseAnswer(value: unknown): ExamAnswer | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'sql' && typeof value.sql === 'string') return { kind: 'sql', sql: value.sql };
  if (value.kind === 'predict' && (value.choiceId === null || typeof value.choiceId === 'string')) return { kind: 'predict', choiceId: value.choiceId };
  return null;
}

/** Sesi ujian tersimpan; null bila rusak atau berisi misi yang tidak dikenal (kurikulum berubah). */
export function parseSession(value: unknown, missions: readonly Mission[]): ExamSession | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !isIso(value.startedAt)) return null;
  if (value.deadline !== null && !isIso(value.deadline)) return null;
  const config = parseConfig(value.config);
  const ids = value.missionIds;
  if (!config || !Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string')) return null;
  const known = new Map(missions.map((m) => [m.id, m]));
  if (!ids.every((id) => { const m = known.get(id); return m !== undefined && isExamMission(m); })) return null;
  if (!isRecord(value.answers)) return null;
  const answers: Record<string, ExamAnswer> = {};
  for (const id of ids as string[]) {
    const answer = parseAnswer(value.answers[id]);
    if (!answer) return null;
    answers[id] = answer;
  }
  return { id: value.id, purpose: parsePurpose(value.purpose), config, missionIds: ids as string[], answers, startedAt: value.startedAt, deadline: value.deadline as string | null };
}

function parseItem(value: unknown): ExamItemResult | null {
  if (!isRecord(value) || typeof value.missionId !== 'string' || typeof value.message !== 'string') return null;
  if (value.status !== 'correct' && value.status !== 'wrong' && value.status !== 'unanswered') return null;
  const kind = typeof value.kind === 'string' && isMistakeKind(value.kind) ? value.kind : null;
  const answer = typeof value.answer === 'string' ? value.answer.slice(0, MAX_ANSWER_CHARS) : '';
  return { missionId: value.missionId, status: value.status, kind, message: value.message, answer };
}

/** Riwayat ujian tersimpan; entri yang rusak dilewati, maksimal MAX_HISTORY terbaru. */
export function parseHistory(value: unknown): ExamRecord[] {
  if (!Array.isArray(value)) return [];
  const records: ExamRecord[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !isIso(entry.startedAt) || !isIso(entry.finishedAt)) continue;
    const config = parseConfig(entry.config);
    if (!config || !Array.isArray(entry.items)) continue;
    const items = entry.items.map(parseItem);
    if (items.some((i) => i === null)) continue;
    records.push({
      id: entry.id,
      purpose: parsePurpose(entry.purpose),
      startedAt: entry.startedAt,
      finishedAt: entry.finishedAt,
      timedOut: entry.timedOut === true,
      config,
      items: items as ExamItemResult[],
    });
  }
  return records.slice(-MAX_HISTORY);
}
