/**
 * Cadangan progres: Ekspor mengunduh file JSON berisi progres/kesalahan/materi, Impor di "komputer lain" (browser
 * kosong) memulihkan semuanya setelah halaman dimuat ulang, dan file yang salah ditolak tanpa mengubah progres.
 */
import { PROGRESS_KEY, progressWith, type SuiteContext } from '../context';

const MISTAKES_KEY = 'simrs-sql-quest:mistakes:v1';
const MATERI_KEY = 'simrs-sql-quest:materi-read:v1';
const DONE = ['t1-select', 't1-where', 't1-like'];

/** Tangkap unduhan: klik <a download> dicatat, isinya dibaca dari blob URL sebelum dicabut. */
const CAPTURE_DOWNLOAD = `
window.__downloads = [];
HTMLAnchorElement.prototype.click = function () {
  const name = this.download;
  window.__downloads.push(fetch(this.href).then(r => r.text()).then(text => ({ name, text })));
};
true;
`;

function importFile(text: string, name = 'cadangan.json'): string {
  return `(() => {
    const input = document.querySelector('[data-testid="backup-file"]');
    const dt = new DataTransfer();
    dt.items.add(new File([${JSON.stringify(text)}], ${JSON.stringify(name)}, { type: 'application/json' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`;
}

const headerXp = `(() => document.querySelector('[title^="Total XP:"]')?.title ?? '')()`;

export async function backupSuite(t: SuiteContext): Promise<void> {
  await t.fresh({
    [PROGRESS_KEY]: progressWith(DONE, 't1-order-limit'),
    [MISTAKES_KEY]: { events: [{ missionId: 't1-where', kind: 'rows-missing', at: '2026-11-20T03:00:00.000Z' }], solved: {} },
    [MATERI_KEY]: ['where'],
  });
  t.check('progres awal tampil (150 XP)', (await t.evaluate<string>(headerXp)) === 'Total XP: 150');

  // ---- Ekspor ----
  await t.evaluate(`__t.mode('Progres')`);
  t.check('kartu Cadangan progres tampil di mode Progres', await t.evaluate(`__t.waitHas('Cadangan progres', 5000)`));
  await t.evaluate(CAPTURE_DOWNLOAD);
  await t.evaluate(`__t.click('Ekspor ke file')`);
  const file = await t.evaluate<{ name: string; text: string } | null>(`(window.__downloads[0] ?? Promise.resolve(null))`);
  t.check('Ekspor mengunduh file .json bertanggal', !!file && /^simrs-sql-quest-progres-\d{4}-\d{2}-\d{2}\.json$/.test(file.name), file?.name);
  let content: { app?: string; progress?: { xp?: number }; mistakes?: { events?: unknown[] }; materiRead?: string[] } = {};
  try {
    content = JSON.parse(file?.text ?? '{}') as typeof content;
  } catch {
    /* dicek di bawah */
  }
  t.check(
    'isi file: progres, riwayat kesalahan, dan materi',
    content.app === 'simrs-sql-quest' && content.progress?.xp === 150 && content.mistakes?.events?.length === 1 && content.materiRead?.[0] === 'where',
  );
  t.check('pesan konfirmasi ekspor tampil', await t.evaluate(`__t.waitText('Cadangan diunduh', 3000)`));

  // ---- Impor di browser kosong ("komputer lain") ----
  await t.fresh();
  t.check('browser kosong: 0 XP', (await t.evaluate<string>(headerXp)) === 'Total XP: 0');
  await t.evaluate(`__t.mode('Progres')`);
  await t.evaluate(`__t.waitHas('Cadangan progres', 5000)`);
  await t.evaluate(importFile(file?.text ?? ''));
  await t.sleep(500);
  await t.browser.waitForLoad();
  await t.installHelpers();
  await t.evaluate(`__t.waitText('Peta Misi', 15000)`);
  t.check('setelah impor & muat ulang: XP pulih (150)', (await t.evaluate<string>(headerXp)) === 'Total XP: 150');
  const stored = await t.evaluate<{ mistakes: number; materi: string }>(
    `({ mistakes: JSON.parse(localStorage.getItem(${JSON.stringify(MISTAKES_KEY)}) ?? '{}').events?.length ?? 0, materi: localStorage.getItem(${JSON.stringify(MATERI_KEY)}) ?? '' })`,
  );
  t.check('riwayat kesalahan & materi ikut pulih', stored.mistakes === 1 && stored.materi === '["where"]', JSON.stringify(stored));

  // ---- File yang salah ditolak tanpa mengubah progres ----
  await t.evaluate(`__t.mode('Progres')`);
  await t.evaluate(`__t.waitHas('Cadangan progres', 5000)`);
  await t.evaluate(importFile('ini bukan json', 'catatan.txt'));
  t.check('file bukan JSON ditolak dengan pesan', await t.evaluate(`__t.waitText('bukan JSON yang valid', 3000)`));
  await t.evaluate(importFile(JSON.stringify({ app: 'aplikasi-lain', format: 1 })));
  t.check('file aplikasi lain ditolak', await t.evaluate(`__t.waitText('bukan cadangan progres', 3000)`));
  t.check('progres tidak berubah setelah impor gagal', (await t.evaluate<string>(headerXp)) === 'Total XP: 150');
}
