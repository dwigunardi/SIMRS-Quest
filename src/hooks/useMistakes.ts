import { useCallback, useEffect, useRef, useState } from 'react';
import { isMistakeKind, type MistakeEvent, type MistakeKind } from '../lib/mistakes';

/**
 * Riwayat Peta Kelemahan, disimpan di browser terpisah dari progres XP (tanpa migrasi data progres):
 * - `events`: kesalahan per percobaan (maks. MAX_EVENTS terbaru)
 * - `solved`: waktu jawaban BENAR terakhir per misi — termasuk latihan ulang misi yang sudah selesai, sehingga
 *   kesalahan saat latihan ulang bisa ditandai "teratasi" lagi setelah dijawab benar.
 * Disinkronkan antar-tab lewat event `storage`. localStorage bisa tidak tersedia → berlaku untuk sesi ini saja.
 */
export const MISTAKES_STORAGE_KEY = 'simrs-sql-quest:mistakes:v1';
const STORAGE_KEY = MISTAKES_STORAGE_KEY;
const MAX_EVENTS = 1000;

export interface MistakeLog {
  events: readonly MistakeEvent[];
  solved: Readonly<Record<string, string>>;
}

const EMPTY: MistakeLog = { events: [], solved: {} };

function isEvent(value: unknown): value is MistakeEvent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.missionId === 'string' && typeof v.kind === 'string' && isMistakeKind(v.kind) && typeof v.at === 'string';
}

/** Baca riwayat kesalahan dari teks JSON (juga dipakai impor cadangan); data rusak → kosong. */
export function parseMistakeLog(raw: string | null): MistakeLog {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    // Format awal: array kejadian saja.
    if (Array.isArray(parsed)) return { events: parsed.filter(isEvent).slice(-MAX_EVENTS), solved: {} };
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const { events, solved } = parsed as Record<string, unknown>;
    const solvedMap: Record<string, string> = {};
    if (typeof solved === 'object' && solved !== null && !Array.isArray(solved)) {
      for (const [id, at] of Object.entries(solved)) if (typeof at === 'string') solvedMap[id] = at;
    }
    return { events: Array.isArray(events) ? events.filter(isEvent).slice(-MAX_EVENTS) : [], solved: solvedMap };
  } catch {
    return EMPTY;
  }
}

/** Isi storage terbaru, atau null bila storage tidak tersedia / belum pernah ditulis. */
function readStored(): MistakeLog | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : parseMistakeLog(raw);
  } catch {
    return null;
  }
}

function load(): MistakeLog {
  return readStored() ?? EMPTY;
}

function save(log: MistakeLog): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    /* penyimpanan penuh / tidak tersedia */
  }
}

export interface MistakesApi extends MistakeLog {
  record: (missionId: string, kind: MistakeKind) => void;
  /** Catat jawaban benar (dipanggil di setiap percobaan yang benar). */
  markSolved: (missionId: string) => void;
  reset: () => void;
}

export function useMistakes(): MistakesApi {
  const [log, setLog] = useState<MistakeLog>(load);

  // Tab lain menulis (kesalahan baru / reset) → muat ulang agar tidak saling menimpa.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setLog(parseMistakeLog(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Salinan state terbaru untuk dipakai di luar updater (updater setState harus murni — StrictMode memanggilnya 2×).
  const logRef = useRef(log);
  logRef.current = log;

  /** Perbarui berdasarkan isi storage TERBARU (tab lain mungkin sudah menulis), simpan, lalu set state. */
  const update = useCallback((change: (latest: MistakeLog) => MistakeLog) => {
    const next = change(readStored() ?? logRef.current);
    save(next);
    logRef.current = next;
    setLog(next);
  }, []);

  const record = useCallback(
    (missionId: string, kind: MistakeKind) =>
      update((latest) => ({ ...latest, events: [...latest.events, { missionId, kind, at: new Date().toISOString() }].slice(-MAX_EVENTS) })),
    [update],
  );

  const markSolved = useCallback(
    (missionId: string) => update((latest) => ({ ...latest, solved: { ...latest.solved, [missionId]: new Date().toISOString() } })),
    [update],
  );

  const reset = useCallback(() => {
    save(EMPTY);
    logRef.current = EMPTY;
    setLog(EMPTY);
  }, []);

  return { events: log.events, solved: log.solved, record, markSolved, reset };
}
