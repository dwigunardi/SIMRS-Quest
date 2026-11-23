/**
 * Pemeriksaan DDL untuk grading 'schema' (Tier 9): fakta struktur objek (tabel/view/trigger), perbandingannya dengan
 * hasil solusi, dan uji perilaku (probe) yang harus diterima/ditolak sama seperti di DB solusi.
 *
 * Prinsip: struktur yang bisa dibaca dengan pasti (kolom, afinitas tipe, NOT NULL, PK, FK, UNIQUE) dibandingkan
 * langsung; aturan yang bisa ditulis dengan banyak cara (CHECK, DEFAULT, isi trigger) dinilai dari PERILAKUNYA lewat probe.
 */
import type { Database } from 'sql.js';
import type { CellValue, QueryResult, SchemaObjectType, SchemaProbe } from '../types';
import { executeSql } from './sqlEngine';

export type SqliteAffinity = 'INTEGER' | 'TEXT' | 'BLOB' | 'REAL' | 'NUMERIC';

/** Aturan afinitas tipe SQLite (https://sqlite.org/datatype3.html §3.1), urutan pemeriksaan penting. */
export function affinityOf(declaredType: string): SqliteAffinity {
  const t = declaredType.toUpperCase();
  if (t.includes('INT')) return 'INTEGER';
  if (t.includes('CHAR') || t.includes('CLOB') || t.includes('TEXT')) return 'TEXT';
  if (t.includes('BLOB') || t.trim() === '') return 'BLOB';
  if (t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB')) return 'REAL';
  return 'NUMERIC';
}

export interface ColumnFacts {
  name: string;
  declaredType: string;
  affinity: SqliteAffinity;
  notNull: boolean;
  /** Posisi di PRIMARY KEY (1, 2, …) atau 0. */
  pk: number;
}

export interface TableFacts {
  type: 'table';
  columns: ColumnFacts[];
  /** "kolom -> tabel(kolom) ON DELETE aksi", huruf kecil. */
  foreignKeys: string[];
  /**
   * Set kolom yang UNIQUE (constraint UNIQUE atau CREATE UNIQUE INDEX, di luar PRIMARY KEY), mis. "hari, id_dokter".
   * Kolom diurutkan abjad: untuk keunikan, UNIQUE (a, b) dan UNIQUE (b, a) adalah aturan yang sama.
   */
  uniques: string[];
}

export type ObjectFacts = TableFacts | { type: 'view' } | { type: 'trigger'; table: string } | { type: 'index' };

type Row = Record<string, CellValue | undefined>;

function rows(db: Database, sql: string): Row[] {
  const outcome = executeSql(db, sql);
  if (!outcome.ok) return [];
  const result = outcome.results[0];
  if (!result) return [];
  return result.rows.map((row) => Object.fromEntries(result.columns.map((c, i) => [c, row[i]])));
}

/** Nilai sel PRAGMA sebagai teks ('' untuk NULL/BLOB). */
function text(value: CellValue | undefined): string {
  if (typeof value === 'string') return value;
  return typeof value === 'number' ? String(value) : '';
}

const byText = (a: string, b: string) => a.localeCompare(b);
const quote = (name: string) => `'${name.replaceAll("'", "''")}'`;

/** Jenis objek bernama `name` di skema utama (tanpa memandang huruf besar/kecil), atau null. */
export function objectTypeOf(db: Database, name: string): { type: string; table: string } | null {
  const found = rows(db, `SELECT type, tbl_name FROM sqlite_schema WHERE lower(name) = lower(${quote(name)}) LIMIT 1`)[0];
  return found ? { type: text(found.type), table: text(found.tbl_name) } : null;
}

function tableFacts(db: Database, table: string): TableFacts {
  const columns = rows(db, `PRAGMA table_info(${quote(table)})`).map((r) => ({
    name: text(r.name),
    declaredType: text(r.type),
    affinity: affinityOf(text(r.type)),
    notNull: Number(r.notnull) === 1,
    pk: Number(r.pk),
  }));
  // `REFERENCES induk` tanpa kolom = merujuk PRIMARY KEY induk; samakan dengan bentuk yang menyebut kolomnya.
  const parentPk = (parent: string) =>
    rows(db, `PRAGMA table_info(${quote(parent)})`)
      .filter((c) => Number(c.pk) > 0)
      .sort((a, b) => Number(a.pk) - Number(b.pk))
      .map((c) => text(c.name));
  const fkRows = rows(db, `PRAGMA foreign_key_list(${quote(table)})`);
  const foreignKeys = fkRows
    .map((r) => {
      const parent = text(r.table);
      const to = r.to === null || r.to === undefined ? (parentPk(parent)[Number(r.seq)] ?? '') : text(r.to);
      return `${text(r.from)} -> ${parent}(${to}) on delete ${text(r.on_delete)}`.toLowerCase();
    })
    .sort(byText);
  const uniques = rows(db, `PRAGMA index_list(${quote(table)})`)
    .filter((r) => Number(r.unique) === 1 && r.origin !== 'pk' && Number(r.partial) !== 1)
    .map((r) =>
      rows(db, `PRAGMA index_info(${quote(text(r.name))})`)
        .map((c) => text(c.name).toLowerCase())
        .sort(byText)
        .join(', '),
    )
    .sort(byText);
  return { type: 'table', columns, foreignKeys: [...new Set(foreignKeys)], uniques: [...new Set(uniques)] };
}

/** Fakta struktur objek yang diminta, atau null bila tidak ada. */
export function readObjectFacts(db: Database, name: string): ObjectFacts | null {
  const found = objectTypeOf(db, name);
  if (!found) return null;
  switch (found.type) {
    case 'table':
      return tableFacts(db, name);
    case 'view':
      return { type: 'view' };
    case 'trigger':
      return { type: 'trigger', table: found.table.toLowerCase() };
    default:
      return { type: 'index' };
  }
}

const TYPE_LABEL: Record<string, string> = { table: 'tabel', view: 'view', trigger: 'trigger', index: 'index' };

/** Pesan bila objek tidak ada / jenisnya salah / trigger di tabel yang salah; null bila sesuai. */
export function objectProblem(name: string, want: SchemaObjectType, expected: ObjectFacts, actual: ObjectFacts | null): string | null {
  if (!actual) {
    return `${TYPE_LABEL[want] ?? want} ${name} belum ada setelah skripmu dijalankan. Periksa ejaan namanya, dan pastikan statement CREATE-nya tidak error.`;
  }
  if (actual.type !== want) {
    const extra =
      want === 'view' && actual.type === 'table'
        ? ' CREATE TABLE … AS SELECT menyalin data SAAT ITU saja (tidak ikut berubah), sedangkan VIEW menyimpan query-nya sehingga selalu menampilkan data terbaru.'
        : '';
    return `${name} memang ada, tetapi berupa ${TYPE_LABEL[actual.type] ?? actual.type}, seharusnya ${TYPE_LABEL[want] ?? want}.${extra}`;
  }
  if (expected.type === 'trigger' && actual.type === 'trigger' && expected.table !== actual.table) {
    return `Trigger ${name} terpasang di tabel ${actual.table}, seharusnya di tabel ${expected.table}.`;
  }
  return null;
}

const MAX_LISTED = 4;

const byName = (cols: readonly ColumnFacts[]) => new Map(cols.map((c) => [c.name.toLowerCase(), c]));

/** Kolom yang hilang/berlebih, afinitas, dan NOT NULL (PRIMARY KEY dibandingkan terpisah). */
function columnIssues(expected: TableFacts, actual: TableFacts): { issues: string[]; missing: number } {
  const want = byName(expected.columns);
  const got = byName(actual.columns);
  const missing = expected.columns.filter((c) => !got.has(c.name.toLowerCase())).map((c) => c.name);
  const extra = actual.columns.filter((c) => !want.has(c.name.toLowerCase())).map((c) => c.name);
  const issues: string[] = [];
  if (missing.length > 0) issues.push(`kolom yang belum ada: ${missing.join(', ')}`);
  if (extra.length > 0) issues.push(`kolom yang tidak diminta: ${extra.join(', ')}`);
  for (const w of expected.columns) {
    const g = got.get(w.name.toLowerCase());
    if (g) issues.push(...columnDetailIssues(w, g));
  }
  return { issues, missing: missing.length };
}

function columnDetailIssues(w: ColumnFacts, g: ColumnFacts): string[] {
  const issues: string[] = [];
  if (w.affinity !== g.affinity) {
    issues.push(
      `kolom ${w.name} bertipe "${g.declaredType || '(tanpa tipe)'}" (afinitas ${g.affinity}), seharusnya afinitas ${w.affinity} — di SQLite tipe menentukan cara nilai disimpan, mis. DATE/DATETIME berafinitas NUMERIC, bukan TEXT`,
    );
  }
  if (w.pk === 0 && g.pk === 0 && w.notNull !== g.notNull) {
    issues.push(w.notNull ? `kolom ${w.name} belum NOT NULL (boleh kosong)` : `kolom ${w.name} tidak perlu NOT NULL`);
  }
  return issues;
}

/** Urutan kolom PRIMARY KEY gabungan tidak mengubah aturan keunikannya, jadi dibandingkan sebagai himpunan. */
function pkOf(cols: readonly ColumnFacts[]): string {
  return cols
    .filter((c) => c.pk > 0)
    .map((c) => c.name.toLowerCase())
    .sort(byText)
    .join(', ');
}

/** Selisih dua himpunan teks sebagai pesan "belum ada" / "tidak diminta". */
function setIssues(label: string, expected: readonly string[], actual: readonly string[], format: (items: string[]) => string): string[] {
  const missing = expected.filter((x) => !actual.includes(x));
  const extra = actual.filter((x) => !expected.includes(x));
  const issues: string[] = [];
  if (missing.length > 0) issues.push(`${label} yang belum ada: ${format(missing)}`);
  if (extra.length > 0) issues.push(`${label} yang berbeda/tidak diminta: ${format(extra)}`);
  return issues;
}

/** Perbedaan struktur tabel (dibaca dengan pasti), atau null bila sama. */
export function tableDifferences(name: string, expected: TableFacts, actual: TableFacts): string | null {
  const columns = columnIssues(expected, actual);
  const issues = [...columns.issues];
  const wantPk = pkOf(expected.columns);
  const gotPk = pkOf(actual.columns);
  if (columns.missing === 0 && wantPk !== gotPk) issues.push(`PRIMARY KEY seharusnya (${wantPk || 'tidak ada'}), di tabelmu (${gotPk || 'tidak ada'})`);
  const showFk = (fk: string) => fk.replace(/ on delete no action$/, '');
  issues.push(...setIssues('FOREIGN KEY', expected.foreignKeys, actual.foreignKeys, (items) => items.map(showFk).join('; ')));
  issues.push(...setIssues('UNIQUE', expected.uniques, actual.uniques, (items) => `(${items.join('), (')})`));

  if (issues.length === 0) return null;
  const listed = issues.slice(0, MAX_LISTED).join('; ');
  const more = issues.length > MAX_LISTED ? `; dan ${issues.length - MAX_LISTED} perbedaan lain` : '';
  return `Struktur tabel ${name} belum sesuai: ${listed}${more}.`;
}

/** Tabel ringkas struktur (urut nama kolom) untuk ditampilkan berdampingan di panel hasil. */
export function structureResult(facts: TableFacts): QueryResult {
  const fkOf = (col: string) =>
    facts.foreignKeys
      .filter((fk) => fk.startsWith(`${col.toLowerCase()} -> `))
      .map((fk) => fk.split(' -> ')[1]?.replace(/ on delete no action$/, '') ?? '')
      .join(', ');
  const uniqueOf = (col: string) => facts.uniques.filter((u) => u.split(', ').includes(col.toLowerCase())).map((u) => `(${u})`).join(' ');
  return {
    columns: ['kolom', 'afinitas', 'not_null', 'primary_key', 'references', 'unique'],
    rows: [...facts.columns]
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      // Sel kosong = '' (bukan NULL) agar tidak terbaca sebagai nilai data NULL.
      .map((c) => [c.name.toLowerCase(), c.affinity, c.notNull ? 'ya' : '', c.pk > 0 ? String(c.pk) : '', fkOf(c.name), uniqueOf(c.name)]),
  };
}

export interface ProbeOutcome {
  ok: boolean;
  /** Pesan error SQLite bila ditolak. */
  error: string;
}

/** Jalankan probe berurutan (masing-masing autocommit: probe yang gagal tidak meninggalkan perubahan). */
export function runProbes(db: Database, probes: readonly SchemaProbe[]): ProbeOutcome[] {
  return probes.map((probe) => {
    const outcome = executeSql(db, probe.sql);
    return outcome.ok ? { ok: true, error: '' } : { ok: false, error: outcome.rawError };
  });
}

function outcomeText(outcome: ProbeOutcome): string {
  return outcome.ok ? 'diterima' : `ditolak (${outcome.error})`;
}

/** Tabel hasil probe untuk ditampilkan berdampingan; kolom `hasil` hanya diterima/ditolak agar diff menyoroti perbedaannya. */
export function probesResult(probes: readonly SchemaProbe[], outcomes: readonly ProbeOutcome[]): QueryResult {
  return {
    columns: ['uji', 'keterangan', 'hasil'],
    rows: probes.map((probe, i) => [i + 1, probe.description, outcomes[i]?.ok ? 'diterima' : 'ditolak']),
  };
}

/** Indeks probe pertama yang hasilnya berbeda, atau -1. */
export function firstProbeMismatch(expected: readonly ProbeOutcome[], actual: readonly ProbeOutcome[]): number {
  return expected.findIndex((e, i) => e.ok !== actual[i]?.ok);
}

export function probeMessage(probe: SchemaProbe, index: number, expected: ProbeOutcome, actual: ProbeOutcome): string {
  const advice = expected.ok
    ? 'Constraint di tabelmu terlalu ketat atau ditulis pada kolom/kondisi yang keliru, sehingga data yang sah ikut ditolak.'
    : 'Aturan yang seharusnya mencegah data ini belum ada atau terlalu longgar (CHECK, NOT NULL, UNIQUE, FOREIGN KEY, atau trigger).';
  return `Uji perilaku #${index + 1} — ${probe.description}: seharusnya ${expected.ok ? 'DITERIMA' : 'DITOLAK'}, tetapi di tabelmu ${outcomeText(actual)}. ${advice} Uji yang dijalankan: ${probe.sql.trim()}`;
}
