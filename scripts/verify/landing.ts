/**
 * Verifikasi landing (Beranda): isinya harus BENAR untuk aplikasi ini.
 *
 * - angka      src/platform/landing/lib/content.ts — jumlah misi/tier/boss/materi/lencana/pangkat, XP, penalti hint,
 *              jadwal Leitner, pilihan ujian, Lab Performa — sama dengan data sebenarnya
 * - database   tabel (nama, jumlah baris) dan kota asal pasien — sama dengan hasil seed
 * - jalur      daftar jalur & tautan cocok dengan src/platform/tracks.ts dan router
 * - contoh     contoh misi di mockup (query, hasil, pesan, perbedaan) dihitung ulang dari kurikulum & database
 * - label      teks aplikasi yang dikutip landing (nama tab, tombol, mode, judul sukses) memang ada di komponennya
 * - kata       tidak ada kata yang menjanjikan hal yang tidak ada di aplikasi (content.ts DAN berkas .tsx landing)
 * - kontras    token warna src/platform/landing/styles/tokens.css lolos WCAG AA untuk tiap pasangan yang dipakai
 * - ringan     berkas landing tidak mengimpor statis data misi, mesin SQL, cobe, atau canvas-confetti
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Database, SqlJsStatic } from 'sql.js';
import { ARTICLES } from '../../src/data/materi';
import { MISSIONS, TIERS, TOTAL_XP as CURRICULUM_XP } from '../../src/data/missions';
import { ACHIEVEMENTS } from '../../src/lib/achievements';
import { BIG_VISITS } from '../../src/lib/bigData';
import { BOSS_SOLUTION_AFTER as REAL_BOSS_SOLUTION_AFTER, isBoss } from '../../src/lib/boss';
import { EXAM_COUNTS, EXAM_MINUTES } from '../../src/lib/exam';
import { buildVulnerableSql } from '../../src/lib/injection';
import { MISTAKE_INFO, classifyCheck } from '../../src/lib/mistakes';
import { HINT_PENALTY, createEmptyProgress, isMissionUnlocked } from '../../src/lib/progress';
import { RANKS as REAL_RANKS, getRank } from '../../src/lib/ranks';
import { diffResults } from '../../src/lib/resultDiff';
import { REVIEW_INTERVALS } from '../../src/lib/review';
import { createSeededDatabase } from '../../src/lib/sqlEngine';
import { THEME_KEY } from '../../src/lib/storageKeys';
import { THEME_STORAGE_KEY } from '../../src/platform/landing/hooks/useTheme';
import { checkMission } from '../../src/lib/validator';
import { PRODUCT_TAGLINE } from '../../src/platform/brand';
import * as content from '../../src/platform/landing/lib/content';
import { CATALOG_ROUTE, courseHref, formatRoute, parseRoute } from '../../src/platform/router';
import { TRACKS as REGISTRY } from '../../src/platform/tracks';
import type { Mission } from '../../src/types';
import { isLightFile, isLightPackage, staticClosure } from './platform';
import { assert } from './report';

type Check = (cond: boolean, msg: string) => void;
type Cell = string | number;

function readSource(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function mission(id: string): Mission {
  const found = MISSIONS.find((m) => m.id === id);
  if (!found) throw new Error(`misi "${id}" yang dirujuk landing tidak ada di kurikulum`);
  return found;
}

function run(db: Database, sql: string, params?: Cell[]): { columns: string[]; rows: Cell[][] } {
  const result = db.exec(sql, params)[0];
  if (!result) return { columns: [], rows: [] };
  return { columns: result.columns, rows: result.values.map((row) => row.map((cell) => (typeof cell === 'number' ? cell : String(cell)))) };
}

/* ------------------------------------------------------------------ */
/* Angka                                                               */
/* ------------------------------------------------------------------ */

function verifyNumbers(ok: Check): void {
  const bosses = MISSIONS.filter(isBoss);
  ok(content.MISSION_COUNT === MISSIONS.length, `MISSION_COUNT ${content.MISSION_COUNT} ≠ ${MISSIONS.length} misi`);
  ok(content.TIER_COUNT === TIERS.length, `TIER_COUNT ${content.TIER_COUNT} ≠ ${TIERS.length} tier`);
  ok(content.BOSS_COUNT === bosses.length, `BOSS_COUNT ${content.BOSS_COUNT} ≠ ${bosses.length} boss`);
  ok(new Set(bosses.map((b) => b.tier)).size === TIERS.length, 'klaim "satu Boss per tier" tidak lagi benar');
  ok(content.ARTICLE_COUNT === ARTICLES.length, `ARTICLE_COUNT ${content.ARTICLE_COUNT} ≠ ${ARTICLES.length} artikel`);
  ok(content.BADGE_COUNT === ACHIEVEMENTS.length, `BADGE_COUNT ${content.BADGE_COUNT} ≠ ${ACHIEVEMENTS.length} lencana`);
  ok(content.RANK_COUNT === REAL_RANKS.length, `RANK_COUNT ${content.RANK_COUNT} ≠ ${REAL_RANKS.length} pangkat`);
  ok(content.TOTAL_XP === CURRICULUM_XP, `TOTAL_XP ${content.TOTAL_XP} ≠ ${CURRICULUM_XP}`);
  ok(content.HINT_PENALTY_PERCENT === Math.round(HINT_PENALTY * 100), `HINT_PENALTY_PERCENT ${content.HINT_PENALTY_PERCENT} ≠ ${HINT_PENALTY * 100}`);
  ok(content.BOSS_SOLUTION_AFTER === REAL_BOSS_SOLUTION_AFTER, `BOSS_SOLUTION_AFTER ${content.BOSS_SOLUTION_AFTER} ≠ ${REAL_BOSS_SOLUTION_AFTER}`);
  ok(same(content.REVIEW_INTERVAL_DAYS, REVIEW_INTERVALS), `REVIEW_INTERVAL_DAYS harus ${REVIEW_INTERVALS.join(', ')}`);
  ok(same(content.EXAM_QUESTION_COUNTS, EXAM_COUNTS), `EXAM_QUESTION_COUNTS harus ${EXAM_COUNTS.join(', ')}`);
  ok(same(content.EXAM_MINUTE_OPTIONS, EXAM_MINUTES.filter((m) => m !== null)), 'EXAM_MINUTE_OPTIONS tidak cocok dengan pilihan waktu ujian');
  ok(EXAM_MINUTES.some((m) => m === null), 'klaim "tanpa batas waktu" tidak lagi benar: ujian tidak punya pilihan tanpa batas');
  ok(content.PERF_LAB_VISITS === BIG_VISITS, `PERF_LAB_VISITS ${content.PERF_LAB_VISITS} ≠ ${BIG_VISITS}`);
  ok(content.formatNumber(14800) === '14.800', 'formatNumber harus memakai pemisah ribuan Indonesia');
  // Enam jenis misi yang disebut landing memang ada di kurikulum.
  const kinds = {
    sql: MISSIONS.some((m) => m.kind === 'sql' && !m.fix && !m.boss),
    fix: MISSIONS.some((m) => m.kind === 'sql' && m.fix !== undefined),
    predict: MISSIONS.some((m) => m.kind === 'predict'),
    injection: MISSIONS.some((m) => m.kind === 'injection'),
    concept: MISSIONS.some((m) => m.kind === 'concept'),
    boss: bosses.length > 0,
  };
  ok(Object.values(kinds).every(Boolean), `jenis misi yang disebut landing harus ada semua: ${JSON.stringify(kinds)}`);
  ok(content.FEATURES.tabs.missions.kinds.length === Object.keys(kinds).length, 'FEATURES.tabs.missions.kinds harus memuat enam jenis misi');
}

/* ------------------------------------------------------------------ */
/* Database latihan                                                    */
/* ------------------------------------------------------------------ */

function verifyDatabase(ok: Check, db: Database): void {
  const tables = run(db, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY rowid").rows.map((row) => String(row[0]));
  ok(same(content.PRACTICE_TABLES.map((t) => t.name), tables), `PRACTICE_TABLES harus berisi tabel seed berurutan: ${tables.join(', ')}`);
  ok(content.TABLE_COUNT === tables.length, `TABLE_COUNT ${content.TABLE_COUNT} ≠ ${tables.length} tabel`);
  for (const table of content.PRACTICE_TABLES) {
    if (!tables.includes(table.name)) continue;
    const count = run(db, `SELECT COUNT(*) FROM ${table.name}`).rows[0]?.[0];
    ok(table.rows === count, `PRACTICE_TABLES: ${table.name} berisi ${String(count)} baris, bukan ${table.rows}`);
    ok(table.about.trim() !== '', `PRACTICE_TABLES: ${table.name} butuh keterangan`);
  }
  const patients = run(db, 'SELECT COUNT(*) FROM pasien').rows[0]?.[0];
  ok(content.PATIENT_COUNT === patients, `PATIENT_COUNT ${content.PATIENT_COUNT} ≠ ${String(patients)}`);

  const cities = run(db, 'SELECT kota, COUNT(*) AS n FROM pasien GROUP BY kota ORDER BY n DESC, kota').rows;
  ok(same(content.PATIENT_CITIES.map((c) => [c.name, c.patients]), cities), `PATIENT_CITIES harus sama dengan kota di tabel pasien: ${JSON.stringify(cities)}`);
  ok(content.CITY_COUNT === cities.length, `CITY_COUNT ${content.CITY_COUNT} ≠ ${cities.length} kota`);
  for (const city of content.PATIENT_CITIES) {
    // Semua kota pada data latihan ada di Indonesia; koordinat di luar kotak ini pasti salah ketik.
    ok(city.lat > -11 && city.lat < 6 && city.lon > 95 && city.lon < 141, `PATIENT_CITIES: koordinat ${city.name} di luar Indonesia`);
  }
  // Kartu query di hero: hasilnya harus persis daftar kota yang ditampilkan (dan ditandai di bola dunia).
  const cityQuery = run(db, content.HERO.cityQuery.sql);
  ok(same(cityQuery.columns, content.HERO.cityQuery.columns), `HERO.cityQuery: kolom hasil adalah ${cityQuery.columns.join(', ')}`);
  ok(same(cityQuery.rows, content.PATIENT_CITIES.map((c) => [c.name, c.patients])), 'HERO.cityQuery: hasil query harus sama (isi dan urutan) dengan PATIENT_CITIES');
  ok(content.HERO.badge.fresh.includes(String(content.PATIENT_COUNT)) && content.HERO.badge.fresh.includes(String(content.CITY_COUNT)), 'HERO.badge.fresh harus menyebut jumlah pasien dan kota');
}

/* ------------------------------------------------------------------ */
/* Jalur, tautan, pangkat, peta tier                                   */
/* ------------------------------------------------------------------ */

function verifyTracksAndRoutes(ok: Check): void {
  ok(same(content.TRACKS.map((t) => t.id), REGISTRY.map((t) => t.id)), `TRACKS landing harus sama urutannya dengan registri: ${REGISTRY.map((t) => t.id).join(', ')}`);
  for (const track of content.TRACKS) {
    const real = REGISTRY.find((t) => t.id === track.id);
    if (!real) continue;
    ok(track.title === real.title, `jalur ${track.id}: judul "${track.title}" ≠ registri "${real.title}"`);
    ok(track.status === real.status, `jalur ${track.id}: status "${track.status}" ≠ registri "${real.status}"`);
    ok(track.tagline === real.tagline, `jalur ${track.id}: tagline berbeda dari registri`);
    ok(track.summary.trim() !== '', `jalur ${track.id}: butuh ringkasan`);
    if (track.status === 'tersedia') ok(track.href === formatRoute({ kind: 'track', trackId: track.id, rest: [] }), `jalur ${track.id}: href harus '#/${track.id}'`);
    else ok(track.href === undefined, `jalur ${track.id} belum tersedia: tidak boleh punya href`);
    // Jalur yang belum ada tidak boleh diberi tanggal.
    ok(!/\b20\d{2}\b|bulan depan|minggu depan|kuartal|tahun ini/i.test(`${track.tagline} ${track.summary}`), `jalur ${track.id}: tidak boleh menyebut tanggal rilis`);
  }
  ok(!/\b20\d{2}\b|bulan depan|minggu depan|kuartal|tahun ini/i.test(content.PATHS.soon.body), 'PATHS.soon.body tidak boleh menjanjikan tanggal');

  // Landing tiap jalur (navbar, footer, pita berjalan, panel 'segera' di peta) dan katalog.
  for (const track of content.TRACKS) {
    ok(track.landingHref === courseHref(track.id), `jalur ${track.id}: landingHref harus '${courseHref(track.id)}'`);
  }
  ok(content.ROUTES.catalog === formatRoute(CATALOG_ROUTE), "ROUTES.catalog harus '#/landing'");
  ok(
    content.NAV.tracks.all.href === content.ROUTES.catalog && content.FOOTER.allTracks.href === content.ROUTES.catalog && content.EXPLORE.allTracks.href === content.ROUTES.catalog,
    'tautan "Semua jalur" (navbar, footer, strip Jelajahi) harus ke ROUTES.catalog',
  );
  for (const item of content.MARQUEE.items) {
    const owner = content.TRACKS.find((t) => t.id === item.trackId);
    ok(owner !== undefined && owner.status === item.status, `MARQUEE "${item.label}": trackId "${item.trackId}" harus jalur yang ada dengan status yang sama`);
  }

  // Tautan ke dalam aplikasi: jalur sql + segmen masuk yang dikenali src/App.tsx (ENTRY_MODES).
  const appSource = readSource('src/App.tsx');
  ok(content.ROUTES.home === formatRoute({ kind: 'home' }), "ROUTES.home harus '#/'");
  for (const [name, hash] of Object.entries(content.ROUTES)) {
    if (name === 'home' || name === 'catalog') continue;
    const route = parseRoute(hash);
    ok(route.kind === 'track' && route.trackId === 'sql' && formatRoute(route) === hash, `ROUTES.${name} "${hash}" harus rute kanonik ke jalur sql`);
    if (route.kind !== 'track') continue;
    ok(route.rest.length <= 1, `ROUTES.${name}: paling banyak satu segmen setelah jalur`);
    const segment = route.rest[0];
    if (segment !== undefined) ok(appSource.includes(`['${segment}',`), `ROUTES.${name}: segmen "${segment}" tidak dikenali jalur sql (ENTRY_MODES di src/App.tsx)`);
  }
  ok(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(content.GITHUB_URL), 'GITHUB_URL harus alamat repositori GitHub');
  ok(readSource('LICENSE').startsWith(`${content.LICENSE_NAME} License`), `LICENSE_NAME "${content.LICENSE_NAME}" tidak cocok dengan berkas LICENSE`);
  ok(new Set(Object.values(content.SECTION_IDS)).size === Object.values(content.SECTION_IDS).length, 'SECTION_IDS harus unik');

  // Pangkat.
  ok(same(content.RANK_LADDER, REAL_RANKS.map((r) => ({ title: r.title, minXp: r.minXp, icon: r.icon }))), 'RANK_LADDER harus sama dengan src/lib/ranks.ts (judul, XP, ikon)');
  ok(content.RANKS.featured.length === 3 && content.RANKS.featured.every((i) => content.RANK_LADDER[i] !== undefined), 'RANKS.featured harus tiga indeks RANK_LADDER yang ada');
  const first = REAL_RANKS[0];
  const last = REAL_RANKS[REAL_RANKS.length - 1];
  ok(first !== undefined && last !== undefined && content.RANKS.lead.includes(first.title) && content.RANKS.lead.includes(last.title), 'RANKS.lead harus menyebut pangkat pertama dan terakhir');
  const sample = content.FEATURES.tabs.rank.sample;
  ok(getRank(sample.xp).title === content.RANK_LADDER[sample.rankIndex]?.title, `FEATURES rank.sample: ${sample.xp} XP bukan pangkat indeks ${sample.rankIndex}`);
  // Klaim "pangkat tertinggi tercapai walau membuka hint di setiap misi" (boss tidak punya hint).
  const withHints = MISSIONS.reduce((sum, m) => sum + (isBoss(m) ? m.xpReward : Math.round(m.xpReward * (1 - HINT_PENALTY))), 0);
  ok(last !== undefined && withHints >= last.minXp, `klaim pangkat tertinggi dengan hint tidak benar: ${withHints} XP < ${String(last?.minXp)}`);

  // Peta tier.
  const tiers = content.PATHS.roadmap.tiers;
  ok(tiers.length === TIERS.length, `peta tier: harus ${TIERS.length} tier`);
  for (const item of tiers) {
    const real = TIERS.find((t) => t.tier === item.tier);
    const inTier = MISSIONS.filter((m) => m.tier === item.tier);
    const boss = inTier.find(isBoss);
    ok(real?.name === item.name, `peta tier ${item.tier}: nama "${item.name}" ≠ "${String(real?.name)}"`);
    ok(inTier.length === item.missions, `peta tier ${item.tier}: ${inTier.length} misi, bukan ${item.missions}`);
    ok(boss?.title.replace(/^(Final )?Boss:\s*/, '') === item.boss, `peta tier ${item.tier}: boss "${item.boss}" ≠ "${String(boss?.title)}"`);
    ok(item.topics.trim() !== '', `peta tier ${item.tier}: butuh contoh topik`);
  }
  ok(tiers.reduce((sum, t) => sum + t.missions, 0) === MISSIONS.length, 'peta tier: jumlah misi per tier harus berjumlah total misi');

  // Klaim tentang Boss: tanpa hint, terbuka setelah misi lain di tier-nya selesai, dan TIDAK mengunci tier berikutnya.
  const bosses = MISSIONS.filter(isBoss);
  ok(bosses.every((boss) => boss.hint.length === 0), 'klaim "Boss tanpa hint" tidak lagi benar: ada Boss yang punya hint');
  const sorted = [...MISSIONS].sort((a, b) => a.order - b.order);
  const tierOne = sorted.filter((m) => m.tier === 1);
  const bossOne = tierOne.find(isBoss);
  const firstOfTierTwo = sorted.find((m) => m.tier === 2 && !isBoss(m) && m.kind !== 'concept');
  const done = { completed: true, earnedXp: 0, hintUsed: false, hintsRevealed: 0, solutionShown: false, attempts: 1, completedAt: '2026-11-20T03:00:00.000Z' };
  const withoutBoss = { ...createEmptyProgress(), missions: Object.fromEntries(tierOne.filter((m) => !isBoss(m)).map((m) => [m.id, done])) };
  ok(
    bossOne !== undefined && firstOfTierTwo !== undefined && isMissionUnlocked(sorted, withoutBoss, firstOfTierTwo.id) && isMissionUnlocked(sorted, withoutBoss, bossOne.id),
    'klaim PATHS.roadmap.bossNote tidak lagi benar: Boss harus terbuka setelah misi lain di tier-nya selesai dan tidak mengunci tier berikutnya',
  );
  ok(/tidak mengunci/.test(content.PATHS.roadmap.bossNote) && /tidak mengunci/.test(content.FEATURES.tabs.missions.body), 'landing harus menyatakan bahwa Boss tidak mengunci tier berikutnya (peta & tab Misi & Boss)');
}

/* ------------------------------------------------------------------ */
/* Contoh di mockup                                                    */
/* ------------------------------------------------------------------ */

function tierLabelOf(m: Mission): string {
  return `Tier ${m.tier} · Misi ${m.order}`;
}

function verifyPractice(ok: Check, SQL: SqlJsStatic, db: Database): void {
  const { query, fix, predict, injection, playground } = content.PRACTICE.tabs;

  const q = mission(query.missionId);
  ok(q.kind === 'sql' && !q.fix && !q.boss, 'contoh Query harus misi SQL biasa');
  if (q.kind === 'sql') {
    ok(query.code === q.solutionSql, 'contoh Query: kode harus sama dengan solusi misinya');
    ok(query.missionTitle === q.title && query.xp === q.xpReward && query.tierLabel === tierLabelOf(q), 'contoh Query: judul / XP / label tier tidak cocok dengan misinya');
    ok(same(run(db, query.code), query.result), 'contoh Query: tabel hasil tidak sama dengan hasil query di database latihan');
    ok(checkMission(SQL, q, query.code).kind === 'correct', 'contoh Query: kodenya harus dinilai benar');
    // Klik pertama pada Hint di tab Query menampilkan hint PERTAMA misinya.
    ok(query.hint === q.hint[0] && query.hintLabel === `Hint 1 dari ${q.hint.length}`, 'contoh Query: hint harus hint pertama misinya, berlabel "Hint 1 dari n"');
  }

  // Cuplikan tabel di kartu soal = baris-baris pertama tabelnya.
  for (const [name, preview] of Object.entries(content.TABLE_PREVIEWS)) {
    ok(content.PRACTICE_TABLES.some((table) => table.name === name), `TABLE_PREVIEWS: "${name}" bukan tabel database latihan`);
    ok(/^[a-z_]+$/.test(name) && preview.columns.every((column) => /^[a-z_]+$/.test(column)), `TABLE_PREVIEWS ${name}: nama tabel/kolom tidak wajar`);
    ok(same(run(db, `SELECT ${preview.columns.join(', ')} FROM ${name} LIMIT ${preview.rows.length}`), preview), `TABLE_PREVIEWS ${name}: cuplikan tidak sama dengan baris pertama tabelnya`);
  }

  const f = mission(fix.missionId);
  ok(f.kind === 'sql' && f.fix !== undefined, 'contoh Perbaiki Query harus misi "fix"');
  if (f.kind === 'sql' && f.fix) {
    ok(fix.buggyCode === f.starterSql, 'contoh Perbaiki Query: buggyCode harus sama dengan query bermasalah di misinya');
    ok(fix.fixedCode === f.solutionSql, 'contoh Perbaiki Query: fixedCode harus sama dengan solusi misinya');
    ok(fix.bugCount === f.fix.bugCount && fix.bugs.length === f.fix.bugCount, `contoh Perbaiki Query: jumlah bug harus ${f.fix.bugCount}`);
    ok(fix.task.includes(String(f.fix.bugCount)), 'contoh Perbaiki Query: kalimat tugas harus menyebut jumlah bug');
    ok(fix.missionTitle === f.title && fix.xp === f.xpReward && fix.tierLabel === tierLabelOf(f), 'contoh Perbaiki Query: judul / XP / label tier tidak cocok');
    ok(run(db, fix.buggyCode).rows.length === 0, 'contoh Perbaiki Query: query bermasalah harus menghasilkan 0 baris (seperti keterangannya)');
    ok(same(run(db, fix.fixedCode), fix.result), 'contoh Perbaiki Query: tabel hasil tidak sama dengan hasil solusi');
    const buggyLines = fix.buggyCode.split('\n');
    const fixedLines = new Set(fix.fixedCode.split('\n'));
    ok(fix.bugs.every((bug) => bug.line >= 1 && bug.line <= buggyLines.length), 'contoh Perbaiki Query: nomor baris bug di luar kode');
    // Baris yang ditunjuk sebagai bug memang baris yang BERUBAH di perbaikannya (bukan sekadar "ada di dalam kode").
    ok(fix.bugs.every((bug) => !fixedLines.has(buggyLines[bug.line - 1] ?? '')), 'contoh Perbaiki Query: baris yang ditandai bug harus berbeda dari versi perbaikannya');
    ok(checkMission(SQL, f, fix.buggyCode).kind !== 'correct', 'contoh Perbaiki Query: query bermasalah tidak boleh dinilai benar');
  }

  const p = mission(predict.missionId);
  ok(p.kind === 'predict', 'contoh Tebak Hasil harus misi "predict"');
  if (p.kind === 'predict') {
    ok(predict.code === p.query, 'contoh Tebak Hasil: query harus sama dengan misinya');
    ok(predict.missionTitle === p.title && predict.xp === p.xpReward && predict.tierLabel === tierLabelOf(p), 'contoh Tebak Hasil: judul / XP / label tier tidak cocok');
    const correct = predict.options.filter((o) => o.correct);
    ok(correct.length === 1 && same(correct[0]?.table, run(db, p.query)), 'contoh Tebak Hasil: harus ada tepat satu pilihan benar dan tabelnya = hasil query');
    const wrongTables = predict.options.filter((o) => !o.correct).map((o) => JSON.stringify(o.table)).sort();
    const distractors = p.distractors.map((d) => JSON.stringify(run(db, d.sql))).sort();
    ok(same(wrongTables, distractors), 'contoh Tebak Hasil: pilihan salah harus sama dengan hasil pengecoh di misinya');
  }

  const i = mission(injection.missionId);
  ok(i.kind === 'injection', 'contoh Lab Injection harus misi "injection"');
  if (i.kind === 'injection') {
    ok(injection.missionTitle === i.title && injection.xp === i.xpReward && injection.tierLabel === tierLabelOf(i), 'contoh Lab Injection: judul / XP / label tier tidak cocok');
    ok(injection.formTitle === i.lab.formTitle && injection.inputLabel === i.lab.inputLabel, 'contoh Lab Injection: judul form / label input tidak cocok');
    ok(injection.payload === i.solutionPayload, 'contoh Lab Injection: payload harus contoh dari misinya');
    ok(injection.builtSql === buildVulnerableSql(i.lab, injection.payload), 'contoh Lab Injection: builtSql harus hasil penyambungan template rentan + payload');
    ok(injection.safeSql === i.lab.safeTemplate, 'contoh Lab Injection: safeSql harus template aman misinya');
    ok(run(db, injection.builtSql).rows.length === injection.vulnerable.rows, 'contoh Lab Injection: jumlah baris mode rentan tidak cocok');
    ok(run(db, injection.safeSql, [injection.payload]).rows.length === injection.safe.rows, 'contoh Lab Injection: jumlah baris mode aman tidak cocok');
  }

  ok(same(run(db, playground.code), playground.result), 'contoh Playground: tabel hasil tidak sama dengan hasil query');

  ok(readSource('src/components/MissionWorkspace.tsx').includes('Run &amp; Check') && content.PRACTICE.buttons.run === 'Run & Check', 'tombol "Run & Check" tidak cocok dengan aplikasi');
}

/**
 * Teks aplikasi yang DIKUTIP landing harus benar-benar ada di komponennya. Dicocokkan dengan pola yang spesifik
 * (label di daftar tab, nilai konstanta, isi tombol) pada berkas yang dimaksud — bukan "kata itu muncul di mana pun".
 */
function verifyAppLabels(ok: Check): void {
  const output = readSource('src/components/MissionOutput.tsx');
  // Nama TAB pembanding: entri `label: '…'` pada daftar TABS, dengan urutan yang sama (Perbedaan dulu).
  const tabLabels = [...output.matchAll(/\{ id: '(?:diff|actual|expected|compare)', label: '([^']+)' \}/g)].map((match) => match[1] ?? '');
  ok(same(Object.values(content.OUTPUT_TABS), tabLabels.slice(0, 3)), `OUTPUT_TABS harus sama (isi & urutan) dengan tiga tab pertama aplikasi: ${tabLabels.join(', ')}`);
  // JUDUL tabel hasil: konstanta bawaan di berkas yang sama.
  ok(output.includes(`DEFAULT_ACTUAL_LABEL = '${content.OUTPUT_CAPTIONS.yours}'`), `OUTPUT_CAPTIONS.yours "${content.OUTPUT_CAPTIONS.yours}" bukan judul tabel hasil di aplikasi`);
  ok(output.includes(`DEFAULT_EXPECTED_LABEL = '${content.OUTPUT_CAPTIONS.expected}'`), `OUTPUT_CAPTIONS.expected "${content.OUTPUT_CAPTIONS.expected}" bukan judul tabel pembanding di aplikasi`);
  // Kartu sukses.
  ok(output.includes(`successTitle = '${content.PRACTICE.verdict.correct}'`), `judul sukses "${content.PRACTICE.verdict.correct}" tidak sama dengan aplikasi`);
  const detail = content.PRACTICE.verdict.correctDetail.replace(/\.$/, '');
  ok(output.includes(`'${detail.charAt(0).toLowerCase()}${detail.slice(1)}'`), 'keterangan sukses harus kalimat aplikasi ("hasil cocok dengan Expected Output")');
  ok(content.STUCK.example.correctMessage === content.PRACTICE.verdict.correct && content.STUCK.example.correctDetail === content.PRACTICE.verdict.correctDetail, 'STUCK.example: judul/keterangan sukses harus sama dengan PRACTICE.verdict');

  // Mode di bilah atas layar jalur (dipakai mockup "Belajar di layar mana pun" dan menu Fitur).
  const header = readSource('src/components/Header.tsx');
  const modeLabels = [...header.matchAll(/mode: '[a-z]+', label: '([^']+)'(?:, shortLabel: '([^']+)')?/g)].map((match) => match[2] ?? match[1] ?? '');
  for (const label of [content.DEVICES.appLabels.missions, ...content.NAV.features.items.map((item) => item.label)]) {
    ok(modeLabels.includes(label), `mode "${label}" tidak ada di bilah mode aplikasi (${modeLabels.join(', ')})`);
  }
  ok(readSource('src/components/MissionList.tsx').includes(content.DEVICES.appLabels.missionMap), `"${content.DEVICES.appLabels.missionMap}" tidak ditemukan di src/components/MissionList.tsx`);

  // Tombol cadangan yang dikutip FAQ.
  const backup = readSource('src/components/progress/BackupCard.tsx');
  const faqText = content.FAQ.items.flatMap((item) => item.answer).join(' ');
  const quoted = [...faqText.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? '');
  for (const label of ['Ekspor ke file', 'Impor dari file']) {
    ok(quoted.includes(label) && backup.includes(label), `FAQ mengutip tombol "${label}" — harus ada di FAQ dan di src/components/progress/BackupCard.tsx`);
  }
  ok(quoted.includes(content.HERO.restore.action) && quoted.includes(content.SOON_LABEL), 'FAQ: kutipan "Pulihkan" dan "Segera" harus sama dengan label di Beranda');

  // Alat Playground.
  const toolSources: Record<string, string> = {
    'Urutan Eksekusi': 'src/components/exec/ExecStepsCard.tsx',
    Explain: 'src/components/PlaygroundWorkspace.tsx',
    'Lab Performa': 'src/components/perf/PerfLab.tsx',
  };
  for (const tool of content.PRACTICE.tabs.playground.tools) {
    const file = toolSources[tool.label];
    ok(file !== undefined && readSource(file).includes(tool.label), `alat Playground "${tool.label}" tidak ditemukan di komponennya`);
  }
  ok(header.includes(`label: '${content.PRACTICE.tabs.playground.title}'`), `judul "${content.PRACTICE.tabs.playground.title}" bukan nama mode Playground di aplikasi`);

  // Mode Ujian: soal hanya dari misi yang sudah terbuka — landing harus mengatakannya di tiga tempat.
  ok(readSource('src/components/exam/ExamSetup.tsx').includes('misi yang sudah terbuka'), 'aplikasi tidak lagi menyebut "misi yang sudah terbuka" di ExamSetup — periksa ulang klaim landing');
  const examNav = content.NAV.features.items.find((item) => item.href === content.ROUTES.exam);
  const jump = content.FAQ.items.find((item) => item.id === 'lompat');
  ok(
    /misi yang sudah (kamu buka|terbuka)/.test(content.FEATURES.tabs.exam.body) && /misi yang sudah (kamu buka|terbuka)/.test(examNav?.description ?? '') && /misi yang sudah terbuka/.test(jump?.answer.join(' ') ?? ''),
    'Mode Ujian: tab fitur, menu Fitur, dan FAQ "lompat" harus menyebut bahwa soal diambil dari misi yang sudah terbuka',
  );

  ok(content.FOOTER.tagline === PRODUCT_TAGLINE, 'FOOTER.tagline harus sama dengan PRODUCT_TAGLINE (src/platform/brand.ts)');
  // "Hari ini": angkanya total sepanjang riwayat, jadi kalimatnya tidak boleh mengaku "minggu ini"/"paling sering".
  const weaknessTitle = content.TODAY.weakness.title('Baris berlebih', 12);
  ok(!/minggu ini|paling sering/i.test(weaknessTitle) && weaknessTitle.includes('12'), `TODAY.weakness.title menyesatkan: "${weaknessTitle}"`);
  // FAQ internet: aplikasi belum bisa dibuka luring (tidak ada service worker) — jawabannya harus mulai dengan "Perlu".
  const internet = content.FAQ.items.find((item) => item.id === 'internet');
  const hasServiceWorker = /serviceWorker/.test(readSource('src/main.tsx'));
  ok(hasServiceWorker || /^Perlu/.test(internet?.answer[0] ?? ''), 'FAQ internet: tanpa service worker, jawabannya harus menyatakan bahwa internet diperlukan untuk memuat aplikasi');
  // Hero tidak boleh mengesankan kasus/datanya nyata (lihat DATA_NOTE).
  ok(!/sungguhan|nyata|asli/i.test(content.HERO.subtitle.tail), `HERO.subtitle.tail "${content.HERO.subtitle.tail}" mengesankan kasus nyata, padahal data latihan karangan`);
}

/** Angka cincin & kartu statistik tiap contoh keluaran, dihitung ulang dari database. */
const OUTCOME_FACTS: Record<string, { ring: [part: string, whole: string]; stats: [string, string] }> = {
  kunjungan: {
    ring: ["SELECT COUNT(*) FROM kunjungan WHERE status = 'Selesai'", 'SELECT COUNT(*) FROM kunjungan'],
    stats: ['SELECT COUNT(*) FROM kunjungan', 'SELECT COUNT(*) FROM poliklinik'],
  },
  bpjs: {
    ring: ["SELECT COUNT(*) FROM pasien WHERE penjamin = 'BPJS'", 'SELECT COUNT(*) FROM pasien'],
    stats: [
      "SELECT COUNT(*) FROM pasien WHERE penjamin = 'BPJS'",
      "SELECT COUNT(*) FROM kunjungan k JOIN pasien p ON k.no_rm = p.no_rm WHERE p.penjamin = 'BPJS' AND k.status <> 'Batal'",
    ],
  },
  tagihan: {
    ring: ["SELECT COUNT(*) FROM billing WHERE status_bayar = 'Lunas'", 'SELECT COUNT(*) FROM billing'],
    stats: ["SELECT SUM(total_biaya) FROM billing WHERE status_bayar = 'Lunas'", "SELECT SUM(total_biaya) FROM billing WHERE status_bayar = 'Belum Lunas'"],
  },
};

function verifyOutcomes(ok: Check, db: Database): void {
  const scalar = (sql: string): number => Number(run(db, sql).rows[0]?.[0]);
  /** "Rp 53.995.000" / "32" → angka. */
  const numberIn = (text: string): number => Number(text.replace(/[^\d]/g, ''));
  ok(content.OUTCOMES.slides.length >= 3, 'OUTCOMES: minimal tiga contoh');
  ok(/contoh/i.test(content.OUTCOMES.note), 'OUTCOMES.note harus menyatakan bahwa tampilan ini contoh');
  for (const slide of content.OUTCOMES.slides) {
    const bars = run(db, slide.sql).rows.map(([label, value]) => ({ label, value }));
    ok(same(slide.bars.items, bars), `OUTCOMES ${slide.id}: diagram batang tidak sama dengan hasil query-nya`);
    const facts = OUTCOME_FACTS[slide.id];
    ok(facts !== undefined, `OUTCOMES ${slide.id}: belum ada pemeriksa angka (tambahkan di OUTCOME_FACTS)`);
    if (!facts) continue;
    ok(slide.ring.part === scalar(facts.ring[0]) && slide.ring.whole === scalar(facts.ring[1]), `OUTCOMES ${slide.id}: angka cincin tidak cocok dengan database`);
    slide.stats.forEach((stat, index) => {
      const sql = facts.stats[index];
      if (sql !== undefined) ok(numberIn(stat.value) === scalar(sql), `OUTCOMES ${slide.id}: statistik "${stat.label}" (${stat.value}) tidak cocok dengan database`);
    });
  }
}

function verifyFeatures(ok: Check): void {
  const { streak, badges, weakness, exam, review } = content.FEATURES.tabs;
  // Kalender streak TIDAK ada di aplikasi (StreakState hanya menyimpan current/best/lastActiveDate): panelnya wajib
  // membawa keterangan ilustrasi, dan keterangan itu harus benar-benar dirender.
  const streakFields = /export interface StreakState \{([^}]+)\}/.exec(readSource('src/types.ts'))?.[1] ?? '';
  const storesDailyHistory = /\[\]|Record<|Set<|Map</.test(streakFields);
  ok(storesDailyHistory || (/ilustrasi/i.test(streak.calendar.note) && /tidak disimpan/.test(streak.calendar.note) && /ilustrasi/i.test(streak.calendar.caption)), 'kalender streak: aplikasi tidak menyimpan riwayat per hari — calendar.note & caption harus menyebutnya ilustrasi');
  const gamification = readSource('src/platform/landing/sections/Gamification.tsx');
  ok(gamification.includes('{calendar.note}') && gamification.includes('calendar.unknownLabel'), 'kalender streak: Gamification.tsx harus merender calendar.note dan memakai unknownLabel untuk angka pengguna sendiri');
  const days = streak.calendar.days;
  ok(days.length === 28 && streak.calendar.weekdays.length === 7, 'kalender streak: harus 28 hari dan 7 nama hari');
  let trailing = 0;
  for (let index = days.length - 1; index >= 0 && days[index] === true; index -= 1) trailing += 1;
  ok(trailing === streak.calendar.sampleStreak, `kalender streak: hari aktif berturut-turut terakhir ${trailing}, bukan ${streak.calendar.sampleStreak}`);

  for (const sample of badges.samples) {
    const real = ACHIEVEMENTS.find((a) => a.title === sample.title);
    ok(real !== undefined && real.icon === sample.icon && real.description === sample.text, `lencana contoh "${sample.title}" tidak cocok dengan src/lib/achievements.ts`);
  }
  const mistakeLabels = Object.values(MISTAKE_INFO).map((info) => info.label);
  for (const sample of weakness.samples) ok(mistakeLabels.includes(sample.label), `Peta Kelemahan: jenis kesalahan "${sample.label}" tidak ada di aplikasi`);

  for (const count of EXAM_COUNTS) ok(exam.body.includes(String(count)), `teks Mode Ujian harus menyebut pilihan ${count} soal`);
  for (const minutes of EXAM_MINUTES) if (minutes !== null) ok(exam.body.includes(String(minutes)), `teks Mode Ujian harus menyebut pilihan ${minutes} menit`);
  for (const interval of REVIEW_INTERVALS) ok(review.body.includes(String(interval)), `teks latihan ulang harus menyebut jarak ${interval} hari`);
}

function verifyStuck(ok: Check, SQL: SqlJsStatic, db: Database): void {
  const example = content.STUCK.example;
  const m = mission(example.missionId);
  ok(m.kind === 'sql', 'contoh "Macet?" harus misi SQL');
  if (m.kind !== 'sql') return;
  const check = checkMission(SQL, m, example.wrongCode);
  ok(check.kind === 'wrong', 'contoh "Macet?": query yang keliru harus dinilai salah');
  if (check.kind !== 'wrong') return;
  ok(check.compare.message.startsWith(example.wrongMessage), `contoh "Macet?": pesan aplikasi adalah "${check.compare.message}"`);
  ok(check.expected !== null && check.actual !== null, 'contoh "Macet?": harus ada tabel pembanding');
  if (check.expected === null || check.actual === null) return;
  const diff = diffResults(check.expected, check.actual, m.orderMatters);
  const rows = diff.rows.map((row) => ({ status: row.status, cells: row.cells.map(String) }));
  ok(same(example.diff.rows, rows), 'contoh "Macet?": baris tab Perbedaan tidak sama dengan hasil diff aplikasi');
  ok(same(example.diff.columns, diff.columns.map((column) => column.name)), 'contoh "Macet?": kolom tab Perbedaan tidak cocok');
  ok(same(example.summary, [`${diff.counts.same} baris sama`, `${diff.counts.extra} baris berlebih`]), 'contoh "Macet?": ringkasan perbedaan tidak cocok');
  const kind = classifyCheck(m, check);
  ok(kind !== null && MISTAKE_INFO[kind].label === example.mistakeKind, `contoh "Macet?": jenis kesalahan di aplikasi adalah "${kind === null ? '-' : MISTAKE_INFO[kind].label}"`);
  ok(m.hint[1] === example.hint && example.hintLabel === `Hint 2 dari ${m.hint.length}`, 'contoh "Macet?": hint harus hint kedua misinya');
  const wrongLines = example.wrongCode.split('\n');
  ok(example.wrongLine >= 1 && example.wrongLine <= wrongLines.length, 'contoh "Macet?": wrongLine di luar kode');
  const fixed = wrongLines.map((line, index) => (index === example.wrongLine - 1 ? example.fixedLine : line)).join('\n');
  ok(fixed === m.solutionSql && same(run(db, fixed), run(db, m.solutionSql)), 'contoh "Macet?": mengganti baris keliru dengan fixedLine harus menghasilkan solusi misinya');
  // mistakeNote adalah keterangan landing (bukan kutipan layar): cukup menyebut Peta Kelemahan dan diawali "Di aplikasi".
  ok(/^Di aplikasi/.test(example.mistakeNote) && example.mistakeNote.includes('Peta Kelemahan'), 'contoh "Macet?": mistakeNote harus keterangan ("Di aplikasi, … Peta Kelemahan …"), bukan tiruan teks layar');
  ok(content.STUCK.points.some((point) => point.text.includes(`${content.HINT_PENALTY_PERCENT}%`)), 'STUCK: harus menyebut penalti hint');
}

/* ------------------------------------------------------------------ */
/* Kata terlarang                                                      */
/* ------------------------------------------------------------------ */

/**
 * Hal yang TIDAK ada di aplikasi; landing tidak boleh menyebutnya (akun, jumlah pengguna, toko aplikasi, ijazah,
 * papan peringkat, teman, hadiah, asisten AI, testimoni, forum, streak freeze, narasi audio, kursus Python, durasi
 * belajar dalam jam). Diperiksa pada seluruh isi content.ts DAN semua berkas .tsx/.ts di src/platform/landing/**
 * (termasuk halaman katalog/landing jalur, data courses/, dan lib/pagesContent.ts) + Home.tsx + PlatformShell.tsx,
 * termasuk komentarnya — teks yang ditulis langsung di komponen ikut terjaring.
 */
export const FORBIDDEN: ReadonlyArray<[label: string, pattern: RegExp]> = [
  ['sertifikat', /sertifikat/i],
  ['App Store', /app\s*store/i],
  ['Google Play', /google\s*play|play\s*store/i],
  ['liga', /\bliga\b/i],
  ['LinkedIn', /linkedin/i],
  ['Tanya AI', /tanya\s+ai|asisten\s+ai|tutor\s+ai|dibantu\s+ai|chat\s*bot|kecerdasan\s+buatan|\bAI\b/],
  ['ijazah', /ijazah|piagam|kelulusan/i],
  ['testimoni', /testimoni|ulasan\s+(pengguna|pelajar)/i],
  ['komunitas', /komunitas|\bforum\b/i],
  ['pengguna aktif', /pengguna\s+aktif/i],
  ['iOS/Android', /\b(iOS|Android)\b/],
  ['negara', /negara/i],
  ['pelajar di', /pelajar\s+di|juta\s+(pelajar|pengguna|orang)|ribu\s+(pelajar|pengguna|orang)/i],
  ['rating', /\brating\b|bintang\s+\d|\d\s+bintang/i],
  ['peti hadiah', /peti\s+hadiah|\bhadiah\b/i],
  ['teman', /\bteman\b|ikuti\s+teman/i],
  ['papan peringkat', /papan\s+peringkat|leaderboard/i],
  ['login', /\blogin\b|\bmasuk\s+dengan\b|sudah\s+punya\s+akun|daftar\s+akun|buat\s+akun/i],
  ['unduh aplikasi', /unduh\s+aplikasi|aplikasi\s+(ponsel|android|ios)\b/i],
  ['terdaftar', /\bterdaftar\b/i],
  ['streak freeze', /streak\s*freeze|pembeku(an)?\s+streak|bekukan\s+streak/i],
  ['double or nothing', /double\s+or\s+nothing|taruhan\s+streak/i],
  ['narasi audio', /narasi\s+audio|audio\s+narasi|\bpodcast\b|dibacakan\s+(narator|pengisi\s+suara)/i],
  ['Python', /\bpython\b/i],
  ['chat', /\bchat\b|\bobrolan\b/i],
  ['asisten', /\basisten\b/i],
  ['peti', /\bpeti\b/i],
  ['bintang', /\bbintang\b/i],
  ['durasi jam', /\b\d+(?:[.,]\d+)?\s*(?:jam|hours?)\b/i],
];

function verifyWording(ok: Check): void {
  const source = readSource('src/platform/landing/lib/content.ts');
  for (const file of ['src/platform/Home.tsx', 'src/platform/PlatformShell.tsx', ...landingFiles()]) {
    const text = readSource(file);
    for (const [label, pattern] of FORBIDDEN) {
      const match = pattern.exec(text);
      ok(match === null, `${file} memuat kata terlarang "${label}" (ditemukan: "${match?.[0] ?? ''}") — landing tidak boleh menjanjikan hal yang tidak ada`);
    }
  }
  // content.ts murni data: tidak boleh mengimpor apa pun (terutama data misi/materi).
  ok(!/^\s*import\s/m.test(source), 'content.ts tidak boleh mengimpor modul lain (harus tetap data murni)');

  ok(content.FAQ.items.length >= 6, 'FAQ: minimal enam pertanyaan');
  ok(new Set(content.FAQ.items.map((item) => item.id)).size === content.FAQ.items.length, 'FAQ: id harus unik');
  for (const item of content.FAQ.items) ok(item.question.trim().endsWith('?') && item.answer.length > 0 && item.answer.every((p) => p.trim() !== ''), `FAQ ${item.id}: butuh pertanyaan dan jawaban`);
  ok(content.HERO.rotatingWords.length >= 4 && new Set(content.HERO.rotatingWords).size === content.HERO.rotatingWords.length, 'HERO.rotatingWords: minimal empat kata, tanpa duplikat');
  ok(content.HERO.subtitle.counts.map((c) => c.value).join() === [content.MISSION_COUNT, content.TIER_COUNT, content.ARTICLE_COUNT].join(), 'HERO.subtitle harus memakai jumlah misi, tier, dan materi');
  ok(content.MARQUEE.items.filter((item) => item.status === 'segera').length > 0 && content.MARQUEE.items.filter((item) => item.status === 'tersedia').length > 0, 'MARQUEE: harus memuat topik tersedia dan teknologi mendatang');
}

/* ------------------------------------------------------------------ */
/* Kontras warna (WCAG AA)                                             */
/* ------------------------------------------------------------------ */

export type ThemeName = 'light' | 'dark';
type Rgb = readonly [number, number, number];

/** Token per tema dari tokens.css: { light: { primary: [0,135,90], … }, dark: { … } } (token kode berlaku di keduanya). */
export function readTokens(): Record<ThemeName, Record<string, Rgb>> {
  const css = readSource('src/platform/landing/styles/tokens.css');
  const block = (selector: string): Record<string, Rgb> => {
    const start = css.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`tokens.css: blok ${selector} tidak ditemukan`);
    const body = css.slice(start, css.indexOf('\n}', start));
    const tokens: Record<string, Rgb> = {};
    for (const match of body.matchAll(/--q-([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
      tokens[match[1] ?? ''] = [Number(match[2]), Number(match[3]), Number(match[4])];
    }
    return tokens;
  };
  const shared = block('html[data-theme]');
  return { light: { ...block("html[data-theme='light']"), ...shared }, dark: { ...block("html[data-theme='dark']"), ...shared } };
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pasangan [teks, latar, rasio minimum, pemakaian]. 4.5 = teks biasa; 3 = batas kontrol/garis fokus (non-teks). */
export const CONTRAST_PAIRS: ReadonlyArray<readonly [fg: string, bg: string, min: number, use: string]> = [
  ['ink', 'bg', 4.5, 'teks utama di latar halaman'],
  ['ink', 'surface', 4.5, 'teks utama di kartu'],
  ['ink', 'muted', 4.5, 'teks utama di isian netral'],
  ['ink', 'tint', 4.5, 'teks utama di section mint'],
  ['ink', 'footer', 4.5, 'teks utama di footer'],
  ['ink-soft', 'bg', 4.5, 'teks sekunder di latar halaman'],
  ['ink', 'amber-soft', 4.5, 'pemberitahuan Beranda (latar amber lembut)'],
  ['ink', 'coral-soft', 4.5, 'peringatan Beranda (latar merah lembut)'],
  ['ink-soft', 'surface', 4.5, 'teks sekunder di kartu'],
  ['ink-soft', 'muted', 4.5, 'teks sekunder di isian netral (Pill neutral)'],
  ['ink-soft', 'tint', 4.5, 'teks sekunder di section mint'],
  ['ink-soft', 'footer', 4.5, 'teks sekunder di footer'],
  ['on-primary', 'primary', 4.5, 'teks tombol utama'],
  ['on-primary', 'primary-hover', 4.5, 'teks tombol utama saat disorot'],
  ['primary', 'on-primary', 4.5, 'angka di chip saringan katalog yang aktif (warna tombol utama dibalik)'],
  ['primary-ink', 'bg', 4.5, 'tautan/teks hijau di latar halaman'],
  ['primary-ink', 'surface', 4.5, 'teks tombol outline'],
  ['primary-ink', 'muted', 4.5, 'teks tombol outline saat disorot'],
  ['primary-ink', 'tint', 4.5, 'Pill primary; teks hijau di section mint'],
  ['primary-ink', 'footer', 4.5, 'tautan di footer'],
  ['brand-ink', 'bg', 4.5, 'teks teal di latar halaman'],
  ['brand-ink', 'tint', 4.5, 'teks teal di section mint'],
  ['brand-ink', 'footer', 4.5, 'wordmark kecil di footer'],
  ['amber-ink', 'bg', 4.5, 'teks amber (XP, streak) di latar halaman'],
  ['amber-ink', 'surface', 4.5, 'teks amber di kartu'],
  ['amber-ink', 'amber-soft', 4.5, 'Pill amber'],
  ['amber-ink', 'tint', 4.5, 'teks amber di section mint'],
  ['on-amber', 'amber', 4.5, 'teks di atas isian amber'],
  ['coral-ink', 'bg', 4.5, 'teks merah (gagal, boss) di latar halaman'],
  ['coral-ink', 'surface', 4.5, 'teks merah di kartu'],
  ['coral-ink', 'coral-soft', 4.5, 'Pill coral'],
  ['coral-ink', 'tint', 4.5, 'teks merah di section mint'],
  ['on-coral', 'coral-strong', 4.5, 'teks putih di atas isian merah'],
  ['success-ink', 'bg', 4.5, 'teks sukses di latar halaman'],
  ['success-ink', 'surface', 4.5, 'teks sukses di kartu'],
  ['success-ink', 'success-soft', 4.5, 'Pill success'],
  ['success-ink', 'tint', 4.5, 'teks sukses di section mint'],
  ['on-success', 'success', 4.5, 'teks di atas isian hijau sukses'],
  ['band-ink', 'band', 4.5, 'teks di pita marquee'],
  ['band-soft', 'band', 4.5, 'teks sekunder di pita marquee'],
  ['bg', 'ink', 4.5, 'teks terang di atas latar tinta (permukaan terbalik)'],
  ['code-ink', 'code-bg', 4.5, 'teks jendela kode'],
  ['code-ink', 'code-chrome', 4.5, 'tab aktif / bilah jendela kode'],
  ['code-ink', 'code-deep', 4.5, 'teks mockup layar jalur'],
  ['code-muted', 'code-bg', 4.5, 'nomor baris & teks sekunder jendela kode'],
  ['code-muted', 'code-chrome', 4.5, 'tab berkas tidak aktif'],
  ['code-muted', 'code-deep', 4.5, 'teks sekunder mockup layar jalur'],
  ['border-strong', 'bg', 3, 'batas kontrol di latar halaman'],
  ['border-strong', 'surface', 3, 'batas kontrol di kartu'],
  ['border-strong', 'tint', 3, 'batas kontrol di section mint'],
  ['focus', 'bg', 3, 'garis fokus di latar halaman'],
  ['focus', 'surface', 3, 'garis fokus di kartu'],
  ['focus', 'tint', 3, 'garis fokus di section mint'],
  ['focus', 'footer', 3, 'garis fokus di footer'],
  ['primary', 'bg', 3, 'isian hijau (indikator tab, ikon) terhadap latar'],
  ['amber-ink', 'bg', 3, 'cincin "Kamu di sini" di peta tier; tepi hari aktif kalender streak'],
  ['amber-ink', 'tint', 3, 'tepi penanda kota di bola dunia (bola mint)'],
  ['border-strong', 'muted', 3, 'kisi hari kosong kalender streak di panel fitur'],
];

/** Garis fokus di atas latar gelap tetap (kelas q-on-dark) = nilai --q-focus tema gelap. */
const ON_DARK_FOCUS: ReadonlyArray<readonly [bg: string, use: string]> = [
  ['band', 'garis fokus di pita marquee'],
  ['code-bg', 'garis fokus di jendela kode'],
  ['code-deep', 'garis fokus di mockup layar jalur'],
];

export interface ContrastRow {
  theme: ThemeName;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  use: string;
}

export function contrastTable(): ContrastRow[] {
  const tokens = readTokens();
  const rows: ContrastRow[] = [];
  for (const theme of ['light', 'dark'] as const) {
    const set = tokens[theme];
    for (const [fg, bg, min, use] of CONTRAST_PAIRS) {
      const a = set[fg];
      const b = set[bg];
      if (!a || !b) throw new Error(`tokens.css (${theme}): token "${!a ? fg : bg}" tidak ada`);
      rows.push({ theme, fg, bg, ratio: contrastRatio(a, b), min, use });
    }
    const focus = tokens.dark.focus;
    for (const [bg, use] of ON_DARK_FOCUS) {
      const b = set[bg];
      if (!focus || !b) throw new Error(`tokens.css (${theme}): token "${bg}" atau focus tidak ada`);
      rows.push({ theme, fg: 'focus (q-on-dark)', bg, ratio: contrastRatio(focus, b), min: 3, use });
    }
  }
  return rows;
}

function verifyContrast(ok: Check): void {
  const tokens = readTokens();
  ok(same(Object.keys(tokens.light).sort(), Object.keys(tokens.dark).sort()), 'tokens.css: tema terang dan gelap harus mendefinisikan token yang sama');
  // Setiap token warna terdaftar di tailwind.config.js (kelas q-…), dan sebaliknya.
  const tailwind = readSource('tailwind.config.js');
  const configured = new Set([...tailwind.matchAll(/q\('([a-z-]+)'\)/g)].map((match) => match[1] ?? ''));
  for (const name of Object.keys(tokens.light)) ok(configured.has(name), `tailwind.config.js: token "${name}" belum punya kelas q-${name}`);
  for (const name of configured) ok(tokens.light[name] !== undefined, `tokens.css: kelas q-${name} dipakai tailwind.config.js tetapi tokennya tidak ada`);
  for (const row of contrastTable()) {
    ok(row.ratio >= row.min, `kontras (${row.theme}) ${row.fg} di atas ${row.bg} = ${row.ratio.toFixed(2)}:1, butuh ≥ ${row.min}:1 — ${row.use}`);
  }
}

/* ------------------------------------------------------------------ */
/* Landing tetap ringan                                                */
/* ------------------------------------------------------------------ */

export function landingFiles(dir = 'src/platform/landing'): string[] {
  const absolute = fileURLToPath(new URL(`../../${dir}`, import.meta.url));
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return landingFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Halaman katalog/landing jalur dan data jalurnya (dimuat malas oleh shell): BOLEH mengimpor data misi/materi, tetapi
 * tetap tidak boleh menjangkau mesin SQL atau layar jalur. Bahwa berkas ini tidak terjangkau statis dari Beranda
 * diperiksa scripts/verify/courses.ts.
 */
export function isLazyPageFile(file: string): boolean {
  return file.startsWith('src/platform/landing/pages/') || file.startsWith('src/platform/landing/courses/');
}

/** Yang tidak boleh terjangkau statis dari halaman landing jalur: mesin SQL, WASM, worker, layar jalur, pustaka malas. */
export function isEngineItem(item: string): boolean {
  if (item.startsWith('?')) return true; // impor yang tidak bisa ditelusuri dianggap berbahaya
  if (item === 'sql.js' || item.includes('.wasm') || item === 'cobe' || item === 'canvas-confetti') return true;
  if (item === 'src/lib/sqlEngine.ts' || item === 'src/lib/sqlLoader.ts' || item === 'src/App.tsx') return true;
  if (item.startsWith('src/workers/') || item.startsWith('src/tracks/')) return true;
  return item.startsWith('src/components/') && item !== 'src/components/HighlightedCode.tsx';
}

function verifyLight(ok: Check): void {
  const files = landingFiles();
  ok(files.length > 0, 'berkas landing tidak ditemukan');
  for (const file of files) {
    if (isLazyPageFile(file)) {
      const engine = staticClosure(file).filter(isEngineItem);
      ok(engine.length === 0, `${file} (halaman malas) tidak boleh menjangkau mesin SQL/layar jalur — impor statis tak diizinkan: ${engine.join(', ')}`);
    } else {
      const heavy = staticClosure(file).filter((item) => !isLightFile(item) && !isLightPackage(item));
      ok(heavy.length === 0, `${file} harus tetap ringan — impor statis tak diizinkan: ${heavy.join(', ')} (muat malas dengan import())`);
    }
    // Tema landing hanya lewat token q-*: varian dark: Tailwind tidak dipakai.
    ok(!/(^|[\s"'`])dark:[a-z]/.test(readSource(file)), `${file}: jangan memakai varian dark: Tailwind di landing (pakai token q-*)`);
  }
  const html = readSource('index.html');
  ok(!/fonts\.(googleapis|gstatic)\.com/.test(html), 'index.html: font harus dari paket @fontsource, bukan Google Fonts');
  ok(/<html[^>]*class="dark"/.test(html), 'index.html: kelas "dark" pada <html> harus tetap ada (dipakai layar jalur)');
  // Skrip pra-gambar di index.html membaca kunci tema yang sama dengan useTheme (kalau berbeda, latar berkedip saat dibuka).
  ok(THEME_STORAGE_KEY === THEME_KEY && THEME_KEY.startsWith('simrs-quest:'), 'kunci tema harus THEME_KEY dari src/lib/storageKeys.ts (keluarga simrs-quest:*)');
  ok(html.includes(`localStorage.getItem('${THEME_KEY}')`), 'index.html: skrip tema harus membaca kunci THEME_KEY (src/lib/storageKeys.ts)');
  ok(/<html(?![^>]*data-theme)[^>]*>/.test(html), 'index.html: data-theme tidak boleh ditulis mati pada <html> (dipasang skrip/LandingRoot hanya di Beranda)');
}

/* ------------------------------------------------------------------ */

export function verifyLanding(SQL: SqlJsStatic): void {
  let checks = 0;
  const ok: Check = (cond, msg) => {
    checks += 1;
    assert(cond, `landing: ${msg}`);
  };
  const db = createSeededDatabase(SQL);
  try {
    verifyNumbers(ok);
    verifyDatabase(ok, db);
    verifyTracksAndRoutes(ok);
    verifyPractice(ok, SQL, db);
    verifyAppLabels(ok);
    verifyOutcomes(ok, db);
    verifyFeatures(ok);
    verifyStuck(ok, SQL, db);
    verifyWording(ok);
    verifyContrast(ok);
    verifyLight(ok);
  } finally {
    db.close();
  }
  console.log(`  ${checks} pemeriksaan landing (angka, database, jalur, contoh, label, kata, kontras, ringan) ✓`);
}
