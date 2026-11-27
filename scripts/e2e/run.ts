/**
 * Uji E2E di Chrome/Edge sungguhan (headless). Menjalankan aplikasi sendiri, lalu setiap suite dari browser bersih.
 *
 *   npm run e2e                      # server dev (seperti npm run dev)
 *   npm run e2e -- --preview         # build produksi + vite preview
 *   npm run e2e -- --only=boss,backup
 *
 * Butuh Chrome atau Edge terpasang (atau CHROME_PATH). Kegagalan → exit code 1.
 * Melengkapi `npm run verify` untuk hal yang hanya terlihat di browser: Web Worker & batas waktu, tombol Hentikan,
 * alur boss di UI, unduh/unggah file cadangan, penilaian DDL (Tier 9) di UI, Mode Ujian (timer, refresh, kumpul otomatis),
 * Beranda + shell platform (rute, jalur hangat, tema, pulihkan cadangan), katalog & landing per jalur, dan mode
 * terang/gelap layar jalur (tanpa kedipan, kontras AA di setiap layar pada kedua tema & dua lebar, tema gelap identik).
 */
import { Browser } from './browser';
import { SuiteContext, type CheckResult } from './context';
import { startApp } from './server';
import { achievementsSuite } from './suites/achievements';
import { backupSuite } from './suites/backup';
import { bossSuite } from './suites/boss';
import { coursesSuite } from './suites/courses';
import { ddlSuite } from './suites/ddl';
import { examSuite } from './suites/exam';
import { homeSuite } from './suites/home';
import { perfLabSuite } from './suites/perfLab';
import { reviewSuite } from './suites/review';
import { themeSuite } from './suites/theme';
import { tier10Suite } from './suites/tier10';
import { workerSuite } from './suites/worker';

const SUITES: Record<string, { title: string; run: (t: SuiteContext) => Promise<void> }> = {
  home: { title: 'Beranda & shell platform', run: homeSuite },
  courses: { title: 'Katalog & landing jalur', run: coursesSuite },
  worker: { title: 'Eksekusi terlindungi (worker, batas waktu, Hentikan, Playground)', run: workerSuite },
  boss: { title: 'Boss Challenge', run: bossSuite },
  backup: { title: 'Cadangan progres (ekspor/impor)', run: backupSuite },
  ddl: { title: 'Tier 9: DDL & desain tabel', run: ddlSuite },
  exam: { title: 'Mode Ujian', run: examSuite },
  review: { title: 'Latihan ulang terjadwal', run: reviewSuite },
  tier10: { title: 'Tier 10: tanggal, teks & JSON', run: tier10Suite },
  achievements: { title: 'Lencana pencapaian', run: achievementsSuite },
  perflab: { title: 'Lab Performa (data besar)', run: perfLabSuite },
  theme: { title: 'Mode terang/gelap jalur', run: themeSuite },
};

function parseArgs(argv: readonly string[]): { mode: 'dev' | 'preview'; only: string[] } {
  const only = argv.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',').filter(Boolean) ?? Object.keys(SUITES);
  const unknown = only.filter((name) => !(name in SUITES));
  if (unknown.length > 0) throw new Error(`suite tidak dikenal: ${unknown.join(', ')} (pilihan: ${Object.keys(SUITES).join(', ')})`);
  return { mode: argv.includes('--preview') ? 'preview' : 'dev', only };
}

/**
 * Server dev mengubah modul saat pertama diminta. Pada browser bersih, muat pertama Beranda (plus bagian bawahnya yang
 * dimuat malas) dan layar jalur bisa melewati batas siap 30 detik suite pertama saat mesin sibuk — padahal yang diuji
 * bukan kecepatan transformasi Vite. Dimuat sekali di sini (tanpa pemeriksaan; batas longgar), lalu storage dikosongkan
 * lagi supaya setiap suite tetap mulai dari browser bersih. Build produksi (--preview) tidak membutuhkannya.
 */
async function warmUp(browser: Browser, url: string): Promise<void> {
  const until = (expr: string, ms: number) =>
    browser
      .evaluate(`(async () => { const t0 = Date.now(); while (Date.now() - t0 < ${ms}) { try { if (${expr}) return true; } catch (e) { /* dokumen berganti */ } await new Promise(r => setTimeout(r, 100)); } return false; })()`)
      .catch(() => false);
  await until(`!!document.querySelector('[data-testid="home"][data-ready="true"]')`, 120_000);
  await browser.evaluate(`document.getElementById('faq')?.scrollIntoView(); location.hash = '#/sql'; true`).catch(() => undefined);
  await until(`document.querySelectorAll('[aria-label="Mode aplikasi"] button').length > 0`, 120_000);
  await browser.evaluate(`localStorage.clear(); sessionStorage.clear(); true`).catch(() => undefined);
  await browser.navigate(url);
  // Riwayat pemanasan tidak boleh terbawa ke uji Kembali/Maju.
  await browser.send('Page.resetNavigationHistory').catch(() => undefined);
}

async function main(): Promise<number> {
  const { mode, only } = parseArgs(process.argv.slice(2));
  console.log(`Menjalankan aplikasi (${mode === 'dev' ? 'server dev' : 'build produksi + preview'})…`);
  const app = await startApp(mode);
  const results: CheckResult[] = [];
  let browser: Browser | null = null;
  try {
    browser = await Browser.launch();
    await browser.navigate(app.url);
    if (mode === 'dev') await warmUp(browser, app.url);
    for (const name of only) {
      const suite = SUITES[name];
      if (!suite) continue;
      console.log(`\n▶ ${suite.title}`);
      const ctx = new SuiteContext(browser, app.url, name);
      browser.clearProblems();
      try {
        await suite.run(ctx);
      } catch (err) {
        ctx.check('suite berjalan sampai selesai', false, err instanceof Error ? err.message : String(err));
      }
      ctx.checkConsole();
      results.push(...ctx.results);
    }
  } finally {
    await browser?.close();
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lolos`);
  for (const f of failed) console.log(`  ✗ [${f.suite}] ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
  return failed.length > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
