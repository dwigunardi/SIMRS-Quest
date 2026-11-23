/**
 * Visualisasi EXPLAIN QUERY PLAN untuk Playground: baris plan mentah → pohon langkah yang
 * diklasifikasi (full scan, pencarian lewat index, index sementara, …) + penjelasan berbahasa
 * Indonesia + ringkasan & tips per statement.
 *
 * Murni (tanpa React/DOM) sehingga bisa diuji di Node (scripts/verify/planTree.ts).
 * Tidak pernah menjalankan query user: statement hanya di-prepare lalu di-EXPLAIN. Uji coba saran
 * CREATE INDEX / DDL dilakukan di salinan skema kosong (createShadow) di dalam SAVEPOINT yang selalu
 * di-ROLLBACK, sehingga isi & skema DB sesi tidak berubah. Catatan: EXPLAIN pada UPDATE/DELETE/INSERT
 * mengembalikan changes() koneksi ke 0 (perilaku SQLite); total_changes(), data, dan skema tetap.
 *
 * Format baris plan yang dikenali berdasarkan probe SQLite 3.54.1, mis.:
 *   SCAN pasien | SCAN k USING COVERING INDEX idx | SEARCH p USING INDEX idx (no_rm=?)
 *   SEARCH d USING INTEGER PRIMARY KEY (rowid=?) | SEARCH d USING AUTOMATIC COVERING INDEX (kota=?)
 *   SEARCH t (tanpa USING: MIN/MAX tanpa index = baca seluruh tabel)
 *   USE TEMP B-TREE FOR ORDER BY | BLOOM FILTER ON p (kota=?) | CO-ROUTINE x | MATERIALIZE x
 *   CORRELATED SCALAR SUBQUERY 1 | LIST SUBQUERY 1 | COMPOUND QUERY | MULTI-INDEX OR | INDEX 1
 *   SETUP | RECURSIVE STEP | RIGHT-JOIN kunjungan | SCAN CONSTANT ROW | SCAN (subquery-1)
 *   USING INDEX idx FOR IN-OPERATOR
 */
import type { Database, SqlJsStatic } from 'sql.js';
import type { PlanNode, PlanNodeKind, PlanReport, PlanRow, PlanSummary, PlanTableAccess, PlanTone, StatementPlan, TableInfo } from '../types';
import { NOT_FUNCTIONS } from './queryPlan';
import { EMPTY_QUERY_FAILURE, explainQueryPlan, isEmptySql, splitStatements, stripCommentsAndStrings } from './sqlEngine';
import { DML_TARGET, DML_VERBS, SIMPLE_IDENTIFIER, escapeRegex, filterText, mainVerb, normalizeSql, topLevelText, unique } from './plan/sqlText';
import {
  LIVE_PROBE_MAX_ROWS,
  type Prober,
  type SchemaContext,
  buildIndexSuggestion,
  buildSchemaContext,
  createShadow,
  ddlChangesSchema,
  suggestionHelps,
} from './plan/schema';
import { type NameScope, buildScope, expandViews } from './plan/names';
import { NAMED_INDEX, classifyDetail, describeIndex, parseAccess, rowsLabel } from './plan/classify';

/** Batas statement yang dianalisis per klik Explain (sisanya dilaporkan sebagai omittedCount). */
export const MAX_EXPLAINED_STATEMENTS = 20;

/* ------------------------------------------------------------------ */
/* Pohon                                                               */
/* ------------------------------------------------------------------ */

const NESTED_LOOP_NOTE = 'Langkah ini diulang untuk setiap baris dari langkah sebelumnya (nested loop JOIN).';
const CORRELATED_NOTE = 'Berada di dalam subquery berkorelasi, jadi diulang untuk setiap baris query luar.';
const FK_NOTE =
  'Ini pengecekan FOREIGN KEY otomatis yang dijalankan untuk SETIAP baris yang ditulis/diubah/dihapus, agar tidak ada baris anak yang kehilangan induknya.';
const EARLY_STOP_NOTE = 'Karena ada LIMIT dan tidak ada pengurutan di memori, pembacaan berhenti begitu jumlah baris LIMIT terpenuhi.';
const LIMIT_HEDGED_NOTE =
  'Ada LIMIT, jadi pembacaan berhenti begitu cukup baris yang lolos filter ditemukan — tetapi jika hanya sedikit (atau tidak ada) baris yang cocok, seluruhnya tetap ditelusuri.';

interface StatementInfo {
  sql: string;
  clean: string;
  verb: string;
  isDml: boolean;
  /** Tabel target INSERT/UPDATE/DELETE (huruf kecil), jika ada. */
  target: string | null;
  /** UPDATE … FROM (bisa ada JOIN di tingkat atas). */
  updateFrom: boolean;
  /** LIMIT tingkat atas tanpa agregasi/GROUP BY/DISTINCT/window/compound, dan bukan LIMIT negatif. */
  limitCandidate: boolean;
  /** Ada filter tingkat atas (WHERE atau JOIN) — LIMIT belum tentu menghentikan pembacaan lebih awal. */
  hasFilter: boolean;
}

const AGGREGATE_CALL = /\b(COUNT|SUM|AVG|MIN|MAX|TOTAL|GROUP_CONCAT|STRING_AGG)\s*\(/i;

function fromList(top: string): string {
  return /\bFROM\b([\s\S]*?)(?=\b(?:WHERE|GROUP|ORDER|LIMIT|HAVING|WINDOW|RETURNING)\b|$)/i.exec(top)?.[1] ?? '';
}

function statementInfo(sql: string, schema: SchemaContext): StatementInfo {
  const clean = normalizeSql(sql);
  const { verb, start } = mainVerb(clean);
  const top = topLevelText(clean, start);
  const target = DML_TARGET.exec(clean.slice(start))?.[1]?.toLowerCase() ?? null;
  const negativeLimit = /\bLIMIT\s*(?:[^,;]*?,\s*)?-\s*\d/i.test(top);
  const limitCandidate =
    verb === 'SELECT' &&
    /\bLIMIT\b/i.test(top) &&
    !negativeLimit &&
    !/\b(GROUP\s+BY|DISTINCT|UNION|INTERSECT|EXCEPT|OVER|WINDOW)\b/i.test(top) &&
    !AGGREGATE_CALL.test(top);
  const from = fromList(top);
  // Konservatif: filter di CTE/tabel turunan/view juga dihitung (SQLite sering meratakannya ke scan luar).
  const { viewText } = expandViews(clean, schema);
  const anywhere = `${clean} ; ${viewText}`;
  const hasFilter = /\b(?:WHERE|JOIN)\b/i.test(anywhere) || from.includes(',');
  const updateFrom = verb === 'UPDATE' && /\bSET\b[\s\S]*\bFROM\b/i.test(top);
  return { sql, clean, verb, isDml: DML_VERBS.has(verb), target, updateFrom, limitCandidate, hasFilter };
}

/** Tabel `t` terhubung FOREIGN KEY dengan tabel target DML (anak → target, target → induk, atau ke dirinya sendiri). */
function fkLinked(t: TableInfo, info: StatementInfo, schema: SchemaContext): boolean {
  const target = info.target;
  if (!target) return false;
  if (t.columns.some((c) => c.foreignKey?.table.toLowerCase() === target)) return true;
  const targetTable = schema.tables.get(target);
  return targetTable?.columns.some((c) => c.foreignKey?.table.toLowerCase() === t.name.toLowerCase()) ?? false;
}

/**
 * Baris plan yang tabelnya pasti (lewat nama index) "memesan" kemunculan alias ambigu lebih dulu, agar
 * baris SCAN tanpa index yang muncul lebih awal tidak mengambil kemunculan milik tabel itu.
 */
function reserveKnownAliases(rows: readonly PlanRow[], scope: NameScope, schema: SchemaContext): void {
  for (const row of rows) {
    const parsed = parseAccess(row.detail.trim(), schema);
    if (!parsed) continue;
    const indexName = NAMED_INDEX.exec(parsed.rest)?.[2];
    const owner = indexName ? schema.indexes.get(indexName.toLowerCase()) : undefined;
    if (!owner) continue;
    for (const raw of [parsed.alias, parsed.name]) {
      const entry = raw ? scope.aliases.get(raw.toLowerCase()) : undefined;
      if (!entry || unique(entry.all.map((o) => o.table)).length < 2) continue;
      const index = entry.remaining.findIndex((o) => o.table === owner.table.name);
      if (index !== -1) entry.remaining.splice(index, 1);
      break;
    }
  }
}

function buildPlanTree(rows: readonly PlanRow[], info: StatementInfo, schema: SchemaContext): PlanNode[] {
  const scope = buildScope(info.sql, schema);
  const noTempSort = !rows.some((r) => /^\s*USE TEMP B-TREE\b/i.test(r.detail));
  const stopsEarlyPossible = info.limitCandidate && noTempSort;
  /** DELETE / UPDATE tanpa FROM: tidak ada JOIN tingkat atas, jadi akses tingkat atas sesudah target = cek FK. */
  const noTopJoins = info.verb === 'DELETE' || (info.verb === 'UPDATE' && !info.updateFrom);
  const byId = new Map<number, { node: PlanNode; correlated: boolean; materializes: string | null }>();
  const roots: PlanNode[] = [];
  /** Jumlah langkah akses (bukan cek FK, bukan loop EXISTS) yang sudah muncul per parent — deteksi nested loop. */
  const accessCount = new Map<number, number>();
  let topAccessSeen = 0;
  /** Nama CTE/subquery yang hasilnya sudah dibuat oleh baris CO-ROUTINE/MATERIALIZE. */
  const materialized = new Set<string>();
  reserveKnownAliases(rows, scope, schema);

  for (const row of rows) {
    const parentEntry = byId.get(row.parent);
    const inside = new Set<string>();
    for (let a = parentEntry; a; a = byId.get(a.node.parent)) if (a.materializes) inside.add(a.materializes);
    const { correlated, access, suggestColumns, existsLoop, ...classified } = classifyDetail(row.detail, {
      scope,
      schema,
      nested: parentEntry !== undefined,
      clean: info.clean,
      cteResults: new Set([...materialized].filter((n) => !inside.has(n))),
    });
    const materializes = /^\s*(?:CO-ROUTINE|MATERIALIZE)\s+(\S+)\s*$/i.exec(row.detail)?.[1]?.toLowerCase() ?? null;
    if (materializes) materialized.add(materializes);
    const repeated = parentEntry ? parentEntry.node.repeated || parentEntry.correlated : false;
    const tableKey = classified.table?.toLowerCase() ?? null;
    const table = tableKey ? schema.tables.get(tableKey) : undefined;
    const topLevel = !parentEntry;
    const fkCheck =
      info.isDml &&
      access &&
      table !== undefined &&
      (!scope.mentioned.has(tableKey ?? '') || (noTopJoins && topLevel && topAccessSeen > 0 && fkLinked(table, info, schema)));
    if (access && topLevel) topAccessSeen += 1;
    const seen = accessCount.get(row.parent) ?? 0;
    const innerLoop = access && !fkCheck && seen > 0;
    if (access && !fkCheck && !existsLoop) accessCount.set(row.parent, seen + 1);
    const scanLike = classified.kind === 'full-scan' || classified.kind === 'index-scan';
    const outerScan = access && topLevel && !innerLoop && scanLike && !fkCheck;
    const stopsEarly = stopsEarlyPossible && !info.hasFilter && outerScan;
    const limitHedged = stopsEarlyPossible && info.hasFilter && outerScan;

    const notes = [classified.explanation];
    if (innerLoop) notes.push(NESTED_LOOP_NOTE);
    if (repeated && classified.kind !== 'structure') notes.push(CORRELATED_NOTE);
    if (fkCheck) notes.push(FK_NOTE);
    if (stopsEarly) notes.push(EARLY_STOP_NOTE);
    if (limitHedged) notes.push(LIMIT_HEDGED_NOTE);
    const multiplied = (innerLoop || repeated || fkCheck) && scanLike;

    let tone = classified.tone;
    let title = classified.title;
    let explanation = notes.join(' ');
    if (multiplied) tone = 'bad';
    else if (stopsEarly && classified.kind === 'index-scan') {
      tone = 'good';
      title = 'Baca index sesuai urutan';
      const indexLabel = classified.index ? `index ${classified.index}` : 'index';
      explanation = `Membaca ${indexLabel} sesuai urutan yang diminta dan berhenti begitu LIMIT terpenuhi — tidak perlu mengurutkan ulang dan tidak perlu membaca ${rowsLabel(classified.tableRows)}.`;
    }

    let suggestion: string | null = null;
    if (table && classified.kind === 'auto-index' && suggestColumns.length > 0) {
      suggestion = buildIndexSuggestion(table, suggestColumns, schema)?.sql ?? null;
    } else if (table && fkCheck && classified.kind === 'full-scan' && info.target) {
      const fkColumns = table.columns.filter((c) => c.foreignKey?.table.toLowerCase() === info.target).map((c) => c.name);
      if (fkColumns.length === 1) suggestion = buildIndexSuggestion(table, fkColumns, schema)?.sql ?? null;
    }

    const node: PlanNode = {
      ...classified,
      tone,
      title,
      explanation,
      suggestion,
      id: row.id,
      parent: row.parent,
      detail: row.detail,
      repeated,
      innerLoop,
      fkCheck,
      stopsEarly,
      children: [],
    };
    byId.set(row.id, { node, correlated, materializes });
    if (parentEntry) parentEntry.node.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function flattenPlan(roots: readonly PlanNode[]): PlanNode[] {
  const out: PlanNode[] = [];
  const visit = (node: PlanNode): void => {
    out.push(node);
    node.children.forEach(visit);
  };
  roots.forEach(visit);
  return out;
}

/**
 * Buang saran index yang ternyata tidak akan dipakai SQLite (diuji dalam SAVEPOINT yang di-rollback,
 * di salinan skema). Tanpa salinan skema, tabel besar tidak diuji (CREATE INDEX-nya mahal) dan sarannya
 * dibiarkan apa adanya.
 */
function dropUselessSuggestions(prober: Prober, sql: string, roots: readonly PlanNode[]): void {
  for (const node of flattenPlan(roots)) {
    if (!node.suggestion) continue;
    if (prober.live && (node.tableRows ?? 0) > LIVE_PROBE_MAX_ROWS) continue;
    const indexName = /^CREATE INDEX (\S+)/.exec(node.suggestion)?.[1];
    if (!indexName || !suggestionHelps(prober, sql, { sql: node.suggestion, indexName })) node.suggestion = null;
  }
}

/* ------------------------------------------------------------------ */
/* Ringkasan & tips                                                    */
/* ------------------------------------------------------------------ */

type AccessKind = PlanTableAccess['kind'];

const ACCESS_SEVERITY: Record<AccessKind, number> = {
  'rowid-search': 1,
  'index-search': 2,
  'index-scan': 3,
  'auto-index': 4,
  'full-scan': 5,
};

function isAccessKind(kind: PlanNodeKind): kind is AccessKind {
  return kind in ACCESS_SEVERITY;
}

const TONE_SEVERITY: Record<PlanTone, number> = { neutral: 0, info: 1, good: 2, warn: 3, bad: 4 };

function worseTone(a: PlanTone, b: PlanTone): PlanTone {
  return TONE_SEVERITY[b] > TONE_SEVERITY[a] ? b : a;
}

function collectTables(nodes: readonly PlanNode[]): PlanTableAccess[] {
  const byTable = new Map<string, PlanTableAccess>();
  for (const node of nodes) {
    if (!node.table || !isAccessKind(node.kind)) continue;
    const current = byTable.get(node.table);
    if (!current) {
      byTable.set(node.table, { table: node.table, kind: node.kind, tone: node.tone, rows: node.tableRows });
      continue;
    }
    if (ACCESS_SEVERITY[node.kind] > ACCESS_SEVERITY[current.kind]) current.kind = node.kind;
    current.tone = worseTone(current.tone, node.tone);
  }
  return [...byTable.values()];
}

function tableList(tables: readonly PlanTableAccess[]): string {
  return tables.map((t) => (t.rows === null ? t.table : `${t.table} (${t.rows} baris)`)).join(', ');
}

function isScanLike(node: PlanNode): boolean {
  return node.kind === 'full-scan' || node.kind === 'index-scan';
}

function headline(nodes: readonly PlanNode[], tables: readonly PlanTableAccess[]): string {
  const multiplied = nodes.filter((n) => isScanLike(n) && n.tone === 'bad' && n.table);
  if (multiplied.length > 0) {
    const names = unique(multiplied.map((n) => n.table ?? '')).join(', ');
    const per = multiplied.every((n) => n.fkCheck) ? 'baris yang ditulis/diubah/dihapus (pengecekan FOREIGN KEY)' : 'baris luar';
    return `${names} dibaca seluruhnya berulang kali — sekali untuk setiap ${per}. Ini pola paling mahal di query plan.`;
  }
  const fullScans = tables.filter((t) => t.kind === 'full-scan');
  if (fullScans.length > 0) {
    const scanNodes = nodes.filter((n) => n.kind === 'full-scan');
    const early = scanNodes.length > 0 && scanNodes.every((n) => n.stopsEarly);
    return early
      ? `Full table scan pada ${tableList(fullScans)}, tetapi pembacaan bisa berhenti lebih awal karena LIMIT.`
      : `Full table scan pada ${tableList(fullScans)}.`;
  }
  const autos = tables.filter((t) => t.kind === 'auto-index');
  if (autos.length > 0) {
    return `Tidak ada langkah SCAN tabel, tetapi setiap kali query dijalankan SQLite membaca seluruh ${tableList(autos)} untuk membangun index sementara.`;
  }
  const indexScans = tables.filter((t) => t.kind === 'index-scan' && t.tone !== 'good');
  if (indexScans.length > 0) {
    return `Tidak ada langkah SCAN tabel, tetapi seluruh index ditelusuri dari awal sampai akhir pada ${tableList(indexScans)}.`;
  }
  const sorts = nodes.some((n) => n.kind === 'temp-btree');
  if (tables.length > 0 && sorts) return 'Semua tabel dicari lewat index, tetapi hasilnya masih diurutkan/dikelompokkan di memori.';
  if (nodes.some((n) => n.kind === 'index-scan' && n.stopsEarly)) {
    return 'Index dibaca sesuai urutan yang diminta dan berhenti setelah LIMIT — tidak perlu mengurutkan ulang.';
  }
  if (tables.length > 0) return 'Semua tabel dicari lewat index — tidak ada yang dibaca seluruhnya.';
  if (sorts) return 'Tidak membaca tabel fisik secara langsung, tetapi ada pengurutan/pengelompokan di memori.';
  return 'Statement ini tidak membaca tabel fisik (hanya konstanta, subquery, atau hasil CTE).';
}

const AGGREGATE_NAMES: ReadonlySet<string> = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'TOTAL', 'GROUP_CONCAT', 'STRING_AGG']);

/**
 * Fungsi (bukan agregat) yang membungkus `column` di teks filter. Kolom yang diberi qualifier tabel lain
 * (mis. p.no_rm saat yang di-scan adalah kunjungan k) diabaikan.
 */
function wrappingFunctionOn(filters: string, column: string, qualifiers: ReadonlySet<string>): string | null {
  const pattern = new RegExp(
    `\\b([A-Za-z_][A-Za-z0-9_]*)\\s*\\(\\s*(?:''\\s*,\\s*)*(?:([A-Za-z_][A-Za-z0-9_]*)\\.)?${escapeRegex(column)}\\b`,
    'gi',
  );
  for (const match of filters.matchAll(pattern)) {
    const name = match[1];
    const qualifier = match[2];
    if (!name) continue;
    const upper = name.toUpperCase();
    if (NOT_FUNCTIONS.has(upper) || AGGREGATE_NAMES.has(upper)) continue;
    if (qualifier !== undefined && !qualifiers.has(qualifier.toLowerCase())) continue;
    return name;
  }
  return null;
}

function wrappedIndexTips(filters: string, nodes: readonly PlanNode[], schema: SchemaContext): string[] {
  const tips: string[] = [];
  for (const node of nodes) {
    if (node.kind !== 'full-scan' || !node.table) continue;
    const table = schema.tables.get(node.table.toLowerCase());
    if (!table) continue;
    const qualifiers = new Set([table.name.toLowerCase(), (node.object ?? table.name).toLowerCase()]);
    for (const index of table.indexes) {
      const column = index.columns[0];
      if (!column || index.partial) continue;
      const fn = wrappingFunctionOn(filters, column, qualifiers);
      if (!fn) continue;
      tips.push(
        `Kolom ${column} dibungkus fungsi ${fn}(…) di filter, sehingga ${describeIndex(index.name, { table, index })} tidak bisa dipakai untuk mencari. Tulis ulang filternya tanpa membungkus kolom, mis. sebagai rentang ${column} >= '…' AND ${column} < '…'.`,
      );
    }
  }
  return tips;
}

/** Pisah di koma tingkat atas (isi kurung sudah dikosongkan oleh topLevelText). */
function splitCommas(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Ekspresi yang diberi alias `name` (… AS name) di mana pun di statement (termasuk badan CTE/subquery). */
function aliasExpressions(clean: string, name: string): string[] {
  const out: string[] = [];
  for (const match of clean.matchAll(new RegExp(`\\bAS\\s+${escapeRegex(name)}\\b`, 'gi'))) {
    let depth = 0;
    let i = (match.index ?? 0) - 1;
    for (; i >= 0; i--) {
      const ch = clean[i];
      if (ch === ')') depth += 1;
      else if (ch === '(') {
        if (depth === 0) break;
        depth -= 1;
      } else if (depth === 0 && ch === ',') break;
      else if (depth === 0 && /\bSELECT\s*$/i.test(clean.slice(Math.max(0, i - 6), i + 1))) break;
    }
    out.push(clean.slice(i + 1, match.index ?? 0));
  }
  return out;
}

/**
 * true jika kunci ORDER BY pertama (tingkat atas) adalah hasil hitungan (agregat/window), mis.
 * `ORDER BY jumlah_kunjungan` dengan `COUNT(…) AS jumlah_kunjungan` — tidak ada index yang bisa menyediakan urutannya.
 */
function orderByIsComputed(top: string, clean: string): boolean {
  const clause = /\bORDER\s+BY\b([\s\S]*?)(?=\bLIMIT\b|$)/i.exec(top)?.[1];
  if (!clause) return false;
  const selectList = /^\s*SELECT\b(?:\s+(?:DISTINCT|ALL)\b)?([\s\S]*?)\bFROM\b/i.exec(top)?.[1] ?? '';
  const items = splitCommas(selectList);
  const aliases = new Map<string, string>();
  for (const item of items) {
    const match = /^([\s\S]*?)\s+(?:AS\s+)?([A-Za-z_][A-Za-z0-9_]*)$/i.exec(item);
    if (match?.[1] && match[2]) aliases.set(match[2].toLowerCase(), match[1]);
  }
  const terms = splitCommas(clause).map((t) => t.replace(/\s+(?:COLLATE\s+\w+|ASC|DESC|NULLS\s+(?:FIRST|LAST))\b[\s\S]*$/i, '').trim());
  const isComputed = (expression: string): boolean => AGGREGATE_CALL.test(expression) || /\bOVER\b/i.test(expression);
  const computed = (term: string): boolean => {
    const bare = term.replace(/^[A-Za-z_][A-Za-z0-9_]*\./, '');
    const expression = /^\d+$/.test(bare) ? (items[Number(bare) - 1] ?? bare) : (aliases.get(bare.toLowerCase()) ?? bare);
    if (isComputed(expression)) return true;
    // Alias yang didefinisikan di CTE/tabel turunan (mis. COUNT(*) AS jml di WITH t AS (…), lalu ORDER BY t.jml).
    return SIMPLE_IDENTIFIER.test(bare) && aliasExpressions(clean, bare).some(isComputed);
  };
  // Cukup kunci pertama: bila kunci utama hasil hitungan, tidak ada index yang bisa menyediakan urutannya.
  const first = terms[0];
  return first !== undefined && computed(first);
}

const LIKE_TIP =
  "Di SQLite, LIKE (yang tidak peka huruf besar/kecil) tidak bisa memakai index biasa. Agar pencarian awalan memakai index: (1) buat index dengan COLLATE NOCASE, mis. CREATE INDEX idx_pasien_nama_nocase ON pasien (nama COLLATE NOCASE), sehingga LIKE 'abc%' bisa memakainya; atau (2) pakai rentang kolom >= 'Abc' AND kolom < 'Abd' — tetapi rentang ini PEKA huruf besar/kecil, jadi hurufnya harus persis sama dengan data.";

function summarizePlan(roots: readonly PlanNode[], info: StatementInfo, schema: SchemaContext): PlanSummary {
  const nodes = flattenPlan(roots);
  const tables = collectTables(nodes);
  const tone = nodes.reduce<PlanTone>((acc, n) => worseTone(acc, n.tone), 'neutral');
  const filters = filterText(info.clean);
  const top = topLevelText(info.clean, mainVerb(info.clean).start);
  const tips: string[] = [];

  const fullScans = nodes.filter((n) => n.kind === 'full-scan');
  /** "SEARCH t" tanpa USING = MIN/MAX tanpa index. */
  const minMaxScans = fullScans.filter((n) => /^\s*SEARCH\b/i.test(n.detail));
  const multiplied = nodes.filter((n) => isScanLike(n) && n.tone === 'bad');
  const sorted = nodes.some((n) => n.kind === 'temp-btree');
  if (fullScans.length > 0) {
    tips.push(...wrappedIndexTips(filters, nodes, schema));
    if (/\bLIKE\b/i.test(filters)) tips.push(LIKE_TIP);
    if (/\bOR\b/i.test(filters)) {
      tips.push('Kondisi OR antar kolom hanya bisa memakai index jika SETIAP sisi OR punya index sendiri (terlihat sebagai MULTI-INDEX OR). Jika satu sisi tidak ber-index, SQLite memilih full scan.');
    }
  }
  if (minMaxScans.length > 0) {
    tips.push('MIN/MAX tanpa index membaca seluruh tabel. Index pada kolom yang dicari MIN/MAX-nya membuat SQLite cukup membaca satu entri di ujung index.');
  }
  for (const node of multiplied) {
    const name = node.table ?? node.object ?? 'Tabel';
    if (node.fkCheck) {
      tips.push(
        `Pengecekan FOREIGN KEY ke ${name} membaca ${rowsLabel(node.tableRows)} untuk SETIAP baris yang ditulis/diubah/dihapus. Index pada kolom FOREIGN KEY di ${name} mengubahnya menjadi SEARCH${node.suggestion ? `: ${node.suggestion}` : '.'}`,
      );
    } else {
      const what = node.kind === 'index-scan' ? `seluruh index ${node.index ?? ''}`.trim() : rowsLabel(node.tableRows);
      tips.push(
        `${name} dibaca ${what} untuk SETIAP baris langkah luarnya, jadi biayanya ≈ jumlah baris luar × jumlah baris tabel ini. Jika ada kondisi JOIN/korelasi, index pada kolom itu akan mengubah langkah ini menjadi SEARCH.`,
      );
    }
  }

  const limitHedged = info.limitCandidate && info.hasFilter && !sorted && roots.some((n) => isScanLike(n) && !n.fkCheck);
  if (nodes.some((n) => n.stopsEarly)) {
    tips.push('Ada LIMIT tanpa pengurutan di memori: pembacaan berhenti begitu jumlah baris LIMIT terpenuhi, jadi yang dibaca bisa jauh lebih sedikit dari seluruh tabel. Jika ditambah ORDER BY pada kolom tanpa index, semua baris harus dibaca dulu untuk diurutkan.');
  } else if (limitHedged) {
    tips.push('Ada LIMIT, tetapi juga ada filter: pembacaan berhenti begitu cukup baris yang LOLOS filter ditemukan. Jika barisnya jarang (atau tidak ada) yang cocok, seluruh tabel tetap dibaca — index pada kolom filter tetap penting.');
  } else if (fullScans.length > minMaxScans.length && multiplied.length === 0) {
    const from = fromList(top);
    const noFilter = !/\bWHERE\b/i.test(top) && !/\bJOIN\b/i.test(from) && !from.includes(',') && !/\bLIMIT\b/i.test(info.clean);
    if (noFilter) {
      tips.push('Query tanpa WHERE memang harus membaca semua baris, jadi full scan di sini wajar.');
    } else {
      tips.push('Full scan di tabel kecil (puluhan baris) tetap cepat, tetapi di tabel produksi berisi jutaan baris ini penyebab query lambat paling umum. Jika query memfilter atau JOIN lewat kolom tertentu, coba buat index pada kolom itu, klik Run, lalu Explain lagi.');
    }
  }

  for (const node of nodes) {
    if (node.kind === 'auto-index' && node.suggestion) {
      tips.push(`Index sementara untuk ${node.table ?? node.object ?? 'tabel'} dibangun ulang setiap query dijalankan. Index permanen menghemat langkah itu: ${node.suggestion}`);
    }
  }

  const sortPurposes = nodes.filter((n) => n.kind === 'temp-btree').map((n) => n.detail);
  if (sortPurposes.some((d) => /ORDER BY/i.test(d))) {
    tips.push(
      orderByIsComputed(top, info.clean)
        ? 'Urutan ORDER BY di sini berasal dari hasil hitungan (COUNT/SUM/AVG/window) — nilainya baru ada setelah dihitung, jadi tidak ada index yang bisa menghilangkan langkah pengurutan ini. Pada hasil yang sudah dikelompokkan, ini wajar.'
        : 'Index pada kolom ORDER BY (atau index komposit kolom WHERE + ORDER BY) bisa menghilangkan langkah pengurutan, karena data dibaca sudah dalam keadaan urut.',
    );
  }
  if (sortPurposes.some((d) => /GROUP BY/i.test(d))) {
    tips.push('Index pada kolom GROUP BY memungkinkan SQLite membaca baris yang sudah berkelompok tanpa B-tree sementara.');
  }
  if (nodes.some((n) => n.kind === 'index-scan' && n.tone !== 'good')) {
    tips.push('SCAN … USING INDEX tetap membaca seluruh entri index — bukan pencarian. Pencarian sungguhan terlihat sebagai SEARCH dengan syarat dalam kurung, mis. (no_rm=?).');
  }

  const fkTables = unique(nodes.filter((n) => n.fkCheck && n.table).map((n) => n.table ?? ''));
  if (fkTables.length > 0) {
    tips.push(
      `Langkah untuk ${fkTables.join(', ')} adalah pengecekan FOREIGN KEY otomatis: SQLite memastikan tidak ada baris anak yang kehilangan induknya (DELETE/UPDATE) atau induknya memang ada (INSERT/UPDATE).`,
    );
  }

  return { tone, headline: headline(nodes, tables), tables, tips: unique(tips) };
}

/* ------------------------------------------------------------------ */
/* Explain satu skrip                                                  */
/* ------------------------------------------------------------------ */

/** Membuang komentar, spasi, dan titik koma kosong di depan statement. */
export function stripLeadingComments(sql: string): string {
  let rest = sql;
  for (;;) {
    const trimmed = rest.replace(/^[\s;]+/, '');
    if (trimmed.startsWith('--')) {
      const end = trimmed.indexOf('\n');
      rest = end === -1 ? '' : trimmed.slice(end + 1);
      continue;
    }
    if (trimmed.startsWith('/*')) {
      const end = trimmed.indexOf('*/');
      rest = end === -1 ? '' : trimmed.slice(end + 2);
      continue;
    }
    return trimmed;
  }
}

const LEADING_EXPLAIN = /^EXPLAIN(?:\s+QUERY\s+PLAN)?\s+/i;

function noPlanReason(verb: string): string {
  if (['CREATE', 'DROP', 'ALTER', 'REINDEX', 'VACUUM', 'ANALYZE'].includes(verb)) {
    return 'Perintah DDL/pemeliharaan mengubah struktur database, tidak membaca baris tabel — jadi tidak punya query plan.';
  }
  if (['BEGIN', 'COMMIT', 'END', 'ROLLBACK', 'SAVEPOINT', 'RELEASE'].includes(verb)) {
    return 'Perintah transaksi tidak membaca tabel — jadi tidak punya query plan.';
  }
  if (verb === 'INSERT' || verb === 'REPLACE') {
    return 'INSERT … VALUES langsung menulis baris baru tanpa membaca tabel — jadi tidak ada langkah plan.';
  }
  return 'Statement ini tidak menghasilkan langkah query plan.';
}

interface ExplainContext {
  db: Database;
  schema: SchemaContext;
  prober: Prober;
}

function explainStatement(ctx: ExplainContext, core: string, index: number, afterUnappliedDdl: boolean): StatementPlan {
  const sql = core.replace(LEADING_EXPLAIN, '');
  const outcome = explainQueryPlan(ctx.db, sql);
  if (!outcome.ok) return { status: 'error', index, sql, rawError: outcome.rawError, friendlyError: outcome.friendlyError };

  const info = statementInfo(sql, ctx.schema);
  const result = outcome.results[0];
  const col = (name: string) => result?.columns.indexOf(name) ?? -1;
  const [idCol, parentCol, detailCol] = [col('id'), col('parent'), col('detail')];
  const rows: PlanRow[] = (result?.rows ?? []).map((row) => ({
    id: Number(row[idCol] ?? 0),
    parent: Number(row[parentCol] ?? 0),
    detail: String(row[detailCol] ?? ''),
  }));
  if (rows.length === 0) return { status: 'no-plan', index, sql, reason: noPlanReason(info.verb) };

  const roots = buildPlanTree(rows, info, ctx.schema);
  dropUselessSuggestions(ctx.prober, sql, roots);
  return { status: 'plan', index, sql, roots, rows, summary: summarizePlan(roots, info, ctx.schema), afterUnappliedDdl };
}

const PRAGMA_FAILURE: PlanReport = {
  ok: false,
  rawError: 'PRAGMA tidak didukung oleh Explain',
  friendlyError:
    'Explain tidak menganalisis skrip yang berisi PRAGMA, karena sebagian PRAGMA sudah berlaku saat statement di-parse (Explain dijanjikan tidak mengubah isi maupun struktur database). Hapus statement PRAGMA dari editor, lalu klik Explain lagi.',
};

const SCHEMA_CHANGING_VERBS: ReadonlySet<string> = new Set(['CREATE', 'DROP', 'ALTER']);

/**
 * EXPLAIN QUERY PLAN untuk setiap statement di skrip (query-nya TIDAK dijalankan).
 * Statement yang gagal di-parse menghentikan analisis (statement sesudahnya tidak bisa dipisahkan).
 * `SQL` (modul sql.js) dipakai untuk membuat salinan skema tempat uji coba saran index/DDL; tanpa itu,
 * uji coba dilakukan di DB sesi dalam SAVEPOINT yang di-rollback (tabel besar dilewati).
 * Tidak pernah melempar exception — dipanggil langsung dari event handler UI.
 */
export function explainScript(db: Database, sql: string, SQL: SqlJsStatic | null = null): PlanReport {
  let shadow: Database | null = null;
  try {
    if (isEmptySql(sql)) return EMPTY_QUERY_FAILURE;
    if (/\bPRAGMA\b/i.test(stripCommentsAndStrings(sql))) return PRAGMA_FAILURE;

    const schema = buildSchemaContext(db);
    shadow = SQL ? createShadow(SQL, db) : null;
    const prober: Prober = { db: shadow ?? db, live: shadow === null, cache: new Map() };
    const ctx: ExplainContext = { db, schema, prober };
    const split = splitStatements(db, sql);
    const analyzed = split.statements.slice(0, MAX_EXPLAINED_STATEMENTS);
    let ddlBefore = false;
    const statements = analyzed.map((stmt, i) => {
      const core = stripLeadingComments(stmt);
      const plan = explainStatement(ctx, core, i + 1, ddlBefore);
      const verb = mainVerb(normalizeSql(core)).verb;
      if (!ddlBefore && SCHEMA_CHANGING_VERBS.has(verb) && ddlChangesSchema(prober, core)) ddlBefore = true;
      return plan;
    });
    const omittedCount = split.statements.length - analyzed.length;

    const showError = split.error !== null && omittedCount === 0;
    if (split.error && showError) {
      statements.push({
        status: 'error',
        index: split.statements.length + 1,
        sql: stripLeadingComments(split.error.sql),
        rawError: split.error.rawError,
        friendlyError: split.error.friendlyError,
      });
    }
    return { ok: true, statements, omittedCount, stoppedAtError: showError, errorAfterLimit: split.error !== null && !showError };
  } catch (err) {
    const rawError = err instanceof Error ? err.message : String(err);
    return { ok: false, rawError, friendlyError: `Explain gagal dijalankan karena kesalahan tak terduga: ${rawError}` };
  } finally {
    shadow?.close();
  }
}
