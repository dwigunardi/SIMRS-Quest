/**
 * Eksekusi terlindungi: penilaian lewat Web Worker, batas baris, batas waktu 8 detik, tombol Hentikan, jalur Playground
 * (salinan DB sesi, INSERT sungguhan, transaksi terbuka), dan Urutan Eksekusi pada query macet.
 */
import type { SuiteContext } from '../context';

const RUNAWAY_STREAM = 'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n) SELECT x FROM n';
const RUNAWAY_SORTED = 'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n) SELECT x FROM n ORDER BY x DESC LIMIT 5';
const STOPPED = `['berjalan terlalu lama', 'Mesin SQL berhenti']`;

export async function workerSuite(t: SuiteContext): Promise<void> {
  const run = (sql: string, button: string) => t.evaluate(`__t.setSql(${JSON.stringify(sql)}); __t.tick().then(() => __t.click(${JSON.stringify(button)}))`);

  await t.fresh();
  t.check('aplikasi tampil (misi 1)', await t.evaluate(`__t.waitText('Hari Pertama di Unit IT', 20000)`));

  // ---- Misi: penilaian lewat worker ----
  await run('select nama_dokter, spesialisasi from dokter', 'Run & Check');
  t.check('Run & Check (worker) → benar', await t.evaluate(`__t.waitText('Jawaban benar!', 15000)`));
  t.check('file worker dimuat', await t.evaluate(`performance.getEntriesByType('resource').some(e => e.name.includes('sqlWorker'))`));

  await run(RUNAWAY_STREAM, 'Run & Check');
  t.check('batas baris: rekursi mengalir dihentikan', await t.evaluate(`__t.waitText('lebih dari 100.000 baris', 15000)`));

  // Rekursi + ORDER BY tidak tertangkap batas baris → batas waktu worker (atau mesin SQL berhenti karena memori).
  const t0 = Date.now();
  await run(RUNAWAY_SORTED, 'Run & Check');
  await t.sleep(1500);
  const ping = await t.browser.pingMs();
  t.check('halaman tetap responsif saat query macet di worker', ping < 1000, `ping ${ping} ms`);
  t.check('indikator + tombol Hentikan tampil', await t.evaluate(`__t.text().includes('Memeriksa jawaban') && !!__t.button('Hentikan')`));
  const hit = await t.evaluate<string | null>(`__t.waitAny(${STOPPED}, 15000)`);
  t.check('query macet dihentikan otomatis', hit !== null, `${hit ?? '-'} setelah ${Math.round((Date.now() - t0) / 1000)} dtk`);

  await run('select nama_dokter, spesialisasi from dokter', 'Run & Check');
  t.check('worker dibuat ulang: penilaian berikutnya jalan', await t.evaluate(`__t.waitText('Jawaban benar!', 15000)`));

  await run(RUNAWAY_SORTED, 'Run & Check');
  await t.evaluate(`__t.waitText('Hentikan', 4000)`);
  const c0 = Date.now();
  await t.evaluate(`__t.click('Hentikan'); true`);
  await t.evaluate(`(async () => { const t0 = Date.now(); while (Date.now() - t0 < 3000 && document.body.innerText.includes('Memeriksa jawaban')) await new Promise(r => setTimeout(r, 50)); return true; })()`);
  t.check('Hentikan menghentikan segera', !(await t.evaluate<boolean>(`__t.text().includes('Memeriksa jawaban')`)), `${Date.now() - c0} ms`);

  // ---- Playground ----
  await t.evaluate(`__t.mode('Free Playground')`);
  await t.evaluate(`__t.waitText('Free Playground')`);
  await run('SELECT COUNT(*) AS jumlah FROM poliklinik', 'Run');
  const ok1 = await t.evaluate<boolean>(`__t.waitText('Query berhasil', 15000)`);
  t.check('Playground SELECT (dari salinan di worker)', ok1 && (await t.evaluate<boolean>(`/jumlah\\s+1\\s+7/.test(__t.tableText())`)), await t.evaluate(`__t.tableFlat().slice(0, 80)`));
  await run("INSERT INTO poliklinik VALUES ('P99', 'Poli Uji', 'Gedung Z')", 'Run');
  t.check('Playground INSERT diterapkan ke DB sesi', await t.evaluate(`__t.waitText('1 baris diubah', 15000)`));
  await run('SELECT COUNT(*) AS jumlah FROM poliklinik', 'Run');
  await t.sleep(800);
  t.check('salinan worker diperbarui setelah INSERT (8 baris)', await t.evaluate(`/jumlah\\s+1\\s+8/.test(__t.tableText())`), await t.evaluate(`__t.tableFlat().slice(0, 80)`));
  await run(RUNAWAY_SORTED, 'Run');
  await t.sleep(1500);
  const ping2 = await t.browser.pingMs();
  t.check('Playground: halaman responsif saat query macet', ping2 < 1000, `ping ${ping2} ms`);
  const hit2 = await t.evaluate<string | null>(`__t.waitAny(${STOPPED}, 15000)`);
  t.check('Playground: query macet dihentikan', hit2 !== null, hit2 ?? '-');
  await run('SELECT COUNT(*) AS jumlah FROM poliklinik', 'Run');
  await t.sleep(1200);
  t.check('Playground: DB sesi utuh setelah timeout (masih 8)', await t.evaluate(`/jumlah\\s+1\\s+8/.test(__t.tableText())`), await t.evaluate(`__t.tableFlat().slice(0, 80)`));

  // Transaksi terbuka → jalur langsung (salinan tidak setara).
  await run("BEGIN; UPDATE poliklinik SET gedung = 'Gedung Q' WHERE id_poli = 'P99';", 'Run');
  await t.sleep(800);
  await run("SELECT gedung FROM poliklinik WHERE id_poli = 'P99'", 'Run');
  await t.sleep(800);
  t.check('transaksi terbuka: SELECT melihat perubahan yang belum di-COMMIT', await t.evaluate(`__t.text().includes('Gedung Q')`));
  await run('ROLLBACK', 'Run');
  await t.sleep(600);

  // Urutan Eksekusi pada query macet → pesan, bukan halaman macet.
  await run(RUNAWAY_SORTED, 'Urutan Eksekusi');
  await t.sleep(1500);
  const ping3 = await t.browser.pingMs();
  t.check('Urutan Eksekusi: responsif saat menguji query macet', ping3 < 1000, `ping ${ping3} ms`);
  const hit3 = await t.evaluate<string | null>(`__t.waitAny(${STOPPED}, 15000)`);
  t.check('Urutan Eksekusi: query macet dihentikan dengan pesan', hit3 !== null, hit3 ?? '-');

  // Mode lain tetap tampil.
  await t.evaluate(`__t.mode('Materi')`);
  t.check('mode Materi tampil', await t.evaluate(`__t.waitText('Materi SQL', 5000)`));
  await t.evaluate(`__t.mode('Progres')`);
  t.check('mode Progres tampil (peta kelemahan berisi)', await t.evaluate(`__t.waitText('Peta Kelemahan', 5000).then(ok => ok && __t.text().includes('Baris berlebih'))`));
}
