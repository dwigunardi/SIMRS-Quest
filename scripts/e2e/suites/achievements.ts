/**
 * Lencana pencapaian: misi pertama memunculkan toast "Lencana baru!", galeri di mode Progres menampilkan yang diraih
 * dan kemajuan yang belum, dan pengguna lama (progres sudah ada, belum pernah melihat lencana) tidak dibanjiri toast.
 */
import { MISSIONS } from '../../../src/data/missions';
import { PROGRESS_KEY, progressWith, type SuiteContext } from '../context';

const SEEN_KEY = 'simrs-sql-quest:achievements-seen:v1';
const TIER1 = MISSIONS.filter((m) => m.tier === 1).map((m) => m.id);
const toastCount = `document.querySelectorAll('[data-testid="achievement-toast"]').length`;
const earnedIds = `[...document.querySelectorAll('[data-achievement][data-earned="ya"]')].map(e => e.dataset.achievement)`;

export async function achievementsSuite(t: SuiteContext): Promise<void> {
  // 1) Pengguna baru: menyelesaikan misi pertama → toast.
  await t.fresh();
  await t.evaluate(`__t.waitText('Hari Pertama di Unit IT', 20000)`);
  t.check('belum ada toast sebelum ada pencapaian', (await t.evaluate<number>(toastCount)) === 0);
  await t.evaluate(`__t.setSql('select nama_dokter, spesialisasi from dokter'); __t.tick().then(() => __t.click('Run & Check'))`);
  await t.evaluate(`__t.waitText('Jawaban benar!', 15000)`);
  t.check('misi pertama selesai → toast "Lencana baru!"', await t.evaluate(`__t.waitHas('Lencana baru!', 5000)`));
  t.check('toast menyebut lencana "Hari Pertama"', await t.evaluate(`[...document.querySelectorAll('[data-testid="achievement-toast"]')].some(e => e.innerText.includes('Hari Pertama'))`));

  await t.evaluate(`__t.mode('Progres')`);
  t.check('galeri lencana tampil di mode Progres', await t.evaluate(`__t.waitHas('Lencana pencapaian', 5000)`));
  const count = await t.evaluate<string>(`document.querySelector('[data-testid="achievements-count"]')?.innerText ?? ''`);
  t.check('1 lencana diraih', /^1\/\d+ diraih$/.test(count), count);
  t.check('lencana belum diraih menampilkan kemajuan (Tepat Sasaran 1/10)', await t.evaluate(`document.querySelector('[data-achievement="tepat-sasaran"]')?.innerText.includes('1/10') ?? false`));
  t.check('daftar "sudah diumumkan" tersimpan', (await t.evaluate<string>(`localStorage.getItem(${JSON.stringify(SEEN_KEY)}) ?? ''`)).includes('hari-pertama'));

  // 2) Pengguna lama: progres sudah ada, kunci lencana belum ada → dicatat diam-diam, tanpa toast.
  await t.fresh({ [PROGRESS_KEY]: progressWith(TIER1, 't2-inner-join') });
  await t.evaluate(`__t.waitText('Peta Misi', 20000)`);
  await t.sleep(1500);
  t.check('pengguna lama: tidak ada toast saat aplikasi dibuka', (await t.evaluate<number>(toastCount)) === 0);
  await t.evaluate(`__t.mode('Progres')`);
  await t.evaluate(`__t.waitHas('Lencana pencapaian', 5000)`);
  const earned = await t.evaluate<string[]>(earnedIds);
  t.check('lencana lama tetap terhitung (Hari Pertama, Boss Pertama, Sekali Tebas, Mandiri)', ['hari-pertama', 'boss-pertama', 'sekali-tebas', 'mandiri'].every((id) => earned.includes(id)), earned.join(', '));

  await t.reload();
  await t.sleep(1200);
  t.check('setelah refresh tetap tanpa toast', (await t.evaluate<number>(toastCount)) === 0);
}
