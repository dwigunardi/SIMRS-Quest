/**
 * Alur "Pulihkan dari file cadangan" di Beranda: pilih file → validasi → ringkasan + konfirmasi di halaman → tulis →
 * muat ulang. Memakai langkah yang sama dengan kartu Cadangan progres (lib/backupImport), yang diimpor DINAMIS supaya
 * Beranda tetap ringan. File yang salah ditolak dengan pesan jelas tanpa mengubah apa pun.
 */
import { useCallback, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import type { BackupFile, BackupStorage } from '../../lib/backup';
import { browserStorage } from '../../lib/storageGuard';

export type RestoreState =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'error'; text: string }
  | {
      kind: 'confirm';
      /** Kapan cadangan dibuat (sudah diformat). */
      exportedAt: string;
      /** Ringkasan isi file. */
      incoming: string;
      /** Ringkasan isi browser saat ini; null bila masih kosong (tidak ada yang tertimpa). */
      current: string | null;
    };

export interface BackupRestore {
  state: RestoreState;
  /** Pasang pada <input type="file"> tersembunyi. */
  inputRef: RefObject<HTMLInputElement>;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Buka pemilih file. */
  pick: () => void;
  /** Setujui ringkasan: tulis cadangan lalu muat ulang halaman. */
  confirm: () => void;
  cancel: () => void;
}

interface Pending {
  backup: BackupFile;
  restore: (storage: BackupStorage, backup: BackupFile) => boolean;
  writeFailed: string;
}

const MODULE_FAILED = 'Bagian cadangan tidak bisa dimuat. Periksa koneksi lalu coba lagi.';

export function useBackupRestore(onRestored?: () => void): BackupRestore {
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = useRef<Pending | null>(null);
  const [state, setState] = useState<RestoreState>({ kind: 'idle' });

  const readFile = useCallback(async (file: File) => {
    pending.current = null;
    setState({ kind: 'reading' });
    try {
      const mod = await import('../../lib/backupImport');
      const result = await mod.readBackupFile(file, browserStorage());
      if (!result.ok) {
        setState({ kind: 'error', text: result.error });
        return;
      }
      pending.current = { backup: result.backup, restore: mod.restoreBackup, writeFailed: mod.WRITE_FAILED_MESSAGE };
      setState({
        kind: 'confirm',
        exportedAt: mod.formatBackupDate(result.summary.exportedAt),
        incoming: mod.describeSummary(result.summary),
        current: mod.isEmptySummary(result.current) ? null : mod.describeSummary(result.current),
      });
    } catch {
      setState({ kind: 'error', text: MODULE_FAILED });
    }
  }, []);

  const onFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = ''; // file yang sama bisa dipilih lagi
      if (file) void readFile(file);
    },
    [readFile],
  );

  const pick = useCallback(() => inputRef.current?.click(), []);

  const cancel = useCallback(() => {
    pending.current = null;
    setState({ kind: 'idle' });
  }, []);

  const confirm = useCallback(() => {
    const ready = pending.current;
    const storage = browserStorage();
    if (!ready || !storage) return;
    const written = ready.restore(storage, ready.backup);
    onRestored?.();
    // Pesan di halaman akan hilang saat dimuat ulang, jadi kegagalan ditampilkan lewat alert.
    if (!written) window.alert(ready.writeFailed);
    window.location.reload();
  }, [onRestored]);

  return { state, inputRef, onFile, pick, confirm, cancel };
}
