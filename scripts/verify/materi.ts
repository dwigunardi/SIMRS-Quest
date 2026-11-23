/**
 * Verifikasi pustaka Materi (src/data/materi).
 *
 * - Bentuk: id unik kebab-case, ≥ 2 bagian, ≥ 1 contoh, ≥ 1 jebakan, ≥ 1 baris dialek dengan kelima dialek terisi.
 * - Tautan: setiap misi yang dirujuk ada; setiap misi (tier 1–8) punya ≥ 1 materi.
 * - Contoh tidak boleh memuat payload solusi lab injection, dan contoh Playground tidak boleh membuat index yang diminta
 *   misi 'index' yang ditautkan.
 * - Contoh `run: 'playground'` (DML/transaksi): berjalan di DB segar dan tidak menghasilkan kondisi tabel yang sama
 *   dengan solusi misi 'state' yang ditautkan.
 * - Contoh: setiap contoh dijalankan di DB seed segar → harus sukses, hanya membaca (SELECT/WITH), menghasilkan tabel
 *   tidak kosong dan ≤ 30 baris (ditampilkan di panel kiri).
 * - Anti-bocoran: hasil contoh TIDAK boleh sama dengan Expected Output misi yang ditautkan (materi mengajarkan konsep,
 *   bukan memberi jawaban), dan SQL contoh tidak boleh sama dengan solusi misi mana pun.
 */
import type { Database, SqlJsStatic } from 'sql.js';
import { ARTICLES } from '../../src/data/materi';
import { MISSIONS } from '../../src/data/missions';
import { compareResults } from '../../src/lib/compare';
import { ERROR_TOPICS, relatedArticleIds } from '../../src/lib/errorTopics';
import { searchArticles } from '../../src/lib/materiSearch';
import { createSeededDatabase, executeSql, isMutatingSql, stripCommentsAndStrings } from '../../src/lib/sqlEngine';
import { checkMission, runSolution } from '../../src/lib/validator';
import type { Mission, QueryResult, SqlDialect } from '../../src/types';
import { assert } from './report';

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DIALECTS: readonly SqlDialect[] = ['sqlite', 'sqlServer', 'mysql', 'postgresql', 'oracle'];
const MAX_EXAMPLE_ROWS = 30;
/** Semua misi sampai tier ini wajib punya materi. */
const COVERED_TIER = 10;
const READ_ONLY = /^\s*(?:SELECT|WITH|EXPLAIN\s+QUERY\s+PLAN)\b/i;

function normalize(sql: string): string {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').replace(/;\s*$/, '').trim().toLowerCase();
}

/** Expected Output misi untuk pembanding anti-bocoran (null jika tidak relevan). */
function expectedOf(SQL: SqlJsStatic, mission: Mission): QueryResult | null {
  if (mission.kind === 'sql' && (mission.grading?.type ?? 'result') === 'result') return runSolution(SQL, mission);
  if (mission.kind !== 'predict') return null;
  const db = createSeededDatabase(SQL);
  try {
    const outcome = executeSql(db, mission.query);
    return outcome.ok ? (outcome.results[outcome.results.length - 1] ?? null) : null;
  } finally {
    db.close();
  }
}

export function verifyMateri(SQL: SqlJsStatic): void {
  const missionById = new Map(MISSIONS.map((m) => [m.id, m] as const));
  const ids = ARTICLES.map((a) => a.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert(duplicates.length === 0, `materi: id tidak unik: ${duplicates.join(', ')}`);

  const solutions = new Set(MISSIONS.flatMap((m) => (m.kind === 'sql' ? [normalize(m.solutionSql)] : m.kind === 'predict' ? [normalize(m.query)] : [])));
  const expectedCache = new Map<string, QueryResult | null>();
  const expected = (mission: Mission) => {
    if (!expectedCache.has(mission.id)) expectedCache.set(mission.id, expectedOf(SQL, mission));
    return expectedCache.get(mission.id) ?? null;
  };

  const db = createSeededDatabase(SQL);
  let examples = 0;
  try {
    for (const article of ARTICLES) {
      const where = `materi ${article.id}`;
      assert(KEBAB.test(article.id), `${where}: id harus kebab-case`);
      assert(article.title.trim() !== '' && article.summary.trim() !== '', `${where}: judul/ringkasan kosong`);
      assert(article.sections.length >= 2, `${where}: minimal 2 bagian`);
      assert(article.sections.every((s) => s.heading.trim() !== '' && s.body.trim() !== ''), `${where}: ada bagian kosong`);
      assert(article.pitfalls.length >= 1 && article.pitfalls.every((p) => p.trim() !== ''), `${where}: minimal 1 jebakan umum`);
      assert(article.dialects.length >= 1, `${where}: minimal 1 baris perbandingan dialek`);
      for (const note of article.dialects) {
        assert(DIALECTS.every((d) => note.syntax[d].trim() !== ''), `${where}: dialek "${note.label}" belum lengkap`);
      }
      assert(article.missions.length >= 1, `${where}: belum ditautkan ke misi`);
      const linked = article.missions.flatMap((id) => {
        const mission = missionById.get(id);
        assert(mission !== undefined, `${where}: misi '${id}' tidak ada`);
        return mission ? [mission] : [];
      });

      const all = article.sections.flatMap((s) => s.examples ?? []);
      assert(all.length >= 1, `${where}: minimal 1 contoh yang bisa dijalankan`);
      for (const example of all) {
        examples += 1;
        const label = `${where} contoh "${example.title}"`;
        assert(!solutions.has(normalize(example.sql)), `${label}: SQL contoh sama dengan solusi misi`);
        for (const mission of linked) {
          if (mission.kind !== 'injection') continue;
          assert(!normalize(example.sql).includes(normalize(mission.solutionPayload)), `${label}: memuat payload solusi lab ${mission.id}`);
        }
        if (example.run === 'playground') {
          verifyPlaygroundExample(SQL, label, example.sql, linked);
          continue;
        }
        assert(READ_ONLY.test(stripCommentsAndStrings(example.sql)) && !isMutatingSql(example.sql), `${label}: contoh di tempat harus SELECT/WITH saja (pakai run: 'playground' untuk DML)`);
        const outcome = executeSql(db, example.sql);
        if (!outcome.ok) {
          assert(false, `${label}: gagal dijalankan: ${outcome.rawError}`);
          continue;
        }
        const result = outcome.results[outcome.results.length - 1];
        assert(result !== undefined && result.rows.length > 0, `${label}: hasil kosong`);
        if (!result) continue;
        assert(result.rows.length <= MAX_EXAMPLE_ROWS, `${label}: ${result.rows.length} baris, maksimal ${MAX_EXAMPLE_ROWS}`);
        for (const mission of linked) {
          const target = expected(mission);
          if (target) assert(!compareResults(target, result, false).match, `${label}: hasilnya sama dengan Expected Output misi ${mission.id} (membocorkan jawaban)`);
        }
      }
    }
  } finally {
    db.close();
  }

  const covered = new Set(ARTICLES.flatMap((a) => a.missions));
  // Boss Challenge sengaja tanpa materi khusus (diperiksa di curriculum.ts).
  const needsMateri = MISSIONS.filter((m) => m.tier <= COVERED_TIER && !(m.kind === 'sql' && m.boss));
  const uncovered = needsMateri.filter((m) => !covered.has(m.id)).map((m) => m.id);
  assert(uncovered.length === 0, `materi: misi tier 1–${COVERED_TIER} tanpa materi: ${uncovered.join(', ')}`);
  const tierMissions = needsMateri.length;
  const linkCases = verifyLinksAndSearch(SQL);
  console.log(
    `  ${ARTICLES.length} artikel, ${examples} contoh dijalankan, ${tierMissions - uncovered.length}/${tierMissions} misi tier 1–${COVERED_TIER} punya materi, ${linkCases} kasus tautan error & pencarian`,
  );
}

/** Error SQLite sungguhan → materi yang ditautkan di kartu error. */
const ERROR_CASES: ReadonlyArray<{ sql: string; article: string }> = [
  { sql: 'SELECT kota FROM pasien WHERE COUNT(*) > 1', article: 'having' },
  { sql: 'SELECT no_rm FROM pasien p JOIN kunjungan k ON p.no_rm = k.no_rm', article: 'inner-join' },
  { sql: 'SELECT no_rawat FROM billing WHERE ROW_NUMBER() OVER (ORDER BY no_rawat) = 1', article: 'window-peringkat' },
  { sql: 'COMMIT', article: 'transaksi' },
  { sql: "INSERT INTO poliklinik (id_poli, nama_poli, gedung) VALUES ('P01', 'Poli X', 'Gedung Z')", article: 'insert' },
  { sql: 'SELECT * FROM pasien WHERE no_rm IN (SELECT no_rm, nama FROM pasien)', article: 'subquery' },
  { sql: 'SELECT nama_pasien FROM pasien', article: 'select' },
  { sql: "CREATE TABLE r (id INTEGER PRIMARY KEY, nr TEXT REFERENCES kunjungan (no_rm)); INSERT INTO r (nr) VALUES ('RM-0001')", article: 'create-table' },
  { sql: 'ALTER TABLE billing ADD COLUMN metode TEXT NOT NULL', article: 'alter-table' },
  { sql: "CREATE VIEW v AS SELECT * FROM pasien; UPDATE v SET kota = 'Bogor'", article: 'view' },
  { sql: "INSERT INTO pasien (no_rm, nik, nama, jenis_kelamin, tgl_lahir, kota, penjamin) VALUES ('RM-0001', 'x', 'y', 'L', '2000-01-01', 'a', 'BPJS') ON CONFLICT (kota) DO NOTHING", article: 'upsert' },
  { sql: "SELECT json_extract('{\"nama\": }', '$.nama')", article: 'json' },
  { sql: "SELECT json_extract(payload, 'code.text') FROM satusehat_log", article: 'json' },
];

/** Pencarian: kata kunci → artikel yang harus muncul (pertama = harus di urutan teratas). */
const SEARCH_CASES: ReadonlyArray<{ query: string; top?: string; includes?: string }> = [
  { query: 'left join', top: 'left-join' },
  { query: 'HAVING', top: 'having' },
  { query: 'rollback', top: 'transaksi' },
  { query: 'TOP', includes: 'order-limit' },
  { query: 'NVL', includes: 'null' },
  { query: 'trigger', top: 'trigger' },
  { query: 'ON CONFLICT', top: 'upsert' },
  { query: 'MERGE', includes: 'upsert' },
  { query: 'foreign key', includes: 'create-table' },
  { query: 'json', top: 'json' },
  { query: 'group_concat', top: 'fungsi-teks' },
  { query: 'strftime', top: 'fungsi-tanggal' },
];

function verifyLinksAndSearch(SQL: SqlJsStatic): number {
  const known = new Set(ARTICLES.map((a) => a.id));
  for (const topic of ERROR_TOPICS) {
    for (const id of topic.articles) assert(known.has(id), `materi: pola error ${topic.pattern.source} merujuk artikel '${id}' yang tidak ada`);
  }
  const db = createSeededDatabase(SQL);
  try {
    for (const c of ERROR_CASES) {
      const outcome = executeSql(db, c.sql);
      if (outcome.ok) {
        assert(false, `materi: "${c.sql}" seharusnya error`);
        continue;
      }
      const ids = relatedArticleIds(outcome.rawError);
      assert(ids.includes(c.article), `materi: error "${outcome.rawError}" seharusnya menautkan '${c.article}', didapat [${ids.join(', ')}]`);
    }
  } finally {
    db.close();
  }
  for (const c of SEARCH_CASES) {
    const ids = searchArticles(ARTICLES, c.query).map((h) => h.article.id);
    if (c.top) assert(ids[0] === c.top, `materi: cari "${c.query}" → teratas '${ids[0] ?? '-'}', seharusnya '${c.top}'`);
    if (c.includes) assert(ids.includes(c.includes), `materi: cari "${c.query}" tidak menemukan '${c.includes}'`);
  }
  assert(searchArticles(ARTICLES, 'zzqx tidakada').length === 0, 'materi: pencarian kata acak seharusnya kosong');
  return ERROR_CASES.length + SEARCH_CASES.length + 1;
}

/** Ada index (dibuat user) di `table` yang kolom pertamanya `column`? */
function hasIndexOn(db: Database, table: string, column: string): boolean {
  const list = executeSql(db, `SELECT name FROM pragma_index_list('${table}') WHERE origin = 'c'`);
  if (!list.ok) return false;
  return (list.results[0]?.rows ?? []).some(([name]) => {
    const info = executeSql(db, `SELECT name FROM pragma_index_info('${String(name).replaceAll("'", "''")}') WHERE seqno = 0`);
    return info.ok && String(info.results[0]?.rows[0]?.[0] ?? '').toLowerCase() === column.toLowerCase();
  });
}

/**
 * Contoh pengubah data (dibuka di Playground): harus berjalan di DB segar, dan kondisi tabel sesudahnya tidak boleh
 * sama dengan hasil solusi misi 'state' yang ditautkan (contoh tidak boleh melakukan perubahan yang diminta misi).
 */
function verifyPlaygroundExample(SQL: SqlJsStatic, label: string, sql: string, linked: readonly Mission[]): void {
  const fresh = createSeededDatabase(SQL);
  try {
    const outcome = executeSql(fresh, sql);
    assert(outcome.ok, `${label}: gagal dijalankan di DB segar: ${outcome.ok ? '' : outcome.rawError}`);
    if (!outcome.ok) return;
    for (const mission of linked) {
      if (mission.kind === 'sql' && mission.grading?.type === 'index') {
        const { table, column } = mission.grading;
        assert(!hasIndexOn(fresh, table, column), `${label}: membuat index ${table}(${column}) yang diminta misi ${mission.id} (membocorkan jawaban)`);
      }
      // Misi DDL: contoh tidak boleh lolos penilaian bila disalin mentah sebagai jawaban.
      if (mission.kind === 'sql' && mission.grading?.type === 'schema') {
        const graded = checkMission(SQL, mission, sql);
        assert(graded.kind !== 'correct', `${label}: lolos penilaian misi ${mission.id} bila disalin sebagai jawaban (membocorkan jawaban)`);
        continue;
      }
      if (mission.kind !== 'sql' || mission.grading?.type !== 'state') continue;
      const after = executeSql(fresh, mission.grading.verifySql);
      const target = runSolution(SQL, mission);
      const state = after.ok ? after.results[after.results.length - 1] : undefined;
      if (state) assert(!compareResults(target, state, false).match, `${label}: kondisi tabel sama dengan hasil solusi misi ${mission.id} (membocorkan jawaban)`);
    }
  } finally {
    fresh.close();
  }
}
