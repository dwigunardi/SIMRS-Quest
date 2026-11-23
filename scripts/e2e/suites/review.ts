/**
 * Latihan ulang terjadwal: lencana jatuh tempo di header, sesi berprioritas (misi yang sering salah lebih dulu), tanpa
 * batas waktu, rapor dengan jadwal berikutnya, jumlah jatuh tempo berkurang, dan streak bertambah.
 */
import { MISSIONS } from '../../../src/data/missions';
import { PROGRESS_KEY, progressWith, type SuiteContext } from '../context';

const SESSION_KEY = 'simrs-sql-quest:exam-session:v1';
const REVIEW_KEY = 'simrs-sql-quest:review:v1';
const MISTAKES_KEY = 'simrs-sql-quest:mistakes:v1';
const TIER1 = MISSIONS.filter((m) => m.tier === 1).map((m) => m.id);
const REVIEWABLE = MISSIONS.filter((m) => m.tier === 1 && (m.kind === 'predict' || (m.kind === 'sql' && !m.boss))).length;

export async function reviewSuite(t: SuiteContext): Promise<void> {
  const progress = { ...progressWith(TIER1, 't2-inner-join'), streak: { current: 4, best: 4, lastActiveDate: '2000-01-01' } };
  const recent = new Date(Date.now() - 86_400_000).toISOString();
  await t.fresh({
    [PROGRESS_KEY]: progress,
    [MISTAKES_KEY]: { events: [{ missionId: 't1-where', kind: 'rows-missing', at: recent }, { missionId: 't1-where', kind: 'rows-missing', at: recent }], solved: {} },
  });
  await t.evaluate(`__t.waitText('Peta Misi', 20000)`);
  const badge = await t.evaluate<string>(`document.querySelector('[data-testid="header-review-due"]')?.innerText.replace(/\\D/g, '') ?? ''`);
  t.check(`lencana header: ${REVIEWABLE} misi jatuh tempo`, badge === String(REVIEWABLE), badge);

  await t.evaluate(`__t.mode('Ujian')`);
  t.check('kartu "Latihan ulang hari ini" tampil', await t.evaluate(`__t.waitHas('Latihan ulang hari ini', 5000)`));
  t.check('menyebut misi yang sering salah didahulukan', await t.evaluate(`__t.has('1 yang sering salah')`));
  await t.evaluate(`[...document.querySelectorAll('button')].find(b => b.innerText.startsWith('Mulai latihan ulang')).click(); true`);
  t.check('sesi latihan ulang dimulai (tanpa batas waktu)', await t.evaluate(`__t.waitText('Soal 1/5', 5000).then(ok => ok && __t.has('Latihan ulang') && __t.text().includes('Santai'))`));
  const session = await t.evaluate<{ missionIds: string[]; purpose: string }>(`JSON.parse(localStorage.getItem(${JSON.stringify(SESSION_KEY)}))`);
  t.check('soal pertama = misi yang sering salah (t1-where)', session.missionIds[0] === 't1-where' && session.purpose === 'review', session.missionIds.join(', '));

  for (const [i, id] of session.missionIds.entries()) {
    const m = MISSIONS.find((x) => x.id === id);
    await t.evaluate(`[...document.querySelectorAll('nav[aria-label="Daftar soal"] button')][${i}].click(); true`);
    await t.evaluate(`__t.waitText('Soal ${i + 1}/5', 3000)`);
    if (m?.kind === 'sql') await t.evaluate(`__t.setSql(${JSON.stringify(i === 4 ? 'SELECT 1' : m.solutionSql)}); true`);
    else await t.evaluate(`document.querySelector(${JSON.stringify(i === 4 ? '[data-choice="d0"]' : '[data-choice="answer"]')})?.click(); true`);
    await t.sleep(120);
  }
  await t.evaluate(`__t.click('Kumpulkan jawaban')`);
  t.check('rapor latihan ulang tampil', await t.evaluate(`__t.waitHas('Tinjauan soal', 20000).then(ok => ok && __t.has('Latihan ulang'))`));
  t.check('jawaban benar dijadwalkan 3 hari lagi', await t.evaluate(`__t.text().includes('ulang 3 hari lagi')`));
  t.check('jawaban salah dijadwalkan besok', await t.evaluate(`__t.text().includes('ulang besok')`));

  const deck = await t.evaluate<Record<string, { box: number }>>(`JSON.parse(localStorage.getItem(${JSON.stringify(REVIEW_KEY)}) ?? '{}')`);
  const boxes = Object.values(deck).map((c) => c.box).sort().join('');
  t.check('jadwal tersimpan: 4 naik ke kotak 1, 1 tetap kotak 0', boxes === '01111', JSON.stringify(deck));

  await t.evaluate(`__t.click('Kembali')`);
  const left = REVIEWABLE - 5;
  t.check(`sisa jatuh tempo hari ini ${left} misi (yang salah baru muncul lagi besok)`, await t.evaluate(`__t.waitText('${left} misi', 4000).then(() => document.querySelector('[data-testid="review-due"]')?.innerText === '${left} misi')`));
  t.check('streak dihitung: 1 hari', await t.evaluate(`[...document.querySelectorAll('header [title^="Streak"]')].some(e => /\\b1\\s*hari/.test(e.innerText))`));
  t.check('riwayat menandai sesi sebagai Latihan', await t.evaluate(`__t.has('Latihan') && __t.has('Riwayat ujian & latihan')`));
}
