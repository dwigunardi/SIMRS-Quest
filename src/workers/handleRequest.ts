/**
 * Logika worker SQL tanpa ketergantungan pada API worker, sehingga bisa diuji di Node (scripts/verify).
 */
import type { Database, SqlJsStatic } from 'sql.js';
import { createBigDatabase } from '../lib/bigData';
import { runLab } from '../lib/perfLab';
import { getMissionById } from '../data/missions';
import { runInjection } from '../lib/injection';
import { createSeededDatabase, executeSql } from '../lib/sqlEngine';
import { checkMission } from '../lib/validator';
import { SNAPSHOT_MISSING, type LabReply, type WorkerRequest } from './protocol';

export interface WorkerState {
  /** Salinan terakhir DB sesi Playground (bytes file SQLite). */
  session: { version: number; bytes: Uint8Array } | null;
  /** Database besar Lab Performa (dibangkitkan saat pertama dipakai, hidup selama worker hidup). */
  big: Database | null;
}

export function createWorkerState(): WorkerState {
  return { session: null, big: null };
}

function labRun(SQL: SqlJsStatic, state: WorkerState, sql: string): LabReply {
  let buildMs: number | null = null;
  if (!state.big) {
    const start = performance.now();
    state.big = createBigDatabase(SQL);
    buildMs = performance.now() - start;
  }
  return { buildMs, run: runLab(state.big, sql) };
}

function labReset(state: WorkerState): { reset: true } {
  state.big?.close();
  state.big = null;
  return { reset: true };
}

function execOnSession(SQL: SqlJsStatic, state: WorkerState, request: Extract<WorkerRequest, { type: 'exec' }>) {
  const snapshot = request.session;
  if (!snapshot) {
    const db = createSeededDatabase(SQL);
    try {
      return executeSql(db, request.sql);
    } finally {
      db.close();
    }
  }
  if (snapshot.bytes) state.session = { version: snapshot.version, bytes: snapshot.bytes };
  if (!state.session || state.session.version !== snapshot.version) throw new Error(SNAPSHOT_MISSING);
  // Selalu salinan baru: uji coba tidak boleh menumpuk perubahan pada salinan yang dipakai ulang.
  const db = new SQL.Database(state.session.bytes);
  try {
    // PRAGMA tingkat koneksi tidak ikut tersimpan di file — samakan dengan DB sesi (lihat SCHEMA_SQL).
    db.run('PRAGMA foreign_keys = ON');
    return executeSql(db, request.sql);
  } finally {
    db.close();
  }
}

/** Menjalankan satu permintaan. Melempar Error untuk permintaan yang tidak valid. */
export function handleRequest(SQL: SqlJsStatic, state: WorkerState, request: WorkerRequest): unknown {
  switch (request.type) {
    case 'check': {
      const mission = getMissionById(request.missionId);
      if (mission?.kind !== 'sql') throw new Error(`misi SQL '${request.missionId}' tidak ditemukan`);
      return checkMission(SQL, mission, request.sql);
    }
    case 'inject': {
      const mission = getMissionById(request.missionId);
      if (mission?.kind !== 'injection') throw new Error(`lab injection '${request.missionId}' tidak ditemukan`);
      return runInjection(SQL, mission, request.input, request.safeMode);
    }
    case 'exec':
      return execOnSession(SQL, state, request);
    case 'lab':
      return labRun(SQL, state, request.sql);
    case 'lab-reset':
      return labReset(state);
    default: {
      const unreachable: never = request;
      throw new Error(`permintaan tidak dikenal: ${JSON.stringify(unreachable)}`);
    }
  }
}

/** Pesan error yang menandakan mesin SQL (WASM) rusak — worker harus dibuang, bukan dipakai ulang. */
const FATAL = /^Aborted|out of memory|memory access out of bounds|unreachable|RuntimeError/i;

function errorOf(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as { rawError?: unknown; outcome?: unknown; check?: unknown; run?: unknown };
  if (typeof v.rawError === 'string') return v.rawError;
  return errorOf(v.outcome) ?? errorOf(v.check) ?? errorOf(v.run);
}

/**
 * Pesan error fatal di hasil permintaan (CheckResult / ExecOutcome / InjectionRun), atau null. Error seperti ini sudah
 * "ditangkap" sebagai error SQL biasa oleh executeSql, tetapi mesin SQL di worker mungkin tidak bisa dipakai lagi.
 */
export function fatalErrorIn(value: unknown): string | null {
  const error = errorOf(value);
  return error !== null && FATAL.test(error) ? error : null;
}
