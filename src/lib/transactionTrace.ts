/**
 * Pelacakan transaksi per statement untuk misi DML & transaksi.
 *
 * Hasil akhir tabel saja tidak membuktikan atomisitas: `BEGIN; UPDATE ...; COMMIT; DELETE ...;`
 * menghasilkan isi tabel yang sama dengan solusi, padahal DELETE-nya berjalan di luar transaksi.
 * Karena itu SQL user dijalankan ulang statement demi statement di DB segar, dan setelah setiap
 * statement diperiksa: berapa baris yang berubah (selisih total_changes()) dan apakah transaksi
 * sedang aktif (probe BEGIN yang tidak mengubah apa pun).
 */
import type { Database } from 'sql.js';
import type { ExecFailure } from '../types';
import { forEachStatement, getTotalChanges, stripCommentsAndStrings } from './sqlEngine';

export interface TransactionTrace {
  /** Teks statement yang mengubah data dalam mode autocommit (di luar BEGIN … COMMIT). */
  autocommitChanges: string[];
  /** Jumlah baris berubah yang kemudian dibatalkan oleh ROLLBACK. */
  rolledBackChanges: number;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * true jika masih ada transaksi aktif. BEGIN gagal dengan "cannot start a transaction within a
 * transaction" bila ada; bila tidak ada, transaksi probe langsung di-ROLLBACK (tanpa efek).
 */
export function isTransactionActive(db: Database): boolean {
  try {
    db.exec('BEGIN');
  } catch (err) {
    return /within a transaction/i.test(errorText(err));
  }
  try {
    db.exec('ROLLBACK');
  } catch {
    /* tidak mungkin terjadi: probe BEGIN baru saja sukses */
  }
  return false;
}

/** ROLLBACK yang mengakhiri transaksi (bukan ROLLBACK TO SAVEPOINT). */
const ROLLBACK_STATEMENT = /^\s*ROLLBACK\b(?!\s+(?:TRANSACTION\s+)?TO\b)/i;

/** Jalankan `sql` di `db` (sebaiknya DB segar) sambil mencatat perilaku transaksinya. */
export function traceTransactions(db: Database, sql: string): TransactionTrace | ExecFailure {
  const trace: TransactionTrace = { autocommitChanges: [], rolledBackChanges: 0 };
  let pendingChanges = 0;
  let changesBefore = getTotalChanges(db);

  const failure = forEachStatement(db, sql, (statementSql) => {
    const changesAfter = getTotalChanges(db);
    const changed = Math.max(changesAfter - changesBefore, 0);
    changesBefore = changesAfter;

    if (isTransactionActive(db)) {
      pendingChanges += changed;
      return;
    }
    if (ROLLBACK_STATEMENT.test(stripCommentsAndStrings(statementSql))) {
      trace.rolledBackChanges += pendingChanges;
    } else if (changed > 0) {
      trace.autocommitChanges.push(statementSql);
    }
    pendingChanges = 0;
  });

  return failure ?? trace;
}
