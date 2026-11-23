/**
 * Aturan bentuk kurikulum (72 misi, 10 tier): id, order, jumlah misi & XP per tier,
 * jenis misi per tier (termasuk misi "Perbaiki Query", "Tebak Hasil", dan Boss Challenge), hint, dan metadata TIERS.
 */
import { MISSIONS, TIERS, TOTAL_XP } from '../../src/data/missions';
import { BOSS_XP } from '../../src/data/missions/bosses';
import { articlesForMission } from '../../src/data/materi';
import { solutionAttemptsLeft } from '../../src/lib/boss';
import { RANKS } from '../../src/lib/ranks';
import { HINT_PENALTY, createEmptyProgress, getMissionProgress, isMissionUnlocked, recordAttempt } from '../../src/lib/progress';
import type { Mission, Tier, UserProgress } from '../../src/types';
import { assert } from './report';

const ALL_TIERS: readonly Tier[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Jumlah misi per tier, TERMASUK 1 boss di setiap tier. */
export const TIER_COUNTS: Record<Tier, number> = { 1: 8, 2: 8, 3: 9, 4: 8, 5: 6, 6: 6, 7: 6, 8: 4, 9: 8, 10: 9 };
/** XP misi biasa per tier (boss memakai BOSS_XP). */
export const XP_BY_TIER: Record<Tier, number> = { 1: 50, 2: 100, 3: 150, 4: 175, 5: 200, 6: 200, 7: 225, 8: 100, 9: 250, 10: 275 };
const EXPECTED_MISSION_COUNT = 72;
const EXPECTED_TOTAL_XP = 14800;

type KindCounts = Partial<Record<Mission['kind'], number>>;
const ALL_KINDS: readonly Mission['kind'][] = ['sql', 'injection', 'concept', 'predict'];

/** Komposisi jenis misi per tier sesuai rencana kurikulum ('sql' termasuk misi Perbaiki Query dan boss). */
const KIND_COUNTS: Record<Tier, KindCounts> = {
  1: { sql: 7, predict: 1 },
  2: { sql: 7, predict: 1 },
  3: { sql: 8, predict: 1 },
  4: { sql: 8 },
  5: { sql: 5, predict: 1 },
  6: { sql: 6 },
  7: { sql: 3, injection: 2, concept: 1 },
  8: { sql: 1, concept: 3 },
  9: { sql: 7, concept: 1 },
  10: { sql: 8, predict: 1 },
};

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isPlaceholder(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length === 0 || /^todo\b/i.test(trimmed);
}

function verifyMissionShape(mission: Mission, index: number): void {
  const id = mission.id;
  assert(mission.order === index + 1, `${id}: order ${mission.order}, seharusnya ${index + 1} (urut & kontigu)`);
  assert(KEBAB_CASE.test(id), `${id}: id harus kebab-case`);
  const boss = mission.kind === 'sql' && mission.boss !== undefined;
  const xp = boss ? BOSS_XP[mission.tier] : XP_BY_TIER[mission.tier];
  assert(mission.xpReward === xp, `${id}: xpReward ${mission.xpReward}, seharusnya ${xp} (tier ${mission.tier}${boss ? ', boss' : ''})`);
  if (boss) assert(mission.hint.length === 0, `${id}: boss tidak boleh punya hint`);
  else assert(mission.hint.length >= 2 && mission.hint.length <= 3, `${id}: jumlah hint ${mission.hint.length}, harus 2–3`);
  assert(mission.hint.every((h) => h.trim().length > 0), `${id}: ada hint kosong`);
  const textFields = [mission.title, mission.concept, mission.story, mission.task];
  assert(textFields.every((text) => !isPlaceholder(text)), `${id}: ada field teks kosong/TODO`);
}

/** Misi "Perbaiki Query" per tier (fix pada misi sql). */
const FIX_COUNTS: Record<Tier, number> = { 1: 1, 2: 1, 3: 2, 4: 1, 5: 0, 6: 0, 7: 0, 8: 0, 9: 1, 10: 1 };

function verifyFixMission(mission: Mission): void {
  if (mission.kind !== 'sql' || !mission.fix) return;
  const id = mission.id;
  assert(Number.isInteger(mission.fix.bugCount) && mission.fix.bugCount >= 1, `${id}: fix.bugCount harus bilangan bulat ≥ 1`);
  assert(mission.starterSql.trim().length > 0, `${id}: misi Perbaiki Query wajib punya starterSql (query bermasalah)`);
  assert(mission.starterSql.trim() !== mission.solutionSql.trim(), `${id}: starterSql tidak boleh sama dengan solutionSql`);
  const fixGrading = mission.grading?.type ?? 'result';
  assert(fixGrading === 'result' || fixGrading === 'schema', `${id}: misi Perbaiki Query harus grading 'result' (query) atau 'schema' (DDL)`);
  const bugWord = `${mission.fix.bugCount} bug`;
  assert(mission.task.includes(bugWord), `${id}: task harus menyebut jumlah bug ("${bugWord}")`);
}

/**
 * Boss Challenge: tepat satu per tier, di posisi TERAKHIR tier-nya, tanpa hint, tanpa materi khusus (materi tidak
 * boleh menautkannya — tautan = petunjuk), dan `combines` merujuk misi non-boss di tier yang sama atau sebelumnya.
 */
function verifyBosses(tier: Tier, missions: readonly Mission[]): void {
  const bosses = missions.flatMap((m) => (m.kind === 'sql' && m.boss ? [m] : []));
  assert(bosses.length === 1, `tier ${tier}: harus ada tepat 1 boss (ditemukan ${bosses.length})`);
  const boss = bosses[0];
  if (!boss?.boss) return;
  const last = missions.reduce((a, b) => (b.order > a.order ? b : a));
  assert(last.id === boss.id, `${boss.id}: boss harus misi terakhir di tier ${tier} (terakhir: ${last.id})`);
  assert(boss.id.startsWith('boss-'), `${boss.id}: id boss harus diawali 'boss-'`);
  assert(boss.fix === undefined, `${boss.id}: boss tidak boleh sekaligus misi Perbaiki Query`);
  // Sebutan "Final Boss" hanya untuk boss tier terakhir (UI memakai bossLabel yang otomatis; judul data harus selaras).
  const isLastTier = tier === ALL_TIERS[ALL_TIERS.length - 1];
  assert(boss.title.startsWith('Final Boss') === isLastTier, `${boss.id}: judul ${isLastTier ? 'harus' : 'tidak boleh'} diawali "Final Boss" (${boss.title})`);
  assert(articlesForMission(boss).length === 0, `${boss.id}: boss tidak boleh ditautkan dari materi (itu sama dengan hint)`);
  assert(boss.boss.combines.length >= 2, `${boss.id}: combines minimal 2 misi`);
  for (const id of boss.boss.combines) {
    const m = MISSIONS.find((x) => x.id === id);
    assert(m !== undefined, `${boss.id}: combines merujuk misi tak dikenal '${id}'`);
    if (!m) continue;
    assert(m.tier <= tier && !(m.kind === 'sql' && m.boss), `${boss.id}: combines '${id}' harus misi non-boss di tier ≤ ${tier}`);
  }
}

function completeAll(progress: UserProgress, missions: readonly Mission[]): UserProgress {
  const next = { ...progress, missions: { ...progress.missions } };
  for (const m of missions) next.missions[m.id] = { ...getMissionProgress(progress, m.id), completed: true };
  return next;
}

/**
 * Aturan buka-kunci boss: terkunci sampai SEMUA misi lain di tier-nya selesai (termasuk kartu konsep), tidak mengunci
 * tier berikutnya, dan solusinya baru bisa dibuka setelah 3 percobaan.
 */
function verifyBossUnlocking(): void {
  const unlocked = (p: UserProgress, id: string) => isMissionUnlocked(MISSIONS, p, id);
  for (const tier of ALL_TIERS) {
    const inTier = MISSIONS.filter((m) => m.tier === tier);
    const boss = inTier.find((m) => m.kind === 'sql' && m.boss);
    if (!boss) continue;
    const others = inTier.filter((m) => m.id !== boss.id);
    const earlier = MISSIONS.filter((m) => m.tier < tier);
    const base = completeAll(createEmptyProgress(), earlier);
    assert(!unlocked(base, boss.id), `${boss.id}: boss tidak boleh terbuka sebelum misi tier-nya dikerjakan`);
    const concept = others.find((m) => m.kind === 'concept');
    const allButOne = completeAll(base, others.filter((m) => m !== (concept ?? others[others.length - 1])));
    assert(!unlocked(allButOne, boss.id), `${boss.id}: boss harus tetap terkunci selama masih ada misi tier ${tier} yang belum selesai`);
    const ready = completeAll(base, others);
    assert(unlocked(ready, boss.id), `${boss.id}: boss harus terbuka setelah semua misi tier ${tier} selesai`);
    // Tier berikutnya bisa dibuka kartu konsep (selalu terbuka): selesaikan kartu pembukanya, lalu misi pertama berikutnya
    // harus terbuka walau boss tier ini belum dikalahkan.
    const nextTier = MISSIONS.filter((m) => m.tier === tier + 1 && !(m.kind === 'sql' && m.boss)).sort((a, b) => a.order - b.order);
    const leading = nextTier.slice(0, Math.max(0, nextTier.findIndex((m) => m.kind !== 'concept')));
    const nextFirst = nextTier.find((m) => m.kind !== 'concept');
    if (nextFirst) assert(unlocked(completeAll(ready, leading), nextFirst.id), `${nextFirst.id}: tier ${tier + 1} tidak boleh terkunci oleh boss tier ${tier}`);

    let tried = ready;
    for (let i = 0; i < 3; i += 1) {
      assert(solutionAttemptsLeft(boss, getMissionProgress(tried, boss.id)) === 3 - i, `${boss.id}: solusi harus terkunci sebelum percobaan ke-3`);
      tried = recordAttempt(tried, boss.id);
    }
    assert(solutionAttemptsLeft(boss, getMissionProgress(tried, boss.id)) === 0, `${boss.id}: solusi harus terbuka setelah 3 percobaan`);
  }
}

/**
 * Ambang rank: naik, dimulai dari 0, dan rank tertinggi tetap tercapai walau semua misi biasa diselesaikan dengan hint
 * (boss tidak punya hint). Setiap rank juga harus bisa dicapai sebelum kurikulum habis (tidak ada rank "mati").
 */
function verifyRanks(): void {
  assert(RANKS[0]?.minXp === 0, 'rank pertama harus mulai dari 0 XP');
  RANKS.forEach((rank, i) => {
    const prev = RANKS[i - 1];
    if (prev) assert(rank.minXp > prev.minXp, `rank ${rank.id}: minXp harus lebih besar dari ${prev.id}`);
  });
  const withAllHints = MISSIONS.reduce(
    (sum, m) => sum + (m.kind === 'sql' && m.boss ? m.xpReward : Math.round(m.xpReward * (1 - HINT_PENALTY))),
    0,
  );
  const top = RANKS[RANKS.length - 1];
  assert(top !== undefined && top.minXp <= withAllHints, `rank ${top?.id}: ${top?.minXp} XP tidak tercapai bila semua misi biasa memakai hint (${withAllHints} XP)`);
  assert(top !== undefined && top.minXp < TOTAL_XP, 'rank tertinggi harus di bawah TOTAL_XP');
}

function verifyKindCounts(tier: Tier, missions: readonly Mission[]): void {
  const expected = KIND_COUNTS[tier];
  for (const kind of ALL_KINDS) {
    const count = missions.filter((m) => m.kind === kind).length;
    const want = expected[kind] ?? 0;
    assert(count === want, `tier ${tier}: ${count} misi kind '${kind}', seharusnya ${want}`);
  }
}

/** Tier 6 = state, tier 7 sql = 1 index + 1 result dengan requireIndexOn, tier 4–5 = result. */
function verifyGradingPlan(tier: Tier, missions: readonly Mission[]): void {
  const sql = missions.flatMap((m) => (m.kind === 'sql' ? [m] : []));
  const type = (m: (typeof sql)[number]): string => m.grading?.type ?? 'result';

  if (tier === 4 || tier === 5) {
    sql.forEach((m) => assert(type(m) === 'result', `${m.id}: tier ${tier} harus grading 'result', ditemukan '${type(m)}'`));
  }
  if (tier === 6) {
    sql.forEach((m) => assert(type(m) === 'state', `${m.id}: tier 6 harus grading 'state', ditemukan '${type(m)}'`));
  }
  if (tier === 9) {
    sql.forEach((m) => assert(type(m) === 'schema' || type(m) === 'state', `${m.id}: tier 9 harus grading 'schema' (DDL) atau 'state' (UPSERT), ditemukan '${type(m)}'`));
    assert(sql.filter((m) => type(m) === 'schema').length >= 4, "tier 9: minimal 4 misi grading 'schema'");
  }
  if (tier === 7 && sql.length > 0) {
    assert(sql.filter((m) => type(m) === 'index').length === 1, "tier 7: harus ada tepat 1 misi grading 'index'");
    const sargable = sql.filter((m) => m.grading?.type === 'result' && m.grading.requireIndexOn);
    assert(sargable.length === 1, "tier 7: harus ada tepat 1 misi grading 'result' dengan requireIndexOn");
  }
}

function verifyTiers(): void {
  assert(TIERS.length === ALL_TIERS.length, `TIERS punya ${TIERS.length} entri, seharusnya ${ALL_TIERS.length}`);
  for (const tier of ALL_TIERS) {
    const infos = TIERS.filter((info) => info.tier === tier);
    assert(infos.length === 1, `TIERS harus memuat tier ${tier} tepat satu kali (ditemukan ${infos.length})`);
    const info = infos[0];
    if (!info) continue;
    assert(!isPlaceholder(info.name), `TIERS tier ${tier}: nama masih kosong/TODO`);
    assert(!isPlaceholder(info.description), `TIERS tier ${tier}: deskripsi masih kosong/TODO`);
  }
}

export function verifyCurriculum(): void {
  const ids = MISSIONS.map((mission) => mission.id);
  const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);
  assert(duplicates.length === 0, `id misi tidak unik: ${[...new Set(duplicates)].join(', ')}`);
  assert(MISSIONS.length === EXPECTED_MISSION_COUNT, `jumlah misi ${MISSIONS.length}, seharusnya ${EXPECTED_MISSION_COUNT}`);

  MISSIONS.forEach(verifyMissionShape);
  MISSIONS.forEach(verifyFixMission);

  for (const tier of ALL_TIERS) {
    const missions = MISSIONS.filter((mission) => mission.tier === tier);
    assert(missions.length === TIER_COUNTS[tier], `tier ${tier} punya ${missions.length} misi, seharusnya ${TIER_COUNTS[tier]}`);
    verifyKindCounts(tier, missions);
    const fixCount = missions.filter((m) => m.kind === 'sql' && m.fix !== undefined).length;
    assert(fixCount === FIX_COUNTS[tier], `tier ${tier}: ${fixCount} misi Perbaiki Query, seharusnya ${FIX_COUNTS[tier]}`);
    verifyGradingPlan(tier, missions.filter((m) => !(m.kind === 'sql' && m.boss)));
    verifyBosses(tier, missions);
  }

  verifyTiers();
  verifyBossUnlocking();
  verifyRanks();
  assert(TOTAL_XP === EXPECTED_TOTAL_XP, `TOTAL_XP ${TOTAL_XP}, seharusnya ${EXPECTED_TOTAL_XP}`);
  const perTier = ALL_TIERS.map((t) => `${t}:${MISSIONS.filter((m) => m.tier === t).length}`).join(' ');
  console.log(`    ${MISSIONS.length} misi (per tier ${perTier}), TOTAL_XP = ${TOTAL_XP}`);
}
