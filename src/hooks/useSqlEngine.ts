import { useCallback, useEffect, useRef, useState } from 'react';
import type { Database, SqlJsStatic } from 'sql.js';
import { canSnapshot, createSeededDatabase, executeSql, getSchemaVersion, getTotalChanges, isMutatingSql, snapshotDatabase } from '../lib/sqlEngine';
import { sqlGuard, type SessionSource } from '../lib/sqlGuard';
import { loadSqlJs } from '../lib/sqlLoader';
import type { ExecOutcome } from '../types';

export interface SqlEngine {
  status: 'loading' | 'ready' | 'error';
  SQL: SqlJsStatic | null;
  /** DB sesi yang persisten untuk playground + schema explorer. */
  db: Database | null;
  /**
   * DB seed murni yang TIDAK pernah dijalankan query user (tidak terhubung ke `run`).
   * Dipakai Schema Explorer di mode Misi agar data yang dijelajahi selalu sama
   * dengan data penilaian, walau db sesi sudah diubah di Playground.
   */
  referenceDb: Database | null;
  error: string | null;
  /** Bertambah setiap kali isi/skema db mungkin berubah (mutasi atau reset). */
  dbVersion: number;
  /** true setelah query mutasi dijalankan di db sesi; false setelah reset. */
  isDirty: boolean;
  run: (sql: string) => ExecOutcome | null;
  resetDatabase: () => void;
  /**
   * Sumber salinan DB sesi untuk uji coba di worker (lihat sqlGuard.execOnSession), atau null bila salinan tidak
   * akan setara (transaksi terbuka / objek TEMP) — query lalu dijalankan langsung tanpa batas waktu.
   */
  sessionSource: () => SessionSource | null;
}

function safeClose(db: Database | null): void {
  if (!db) return;
  try {
    db.close();
  } catch {
    /* sudah tertutup */
  }
}

export function useSqlEngine(): SqlEngine {
  const [status, setStatus] = useState<SqlEngine['status']>('loading');
  const [SQL, setSQL] = useState<SqlJsStatic | null>(null);
  const [db, setDb] = useState<Database | null>(null);
  const [referenceDb, setReferenceDb] = useState<Database | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dbVersion, setDbVersion] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  const sqlRef = useRef<SqlJsStatic | null>(null);
  const dbRef = useRef<Database | null>(null);
  const referenceDbRef = useRef<Database | null>(null);
  /** Versi isi DB sesi yang selalu terbaru (state dbVersion baru terlihat setelah render). */
  const versionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    loadSqlJs()
      .then((loaded) => {
        if (cancelled) return;
        const fresh = createSeededDatabase(loaded);
        const reference = createSeededDatabase(loaded);
        sqlRef.current = loaded;
        dbRef.current = fresh;
        referenceDbRef.current = reference;
        setSQL(loaded);
        setDb(fresh);
        setReferenceDb(reference);
        setError(null);
        setStatus('ready');
        // Muat worker SQL sekarang agar Run pertama tidak ikut menunggu mesin SQL dimuat.
        sqlGuard.warmUp();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(`Gagal memuat mesin SQL (sql.js): ${message}`);
        setStatus('error');
      });

    return () => {
      cancelled = true;
      safeClose(dbRef.current);
      safeClose(referenceDbRef.current);
      dbRef.current = null;
      referenceDbRef.current = null;
      setDb(null);
      setReferenceDb(null);
      setStatus('loading');
    };
  }, []);

  const run = useCallback((sql: string): ExecOutcome | null => {
    const current = dbRef.current;
    if (!current) return null;

    const changesBefore = getTotalChanges(current);
    const schemaBefore = getSchemaVersion(current);
    const outcome = executeSql(current, sql);
    // Juga menangkap perubahan parsial dari skrip yang gagal di tengah jalan:
    // total_changes() untuk DML, schema_version untuk DDL (CREATE/DROP/ALTER).
    const changed = getTotalChanges(current) !== changesBefore || getSchemaVersion(current) !== schemaBefore;
    const mutated = isMutatingSql(sql);

    if (mutated || changed) {
      versionRef.current += 1;
      setDbVersion((v) => v + 1);
    }
    if ((outcome.ok && outcome.mutated) || changed) setIsDirty(true);
    return outcome;
  }, []);

  const resetDatabase = useCallback(() => {
    const loaded = sqlRef.current;
    if (!loaded) return;

    safeClose(dbRef.current);
    const fresh = createSeededDatabase(loaded);
    dbRef.current = fresh;
    setDb(fresh);
    setIsDirty(false);
    versionRef.current += 1;
    setDbVersion((v) => v + 1);
  }, []);

  const sessionSource = useCallback((): SessionSource | null => {
    const current = dbRef.current;
    if (!current || !canSnapshot(current)) return null;
    return {
      version: versionRef.current,
      bytes: () => {
        const bytes = snapshotDatabase(current);
        if (!bytes) throw new Error('salinan database tidak tersedia');
        return bytes;
      },
    };
  }, []);

  return { status, SQL, db, referenceDb, error, dbVersion, isDirty, run, resetDatabase, sessionSource };
}
