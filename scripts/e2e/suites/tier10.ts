/**
 * Tier 10 (fungsi tanggal, teks & JSON) di UI: tabel satusehat_log di Schema Explorer, misi json_each lewat worker
 * (jebakan component[0] ditolak, jawaban benar diterima), pesan error jalur JSON + tautan materi, dan Final Boss tier 10.
 */
import { MISSIONS } from '../../../src/data/missions';
import { PROGRESS_KEY, progressWith, type SuiteContext } from '../context';

const DONE = MISSIONS.filter((m) => m.tier < 10 || ['t10-umur', 't10-hari-sibuk', 't10-masking', 't10-group-concat', 't10-json-lab', 't10-predict-json'].includes(m.id)).map((m) => m.id);
const SOLUTION = MISSIONS.find((m) => m.id === 't10-json-each');
const WRONG = `SELECT l.no_rawat, p.nama,
  l.payload ->> '$.component[0].valueQuantity.value' AS sistolik,
  l.payload ->> '$.component[1].valueQuantity.value' AS diastolik,
  'Normal' AS kategori
FROM satusehat_log l JOIN kunjungan k ON k.no_rawat = l.no_rawat JOIN pasien p ON p.no_rm = k.no_rm
WHERE l.payload ->> '$.code.coding[0].code' = '85354-9' AND l.status_kirim <> 'Gagal'
ORDER BY l.no_rawat;`;

export async function tier10Suite(t: SuiteContext): Promise<void> {
  const run = (sql: string) => t.evaluate(`__t.setSql(${JSON.stringify(sql)}); __t.tick().then(() => __t.click('Run & Check'))`);
  await t.fresh({ [PROGRESS_KEY]: progressWith(DONE, 't10-json-each') });
  t.check('misi 70 (json_each) terbuka', await t.evaluate(`__t.waitText('Tekanan Darah dari Array Component', 20000)`));

  await t.evaluate(`__t.tab('Schema').click(); true`);
  t.check('Schema Explorer menampilkan tabel satusehat_log', await t.evaluate(`__t.waitText('satusehat_log', 5000)`));
  await t.evaluate(`__t.tab('Hint & Misi').click(); true`);

  await run(`SELECT json_extract(payload, 'code.text') FROM satusehat_log`);
  t.check('jalur JSON tanpa $ → pesan ramah', await t.evaluate(`__t.waitText('Jalur JSON', 10000)`));
  t.check('kartu error menautkan materi JSON', await t.evaluate(`__t.has('JSON di SQL')`));

  await run(WRONG);
  t.check('component[0] dianggap sistolik → ditolak', await t.evaluate(`__t.waitText('Ada nilai yang berbeda', 15000)`));

  if (SOLUTION?.kind === 'sql') await run(SOLUTION.solutionSql);
  t.check('jawaban berbasis kode LOINC → benar', await t.evaluate(`__t.waitText('Jawaban benar!', 15000)`));
  t.check('XP misi tier 10 (+275)', await t.evaluate(`__t.text().includes('+275 XP')`));

  await t.evaluate(`(() => { const b = [...document.querySelectorAll('button[aria-expanded]')].find(x => x.innerText.includes('Tier 10:')); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); return true; })()`);
  await t.sleep(300);
  t.check('Final Boss tier 10 ada di Peta Misi', await t.evaluate(`!!__t.node('Final Boss: Dashboard Pasien Diabetes')`));
}
