/**
 * Fixture emas: data pengguna versi 1 yang DIBEKUKAN, dan janji bahwa aplikasi masih bisa membacanya utuh.
 *
 * - scripts/fixtures/storage-v1.json     isi localStorage jalur SQL (ke-8 kunci `simrs-sql-quest:*:v1`), key → nilai JSON.
 * - scripts/fixtures/backup-format1.json file cadangan format 1 yang diekspor dari data yang sama.
 *
 * Keduanya dibangkitkan SEKALI dengan fungsi aplikasi (completeMission, updateDeck, buildExam, createBackup, …) lalu
 * disimpan sebagai JSON statis. Yang diperiksa di sini:
 * 1. nilai kunci storage tidak berubah (mengganti nama kunci = progres pengguna "hilang"),
 * 2. tiap parser membaca fixture TANPA kehilangan data (hasil parse sama persis dengan isi fixture),
 * 3. file cadangan format 1 masih diterima, dan memulihkannya menghasilkan storage yang sama,
 * 4. ringkasan Beranda (glance) dari fixture memberi angka yang ditetapkan di bawah.
 *
 * BILA BAGIAN INI MERAH: perubahanmu membuang atau salah membaca data pengguna lama. Perbaiki kodenya (atau tambahkan
 * migrasi) — JANGAN menyunting/membangkitkan ulang fixture supaya hijau. Format data baru = fixture BARU di samping
 * yang ini (storage-v2.json), bukan pengganti.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MISSIONS, getMissionById } from '../../src/data/missions';
import { parseArticleReads } from '../../src/hooks/useArticleReads';
import { parseBriefFold } from '../../src/hooks/useBriefFold';
import { parseMistakeLog } from '../../src/hooks/useMistakes';
import { parseSeen } from '../../src/lib/achievements';
import { BACKUP_APP, BACKUP_FORMAT, applyBackup, createBackup, parseBackup } from '../../src/lib/backup';
import { parseHistory, parseSession } from '../../src/lib/exam';
import { parseProgress } from '../../src/lib/progress';
import { parseDeck } from '../../src/lib/review';
import {
  ACHIEVEMENTS_SEEN_KEY,
  ARTICLE_READS_KEY,
  BRIEF_FOLD_KEY,
  EXAM_HISTORY_KEY,
  EXAM_SESSION_KEY,
  HOME_INTRO_KEY,
  MISTAKES_KEY,
  PROGRESS_KEY,
  QUARANTINE_ACK_KEY,
  REVIEW_KEY,
  SQL_GUARDED_KEYS,
  SQL_TRACK_KEYS,
} from '../../src/lib/storageKeys';
import type { TrackGlance } from '../../src/platform/tracks';
import { glance } from '../../src/tracks/sql/glance';
import { MemoryStorage, firstDifference, storageFromValues } from './memoryStorage';
import { assert } from './report';

function readFixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8');
}

/** Nilai kunci yang dibekukan. Ditulis ulang sebagai teks di sini dengan sengaja: konstanta tidak boleh "ikut berubah". */
const FROZEN_KEYS: ReadonlyArray<[name: string, actual: string, frozen: string]> = [
  ['PROGRESS_KEY', PROGRESS_KEY, 'simrs-sql-quest:progress:v1'],
  ['MISTAKES_KEY', MISTAKES_KEY, 'simrs-sql-quest:mistakes:v1'],
  ['ARTICLE_READS_KEY', ARTICLE_READS_KEY, 'simrs-sql-quest:materi-read:v1'],
  ['BRIEF_FOLD_KEY', BRIEF_FOLD_KEY, 'simrs-sql-quest:brief-fold:v1'],
  ['EXAM_SESSION_KEY', EXAM_SESSION_KEY, 'simrs-sql-quest:exam-session:v1'],
  ['EXAM_HISTORY_KEY', EXAM_HISTORY_KEY, 'simrs-sql-quest:exams:v1'],
  ['REVIEW_KEY', REVIEW_KEY, 'simrs-sql-quest:review:v1'],
  ['ACHIEVEMENTS_SEEN_KEY', ACHIEVEMENTS_SEEN_KEY, 'simrs-sql-quest:achievements-seen:v1'],
  ['HOME_INTRO_KEY', HOME_INTRO_KEY, 'simrs-quest:home-intro:v1'],
  ['QUARANTINE_ACK_KEY', QUARANTINE_ACK_KEY, 'simrs-quest:quarantine-ack:v1'],
];

/** "Sekarang" untuk glance: siang hari LOKAL 23 Nov 2026, sehari setelah aktivitas terakhir di fixture. */
const GLANCE_NOW = new Date(2026, 10, 23, 12, 0, 0);

/**
 * Angka harapan glance(fixture). Ditetapkan dengan tangan dari isi fixture:
 * - 12 misi selesai (760 XP → rank kedua), misi ke-13 (t2-having) sedang dikerjakan dan menjadi "Lanjutkan";
 * - aktif 19–22 Nov → streak 4, belum aktif hari ini;
 * - jatuh tempo ulang: 4 kartu deck bertanggal 23 Nov + 5 misi selesai yang belum pernah diulang = 9
 *   (t1-like dan t1-distinct baru jatuh tempo 25 Nov);
 * - ujian berjalan: 5 soal, 2 terjawab (satu tebak hasil, satu SQL; tiga lainnya masih isi awal editor);
 * - kesalahan 7 hari terakhir ada, jenis teratas "Agregat & GROUP BY" dengan 3 kejadian.
 */
const EXPECTED_GLANCE: Omit<TrackGlance, 'total' | 'resume'> & { resumeMissionId: string } = {
  started: true,
  completed: 12,
  xp: 760,
  rank: { title: 'Junior Programmer RS', icon: '💻' },
  resumeMissionId: 't2-having',
  streak: { active: 4, best: 4, activeToday: false },
  reviewDue: 9,
  exam: { purpose: 'exam', deadline: '2026-11-23T12:10:00.000Z', answered: 2, total: 5 },
  weakness: { label: 'Agregat & GROUP BY', count: 3 },
  quarantinedAt: null,
};

export function verifyFixtures(): void {
  let checks = 0;
  const ok = (cond: boolean, msg: string) => {
    checks += 1;
    assert(cond, `fixture: ${msg}`);
  };
  /** `actual` harus sama persis dengan `expected`; kegagalan menyebut letak perbedaannya. */
  const same = (actual: unknown, expected: unknown, what: string) => {
    const diff = firstDifference(actual, expected);
    ok(diff === null, `${what} — ${diff ?? ''}`);
  };

  // 1. Kunci beku.
  for (const [name, actual, frozen] of FROZEN_KEYS) ok(actual === frozen, `${name} berubah menjadi "${actual}" (harus tetap "${frozen}")`);

  const fixture = JSON.parse(readFixture('storage-v1.json')) as Record<string, unknown>;
  same(Object.keys(fixture).sort((a, b) => a.localeCompare(b)), [...SQL_TRACK_KEYS].sort((a, b) => a.localeCompare(b)), 'storage-v1.json harus berisi tepat ke-8 kunci jalur SQL');
  const value = (key: string) => fixture[key];
  const raw = (key: string) => JSON.stringify(fixture[key]);

  // 2. Tiap parser membaca fixture tanpa kehilangan data.
  same(parseProgress(value(PROGRESS_KEY)), value(PROGRESS_KEY), 'parseProgress kehilangan/mengubah data progres');
  same(parseMistakeLog(raw(MISTAKES_KEY)), value(MISTAKES_KEY), 'parseMistakeLog kehilangan/mengubah riwayat kesalahan');
  same([...parseArticleReads(raw(ARTICLE_READS_KEY))], value(ARTICLE_READS_KEY), 'parseArticleReads kehilangan/mengubah materi dibaca');
  same(parseBriefFold(raw(BRIEF_FOLD_KEY)), value(BRIEF_FOLD_KEY), 'parseBriefFold kehilangan/mengubah lipatan brief');
  same(parseSession(value(EXAM_SESSION_KEY), MISSIONS), value(EXAM_SESSION_KEY), 'parseSession kehilangan/mengubah sesi ujian aktif');
  same(parseHistory(value(EXAM_HISTORY_KEY)), value(EXAM_HISTORY_KEY), 'parseHistory kehilangan/mengubah riwayat ujian');
  same(parseDeck(value(REVIEW_KEY)), value(REVIEW_KEY), 'parseDeck kehilangan/mengubah jadwal latihan ulang');
  const seen = parseSeen(value(ACHIEVEMENTS_SEEN_KEY));
  same(seen ? [...seen] : null, value(ACHIEVEMENTS_SEEN_KEY), 'parseSeen kehilangan/mengubah lencana terlihat');

  // Fixture memang memuat ragam yang dijanjikan (kalau tidak, pemeriksaan di atas lolos tanpa arti).
  const progress = parseProgress(value(PROGRESS_KEY));
  const entries = Object.values(progress?.missions ?? {});
  ok(entries.length === 13 && entries.filter((m) => m.completed).length === 12, 'fixture harus memuat 13 entri misi (12 selesai)');
  ok(entries.some((m) => m.hintUsed) && entries.some((m) => m.solutionShown) && entries.some((m) => m.attempts > 2) && entries.some((m) => !m.completed && m.attempts > 0), 'fixture harus memuat variasi hint/solusi/percobaan/misi belum selesai');
  const history = parseHistory(value(EXAM_HISTORY_KEY));
  ok(history.length === 2 && history.some((r) => r.purpose === 'exam') && history.some((r) => r.purpose === 'review'), 'fixture harus memuat 2 riwayat: ujian + latihan ulang');
  const log = parseMistakeLog(raw(MISTAKES_KEY));
  ok(log.events.length === 14 && Object.keys(log.solved).length === 12, `fixture harus memuat 14 kesalahan & 12 misi terjawab benar (dapat ${log.events.length} & ${Object.keys(log.solved).length})`);

  // 3. File cadangan format 1.
  const backupText = readFixture('backup-format1.json');
  const backupJson = JSON.parse(backupText) as Record<string, unknown>;
  const parsed = parseBackup(backupText);
  ok(parsed.ok, `parseBackup menolak file cadangan format 1${parsed.ok ? '' : `: ${parsed.error}`}`);
  if (parsed.ok) {
    ok(BACKUP_APP === 'simrs-sql-quest' && BACKUP_FORMAT === 1, 'penanda file cadangan (app/format) berubah — file lama pengguna akan ditolak');
    same(parsed.backup, backupJson, 'parseBackup kehilangan/mengubah isi file cadangan');
    same(parsed.backup.progress, value(PROGRESS_KEY), 'cadangan.progress ≠ fixture');
    same(parsed.backup.mistakes, value(MISTAKES_KEY), 'cadangan.mistakes ≠ fixture');
    same(parsed.backup.materiRead, value(ARTICLE_READS_KEY), 'cadangan.materiRead ≠ fixture');
    same(parsed.backup.exams, value(EXAM_HISTORY_KEY), 'cadangan.exams ≠ fixture');
    same(parsed.backup.reviews, value(REVIEW_KEY), 'cadangan.reviews ≠ fixture');
    same(parsed.summary, { xp: 760, completed: 12, mistakes: 14, articlesRead: 10, exams: 2, exportedAt: '2026-11-23T11:45:00.000Z' }, 'ringkasan cadangan salah');

    // Memulihkan ke browser kosong → kunci-kunci yang dicadangkan bernilai sama dengan fixture.
    const target = new MemoryStorage();
    ok(applyBackup(target, parsed.backup), 'applyBackup ke storage kosong harus berhasil');
    for (const key of [PROGRESS_KEY, MISTAKES_KEY, ARTICLE_READS_KEY, EXAM_HISTORY_KEY, REVIEW_KEY]) {
      const stored = target.getItem(key);
      same(stored === null ? undefined : (JSON.parse(stored) as unknown), value(key), `setelah impor, isi ${key} ≠ fixture`);
    }
    same([...SQL_GUARDED_KEYS].sort((a, b) => a.localeCompare(b)), [PROGRESS_KEY, MISTAKES_KEY, ARTICLE_READS_KEY, EXAM_HISTORY_KEY, REVIEW_KEY].sort((a, b) => a.localeCompare(b)), 'kunci yang dijaga karantina harus sama dengan kunci yang dicadangkan');
    // Sengaja: lencana terlihat dikosongkan (dicatat ulang diam-diam), sesi ujian & lipatan brief tidak dicadangkan.
    same(target.keys(), [PROGRESS_KEY, MISTAKES_KEY, ARTICLE_READS_KEY, EXAM_HISTORY_KEY, REVIEW_KEY, ACHIEVEMENTS_SEEN_KEY].sort((a, b) => a.localeCompare(b)), 'impor menulis kunci yang tidak semestinya');
    ok(target.getItem(ACHIEVEMENTS_SEEN_KEY) === 'null', 'impor harus mengosongkan daftar lencana terlihat');

    // Mengekspor ulang data yang sama menghasilkan file yang sama (bentuk ekspor tidak berubah diam-diam).
    same(createBackup(storageFromValues(fixture), new Date(parsed.backup.exportedAt)), backupJson, 'createBackup(fixture) ≠ backup-format1.json');
  }

  // 4. Ringkasan Beranda dari fixture.
  const storage = storageFromValues(fixture);
  const result = glance(storage, GLANCE_NOW);
  const { resumeMissionId, ...expected } = EXPECTED_GLANCE;
  const resumeMission = getMissionById(resumeMissionId);
  ok(resumeMission !== undefined, `misi ${resumeMissionId} hilang dari kurikulum`);
  same(
    result,
    {
      ...expected,
      total: MISSIONS.length,
      // Urutan/judul milik kurikulum (boleh disunting); yang dibekukan adalah MISI mana yang dilanjutkan.
      resume: { missionId: resumeMissionId, order: resumeMission?.order, title: resumeMission?.title, tierLabel: result.resume?.tierLabel },
    },
    'glance(fixture) ≠ nilai harapan',
  );
  ok((result.resume?.tierLabel ?? '').startsWith(`Tier ${resumeMission?.tier ?? '?'}`), `tierLabel "${result.resume?.tierLabel ?? ''}" tidak menyebut tier misinya`);
  ok(storage.writes === 0, 'glance tidak boleh menulis ke storage');

  console.log(`  ${checks} pemeriksaan fixture emas (storage v1 + cadangan format 1) ✓`);
}
