/**
 * Verifikasi misi "Tebak Hasil" (kind 'predict').
 * - query & pengecoh: SELECT/WITH murni (read-only), berjalan di DB seed segar.
 * - 2–3 pengecoh; semua tabel pilihan berbeda satu sama lain menurut aturan penilaian.
 * - tabel tidak kosong dan tetap ringkas (≤ 10 baris, ≤ 4 kolom) agar bisa dibandingkan di layar.
 * - orderMatters konsisten dengan ORDER BY tingkat atas pada query.
 * - urutan pilihan stabil (dua kali dibangun → urutan id sama).
 */
import type { SqlJsStatic } from 'sql.js';
import { mainVerb, normalizeSql, topLevelText } from '../../src/lib/plan/sqlText';
import { buildPredictChoices, sameResult } from '../../src/lib/predict';
import { createSeededDatabase, isMutatingSql } from '../../src/lib/sqlEngine';
import type { PredictMission } from '../../src/types';
import { assert, fail, guard, printResult, warn } from './report';

const MIN_DISTRACTORS = 2;
const MAX_DISTRACTORS = 3;
const MAX_ROWS = 10;
const MAX_COLUMNS = 4;

function verifyReadOnly(label: string, sql: string): void {
  assert(!isMutatingSql(sql), `${label}: harus SELECT murni (tidak boleh mengubah data/skema)`);
  const clean = normalizeSql(sql);
  assert(mainVerb(clean).verb === 'SELECT', `${label}: verb utama harus SELECT (boleh diawali WITH)`);
  const statements = clean.split(';').filter((part) => part.trim().length > 0);
  assert(statements.length === 1, `${label}: harus tepat satu statement (ditemukan ${statements.length})`);
}

/** true jika query punya ORDER BY di tingkat atas (bukan di dalam OVER(...)/subquery). */
function hasTopLevelOrderBy(sql: string): boolean {
  const clean = normalizeSql(sql);
  return /\bORDER\s+BY\b/i.test(topLevelText(clean, mainVerb(clean).start));
}

function verifyTexts(mission: PredictMission): void {
  assert(mission.explanation.trim().length >= 40, `${mission.id}: explanation terlalu pendek`);
  mission.distractors.forEach((d, i) => {
    assert(d.misconception.trim().length >= 30, `${mission.id}: misconception pengecoh #${i + 1} terlalu pendek`);
  });
}

function verifyChoices(SQL: SqlJsStatic, mission: PredictMission): void {
  const count = mission.distractors.length;
  assert(count >= MIN_DISTRACTORS && count <= MAX_DISTRACTORS, `${mission.id}: ${count} pengecoh, harus ${MIN_DISTRACTORS}–${MAX_DISTRACTORS}`);
  verifyReadOnly(`${mission.id} (query)`, mission.query);
  mission.distractors.forEach((d, i) => verifyReadOnly(`${mission.id} (pengecoh #${i + 1})`, d.sql));

  const ordered = hasTopLevelOrderBy(mission.query);
  if (ordered !== mission.orderMatters) {
    warn(`${mission.id}: orderMatters=${String(mission.orderMatters)} tetapi ORDER BY tingkat atas ${ordered ? 'ada' : 'tidak ada'}`);
  }

  const db = createSeededDatabase(SQL);
  try {
    const built = buildPredictChoices(db, mission);
    if (!built.ok) {
      fail(`${mission.id}: ${built.message}`);
      return;
    }
    const { choices } = built;
    assert(choices.length === count + 1, `${mission.id}: ${choices.length} pilihan, seharusnya ${count + 1}`);
    assert(choices.filter((c) => c.correct).length === 1, `${mission.id}: harus tepat satu pilihan benar`);

    for (const choice of choices) {
      const where = `${mission.id} [${choice.id}]`;
      assert(choice.result.rows.length > 0, `${where}: tabel pilihan kosong`);
      assert(choice.result.rows.length <= MAX_ROWS, `${where}: ${choice.result.rows.length} baris, maksimal ${MAX_ROWS}`);
      assert(choice.result.columns.length <= MAX_COLUMNS, `${where}: ${choice.result.columns.length} kolom, maksimal ${MAX_COLUMNS}`);
    }
    for (let i = 0; i < choices.length; i++) {
      for (let j = i + 1; j < choices.length; j++) {
        const a = choices[i];
        const b = choices[j];
        if (!a || !b) continue;
        assert(
          !sameResult(a.result, b.result, mission.orderMatters),
          `${mission.id}: pilihan ${a.id} dan ${b.id} menghasilkan tabel yang sama (pengecoh tidak membedakan)`,
        );
      }
    }

    const again = buildPredictChoices(db, mission);
    const order = (c: typeof choices) => c.map((x) => x.id).join(',');
    assert(again.ok && order(again.choices) === order(choices), `${mission.id}: urutan pilihan tidak stabil`);

    const answer = choices.find((c) => c.correct);
    if (answer) printResult(answer.result);
    console.log(`    urutan pilihan: ${order(choices)}`);
  } finally {
    db.close();
  }
}

export function verifyPredictMission(SQL: SqlJsStatic, mission: PredictMission): void {
  console.log(
    `\n#${mission.order} ${mission.id} — ${mission.title} [predict] (tier ${mission.tier}, ${mission.xpReward} XP, ${mission.distractors.length} pengecoh)`,
  );
  guard(`${mission.id} (teks)`, () => verifyTexts(mission));
  guard(`${mission.id} (pilihan)`, () => verifyChoices(SQL, mission));
}
