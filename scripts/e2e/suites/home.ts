/**
 * Beranda & shell platform: Beranda yang ringan (tanpa mesin SQL), pindah Beranda ↔ jalur dengan "jalur hangat"
 * (draf, timer ujian, dan kumpul otomatis tetap hidup di balik Beranda), riwayat browser dua arah, ringkasan pengguna
 * lama, tautan masuk ('#/sql/ujian' dkk.), pengalihan rute yang tidak ada (jalur 'segera' → landing-nya; katalog &
 * landing jalur sendiri diuji suite 'courses'), karantina data rusak, pulihkan cadangan,
 * tema terang/gelap bersama Beranda ↔ layar jalur, interaksi landing (tab, accordion, mockup, menu layar sempit & lebar,
 * korsel), gerak (jeda animasi, gerak dikurangi, halaman yang benar-benar diam), posisi gulir, dan dua kegagalan
 * unduhan (ringkasan progres, bagian bawah halaman).
 *
 * Yang diuji adalah PERILAKU: apa yang tampil, ke mana URL berpindah, apa yang tertulis di storage — bukan tata letak.
 * Tab Radix berpindah pada mousedown/keyboard, jadi tab diklik dengan mouse sungguhan (CDP) atau tombol panah.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MISSIONS } from '../../../src/data/missions';
import { PROGRESS_KEY, progressWith, type SuiteContext } from '../context';
import { AT_HOME_URL, BACKDROP, HOME_READY, LANDING_PAGE, RESOURCE_BUFFER, TRACK_DARK_BODY, TRACK_READY, WASM_REQUESTS, kit, looksDarkTrack, looksLightTrack, tid, type Backdrop, type Kit } from '../kit';

const SESSION_KEY = 'simrs-sql-quest:exam-session:v1';
const EXAMS_KEY = 'simrs-sql-quest:exams:v1';
const MISTAKES_KEY = 'simrs-sql-quest:mistakes:v1';
const INTRO_KEY = 'simrs-quest:home-intro:v1';
const THEME_KEY = 'simrs-quest:theme:v1';

const BACKUP_URL = new URL('../../fixtures/backup-format1.json', import.meta.url);
const BACKUP_TEXT = readFileSync(BACKUP_URL, 'utf8');
/** Lokasi file cadangan di disk, untuk pemilih file ASLI (CDP mengisinya lewat DOM.setFileInputFiles). */
const BACKUP_PATH = fileURLToPath(BACKUP_URL);

interface BackupShape {
  progress: { xp: number; lastMissionId: string | null; missions: Record<string, { completed: boolean }> };
  mistakes: { events: unknown[] };
}
const BACKUP = JSON.parse(BACKUP_TEXT) as BackupShape;
const BACKUP_DONE = Object.values(BACKUP.progress.missions).filter((m) => m.completed).length;

/* ------------------------------------------------------------------ */
/* Data kurikulum yang dipakai sebagai harapan                         */
/* ------------------------------------------------------------------ */

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`data uji tidak lengkap: ${what}`);
  return value;
}

const ORDERED = [...MISSIONS].sort((a, b) => a.order - b.order);
const FIRST = must(ORDERED[0], 'misi pertama');
const SECOND = must(ORDERED[1], 'misi kedua');
const SIXTH = must(ORDERED[5], 'misi keenam');
const FIRST_SOLUTION = FIRST.kind === 'sql' ? FIRST.solutionSql : '';
const TIER1 = MISSIONS.filter((m) => m.tier === 1).map((m) => m.id);
/** Misi tier 1 yang ikut latihan ulang (aturan yang sama dengan suite review). */
const REVIEWABLE = MISSIONS.filter((m) => m.tier === 1 && (m.kind === 'predict' || (m.kind === 'sql' && !m.boss))).length;

/** Soal ujian buatan: lima misi SQL tier 1; dua pertama dijawab BENAR, sisanya masih isi awal editor (belum dijawab). */
const EXAM_ANSWERED = 2;
const EXAM_MISSIONS = MISSIONS.flatMap((m) => (m.kind === 'sql' && m.tier === 1 && !m.boss ? [m] : [])).slice(0, 5);
const EXAM_SCORE = String(Math.round((EXAM_ANSWERED / Math.max(1, EXAM_MISSIONS.length)) * 100));

function examSession(id: string, deadlineInMs: number): Record<string, unknown> {
  const now = Date.now();
  return {
    id,
    purpose: 'exam',
    config: { tiers: [1], count: EXAM_MISSIONS.length, minutes: 15 },
    missionIds: EXAM_MISSIONS.map((m) => m.id),
    answers: Object.fromEntries(EXAM_MISSIONS.map((m, i) => [m.id, { kind: 'sql', sql: i < EXAM_ANSWERED ? m.solutionSql : m.starterSql }])),
    startedAt: new Date(now - 60_000).toISOString(),
    deadline: new Date(now + deadlineInMs).toISOString(),
  };
}

/** Tanggal lokal 'YYYY-MM-DD' (browser uji berjalan di mesin & zona waktu yang sama). */
function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const SEEN_INTRO = { [INTRO_KEY]: '2026-11-01T00:00:00.000Z' };

/**
 * Penghitung requestAnimationFrame, dipasang sebelum modul apa pun dimuat (framer-motion menyimpan rujukan
 * requestAnimationFrame saat modulnya dievaluasi, jadi membungkusnya belakangan tidak akan terhitung).
 */
const RAF_COUNTER = `(() => { const raf = window.requestAnimationFrame.bind(window); window.__rafCount = 0; window.requestAnimationFrame = (cb) => { window.__rafCount += 1; return raf(cb); }; })();`;
/** Banyaknya frame yang diminta halaman selama `ms`. Halaman yang diam meminta 0. */
const rafDuring = (ms: number) => `(async () => { const before = window.__rafCount; await new Promise(r => setTimeout(r, ${ms})); return window.__rafCount - before; })()`;

/* ------------------------------------------------------------------ */
/* 1–3, 12. Pengguna baru: Beranda ringan → jalur → pulang (hangat)    */
/* ------------------------------------------------------------------ */

async function newUser(t: SuiteContext, k: Kit): Promise<void> {
  await t.fresh({}, '#/');
  t.check('browser bersih: Beranda siap', await t.evaluate(`${HOME_READY} && __t.all('[data-testid="track-host"]').length === 0`));
  const h1 = await t.evaluate<number>(`__t.all('h1').length`);
  t.check('tepat satu h1 terlihat', h1 === 1, `${h1} h1`);
  const primary = await t.evaluate<{ focused: boolean; label: string; mode: string }>(
    `(() => { const b = ${tid('home-primary')}; return { focused: !!b && document.activeElement === b, label: b?.textContent.trim() ?? '', mode: b?.dataset.mode ?? '' }; })()`,
  );
  t.check('tombol utama berlabel "mulai"', /mulai/i.test(primary.label) && primary.mode === 'start', JSON.stringify(primary));
  // Halaman ini panjang: pengunjung baru menggulir dengan Spasi. Tombol utama tidak boleh mencuri fokus lalu menelan
  // Spasi itu (dan melempar pengunjung ke jalur sebelum sempat membaca).
  const unfocused = !primary.focused && (await t.evaluate<boolean>(`document.activeElement === document.body`));
  await k.press('Space');
  const scrolled = await k.waitFor(`window.scrollY > 100`, 3000);
  await t.sleep(400);
  t.check(
    'pengunjung baru: tombol utama tidak mencuri fokus — Spasi menggulir halaman, tidak membuka jalur',
    unfocused && scrolled && (await k.hash()) === '#/' && (await t.evaluate<boolean>(`${HOME_READY} && __t.all('[data-testid="track-host"]').length === 0`)),
    `fokusOtomatis=${primary.focused} tergulir=${scrolled} hash=${await k.hash()}`,
  );
  await t.evaluate(`scrollTo({ top: 0, behavior: 'instant' }); true`);
  t.check('pengguna baru: tanpa catatan "ada Beranda" dan tanpa kartu "Hari ini"', !(await k.shown('home-intro')) && !(await k.shown('home-today')));
  t.check('pengguna baru: peta jalur tanpa tanda kemajuan (garis hijau hanya hiasan, tidak dibatasi)', await k.waitFor(`document.querySelector('[data-roadmap-cap]')?.getAttribute('data-roadmap-cap') === 'full' && __t.all('#jalur li[data-state="done"], #jalur li[data-state="here"]').length === 0`, 20_000));

  // Saat diam, Beranda mengunduh KODE jalur lebih dulu — momen paling rawan mesin SQL ikut termuat.
  const prewarmed = await k.waitFor(`performance.getEntriesByType('resource').some(e => /SqlTrack/.test(e.name))`, 12_000);
  await t.sleep(1200);
  t.check('kode jalur dipramuat saat Beranda diam', prewarmed);
  const wasmAtHome = await t.evaluate<string[]>(WASM_REQUESTS);
  const seen = await t.evaluate<number>(`performance.getEntriesByType('resource').length`);
  // Daftar resource harus utuh (tidak terpotong batas buffer) supaya "tidak ada .wasm" berarti sesuatu.
  t.check('Beranda tidak meminta .wasm', wasmAtHome.length === 0 && seen > 0 && seen < RESOURCE_BUFFER, `${seen} resource tercatat${wasmAtHome.length > 0 ? `: ${wasmAtHome.join(', ')}` : ''}`);

  // Tanpa gulir horizontal: layar lebar (halaman yang sama) dan layar sempit (dimuat sebagai ponsel).
  try {
    for (const [width, height] of [[1400, 900], [390, 844], [320, 640]] as const) {
      await k.viewport(width, height);
      if (width < 700) await t.fresh({}, '#/');
      await k.waitFor(`!!document.getElementById('faq')`, 20_000);
      const m = await t.evaluate<{ over: number; inner: number; scrollX: number; height: number }>(`(async () => {
        const de = document.documentElement; let over = 0;
        const step = Math.max(200, innerHeight - 120);
        for (let y = 0; y <= de.scrollHeight; y += step) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 70)); over = Math.max(over, de.scrollWidth - de.clientWidth, document.body.scrollWidth - de.clientWidth); }
        scrollTo({ left: 400, behavior: 'instant' }); await new Promise(r => setTimeout(r, 70));
        const scrollX = window.scrollX;
        scrollTo({ top: 0, left: 0, behavior: 'instant' });
        return { over, inner: innerWidth, scrollX, height: de.scrollHeight };
      })()`);
      t.check(`tanpa gulir horizontal pada ${width}px`, m.inner === width && m.over <= 0 && m.scrollX === 0, JSON.stringify(m));
      if (width > 320) continue;
      // overflow-x-clip menyembunyikan luapan tanpa memunculkan gulir, jadi "tanpa gulir" belum cukup: di layar
      // tersempit isi tiap section (judul, paragraf, kartu) harus benar-benar berada di dalam layar, gutter kanan utuh.
      const spill = await t.evaluate<string[]>(`[...document.querySelectorAll('main section')].flatMap(section => [...section.querySelectorAll('h2, h3, p, li, figure')].filter(el => __t.visible(el) && !el.closest('[data-marquee], .overflow-x-auto, .overflow-hidden, [role="img"]') && el.getBoundingClientRect().right > innerWidth - 8).map(el => (section.id || 'section') + ' ' + el.tagName.toLowerCase() + ' kanan=' + Math.round(el.getBoundingClientRect().right))).slice(0, 5)`);
      t.check('320px: tidak ada isi section yang melewati tepi layar (gutter kanan utuh)', spill.length === 0, spill.join(' | '));
    }
  } finally {
    await k.resetViewport();
  }

  // ---- Tombol utama → jalur ----
  await t.fresh({}, '#/');
  const titleHome = await t.evaluate<string>(`document.title`);
  await k.click('home-primary');
  const trackUp = await k.waitTrack();
  t.check('tombol utama → #/sql', trackUp && (await k.hash()) === '#/sql', await k.hash());
  t.check('misi pertama tampil', await t.evaluate(`__t.waitText(${JSON.stringify(FIRST.title)}, 20000)`), FIRST.title);
  const wasmInTrack = await t.evaluate<string[]>(WASM_REQUESTS);
  t.check('.wasm baru dimuat setelah masuk jalur', wasmInTrack.length > 0, wasmInTrack.join(', '));
  const titleTrack = await t.evaluate<string>(`document.title`);
  t.check('judul tab berubah di jalur', titleTrack !== titleHome && titleTrack.includes('SQL'), `"${titleHome}" → "${titleTrack}"`);

  // Selesaikan misi 1, pindah ke misi 2, lalu tinggalkan draf di editornya.
  await t.evaluate(`__t.setSql(${JSON.stringify(FIRST_SOLUTION)}); __t.tick().then(() => __t.click('Run & Check'))`);
  t.check('prasyarat: misi 1 selesai', await t.evaluate(`__t.waitText('Jawaban benar!', 20000)`));
  await t.evaluate(`__t.click('Misi Berikutnya'); true`);
  t.check('prasyarat: misi 2 terbuka', await t.evaluate(`__t.waitText(${JSON.stringify(SECOND.title)}, 8000)`), SECOND.title);
  const DRAFT = 'SELECT nama /* draf e2e beranda */ FROM pasien WHERE ';
  await t.evaluate(`__t.setSql(${JSON.stringify(DRAFT)}); document.querySelector('[data-testid="track-host"]').__e2eMark = 'hangat'; true`);
  await t.sleep(250);

  // ---- Tombol Beranda di header jalur ----
  const home1 = await k.headerHome();
  t.check('tombol Beranda di header jalur → Beranda', home1 && (await k.hash()) === '#/', await k.hash());
  t.check('judul tab kembali ke judul Beranda', (await t.evaluate<string>(`document.title`)) === titleHome);
  const resume = await t.evaluate<{ label: string; mode: string; line: string }>(
    `(() => { const b = ${tid('home-primary')}; return { label: b?.textContent.trim() ?? '', mode: b?.dataset.mode ?? '', line: ${tid('home-resume-line')}?.innerText.replace(/\\s+/g, ' ').trim() ?? '' }; })()`,
  );
  t.check('tombol utama kini "Lanjutkan"', /lanjutkan/i.test(resume.label) && resume.mode === 'resume', JSON.stringify(resume));
  t.check(
    `"Lanjutkan" menunjuk misi yang ditinggalkan (Misi ${SECOND.order})`,
    resume.line.includes(`Misi ${SECOND.order}`) && resume.line.includes(SECOND.title) && (await k.stored<{ lastMissionId: string }>(PROGRESS_KEY))?.lastMissionId === SECOND.id,
    resume.line,
  );
  t.check('badge hero menghitung 1 misi selesai', (await k.text('hero-badge')).includes('1 misi selesai'), await k.text('hero-badge'));
  const hidden1 = await k.hiddenTrack();
  t.check('di Beranda: jalur hangat ter-mount tetapi tersembunyi & tanpa fokus', hidden1.host && hidden1.hidden && hidden1.visible === 0 && !hidden1.focusInside && hidden1.strays.length === 0, JSON.stringify(hidden1));

  // ---- Lanjutkan → jalur yang sama, masih hangat ----
  const wasmBefore = (await t.evaluate<string[]>(WASM_REQUESTS)).length;
  await k.click('home-primary');
  await k.waitTrack();
  const back = await t.evaluate<{ draft: string; mark: string; mission: boolean }>(
    `({ draft: __t.all('textarea')[0]?.value ?? '', mark: document.querySelector('[data-testid="track-host"]')?.__e2eMark ?? '', mission: __t.has(${JSON.stringify(SECOND.title)}) })`,
  );
  t.check('Lanjutkan membuka misi yang disebut Beranda', back.mission, SECOND.title);
  t.check('draf editor masih ada setelah kembali', back.draft === DRAFT, back.draft);
  t.check('jalur tetap hangat (tidak dimuat ulang, mesin SQL tidak diminta lagi)', back.mark === 'hangat' && (await t.evaluate<string[]>(WASM_REQUESTS)).length === wasmBefore, `tanda=${back.mark}`);

  // ---- Back/Forward browser, dengan popup autocomplete terbuka saat pergi ----
  await t.evaluate(`(() => { const ta = __t.all('textarea')[0]; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); return true; })()`);
  await k.typeLetters('na');
  const popup = await k.waitFor(`__t.all('[aria-label="Saran autocomplete"]').length > 0`, 4000);
  t.check('prasyarat: popup autocomplete terbuka saat mengetik', popup);
  await t.evaluate(`history.back(); true`);
  t.check('Back browser: jalur → Beranda', (await k.waitHome()) && (await k.hash()) === '#/', await k.hash());
  const hidden2 = await k.hiddenTrack();
  t.check('pulang lewat Back: tidak ada popup/fokus jalur yang tertinggal di atas Beranda', hidden2.hidden && hidden2.visible === 0 && !hidden2.focusInside && hidden2.popups === 0 && hidden2.strays.length === 0, JSON.stringify(hidden2));
  await t.evaluate(`history.back(); true`);
  t.check('Back lagi: Beranda → jalur', (await k.waitTrack(15_000)) && (await k.hash()) === '#/sql', await k.hash());
  await t.evaluate(`history.forward(); true`);
  t.check('Forward: jalur → Beranda', (await k.waitHome()) && (await k.hash()) === '#/', await k.hash());
  await t.evaluate(`history.forward(); true`);
  const forward = (await k.waitTrack(15_000)) && (await k.hash()) === '#/sql';
  t.check('Forward lagi: Beranda → jalur (draf yang diketik tetap ada)', forward && (await t.evaluate<boolean>(`(__t.all('textarea')[0]?.value ?? '').includes('draf e2e beranda')`)), await k.hash());
}

/* ------------------------------------------------------------------ */
/* 4. Pengguna lama                                                    */
/* ------------------------------------------------------------------ */

async function returningUser(t: SuiteContext, k: Kit): Promise<void> {
  const done = ORDERED.slice(0, 5).map((m) => m.id);
  const progress = { ...progressWith(done, SIXTH.id), streak: { current: 5, best: 9, lastActiveDate: localDateKey(new Date()) } };
  await t.fresh({ [PROGRESS_KEY]: progress }, '#/');

  const view = await t.evaluate<{ label: string; mode: string; line: string; nav: string }>(
    `(() => { const b = ${tid('home-primary')}; return { label: b?.textContent.trim() ?? '', mode: b?.dataset.mode ?? '', line: ${tid('home-resume-line')}?.innerText.replace(/\\s+/g, ' ').trim() ?? '', nav: ${tid('nav-primary')}?.textContent.trim() ?? '' }; })()`,
  );
  t.check('pengguna lama: tombol utama & tombol navbar "Lanjutkan"', /lanjutkan/i.test(view.label) && view.mode === 'resume' && /lanjutkan/i.test(view.nav), JSON.stringify(view));
  t.check(`misi lanjutan benar (Misi ${SIXTH.order} — ${SIXTH.title})`, view.line.includes(`Misi ${SIXTH.order}`) && view.line.includes(SIXTH.title), view.line);
  const badge = await k.text('hero-badge');
  t.check('hitungan selesai & streak benar (5 misi, streak 5 hari)', badge.includes('5 misi selesai') && badge.includes('streak 5 hari'), badge);
  const streak = await k.text('today-streak');
  t.check('"Hari ini" menyebut streak 5 hari dan rekor 9 hari', /streak 5 hari/i.test(streak) && streak.includes('9 hari'), streak);
  // Ringkasan kemajuan (pangkat, XP, misi selesai) ada di kartu "Hari ini", dan kartunya masuk lipatan pertama.
  const summary = await t.evaluate<{ rank: string; xp: string; now: string | null; max: string | null; text: string | null; label: string | null; top: number; inner: number }>(`(() => {
    const bar = ${tid('today-progress')};
    return { rank: ${tid('today-rank')}?.innerText.trim() ?? '', xp: ${tid('today-xp')}?.innerText.trim() ?? '', now: bar?.getAttribute('aria-valuenow') ?? null, max: bar?.getAttribute('aria-valuemax') ?? null, text: bar?.getAttribute('aria-valuetext') ?? null, label: bar?.getAttribute('aria-label') ?? null, top: ${tid('home-today')}?.getBoundingClientRect().top ?? 99999, inner: innerHeight };
  })()`);
  t.check(
    `"Hari ini" memuat pangkat, XP, dan bilah kemajuan aksesibel (5/${MISSIONS.length} misi)`,
    summary.rank === 'IT Intern' && summary.xp === '250 XP' && summary.now === '5' && summary.max === String(MISSIONS.length) && summary.text === `5/${MISSIONS.length} misi` && (summary.label ?? '').includes('SQL'),
    JSON.stringify(summary),
  );
  t.check('kartu "Hari ini" terlihat tanpa menggulir (lipatan pertama)', summary.top > 0 && summary.top < summary.inner - 80, `atas=${Math.round(summary.top)} tinggi-layar=${summary.inner}`);

  // Catatan sekali tampil.
  t.check('catatan sekali tampil muncul', await k.shown('home-intro'));
  await t.evaluate(`${tid('home-intro')}.querySelector('button').click(); true`);
  t.check('catatan bisa ditutup', (await k.waitFor(`!${tid('home-intro')}`, 3000)) && (await t.evaluate<boolean>(`localStorage.getItem(${JSON.stringify(INTRO_KEY)}) !== null`)));
  await t.reload();
  await t.sleep(400);
  t.check('catatan tidak muncul lagi setelah muat ulang', !(await k.shown('home-intro')));

  // Enter pada tombol yang terfokus otomatis.
  const focused = await t.evaluate<boolean>(`document.activeElement === ${tid('home-primary')}`);
  await k.press('Enter');
  const entered = await k.waitTrack();
  t.check('Enter pada tombol utama yang terfokus masuk ke jalur', focused && entered && (await k.hash()) === '#/sql', `fokus=${focused} hash=${await k.hash()}`);
  t.check('jalur membuka misi lanjutan yang sama', await t.evaluate(`__t.waitText(${JSON.stringify(SIXTH.title)}, 20000)`), SIXTH.title);
  const quarantined = await t.evaluate<string[]>(`Object.keys(localStorage).filter(k => k.includes('karantina'))`);
  t.check('progres valid tidak dikarantina', quarantined.length === 0, quarantined.join(', '));
}

/* ------------------------------------------------------------------ */
/* 5. Latihan ulang jatuh tempo & tautan masuk                         */
/* ------------------------------------------------------------------ */

async function reviewAndDeepLinks(t: SuiteContext, k: Kit): Promise<void> {
  const storage = { [PROGRESS_KEY]: progressWith(TIER1, 't2-inner-join'), ...SEEN_INTRO };
  await t.fresh(storage, '#/');
  const review = await k.text('today-review');
  t.check(`latihan ulang jatuh tempo tampil (${REVIEWABLE} misi)`, review.includes(`${REVIEWABLE} misi jatuh tempo`), review);
  // Peta jalur: tier 1 tuntas (centang), tier 2 "Kamu di sini", dan garis hijau dibatasi sampai tier itu.
  const mapReady = await k.waitFor(`__t.all('#jalur li[data-tier]').length === 10 && (document.querySelector('[data-roadmap-cap]')?.getAttribute('data-roadmap-cap') ?? 'full') !== 'full'`, 20_000);
  const map = await t.evaluate<{ states: string; cap: number; covered: number; height: number }>(`(async () => {
    const wrap = document.querySelector('[data-roadmap-cap]');
    wrap.scrollIntoView({ block: 'end', behavior: 'instant' });
    await new Promise(r => setTimeout(r, 1500));
    const y = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('[data-testid="roadmap-progress"]')).transform).m42;
    const out = { states: __t.all('#jalur li[data-tier]').map(li => li.dataset.state).join(','), cap: Number(wrap.getAttribute('data-roadmap-cap')), covered: y, height: wrap.getBoundingClientRect().height };
    scrollTo({ top: 0, behavior: 'instant' });
    return out;
  })()`);
  const visibleShare = 1 - map.covered / Math.max(1, map.height);
  t.check(
    'peta jalur: tier 1 tuntas, tier 2 "Kamu di sini", garis hijau berhenti di tier 2 walau peta digulir sampai habis',
    mapReady && map.states === 'done,here,todo,todo,todo,todo,todo,todo,todo,todo' && map.cap > 0.05 && map.cap < 0.35 && Math.abs(visibleShare - map.cap) < 0.02,
    `${map.states}; batas=${map.cap} terlihat=${visibleShare.toFixed(3)}`,
  );

  await k.click('today-review-go');
  const up = await k.waitTrack();
  t.check('tombol latihan ulang membuka mode Ujian', up && (await t.evaluate<boolean>(`__t.waitHas('Latihan ulang hari ini', 15000)`)));
  t.check('URL dinormalkan ke #/sql', await k.waitFor(`location.hash === '#/sql'`, 5000), await k.hash());
  const headerDue = await t.evaluate<string>(`document.querySelector('[data-testid="header-review-due"]')?.innerText.replace(/\\D/g, '') ?? ''`);
  t.check('jumlah jatuh tempo di Beranda = di header jalur', headerDue === String(REVIEWABLE), headerDue);

  // Jalur hangat + tautan masuk lain dari Beranda (footer → Progres).
  await k.headerHome();
  await k.click('home-backup-link');
  await k.waitTrack();
  t.check('tautan "Cadangkan progres" (jalur hangat) membuka Progres', (await t.evaluate<boolean>(`__t.waitHas('Cadangan progres', 10000)`)) && (await k.waitFor(`location.hash === '#/sql'`, 5000)), await k.hash());

  // Tautan masuk dingin.
  await t.fresh(storage, '#/sql/progres');
  t.check("tautan masuk '#/sql/progres' membuka Progres", await t.evaluate(`__t.waitHas('Cadangan progres', 20000).then(ok => ok && __t.has('Peta Kelemahan'))`));
  t.check("'#/sql/progres' dinormalkan ke #/sql", await k.waitFor(`location.hash === '#/sql'`, 5000), await k.hash());
}

/* ------------------------------------------------------------------ */
/* 6. Ujian berjalan                                                   */
/* ------------------------------------------------------------------ */

async function examFlows(t: SuiteContext, k: Kit): Promise<void> {
  const progress = progressWith(TIER1, 't2-inner-join');
  const total = EXAM_MISSIONS.length;
  const seconds = (clock: string) => clock.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);

  // ---- a) Beranda dingin, ujian masih berjalan ----
  await t.fresh({ [PROGRESS_KEY]: progress, [SESSION_KEY]: examSession('ujian-e2e-berjalan', 15 * 60_000), ...SEEN_INTRO }, '#/');
  const running = await k.text('today-exam');
  t.check(`ujian berjalan tampil di Beranda dengan jumlah dijawab (${EXAM_ANSWERED}/${total})`, /ujian sedang berjalan/i.test(running) && running.includes(`${EXAM_ANSWERED}/${total} dijawab`), running);
  const clock1 = await k.text('today-exam-clock');
  await t.sleep(2200);
  const clock2 = await k.text('today-exam-clock');
  t.check('jam mundur berjalan di Beranda', /^1[45]:\d\d$/.test(clock1) && /^1[45]:\d\d$/.test(clock2) && seconds(clock2) < seconds(clock1), `${clock1} → ${clock2}`);

  // ---- b) Jalur hangat + tenggat dipendekkan: terkumpul sendiri selagi pengguna di Beranda ----
  // Tenggatnya dihitung sejak storage diisi, sedangkan jalur harus selesai dimuat dulu sebelum pengguna "pulang" ke
  // Beranda. Di mesin yang lambat 22 detik bisa habis sebelum itu; alih-alih gagal karena waktu, skenarionya diulang
  // dengan tenggat yang lebih panjang sampai Beranda sempat menampilkan jamnya (harapannya sendiri tidak dilunakkan).
  let left = 0;
  let warmClock = '';
  let warmMs = 0;
  for (const candidate of [22_000, 60_000, 150_000]) {
    warmMs = candidate;
    const warm = examSession('ujian-e2e-hangat', candidate);
    const deadline = Date.parse(String(warm.deadline));
    await t.fresh({ [PROGRESS_KEY]: progress, [SESSION_KEY]: warm, ...SEEN_INTRO }, '#/sql');
    await k.headerHome();
    await t.evaluate(`window.__e2eSamePage = true`);
    left = deadline - Date.now();
    warmClock = await k.text('today-exam-clock');
    if (left > 4000) break;
  }
  const clockSeconds = /^\d\d:\d\d$/.test(warmClock) ? seconds(warmClock) : -1;
  t.check(
    'jalur hangat: Beranda menampilkan sisa waktu sesi yang sama',
    left > 1500 && clockSeconds > 0 && clockSeconds <= warmMs / 1000 && Math.abs(clockSeconds - left / 1000) < 5 && (await k.text('today-exam')).includes(`${EXAM_ANSWERED}/${total} dijawab`),
    `tenggat ${warmMs / 1000} dtk, sisa ${Math.round(left / 1000)} dtk, jam "${warmClock}"`,
  );
  const collected = await k.waitFor(`localStorage.getItem(${JSON.stringify(SESSION_KEY)}) === null`, Math.max(0, left) + 40_000);
  const stillHome = await t.evaluate<boolean>(`${AT_HOME_URL} && ${HOME_READY} && document.querySelector('[data-testid="track-host"]').hidden === true`);
  t.check('tenggat lewat: sesi terkumpul otomatis selagi pengguna tetap di Beranda', collected && stillHome, `terkumpul=${collected} diBeranda=${stillHome}`);
  const refreshed = await k.waitFor(`!${tid('today-exam')}`, 8000);
  t.check('Beranda memperbarui diri tanpa dimuat ulang (kartu ujian hilang)', refreshed && (await t.evaluate<boolean>(`window.__e2eSamePage === true`)));
  const records = (await k.stored<Array<{ id: string; timedOut: boolean }>>(EXAMS_KEY)) ?? [];
  t.check('riwayat mencatat sesi itu sebagai "waktu habis"', records.some((r) => r.id === 'ujian-e2e-hangat' && r.timedOut), JSON.stringify(records.map((r) => [r.id, r.timedOut])));
  await t.evaluate(`location.hash = '#/sql/ujian'; true`);
  await k.waitTrack();
  t.check('rapor sesi yang terkumpul otomatis tampil saat jalur dibuka lagi', await t.evaluate(`__t.waitHas('Tinjauan soal', 15000).then(ok => ok && __t.has('waktu habis'))`));
  const warmScore = await t.evaluate<string>(`document.querySelector('[data-testid="exam-score"]')?.innerText ?? ''`);
  t.check(`nilai rapor ${EXAM_SCORE} (${EXAM_ANSWERED} dari ${total} benar)`, warmScore === EXAM_SCORE, warmScore);

  // ---- c) Muat ulang dingin di Beranda, tenggat sudah lewat ----
  await t.fresh({ [PROGRESS_KEY]: progress, [SESSION_KEY]: examSession('ujian-e2e-lewat', -60_000), ...SEEN_INTRO }, '#/');
  const expired = await k.text('today-exam');
  t.check("tenggat sudah lewat: Beranda menampilkan 'Waktu habis' tanpa jam", expired.includes('Waktu habis') && !(await k.shown('today-exam-clock')), expired);
  t.check('Beranda tidak mengumpulkan sendiri (sesi masih tersimpan sampai jalur dibuka)', (await k.stored<{ id: string }>(SESSION_KEY))?.id === 'ujian-e2e-lewat');
  await k.click('today-exam-go');
  await k.waitTrack();
  t.check('membukanya berujung pada rapor', await t.evaluate(`__t.waitHas('Tinjauan soal', 30000).then(ok => ok && __t.has('waktu habis'))`));
  const coldScore = await t.evaluate<string>(`document.querySelector('[data-testid="exam-score"]')?.innerText ?? ''`);
  t.check(`rapor: nilai ${EXAM_SCORE}, sesi dibersihkan, URL #/sql`, coldScore === EXAM_SCORE && (await k.stored(SESSION_KEY)) === null && (await k.hash()) === '#/sql', `nilai=${coldScore} hash=${await k.hash()}`);
  const quarantined = await t.evaluate<string[]>(`Object.keys(localStorage).filter(k => k.includes('karantina'))`);
  t.check('data valid (progres, sesi & riwayat ujian) tidak dikarantina', quarantined.length === 0, quarantined.join(', '));
}

/* ------------------------------------------------------------------ */
/* 7. Rute yang tidak ada                                              */
/* ------------------------------------------------------------------ */

async function redirects(t: SuiteContext, k: Kit): Promise<void> {
  const cases: ReadonlyArray<{ route: string; echo: string; reason: RegExp }> = [
    { route: '#/tidak-ada/sama-sekali', echo: 'tidak-ada', reason: /tidak ditemukan/i },
    { route: '#/profil', echo: 'profil', reason: /belum tersedia/i },
  ];
  for (const c of cases) {
    await t.fresh({}, c.route);
    const notice = await k.text('home-notice');
    const role = await t.evaluate<string>(`${tid('home-notice')}?.getAttribute('role') ?? ''`);
    t.check(
      `${c.route} → Beranda dengan pemberitahuan`,
      (await k.hash()) === '#/' && notice.includes(c.echo) && c.reason.test(notice) && role === 'status' && (await t.evaluate<boolean>(`__t.all('[data-testid="track-host"]').length === 0`)),
      `hash=${await k.hash()} "${notice}"`,
    );
  }

  // Pemberitahuan bisa ditutup.
  await t.evaluate(`${tid('home-notice')}.querySelector('button').click(); true`);
  t.check('pemberitahuan bisa ditutup', await k.waitFor(`!${tid('home-notice')}`, 3000));

  // Jalur 'segera' dibuka langsung: dialihkan (replace) ke landing-nya, tanpa pemberitahuan, dengan judul tab halaman itu.
  await t.fresh({}, '#/react');
  const soonLanding = await k.waitFor(`location.hash === '#/landing/react' && !!${LANDING_PAGE('course')} && ${LANDING_PAGE('course')}.dataset.course === 'react'`, 10_000);
  t.check(
    "'#/react' (jalur segera) → '#/landing/react' tanpa pemberitahuan",
    soonLanding && !(await k.shown('home-notice')) && (await t.evaluate<number>(`__t.all('[data-testid="home"], [data-testid="track-host"]').length`)) === 0,
    await k.hash(),
  );
  const soonTitle = await t.evaluate<string>(`document.title`);
  t.check('judul tab landing jalur segera', soonTitle === 'Belajar React — Jalur Interaktif Gratis | SIMRS Quest', soonTitle);
  // Dari Beranda lewat tautan: tepat satu entri riwayat (pengalihannya mengganti entri tautan), Back kembali ke Beranda.
  await k.send('Page.resetNavigationHistory');
  await t.fresh({}, '#/');
  const before = await t.evaluate<number>(`history.length`);
  await t.evaluate(`location.hash = '#/js'; true`);
  const jsLanding = await k.waitFor(`location.hash === '#/landing/js' && ${LANDING_PAGE('course')}?.dataset.course === 'js'`, 10_000);
  const after = await t.evaluate<number>(`history.length`);
  t.check("'#/js' dari Beranda → '#/landing/js' dengan satu entri riwayat (replace)", jsLanding && after - before === 1, `${before} → ${after}, hash=${await k.hash()}`);
  await t.evaluate(`history.back(); true`);
  t.check('Back dari landing jalur → Beranda', await k.waitHome(), await k.hash());

  // Dari dalam jalur ke rute yang tidak ada: dialihkan ke Beranda, dan Back kembali ke jalur (bukan terjebak).
  // history.length berhenti bertambah di 50 entri — di tab yang sudah lama dipakai, selisihnya selalu 0 dan pemeriksaan
  // di bawah tidak membedakan apa pun. Riwayat tab dikosongkan dulu (tersisa entri saat ini) supaya hitungannya berarti.
  await k.send('Page.resetNavigationHistory');
  await t.fresh({}, '#/');
  await k.click('home-primary');
  await k.waitTrack();
  const lengthBefore = await t.evaluate<number>(`history.length`);
  t.check('prasyarat: riwayat tab belum jenuh (history.length masih bisa bertambah)', lengthBefore < 40, `${lengthBefore} entri`);
  await t.evaluate(`location.hash = '#/tidak-ada'; true`);
  const redirected = (await k.waitHome()) && (await k.waitFor(`!!${tid('home-notice')}`, 5000));
  const notice = await k.text('home-notice');
  t.check('dari jalur ke rute tak dikenal → Beranda + pemberitahuan baru', redirected && notice.includes('tidak-ada'), notice);
  const lengthAfter = await t.evaluate<number>(`history.length`);
  // Tepat satu entri untuk tautannya sendiri; pengalihannya MENGGANTI entri itu.
  t.check('pengalihan tidak menambah entri riwayat', lengthAfter - lengthBefore === 1, `${lengthBefore} → ${lengthAfter}`);
  await t.evaluate(`history.back(); true`);
  const backToTrack = await k.waitTrack(15_000);
  await t.sleep(600); // beri kesempatan pengalihan (bila ada) untuk memantul
  t.check('Back tidak terjebak: kembali ke jalur dan tetap di sana', backToTrack && (await k.hash()) === '#/sql' && (await t.evaluate<boolean>(TRACK_READY)), await k.hash());
  await t.evaluate(`history.back(); true`);
  t.check('Back lagi sampai ke Beranda awal; pemberitahuan lama tidak muncul kembali', (await k.waitHome()) && !(await k.shown('home-notice')), await k.hash());

  // Beranda itu panjang: pemberitahuan rute muncul di puncak halaman, jadi halaman harus dibawa ke sana.
  await t.fresh({}, '#/');
  await k.waitFor(`!!document.getElementById('faq')`, 20_000);
  await t.evaluate(`document.getElementById('faq').scrollIntoView({ block: 'start', behavior: 'instant' }); true`);
  await t.sleep(300);
  const deep = await t.evaluate<number>(`window.scrollY`);
  await t.evaluate(`location.hash = '#/tidak-ada'; true`);
  const inView = await k.waitFor(`(() => { const el = ${tid('home-notice')}; if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()`, 6000);
  t.check('pemberitahuan rute terlihat walau Beranda sedang digulir jauh ke bawah', deep > 2000 && inView && (await k.hash()) === '#/', `gulir awal=${Math.round(deep)} sekarang=${Math.round(await t.evaluate<number>(`window.scrollY`))}`);
}

/* ------------------------------------------------------------------ */
/* 8. Progres rusak                                                    */
/* ------------------------------------------------------------------ */

async function quarantine(t: SuiteContext, k: Kit): Promise<void> {
  const BROKEN = '{"version":1,"xp":760,"missions":{"t1-select":{"completed":tr';
  const slotsNow = async () => (await k.stored<{ slots: Array<{ at: string; raw: string }> }>(`${PROGRESS_KEY}:karantina`))?.slots ?? [];

  // ---- Muat dingin di BERANDA (jalur belum pernah dibuka): peringatan harus sudah ada ----
  await k.freshRaw({ [PROGRESS_KEY]: BROKEN, [INTRO_KEY]: '2026-11-01T00:00:00.000Z' }, '#/');
  const coldAlert = await k.waitFor(`!!${tid('home-quarantine')}`, 10_000);
  const coldSlots = await slotsNow();
  const coldState = await t.evaluate<{ role: string; raw: string | null; track: number; mode: string }>(
    `({ role: ${tid('home-quarantine')}?.getAttribute('role') ?? '', raw: localStorage.getItem(${JSON.stringify(PROGRESS_KEY)}), track: __t.all('[data-testid="track-host"]').length, mode: ${tid('home-primary')}?.dataset.mode ?? '' })`,
  );
  t.check(
    'progres rusak, Beranda dibuka langsung: peringatan tampil tanpa harus masuk jalur dulu',
    coldAlert && coldState.role === 'alert' && coldState.track === 0 && (await k.shown('home-quarantine-restore')),
    JSON.stringify({ ...coldState, raw: undefined }),
  );
  t.check(
    'Beranda menyalin nilai rusak ke karantina dan TIDAK mengubah kunci aslinya',
    coldSlots.length === 1 && coldSlots[0]?.raw === BROKEN && coldState.raw === BROKEN && coldState.mode === 'start',
    `${coldSlots.length} salinan; kunci asli utuh=${coldState.raw === BROKEN}; tombol=${coldState.mode}`,
  );

  // ---- Lewat jalur: pemuat jalur menemukan nilai yang sama → tidak ada salinan ganda ----
  await k.freshRaw({ [PROGRESS_KEY]: BROKEN, [INTRO_KEY]: '2026-11-01T00:00:00.000Z' }, '#/sql');
  await k.waitTrack();
  const slots = await slotsNow();
  t.check('progres rusak: salinan mentahnya tersimpan di karantina', slots.length === 1 && slots[0]?.raw === BROKEN, JSON.stringify(slots).slice(0, 120));

  await k.headerHome();
  const alert = await t.evaluate<{ shown: boolean; role: string }>(`(() => { const el = ${tid('home-quarantine')}; return { shown: !!el, role: el?.getAttribute('role') ?? '' }; })()`);
  t.check('peringatan data tidak terbaca tampil di Beranda', alert.shown && alert.role === 'alert' && (await k.shown('home-quarantine-restore')), JSON.stringify(alert));

  await k.click('home-quarantine-dismiss');
  t.check('peringatan bisa ditutup', await k.waitFor(`!${tid('home-quarantine')}`, 3000));
  await t.reload();
  await t.sleep(400);
  const kept = (await k.stored<{ slots: unknown[] }>(`${PROGRESS_KEY}:karantina`))?.slots.length ?? 0;
  t.check('setelah ditutup: tidak tampil lagi, salinan karantina tetap ada', !(await k.shown('home-quarantine')) && kept === 1, `${kept} salinan`);
}

/* ------------------------------------------------------------------ */
/* 9. Pulihkan cadangan dari Beranda                                   */
/* ------------------------------------------------------------------ */

async function restore(t: SuiteContext, k: Kit): Promise<void> {
  await t.fresh({ [PROGRESS_KEY]: progressWith(['t1-select', 't1-where', 't1-like'], 't1-order-limit'), ...SEEN_INTRO }, '#/');
  await t.sleep(600);
  const before = await k.snapshot();

  // "Pulihkan" membuka pemilih file ASLI browser. Dialognya dicegat lewat CDP (di headless tidak ada yang bisa
  // mengekliknya), lalu file cadangan di disk dipilihkan ke input yang meminta — jalur yang sama dengan pengguna.
  await k.send('Page.setInterceptFileChooserDialog', { enabled: true });
  try {
    const opened = t.browser.waitForEvent('Page.fileChooserOpened', 6000);
    await k.mouseClick(tid('home-restore'));
    const chooser = await opened;
    const backendNodeId: unknown = chooser?.backendNodeId;
    t.check('"Pulihkan" membuka pemilih file cadangan (dialog asli browser)', chooser !== null && typeof backendNodeId === 'number', JSON.stringify(chooser));
    if (typeof backendNodeId === 'number') await k.send('DOM.setFileInputFiles', { files: [BACKUP_PATH], backendNodeId });
    const viaChooser = await k.waitFor(`!!${tid('home-restore-confirm')}`, 8000);
    t.check('file yang dipilih lewat pemilih asli dibaca: ringkasan + konfirmasi tampil, belum ada yang ditulis', viaChooser && (await k.snapshot()) === before, await k.text('home-restore-summary'));
    await k.click('home-restore-cancel');
    await k.waitFor(`!${tid('home-restore-confirm')}`, 3000);
  } finally {
    await k.send('Page.setInterceptFileChooserDialog', { enabled: false });
  }

  // File yang salah.
  await k.pickFile('ini bukan json', 'catatan.txt');
  const err1 = (await k.waitFor(`!!${tid('home-restore-error')}`, 8000)) ? await k.text('home-restore-error') : '';
  t.check('file bukan JSON ditolak dengan pesan', err1.length > 0 && (await t.evaluate<string>(`${tid('home-restore-error')}?.getAttribute('role') ?? ''`)) === 'alert', err1);
  await k.pickFile(JSON.stringify({ app: 'aplikasi-lain', format: 1 }), 'lain.json');
  const changed = await k.waitFor(`!!${tid('home-restore-error')} && ${tid('home-restore-error')}.innerText.replace(/\\s+/g, ' ').trim() !== ${JSON.stringify(err1)}`, 8000);
  t.check('file aplikasi lain ditolak dengan pesan tersendiri', changed, await k.text('home-restore-error'));
  t.check('file salah: storage tidak berubah', (await k.snapshot()) === before);

  // File benar → ringkasan + konfirmasi; belum ada yang ditulis sampai disetujui; Batal membatalkan.
  await k.pickFile(BACKUP_TEXT, 'cadangan.json');
  const confirm1 = await k.waitFor(`!!${tid('home-restore-confirm')}`, 8000);
  const summary = await k.text('home-restore-summary');
  t.check('file cadangan valid → ringkasan isi + konfirmasi di halaman', confirm1 && summary.length > 0 && !(await k.shown('home-restore-error')), summary);
  t.check('sebelum disetujui: storage belum berubah', (await k.snapshot()) === before);
  await k.click('home-restore-cancel');
  t.check('Batal: konfirmasi hilang, storage tetap', (await k.waitFor(`!${tid('home-restore-confirm')}`, 3000)) && (await k.snapshot()) === before);

  // Setujui → ditulis → halaman dimuat ulang → Beranda menampilkan progres dari cadangan.
  await k.pickFile(BACKUP_TEXT, 'cadangan.json');
  await k.waitFor(`!!${tid('home-restore-confirm')}`, 8000);
  await t.evaluate(`window.__e2eOldPage = true`);
  await k.click('home-restore-apply');
  const ready = await k.afterAppReload();
  t.check('setelah dipulihkan halaman dimuat ulang ke Beranda', ready && (await t.evaluate<boolean>(`window.__e2eOldPage === undefined && ${HOME_READY}`)));
  const progress = await k.stored<BackupShape['progress']>(PROGRESS_KEY);
  const restoredDone = Object.values(progress?.missions ?? {}).filter((m) => m.completed).length;
  const mistakes = (await k.stored<BackupShape['mistakes']>(MISTAKES_KEY))?.events.length ?? -1;
  t.check(
    `progres pulih dari cadangan (${BACKUP.progress.xp} XP, ${BACKUP_DONE} misi, ${BACKUP.mistakes.events.length} catatan kesalahan)`,
    progress?.xp === BACKUP.progress.xp && restoredDone === BACKUP_DONE && progress.lastMissionId === BACKUP.progress.lastMissionId && mistakes === BACKUP.mistakes.events.length,
    `xp=${progress?.xp} misi=${restoredDone} kesalahan=${mistakes}`,
  );
  const badge = await k.text('hero-badge');
  t.check('Beranda menampilkan progres hasil pemulihan', badge.includes(`${BACKUP_DONE} misi selesai`) && /lanjutkan/i.test(await t.evaluate<string>(`${tid('home-primary')}?.textContent ?? ''`)), badge);
}

/* ------------------------------------------------------------------ */
/* 10. Tema                                                            */
/* ------------------------------------------------------------------ */

async function theme(t: SuiteContext, k: Kit): Promise<void> {
  const prefer = (value: 'light' | 'dark' | null) => k.send('Emulation.setEmulatedMedia', { features: value === null ? [] : [{ name: 'prefers-color-scheme', value }] });
  const htmlState = () =>
    t.evaluate<{ theme: string | null; landing: boolean; dark: boolean; saved: string | null }>(
      `({ theme: document.documentElement.getAttribute('data-theme'), landing: document.documentElement.hasAttribute('data-q-landing'), dark: document.documentElement.classList.contains('dark'), saved: localStorage.getItem(${JSON.stringify(THEME_KEY)}) })`,
    );
  const backdrop = () => t.evaluate<Backdrop>(BACKDROP);
  const show = (b: Backdrop) => `body ${b.bodyColor} (L ${b.body.toFixed(3)}), ${Math.round(b.dark * 100)}% titik gelap, ${Math.round(b.light * 100)}% terang, paling terang ${b.brightest.toFixed(2)}`;
  const trackToggle = () => t.evaluate<{ label: string; current: string } | null>(`(() => { const b = __t.all('[data-testid="track-theme-toggle"]')[0]; return b ? { label: b.getAttribute('aria-label'), current: b.dataset.themeCurrent } : null; })()`);

  try {
    await prefer('light');
    await t.fresh({}, '#/');
    const light0 = await htmlState();
    await prefer('dark');
    await t.fresh({}, '#/');
    const dark0 = await htmlState();
    t.check('pertama kali: tema mengikuti prefers-color-scheme, belum ada yang disimpan', light0.theme === 'light' && dark0.theme === 'dark' && light0.saved === null && dark0.saved === null, `${JSON.stringify(light0)} / ${JSON.stringify(dark0)}`);
    const homeDark = await backdrop();

    await k.click('theme-toggle');
    await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'light'`, 3000);
    await t.sleep(400);
    const toggled = await htmlState();
    const homeLight = await backdrop();
    t.check('toggle mengubah html[data-theme] dan menyimpannya', toggled.theme === 'light' && toggled.saved === 'light', JSON.stringify(toggled));
    t.check('latar Beranda benar-benar berganti gelap → terang', homeDark.body < 0.05 && homeLight.body > 0.7, `${homeDark.bodyColor} → ${homeLight.bodyColor}`);
    t.check('kelas "dark" di <html> tidak disentuh', dark0.dark && toggled.dark);

    await t.reload();
    const reloaded = await htmlState();
    t.check('setelah muat ulang tema pilihan tetap (walau sistem gelap)', reloaded.theme === 'light' && reloaded.landing && reloaded.saved === 'light', JSON.stringify(reloaded));

    // Tema berlaku untuk seluruh aplikasi: dari Beranda TERANG, layar jalur ikut terang.
    await k.click('home-primary');
    await k.waitTrack();
    await t.evaluate(`__t.waitText(${JSON.stringify(FIRST.title)}, 20000)`);
    await t.sleep(300);
    const inTrack = await htmlState();
    const trackLight = await backdrop();
    t.check('masuk jalur dari Beranda terang: layar jalur ikut terang, penanda landing dilepas', looksLightTrack(trackLight) && inTrack.theme === 'light' && !inTrack.landing && inTrack.dark, `${show(trackLight)}; ${JSON.stringify(inTrack)}`);
    const toggle0 = await trackToggle();
    t.check('header jalur punya tombol tema berlabel aksi', toggle0?.label === 'Ganti ke tema gelap' && toggle0.current === 'light', JSON.stringify(toggle0));

    // Tombol tema di header jalur → gelap: tersimpan, label berganti, dan tampilannya gelap seperti sebelum ada tema terang.
    await t.evaluate(`__t.all('[data-testid="track-theme-toggle"]')[0].click(); true`);
    await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'dark'`, 3000);
    await t.sleep(300);
    const toggled1 = await htmlState();
    const trackDark = await backdrop();
    const toggle1 = await trackToggle();
    t.check('tombol tema di jalur menyimpan tema gelap', toggled1.saved === 'dark' && !toggled1.landing && toggle1?.label === 'Ganti ke tema terang' && toggle1.current === 'dark', `${JSON.stringify(toggled1)} ${JSON.stringify(toggle1)}`);
    t.check(`layar jalur gelap persis seperti dulu (body ${TRACK_DARK_BODY})`, looksDarkTrack(trackDark), show(trackDark));

    // Kembali ke Beranda: pilihan dari jalur berlaku di Beranda.
    await k.headerHome();
    const backHome = await htmlState();
    t.check('kembali ke Beranda: tema yang dipilih di jalur berlaku', backHome.theme === 'dark' && backHome.landing && (await backdrop()).body < 0.05, JSON.stringify(backHome));
    await k.click('theme-toggle');
    await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'light'`, 3000);
    t.check('toggle di Beranda menyimpan tema terang lagi', (await htmlState()).saved === 'light');
    await k.click('home-primary');
    await k.waitTrack();
    await t.sleep(300);
    const inTrack2 = await htmlState();
    const trackLight2 = await backdrop();
    t.check('jalur hangat ikut berganti terang tanpa dimuat ulang', looksLightTrack(trackLight2) && trackLight2.bodyColor === trackLight.bodyColor && inTrack2.theme === 'light' && !inTrack2.landing, `${show(trackLight2)}; ${JSON.stringify(inTrack2)}`);

    // Membuka '#/sql' langsung dengan tema terang tersimpan: data-theme sudah terpasang sebelum React (tanpa kedipan
    // gelap → terang) dan tanpa penanda landing; tema sistem gelap tidak mengalahkan pilihan tersimpan.
    await prefer('dark');
    const early = (await k.send('Page.addScriptToEvaluateOnNewDocument', {
      // Dicatat saat <body> pertama kali dibuat parser — sebelum gambar pertama dan sebelum skrip modul React jalan.
      source: `new MutationObserver((_, obs) => { if (document.body) { window.__earlyTheme = { theme: document.documentElement.getAttribute('data-theme'), landing: document.documentElement.hasAttribute('data-q-landing') }; obs.disconnect(); } }).observe(document, { childList: true, subtree: true });`,
    })) as { identifier?: string };
    try {
      await k.freshRaw({ [THEME_KEY]: 'light' }, '#/sql');
      await k.waitTrack();
      const first = await t.evaluate<{ theme: string | null; landing: boolean } | null>(`window.__earlyTheme ?? null`);
      const direct = await backdrop();
      t.check("'#/sql' dibuka langsung: data-theme='light' terpasang sebelum <body> dibuat (tanpa penanda landing)", first?.theme === 'light' && !first.landing, JSON.stringify(first));
      t.check("'#/sql' dibuka langsung: layar jalur terang walau sistem gelap", looksLightTrack(direct), show(direct));
    } finally {
      if (early.identifier) await k.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: early.identifier });
    }
  } finally {
    await prefer(null);
  }
}

/* ------------------------------------------------------------------ */
/* 11. Interaksi landing                                               */
/* ------------------------------------------------------------------ */

async function landing(t: SuiteContext, k: Kit): Promise<void> {
  await t.fresh({}, '#/');
  t.check('bagian bawah landing (dimuat malas) tampil', await k.waitFor(`!!document.getElementById('faq') && !${tid('home-below-loading')}`, 20_000));

  // ---- Tab jalur: jalur 'segera' bisa dibuka tanpa meninggalkan Beranda ----
  const trackTab = (id: string) => `__t.all('#jalur [role="tab"][data-track="${id}"]')[0]`;
  const selectedTrack = () => t.evaluate<string>(`__t.all('#jalur [role="tab"][aria-selected="true"]')[0]?.dataset.track ?? ''`);
  const pathPanel = (needle: string) => k.waitFor(`__t.all('#jalur [role="tabpanel"]').length === 1 && __t.all('#jalur [role="tabpanel"]')[0].innerText.includes(${JSON.stringify(needle)})`, 5000);
  const sqlFirst = (await selectedTrack()) === 'sql' && (await pathPanel('Final Boss'));
  await k.mouseClick(trackTab('react'));
  const soonShown = (await k.waitFor(`${trackTab('react')}?.getAttribute('aria-selected') === 'true'`, 3000)) && (await pathPanel('Segera')) && (await pathPanel('React'));
  t.check("tab jalur 'segera' bisa dibuka dan menampilkan keadaan \"Segera\"", sqlFirst && soonShown, `awal=${sqlFirst} segera=${soonShown}`);
  t.check('membuka tab jalur tidak mengubah URL maupun layar', (await k.hash()) === '#/' && (await t.evaluate<boolean>(`${HOME_READY} && __t.all('[data-testid="track-host"]').length === 0`)) && !(await k.shown('home-notice')), await k.hash());
  await k.press('ArrowRight');
  const viaKey = await k.waitFor(`${trackTab('framework')}?.getAttribute('aria-selected') === 'true' && document.activeElement === ${trackTab('framework')}`, 3000);
  await k.press('ArrowRight');
  const wrapped = (await k.waitFor(`${trackTab('sql')}?.getAttribute('aria-selected') === 'true'`, 3000)) && (await pathPanel('Final Boss'));
  t.check('tab jalur berpindah dengan tombol panah (dan kembali ke peta SQL)', viaKey && wrapped && (await k.hash()) === '#/', `panah=${viaKey} putar=${wrapped}`);

  // ---- Accordion FAQ dengan keyboard ----
  const faq = (i: number) => `__t.all('#faq button[aria-expanded]')[${i}]`;
  const faqState = () => t.evaluate<string>(`__t.all('#faq button[aria-expanded]').map(b => (b.getAttribute('aria-expanded') === 'true' ? '1' : '0')).join('')`);
  const answerVisible = (i: number) => `(() => { const region = document.getElementById(${faq(i)}.getAttribute('aria-controls')); return !!region && __t.visible(region) && region.innerText.trim().length > 20; })()`;
  const initial = await faqState();
  await t.evaluate(`(() => { const b = ${faq(1)}; b.scrollIntoView({ block: 'center', behavior: 'instant' }); b.focus(); return true; })()`);
  await k.press('Enter');
  const opened = await k.waitFor(`${faq(1)}.getAttribute('aria-expanded') === 'true' && ${faq(0)}.getAttribute('aria-expanded') === 'false' && ${answerVisible(1)}`, 3000);
  t.check('FAQ: Enter membuka pertanyaan terfokus (yang lain menutup)', initial.startsWith('10') && opened, `${initial} → ${await faqState()}`);
  await k.press('Space');
  const closed = await k.waitFor(`${faq(1)}.getAttribute('aria-expanded') === 'false' && !${answerVisible(1)}`, 3000);
  t.check('FAQ: Spasi menutupnya lagi', closed, await faqState());
  await k.press('ArrowDown');
  t.check('FAQ: panah bawah memindahkan fokus ke pertanyaan berikutnya', await k.waitFor(`document.activeElement === ${faq(2)}`, 2000));

  // ---- Tab fitur berganti isi ----
  const featureTab = (i: number) => `__t.all('#fitur [role="tab"]')[${i}]`;
  const featurePanel = () => t.evaluate<string>(`(() => { const p = __t.all('#fitur [role="tabpanel"]'); return p.length === 1 ? p[0].innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
  const panelChanged = (previous: string) => k.waitFor(`(() => { const p = __t.all('#fitur [role="tabpanel"]'); const now = p.length === 1 ? p[0].innerText.replace(/\\s+/g, ' ').trim() : ''; return now.length > 20 && now !== ${JSON.stringify(previous)}; })()`, 4000);
  await t.evaluate(`document.getElementById('fitur').scrollIntoView({ block: 'start', behavior: 'instant' }); true`);
  await k.waitFor(`__t.all('#fitur [role="tabpanel"]').length === 1 && __t.all('#fitur [role="tabpanel"]')[0].innerText.trim().length > 20`, 4000);
  const panel0 = await featurePanel();
  const tabCount = await t.evaluate<number>(`__t.all('#fitur [role="tab"]').length`);
  await k.mouseClick(featureTab(1));
  const byMouse = (await k.waitFor(`${featureTab(1)}?.getAttribute('aria-selected') === 'true'`, 3000)) && (await panelChanged(panel0));
  const panel1 = await featurePanel();
  await k.press('ArrowRight');
  const byKey = (await k.waitFor(`${featureTab(2)}?.getAttribute('aria-selected') === 'true'`, 3000)) && (await panelChanged(panel1));
  const panel2 = await featurePanel();
  t.check(`tab fitur (${tabCount} tab) berganti isi dengan mouse dan keyboard`, tabCount === 7 && panel0.length > 20 && byMouse && byKey && new Set([panel0, panel1, panel2]).size === 3, `mouse=${byMouse} panah=${byKey}`);

  // Panel Streak (tab pertama): kalender itu tidak ada di aplikasi, jadi keterangan ilustrasinya wajib terlihat.
  await k.mouseClick(featureTab(0));
  const streakNote = (await k.waitFor(`!!${tid('streak-note')}`, 4000)) ? await k.text('streak-note') : '';
  t.check('panel Streak membawa keterangan bahwa kalendernya ilustrasi', /ilustrasi/i.test(streakNote) && /tidak disimpan/.test(streakNote), streakNote);

  // ---- Mockup latihan: Hint lalu "Run & Check" ----
  // Hasil mockup berada di tabel berjudul (thead > th[scope=col]) di dalam jendela kode; cuplikan tabel di kartu soal
  // (data-testid="practice-table-preview") bukan hasil, jadi tidak ikut dihitung.
  const runButton = `__t.all('#praktik button').find(b => b.innerText.trim() === 'Run & Check')`;
  const hintButton = `__t.all('#praktik figure button[aria-expanded]')[0]`;
  const verdict = `document.getElementById('praktik').innerText.includes('Jawaban benar!')`;
  const rows = `__t.all('#praktik figure table tbody tr').filter(tr => !tr.closest('[data-testid="practice-table-preview"]')).length`;
  const idle = await t.evaluate<boolean>(`!!${runButton} && !${verdict} && ${rows} === 0 && __t.all('[data-testid="practice-table-preview"]').length === 1`);
  await k.mouseClick(hintButton);
  const hintText = (await k.waitFor(`/Hint \\d dari \\d/.test(document.getElementById('praktik').innerText)`, 3000)) ? await t.evaluate<string>(`document.getElementById('praktik').innerText.match(/Hint \\d dari \\d/)[0]`) : '';
  t.check('klik pertama pada Hint menampilkan hint PERTAMA misi itu', hintText === 'Hint 1 dari 3' && (await t.evaluate<boolean>(`${hintButton}.getAttribute('aria-expanded') === 'true'`)), hintText);
  await k.mouseClick(runButton);
  const judged = await k.waitFor(`${verdict} && ${rows} > 0`, 10_000);
  t.check('"Run & Check" pada mockup menampilkan baris hasil lalu penilaian', idle && judged, `awal-kosong=${idle} hasil=${judged} baris=${await t.evaluate<number>(rows)}`);
  t.check('mockup tidak memuat mesin SQL', (await t.evaluate<string[]>(WASM_REQUESTS)).length === 0);

  // Confetti menempel di <body> (di luar pohon Beranda): tidak boleh ikut tampil di layar jalur.
  const confettiSeen = await k.waitFor(`document.querySelectorAll('body > canvas').length > 0`, 4000);
  await t.evaluate(`location.hash = '#/sql'; true`);
  await k.waitFor(`__t.all('[data-testid="home"]').length === 0`, 10_000);
  const strayCanvas = await t.evaluate<number>(`document.querySelectorAll('body > canvas').length`);
  t.check('confetti landing dihentikan saat pindah ke jalur (tidak ada kanvas tersisa di <body>)', confettiSeen && strayCanvas === 0, `confetti muncul=${confettiSeen}, kanvas di jalur=${strayCanvas}`);
  await k.waitTrack();
  await k.headerHome();
  await k.waitFor(`!!document.getElementById('faq')`, 20_000);

  // ---- Korsel contoh keluaran ----
  const activeSlide = () => t.evaluate<string>(`(() => { const s = __t.all('#hasil [role="group"]:not([aria-hidden])'); const pill = __t.all('#hasil button[aria-current="true"]'); return s.length === 1 && pill.length === 1 ? s[0].getAttribute('aria-label') + ' | ' + pill[0].innerText.trim() : ''; })()`);
  await t.evaluate(`document.getElementById('hasil').scrollIntoView({ block: 'start', behavior: 'instant' }); true`);
  const slide0 = await activeSlide();
  await k.mouseClick(`__t.all('#hasil button[aria-label="Contoh berikutnya"]')[0]`);
  const moved = await k.waitFor(`(() => { const s = __t.all('#hasil [role="group"]:not([aria-hidden])'); return s.length === 1 && s[0].getAttribute('aria-label') + ' | ' + (__t.all('#hasil button[aria-current="true"]')[0]?.innerText.trim() ?? '') !== ${JSON.stringify(slide0)}; })()`, 4000);
  const slide1 = await activeSlide();
  await k.mouseClick(`__t.all('#hasil button[aria-label="Contoh sebelumnya"]')[0]`);
  const movedBack = await k.waitFor(`(__t.all('#hasil [role="group"]:not([aria-hidden])')[0]?.getAttribute('aria-label') ?? '') === ${JSON.stringify(slide0.split(' | ')[0] ?? '')}`, 4000);
  t.check('korsel: panah berikutnya/sebelumnya mengganti slide dan pill topiknya', slide0 !== '' && moved && slide1 !== '' && slide1 !== slide0 && movedBack, `"${slide0}" → "${slide1}"`);
  t.check('korsel membawa keterangan bahwa tampilannya contoh', await t.evaluate<boolean>(`/contoh tampilan/i.test(document.getElementById('hasil').innerText)`));

  // ---- Menu navbar layar lebar ----
  const navTrigger = (label: string) => `__t.all('header nav button').find(b => b.innerText.trim() === ${JSON.stringify(label)})`;
  await t.evaluate(`scrollTo({ top: 0, behavior: 'instant' }); true`);
  // Pemicu NavigationMenu Radix membuka menu saat penunjuk lewat DAN mengganti (toggle) saat diklik: gerak + klik
  // sintetis yang hampir bersamaan kadang membuka-lalu-menutupnya, bergantung waktu (±separuh percobaan di mesin ini,
  // dev maupun preview). Klik diulang (penunjuk dijauhkan dulu) sampai menu terbuka; isi menu tetap diperiksa utuh.
  let tracksOpen = false;
  for (let attempt = 0; attempt < 3 && !tracksOpen; attempt += 1) {
    if (attempt > 0) {
      await k.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 600 });
      await t.sleep(500);
    }
    await k.mouseClick(navTrigger('Jalur'));
    tracksOpen = await k.waitFor(`${navTrigger('Jalur')}?.getAttribute('aria-expanded') === 'true' && __t.all('header a[href="#/landing/sql"]').length > 0`, attempt === 2 ? 4000 : 1500);
  }
  const tracksMenu = await t.evaluate<{ links: string[]; soon: number; disabled: number }>(`(() => { const root = __t.all('header a[href="#/landing/sql"]')[0]?.closest('[data-state="open"]'); if (!root) return { links: [], soon: -1, disabled: -1 }; const links = [...root.querySelectorAll('a[href]')]; return { links: links.map(a => a.getAttribute('href')), soon: links.filter(a => /Segera/.test(a.innerText)).length, disabled: root.querySelectorAll('[aria-disabled="true"]').length }; })()`);
  t.check(
    'menu "Jalur": setiap jalur menaut ke landing-nya (empat bertanda "Segera") + "Semua jalur" ke katalog',
    tracksOpen && tracksMenu.links.join() === '#/landing/sql,#/landing/js,#/landing/rest,#/landing/react,#/landing/framework,#/landing' && tracksMenu.soon === 4 && tracksMenu.disabled === 0,
    JSON.stringify(tracksMenu),
  );
  // Jeda sewajar manusia sebelum Escape: Radix menjadwalkan "buka karena disorot" 80 ms setelah pointer masuk, dan
  // Escape yang datang SEBELUM jadwal itu jatuh akan dibuka lagi olehnya (pengguna sungguhan tidak secepat itu).
  await t.sleep(400);
  await k.press('Escape');
  const tracksShut = await k.waitFor(`${navTrigger('Jalur')}?.getAttribute('aria-expanded') === 'false' && __t.all('header a[href="#/landing/sql"]').length === 0`, 4000);
  // Menu kedua dibuka dengan KEYBOARD (fokus + Enter): selain menguji akses keyboard, ini menghindari perlombaan
  // antara "terbuka karena disorot" dan "klik menutupnya lagi" pada Radix NavigationMenu.
  await t.sleep(300);
  await t.evaluate(`${navTrigger('Fitur')}.focus(); true`);
  await k.press('Enter');
  const featureLinks = (await k.waitFor(`${navTrigger('Fitur')}?.getAttribute('aria-expanded') === 'true' && __t.all('header a[href="#/sql/ujian"]').length > 0`, 4000))
    ? await t.evaluate<string[]>(`[...__t.all('header a[href="#/sql/ujian"]')[0].closest('[data-state="open"]').querySelectorAll('a[href]')].map(a => a.getAttribute('href'))`)
    : [];
  t.check('menu "Fitur" (dibuka dengan Enter) berisi tautan masuk ke Materi, Playground, Ujian, Progres; Escape menutup menu', tracksShut && featureLinks.join() === '#/sql/materi,#/sql/playground,#/sql/ujian,#/sql/progres', `Jalur tertutup=${tracksShut}; ${featureLinks.join()}`);
  await k.press('Escape');

  // ---- Menu layar sempit ----
  const burger = `__t.all('button[aria-label="Buka menu"]')[0]`;
  const wideHasBurger = await t.evaluate<boolean>(`!!${burger}`);
  try {
    await k.viewport(390, 844);
    await t.evaluate(`scrollTo({ top: 0, behavior: 'instant' }); true`);
    const hasBurger = await k.waitFor(`!!${burger}`, 3000);
    await k.mouseClick(burger);
    const open = await k.waitFor(`(() => { const d = __t.all('[role="dialog"]')[0]; return !!d && d.contains(document.activeElement) && d.querySelectorAll('a[href]').length > 0; })()`, 4000);
    t.check('menu layar sempit (390px) membuka sebagai dialog dengan fokus di dalamnya', !wideHasBurger && hasBurger && open, `lebar=${wideHasBurger} sempit=${hasBurger} terbuka=${open}`);
    await k.press('Escape');
    const shut = await k.waitFor(`__t.all('[role="dialog"]').length === 0 && document.activeElement === ${burger}`, 4000);
    t.check('Escape menutup menu dan mengembalikan fokus ke tombolnya', shut && (await k.hash()) === '#/');
  } finally {
    await k.resetViewport();
  }
}

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* 13. Gerak: jeda, gerak dikurangi, halaman yang diam                 */
/* ------------------------------------------------------------------ */

async function motion(t: SuiteContext, k: Kit): Promise<void> {
  const reduce = (on: boolean) => k.send('Emulation.setEmulatedMedia', { features: on ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [] });
  const word = () => t.evaluate<string>(`__t.all('h1 [data-rotating]')[0]?.innerText.trim() ?? ''`);
  const state = () =>
    t.evaluate<{ marquee: string; rotating: string; html: string | null; pressed: string | null }>(
      `({ marquee: __t.all('[data-marquee]').map(el => el.dataset.marquee).join(','), rotating: __t.all('h1 [data-rotating]')[0]?.dataset.rotating ?? '', html: document.documentElement.getAttribute('data-q-motion'), pressed: ${tid('motion-toggle')}?.getAttribute('aria-pressed') ?? null })`,
    );
  /** Posisi (transform terhitung) semua bagian yang bergerak sendiri di layar pertama: pita, maskot, penanda bola dunia, kartu melayang. */
  const pose = `JSON.stringify([...document.querySelectorAll('[data-marquee] > div, #beranda [role="img"] svg, [data-globe] div[aria-hidden] > span, [data-float]')].map(el => getComputedStyle(el).transform))`;
  /** Posisi kartu melayang di samping bola dunia (hanya tampil di layar lebar). */
  const floatPose = `JSON.stringify([...document.querySelectorAll('[data-float]')].map(el => getComputedStyle(el).transform))`;

  // Layar setinggi 1000px: judul hero, bola dunia, DAN pita berjalan sama-sama terlihat (bagian yang keluar layar
  // memang berhenti sendiri — itu diperiksa terpisah di bawah).
  await k.viewport(1400, 1000);
  try {
    await motionChecks();
  } finally {
    await k.resetViewport();
  }

  async function motionChecks(): Promise<void> {
  await t.fresh({}, '#/');
  await k.waitFor(`!!document.getElementById('faq') && document.querySelector('[data-globe]')?.getAttribute('data-globe') !== 'pending'`, 25_000);
  await t.sleep(600);
  const running = await state();
  const word1 = await word();
  const changed = await k.waitFor(`(__t.all('h1 [data-rotating]')[0]?.innerText.trim() ?? '') !== ${JSON.stringify(word1)}`, 6000);
  const moving = (await t.evaluate<number>(rafDuring(600))) > 10;
  const float1 = await t.evaluate<string>(floatPose);
  await t.sleep(700);
  const float2 = await t.evaluate<string>(floatPose);
  t.check('awal: dua kartu samping bola dunia melayang naik-turun', float1.split('matrix').length === 3 && float1 !== float2, `${float1} → ${float2}`);
  t.check('awal: pita berjalan, kata hero berganti, halaman meminta frame', running.marquee === 'running,running' && running.rotating === 'running' && running.pressed === 'false' && changed && moving, `${JSON.stringify(running)} kata berganti=${changed}`);

  // ---- Tombol "Jeda animasi" (WCAG 2.2.2): semua gerak yang berjalan sendiri berhenti, tanpa bergantung pada sistem ----
  await k.click('motion-toggle');
  await t.sleep(900);
  const paused = await state();
  const word2 = await word();
  const pose1 = await t.evaluate<string>(pose);
  await t.sleep(2600); // lebih lama dari jeda pergantian kata (2,2 dtk)
  const frozen = (await word()) === word2 && (await t.evaluate<string>(pose)) === pose1;
  const idleFrames = await t.evaluate<number>(rafDuring(1000));
  t.check('"Jeda animasi": pita, kata hero, maskot, dan bola dunia berhenti', paused.marquee === 'paused,paused' && paused.rotating === 'paused' && paused.html === 'paused' && paused.pressed === 'true' && frozen, `${JSON.stringify(paused)} diam=${frozen}`);
  t.check('saat dijeda halaman benar-benar diam (tidak ada frame animasi yang diminta)', idleFrames <= 2, `${idleFrames} frame/dtk`);
  await k.click('motion-toggle');
  const resumed = await k.waitFor(`__t.all('[data-marquee]').every(el => el.dataset.marquee === 'running') && document.documentElement.getAttribute('data-q-motion') === null`, 3000);
  t.check('menekannya lagi menjalankan animasi kembali', resumed && (await k.waitFor(`(__t.all('h1 [data-rotating]')[0]?.innerText.trim() ?? '') !== ${JSON.stringify(word2)}`, 6000)));

  // ---- Tanpa jeda pun, bagian yang bergerak sendiri berhenti begitu keluar layar ----
  await t.evaluate(`document.getElementById('faq').scrollIntoView({ block: 'start', behavior: 'instant' }); true`);
  await t.sleep(2500); // pegas "muncul saat terlihat" selesai
  const offscreenFrames = await t.evaluate<number>(rafDuring(1000));
  t.check('di bagian tanpa animasi (FAQ) halaman diam: bola dunia, pita, dan maskot di luar layar tidak meminta frame', offscreenFrames <= 2, `${offscreenFrames} frame/dtk`);

  // ---- Gerak dikurangi DIAKTIFKAN SAAT halaman sudah terbuka ----
  // framer-motion (hanya build dev) menulis satu console.warn saat mendeteksi pengaturan ini; itu pesan pustaka yang
  // memang diharapkan di sini, bukan masalah aplikasi.
  const warnings = await k.expectingConsole(/Reduced Motion enabled/i, async () => {
    try {
      await t.evaluate(`scrollTo({ top: 0, behavior: 'instant' }); true`);
      await t.sleep(600);
      await reduce(true);
      await t.sleep(1200);
      const live = await state();
      const liveWord = await word();
      const livePose = await t.evaluate<string>(pose);
      await t.sleep(2600);
      const still = (await word()) === liveWord && (await t.evaluate<string>(pose)) === livePose;
      // Pita disusun statis (tidak ada lagi elemen berjalan), kata hero kembali ke kata pertama, tombol jeda tidak perlu.
      t.check(
        'gerak dikurangi diaktifkan saat halaman terbuka: semua gerak berulang berhenti tanpa muat ulang',
        live.marquee === '' && live.rotating === 'paused' && live.pressed === null && still,
        `${JSON.stringify(live)} diam=${still}`,
      );
      const reducedFrames = await t.evaluate<number>(rafDuring(1000));
      t.check('gerak dikurangi: halaman tidak meminta frame animasi', reducedFrames <= 2, `${reducedFrames} frame/dtk`);

      // Muat awal dengan gerak dikurangi: isi langsung utuh (tidak ada yang tertinggal transparan menunggu animasi).
      await t.fresh({}, '#/');
      await k.waitFor(`!!document.getElementById('faq')`, 20_000);
      const cold = await t.evaluate<{ word: string; marquee: number; code: boolean }>(`(async () => {
        document.getElementById('praktik').scrollIntoView({ block: 'start', behavior: 'instant' });
        await new Promise(r => setTimeout(r, 700));
        const typed = __t.all('#praktik figure pre + div')[0]?.innerText.replace(/\\s+/g, ' ') ?? '';
        const out = { word: __t.all('h1 [data-rotating]')[0]?.innerText.trim() ?? '', marquee: __t.all('[data-marquee]').length, code: typed.includes("OR kota = 'Bogor'") };
        scrollTo({ top: 0, behavior: 'instant' });
        return out;
      })()`);
      t.check('gerak dikurangi sejak muat awal: kata hero diam di "SQL", pita statis, kode mockup langsung utuh', cold.word === 'SQL' && cold.marquee === 0 && cold.code, JSON.stringify(cold));
    } finally {
      await reduce(false);
    }
  });
  t.check('selama gerak dikurangi: tidak ada pesan console selain peringatan bawaan framer-motion (build dev)', warnings.length <= 2, warnings.join(' | ').slice(0, 160));
  }
}

/* ------------------------------------------------------------------ */
/* 14. Posisi gulir, semua misi tuntas, dan dua kegagalan unduhan      */
/* ------------------------------------------------------------------ */

async function resilience(t: SuiteContext, k: Kit): Promise<void> {
  // ---- Posisi gulir: Kembali browser memulihkan posisi; navigasi biasa mulai dari atas ----
  await t.fresh({}, '#/');
  await k.waitFor(`!!document.getElementById('faq') && !${tid('home-below-loading')}`, 20_000);
  // Tautan dibawa ke tengah layar lebih dulu (mouseClick melakukan hal yang sama), supaya posisi yang diukur = posisi saat diklik.
  await t.evaluate(`__t.all('#pangkat a[href="#/sql/progres"]')[0].scrollIntoView({ block: 'center', behavior: 'instant' }); true`);
  await t.sleep(500); // posisi dicatat setelah guliran berhenti
  const left = await t.evaluate<number>(`window.scrollY`);
  await k.mouseClick(`__t.all('#pangkat a[href="#/sql/progres"]')[0]`);
  const inTrack = await k.waitTrack();
  await t.evaluate(`history.back(); true`);
  const backHome = await k.waitHome();
  await k.waitFor(`!!document.getElementById('faq') && !${tid('home-below-loading')}`, 20_000);
  await t.sleep(400);
  const restored = await t.evaluate<number>(`window.scrollY`);
  t.check('Kembali dari jalur ke Beranda: posisi gulir dipulihkan (bukan dilempar ke hero)', left > 2000 && inTrack && backHome && Math.abs(restored - left) < 200, `ditinggalkan di ${Math.round(left)}, kembali di ${Math.round(restored)}`);
  await t.evaluate(`history.forward(); true`);
  await k.waitTrack(15_000);
  await k.headerHome();
  await t.sleep(300);
  t.check('tombol Beranda di jalur (navigasi biasa): Beranda mulai dari atas', (await t.evaluate<number>(`window.scrollY`)) === 0);

  // ---- Semua misi tuntas: hero, navbar, dan CTA penutup sepakat ----
  await t.fresh({ [PROGRESS_KEY]: progressWith(MISSIONS.map((m) => m.id), ORDERED[ORDERED.length - 1]?.id ?? FIRST.id), ...SEEN_INTRO }, '#/');
  await k.waitFor(`!!${tid('cta-primary')}`, 20_000);
  const done = await t.evaluate<{ hero: string; heroMode: string; nav: string; navMode: string; cta: string; line: string }>(
    `({ hero: ${tid('home-primary')}?.textContent.trim() ?? '', heroMode: ${tid('home-primary')}?.dataset.mode ?? '', nav: ${tid('nav-primary')}?.textContent.trim() ?? '', navMode: ${tid('nav-primary')}?.dataset.mode ?? '', cta: ${tid('cta-primary')}?.textContent.trim() ?? '', line: ${tid('home-resume-line')}?.innerText.trim() ?? '' })`,
  );
  t.check(
    'semua misi tuntas: tombol hero, navbar, dan CTA penutup sama-sama "Buka jalur SQL" (bukan "Lanjutkan")',
    done.heroMode === 'open' && done.navMode === 'open' && /buka jalur/i.test(done.hero) && done.nav === done.hero && done.cta === done.hero && done.line.includes(String(MISSIONS.length)),
    JSON.stringify(done),
  );
  t.check('semua misi tuntas: peta jalur mencentang semua tier', await k.waitFor(`__t.all('#jalur li[data-state="done"]').length === 10`, 10_000));

  await k.send('Network.enable');
  try {
    // ---- Ringkasan progres gagal diunduh ----
    await k.send('Network.setBlockedURLs', { urls: ['*/glance*'] });
    const glanceLogs = await k.expectingConsole(/glance|dynamically imported module|Failed to fetch/i, async () => {
      const up = await k.loadHomeLoosely({ [PROGRESS_KEY]: progressWith(TIER1, 't2-inner-join'), ...SEEN_INTRO });
      const alert = await k.waitFor(`!!${tid('home-glance-error')}`, 15_000);
      const view = await t.evaluate<{ role: string; ready: string | null; mode: string; label: string; nav: string }>(
        `({ role: ${tid('home-glance-error')}?.getAttribute('role') ?? '', ready: document.querySelector('[data-testid="home"]')?.getAttribute('data-ready') ?? null, mode: ${tid('home-primary')}?.dataset.mode ?? '', label: ${tid('home-primary')}?.textContent.trim() ?? '', nav: ${tid('nav-primary')}?.textContent.trim() ?? '' })`,
      );
      t.check(
        'ringkasan progres gagal dimuat: peringatan role="alert", tombol utama tetap ada sebagai "Buka jalur SQL"',
        up && alert && view.role === 'alert' && view.ready === 'false' && view.mode === 'open' && /buka jalur/i.test(view.label) && view.nav === view.label,
        JSON.stringify(view),
      );
      await k.send('Network.setBlockedURLs', { urls: [] });
      await k.click('home-primary');
      const opened = await k.waitTrack();
      const kept = Object.keys((await k.stored<{ missions: Record<string, unknown> }>(PROGRESS_KEY))?.missions ?? {}).length;
      t.check('…dan tombol itu tetap membuka jalur dengan progres yang utuh', opened && (await k.hash()) === '#/sql' && kept >= TIER1.length, `hash=${await k.hash()} misi tersimpan=${kept}`);
    });
    t.check('kegagalan ringkasan tidak menimbulkan error console di luar kegagalan unduhnya sendiri', glanceLogs.length <= 3, glanceLogs.join(' | ').slice(0, 200));

    // ---- Bagian bawah halaman gagal diunduh ----
    await k.send('Network.setBlockedURLs', { urls: ['*LandingBelow*'] });
    const belowLogs = await k.expectingConsole(/LandingBelow|dynamically imported module|Failed to fetch|error occurred in|Lazy|error boundary/i, async () => {
      await t.fresh({}, '#/');
      const failed = await k.waitFor(`!!${tid('home-below-error')}`, 20_000);
      const view = await t.evaluate<{ role: string; primary: boolean; footer: boolean; faq: boolean }>(
        `({ role: ${tid('home-below-error')}?.getAttribute('role') ?? '', primary: !!${tid('home-primary')}, footer: !!${tid('home-footer')}, faq: !!document.getElementById('faq') })`,
      );
      t.check('bagian bawah gagal dimuat: pesan + tombol coba lagi tampil, bagian atas & footer tetap ada', failed && view.role === 'alert' && view.primary && view.footer && !view.faq && (await k.shown('home-below-retry')), JSON.stringify(view));
      await k.send('Network.setBlockedURLs', { urls: [] });
      await k.click('home-below-retry');
      const recovered = await k.waitFor(`!!document.getElementById('faq') && !${tid('home-below-error')}`, 20_000);
      t.check('"Coba muat lagi" memuat bagian bawah tanpa memuat ulang halaman', recovered && (await t.evaluate<boolean>(`${HOME_READY}`)));
    });
    t.check('kegagalan bagian bawah tidak menimbulkan error console di luar kegagalan unduhnya sendiri', belowLogs.length <= 6, belowLogs.join(' | ').slice(0, 200));
  } finally {
    await k.send('Network.setBlockedURLs', { urls: [] }).catch(() => undefined);
    await k.send('Network.disable').catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */

export async function homeSuite(t: SuiteContext): Promise<void> {
  const k = kit(t);
  // Berlaku untuk setiap dokumen yang dimuat selama suite ini (lihat WASM_REQUESTS); dilepas lagi di akhir.
  const buffer = (await k.send('Page.addScriptToEvaluateOnNewDocument', { source: `performance.setResourceTimingBufferSize(${RESOURCE_BUFFER}); ${RAF_COUNTER}` })) as { identifier?: string };
  try {
    await newUser(t, k);
    await returningUser(t, k);
    await reviewAndDeepLinks(t, k);
    await examFlows(t, k);
    await redirects(t, k);
    await quarantine(t, k);
    await restore(t, k);
    await theme(t, k);
    await landing(t, k);
    await motion(t, k);
    await resilience(t, k);
  } finally {
    await k.send('Page.setInterceptFileChooserDialog', { enabled: false }).catch(() => undefined);
    await k.send('Network.setBlockedURLs', { urls: [] }).catch(() => undefined);
    // Suite berikutnya memakai browser yang sama: emulasi harus bersih apa pun yang terjadi di atas.
    await k.send('Emulation.clearDeviceMetricsOverride').catch(() => undefined);
    await k.send('Emulation.setEmulatedMedia', { features: [] }).catch(() => undefined);
    if (buffer.identifier !== undefined) await k.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: buffer.identifier }).catch(() => undefined);
  }
}
