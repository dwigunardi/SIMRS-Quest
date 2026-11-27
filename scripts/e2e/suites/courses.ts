/**
 * Katalog & landing jalur: '#/landing' (katalog: pencarian, chip saringan, keadaan kosong, kartu → landing dengan fokus
 * di judulnya, Kembali memulihkan pencarian & posisi gulir), '#/landing/sql' (judul tab, meta, JSON-LD, breadcrumb, angka
 * dari kurikulum, panggung hero, "Lewati ke isi utama", silabus "Buka semua" & satu tombol "Mulai", CTA → jalur),
 * peragaan "Jalankan query" (Lab Injection & Tebak Hasil dinilai seperti aplikasinya), pengguna lama (centang misi
 * selesai TANPA menulis storage, tombol "Lanjutkan", streak yang putus), varian 'segera' ('#/landing/js' dkk.),
 * pengalihan '#/js' → landing-nya dengan riwayat yang tidak terjebak, 404 jalur (termasuk alamat %-rusak), tautan Beranda
 * (menu Jalur, pita berjalan + fokus keyboard, strip Jelajahi, peta jalur, footer), tema yang sama dengan Beranda DAN
 * layar jalur (ganti di mana pun berlaku di semuanya), jalur hangat di balik halaman landing (draf editor tetap, fokus
 * tidak masuk ke jalur tersembunyi),
 * halaman landing tanpa .wasm, judul tab yang dipulihkan, dan tanpa gulir horizontal pada 375 & 1440 px.
 *
 * Yang diuji adalah PERILAKU: apa yang tampil, ke mana URL berpindah, apa yang (tidak) tertulis di storage. Harapan
 * angka & judul dihitung dari kurikulum asli (src/data), bukan ditulis ulang di sini.
 */
import { ARTICLES } from '../../../src/data/materi';
import { MISSIONS, TIERS, TOTAL_XP } from '../../../src/data/missions';
import { isBoss } from '../../../src/lib/boss';
import { TRACKS } from '../../../src/platform/tracks';
import { PROGRESS_KEY, progressWith, type SuiteContext } from '../context';
import { BACKDROP, LANDING_PAGE, RESOURCE_BUFFER, WASM_REQUESTS, kit, looksDarkTrack, looksLightTrack, tid, type Backdrop, type Kit } from '../kit';

const THEME_KEY = 'simrs-quest:theme:v1';
const INTRO_KEY = 'simrs-quest:home-intro:v1';
const SEEN_INTRO = { [INTRO_KEY]: '2026-11-01T00:00:00.000Z' };

/* ------------------------------------------------------------------ */
/* Harapan dari kurikulum & registri                                   */
/* ------------------------------------------------------------------ */

const ORDERED = [...MISSIONS].sort((a, b) => a.order - b.order);
const TIER1 = ORDERED.filter((m) => m.tier === 1);
const TIER2 = ORDERED.filter((m) => m.tier === 2);
const TIER1_ARTICLES = ARTICLES.filter((a) => a.tier === 1).map((a) => a.title);
const BOSS_COUNT = MISSIONS.filter(isBoss).length;
const TRACK_IDS = TRACKS.map((track) => track.id);
const SOON_IDS = TRACKS.filter((track) => track.status === 'segera').map((track) => track.id);
const TITLE_OF = Object.fromEntries(TRACKS.map((track) => [track.id, track.title])) as Record<string, string>;
/** Pengguna lama: seluruh tier 1 + tiga misi pertama tier 2. */
const DONE_IDS = [...TIER1.map((m) => m.id), ...TIER2.slice(0, 3).map((m) => m.id)];
const LAST_DONE = DONE_IDS[DONE_IDS.length - 1] ?? '';

const courseTitle = (title: string) => `Belajar ${title} — Jalur Interaktif Gratis | SIMRS Quest`;
const formatId = (n: number) => n.toLocaleString('id-ID');

/* ------------------------------------------------------------------ */
/* Potongan ekspresi halaman                                           */
/* ------------------------------------------------------------------ */

/** Judul tab, meta, JSON-LD (jenis node @graph per skrip; 'rusak' bila bukan JSON), h1 terlihat, tema landing. */
const META = `(() => ({
  title: document.title,
  description: document.querySelector('meta[name="description"]')?.content ?? null,
  ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? null,
  ogDescription: document.querySelector('meta[property="og:description"]')?.content ?? null,
  robots: document.querySelector('meta[name="robots"]')?.content ?? null,
  ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { return (JSON.parse(s.textContent)['@graph'] ?? []).map(n => n['@type']).join('+'); } catch { return 'rusak'; } }),
  h1: __t.all('h1').map(h => h.innerText.trim()),
  theme: document.documentElement.getAttribute('data-theme'),
}))()`;
interface Meta {
  title: string;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  robots: string | null;
  ld: string[];
  h1: string[];
  theme: string | null;
}

/** Isi JSON-LD halaman jalur: nama Course, jejak breadcrumb, dan banyaknya pertanyaan FAQPage. */
const JSON_LD = `(() => {
  const graph = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
  const of = (type) => graph.find(n => n['@type'] === type) ?? {};
  return {
    course: of('Course').name ?? '',
    crumbs: (of('BreadcrumbList').itemListElement ?? []).map(i => i.name),
    faq: (of('FAQPage').mainEntity ?? []).length,
    answered: (of('FAQPage').mainEntity ?? []).every(q => typeof q.name === 'string' && q.name.endsWith('?') && typeof q.acceptedAnswer?.text === 'string' && q.acceptedAnswer.text.length > 20),
  };
})()`;

/** Kartu tier silabus (terlihat) bernomor `tier`. */
const tierCard = (tier: number) => `__t.all('[data-testid="syllabus-tier"][data-tier="${tier}"]')[0]`;
/** Misi di sebuah kartu tier: id, judul, label jenis, selesai? */
const tierMissions = (tier: number) =>
  `[...(${tierCard(tier)}?.querySelectorAll('li[data-mission]') ?? [])].filter(__t.visible).map(li => ({ id: li.dataset.mission, text: li.innerText, done: li.dataset.done === 'true' }))`;
interface MissionRowInfo {
  id: string;
  text: string;
  done: boolean;
}

/** Kartu jalur yang tampil di katalog (urut), termasuk yang sedang memudar keluar. */
const CATALOG_CARDS = `[...document.querySelectorAll('[data-testid="catalog-results"] a[data-course]')].map(a => a.dataset.course).join()`;

/* ------------------------------------------------------------------ */
/* Alat bantu suite                                                    */
/* ------------------------------------------------------------------ */

function helpers(t: SuiteContext, k: Kit) {
  /** Halaman landing `page` siap (untuk 'course': jalur `id`). */
  const landingUp = (page: 'catalog' | 'course' | 'not-found', id?: string, ms = 10_000) =>
    k.waitFor(`!!${LANDING_PAGE(page)}${id === undefined ? '' : ` && ${LANDING_PAGE(page)}.dataset.course === ${JSON.stringify(id)}`}`, ms);

  /** Halaman dimuat sebagai ponsel/desktop, digulir dari atas sampai bawah; lebar luapan horizontal terbesar. */
  const overflowWhileScrolling = () =>
    t.evaluate<{ over: number; inner: number; scrollX: number; height: number }>(`(async () => {
      const de = document.documentElement; let over = 0;
      const step = Math.max(300, innerHeight - 100);
      for (let y = 0; y <= de.scrollHeight; y += step) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 60)); over = Math.max(over, de.scrollWidth - de.clientWidth, document.body.scrollWidth - de.clientWidth); }
      scrollTo({ left: 400, behavior: 'instant' }); await new Promise(r => setTimeout(r, 60));
      const scrollX = window.scrollX;
      scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return { over, inner: innerWidth, scrollX, height: de.scrollHeight };
    })()`);

  /** Diam sejenak (pramuat chunk terjadi saat browser idle), lalu daftar .wasm yang diminta dokumen ini. */
  const wasmAfterIdle = async (ms = 1500) => {
    await t.sleep(ms);
    return t.evaluate<string[]>(WASM_REQUESTS);
  };

  /** Pindah lewat tautan yang terlihat dengan mouse sungguhan; false bila tautannya tidak ada. */
  const clickLink = (selector: string) => k.mouseClick(`__t.all(${JSON.stringify(selector)})[0]`);

  return { landingUp, overflowWhileScrolling, wasmAfterIdle, clickLink };
}

type Helpers = ReturnType<typeof helpers>;

/* ------------------------------------------------------------------ */
/* 1. Katalog                                                          */
/* ------------------------------------------------------------------ */

async function catalog(t: SuiteContext, k: Kit, h: Helpers): Promise<void> {
  await t.fresh({}, '#/landing');
  const meta = await t.evaluate<Meta>(META);
  t.check(
    "'#/landing' → katalog: satu h1, judul tab & meta sendiri, JSON-LD ItemList, tema landing",
    !!(await t.evaluate(`!!${LANDING_PAGE('catalog')}`)) && meta.h1.length === 1 && /Semua Jalur/.test(meta.title) && (meta.description ?? '').length > 50 && meta.ld.join() === 'ItemList+BreadcrumbList+FAQPage' && (meta.theme === 'light' || meta.theme === 'dark'),
    JSON.stringify(meta),
  );
  t.check('katalog tidak memuat Beranda maupun jalur', (await t.evaluate<number>(`__t.all('[data-testid="home"], [data-testid="track-host"]').length`)) === 0);
  t.check('footer menandai "Semua jalur" sebagai halaman ini', (await t.evaluate<string>(`${tid('footer-all-tracks')}?.getAttribute('aria-current') ?? ''`)) === 'page');
  t.check(`katalog: ${TRACK_IDS.length} kartu jalur sesuai registri, tiap kartu ke landing-nya`, (await t.evaluate<string>(CATALOG_CARDS)) === TRACK_IDS.join() && (await t.evaluate<string>(`[...document.querySelectorAll('[data-testid="catalog-results"] a[data-course]')].map(a => a.getAttribute('href')).join()`)) === TRACK_IDS.map((id) => `#/landing/${id}`).join());

  // ---- Pencarian & chip saringan dengan keyboard, jumlah hasil diumumkan, keadaan kosong ----
  const browse = `(() => { const s = ${tid('catalog-search')}; return { count: ${tid('catalog-result-count')}?.textContent ?? '', live: ${tid('catalog-result-count')}?.getAttribute('aria-live') ?? '', cards: ${CATALOG_CARDS}, empty: !!${tid('catalog-empty')}, pressed: [...document.querySelectorAll('[data-testid="catalog-filters"] button[aria-pressed="true"]')].map(b => b.dataset.filter).join(), focus: document.activeElement?.dataset?.testid ?? document.activeElement?.dataset?.filter ?? '', query: s?.value ?? null }; })()`;
  type Browse = { count: string; live: string; cards: string; empty: boolean; pressed: string; focus: string; query: string | null };
  /** Tunggu sampai kartu yang tampil persis `cards`, lalu baca keadaannya. */
  const settle = async (cards: string): Promise<Browse> => {
    await k.waitFor(`${browse}.cards === ${JSON.stringify(cards)}`, 4000);
    return t.evaluate<Browse>(browse);
  };
  const all = TRACK_IDS.join();
  const soon = SOON_IDS.join();

  await k.mouseClick(`[...document.querySelectorAll('[data-testid="catalog-filters"] button[data-filter="segera"]')][0]`);
  const soonByMouse = await settle(soon);
  t.check(`katalog: chip "Segera" → ${SOON_IDS.length} kartu jalur segera (aria-pressed)`, soonByMouse.cards === soon && soonByMouse.pressed === 'segera' && soonByMouse.count === `${SOON_IDS.length} jalur ditemukan`, JSON.stringify(soonByMouse));
  await k.mouseClick(`[...document.querySelectorAll('[data-testid="catalog-filters"] button[data-filter="all"]')][0]`);
  await settle(all);

  await t.evaluate(`${tid('catalog-search')}.focus(); true`);
  await k.typeLetters('react');
  const typed = await settle('react');
  t.check('katalog: mengetik "react" → hanya kartu React, jumlah hasil di wilayah aria-live', typed.cards === 'react' && typed.count === '1 jalur ditemukan' && typed.live === 'polite' && typed.focus === 'catalog-search', JSON.stringify(typed));
  await k.press('Escape');
  const cleared = await settle(all);
  t.check('katalog: Esc mengosongkan pencarian → semua jalur', cleared.query === '' && cleared.count === `${TRACK_IDS.length} jalur ditemukan` && cleared.pressed === 'all' && cleared.focus === 'catalog-search', JSON.stringify(cleared));
  for (let i = 0; i < 3; i += 1) await k.press('Tab');
  await k.press('Enter');
  const soonOnly = await settle(soon);
  t.check('katalog: Tab ke chip "Segera" + Enter → aria-pressed & jalur segera saja', soonOnly.cards === soon && soonOnly.pressed === 'segera' && soonOnly.focus === 'segera', JSON.stringify(soonOnly));
  await t.evaluate(`${tid('catalog-search')}.focus(); true`);
  await k.typeLetters('sql');
  const filteredOut = (await k.waitFor(`!!${tid('catalog-empty')}`, 4000)) && (await t.evaluate<Browse & { reset: string }>(`({ ...${browse}, reset: ${tid('catalog-reset')}?.innerText ?? '' })`));
  t.check('katalog: "sql" + saringan Segera → keadaan kosong yang menyebut saringannya', !!filteredOut && filteredOut.count === '0 jalur ditemukan' && /cocok/i.test(filteredOut.reset), JSON.stringify(filteredOut));
  await t.evaluate(`${tid('catalog-reset')}.click(); true`);
  const recovered = await settle('sql');
  t.check('katalog: tombol keadaan kosong → saringan Semua, kata tetap, fokus ke pencarian', recovered.cards === 'sql' && recovered.pressed === 'all' && recovered.query === 'sql' && recovered.focus === 'catalog-search', JSON.stringify(recovered));
  await k.typeLetters('zzz');
  const nothing = (await k.waitFor(`!!${tid('catalog-empty')} && !!${tid('catalog-reset')}`, 4000)) && (await t.evaluate<Browse>(browse));
  t.check('katalog: pencarian tanpa hasil → keadaan kosong (tanpa kartu)', !!nothing && nothing.cards === '' && nothing.count === '0 jalur ditemukan', JSON.stringify(nothing));
  await t.evaluate(`${tid('catalog-reset')}.click(); true`);
  const reset = await settle(all);
  t.check('katalog: "Tampilkan semua jalur" memulihkan semua kartu', reset.cards === all && reset.query === '' && reset.pressed === 'all', JSON.stringify(reset));
  t.check('katalog tidak meminta .wasm', (await h.wasmAfterIdle()).length === 0);

  // ---- Kartu → landing jalur (keyboard): mulai dari atas, fokus pindah ke judul, judul tab & JSON-LD berganti ----
  await t.evaluate(`${tid('catalog-search')}.focus(); true`);
  await k.typeLetters('react');
  await settle('react');
  await t.evaluate(`(() => { const a = document.querySelector('[data-testid="catalog-results"] a[data-course="react"]'); a.scrollIntoView({ block: 'center', behavior: 'instant' }); a.focus({ preventScroll: true }); return true; })()`);
  await t.sleep(400);
  const leftAt = await t.evaluate<number>(`Math.round(window.scrollY)`);
  await k.press('Enter');
  const reactUp = await h.landingUp('course', 'react');
  await t.sleep(250);
  const reactMeta = await t.evaluate<Meta>(META);
  t.check(
    `kartu React (Enter) → '#/landing/react': mulai dari atas, judul tab "${courseTitle(TITLE_OF.react ?? 'react')}", satu h1, JSON-LD tanpa node Course (jalur segera)`,
    reactUp && (await k.hash()) === '#/landing/react' && (await t.evaluate<number>(`window.scrollY`)) < 5 && reactMeta.title === courseTitle(TITLE_OF.react ?? 'react') && reactMeta.h1.length === 1 && reactMeta.ld.join() === 'BreadcrumbList+FAQPage',
    JSON.stringify({ hash: await k.hash(), ...reactMeta }),
  );
  const focused = await t.evaluate<{ tag: string; text: string }>(`({ tag: document.activeElement?.tagName ?? '', text: document.activeElement?.textContent?.replace(/\\u00a0/g, ' ').trim() ?? '' })`);
  t.check('pindah halaman di dalam aplikasi: fokus pindah ke judul halaman baru (bukan hilang ke <body>)', focused.tag === 'H1' && focused.text === `Belajar ${TITLE_OF.react ?? 'react'}`, JSON.stringify(focused));

  await t.evaluate(`history.back(); true`);
  await h.landingUp('catalog');
  const restored = await k.waitFor(`(() => { const b = ${browse}; return b.cards === 'react' && b.query === 'react' && Math.abs(window.scrollY - ${leftAt}) < 40; })()`, 5000);
  t.check('Kembali ke katalog: kata pencarian, hasil, dan posisi gulir dipulihkan', restored && leftAt > 300, JSON.stringify({ leftAt, now: await t.evaluate<number>(`Math.round(window.scrollY)`), browse: await t.evaluate<Browse>(browse) }));

  // Isian katalog hanya milik entri riwayatnya: katalog yang dibuka lewat tautan baru nanti harus mulai bersih.
  await t.evaluate(`${tid('catalog-search-clear')}.click(); true`);
  await settle(all);
  await k.typeLetters('sql');
  await settle('sql');
  await t.evaluate(`scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); true`);
  await t.sleep(150);
  // Kartu SQL (yang juga diperiksa e2e: main a[href="#/landing/sql"]).
  await t.evaluate(`(() => { const a = __t.all('main a[href="#/landing/sql"]')[0]; if (!a) throw new Error('kartu jalur SQL tidak ada'); a.click(); return true; })()`);
  const sqlUp = await h.landingUp('course', 'sql');
  await t.sleep(200);
  const sqlMeta = await t.evaluate<Meta>(META);
  t.check(
    `kartu SQL → '#/landing/sql': mulai dari atas, judul tab "${courseTitle('SQL')}", satu h1, JSON-LD Course`,
    sqlUp && (await k.hash()) === '#/landing/sql' && (await t.evaluate<number>(`window.scrollY`)) < 5 && sqlMeta.title === courseTitle('SQL') && sqlMeta.h1.length === 1 && sqlMeta.ld.join() === 'Course+BreadcrumbList+FAQPage',
    JSON.stringify({ hash: await k.hash(), ...sqlMeta }),
  );
  await t.evaluate(`location.hash = '#/landing'; true`);
  await h.landingUp('catalog');
  const clean = await t.evaluate<Browse>(browse);
  t.check('katalog dibuka lewat tautan baru: pencarian kosong, saringan Semua, mulai dari atas', clean.query === '' && clean.pressed === 'all' && (await t.evaluate<number>(`window.scrollY`)) < 5, JSON.stringify(clean));
}

/* ------------------------------------------------------------------ */
/* 2. Landing SQL (pengguna baru)                                      */
/* ------------------------------------------------------------------ */

async function sqlLanding(t: SuiteContext, k: Kit, h: Helpers): Promise<void> {
  await t.fresh({}, '#/landing/sql');
  const meta = await t.evaluate<Meta>(META);
  t.check(
    "'#/landing/sql': judul tab, meta description, og:title/og:description, satu h1 \"Belajar SQL\"",
    meta.title === courseTitle('SQL') && (meta.description ?? '').includes('SQL') && (meta.description ?? '').length > 60 && !!meta.ogTitle && !!meta.ogDescription && meta.h1.join() === 'Belajar SQL' && meta.robots === null,
    JSON.stringify(meta),
  );
  const faqOnPage = await t.evaluate<number>(`__t.all('#faq button[aria-expanded]').length`);
  const ld = meta.ld.join() === 'Course+BreadcrumbList+FAQPage' ? await t.evaluate<{ course: string; crumbs: string[]; faq: number; answered: boolean }>(JSON_LD) : null;
  t.check(
    'JSON-LD: satu skrip JSON valid berisi Course + BreadcrumbList + FAQPage (pertanyaan = FAQ di halaman)',
    meta.ld.length === 1 && !!ld && /SQL/.test(ld.course) && ld.crumbs.join(' / ') === 'Beranda / Jalur / SQL' && ld.faq === faqOnPage && faqOnPage >= 6 && ld.answered,
    JSON.stringify({ ld: meta.ld, ...ld, faqOnPage }),
  );
  const crumb = await t.evaluate<{ links: string[]; current: string }>(`(() => { const nav = __t.all('nav[aria-label="Breadcrumb"]')[0]; return { links: nav ? [...nav.querySelectorAll('a')].map(a => a.getAttribute('href')) : [], current: nav?.querySelector('[aria-current="page"]')?.textContent ?? '' }; })()`);
  t.check('breadcrumb: Beranda / Jalur / SQL (dua tautan, butir terakhir aria-current)', crumb.links.join() === '#/,#/landing' && crumb.current === 'SQL', JSON.stringify(crumb));

  // ---- Angka dari kurikulum: hero (hitung naik) & meta silabus ----
  const stats = [`${MISSIONS.length} misi`, `${BOSS_COUNT} Boss`, `${ARTICLES.length} materi`, `${formatId(TOTAL_XP)} XP`];
  const statsDone = await k.waitFor(`(() => { const ul = document.querySelector('ul[aria-label="Jalur SQL dalam angka"]'); return !!ul && ${JSON.stringify(stats)}.every(s => ul.innerText.replace(/\\s+/g, ' ').includes(s)); })()`, 6000);
  t.check(`angka hero dari kurikulum: ${stats.join(' · ')}`, statsDone, await t.evaluate<string>(`document.querySelector('ul[aria-label="Jalur SQL dalam angka"]')?.innerText.replace(/\\s+/g, ' ') ?? '(tidak ada)'`));
  const syllabusMeta = await k.text('syllabus-meta');
  t.check(
    `meta silabus: ${TIERS.length} tier, ${BOSS_COUNT} Boss, ${MISSIONS.length} misi, ${ARTICLES.length} materi`,
    [`${TIERS.length} tier`, `${BOSS_COUNT} Boss`, `${MISSIONS.length} misi`, `${ARTICLES.length} materi`].every((s) => syllabusMeta.includes(s)),
    syllabusMeta,
  );
  t.check('pengguna baru: tombol utama "Mulai belajar" ke #/sql, tanpa pill kemajuan & tanpa centang', await t.evaluate<boolean>(`(() => { const b = ${tid('course-primary')}; return !!b && b.dataset.mode === 'start' && /mulai/i.test(b.innerText) && b.getAttribute('href') === '#/sql' && !${tid('syllabus-progress')} && document.querySelectorAll('li[data-mission][data-done="true"]').length === 0; })()`));

  // ---- Panggung hero: query misi sungguhan diketik, lalu penilaian aplikasinya muncul ----
  const heroVerdict = await k.waitFor(`/Jawaban benar!/.test(${tid('course-hero-verdict')}?.innerText ?? '')`, 8000);
  t.check('panggung hero: query misi Tier 1 diketik lalu "Jawaban benar!" + XP muncul (logo jalur bernama)', heroVerdict && (await t.evaluate<boolean>(`!!document.querySelector('[data-testid="course-hero-card"] [role="img"][aria-label="Logo jalur SQL"]')`)), await t.evaluate<string>(`${tid('course-hero-verdict')}?.innerText ?? '(belum muncul)'`));

  // ---- "Lewati ke isi utama": tombol Tab pertama, terlihat saat difokus, memindah fokus ke judul ----
  await t.evaluate(`document.activeElement?.blur(); scrollTo({ top: 0, behavior: 'instant' }); true`);
  await k.press('Tab');
  const skip = await t.evaluate<{ id: string; visible: boolean }>(`({ id: document.activeElement?.dataset?.testid ?? '', visible: __t.visible(document.activeElement) && document.activeElement.getBoundingClientRect().width > 40 })`);
  await k.press('Enter');
  const afterSkip = await t.evaluate<string>(`document.activeElement?.tagName ?? ''`);
  t.check('Tab pertama di landing = "Lewati ke isi utama" (terlihat saat difokus); Enter memindah fokus ke judul halaman', skip.id === 'skip-to-content' && skip.visible && afterSkip === 'H1', JSON.stringify({ ...skip, afterSkip }));

  // ---- Silabus: tombol ke jalur hanya di tier tempat misi berikutnya (pengguna baru: tier 1, "Mulai") ----
  const starts = await t.evaluate<Array<{ tier: string; text: string }>>(`[...document.querySelectorAll('[data-testid="syllabus-start"]')].map(a => ({ tier: a.closest('[data-testid="syllabus-tier"]')?.dataset.tier ?? '', text: a.innerText.trim() }))`);
  t.check('silabus pengguna baru: satu tombol "Mulai" saja, di tier 1 (tier lain tidak menjanjikan tautan ke tier itu)', starts.length === 1 && starts[0]?.tier === '1' && /^mulai/i.test(starts[0]?.text ?? ''), JSON.stringify(starts));

  // ---- "Lihat silabus": gulir ke silabus & buka tier pertama ----
  await t.evaluate(`${tid('course-outline')}.click(); true`);
  const outlined = await k.waitFor(`(() => { const s = document.getElementById('silabus'); if (!s) return false; const top = s.getBoundingClientRect().top; return top > -5 && top < 160 && ${tierCard(1)}?.dataset.state === 'open'; })()`, 4000);
  t.check('"Lihat silabus" menggulir ke silabus dan membuka tier 1', outlined, `top=${await t.evaluate<number>(`Math.round(document.getElementById('silabus')?.getBoundingClientRect().top ?? -1)`)}`);

  // ---- Tier 1: misi & materi dari kurikulum ----
  await k.waitFor(`${tierMissions(1)}.length === ${TIER1.length}`, 4000);
  const rows = await t.evaluate<MissionRowInfo[]>(tierMissions(1));
  t.check(
    `tier 1 berisi ${TIER1.length} misi dengan judul & urutan dari kurikulum`,
    rows.length === TIER1.length && rows.map((r) => r.id).join() === TIER1.map((m) => m.id).join() && rows.every((r, i) => r.text.includes(TIER1[i]?.title ?? '(tanpa judul)')),
    rows.map((r) => r.text.replace(/\s+/g, ' ')).join(' | '),
  );
  const bossRow = rows.find((r) => TIER1.find((m) => m.id === r.id && isBoss(m)));
  t.check('tier 1: misi Boss berlabel "Boss"', !!bossRow && /\bBoss\b/.test(bossRow.text), bossRow?.text ?? '(tidak ada Boss)');
  const tier1Text = await t.evaluate<string>(`${tierCard(1)}?.innerText ?? ''`);
  t.check(`tier 1: ${TIER1_ARTICLES.length} judul materi tier itu`, TIER1_ARTICLES.length > 0 && TIER1_ARTICLES.every((title) => tier1Text.includes(title)), TIER1_ARTICLES.filter((title) => !tier1Text.includes(title)).join(' | '));
  const regionName = await t.evaluate<string>(`(() => { const r = ${tierCard(1)}?.querySelector('[role="region"]'); const id = r?.getAttribute('aria-labelledby'); return id ? document.getElementById(id)?.textContent?.trim() ?? '' : ''; })()`);
  t.check('isi tier yang terbuka = wilayah bernama judul tier (bukan teks tombol "Tutup …")', regionName === (TIERS[0]?.name ?? '?'), regionName);

  // ---- Buka semua / Tutup semua ----
  const openCount = () => t.evaluate<number>(`__t.all('[data-testid="syllabus-tier"][data-state="open"]').length`);
  await t.evaluate(`${tid('syllabus-toggle-all')}.click(); true`);
  const allOpen = await k.waitFor(`__t.all('[data-testid="syllabus-tier"][data-state="open"]').length === ${TIERS.length}`, 4000);
  const toggleLabel = await k.text('syllabus-toggle-all');
  const missionsShown = await t.evaluate<number>(`__t.all('[data-testid="syllabus"] li[data-mission]').length`);
  t.check(`"Buka semua" membuka ${TIERS.length} tier (${MISSIONS.length} misi terlihat), tombolnya jadi "Tutup semua"`, allOpen && /tutup semua/i.test(toggleLabel) && missionsShown === MISSIONS.length, `${await openCount()} terbuka, ${missionsShown} misi, "${toggleLabel}"`);
  await t.evaluate(`${tid('syllabus-toggle-all')}.click(); true`);
  t.check('"Tutup semua" menutup semuanya', await k.waitFor(`__t.all('[data-testid="syllabus-tier"][data-state="open"]').length === 0`, 4000), `${await openCount()} terbuka`);

  // ---- Isi jalur & tautan: hanya tujuan yang dikenal router ----
  const hrefs = await t.evaluate<string[]>(`[...document.querySelectorAll('main a[href]')].map(a => a.getAttribute('href'))`);
  const known = new Set(['#/', '#/landing', '#/sql', '#/sql/misi', '#/sql/materi', '#/sql/playground', '#/sql/progres', '#/sql/ujian', ...TRACK_IDS.map((id) => `#/landing/${id}`)]);
  const unknown = [...new Set(hrefs.filter((href) => !known.has(href) && !/^https?:/.test(href)))];
  t.check('semua tautan di halaman menuju rute yang dikenal router', unknown.length === 0 && hrefs.length > 10, unknown.join(', '));
  const parts = await t.evaluate<string[]>(`__t.all('a[data-part]').map(a => a.getAttribute('href'))`);
  t.check('"Isi jalur SQL": enam kartu menuju bagian aplikasi', parts.length === 6 && parts.every((href) => href.startsWith('#/sql')), parts.join(', '));

  t.check('landing SQL tidak meminta .wasm', (await h.wasmAfterIdle()).length === 0);

  // ---- CTA → jalur (baru di sini mesin SQL dimuat) ----
  await t.evaluate(`scrollTo({ top: 0, behavior: 'instant' }); true`);
  await t.evaluate(`${tid('course-primary')}.click(); true`);
  const trackUp = await k.waitTrack();
  t.check('tombol utama landing → #/sql, jalur tampil, judul tab jalur', trackUp && (await k.hash()) === '#/sql' && (await t.evaluate<string>(`document.title`)).startsWith('SQL'), `${await k.hash()} "${await t.evaluate<string>(`document.title`)}"`);
  t.check('.wasm baru dimuat setelah masuk jalur', await k.waitFor(`${WASM_REQUESTS}.length > 0`, 20_000));
}

/* ------------------------------------------------------------------ */
/* 2b. Baris "Jalankan query": tab yang tidak dinilai "hasil vs seharusnya" */
/* ------------------------------------------------------------------ */

async function runRowTabs(t: SuiteContext, k: Kit): Promise<void> {
  // Gerak dikurangi: kode langsung utuh dan penilaian langsung tampil (urutan tampilannya sendiri tidak diuji di sini).
  // framer-motion (mode dev) memperingatkan soal gerak dikurangi di console — itu yang diharapkan di sini.
  await k.expectingConsole(/Reduced Motion enabled/i, () => runRowChecks(t, k));
}

async function runRowChecks(t: SuiteContext, k: Kit): Promise<void> {
  await k.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  try {
    await t.fresh({}, '#/landing/sql');
    const row = `document.querySelector('[data-row="run"]')`;
    // Tab Radix aktif lewat mousedown sungguhan (bukan .click()). Saat mesin sibuk, bagian halaman yang dimuat malas
    // bisa menggeser letak tab di antara pengukuran dan klik — klik diulang (paling banyak 3×) sampai tab itu terpilih.
    const openTab = async (label: string) => {
      const tab = `[...${row}.querySelectorAll('[role="tab"]')].find(b => b.innerText.trim() === ${JSON.stringify(label)})`;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await k.mouseClick(tab);
        if (await k.waitFor(`${tab}?.getAttribute('aria-selected') === 'true'`, 2000)) return;
      }
    };
    const panel = (id: string) =>
      t.evaluate<{ verdict: string; columns: string[]; card: string; mark: string; running: boolean }>(`(() => {
        const p = ${row}.querySelector('[data-example="${id}"]');
        return {
          verdict: p?.dataset.verdict ?? '',
          columns: [...(p?.querySelectorAll('[data-column]') ?? [])].map(c => c.querySelector('p')?.innerText.trim() ?? ''),
          card: p?.innerText ?? '',
          mark: ${row}.querySelector('[role="group"] button[aria-pressed] .sr-only')?.textContent ?? '',
          running: /Menjalankan query/.test(${row}.innerText),
        };
      })()`);

    await openTab('Lab Injection');
    await k.waitFor(`!!${row}.querySelector('[data-example="injection"][data-verdict] [data-column]')`, 6000);
    const injection = await panel('injection');
    t.check(
      'Lab Injection: kebocoran di mode rentan = tujuan misi → "Serangan berhasil!" (bukan "Belum tepat"), kolom "Mode rentan" vs "Mode aman"',
      injection.verdict === 'match' && /Serangan berhasil!/.test(injection.card) && !/Belum tepat/.test(injection.card) && injection.mark === 'Serangan berhasil!' && /Mode rentan/i.test(injection.columns[1] ?? '') && /Mode aman/i.test(injection.columns[2] ?? '') && !injection.columns.some((c) => /seharusnya/i.test(c)),
      JSON.stringify({ ...injection, card: injection.card.slice(0, 200) }),
    );

    await openTab('Tebak Hasil');
    await k.waitFor(`!!${row}.querySelector('[data-example="predict"][data-verdict] [data-column]')`, 6000);
    const predict = await panel('predict');
    t.check(
      'Tebak Hasil: penilaian "Tebakanmu tepat!" (bukan "cocok dengan Expected Output"), kolom pilihanmu vs jawaban yang benar',
      predict.verdict === 'match' && /Tebakanmu tepat!/.test(predict.card) && !/Expected Output\./.test(predict.card) && /pilihan/i.test(predict.columns[1] ?? '') && !predict.running,
      JSON.stringify({ ...predict, card: predict.card.slice(0, 200) }),
    );
    await t.evaluate(`(() => { const b = [...${row}.querySelectorAll('[role="group"] button')].find(x => /konsol/i.test(x.innerText)); b.click(); return true; })()`);
    const consoleOk = await k.waitFor(`/tidak dijalankan/.test(${row}.querySelector('[data-example="predict"]')?.innerText ?? '')`, 3000);
    t.check('Tebak Hasil: konsol mengatakan query-nya tidak dijalankan (bukan "Dijalankan SQLite …")', consoleOk && !(await t.evaluate<boolean>(`/Dijalankan SQLite/.test(${row}.querySelector('[data-example="predict"]')?.innerText ?? '')`)));
  } finally {
    await k.send('Emulation.setEmulatedMedia', { features: [] });
  }
}

/* ------------------------------------------------------------------ */
/* 3. Pengguna lama (progres hanya dibaca)                             */
/* ------------------------------------------------------------------ */

async function returningUser(t: SuiteContext, k: Kit): Promise<void> {
  await t.fresh({ [PROGRESS_KEY]: progressWith(DONE_IDS, LAST_DONE), ...SEEN_INTRO }, '#/landing/sql');
  const before = await k.snapshot();
  const primary = await t.evaluate<{ mode: string; label: string; href: string }>(`(() => { const b = ${tid('course-primary')}; return { mode: b?.dataset.mode ?? '', label: b?.innerText ?? '', href: b?.getAttribute('href') ?? '' }; })()`);
  t.check('pengguna lama: tombol utama "Lanjutkan" ke #/sql', primary.mode === 'resume' && /lanjutkan/i.test(primary.label) && primary.href === '#/sql', JSON.stringify(primary));
  const pill = await k.text('syllabus-progress');
  t.check(`pill kemajuan "${DONE_IDS.length} dari ${MISSIONS.length} misi selesai"`, pill.includes(`${DONE_IDS.length} dari ${MISSIONS.length} misi selesai`), pill);
  const closing = { lead: await k.text('course-cta-lead'), button: await k.text('course-cta') };
  t.check('CTA penutup pengguna lama: tombol "Lanjutkan" dengan kalimat untuk yang sudah mulai (bukan "misi pertama")', /lanjutkan/i.test(closing.button) && closing.lead.length > 10 && !/pertama/i.test(closing.lead), JSON.stringify(closing));
  t.check('tier 1 yang tuntas ditandai selesai, tier 2 belum', await t.evaluate<boolean>(`${tierCard(1)}?.dataset.done === 'true' && ${tierCard(2)}?.dataset.done === 'false' && ${tierCard(2)}?.dataset.doneCount === '3'`));
  const starts = await t.evaluate<Array<{ tier: string; text: string }>>(`[...document.querySelectorAll('[data-testid="syllabus-start"]')].map(a => ({ tier: a.closest('[data-testid="syllabus-tier"]')?.dataset.tier ?? '', text: a.innerText.trim() }))`);
  t.check('silabus pengguna lama: satu tombol "Lanjutkan" di tier misi berikutnya (tier 2); tier 1 yang tuntas tanpa tombol', starts.length === 1 && starts[0]?.tier === '2' && /^lanjutkan/i.test(starts[0]?.text ?? ''), JSON.stringify(starts));
  t.check('baris "Jalankan query": tombolnya "Lanjutkan misimu" (bukan "Coba misi pertama") bagi yang sudah mulai', /lanjutkan/i.test(await k.text('run-link')) && !/pertama/i.test(await k.text('run-link')), await k.text('run-link'));
  // Streak tersimpan berakhir 2026-11-20: hari ini streak-nya 0 → ajakan memulai lagi (bukan "0 hari"), "Belum" amber.
  const streak = await t.evaluate<{ title: string; tone: string; best: string }>(`({ title: ${tid('streak-title')}?.innerText ?? '', tone: ${tid('streak-today')}?.dataset.tone ?? '', best: ${tid('streak-best')}?.innerText ?? '' })`);
  t.check('streak pengguna lama yang putus: judul ajakan tanpa angka 0, kartu "Belum" berwarna amber, rekor terbaik asli', /mulai streak baru/i.test(streak.title) && !/\b0\b/.test(streak.title) && streak.tone === 'amber' && /1 hari/.test(streak.best), JSON.stringify(streak));

  // Satu klik per tier, masing-masing sesudah tier sebelumnya terbuka (Accordion terkendali: dua klik dalam satu tick
  // sama-sama membaca nilai lama).
  for (const tier of [1, 2]) {
    await t.evaluate(`${tierCard(tier)}.querySelector('[data-testid="syllabus-trigger"]').click(); true`);
    await k.waitFor(`${tierCard(tier)}?.dataset.state === 'open'`, 3000);
  }
  await k.waitFor(`${tierMissions(1)}.length === ${TIER1.length} && ${tierMissions(2)}.length === ${TIER2.length}`, 4000);
  const tier1 = await t.evaluate<MissionRowInfo[]>(tierMissions(1));
  const tier2 = await t.evaluate<MissionRowInfo[]>(tierMissions(2));
  const doneTier2 = tier2.filter((r) => r.done).map((r) => r.id);
  t.check(
    'misi yang selesai bercentang + label "Selesai" (tier 1 semua, tier 2 tiga pertama); yang lain tidak',
    tier1.length === TIER1.length && tier1.every((r) => r.done && /Selesai/.test(r.text)) && doneTier2.join() === TIER2.slice(0, 3).map((m) => m.id).join() && tier2.filter((r) => !r.done).every((r) => !/Selesai/.test(r.text)),
    `tier1=${tier1.filter((r) => r.done).length}/${tier1.length} tier2=${doneTier2.join()}`,
  );
  const firstBoss = TIER1.find(isBoss);
  const bossState = firstBoss ? await t.evaluate<string>(`document.querySelector('[data-boss="${firstBoss.id}"]')?.dataset.state ?? ''`) : '';
  t.check('baris "Taklukkan Boss": Boss tier 1 berstatus selesai', bossState === 'done', bossState);
  await t.sleep(300);
  t.check('landing hanya MEMBACA progres: localStorage tidak berubah', (await k.snapshot()) === before);
}

/* ------------------------------------------------------------------ */
/* 4. Jalur 'segera'                                                   */
/* ------------------------------------------------------------------ */

async function soonLanding(t: SuiteContext, k: Kit, h: Helpers): Promise<void> {
  await t.fresh({}, '#/landing/js');
  const meta = await t.evaluate<Meta>(META);
  const title = TITLE_OF.js ?? 'js';
  t.check(`'#/landing/js': judul tab, satu h1 "Belajar ${title}", JSON-LD tanpa node Course (jalurnya belum dibuka)`, meta.title === courseTitle(title) && meta.h1.length === 1 && meta.h1[0]?.replace(/ /g, ' ') === `Belajar ${title}` && meta.ld.join() === 'BreadcrumbList+FAQPage', JSON.stringify(meta));
  const howText = await t.evaluate<string>(`document.getElementById('cara-mengerjakan')?.innerText ?? ''`);
  t.check('"Cara mengerjakannya" jalur segera: semua langkah ditandai rencana, tanpa "di halaman ini"', howText.length > 50 && !/di halaman ini/i.test(howText) && (howText.match(/rencana/gi) ?? []).length >= 3, howText.replace(/\s+/g, ' ').slice(0, 300));
  t.check('panggung hero jalur segera: kartu rencana bertanda "Rencana", tanpa cuplikan misi', await t.evaluate<boolean>(`(() => { const s = ${tid('course-hero-card')}; return !!s && /Rencana/.test(s.innerText) && !${tid('course-hero-verdict')}; })()`));
  const soon = await t.evaluate<{ status: string; chip: string; syllabus: boolean; stats: boolean; plan: boolean; badges: number; topics: number; note: boolean; primary: string; waiting: string; cta: string; links: string[] }>(`(() => {
    const plan = document.getElementById('rencana');
    return {
      status: ${tid('course-status')}?.dataset.status ?? '',
      chip: ${tid('course-status')}?.innerText ?? '',
      syllabus: !!document.getElementById('silabus') || !!document.querySelector('[data-testid="syllabus"]'),
      stats: !!document.querySelector('#ringkasan ul[aria-label$="dalam angka"]'),
      plan: !!plan && __t.visible(plan),
      badges: plan ? [...plan.querySelectorAll('li')].filter(li => /Rencana/.test(li.innerText)).length : 0,
      topics: plan ? plan.querySelectorAll('li').length : 0,
      note: !!${tid('course-plan-note')},
      primary: ${tid('course-primary')}?.getAttribute('href') ?? '',
      waiting: ${tid('waiting-cta')}?.getAttribute('href') ?? '',
      cta: ${tid('course-cta')}?.getAttribute('href') ?? '',
      links: [...document.querySelectorAll('main a[href^="#/landing/"]')].map(a => a.getAttribute('href')),
    };
  })()`);
  t.check('varian segera: chip "Segera", tanpa silabus & tanpa angka statistik', soon.status === 'segera' && /segera/i.test(soon.chip) && !soon.syllabus && !soon.stats, JSON.stringify(soon));
  t.check('"Rencana materi": 4–6 topik, masing-masing bertanda "Rencana", plus catatan bisa berubah', soon.plan && soon.topics >= 4 && soon.topics <= 6 && soon.badges === soon.topics && soon.note, JSON.stringify(soon));
  t.check('semua CTA jalur segera menuju jalur SQL (#/sql)', soon.primary === '#/sql' && soon.waiting === '#/sql' && soon.cta === '#/sql', JSON.stringify(soon));
  t.check('tidak ada tautan ke jalur segera di luar landing-nya (#/js dkk.)', !(await t.evaluate<boolean>(`[...document.querySelectorAll('a[href]')].some(a => /^#\\/(js|rest|react|framework)\\b/.test(a.getAttribute('href')))`)));
  await t.evaluate(`${tid('course-outline')}.click(); true`);
  t.check('"Lihat rencana" menggulir ke rencana materi', await k.waitFor(`(() => { const top = document.getElementById('rencana')?.getBoundingClientRect().top ?? -999; return top > -5 && top < 160; })()`, 4000));
  t.check('landing jalur segera tidak meminta .wasm', (await h.wasmAfterIdle()).length === 0);

  // Jalur segera lainnya: template yang sama, lewat hash (halaman di-mount ulang, mulai dari atas).
  for (const id of SOON_IDS.filter((x) => x !== 'js')) {
    await t.evaluate(`location.hash = '#/landing/${id}'; true`);
    const up = await h.landingUp('course', id);
    const m = await t.evaluate<Meta>(META);
    const name = TITLE_OF[id] ?? id;
    t.check(
      `'#/landing/${id}': varian segera, judul tab & h1 sendiri, mulai dari atas`,
      up && (await t.evaluate<string>(`${tid('course-status')}?.dataset.status ?? ''`)) === 'segera' && m.title === courseTitle(name) && m.h1.length === 1 && m.h1[0]?.replace(/ /g, ' ') === `Belajar ${name}` && (await t.evaluate<number>(`window.scrollY`)) < 5,
      JSON.stringify(m),
    );
  }
}

/* ------------------------------------------------------------------ */
/* 5. Pengalihan '#/js' & 404                                          */
/* ------------------------------------------------------------------ */

async function redirectsAndNotFound(t: SuiteContext, k: Kit, h: Helpers): Promise<void> {
  // history.length berhenti bertambah di 50 entri; riwayat tab dikosongkan dulu supaya hitungannya berarti.
  await k.send('Page.resetNavigationHistory');
  await t.fresh({}, '#/');
  const before = await t.evaluate<number>(`history.length`);
  await t.evaluate(`location.hash = '#/js'; true`);
  const redirected = await h.landingUp('course', 'js');
  const after = await t.evaluate<number>(`history.length`);
  t.check("'#/js' dari Beranda → '#/landing/js' (replace: satu entri riwayat)", redirected && (await k.hash()) === '#/landing/js' && after - before === 1, `${before} → ${after}, ${await k.hash()}`);
  await t.evaluate(`history.back(); true`);
  t.check('Back dari landing JS → Beranda', await k.waitHome(), await k.hash());
  await t.evaluate(`history.forward(); true`);
  const forward = await h.landingUp('course', 'js');
  await t.sleep(600); // beri kesempatan pengalihan (bila ada) untuk memantul
  t.check('Forward → landing JS lagi, tidak terjebak dalam pengalihan', forward && (await k.hash()) === '#/landing/js' && (await t.evaluate<number>(`history.length`)) === after, `${await k.hash()} riwayat=${await t.evaluate<number>(`history.length`)}`);
  await t.evaluate(`history.back(); true`);
  t.check('Back lagi → Beranda', (await k.waitHome()) && (await k.hash()) === '#/', await k.hash());

  // ---- 404 jalur (muat dingin) ----
  await t.fresh({}, '#/landing/xyz');
  const missing = await t.evaluate<Meta>(META);
  const exits = await t.evaluate<string[]>(`[${tid('not-found-catalog')}, ${tid('not-found-home')}].map(a => a?.getAttribute('href') ?? '')`);
  t.check(
    "'#/landing/xyz' → 404 ramah (navbar & footer, tautan katalog & Beranda, noindex, tanpa JSON-LD)",
    !!(await t.evaluate(`!!${LANDING_PAGE('not-found')}`)) && missing.h1.length === 1 && missing.robots === 'noindex' && missing.ld.length === 0 && exits.join() === '#/landing,#/' && (await k.text('not-found-text')).includes('xyz') && (await t.evaluate<boolean>(`!!document.querySelector('header') && !!${tid('home-footer')}`)),
    JSON.stringify({ ...missing, exits }),
  );
  t.check('404: jalan pintas langsung ke jalur SQL', (await t.evaluate<string>(`${tid('not-found-sql')}?.getAttribute('href') ?? ''`)) === '#/sql');
  t.check('404 tidak meminta .wasm', (await h.wasmAfterIdle(800)).length === 0);
  await h.clickLink('[data-testid="not-found-catalog"]');
  t.check('404 → "Lihat semua jalur" membuka katalog', await h.landingUp('catalog'), await k.hash());

  // Slug yang %-nya rusak (salin-tempel terpotong): tetap 404 jalur yang menjelaskan, bukan Beranda tanpa penjelasan.
  await t.fresh({}, '#/landing/100%');
  const broken = await h.landingUp('not-found');
  await t.sleep(200);
  t.check("'#/landing/100%' (gagal di-decode) → 404 jalur yang menyebut alamatnya, URL dirapikan", broken && (await k.text('not-found-text')).includes('100%') && (await k.hash()) === '#/landing/100%25', `${await k.hash()} "${await k.text('not-found-text')}"`);

  // ---- Kembali ke Beranda: meta halaman dicabut, judul Beranda kembali ----
  await t.evaluate(`location.hash = '#/'; true`);
  await k.waitHome();
  const home = await t.evaluate<Meta>(META);
  t.check('di Beranda: judul produk, tanpa meta/JSON-LD sisa halaman landing', home.title === 'SIMRS Quest' && home.ld.length === 0 && home.robots === null && (await t.evaluate<number>(`document.querySelectorAll('[data-q-page-meta]').length`)) === 0, JSON.stringify(home));
}

/* ------------------------------------------------------------------ */
/* 6. Tautan Beranda → katalog & landing                               */
/* ------------------------------------------------------------------ */

async function homeLinks(t: SuiteContext, k: Kit, h: Helpers): Promise<void> {
  await t.fresh(SEEN_INTRO, '#/');
  /** Kembali ke Beranda (Back) dan pastikan siap sebelum tautan berikutnya. */
  const backHome = async () => {
    await t.evaluate(`history.back(); true`);
    return k.waitHome();
  };
  const arrived = async (page: 'catalog' | 'course', id?: string) => (await h.landingUp(page, id)) && (await t.sleep(150), (await t.evaluate<number>(`window.scrollY`)) < 5);

  // ---- Pita berjalan: fokus keyboard ke pill di luar tepi tidak menggulir pembungkusnya (celah kosong permanen) ----
  await k.waitFor(`document.querySelectorAll('[data-marquee]').length === 2`, 10_000);
  // Fokus ke pill kedua terakhir, lalu Tab sungguhan ke pill terakhir (yang berada di luar tepi kanan pita).
  await t.evaluate(`(() => { const wrap = document.querySelector('[data-marquee]'); wrap.scrollIntoView({ block: 'center', behavior: 'instant' }); const pills = [...wrap.querySelectorAll('a[data-track]:not([tabindex="-1"])')]; pills[pills.length - 2].focus(); return true; })()`);
  await k.press('Tab');
  await t.sleep(250);
  const marquee = await t.evaluate<{ scrolls: number[]; inside: boolean; label: string; focused: boolean }>(`(() => {
    const wrap = document.querySelector('[data-marquee]');
    const pills = [...wrap.querySelectorAll('a[data-track]:not([tabindex="-1"])')];
    const last = pills[pills.length - 1];
    const box = wrap.getBoundingClientRect(); const r = last.getBoundingClientRect();
    const result = { scrolls: [...document.querySelectorAll('[data-marquee]')].map(w => w.scrollLeft), inside: r.left >= box.left - 1 && r.right <= box.right + 1, label: last.innerText.trim(), focused: document.activeElement === last };
    last.blur();
    return result;
  })()`);
  t.check('pita berjalan: Tab ke pill terakhir tidak menggeser pembungkus (scrollLeft 0) dan pill itu terlihat di dalam pita', marquee.focused && marquee.scrolls.every((s) => s === 0) && marquee.inside, JSON.stringify(marquee));
  await t.evaluate(`scrollTo({ top: 0, behavior: 'instant' }); true`);

  // ---- Menu "Jalur" di navbar (dibuka dengan keyboard; tautan diklik mouse) ----
  const navTrigger = (label: string) => `__t.all('header nav button').find(b => b.innerText.trim() === ${JSON.stringify(label)})`;
  await t.evaluate(`scrollTo({ top: 0, behavior: 'instant' }); ${navTrigger('Jalur')}.focus(); true`);
  await k.press('Enter');
  const menuOpen = await k.waitFor(`__t.all('header a[href="#/landing/react"]').length > 0`, 4000);
  await h.clickLink('header a[href="#/landing/react"]');
  t.check('navbar Beranda: menu Jalur → React → landing React (mulai dari atas)', menuOpen && (await arrived('course', 'react')) && (await k.hash()) === '#/landing/react', await k.hash());
  t.check('di landing jalur, menu "Jalur" navbar bertanda aktif', await t.evaluate<boolean>(`${navTrigger('Jalur')}?.dataset.active === 'true'`));
  await backHome();

  // ---- Pita berjalan: pill topik SQL → landing SQL; pill teknologi segera → landing-nya ----
  /** Pill pita berjalan jalur `id` yang sedang berada di dalam layar (pita lebih lebar dari layar dan bergerak). */
  const marqueePill = (id: string) => `__t.all('a[data-track="${id}"][href="#/landing/${id}"]').find(a => { const r = a.getBoundingClientRect(); return r.left > 8 && r.right < innerWidth - 8; })`;
  await k.mouseClick(marqueePill('sql'));
  t.check('pita berjalan: pill topik SQL → landing SQL', (await arrived('course', 'sql')) && (await k.hash()) === '#/landing/sql', await k.hash());
  await backHome();
  await k.mouseClick(marqueePill('framework'));
  t.check('pita berjalan: pill NestJS/Next.js/Laravel → landing jalur framework', (await arrived('course', 'framework')) && (await k.hash()) === '#/landing/framework', await k.hash());
  await backHome();

  // ---- Strip "Jelajahi": "Lihat semua jalur" → katalog ----
  await k.waitFor(`!!${tid('catalog-all-tracks')}`, 15_000);
  await h.clickLink('[data-testid="catalog-all-tracks"]');
  t.check('strip "Jelajahi": "Lihat semua jalur" → katalog', (await arrived('catalog')) && (await k.hash()) === '#/landing', await k.hash());
  await backHome();

  // ---- Peta jalur: tab jalur segera → "Lihat rencana jalur ini" ----
  await k.waitFor(`__t.all('#jalur [role="tab"][data-track="rest"]').length > 0`, 15_000);
  await k.mouseClick(`__t.all('#jalur [role="tab"][data-track="rest"]')[0]`);
  const plan = await k.waitFor(`${tid('roadmap-soon-plan')}?.getAttribute('href') === '#/landing/rest'`, 4000);
  await h.clickLink('[data-testid="roadmap-soon-plan"]');
  t.check('peta jalur: tab REST API → "Lihat rencana jalur ini" → landing REST API', plan && (await arrived('course', 'rest')) && (await k.hash()) === '#/landing/rest', await k.hash());
  await backHome();

  // ---- Footer: jalur & "Semua jalur"; posisi gulir Beranda pulih setelah Back ----
  await k.waitFor(`!!document.getElementById('faq')`, 20_000);
  await h.clickLink('footer a[href="#/landing/js"]');
  t.check('footer: JavaScript & TypeScript → landing JS', (await arrived('course', 'js')) && (await k.hash()) === '#/landing/js', await k.hash());
  t.check('footer landing JS: tautan jalur itu bertanda aria-current', (await t.evaluate<string>(`document.querySelector('footer a[href="#/landing/js"]')?.getAttribute('aria-current') ?? ''`)) === 'page');
  await backHome();
  await t.evaluate(`document.getElementById('faq').scrollIntoView({ block: 'start', behavior: 'instant' }); true`);
  await t.sleep(400);
  const deep = await t.evaluate<number>(`window.scrollY`);
  await t.evaluate(`${tid('footer-all-tracks')}.click(); true`);
  const toCatalog = await arrived('catalog');
  await backHome();
  const restored = await k.waitFor(`Math.abs(window.scrollY - ${deep}) < 60`, 6000);
  t.check('footer "Semua jalur" → katalog mulai dari atas; Back memulihkan posisi gulir Beranda', deep > 2000 && toCatalog && restored, `awal=${Math.round(deep)} sekarang=${Math.round(await t.evaluate<number>(`window.scrollY`))}`);
}

/* ------------------------------------------------------------------ */
/* 7. Tema: satu pilihan untuk Beranda, katalog, landing, dan jalur    */
/* ------------------------------------------------------------------ */

async function theme(t: SuiteContext, k: Kit, h: Helpers): Promise<void> {
  const prefer = (value: 'light' | 'dark' | null) => k.send('Emulation.setEmulatedMedia', { features: value === null ? [] : [{ name: 'prefers-color-scheme', value }] });
  const state = () => t.evaluate<{ theme: string | null; saved: string | null; landing: boolean }>(`({ theme: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem(${JSON.stringify(THEME_KEY)}), landing: document.documentElement.hasAttribute('data-q-landing') })`);
  const backdrop = () => t.evaluate<Backdrop>(BACKDROP);
  try {
    await prefer('light');
    await t.fresh(SEEN_INTRO, '#/');
    await k.click('theme-toggle');
    await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'dark'`, 3000);
    const home = await state();
    await k.waitFor(`!!${tid('footer-all-tracks')}`, 15_000);
    await t.evaluate(`${tid('footer-all-tracks')}.click(); true`);
    await h.landingUp('catalog');
    await t.sleep(300);
    const onCatalog = await state();
    const catalogBg = await backdrop();
    t.check('tema gelap yang dipilih di Beranda berlaku di katalog (walau sistem terang)', home.saved === 'dark' && onCatalog.theme === 'dark' && onCatalog.landing && catalogBg.body < 0.05, `${JSON.stringify(onCatalog)} body ${catalogBg.bodyColor}`);
    await t.evaluate(`location.hash = '#/landing/sql'; true`);
    await h.landingUp('course', 'sql');
    t.check('… dan di landing jalur', (await state()).theme === 'dark' && (await backdrop()).body < 0.05);

    // Ganti tema DI halaman landing → Beranda ikut.
    await k.click('theme-toggle');
    await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'light'`, 3000);
    const switched = await state();
    await t.sleep(300);
    const lightBg = await backdrop();
    t.check('toggle di landing jalur menyimpan tema terang', switched.saved === 'light' && lightBg.body > 0.7, `${JSON.stringify(switched)} body ${lightBg.bodyColor}`);
    await t.evaluate(`location.hash = '#/'; true`);
    await k.waitHome();
    t.check('kembali ke Beranda: tema dari landing berlaku', (await state()).theme === 'light');

    // Tema berlaku untuk seluruh aplikasi: layar jalur ikut tema landing; penanda landing dilepas, data-theme tetap.
    await t.evaluate(`location.hash = '#/landing/sql'; true`);
    await h.landingUp('course', 'sql');
    await t.evaluate(`${tid('course-primary')}.click(); true`);
    await k.waitTrack();
    await t.sleep(300);
    const inTrack = await state();
    const trackBg = await backdrop();
    t.check('dari landing terang ke jalur: layar jalur ikut terang, penanda landing dilepas', looksLightTrack(trackBg) && inTrack.theme === 'light' && !inTrack.landing, `${trackBg.bodyColor} ${Math.round(trackBg.light * 100)}% terang; ${JSON.stringify(inTrack)}`);
    // Ganti tema DI jalur → halaman landing ikut setelah Back.
    await t.evaluate(`__t.all('[data-testid="track-theme-toggle"]')[0].click(); true`);
    await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'dark'`, 3000);
    await t.sleep(300);
    const darkTrack = await backdrop();
    t.check('tombol tema di jalur: layar jalur gelap seperti dulu, tersimpan', looksDarkTrack(darkTrack) && (await state()).saved === 'dark', `${darkTrack.bodyColor} ${Math.round(darkTrack.dark * 100)}% gelap`);
    await t.evaluate(`history.back(); true`);
    await h.landingUp('course', 'sql');
    const back = await state();
    t.check('Back ke landing: tema dari jalur (gelap) berlaku, penanda landing terpasang lagi', back.theme === 'dark' && back.landing && (await backdrop()).body < 0.05, JSON.stringify(back));
  } finally {
    await prefer(null);
  }
}

/* ------------------------------------------------------------------ */
/* 8. Jalur hangat di balik halaman landing                           */
/* ------------------------------------------------------------------ */

async function warmTrack(t: SuiteContext, k: Kit, h: Helpers): Promise<void> {
  await t.fresh(SEEN_INTRO, '#/');
  await k.click('home-primary');
  await k.waitTrack();
  await t.evaluate(`__t.waitText(${JSON.stringify(ORDERED[0]?.title ?? '')}, 20000)`);
  const DRAFT = 'SELECT nama /* draf e2e landing */ FROM pasien WHERE ';
  await t.evaluate(`__t.setSql(${JSON.stringify(DRAFT)}); document.querySelector('[data-testid="track-host"]').__e2eMark = 'hangat'; true`);
  await t.sleep(250);
  const wasmBefore = (await t.evaluate<string[]>(WASM_REQUESTS)).length;

  await t.evaluate(`location.hash = '#/landing/sql'; true`);
  const over = await h.landingUp('course', 'sql');
  const hidden = await k.hiddenTrack();
  t.check('landing jalur di atas jalur hangat: jalur ter-mount tetapi tersembunyi & tanpa fokus', over && hidden.host && hidden.hidden && hidden.visible === 0 && !hidden.focusInside && hidden.strays.length === 0, JSON.stringify(hidden));
  t.check('judul tab landing tidak ditimpa shell', (await t.evaluate<string>(`document.title`)) === courseTitle('SQL'));

  // Tab berkali-kali: fokus selalu di elemen landing yang terlihat, tidak pernah masuk ke jalur tersembunyi.
  await t.evaluate(`document.activeElement?.blur(); scrollTo({ top: 0, behavior: 'instant' }); true`);
  const strayFocus: string[] = [];
  for (let i = 0; i < 25; i += 1) {
    await k.press('Tab');
    const where = await t.evaluate<{ inTrack: boolean; visible: boolean; tag: string }>(`(() => { const el = document.activeElement; const host = document.querySelector('[data-testid="track-host"]'); return { inTrack: !!host && host.contains(el), visible: !el || el === document.body || __t.visible(el), tag: el ? el.tagName.toLowerCase() + (el.dataset?.testid ? '#' + el.dataset.testid : '') : '' }; })()`);
    if (where.inTrack || !where.visible) strayFocus.push(where.tag);
  }
  t.check('Tab di landing tidak pernah memfokus elemen jalur yang tersembunyi', strayFocus.length === 0, strayFocus.join(', '));

  // Lewat katalog dan kembali ke jalur dengan tombol landing: draf utuh, mesin SQL tidak dimuat ulang.
  await t.evaluate(`location.hash = '#/landing'; true`);
  await h.landingUp('catalog');
  t.check('katalog di atas jalur hangat: jalur tetap tersembunyi', (await k.hiddenTrack()).hidden && (await t.evaluate<string>(`document.title`)).includes('Semua Jalur'));
  await t.evaluate(`history.back(); true`);
  await h.landingUp('course', 'sql');
  await t.evaluate(`scrollTo({ top: 0, behavior: 'instant' }); ${tid('course-primary')}.click(); true`);
  await k.waitTrack();
  const back = await t.evaluate<{ draft: string; mark: string; title: string; hash: string }>(`({ draft: __t.all('textarea')[0]?.value ?? '', mark: document.querySelector('[data-testid="track-host"]')?.__e2eMark ?? '', title: document.title, hash: location.hash })`);
  t.check('kembali ke jalur dari landing: draf editor masih ada, jalur tetap hangat', back.draft === DRAFT && back.mark === 'hangat' && back.hash === '#/sql', JSON.stringify(back));
  t.check('mesin SQL tidak diminta lagi & judul tab jalur pulih', (await t.evaluate<string[]>(WASM_REQUESTS)).length === wasmBefore && back.title.startsWith('SQL'), back.title);
  await t.evaluate(`location.hash = '#/'; true`);
  t.check('ke Beranda: judul tab Beranda pulih', (await k.waitHome()) && (await t.evaluate<string>(`document.title`)) === 'SIMRS Quest');
}

/* ------------------------------------------------------------------ */
/* 9. Tanpa gulir horizontal, satu h1                                  */
/* ------------------------------------------------------------------ */

async function layout(t: SuiteContext, k: Kit, h: Helpers): Promise<void> {
  const routes: ReadonlyArray<[string, 'catalog' | 'course' | 'not-found']> = [
    ['#/landing', 'catalog'],
    ['#/landing/sql', 'course'],
    ['#/landing/js', 'course'],
    ['#/landing/xyz', 'not-found'],
  ];
  try {
    for (const [width, height] of [[1440, 900], [375, 812]] as const) {
      await k.viewport(width, height);
      for (const [route, page] of routes) {
        await t.fresh(SEEN_INTRO, route);
        await h.landingUp(page);
        const m = await h.overflowWhileScrolling();
        const h1 = await t.evaluate<number>(`__t.all('h1').length`);
        t.check(`${route} pada ${width}px: tanpa gulir horizontal, tepat satu h1`, m.inner === width && m.over <= 0 && m.scrollX === 0 && h1 === 1, JSON.stringify({ ...m, h1 }));
        if (route === '#/landing/sql') {
          // Kartu "Tanpa instalasi" menumpang di bingkai bawah ponsel: tidak menutupi judul tier / angka yang belum memudar.
          const covered = await t.evaluate<string[]>(`(async () => {
            const card = document.querySelector('[data-testid="anywhere-floating"]');
            card.scrollIntoView({ block: 'center', behavior: 'instant' });
            await new Promise(r => setTimeout(r, 300));
            const c = card.getBoundingClientRect();
            const fade = document.querySelector('[data-phone-fade]').getBoundingClientRect();
            return [...document.querySelectorAll('[data-phone-text]')].filter(el => { const r = el.getBoundingClientRect(); return r.bottom <= fade.top + 1 && r.right > c.left && r.left < c.right && r.bottom > c.top && r.top < c.bottom; }).map(el => el.textContent);
          })()`);
          t.check(`kartu "Tanpa instalasi" pada ${width}px tidak menutupi judul tier / angka kemajuan di ponsel`, covered.length === 0, covered.join(' | '));
        }
      }
    }
  } finally {
    await k.resetViewport();
  }
}

/* ------------------------------------------------------------------ */

export async function coursesSuite(t: SuiteContext): Promise<void> {
  const k = kit(t);
  const h = helpers(t, k);
  // Buffer Resource Timing diperbesar untuk setiap dokumen suite ini (lihat WASM_REQUESTS); dilepas lagi di akhir.
  const buffer = (await k.send('Page.addScriptToEvaluateOnNewDocument', { source: `performance.setResourceTimingBufferSize(${RESOURCE_BUFFER});` })) as { identifier?: string };
  try {
    await catalog(t, k, h);
    await sqlLanding(t, k, h);
    await runRowTabs(t, k);
    await returningUser(t, k);
    await soonLanding(t, k, h);
    await redirectsAndNotFound(t, k, h);
    await homeLinks(t, k, h);
    await theme(t, k, h);
    await warmTrack(t, k, h);
    await layout(t, k, h);
  } finally {
    await k.send('Emulation.clearDeviceMetricsOverride').catch(() => undefined);
    await k.send('Emulation.setEmulatedMedia', { features: [] }).catch(() => undefined);
    if (buffer.identifier !== undefined) await k.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: buffer.identifier }).catch(() => undefined);
  }
}
