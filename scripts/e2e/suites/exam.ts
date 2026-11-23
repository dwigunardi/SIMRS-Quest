/**
 * Mode Ujian: pengaturan, menjawab tanpa penilaian (Jalankan hanya menampilkan hasil), tahan refresh, kumpulkan →
 * rapor & riwayat & Peta Kelemahan, dan kumpul otomatis saat waktu habis.
 */
import { MISSIONS } from '../../../src/data/missions';
import { PROGRESS_KEY, progressWith, type SuiteContext } from '../context';

const SESSION_KEY = 'simrs-sql-quest:exam-session:v1';
const TIER12 = MISSIONS.filter((m) => m.tier <= 2).map((m) => m.id);
const solutionOf = (id: string) => {
  const m = MISSIONS.find((x) => x.id === id);
  return m?.kind === 'sql' ? m.solutionSql : null;
};

interface StoredSession {
  missionIds: string[];
  deadline: string | null;
}

export async function examSuite(t: SuiteContext): Promise<void> {
  await t.fresh({ [PROGRESS_KEY]: progressWith(TIER12, 't3-bpjs-per-poli') });
  await t.evaluate(`__t.mode('Ujian')`);
  t.check('layar pengaturan ujian tampil', await t.evaluate(`__t.waitText('Mode Ujian', 5000).then(ok => ok && __t.has('Tier yang diujikan'))`));

  // Hanya tier 1, 5 soal, 15 menit.
  await t.evaluate(`(() => { for (const box of document.querySelectorAll('input[type=checkbox]')) { const tier1 = box.closest('label')?.innerText.includes('Tier 1:'); if (box.checked !== tier1 && !box.disabled) box.click(); } return true; })()`);
  await t.evaluate(`[...document.querySelectorAll('[aria-label="Jumlah soal"] [role=radio]')].find(b => b.innerText.trim() === '5 soal').click(); [...document.querySelectorAll('[aria-label="Batas waktu"] [role=radio]')].find(b => b.innerText.trim() === '15 menit').click(); true`);
  await t.evaluate(`__t.click('Mulai ujian')`);
  t.check('ujian dimulai (soal 1/5)', await t.evaluate(`__t.waitText('Soal 1/5', 5000)`));
  const clock = await t.evaluate<string>(`document.querySelector('[data-testid="exam-clock"]')?.innerText ?? ''`);
  t.check('timer berjalan dari ±15:00', /^1[45]:\d\d$/.test(clock), clock);
  t.check('sisa waktu tampil di tombol Ujian (header)', await t.evaluate(`!!document.querySelector('[data-testid="header-exam-clock"]')`));
  t.check('tanpa tombol Hint / Show Solution', await t.evaluate(`__t.buttons('Hint').length === 0 && __t.buttons('Show Solution').length === 0`));

  const session = await t.evaluate<StoredSession>(`JSON.parse(localStorage.getItem(${JSON.stringify(SESSION_KEY)}))`);
  t.check('5 soal dari tier 1', session.missionIds.length === 5 && session.missionIds.every((id) => id.startsWith('t1-')), session.missionIds.join(', '));

  // Soal 1..3 benar, soal 4 salah, soal 5 dikosongkan.
  for (const [i, id] of session.missionIds.entries()) {
    if (i === 4) break;
    await t.evaluate(`[...document.querySelectorAll('nav[aria-label="Daftar soal"] button')][${i}].click(); true`);
    await t.evaluate(`__t.waitText('Soal ${i + 1}/5', 3000)`);
    const sql = solutionOf(id);
    if (sql === null) {
      await t.evaluate(`(document.querySelector(${JSON.stringify(i < 3 ? '[data-choice="answer"]' : '[data-choice="d0"]')}))?.click(); true`);
    } else {
      await t.evaluate(`__t.setSql(${JSON.stringify(i < 3 ? sql : 'SELECT 1 AS salah')}); true`);
    }
    await t.sleep(150);
  }
  const firstSql = session.missionIds.findIndex((id) => solutionOf(id) !== null);
  if (firstSql >= 0) {
    await t.evaluate(`[...document.querySelectorAll('nav[aria-label="Daftar soal"] button')][${firstSql}].click(); true`);
    await t.evaluate(`__t.click('Jalankan (tanpa penilaian)')`);
    t.check('Jalankan menampilkan hasil tanpa menilai', await t.evaluate(`__t.waitText('bukan penilaian', 8000).then(ok => ok && !__t.text().includes('Jawaban benar'))`));
  }
  t.check('palet: 4 soal terjawab', await t.evaluate(`[...document.querySelectorAll('nav[aria-label="Daftar soal"] button')].filter(b => b.getAttribute('aria-label').includes('sudah dijawab')).length === 4`));

  // Refresh di tengah ujian: sesi & jawaban tetap ada.
  await t.reload();
  await t.evaluate(`__t.waitText('Peta Misi', 20000)`);
  await t.evaluate(`__t.mode('Ujian')`);
  t.check('setelah refresh: ujian berlanjut, jawaban tersimpan', await t.evaluate(`__t.waitText('Ujian berjalan', 5000).then(ok => ok && __t.text().includes('4/5 soal dijawab'))`));

  await t.evaluate(`__t.click('Kumpulkan jawaban')`);
  t.check('rapor tampil', await t.evaluate(`__t.waitHas('Tinjauan soal', 20000)`));
  const score = await t.evaluate<string>(`document.querySelector('[data-testid="exam-score"]')?.innerText ?? ''`);
  t.check('nilai 60 (3 dari 5 benar)', score === '60', score);
  t.check('ringkasan: 1 tidak dijawab', await t.evaluate(`__t.has('1 tidak dijawab')`));
  t.check('jenis kesalahan tercatat di rapor', await t.evaluate(`!__t.has('Tidak ada kesalahan') && __t.has('Sudah dicatat di Peta Kelemahan')`));
  t.check('riwayat ujian berisi 1 entri', await t.evaluate(`__t.has('3/5 benar')`));
  t.check('sesi ujian dibersihkan', (await t.evaluate<string | null>(`localStorage.getItem(${JSON.stringify(SESSION_KEY)})`)) === null);

  // Waktu habis → dikumpulkan otomatis (juga saat berada di mode lain).
  await t.evaluate(`__t.click('Kembali')`);
  await t.evaluate(`__t.waitText('Mulai ujian', 3000)`);
  await t.evaluate(`__t.click('Mulai ujian')`);
  await t.evaluate(`__t.waitText('Soal 1/', 5000)`);
  await t.evaluate(`(() => { const s = JSON.parse(localStorage.getItem(${JSON.stringify(SESSION_KEY)})); s.deadline = new Date(Date.now() + 2500).toISOString(); localStorage.setItem(${JSON.stringify(SESSION_KEY)}, JSON.stringify(s)); return true; })()`);
  await t.reload();
  await t.evaluate(`__t.waitText('Peta Misi', 20000)`);
  await t.evaluate(`__t.mode('Misi')`);
  await t.sleep(4500);
  t.check('waktu habis: sesi dikumpulkan walau di mode Misi', (await t.evaluate<string | null>(`localStorage.getItem(${JSON.stringify(SESSION_KEY)})`)) === null);
  await t.evaluate(`__t.mode('Ujian')`);
  t.check('rapor menyebut "waktu habis"', await t.evaluate(`__t.waitText('waktu habis', 5000)`));
}
