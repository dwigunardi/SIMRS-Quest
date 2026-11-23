/**
 * Lab Performa: data besar dibangkitkan di worker terpisah (halaman tetap responsif), percobaan SCAN → CREATE INDEX →
 * SEARCH terlihat di plan dan di waktu, riwayat run untuk perbandingan, database sesi Playground tidak tersentuh,
 * Reset data besar, dan tombol "Uji di data besar" dari misi optimasi.
 */
import { MISSIONS } from '../../../src/data/missions';
import { PROGRESS_KEY, progressWith, type SuiteContext } from '../context';

const BEFORE_SARGABLE = MISSIONS.filter((m) => m.tier < 7 || m.id === 't7-index').map((m) => m.id);
const waitTime = `(async () => { const t0 = Date.now(); while (Date.now() - t0 < 45000) { const el = document.querySelector('[data-testid="lab-time"]'); if (el && !document.querySelector('[role="status"] .animate-spin')) return el.innerText; await new Promise(r => setTimeout(r, 100)); } return null; })()`;
const planChips = `[...document.querySelectorAll('[data-testid="lab-plan"] li span:first-child')].map(e => e.innerText)`;
const historyMs = `[...document.querySelectorAll('[data-testid="lab-history"] li')].map(li => { const m = li.innerText.match(/([\\d.,]+) ms/); return m ? Number(m[1].replace(/\\./g, '').replace(',', '.')) : NaN; })`;

export async function perfLabSuite(t: SuiteContext): Promise<void> {
  await t.fresh();
  await t.evaluate(`__t.mode('Free Playground')`);
  await t.evaluate(`[...document.querySelectorAll('[aria-label="Target database"] button')].find(b => b.innerText.includes('Data besar')).click(); true`);
  t.check('Lab Performa tampil dengan percobaan siap pakai', await t.evaluate(`__t.waitHas('Lab Performa — data besar', 5000).then(ok => ok && __t.has('1a. Cari satu SEP'))`));

  // 1a: tanpa index → SCAN. Selama data besar dibangkitkan, halaman harus tetap responsif.
  await t.evaluate(`__t.click('Jalankan & ukur')`);
  await t.sleep(700);
  const ping = await t.browser.pingMs();
  t.check('halaman tetap responsif saat data besar disiapkan di worker', ping < 1000, `ping ${ping} ms`);
  const time1 = await t.evaluate<string | null>(waitTime);
  t.check('run pertama selesai dan menampilkan waktu', time1 !== null, time1 ?? 'tidak selesai dalam 45 dtk');
  t.check('catatan: data besar disiapkan pada run ini', await t.evaluate(`__t.has('data besar disiapkan dalam')`));
  t.check('plan 1a = SCAN', (await t.evaluate<string[]>(planChips)).includes('SCAN'), (await t.evaluate<string[]>(planChips)).join(','));

  // 1b: CREATE INDEX + query yang sama → SEARCH, lebih cepat.
  await t.evaluate(`[...document.querySelectorAll('[aria-label="Percobaan siap pakai"] button')].find(b => b.innerText.startsWith('1b.')).click(); true`);
  await t.sleep(200);
  await t.evaluate(`__t.click('Jalankan & ukur')`);
  await t.sleep(400);
  await t.evaluate<string | null>(waitTime);
  const chips2 = await t.evaluate<string[]>(planChips);
  t.check('plan 1b = SEARCH (tanpa SCAN)', chips2.includes('SEARCH') && !chips2.includes('SCAN'), chips2.join(','));
  t.check('waktu membuat index ditampilkan terpisah dari waktu SELECT', await t.evaluate(`__t.has('hanya SELECT penutup') && __t.has('persiapan sebelumnya')`));
  const times = await t.evaluate<number[]>(historyMs);
  t.check('riwayat berisi 2 run', times.length === 2, times.join(' / '));
  t.check('dengan index jauh lebih cepat daripada SCAN', times.length === 2 && (times[1] ?? Infinity) < (times[0] ?? 0), `${times[0]} ms → ${times[1]} ms`);
  t.check('hasil tetap 1 baris', await t.evaluate(`__t.has('1 baris hasil')`));

  // Database sesi Playground tidak tersentuh (tetap 32 kunjungan, tanpa index buatan lab).
  await t.evaluate(`[...document.querySelectorAll('[aria-label="Target database"] button')].find(b => b.innerText.includes('Database sesi')).click(); true`);
  await t.evaluate(`__t.setSql("SELECT COUNT(*) AS jumlah, (SELECT COUNT(*) FROM sqlite_schema WHERE name = 'idx_kunjungan_sep') AS index_lab FROM kunjungan"); __t.tick().then(() => __t.click('Run'))`);
  await t.evaluate(`__t.waitText('Query berhasil', 15000)`);
  t.check('database sesi tidak tersentuh (32 kunjungan, tanpa index lab)', await t.evaluate(`/jumlah\\s+index_lab\\s+1\\s+32\\s+0/.test(__t.tableFlat())`), await t.evaluate(`__t.tableFlat().slice(0, 60)`));

  // Reset data besar.
  await t.evaluate(`[...document.querySelectorAll('[aria-label="Target database"] button')].find(b => b.innerText.includes('Data besar')).click(); true`);
  t.check('riwayat bertahan saat pindah target', (await t.evaluate<number[]>(historyMs)).length === 2);
  await t.evaluate(`__t.click('Reset data besar')`);
  t.check('Reset data besar mengosongkan riwayat & status', await t.evaluate(`(async () => { const t0 = Date.now(); while (Date.now() - t0 < 5000) { if (!document.querySelector('[data-testid="lab-history"]') && __t.has('disiapkan pada run pertama')) return true; await new Promise(r => setTimeout(r, 100)); } return false; })()`));

  // Dari misi optimasi: tombol "Uji di data besar" membawa query misi ke lab.
  await t.fresh({ [PROGRESS_KEY]: progressWith(BEFORE_SARGABLE, 't7-sargable') });
  await t.evaluate(`__t.waitText('Index Ada, Tapi Tidak Terpakai', 20000)`);
  t.check('misi sargable punya tombol "Uji di data besar"', await t.evaluate(`__t.buttons('Uji di data besar').length === 1`));
  await t.evaluate(`__t.click('Uji di data besar')`);
  t.check('lab terbuka dengan query misi di editor', await t.evaluate(`__t.waitHas('Lab Performa — data besar', 5000).then(ok => ok && document.querySelector('textarea').value.includes("strftime('%Y-%m', tgl_kunjungan)"))`));
}
