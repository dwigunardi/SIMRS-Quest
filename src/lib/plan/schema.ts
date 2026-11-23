/** Explain: konteks skema, salinan skema untuk uji coba, dan saran CREATE INDEX. */
import type { Database, SqlJsStatic } from 'sql.js';
import type { IndexInfo, TableInfo } from '../../types';
import { getSchemaInfo } from '../sqlEngine';
import { SIMPLE_IDENTIFIER, escapeRegex, normalizeSql } from './sqlText';

/* ------------------------------------------------------------------ */
/* Konteks skema                                                       */
/* ------------------------------------------------------------------ */

export interface IndexOwner {
  table: TableInfo;
  index: IndexInfo;
}

export interface SchemaContext {
  /** Nama tabel (huruf kecil) → info tabel. */
  tables: Map<string, TableInfo>;
  /** Nama index (huruf kecil) → tabel pemilik + info index. */
  indexes: Map<string, IndexOwner>;
  /** Nama view (huruf kecil) → definisi SQL (ter-normalisasi). */
  views: Map<string, string>;
  /** Semua nama objek (tabel, view, index, trigger; huruf kecil) — satu namespace di SQLite. */
  names: Set<string>;
}

export function buildSchemaContext(db: Database): SchemaContext {
  const tables = new Map<string, TableInfo>();
  const indexes = new Map<string, IndexOwner>();
  for (const table of getSchemaInfo(db)) {
    tables.set(table.name.toLowerCase(), table);
    for (const index of table.indexes) indexes.set(index.name.toLowerCase(), { table, index });
  }
  const views = new Map<string, string>();
  for (const [name, sql] of db.exec("SELECT name, sql FROM sqlite_master WHERE type = 'view'")[0]?.values ?? []) {
    if (typeof name === 'string' && typeof sql === 'string') views.set(name.toLowerCase(), normalizeSql(sql));
  }
  const names = new Set<string>();
  for (const [name] of db.exec('SELECT name FROM sqlite_master')[0]?.values ?? []) {
    if (typeof name === 'string') names.add(name.toLowerCase());
  }
  return { tables, indexes, views, names };
}

/* ------------------------------------------------------------------ */
/* Database uji coba (saran index & DDL) — tidak pernah DB sesi user    */
/* ------------------------------------------------------------------ */

/**
 * Salinan SKEMA saja (tanpa data) dari DB sesi. Tanpa sqlite_stat1, planner SQLite tidak melihat
 * jumlah baris sebenarnya, jadi plan di salinan kosong sama dengan plan di DB asli — sementara
 * CREATE INDEX uji coba di tabel kosong hampir gratis (tidak membekukan UI pada tabel besar) dan
 * DB sesi user tidak pernah ditulis.
 */
export function createShadow(SQL: SqlJsStatic, db: Database): Database | null {
  const shadow = new SQL.Database();
  try {
    const fk = db.exec('PRAGMA foreign_keys')[0]?.values[0]?.[0];
    shadow.run(`PRAGMA foreign_keys = ${fk === 1 ? 'ON' : 'OFF'}`);
    // Tabel bayangan milik virtual table (mis. FTS4 dok_content) dibuat ulang otomatis oleh CREATE VIRTUAL TABLE.
    const virtualShadows = new Set(
      (db.exec("SELECT schema || '.' || name FROM pragma_table_list WHERE type = 'shadow'")[0]?.values ?? []).map(([n]) => String(n).toLowerCase()),
    );
    const replay = (master: string, schemaName: string, temp: boolean): void => {
      // substr, bukan LIKE 'sqlite_%' — di LIKE, "_" cocok dengan karakter apa pun (tabel "sqlitedata" ikut tersaring).
      const rows = db.exec(`SELECT type, name, sql FROM ${master} WHERE sql IS NOT NULL AND substr(name, 1, 7) <> 'sqlite_' ORDER BY rowid`)[0]?.values ?? [];
      for (const [type, name, sql] of rows) {
        if (typeof sql !== 'string' || virtualShadows.has(`${schemaName}.${String(name)}`.toLowerCase())) continue;
        const statement = temp && type !== 'index' ? sql.replace(/^\s*CREATE\s+(?:TEMP(?:ORARY)?\s+)?/i, 'CREATE TEMP ') : sql;
        try {
          shadow.run(statement);
        } catch {
          /* satu objek yang gagal diputar ulang tidak membatalkan seluruh salinan */
        }
      }
    };
    replay('sqlite_master', 'main', false);
    replay('sqlite_temp_master', 'temp', true);
    const stats = db.exec("SELECT 1 FROM sqlite_master WHERE name = 'sqlite_stat1'").length > 0;
    if (stats) {
      shadow.run('ANALYZE');
      shadow.run('DELETE FROM sqlite_stat1');
      for (const row of db.exec('SELECT tbl, idx, stat FROM sqlite_stat1')[0]?.values ?? []) {
        shadow.run('INSERT INTO sqlite_stat1 (tbl, idx, stat) VALUES (?, ?, ?)', row.map((v) => (v instanceof Uint8Array ? null : v)));
      }
      shadow.run('ANALYZE sqlite_schema');
    }
    return shadow;
  } catch {
    shadow.close();
    return null;
  }
}

/** Batas baris tabel untuk uji coba CREATE INDEX langsung di DB sesi (hanya bila salinan skema tidak tersedia). */
export const LIVE_PROBE_MAX_ROWS = 20_000;

export interface Prober {
  /** DB tempat uji coba dijalankan (salinan skema, atau DB sesi bila tidak ada sql.js). */
  db: Database;
  live: boolean;
  cache: Map<string, boolean>;
}

/** Menjalankan `fn` di dalam SAVEPOINT yang SELALU di-ROLLBACK — skema & data tidak berubah. */
export function withRollback<T>(db: Database, fn: () => T, fallback: T): T {
  try {
    db.run('SAVEPOINT simrs_explain_probe');
  } catch {
    return fallback;
  }
  try {
    return fn();
  } catch {
    return fallback;
  } finally {
    try {
      db.run('ROLLBACK TO simrs_explain_probe');
    } catch {
      /* abaikan */
    }
    try {
      db.run('RELEASE simrs_explain_probe');
    } catch {
      /* abaikan */
    }
  }
}

/** Versi skema main + temp (CREATE TEMP … hanya menaikkan temp.schema_version). */
export function schemaVersion(db: Database): string {
  const main = db.exec('PRAGMA main.schema_version')[0]?.values[0]?.[0];
  const temp = db.exec('PRAGMA temp.schema_version')[0]?.values[0]?.[0];
  return `${String(main)}/${String(temp)}`;
}

export const CTAS = /^\s*CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(?:(?:main|temp)\.)?([^\s(]+)\s+AS\b/i;

/** Apakah DDL ini benar-benar akan mengubah skema saat ini? (mis. CREATE INDEX IF NOT EXISTS yang sudah ada → tidak) */
export function ddlChangesSchema(prober: Prober, stmt: string): boolean {
  // Di DB sesi (tanpa salinan skema) DDL tidak diuji: DROP TABLE dll. menaikkan total_changes() walau
  // di-rollback. Anggap saja mengubah skema (konservatif: catatan "klik Run dulu" tetap tampil).
  if (prober.live) return true;
  const ctas = CTAS.exec(normalizeSql(stmt));
  if (ctas) {
    // CREATE TABLE … AS SELECT TIDAK dijalankan (SELECT-nya bisa menghasilkan baris tanpa akhir, mis. CTE
    // rekursif tanpa batas) — cukup di-compile: prepare gagal bila tabel sudah ada.
    try {
      prober.db.prepare(stmt).free();
    } catch {
      return false;
    }
    const name = (ctas[2] ?? '').toLowerCase();
    const exists = prober.db.exec(
      `SELECT 1 FROM sqlite_master WHERE lower(name) = '${name.replace(/'/g, "''")}' UNION ALL SELECT 1 FROM sqlite_temp_master WHERE lower(name) = '${name.replace(/'/g, "''")}'`,
    ).length > 0;
    return !(ctas[1] && exists);
  }
  return withRollback(
    prober.db,
    () => {
      const before = schemaVersion(prober.db);
      prober.db.run(stmt);
      return schemaVersion(prober.db) !== before;
    },
    false,
  );
}


export const RESERVED: ReadonlySet<string> = new Set([
  'ADD', 'ALL', 'ALTER', 'AND', 'AS', 'ASC', 'BETWEEN', 'BY', 'CASE', 'CHECK', 'COLLATE', 'COLUMN', 'CONSTRAINT', 'CREATE',
  'CROSS', 'DEFAULT', 'DELETE', 'DESC', 'DISTINCT', 'DROP', 'ELSE', 'END', 'ESCAPE', 'EXCEPT', 'EXISTS', 'FOREIGN', 'FROM',
  'FULL', 'GROUP', 'HAVING', 'IN', 'INDEX', 'INNER', 'INSERT', 'INTERSECT', 'INTO', 'IS', 'JOIN', 'KEY', 'LEFT', 'LIKE',
  'LIMIT', 'NATURAL', 'NOT', 'NULL', 'OFFSET', 'ON', 'OR', 'ORDER', 'OUTER', 'PRIMARY', 'REFERENCES', 'RIGHT', 'SELECT',
  'SET', 'TABLE', 'THEN', 'TO', 'TRANSACTION', 'UNION', 'UNIQUE', 'UPDATE', 'USING', 'VALUES', 'VIEW', 'WHEN', 'WHERE',
  'WITH', 'WINDOW', 'ROWID',
]);

export function quoteIdentifier(name: string): string {
  if (SIMPLE_IDENTIFIER.test(name) && !RESERVED.has(name.toUpperCase())) return name;
  return `"${name.replace(/"/g, '""')}"`;
}

export interface Suggestion {
  sql: string;
  indexName: string;
}

/** CREATE INDEX dengan nama yang belum dipakai dan identifier yang di-quote bila perlu; null jika kolom tidak valid. */
export function buildIndexSuggestion(table: TableInfo, columns: readonly string[], schema: SchemaContext): Suggestion | null {
  const known = new Map(table.columns.map((c) => [c.name.toLowerCase(), c.name]));
  const resolved = columns.map((c) => known.get(c.toLowerCase()));
  if (resolved.length === 0 || resolved.some((c) => c === undefined)) return null;
  const cols = resolved.filter((c): c is string => c !== undefined);
  const baseName = `idx_${table.name}_${cols.join('_')}`.replace(/[^A-Za-z0-9_]+/g, '_');
  let indexName = baseName;
  for (let n = 2; schema.names.has(indexName.toLowerCase()); n++) indexName = `${baseName}_${n}`;
  return {
    sql: `CREATE INDEX ${indexName} ON ${quoteIdentifier(table.name)} (${cols.map(quoteIdentifier).join(', ')});`,
    indexName,
  };
}

/**
 * Apakah SQLite benar-benar akan MEMAKAI index saran untuk statement ini? Diuji di dalam SAVEPOINT
 * yang selalu di-ROLLBACK, jadi skema & data tidak berubah. Mencegah saran yang tidak berguna
 * (mis. JOIN dengan COLLATE NOCASE, perbedaan affinity).
 */
export function suggestionHelps(prober: Prober, sql: string, suggestion: Suggestion): boolean {
  const key = `${sql}\u0000${suggestion.sql}`;
  const cached = prober.cache.get(key);
  if (cached !== undefined) return cached;
  const used = new RegExp(`\\bINDEX\\s+${escapeRegex(suggestion.indexName)}\\b`, 'i');
  const helps = withRollback(
    prober.db,
    () => {
      prober.db.run(suggestion.sql);
      const rows = prober.db.exec(`EXPLAIN QUERY PLAN ${sql}`)[0]?.values ?? [];
      return rows.some((row) => used.test(String(row[3] ?? '')));
    },
    false,
  );
  prober.cache.set(key, helps);
  return helps;
}
