/**
 * State Lab Performa (diangkat ke App agar riwayat run bertahan saat pindah mode): editor, run terakhir, riwayat untuk
 * perbandingan, dan status database besar di worker lab.
 */
import { useCallback, useRef, useState } from 'react';
import { LAB_PRESETS, planSummary, type LabResult, type PlanAccess } from '../lib/perfLab';
import { LAB_TIMEOUT_MS, labGuard } from '../lib/sqlGuard';

export interface LabHistoryEntry {
  id: number;
  /** Baris pertama skrip (tanpa komentar) untuk dikenali di riwayat. */
  label: string;
  sql: string;
  elapsedMs: number;
  rowCount: number;
  access: PlanAccess;
  mutated: boolean;
}

export type LabStatus =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; result: LabResult; buildMs: number | null }
  /** Run tidak selesai: batas waktu, dihentikan, mesin kehabisan memori, atau worker tidak tersedia. */
  | { kind: 'stopped'; message: string };

const MAX_HISTORY = 12;

function labelOf(sql: string): string {
  const line = sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, '').trim())
    .filter((l) => l.length > 0)
    .join(' ');
  return line.length > 90 ? `${line.slice(0, 87)}…` : line;
}

export interface PerfLabApi {
  sql: string;
  setSql: (sql: string) => void;
  status: LabStatus;
  history: readonly LabHistoryEntry[];
  /** true bila database besar sudah pernah dibangkitkan di worker (dan belum di-reset/terbuang). */
  built: boolean;
  /** Catatan preset yang terakhir dimuat (null bila SQL diketik sendiri). */
  note: string | null;
  run: () => void;
  cancel: () => void;
  loadPreset: (id: string) => void;
  resetData: () => void;
  clearHistory: () => void;
}

export function usePerfLab(): PerfLabApi {
  const [sql, setSqlState] = useState<string>(LAB_PRESETS[0]?.sql ?? '');
  const [note, setNote] = useState<string | null>(LAB_PRESETS[0]?.note ?? null);
  const [status, setStatus] = useState<LabStatus>({ kind: 'idle' });
  const [history, setHistory] = useState<LabHistoryEntry[]>([]);
  const [built, setBuilt] = useState(false);
  const busy = useRef(false);
  const seq = useRef(0);

  const setSql = useCallback((next: string) => {
    setSqlState(next);
    setNote(null);
  }, []);

  const run = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    const script = sql;
    setStatus({ kind: 'running' });
    void labGuard.lab(script).then((outcome) => {
      busy.current = false;
      switch (outcome.status) {
        case 'done': {
          const { run: result, buildMs } = outcome.value;
          setBuilt(true);
          setStatus({ kind: 'done', result, buildMs });
          if (result.ok) {
            seq.current += 1;
            const entry: LabHistoryEntry = {
              id: seq.current,
              label: labelOf(script),
              sql: script,
              elapsedMs: result.elapsedMs,
              rowCount: result.rowCount,
              access: planSummary(result.plan),
              mutated: result.mutated,
            };
            setHistory((prev) => [...prev, entry].slice(-MAX_HISTORY));
          }
          return;
        }
        case 'timeout':
          setBuilt(false);
          setStatus({ kind: 'stopped', message: `Query melewati batas ${LAB_TIMEOUT_MS / 1000} detik dan dihentikan. Di data sebesar ini, JOIN tanpa syarat atau subquery berkorelasi tanpa index bisa butuh waktu sangat lama. Data besar dibuang dan akan disiapkan ulang pada run berikutnya (index buatanmu ikut hilang).` });
          return;
        case 'cancelled':
          setBuilt(false);
          setStatus({ kind: 'stopped', message: 'Dihentikan. Data besar dibuang dan akan disiapkan ulang pada run berikutnya (index buatanmu ikut hilang).' });
          return;
        case 'crashed':
          setBuilt(false);
          setStatus({ kind: 'stopped', message: `Mesin SQL berhenti (${outcome.message}). Biasanya karena memori browser tidak cukup untuk data besar (±75 MB) atau hasil query yang sangat besar. Tutup tab lain atau coba di komputer dengan memori lebih lega.` });
          return;
        case 'unavailable':
          setStatus({ kind: 'stopped', message: 'Lab Performa membutuhkan Web Worker, yang tidak tersedia di browser ini. Data besar tidak dijalankan di halaman utama karena akan membuat halaman macet.' });
          return;
        default: {
          const unreachable: never = outcome;
          return unreachable;
        }
      }
    });
  }, [sql]);

  const loadPreset = useCallback((id: string) => {
    const preset = LAB_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setSqlState(preset.sql);
    setNote(preset.note);
  }, []);

  const resetData = useCallback(() => {
    if (busy.current) return;
    void labGuard.labReset().then(() => {
      setBuilt(false);
      setHistory([]);
      setStatus({ kind: 'idle' });
    });
  }, []);

  return {
    sql,
    setSql,
    status,
    history,
    built,
    note,
    run,
    cancel: () => labGuard.cancel(),
    loadPreset,
    resetData,
    clearHistory: () => setHistory([]),
  };
}
