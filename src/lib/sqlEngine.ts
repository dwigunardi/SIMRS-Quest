/**
 * Mesin SQL murni (tanpa dependensi browser) di atas sql.js.
 * Bisa dipakai di aplikasi maupun script Node/tsx.
 */
import type { Database, SqlJsStatic, Statement } from 'sql.js';
import { SCHEMA_SQL, SEED_SQL, TABLE_DESCRIPTIONS, TABLE_ORDER, type TableName } from '../db/seed';
import type { CellValue, ColumnInfo, ExecFailure, ExecOutcome, IndexInfo, QueryResult, TableInfo } from '../types';

const EMPTY_QUERY_MESSAGE =
  'Query masih kosong. Tulis perintah SQL terlebih dahulu, misalnya: SELECT * FROM pasien;';

/* ------------------------------------------------------------------ */
/* Pembuatan database                                                  */
/* ------------------------------------------------------------------ */

export function createSeededDatabase(SQL: SqlJsStatic): Database {
  const db = new SQL.Database();
  try {
    db.exec(SCHEMA_SQL);
    db.exec(SEED_SQL);
    return db;
  } catch (err) {
    db.close();
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Pembersihan SQL (komentar & literal)                                */
/* ------------------------------------------------------------------ */

/**
 * Mengganti komentar dengan spasi, literal string dengan `''`, dan identifier
 * ber-kutip dengan placeholder netral, sehingga keyword di dalamnya tidak ikut
 * terdeteksi. Dipakai untuk deteksi mutasi dan pengecekan `requiredPatterns`.
 */
export function stripCommentsAndStrings(sql: string): string {
  let out = '';
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === '-' && next === '-') {
      const end = sql.indexOf('\n', i + 2);
      i = end === -1 ? n : end;
      out += ' ';
      continue;
    }

    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      out += ' ';
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipQuoted(sql, i, ch);
      out += ch === "'" ? " '' " : ' _q_ ';
      continue;
    }

    if (ch === '[') {
      const end = sql.indexOf(']', i + 1);
      i = end === -1 ? n : end + 1;
      out += ' _q_ ';
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/** Mengembalikan indeks setelah penutup kutip (mendukung escape ganda, mis. `''`). */
function skipQuoted(sql: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] !== quote) {
      i += 1;
      continue;
    }
    if (sql[i + 1] === quote) {
      i += 2;
      continue;
    }
    return i + 1;
  }
  return sql.length;
}

const MUTATING_PATTERNS: readonly RegExp[] = [
  /\bINSERT\b/i,
  /\bUPDATE\b/i,
  /\bDELETE\b/i,
  /\bREPLACE\s+INTO\b/i, // REPLACE(...) sebagai fungsi string TIDAK dihitung
  /\bDROP\b/i,
  /\bALTER\b/i,
  /\bCREATE\b/i,
  /\bTRUNCATE\b/i,
  /\bATTACH\b/i,
  /\bDETACH\b/i,
  /\bVACUUM\b/i,
  /\bREINDEX\b/i,
];

export function isMutatingSql(sql: string): boolean {
  const cleaned = stripCommentsAndStrings(sql);
  return MUTATING_PATTERNS.some((pattern) => pattern.test(cleaned));
}

/**
 * true jika SETIAP statement di skrip hanya membaca (SELECT / WITH … SELECT / VALUES / EXPLAIN) — hasilnya boleh
 * diambil dari salinan database tanpa menjalankannya di database utama. PRAGMA, BEGIN/COMMIT, ATTACH, dsb. = false.
 */
export function isReadOnlyScript(sql: string): boolean {
  if (isMutatingSql(sql)) return false;
  const statements = stripCommentsAndStrings(sql)
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return statements.length > 0 && statements.every((s) => /^(?:SELECT|WITH|VALUES|EXPLAIN)\b/i.test(s));
}

/** Kegagalan standar untuk query yang dihentikan (batas waktu / mesin SQL berhenti) atau dibatalkan user. */
export function stoppedFailure(reason: 'timeout' | 'cancelled' | 'crashed', detail = ''): ExecFailure {
  if (reason === 'timeout') return failure(QUERY_TIMEOUT);
  if (reason === 'crashed') return failure(`${QUERY_CRASHED}${detail ? `: ${detail}` : ''}`);
  return { ok: false, rawError: QUERY_CANCELLED, friendlyError: 'Query dihentikan atas permintaanmu. Database tidak diubah oleh query ini.' };
}

/**
 * Salinan file database (bytes) tanpa merusak koneksi: sql.js `export()` menutup lalu membuka ulang koneksi, sehingga
 * PRAGMA tingkat koneksi (foreign_keys) harus dipasang lagi. Mengembalikan null bila salinan tidak akan setara dengan
 * koneksi saat ini: ada transaksi terbuka (akan di-rollback saat ditutup) atau objek TEMP (tidak ikut tersimpan).
 */
export function snapshotDatabase(db: Database): Uint8Array | null {
  if (hasOpenTransaction(db) || hasTempObjects(db)) return null;
  const bytes = db.export();
  db.run('PRAGMA foreign_keys = ON');
  return bytes;
}

/** true bila snapshotDatabase akan berhasil (dicek tanpa mengekspor). */
export function canSnapshot(db: Database): boolean {
  return !hasOpenTransaction(db) && !hasTempObjects(db);
}

/** BEGIN gagal bila transaksi sedang terbuka; bila berhasil langsung di-ROLLBACK (tanpa efek). */
function hasOpenTransaction(db: Database): boolean {
  try {
    db.exec('BEGIN');
  } catch {
    return true;
  }
  db.exec('ROLLBACK');
  return false;
}

function hasTempObjects(db: Database): boolean {
  try {
    const value = db.exec('SELECT COUNT(*) FROM sqlite_temp_master')[0]?.values[0]?.[0];
    return typeof value === 'number' && value > 0;
  } catch {
    return true;
  }
}

/* ------------------------------------------------------------------ */
/* Eksekusi                                                            */
/* ------------------------------------------------------------------ */

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}

function failure(rawError: string): ExecFailure {
  return { ok: false, rawError, friendlyError: toFriendlyError(rawError) };
}

/** Membebaskan memori sisa iterator (method `finalize` tidak ada di typings). */
export function finalizeIterator(iterator: object): void {
  if (!('finalize' in iterator)) return;
  const fn = iterator.finalize;
  if (typeof fn !== 'function') return;
  try {
    fn.call(iterator);
  } catch {
    /* abaikan */
  }
}

/**
 * Batas baris per result set. Query yang terus mengalirkan baris (rekursi tanpa syarat berhenti, CROSS JOIN raksasa)
 * dihentikan di sini alih-alih membuat tab browser macet kehabisan memori.
 */
export const MAX_RESULT_ROWS = 100_000;
/** Awalan pesan error mentah untuk hasil yang melewati MAX_RESULT_ROWS. */
export const RESULT_TOO_LARGE = 'result too large';
/** Pesan error mentah untuk query yang dihentikan karena melewati batas waktu (lihat sqlGuard). */
export const QUERY_TIMEOUT = 'query timeout';
/** Pesan error mentah untuk query yang dihentikan user (tombol Hentikan). */
export const QUERY_CANCELLED = 'query cancelled';
/** Awalan pesan error mentah untuk query yang membuat mesin SQL di worker berhenti (mis. kehabisan memori). */
export const QUERY_CRASHED = 'query crashed';

/** Menjalankan satu statement; mengembalikan result set bila statement punya kolom. */
function runStatement(stmt: Statement): QueryResult | null {
  const columns = stmt.getColumnNames();
  const rows: CellValue[][] = [];
  while (stmt.step()) {
    if (rows.length >= MAX_RESULT_ROWS) {
      throw new Error(`${RESULT_TOO_LARGE}: lebih dari ${MAX_RESULT_ROWS} baris`);
    }
    rows.push(stmt.get());
  }
  if (columns.length === 0) return null;
  return { columns, rows };
}

interface RunAllResult {
  results: QueryResult[];
  /** Teks statement yang menghasilkan result set terakhir (null jika tidak ada). */
  lastResultSql: string | null;
}

/**
 * Berbeda dengan `db.exec`, SELECT yang menghasilkan 0 baris tetap dikembalikan
 * sebagai result set (kolom terisi, baris kosong) agar UI & penilaian akurat.
 */
function runAll(db: Database, sql: string): RunAllResult {
  const results: QueryResult[] = [];
  let lastResultSql: string | null = null;
  const iterator = db.iterateStatements(sql);
  try {
    for (const stmt of iterator) {
      try {
        const result = runStatement(stmt);
        if (!result) continue;
        results.push(result);
        lastResultSql = stmt.getSQL().trim();
      } finally {
        stmt.free();
      }
    }
  } catch (err) {
    finalizeIterator(iterator);
    throw err;
  }
  return { results, lastResultSql };
}

/**
 * Total baris yang diubah sejak koneksi dibuka (SQLite total_changes()).
 * Selisih sebelum/sesudah eksekusi = jumlah baris yang benar-benar diubah.
 */
export function getTotalChanges(db: Database): number {
  try {
    const value = db.exec('SELECT total_changes()')[0]?.values[0]?.[0];
    return typeof value === 'number' ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * Versi skema database utama (PRAGMA schema_version). Naik setiap kali DDL
 * (CREATE/DROP/ALTER) berhasil — termasuk dari skrip yang gagal di tengah jalan,
 * yang tidak terdeteksi oleh total_changes().
 */
export function getSchemaVersion(db: Database): number {
  try {
    const value = db.exec('PRAGMA schema_version')[0]?.values[0]?.[0];
    return typeof value === 'number' ? value : 0;
  } catch {
    return 0;
  }
}

/** Kosong = hanya spasi, komentar, dan/atau titik koma. */
export function isEmptySql(sql: string): boolean {
  return stripCommentsAndStrings(sql).replace(/;/g, ' ').trim().length === 0;
}

const EMPTY_FAILURE: ExecFailure = { ok: false, rawError: 'empty query', friendlyError: EMPTY_QUERY_MESSAGE };

/** Kegagalan standar untuk SQL kosong. */
export const EMPTY_QUERY_FAILURE: ExecFailure = EMPTY_FAILURE;

export interface StatementSplit {
  /** Teks tiap statement yang berhasil di-parse (tanpa spasi di ujung). */
  statements: string[];
  /**
   * Kegagalan parse statement berikutnya (urutan ke-statements.length + 1), beserta sisa SQL
   * mulai dari statement itu. Statement sesudahnya tidak ikut diproses.
   */
  error: (ExecFailure & { sql: string }) | null;
}

/**
 * Memecah skrip menjadi statement dengan parser SQLite (sqlite3_prepare) TANPA menjalankannya,
 * sehingga titik koma di dalam string/komentar ditangani dengan benar. Karena prepare memvalidasi
 * nama tabel/kolom, statement yang memakai objek buatan statement sebelumnya (yang belum dijalankan)
 * akan gagal di sini.
 */
export function splitStatements(db: Database, sql: string): StatementSplit {
  const statements: string[] = [];
  const iterator = db.iterateStatements(sql);
  try {
    for (const stmt of iterator) {
      try {
        statements.push(stmt.getSQL().trim());
      } finally {
        stmt.free();
      }
    }
    return { statements, error: null };
  } catch (err) {
    const remaining = iterator.getRemainingSQL().trim();
    finalizeIterator(iterator);
    return { statements, error: { ...failure(errorMessage(err)), sql: remaining } };
  }
}

export function executeSql(db: Database, sql: string): ExecOutcome {
  if (isEmptySql(sql)) return EMPTY_FAILURE;

  const changesBefore = getTotalChanges(db);
  const start = performance.now();
  try {
    const { results, lastResultSql } = runAll(db, sql);
    const elapsedMs = performance.now() - start;
    // db.getRowsModified() menyimpan angka DML terakhir walau statement kini SELECT,
    // jadi dipakai selisih total_changes(): akurat untuk SELECT (0) & multi-statement.
    const rowsModified = Math.max(getTotalChanges(db) - changesBefore, 0);
    return { ok: true, results, mutated: isMutatingSql(sql), rowsModified, elapsedMs, lastResultSql };
  } catch (err) {
    return failure(errorMessage(err));
  }
}

/**
 * Menjalankan `fn` dengan koneksi read-only (PRAGMA query_only): INSERT/UPDATE/DELETE/CREATE apa pun di
 * dalamnya gagal dengan error "attempt to write a readonly database". Status sebelumnya dipulihkan.
 */
export function withQueryOnly<T>(db: Database, fn: () => T): T {
  const stmt = db.prepare('PRAGMA query_only');
  let already = false;
  try {
    already = stmt.step() && Number(stmt.get()[0]) === 1;
  } finally {
    stmt.free();
  }
  if (!already) db.run('PRAGMA query_only = 1');
  try {
    return fn();
  } finally {
    if (!already) db.run('PRAGMA query_only = 0');
  }
}

/** executeSql yang dijamin tidak mengubah database (untuk contoh materi di DB seed). */
export function executeReadOnly(db: Database, sql: string): ExecOutcome {
  return withQueryOnly(db, () => executeSql(db, sql));
}

/**
 * Menjalankan SQL statement demi statement (baris hasil dibuang). `afterEach` dipanggil setelah
 * SETIAP statement selesai, dengan teks statement itu, sehingga pemanggil bisa memeriksa kondisi
 * database di antara statement (mis. apakah transaksi sedang aktif). Mengembalikan kegagalan
 * pertama, atau null jika semua statement sukses.
 */
export function forEachStatement(db: Database, sql: string, afterEach: (statementSql: string) => void): ExecFailure | null {
  if (isEmptySql(sql)) return EMPTY_FAILURE;
  const iterator = db.iterateStatements(sql);
  try {
    for (const stmt of iterator) {
      let text = '';
      try {
        text = stmt.getSQL().trim();
        while (stmt.step()) {
          /* baris hasil tidak dibutuhkan */
        }
      } finally {
        stmt.free();
      }
      afterEach(text);
    }
    return null;
  } catch (err) {
    finalizeIterator(iterator);
    return failure(errorMessage(err));
  }
}

export type BindValue = string | number | null;

/**
 * Menjalankan SATU statement dengan parameter ter-bind (prepared statement).
 * Statement tambahan setelah statement pertama diabaikan (perilaku sqlite3_prepare),
 * sehingga input yang di-bind tidak pernah bisa "menumpuk" query baru.
 */
export function executePrepared(db: Database, sql: string, params: ReadonlyArray<BindValue>): ExecOutcome {
  if (isEmptySql(sql)) return EMPTY_FAILURE;

  const changesBefore = getTotalChanges(db);
  const start = performance.now();
  try {
    const stmt = db.prepare(sql);
    try {
      stmt.bind([...params]);
      const result = runStatement(stmt);
      const elapsedMs = performance.now() - start;
      const rowsModified = Math.max(getTotalChanges(db) - changesBefore, 0);
      return {
        ok: true,
        results: result ? [result] : [],
        mutated: isMutatingSql(sql),
        rowsModified,
        elapsedMs,
        lastResultSql: result ? stmt.getSQL().trim() : null,
      };
    } finally {
      stmt.free();
    }
  } catch (err) {
    return failure(errorMessage(err));
  }
}

/**
 * Menjalankan `EXPLAIN QUERY PLAN <sql>` untuk statement PERTAMA saja (query-nya
 * sendiri tidak dieksekusi). results[0] berkolom id, parent, notused, detail.
 */
export function explainQueryPlan(db: Database, sql: string): ExecOutcome {
  if (isEmptySql(sql)) return EMPTY_FAILURE;
  return executePrepared(db, `EXPLAIN QUERY PLAN ${sql}`, []);
}

/* ------------------------------------------------------------------ */
/* Pesan error ramah                                                   */
/* ------------------------------------------------------------------ */

const AVAILABLE_TABLES = TABLE_ORDER.join(', ');

type ErrorRule = {
  pattern: RegExp;
  explain: (match: RegExpMatchArray) => string;
};

function syntaxTip(token: string): string {
  const upper = token.toUpperCase();
  if (upper === 'FROM') {
    return ' Kemungkinan ada koma berlebih sebelum FROM, atau daftar kolom belum lengkap.';
  }
  if (['WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT'].includes(upper)) {
    return ' Periksa urutan klausa: SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT.';
  }
  if (token === ',') {
    return ' Mungkin ada koma ganda atau koma di posisi yang salah.';
  }
  if (token === ')' || token === '(') {
    return ' Pastikan setiap tanda kurung buka punya pasangan tutupnya.';
  }
  return '';
}

const ERROR_RULES: readonly ErrorRule[] = [
  {
    pattern: new RegExp(`^${RESULT_TOO_LARGE}`, 'i'),
    explain: () =>
      `Query dihentikan karena hasilnya lebih dari ${MAX_RESULT_ROWS.toLocaleString('id-ID')} baris. Biasanya penyebabnya CTE rekursif tanpa syarat berhenti (atau syaratnya tidak pernah gagal), JOIN tanpa syarat ON (perkalian semua baris), atau koma di FROM tanpa syarat di WHERE. Tambahkan syarat berhenti/syarat JOIN, atau batasi dengan LIMIT di bagian rekursif.`,
  },
  {
    pattern: new RegExp(`^${QUERY_CRASHED}`, 'i'),
    explain: () =>
      'Mesin SQL berhenti saat menjalankan query ini — biasanya karena kehabisan memori akibat hasil antara yang sangat besar (CTE rekursif tanpa syarat berhenti, JOIN tanpa syarat). Database tidak diubah oleh query ini. Periksa syarat berhenti/syarat JOIN, lalu jalankan lagi.',
  },
  {
    pattern: new RegExp(`^${QUERY_TIMEOUT}`, 'i'),
    explain: () =>
      'Query dihentikan karena berjalan terlalu lama. Biasanya penyebabnya CTE rekursif yang tidak pernah berhenti (terutama bila query utamanya memakai ORDER BY/GROUP BY, sehingga LIMIT di luar tidak menolong), atau JOIN/subquery yang meledak menjadi jutaan baris. Database tidak diubah oleh query ini. Periksa syarat berhenti, lalu jalankan lagi.',
  },
  {
    pattern: /near "([^"]*)": syntax error/i,
    explain: (m) => {
      const token = m[1] ?? '';
      return `Ada kesalahan penulisan (syntax) di dekat "${token}". Periksa ejaan keyword, koma, dan tanda kurung.${syntaxTip(token)}`;
    },
  },
  {
    pattern: /incomplete input/i,
    explain: () =>
      'Query belum lengkap/terpotong. Periksa apakah ada tanda kurung atau tanda kutip yang belum ditutup, atau klausa yang belum selesai ditulis (mis. WHERE tanpa kondisi).',
  },
  {
    pattern: /unrecognized token: "?(.*?)"?$/i,
    explain: (m) =>
      `Ada simbol yang tidak dikenali: ${m[1] ?? ''}. Biasanya karena tanda kutip string belum ditutup. Ingat: teks memakai kutip tunggal, mis. 'BPJS'.`,
  },
  {
    pattern: /no such table: (\S+)/i,
    explain: (m) =>
      `Tabel "${m[1] ?? ''}" tidak ditemukan. Periksa ejaan nama tabel. Tabel yang tersedia: ${AVAILABLE_TABLES}. Lihat Schema Explorer untuk detailnya.`,
  },
  {
    pattern: /no such column: (\S+)/i,
    explain: (m) =>
      `Kolom "${m[1] ?? ''}" tidak ditemukan. Periksa ejaan nama kolom dan pastikan kolom itu ada di tabel yang kamu pakai (cek Schema Explorer). Jika memakai alias tabel, pastikan aliasnya benar. Untuk teks, gunakan kutip tunggal ('...'), bukan kutip ganda.`,
  },
  {
    pattern: /ambiguous column name: (\S+)/i,
    explain: (m) =>
      `Nama kolom "${m[1] ?? ''}" ambigu karena ada di lebih dari satu tabel yang di-JOIN. Tambahkan nama/alias tabel di depannya, mis. k.${(m[1] ?? 'kolom').split('.').pop() ?? 'kolom'}.`,
  },
  {
    pattern: /misuse of aggregate(?: function)?:? ?(\w+)?/i,
    explain: (m) =>
      `Fungsi agregat${m[1] ? ` ${m[1]}()` : ''} dipakai di tempat yang tidak diizinkan. Agregat (COUNT, SUM, AVG, MIN, MAX) tidak boleh dipakai di WHERE — gunakan HAVING setelah GROUP BY untuk memfilter hasil agregasi.`,
  },
  {
    pattern: /a GROUP BY clause is required before HAVING|HAVING clause on a non-aggregate query/i,
    explain: () =>
      'HAVING hanya bisa dipakai setelah GROUP BY. Tambahkan GROUP BY, atau gunakan WHERE jika ingin memfilter baris sebelum dikelompokkan.',
  },
  {
    pattern: /aggregate functions are not allowed in the GROUP BY clause/i,
    explain: () =>
      'Fungsi agregat tidak boleh dipakai di dalam GROUP BY. GROUP BY berisi kolom pengelompokan; letakkan agregat di SELECT atau HAVING.',
  },
  {
    pattern: /UNIQUE constraint failed: (\S+)/i,
    explain: (m) =>
      `Data duplikat: nilai pada ${m[1] ?? 'kolom tersebut'} harus unik dan nilai yang kamu masukkan sudah ada. Gunakan nilai lain.`,
  },
  {
    pattern: /NOT NULL constraint failed: (\S+)/i,
    explain: (m) =>
      `Kolom ${m[1] ?? 'tersebut'} wajib diisi (NOT NULL). Pastikan kamu memberikan nilai untuk kolom ini.`,
  },
  {
    pattern: /CHECK constraint failed: ?(.*)/i,
    explain: (m) =>
      `Nilai yang dimasukkan melanggar aturan CHECK${m[1] ? ` (${m[1]})` : ''}. Periksa nilai yang diperbolehkan di Schema Explorer.`,
  },
  {
    pattern: /FOREIGN KEY constraint failed/i,
    explain: () =>
      'Pelanggaran relasi (FOREIGN KEY): data yang dirujuk tidak ada, atau data ini masih dirujuk oleh tabel lain sehingga tidak boleh dihapus/diubah.',
  },
  {
    pattern: /datatype mismatch/i,
    explain: () =>
      'Tipe data tidak cocok, mis. memasukkan teks ke kolom INTEGER PRIMARY KEY. Periksa tipe kolom di Schema Explorer.',
  },
  {
    pattern: /only execute one statement/i,
    explain: () =>
      'Hanya satu statement yang bisa dijalankan sekaligus di sini. Hapus statement tambahan atau pisahkan dengan benar.',
  },
  {
    pattern: /cannot start a transaction within a transaction/i,
    explain: () =>
      'Masih ada transaksi yang terbuka, jadi BEGIN tidak bisa dipanggil lagi. Akhiri dulu transaksi sebelumnya dengan COMMIT (simpan) atau ROLLBACK (batalkan), baru mulai transaksi baru.',
  },
  {
    pattern: /cannot commit - no transaction is active/i,
    explain: () =>
      'COMMIT dijalankan padahal tidak ada transaksi aktif. Mulai transaksi dengan BEGIN (atau BEGIN TRANSACTION) sebelum perintah yang ingin dikelompokkan, lalu akhiri dengan satu COMMIT. Ingat: ROLLBACK juga sudah mengakhiri transaksi.',
  },
  {
    pattern: /cannot rollback - no transaction is active/i,
    explain: () =>
      'ROLLBACK dijalankan padahal tidak ada transaksi aktif. Tanpa BEGIN, setiap perintah langsung tersimpan permanen (autocommit) sehingga tidak bisa dibatalkan. Tulis BEGIN sebelum perubahan yang ingin bisa dibatalkan.',
  },
  {
    pattern: /no such savepoint: (\S+)/i,
    explain: (m) =>
      `Savepoint "${m[1] ?? ''}" tidak ditemukan. Buat dulu dengan SAVEPOINT nama, lalu gunakan ROLLBACK TO nama atau RELEASE nama dengan ejaan yang sama.`,
  },
  {
    pattern: /index (\S+) already exists/i,
    explain: (m) =>
      `Index ${m[1] ?? ''} sudah ada. Gunakan nama index lain, CREATE INDEX IF NOT EXISTS, atau DROP INDEX dulu. Cek daftar index di Schema Explorer.`,
  },
  {
    pattern: /no such index: (\S+)/i,
    explain: (m) => `Index "${m[1] ?? ''}" tidak ditemukan. Periksa ejaan nama index di Schema Explorer.`,
  },
  {
    pattern: /RIGHT and FULL OUTER JOINs are not currently supported/i,
    explain: () =>
      'Versi SQLite ini belum mendukung RIGHT/FULL OUTER JOIN. Alternatifnya: tukar posisi tabel dan pakai LEFT JOIN, atau gabungkan dua LEFT JOIN dengan UNION.',
  },
  {
    pattern: /misuse of window function ?(\w+)?/i,
    explain: (m) =>
      `Window function${m[1] ? ` ${m[1]}()` : ''} dipakai di tempat yang salah. Window function wajib diikuti OVER (...) dan hanya boleh muncul di SELECT atau ORDER BY, tidak boleh di WHERE, GROUP BY, atau HAVING. Untuk memfilter hasilnya (mis. hanya baris nomor 1), hitung dulu di subquery/CTE lalu filter di query luar.`,
  },
  {
    pattern: /no such window: (\S+)/i,
    explain: (m) =>
      `Window bernama "${m[1] ?? ''}" belum didefinisikan. Tambahkan klausa WINDOW ${m[1] ?? 'w'} AS (...) sebelum ORDER BY, atau tulis definisinya langsung di OVER (...).`,
  },
  {
    pattern: /frame (?:starting|ending) offset must be a non-negative integer/i,
    explain: () =>
      'Batas frame window (ROWS/RANGE BETWEEN n PRECEDING ...) harus bilangan bulat ≥ 0. Contoh: ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW.',
  },
  {
    pattern: /recursive aggregate queries not supported/i,
    explain: () =>
      'Bagian rekursif dari WITH RECURSIVE tidak boleh memakai fungsi agregat (COUNT, SUM, MAX, ...). Lakukan agregasi di query luar setelah CTE selesai dibangun.',
  },
  {
    pattern: /multiple references to recursive table: (\S+)/i,
    explain: (m) =>
      `CTE rekursif "${m[1] ?? ''}" hanya boleh dirujuk SATU kali di bagian rekursifnya (setelah UNION ALL). JOIN-kan CTE itu ke tabel lain, bukan ke dirinya sendiri dua kali.`,
  },
  {
    pattern: /circular reference: (\S+)/i,
    explain: (m) =>
      `CTE "${m[1] ?? ''}" merujuk dirinya sendiri secara tidak valid. Untuk query berulang, gunakan WITH RECURSIVE dengan pola: anchor (query awal) UNION ALL bagian rekursif.`,
  },
  {
    pattern: /table (\S+) has (\d+) values for (\d+) columns/i,
    explain: (m) =>
      `CTE ${m[1] ?? ''} mendeklarasikan ${m[3] ?? '?'} nama kolom, tetapi SELECT di dalamnya menghasilkan ${m[2] ?? '?'} kolom. Samakan jumlah nama kolom di WITH ${m[1] ?? 'nama'}(kolom1, kolom2, ...) dengan jumlah kolom SELECT-nya.`,
  },
  {
    pattern: /no such function: (\S+)/i,
    explain: (m) =>
      `Fungsi "${m[1] ?? ''}" tidak dikenal oleh SQLite. Periksa ejaannya. Contoh fungsi yang tersedia: COUNT, SUM, AVG, MIN, MAX, ROUND, UPPER, LOWER, STRFTIME, JULIANDAY, COALESCE, serta window function ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD. Fungsi khusus DBMS lain (mis. GETDATE, NOW, DATEDIFF, TO_CHAR) tidak tersedia di SQLite.`,
  },
  {
    pattern: /wrong number of arguments to function (\S+)/i,
    explain: (m) => `Jumlah argumen untuk fungsi ${m[1] ?? ''} salah. Periksa kembali parameter yang dibutuhkan fungsi tersebut.`,
  },
  {
    pattern: /do not have the same number of result columns/i,
    explain: () =>
      'Query di kiri dan kanan UNION/INTERSECT/EXCEPT harus memiliki jumlah kolom yang sama.',
  },
  {
    pattern: /(\d+) values for (\d+) columns|has (\d+) columns but (\d+) values were supplied/i,
    explain: () =>
      'Jumlah nilai pada VALUES tidak sama dengan jumlah kolom. Pastikan setiap kolom yang disebut punya pasangan nilainya.',
  },
  {
    pattern: /sub-select returns (\d+) columns - expected 1/i,
    explain: (m) =>
      `Subquery mengembalikan ${m[1] ?? 'lebih dari 1'} kolom padahal hanya boleh 1 kolom di posisi ini. Pilih satu kolom saja di subquery.`,
  },
  {
    pattern: /ORDER BY term out of range/i,
    explain: () =>
      'Nomor kolom di ORDER BY melebihi jumlah kolom yang di-SELECT. Gunakan nomor yang valid atau tulis nama kolomnya.',
  },
  {
    pattern: /malformed JSON/i,
    explain: () =>
      'Teks yang dibaca fungsi JSON bukan JSON yang valid (mis. nilai yang hilang setelah titik dua, kurung/kurawal tidak seimbang, atau teks biasa). Periksa isinya dengan json_valid(kolom). Catatan: SQLite cukup longgar (menerima JSON5: kunci tanpa kutip, kutip tunggal, koma berlebih), tetapi SATUSEHAT dan kebanyakan API hanya menerima JSON standar — buat JSON dengan json_object/json_array agar selalu valid.',
  },
  {
    pattern: /bad JSON path:? ?'?([^']*)'?/i,
    explain: (m) =>
      `Jalur JSON ${m[1] ? `'${m[1]}' ` : ''}tidak valid. Jalur harus diawali '$', field dipisah titik, dan indeks array memakai kurung siku: '$.code.coding[0].code'. Nama field peka huruf besar/kecil.`,
  },
  {
    pattern: /foreign key mismatch - "([^"]+)" referencing "([^"]+)"/i,
    explain: (m) =>
      `FOREIGN KEY di tabel ${m[1] ?? ''} merujuk kolom tabel ${m[2] ?? ''} yang tidak unik (atau tidak ada). Kolom yang dirujuk REFERENCES harus PRIMARY KEY atau UNIQUE di tabel induk, supaya setiap nilai menunjuk tepat satu baris. Periksa nama kolom di dalam REFERENCES ${m[2] ?? ''} (…).`,
  },
  {
    pattern: /Cannot add a NOT NULL column with default value NULL/i,
    explain: () =>
      'Kolom NOT NULL yang ditambahkan ke tabel berisi data wajib punya DEFAULT: tanpa DEFAULT, semua baris lama akan bernilai NULL dan langsung melanggar aturannya sendiri. Tambahkan DEFAULT nilai (mis. DEFAULT \'Tunai\'), atau hapus NOT NULL.',
  },
  {
    pattern: /duplicate column name: (\S+)/i,
    explain: (m) =>
      `Kolom ${m[1] ?? ''} sudah ada di tabel itu (mungkin ALTER TABLE … ADD COLUMN sudah pernah dijalankan). Di Playground, klik Reset Database untuk mengulang dari awal.`,
  },
  {
    pattern: /cannot modify (\S+) because it is a view/i,
    explain: (m) =>
      `${m[1] ?? ''} adalah VIEW, dan view di SQLite hanya bisa dibaca. Ubah data di tabel asalnya — view otomatis menampilkan perubahan itu saat dibaca lagi.`,
  },
  {
    pattern: /ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint/i,
    explain: () =>
      'Kolom di ON CONFLICT (…) harus persis kolom PRIMARY KEY atau UNIQUE tabel itu, karena hanya bentrok pada constraint seperti itu yang bisa "ditangkap". Periksa kolom kuncinya di Schema Explorer.',
  },
  {
    pattern: /(view|trigger) (\S+) already exists/i,
    explain: (m) =>
      `${m[1] === 'view' ? 'View' : 'Trigger'} ${m[2] ?? ''} sudah ada. Hapus dulu dengan DROP ${m[1]?.toUpperCase() ?? ''} IF EXISTS ${m[2] ?? ''}; lalu buat ulang, atau klik Reset Database di Playground.`,
  },
  {
    pattern: /table (\S+) already exists/i,
    explain: (m) =>
      `Tabel ${m[1] ?? ''} sudah ada. Gunakan nama lain, CREATE TABLE IF NOT EXISTS, atau klik Reset Database.`,
  },
];

const GENERIC_ERROR =
  'Query gagal dijalankan. Baca pesan asli dari SQLite di bawah, lalu periksa ejaan keyword, nama tabel/kolom, koma, dan tanda kurung.';

export function toFriendlyError(raw: string): string {
  for (const rule of ERROR_RULES) {
    const match = raw.match(rule.pattern);
    if (match) return rule.explain(match);
  }
  return GENERIC_ERROR;
}

/* ------------------------------------------------------------------ */
/* Skema                                                               */
/* ------------------------------------------------------------------ */

type Row = Record<string, CellValue>;

function queryRows(db: Database, sql: string, params: (string | number)[] = []): Row[] {
  const [first] = db.exec(sql, params);
  if (!first) return [];
  return first.values.map((values) => {
    const row: Row = {};
    first.columns.forEach((col, idx) => {
      row[col] = values[idx] ?? null;
    });
    return row;
  });
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function asText(value: CellValue | undefined): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function isTableName(name: string): name is TableName {
  return (TABLE_ORDER as readonly string[]).includes(name);
}

function listUserTables(db: Database): string[] {
  return queryRows(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND substr(name, 1, 7) <> 'sqlite_' ORDER BY name",
  ).map((row) => asText(row.name));
}

function primaryKeyColumn(db: Database, table: string): string {
  const pk = queryRows(db, `PRAGMA table_info(${quoteIdentifier(table)})`).find((r) => Number(r.pk) === 1);
  return asText(pk?.name);
}

function readColumns(db: Database, table: string): ColumnInfo[] {
  const fkRows = queryRows(db, `PRAGMA foreign_key_list(${quoteIdentifier(table)})`);
  const fkByColumn = new Map<string, { table: string; column: string }>();
  for (const fk of fkRows) {
    const target = asText(fk.table);
    const to = asText(fk.to) || primaryKeyColumn(db, target);
    fkByColumn.set(asText(fk.from), { table: target, column: to });
  }

  return queryRows(db, `PRAGMA table_info(${quoteIdentifier(table)})`).map((col) => {
    const name = asText(col.name);
    return {
      name,
      type: asText(col.type),
      notNull: Number(col.notnull) === 1,
      isPrimaryKey: Number(col.pk) > 0,
      foreignKey: fkByColumn.get(name) ?? null,
    };
  });
}

function countRows(db: Database, table: string): number {
  const [row] = queryRows(db, `SELECT COUNT(*) AS n FROM ${quoteIdentifier(table)}`);
  return Number(row?.n ?? 0);
}

function toIndexOrigin(value: CellValue | undefined): IndexInfo['origin'] {
  const origin = asText(value);
  if (origin === 'pk' || origin === 'u') return origin;
  return 'c';
}

function readIndexColumns(db: Database, indexName: string): string[] {
  return queryRows(db, `PRAGMA index_info(${quoteIdentifier(indexName)})`)
    .sort((a, b) => Number(a.seqno) - Number(b.seqno))
    .map((row) => asText(row.name) || '(ekspresi)');
}

const ORIGIN_RANK: Record<IndexInfo['origin'], number> = { pk: 0, u: 1, c: 2 };

/** Index milik tabel (PRAGMA index_list + index_info): PK dulu, lalu UNIQUE, lalu eksplisit (alfabetis). */
export function readIndexes(db: Database, table: string): IndexInfo[] {
  return queryRows(db, `PRAGMA index_list(${quoteIdentifier(table)})`)
    .map((row): IndexInfo => {
      const name = asText(row.name);
      return {
        name,
        columns: readIndexColumns(db, name),
        unique: Number(row.unique) === 1,
        origin: toIndexOrigin(row.origin),
        partial: Number(row.partial) === 1,
      };
    })
    .sort((a, b) => ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin] || a.name.localeCompare(b.name));
}

export function getSchemaInfo(db: Database): TableInfo[] {
  const existing = listUserTables(db);
  const known = TABLE_ORDER.filter((t) => existing.includes(t));
  const others = existing.filter((t) => !isTableName(t));

  return [...known, ...others].map((name) => ({
    name,
    description: isTableName(name) ? TABLE_DESCRIPTIONS[name] : '',
    columns: readColumns(db, name),
    indexes: readIndexes(db, name),
    rowCount: countRows(db, name),
  }));
}

/**
 * Daftar tabel & view beserta nama/tipe kolomnya — versi ringan getSchemaInfo (tanpa hitung baris,
 * index, atau foreign key) untuk autocomplete editor. Urutan: tabel SIMRS dulu, lalu objek buatan user.
 */
export function readTableColumns(db: Database): Array<{ name: string; columns: Array<{ name: string; type: string }> }> {
  const names = queryRows(
    db,
    "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND substr(name, 1, 7) <> 'sqlite_' ORDER BY name",
  ).map((row) => asText(row.name));
  const ordered = [...TABLE_ORDER.filter((t) => names.includes(t)), ...names.filter((n) => !isTableName(n))];
  return ordered.map((name) => ({
    name,
    columns: queryRows(db, `PRAGMA table_info(${quoteIdentifier(name)})`).map((col) => ({ name: asText(col.name), type: asText(col.type) })),
  }));
}

export function previewTable(db: Database, table: string, limit = 5): QueryResult {
  const exists = queryRows(
    db,
    "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?",
    [table],
  );
  if (exists.length === 0) return { columns: [], rows: [] };

  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 5;
  const stmt = db.prepare(`SELECT * FROM ${quoteIdentifier(table)} LIMIT ${safeLimit}`);
  try {
    return runStatement(stmt) ?? { columns: [], rows: [] };
  } finally {
    stmt.free();
  }
}
