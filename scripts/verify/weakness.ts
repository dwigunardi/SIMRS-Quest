/**
 * Verifikasi Peta Kelemahan (src/lib/mistakes.ts + src/lib/weakness.ts).
 *
 * 1. Klasifikasi pada jawaban kurikulum sungguhan: setiap kasus salah di scripts/test-cases yang alasannya dikunci
 *    harus jatuh ke jenis kesalahan yang sesuai; error SQLite sungguhan dipetakan ke jenis yang tepat.
 * 2. Laporan: bobot kebaruan & "sudah teratasi", urutan kategori, rekomendasi (materi + misi), statistik, dan data
 *    rusak/usang (misi tak dikenal) diabaikan.
 */
import type { SqlJsStatic } from 'sql.js';
import { ARTICLES } from '../../src/data/materi';
import { MISSIONS } from '../../src/data/missions';
import { classifyCheck, classifySqlError, MISTAKE_INFO, type MistakeEvent, type MistakeKind } from '../../src/lib/mistakes';
import { createEmptyProgress } from '../../src/lib/progress';
import { createSeededDatabase, executeSql } from '../../src/lib/sqlEngine';
import { checkMission } from '../../src/lib/validator';
import { buildWeaknessReport, mistakeNudge, NUDGE_THRESHOLD } from '../../src/lib/weakness';
import type { MismatchReason, UserProgress } from '../../src/types';
import { MISSION_TEST_CASES } from '../test-cases';
import { assert } from './report';

/** Jenis yang boleh muncul untuk setiap alasan penilaian yang dikunci di test case. */
const ALLOWED: Partial<Record<MismatchReason, readonly MistakeKind[]>> = {
  'row-count': ['rows-extra', 'rows-missing', 'dml'],
  'cell-values': ['values', 'dml'],
  'row-order': ['order', 'dml'],
  'column-count': ['columns'],
  'column-names': ['columns'],
  'missing-construct': ['construct'],
  'open-transaction': ['dml'],
  'transaction-flow': ['dml'],
  'index-missing': ['performance'],
  'plan-scan': ['performance'],
};

function verifyCurriculumClassification(SQL: SqlJsStatic): number {
  let checked = 0;
  for (const mission of MISSIONS) {
    if (mission.kind !== 'sql') continue;
    for (const wrong of MISSION_TEST_CASES[mission.id]?.wrong ?? []) {
      const check = checkMission(SQL, mission, wrong.answer);
      const kind = classifyCheck(mission, check);
      const where = `kelemahan ${mission.id} [${wrong.label}]`;
      assert(kind !== null, `${where}: jawaban salah tidak menghasilkan jenis kesalahan`);
      if (check.kind === 'wrong' && check.compare.reason) {
        const allowed = ALLOWED[check.compare.reason];
        if (allowed) assert(kind !== null && allowed.includes(kind), `${where}: alasan '${check.compare.reason}' → '${kind ?? '-'}', seharusnya salah satu dari ${allowed.join('/')}`);
      }
      // Baris berlebih/kurang harus sesuai arah selisih jumlah baris.
      if (check.kind === 'wrong' && check.compare.reason === 'row-count' && kind !== 'dml') {
        const more = (check.actual?.rows.length ?? 0) > (check.expected?.rows.length ?? 0);
        assert(kind === (more ? 'rows-extra' : 'rows-missing'), `${where}: arah selisih baris salah (${kind ?? '-'})`);
      }
      checked += 1;
    }
    // Editor kosong bukan percobaan sungguhan.
    assert(classifyCheck(mission, checkMission(SQL, mission, '  -- belum diisi\n')) === null, `kelemahan ${mission.id}: editor kosong tidak boleh dicatat`);
    const correct = MISSION_TEST_CASES[mission.id]?.correct?.[0];
    if (correct) assert(classifyCheck(mission, checkMission(SQL, mission, correct.answer)) === null, `kelemahan ${mission.id}: jawaban benar tidak boleh dicatat sebagai kesalahan`);
  }
  return checked;
}

const ERROR_CASES: ReadonlyArray<{ sql: string; kind: MistakeKind }> = [
  { sql: 'SELEC * FROM pasien', kind: 'syntax' },
  { sql: 'SELECT nama_pasien FROM pasien', kind: 'names' },
  { sql: 'SELECT no_rm FROM pasien p JOIN kunjungan k ON p.no_rm = k.no_rm', kind: 'names' },
  { sql: 'SELECT kota FROM pasien WHERE COUNT(*) > 1', kind: 'aggregate' },
  { sql: 'SELECT no_rawat FROM billing WHERE ROW_NUMBER() OVER (ORDER BY no_rawat) = 1', kind: 'window' },
  { sql: "INSERT INTO poliklinik (id_poli, nama_poli, gedung) VALUES ('P01', 'X', 'Y')", kind: 'dml' },
  { sql: 'COMMIT', kind: 'dml' },
];

function verifyErrorClassification(SQL: SqlJsStatic): number {
  const db = createSeededDatabase(SQL);
  try {
    for (const c of ERROR_CASES) {
      const outcome = executeSql(db, c.sql);
      if (outcome.ok) {
        assert(false, `kelemahan: "${c.sql}" seharusnya error`);
        continue;
      }
      const kind = classifySqlError(outcome.rawError);
      assert(kind === c.kind, `kelemahan: error "${outcome.rawError}" → '${kind}', seharusnya '${c.kind}'`);
    }
  } finally {
    db.close();
  }
  return ERROR_CASES.length;
}

const NOW = Date.parse('2026-11-22T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

function verifyReport(): number {
  const progress: UserProgress = createEmptyProgress();
  const done = (id: string, at: string, attempts: number) => {
    progress.missions[id] = { completed: true, earnedXp: 50, hintUsed: false, hintsRevealed: 0, solutionShown: false, attempts, completedAt: at };
  };
  done('t1-select', ago(10), 1);
  done('t2-left-join', ago(1), 4);
  progress.missions['t2-having'] = { completed: false, earnedXp: 0, hintUsed: false, hintsRevealed: 0, solutionShown: false, attempts: 3, completedAt: null };

  const events: MistakeEvent[] = [
    // 3 × baris kurang di LEFT JOIN, 2 hari lalu, lalu misinya selesai kemarin → teratasi (bobot 0,5)
    { missionId: 't2-left-join', kind: 'rows-missing', at: ago(2) },
    { missionId: 't2-left-join', kind: 'rows-missing', at: ago(2) },
    { missionId: 't2-left-join', kind: 'rows-missing', at: ago(2) },
    // 2 × agregat di WHERE, baru saja, misi belum selesai (bobot 1)
    { missionId: 't2-having', kind: 'aggregate', at: ago(0.1) },
    { missionId: 't2-having', kind: 'aggregate', at: ago(0.2) },
    // 4 × pengurutan, 60 hari lalu (bobot 0,25), misi selesai 10 hari lalu (teratasi → 0,125 per kejadian)
    { missionId: 't1-select', kind: 'order', at: ago(60) },
    { missionId: 't1-select', kind: 'order', at: ago(60) },
    { missionId: 't1-select', kind: 'order', at: ago(60) },
    { missionId: 't1-select', kind: 'order', at: ago(60) },
    // data usang / rusak → diabaikan
    { missionId: 'misi-yang-sudah-dihapus', kind: 'values', at: ago(1) },
    { missionId: 't1-select', kind: 'values', at: 'bukan-tanggal' },
  ];
  const report = buildWeaknessReport(events, {}, progress, MISSIONS, ARTICLES, NOW);
  const kinds = report.categories.map((c) => c.kind).join(',');
  assert(report.totalMistakes === 9, `laporan: total ${report.totalMistakes}, seharusnya 9 (data rusak diabaikan)`);
  assert(kinds === 'aggregate,rows-missing,order', `laporan: urutan kategori ${kinds}, seharusnya aggregate,rows-missing,order`);
  const leftJoin = report.categories.find((c) => c.kind === 'rows-missing')?.missions[0];
  assert(leftJoin?.missionId === 't2-left-join' && leftJoin.resolved, 'laporan: misi LEFT JOIN seharusnya tercatat teratasi');
  const having = report.categories[0]?.missions[0];
  assert(having?.missionId === 't2-having' && !having.resolved, 'laporan: misi HAVING seharusnya belum teratasi');
  assert(report.recentMistakes === 5, `laporan: kesalahan 7 hari ${report.recentMistakes}, seharusnya 5`);
  const first = report.recommendations[0];
  assert(first?.type === 'read' && first.articleId === 'having', `laporan: rekomendasi pertama seharusnya materi HAVING, didapat ${JSON.stringify(first)}`);
  assert(report.recommendations.some((r) => r.type === 'retry' && r.missionId === 't2-having'), 'laporan: misi HAVING seharusnya disarankan untuk diselesaikan');
  const readIds = report.recommendations.flatMap((r) => (r.type === 'read' ? [r.articleId] : []));
  assert(new Set(readIds).size === readIds.length, 'laporan: materi yang sama tidak boleh disarankan dua kali');
  assert(report.topics[0]?.articleId === 'having', `laporan: topik teratas ${report.topics[0]?.articleId ?? '-'}, seharusnya having`);
  assert(report.stats.completed === 2 && report.stats.firstTry === 1 && report.stats.attempts === 8, `laporan: statistik ${JSON.stringify(report.stats)}`);

  const empty = buildWeaknessReport([], {}, createEmptyProgress(), MISSIONS, ARTICLES, NOW);
  assert(empty.totalMistakes === 0 && empty.categories.length === 0 && empty.recommendations.length === 0, 'laporan kosong harus tanpa kategori/rekomendasi');

  // Latihan ulang: salah setelah misi selesai → belum teratasi; dijawab benar lagi (riwayat solved) → teratasi lagi.
  const retry: MistakeEvent[] = [{ missionId: 't1-select', kind: 'order', at: ago(1) }];
  const beforeFix = buildWeaknessReport(retry, {}, progress, MISSIONS, ARTICLES, NOW).categories[0]?.missions[0];
  assert(beforeFix?.resolved === false, 'latihan ulang: kesalahan setelah penyelesaian pertama seharusnya belum teratasi');
  const afterFix = buildWeaknessReport(retry, { 't1-select': ago(0.5) }, progress, MISSIONS, ARTICLES, NOW).categories[0]?.missions[0];
  assert(afterFix?.resolved === true, 'latihan ulang: jawaban benar sesudahnya seharusnya menandai teratasi');

  // Data rusak: jenis kesalahan berupa kunci prototipe tidak boleh membuat laporan crash.
  const corrupt = [{ missionId: 't1-select', kind: 'constructor', at: ago(1) }] as unknown as MistakeEvent[];
  assert(buildWeaknessReport(corrupt, {}, progress, MISSIONS, ARTICLES, NOW).totalMistakes === 0, 'data rusak: kind "constructor" harus diabaikan');

  // Penanda di kartu salah: baru muncul pada kesalahan ke-NUDGE_THRESHOLD dalam 7 hari, materi paling relevan dipilih.
  const recentRows = (n: number, days: number): MistakeEvent[] =>
    Array.from({ length: n }, (_, i) => ({ missionId: i % 2 === 0 ? 't2-left-join' : 't1-where', kind: 'rows-missing' as const, at: ago(days) }));
  assert(mistakeNudge(recentRows(NUDGE_THRESHOLD - 1, 1), 'rows-missing', 't2-left-join', ARTICLES, NOW) === null, 'penanda: belum boleh muncul di bawah ambang');
  assert(mistakeNudge(recentRows(NUDGE_THRESHOLD, 10), 'rows-missing', 't2-left-join', ARTICLES, NOW) === null, 'penanda: kesalahan > 7 hari tidak dihitung');
  const nudge = mistakeNudge(recentRows(NUDGE_THRESHOLD, 1), 'rows-missing', 't2-left-join', ARTICLES, NOW);
  assert(nudge?.count === NUDGE_THRESHOLD && nudge.articleId === 'left-join', `penanda: seharusnya ${NUDGE_THRESHOLD}× + materi left-join, didapat ${JSON.stringify(nudge)}`);
  const generic = mistakeNudge(recentRows(NUDGE_THRESHOLD, 1), 'rows-missing', 't1-select', ARTICLES, NOW);
  assert(generic?.articleId === 'where', `penanda: tanpa irisan, materi umum pertama (where), didapat ${generic?.articleId ?? '-'}`);
  const construct: MistakeEvent[] = Array.from({ length: NUDGE_THRESHOLD }, () => ({ missionId: 't4-cte', kind: 'construct', at: ago(0.5) }));
  assert(mistakeNudge(construct, 'construct', 't4-cte', ARTICLES, NOW)?.articleId === 'cte', 'penanda: konstruksi wajib → materi utama misi (cte)');

  // Setiap materi yang dirujuk jenis kesalahan harus ada.
  const known = new Set(ARTICLES.map((a) => a.id));
  for (const [kind, info] of Object.entries(MISTAKE_INFO)) {
    for (const id of info.articles) assert(known.has(id), `kelemahan: jenis '${kind}' merujuk materi '${id}' yang tidak ada`);
  }
  return 20;
}

export function verifyWeakness(SQL: SqlJsStatic): void {
  const curriculum = verifyCurriculumClassification(SQL);
  const errors = verifyErrorClassification(SQL);
  const report = verifyReport();
  console.log(`  ${curriculum} jawaban salah kurikulum terklasifikasi, ${errors} error SQLite, ${report} pemeriksaan laporan ✓`);
}
