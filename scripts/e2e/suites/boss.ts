/**
 * Boss Challenge: terkunci sampai semua misi tier selesai, tanpa hint, solusi terkunci 3 percobaan, tidak mengunci tier
 * berikutnya, pesan khusus di tab Materi, dan perayaan "Boss dikalahkan" dengan XP penuh.
 */
import { PROGRESS_KEY, progressWith, type SuiteContext } from '../context';

const TIER1 = ['t1-select', 't1-where', 't1-like', 't1-order-limit', 't1-distinct', 't1-predict-distinct', 't1-fix-tagihan'];
const WRONG = "SELECT nama, kota, tgl_lahir FROM pasien WHERE penjamin = 'BPJS' OR penjamin = 'Umum' AND tgl_lahir < '1991-01-01' AND kota NOT LIKE 'B%' ORDER BY kota, tgl_lahir LIMIT 5";
const RIGHT = "SELECT nama, kota, tgl_lahir FROM pasien WHERE penjamin IN ('BPJS','Umum') AND tgl_lahir < '1991-01-01' AND kota NOT LIKE 'B%' ORDER BY kota, tgl_lahir LIMIT 5";
const BOSS = 'Boss: Undangan Skrining';

export async function bossSuite(t: SuiteContext): Promise<void> {
  // 1) Satu misi tier 1 belum selesai → boss terkunci.
  await t.fresh({ [PROGRESS_KEY]: progressWith(TIER1.slice(0, 6), 't1-fix-tagihan') });
  t.check('aplikasi tampil (misi 7 aktif)', await t.evaluate(`__t.waitText('Misi 7', 20000)`));
  const locked = await t.evaluate<{ disabled: boolean; title: string } | null>(`(() => { const b = __t.node(${JSON.stringify(BOSS)}); return b ? { disabled: b.disabled, title: b.title } : null; })()`);
  t.check('boss tampil di Peta Misi & terkunci', locked?.disabled === true);
  t.check('tooltip boss menjelaskan syaratnya', (locked?.title ?? '').includes('semua misi Tier 1'), locked?.title);

  // 2) Semua misi tier 1 selesai → boss & tier 2 terbuka.
  await t.fresh({ [PROGRESS_KEY]: progressWith(TIER1, 't1-fix-tagihan') });
  await t.evaluate(`__t.waitText('Misi 7', 20000)`);
  t.check('boss terbuka setelah semua misi tier 1 selesai', await t.evaluate(`(() => { const b = __t.node(${JSON.stringify(BOSS)}); return !!b && !b.disabled; })()`));
  await t.evaluate(`__t.node(${JSON.stringify(BOSS)}).click(); true`);
  t.check('boss bisa dibuka (panel aturan boss)', await t.evaluate(`__t.waitHas('Boss Tier 1: tanpa hint', 8000)`));
  t.check('banner boss tampil (100 XP)', await t.evaluate(`__t.text().includes('Soal gabungan tanpa hint') && __t.text().includes('100 XP')`));
  t.check('tidak ada tombol Hint', await t.evaluate(`__t.buttons('Hint').length === 0 && !__t.text().includes('Hint (-20% XP)')`));
  const sol0 = await t.evaluate<{ disabled: boolean; text: string } | null>(`(() => { const b = __t.button('Show Solution'); return b ? { disabled: b.disabled, text: b.innerText.replace(/\\s+/g, ' ') } : null; })()`);
  t.check('Show Solution terkunci (3)', sol0?.disabled === true && sol0.text.includes('(3)'), sol0?.text);
  t.check('rekap "Mengulang konsep dari" tampil', await t.evaluate(`__t.has('Mengulang konsep dari') && __t.has('Misi 2 · ')`));
  const tier2 = await t.evaluate(`(() => { const b = [...document.querySelectorAll('button[aria-expanded]')].find(x => x.innerText.includes('Tier 2:')); if (!b) return false; b.click(); return true; })()`);
  await t.sleep(300);
  const misi9 = await t.evaluate(`(() => { const b = [...document.querySelectorAll('li button')].find(x => x.title.startsWith('Misi 9:')); return b ? !b.disabled : null; })()`);
  t.check('tier 2 tidak terkunci oleh boss (misi 9 terbuka)', tier2 === true && misi9 === true);

  // 3) Tiga jawaban salah → solusi terbuka.
  for (let i = 1; i <= 3; i += 1) {
    // Tunggu sampai penilaian benar-benar tercatat: teks tombol Show Solution berubah (worker baru bisa butuh beberapa
    // detik untuk memuat mesin SQL di server dev yang sibuk), bukan sekadar menunggu waktu tetap.
    const before = await t.evaluate<string>(`__t.button('Show Solution').innerText.replace(/\\s+/g, ' ')`);
    await t.evaluate(`__t.setSql(${JSON.stringify(WRONG)}); __t.tick().then(() => __t.click('Run & Check'))`);
    await t.evaluate(
      `(async () => { const t0 = Date.now(); while (Date.now() - t0 < 30000 && __t.button('Show Solution').innerText.replace(/\\s+/g, ' ') === ${JSON.stringify(before)}) await new Promise(r => setTimeout(r, 50)); return true; })()`,
    );
    const s = await t.evaluate<{ disabled: boolean; text: string }>(`(() => { const b = __t.button('Show Solution'); return { disabled: b.disabled, text: b.innerText.replace(/\\s+/g, ' ') }; })()`);
    if (i < 3) t.check(`setelah percobaan ${i}: solusi masih terkunci (${3 - i})`, s.disabled && s.text.includes(`(${3 - i})`), s.text);
    else t.check('setelah 3 percobaan: Show Solution aktif', !s.disabled, s.text);
  }

  // 4) Tab Materi: pesan khusus boss.
  await t.evaluate(`__t.tab('Materi').click(); true`);
  t.check('tab Materi: boss tanpa materi khusus', await t.evaluate(`__t.waitText('Boss tidak punya materi khusus', 4000)`));
  await t.evaluate(`__t.tab('Hint & Misi').click(); true`);

  // 5) Jawaban benar → boss dikalahkan, XP penuh, mahkota di tier, Misi Berikutnya → misi 9.
  await t.evaluate(`__t.setSql(${JSON.stringify(RIGHT)}); __t.tick().then(() => __t.click('Run & Check'))`);
  t.check('jawaban benar → "Boss Tier 1 dikalahkan!"', await t.evaluate(`__t.waitText('Boss Tier 1 dikalahkan!', 10000)`));
  t.check('XP penuh +100', await t.evaluate(`__t.text().includes('+100 XP')`));
  t.check('mahkota di judul tier 1', await t.evaluate(`!!document.querySelector('[aria-label="boss dikalahkan"]')`));
  await t.evaluate(`__t.click('Misi Berikutnya'); true`);
  t.check('Misi Berikutnya → misi 9 (tier 2)', await t.evaluate(`__t.waitText('Misi 9', 6000)`));
}
