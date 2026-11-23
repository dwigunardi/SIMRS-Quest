/**
 * Verifikasi cadangan progres (src/lib/backup.ts): ekspor → impor menghasilkan data yang sama, file yang salah ditolak
 * dengan pesan jelas, dan bagian opsional yang rusak dibersihkan tanpa menggagalkan impor progres.
 */
import { applyBackup, backupFileName, createBackup, parseBackup, type BackupStorage } from '../../src/lib/backup';
import { STORAGE_KEY as PROGRESS_KEY, createEmptyProgress } from '../../src/lib/progress';
import { MISTAKES_STORAGE_KEY } from '../../src/hooks/useMistakes';
import { ARTICLE_READS_STORAGE_KEY } from '../../src/hooks/useArticleReads';
import type { UserProgress } from '../../src/types';
import { assert } from './report';

class MemoryStorage implements BackupStorage {
  private readonly data = new Map<string, string>();
  constructor(private readonly failWrites = false) {}
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
}

const NOW = new Date('2026-11-22T10:30:00+07:00');

function sampleProgress(): UserProgress {
  return {
    ...createEmptyProgress(),
    xp: 450,
    streak: { current: 3, best: 5, lastActiveDate: '2026-11-21' },
    missions: {
      't1-select': { completed: true, earnedXp: 50, hintUsed: false, hintsRevealed: 0, solutionShown: false, attempts: 1, completedAt: '2026-11-20T02:00:00.000Z' },
      'boss-t1-skrining': { completed: false, earnedXp: 0, hintUsed: false, hintsRevealed: 0, solutionShown: false, attempts: 2, completedAt: null },
    },
    lastMissionId: 'boss-t1-skrining',
  };
}

export function verifyBackup(): void {
  let checks = 0;
  const ok = (cond: boolean, msg: string) => {
    checks += 1;
    assert(cond, `cadangan: ${msg}`);
  };

  // Ekspor → impor ke browser lain → isinya sama.
  const source = new MemoryStorage();
  source.setItem(PROGRESS_KEY, JSON.stringify(sampleProgress()));
  source.setItem(MISTAKES_STORAGE_KEY, JSON.stringify({ events: [{ missionId: 't1-where', kind: 'rows-missing', at: '2026-11-20T03:00:00.000Z' }], solved: { 't1-where': '2026-11-20T03:05:00.000Z' } }));
  source.setItem(ARTICLE_READS_STORAGE_KEY, JSON.stringify(['select-dasar', 'where']));
  const file = JSON.stringify(createBackup(source, NOW));
  const parsed = parseBackup(file);
  ok(parsed.ok, 'file hasil ekspor harus bisa diimpor');
  if (!parsed.ok) return;
  ok(parsed.summary.xp === 450 && parsed.summary.completed === 1 && parsed.summary.mistakes === 1 && parsed.summary.articlesRead === 2, 'ringkasan cadangan salah');
  const target = new MemoryStorage();
  target.setItem(PROGRESS_KEY, JSON.stringify({ ...createEmptyProgress(), xp: 9999 }));
  ok(applyBackup(target, parsed.backup), 'applyBackup harus berhasil');
  for (const key of [PROGRESS_KEY, MISTAKES_STORAGE_KEY, ARTICLE_READS_STORAGE_KEY]) {
    ok(target.getItem(key) === source.getItem(key), `isi ${key} setelah impor harus sama dengan sumbernya (progres lama diganti, bukan digabung)`);
  }
  ok(backupFileName(NOW) === 'simrs-sql-quest-progres-2026-11-22.json', `nama file: ${backupFileName(NOW)}`);

  // Browser kosong / data rusak tetap menghasilkan file yang valid.
  const empty = new MemoryStorage();
  empty.setItem(PROGRESS_KEY, '{rusak');
  const fromEmpty = parseBackup(JSON.stringify(createBackup(empty, NOW)));
  ok(fromEmpty.ok && fromEmpty.summary.xp === 0, 'ekspor dari storage kosong/rusak harus tetap valid (progres kosong)');

  // File yang salah ditolak.
  const rejects: Array<[string, string]> = [
    ['bukan json', 'bukan JSON'],
    ['[1,2,3]', 'tidak dikenali'],
    [JSON.stringify({ app: 'aplikasi-lain', format: 1, progress: sampleProgress() }), 'bukan cadangan'],
    [JSON.stringify({ app: 'simrs-sql-quest', format: 2, progress: sampleProgress() }), 'lebih baru'],
    [JSON.stringify({ app: 'simrs-sql-quest', format: 1, progress: { version: 1, xp: -5 } }), 'rusak'],
    [JSON.stringify({ app: 'simrs-sql-quest', format: 1 }), 'rusak'],
  ];
  for (const [text, expected] of rejects) {
    const result = parseBackup(text);
    ok(!result.ok && result.error.includes(expected), `${text.slice(0, 40)} harus ditolak dengan pesan berisi "${expected}"`);
  }

  // Bagian opsional rusak → dibersihkan, progres tetap diimpor.
  const messy = parseBackup(
    JSON.stringify({
      app: 'simrs-sql-quest',
      format: 1,
      exportedAt: 'bukan tanggal',
      progress: sampleProgress(),
      mistakes: { events: [{ missionId: 'x', kind: 'jenis-palsu', at: 'kapan' }, 'sampah'], solved: { a: 5 } },
      materiRead: ['where', 7, null],
    }),
  );
  ok(messy.ok && messy.summary.mistakes === 0 && messy.summary.articlesRead === 1 && messy.summary.exportedAt === '', 'bagian opsional yang rusak harus dibersihkan tanpa menolak impor');

  // Penyimpanan menolak tulis → dilaporkan.
  ok(!applyBackup(new MemoryStorage(true), parsed.backup), 'applyBackup harus melaporkan kegagalan penyimpanan');

  console.log(`  ${checks} pemeriksaan ekspor/impor progres ✓`);
}
