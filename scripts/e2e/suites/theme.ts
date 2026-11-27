/**
 * Mode terang/gelap layar jalur SQL — satu tema untuk seluruh aplikasi (src/platform/theme.ts, src/theme.css).
 *
 *  (a) Tombol tema di header jalur (mouse & keyboard): mengganti tema, tersimpan, label berganti; pilihan berlaku di
 *      Beranda & halaman landing dan sebaliknya; tab lain (event storage) dan tema sistem (belum memilih) diikuti.
 *  (b) '#/sql' dibuka langsung bertema terang: tidak ada gambar (frame) gelap sejak frame pertama — dicatat lewat
 *      requestAnimationFrame dari skrip yang dipasang sebelum dokumen dibuat — termasuk selama layar muat jalur & mesin
 *      SQL ditahan; begitu pula tema gelap tanpa frame terang.
 *  (c) Pindah Beranda ↔ jalur ↔ katalog/landing mempertahankan tema tanpa kedipan; halaman landing tidak ikut palet
 *      jalur (variabel --c-* tetap nilai asli, token --q-* = tokens.css, kelas palet di landing tetap warna asli).
 *  (d) Pemindai kontras (scripts/e2e/contrast.ts) di SETIAP layar/keadaan jalur — tema terang DAN gelap, 1440 DAN
 *      375 px: terang nol pelanggaran AA (pengecualian hanya teks dekoratif aria-hidden yang dicatat beralasan di
 *      scripts/e2e/contrastAllow.ts); gelap tidak boleh punya pelanggaran BARU (yang lama tercatat di sana karena tema
 *      gelap wajib identik dengan sebelumnya). Ditambah: tidak ada permukaan besar yang berlawanan tema.
 *  (e) Tema gelap identik: semua variabel --c-* = tailwindcss/colors persis, dan warna terhitung elemen kunci (body,
 *      header, panel, kartu skenario, editor, tombol utama, judul, kata kunci SQL) = nilai Tailwind asli. Penyorot SQL
 *      di tema terang: setiap jenis token ≥ 4.5:1 terhadap latar editor.
 *  (f) Portal & lapisan melayang (popup autocomplete di <body>, notifikasi lencana) ikut tema — juga saat tema diganti
 *      selagi popup terbuka.
 *  (g) Console bersih (pemeriksaan penutup run.ts); pesan yang memang diharapkan saat modul jalur sengaja digagalkan
 *      disaring dengan kit.expectingConsole.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import colors from 'tailwindcss/colors';
import { MISSIONS } from '../../../src/data/missions';
import { PROGRESS_KEY, progressWith, type SuiteContext } from '../context';
import { contrastScanExpression, formatContrastIssues, type ContrastIssue, type ContrastReport } from '../contrast';
import { DARK_PREEXISTING, LIGHT_SCAN_EXEMPT, contrastKey, lightExempt, type LightExempt } from '../contrastAllow';
import { BACKDROP, LANDING_PAGE, TRACK_DARK_BODY, kit, looksDarkTrack, looksLightTrack, tid, type Backdrop, type Kit } from '../kit';

type Theme = 'light' | 'dark';

const THEME_KEY = 'simrs-quest:theme:v1';
const MISTAKES_KEY = 'simrs-sql-quest:mistakes:v1';
const EXAM_SESSION_KEY = 'simrs-sql-quest:exam-session:v1';
const INTRO_KEY = 'simrs-quest:home-intro:v1';
const THEMES: readonly Theme[] = ['light', 'dark'];
const TOGGLE = `__t.all('[data-testid="track-theme-toggle"]')[0]`;
/**
 * Biner mesin SQL saja (URL berakhir .wasm). Di server dev ada juga modul JS kecil `sql-wasm.wasm?import&url` yang
 * ikut graf modul jalur — menahan modul itu menahan seluruh jalur (layar muat shell), bukan mesin SQL-nya.
 */
const WASM_BINARY = '*sql-wasm*.wasm';

/* ------------------------------------------------------------------ */
/* Nilai acuan: tailwindcss/colors, src/theme.css, tokens.css          */
/* ------------------------------------------------------------------ */

const readRepo = (relative: string) => readFileSync(new URL(`../../../${relative}`, import.meta.url), 'utf8');

/** Variabel "R G B" di satu blok CSS (selektor persis), mis. { 'c-slate-950': '2 6 23' }. */
function cssBlockVars(css: string, selector: string, prefix: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`blok "${selector}" tidak ditemukan`);
  const body = css.slice(start, css.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(new RegExp(String.raw`--(${prefix}[a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;`, 'g'))) out[m[1] ?? ''] = `${m[2]} ${m[3]} ${m[4]}`;
  return out;
}

const THEME_CSS = readRepo('src/theme.css');
/**
 * Variabel palet --c-<palet>-<shade> tema gelap (:root) dan terang (blok terang menimpa :root). Variabel lain di blok
 * yang sama (mis. --c-scrollbar, yang di tema gelap merujuk var(--c-slate-700)) bukan bagian palet.
 */
const PALETTE: Record<Theme, Record<string, string>> = (() => {
  const palette = (vars: Record<string, string>) => Object.fromEntries(Object.entries(vars).filter(([name]) => /^c-[a-z]+-\d+$/.test(name)));
  const dark = palette(cssBlockVars(THEME_CSS, ':root', 'c-'));
  return { dark, light: { ...dark, ...palette(cssBlockVars(THEME_CSS, "html[data-theme='light']:not([data-q-landing])", 'c-')) } };
})();
const TOKENS_CSS = readRepo('src/platform/landing/styles/tokens.css');
/** Token landing --q-* per tema. */
const Q_TOKENS: Record<Theme, Record<string, string>> = {
  light: cssBlockVars(TOKENS_CSS, "html[data-theme='light']", 'q-'),
  dark: cssBlockVars(TOKENS_CSS, "html[data-theme='dark']", 'q-'),
};

/**
 * Warna Tailwind asli "R G B" per nama 'slate-950' (dari tailwindcss/colors, tanpa cast). Hanya properti data yang
 * dibaca: nama lama (lightBlue, warmGray, …) adalah getter yang mencetak peringatan usang.
 */
const TAILWIND: Map<string, string> = (() => {
  const out = new Map<string, string>();
  for (const name of Object.keys(colors)) {
    const scale: unknown = Object.getOwnPropertyDescriptor(colors, name)?.value;
    if (typeof scale !== 'object' || scale === null) continue;
    for (const [shade, hex] of Object.entries(scale)) {
      if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) continue;
      out.set(`${name}-${shade}`, [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(' '));
    }
  }
  return out;
})();

/** Warna terhitung (getComputedStyle) kelas Tailwind asli, mis. css('slate-900', 0.8) → 'rgba(15, 23, 42, 0.8)'. */
function css(name: string, alpha = 1): string {
  const rgb = TAILWIND.get(name);
  if (rgb === undefined) throw new Error(`warna Tailwind tidak dikenal: ${name}`);
  const parts = rgb.split(' ').join(', ');
  return alpha === 1 ? `rgb(${parts})` : `rgba(${parts}, ${alpha})`;
}

/* ------------------------------------------------------------------ */
/* Potongan ekspresi halaman                                           */
/* ------------------------------------------------------------------ */

/** Animasi & transisi dibekukan supaya warna yang dipindai adalah warna akhir (bukan di tengah transisi tema). */
const FREEZE = `(() => { if (!document.getElementById('__theme-freeze')) { const s = document.createElement('style'); s.id = '__theme-freeze'; s.textContent = '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; }'; document.head.appendChild(s); } return true; })()`;

/** Luminans relatif & pengurai warna di halaman (dipakai beberapa ekspresi). */
const PAGE_COLOR = String.raw`
  const parse = (c) => { const n = (String(c).match(/[\d.]+/g) || []).map(Number); return [n[0] || 0, n[1] || 0, n[2] || 0, n.length > 3 ? n[3] : 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const solidLum = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0.9) return lum(c); } const scheme = getComputedStyle(document.documentElement).colorScheme; return /dark/.test(scheme) && !/light/.test(scheme) ? lum([18, 18, 18]) : 1; };
  const corners = () => [[0.03, 0.03], [0.97, 0.03], [0.03, 0.97], [0.97, 0.97]].map(([x, y]) => solidLum(document.elementFromPoint(innerWidth * x, innerHeight * y)));
`;

/**
 * Perekam frame: setiap requestAnimationFrame (dipanggil tepat sebelum browser menggambar) mencatat tema, penanda
 * landing, apakah CSS aplikasi sudah berlaku, cuplikan teks, dan luminans permukaan di empat pojok layar.
 * `startExpr` = ekspresi pemasang (juga dipakai sebagai skrip dokumen baru).
 */
const FRAME_RECORDER = `(() => {
  ${PAGE_COLOR}
  const frames = [];
  window.__themeFrames = frames;
  window.__themeFramesStop = false;
  const sample = () => {
    const de = document.documentElement;
    const body = document.body;
    // CSS aplikasi sudah berlaku = latar <body> (kelas bg-slate-950) sudah padat. Di server dev CSS disuntik JS setelah
    // gambar pertama, jadi beberapa frame awal memang tanpa CSS (sama seperti sebelum ada tema terang).
    const styled = !!body && parse(getComputedStyle(body).backgroundColor)[3] > 0.9;
    frames.push({ t: Math.round(performance.now()), theme: de.getAttribute('data-theme'), landing: de.hasAttribute('data-q-landing'), styled, text: body ? body.innerText.slice(0, 50).replace(/\\s+/g, ' ') : '', corners: corners() });
  };
  const loop = () => { try { sample(); } catch (e) { /* dokumen sedang dibangun */ } if (!window.__themeFramesStop && frames.length < 1500) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return true;
})()`;

interface Frame {
  t: number;
  theme: string | null;
  landing: boolean;
  styled: boolean;
  text: string;
  corners: number[];
}

/** Frame yang berlawanan tema: ≥ 3 dari 4 pojok layar gelap (tema terang) / terang (tema gelap) — kilatan layar penuh. */
function flashes(frames: readonly Frame[], theme: Theme, opts: { skipUnstyled: boolean }): Frame[] {
  return frames.filter((f) => {
    if (opts.skipUnstyled && !f.styled) return false;
    const opposite = f.corners.filter((l) => (theme === 'light' ? l < 0.1 : l > 0.4)).length;
    return opposite >= 3;
  });
}

const showFrame = (f: Frame) => `${f.t}ms ${f.theme ?? '-'}${f.landing ? '+landing' : ''}${f.styled ? '' : ' (tanpa CSS)'} pojok ${f.corners.map((l) => l.toFixed(2)).join('/')} «${f.text}»`;

/**
 * Permukaan besar (≥ 20.000 px², latar ≥ 50% alfa) yang berlawanan tema: di tema terang latar efektifnya gelap
 * (L < 0.2), di tema gelap terang (L > 0.5). Tombol aksen berwarna tua di tema terang terlalu kecil untuk ikut.
 */
const OPPOSITE_SURFACES = (theme: Theme) => `(() => {
  ${PAGE_COLOR}
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 20000 || el.getClientRects().length === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.display === 'none') continue;
    const c = parse(cs.backgroundColor);
    if (c[3] < 0.5) continue;
    const under = el.parentElement ? solidLum(el.parentElement) : 1;
    const l = lum(c) * c[3] + under * (1 - c[3]);
    if (${theme === 'light' ? 'l < 0.2' : 'l > 0.5'}) out.push(el.tagName.toLowerCase() + '.' + [...el.classList].slice(0, 4).join('.') + ' ' + Math.round(r.width) + '×' + Math.round(r.height) + ' L=' + l.toFixed(2));
  }
  return out.slice(0, 5);
})()`;

/* ------------------------------------------------------------------ */
/* Alat bantu suite                                                    */
/* ------------------------------------------------------------------ */

interface Helpers {
  prefer: (value: Theme | null) => Promise<unknown>;
  html: () => Promise<{ theme: string | null; landing: boolean; saved: string | null }>;
  backdrop: () => Promise<Backdrop>;
  /** Ganti tema TANPA klik (seperti tab lain mengganti tema): localStorage + event storage; tunggu data-theme. */
  setThemeLive: (theme: Theme) => Promise<boolean>;
  toggleState: () => Promise<{ label: string | null; current: string | null; title: string | null } | null>;
  /** Variabel CSS terhitung di <html> untuk nama-nama itu. */
  vars: (names: readonly string[]) => Promise<Record<string, string>>;
  /** Pasang perekam frame di halaman ini (bukan dokumen baru). */
  recordFrames: () => Promise<unknown>;
  stopFrames: () => Promise<Frame[]>;
  isDev: () => Promise<boolean>;
  /**
   * Storage diganti (nilai MENTAH) + rute + muat ulang, TANPA menunggu aplikasi siap (untuk layar muat yang sengaja
   * ditahan). Bila halaman sedang di luar aplikasi (about:blank), buka aplikasinya dulu.
   */
  loadLoose: (raw: Record<string, string>, route: string) => Promise<void>;
}

function helpers(t: SuiteContext, k: Kit): Helpers {
  return {
    prefer: (value) => k.send('Emulation.setEmulatedMedia', { features: value === null ? [] : [{ name: 'prefers-color-scheme', value }] }),
    html: () =>
      t.evaluate(`({ theme: document.documentElement.getAttribute('data-theme'), landing: document.documentElement.hasAttribute('data-q-landing'), saved: localStorage.getItem(${JSON.stringify(THEME_KEY)}) })`),
    backdrop: () => t.evaluate<Backdrop>(BACKDROP),
    setThemeLive: async (theme) => {
      await t.evaluate(
        `(() => { localStorage.setItem(${JSON.stringify(THEME_KEY)}, ${JSON.stringify(theme)}); window.dispatchEvent(new StorageEvent('storage', { key: ${JSON.stringify(THEME_KEY)}, newValue: ${JSON.stringify(theme)}, storageArea: localStorage })); return true; })()`,
      );
      const ok = await k.waitFor(`document.documentElement.getAttribute('data-theme') === ${JSON.stringify(theme)}`, 3000);
      await t.evaluate(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`);
      return ok;
    },
    toggleState: () =>
      t.evaluate(`(() => { const b = ${TOGGLE}; return b ? { label: b.getAttribute('aria-label'), current: b.getAttribute('data-theme-current'), title: b.getAttribute('title') } : null; })()`),
    vars: (names) =>
      t.evaluate(`(() => { const cs = getComputedStyle(document.documentElement); return Object.fromEntries(${JSON.stringify(names)}.map((n) => [n, cs.getPropertyValue('--' + n).trim().replace(/\\s+/g, ' ')])); })()`),
    recordFrames: () => t.evaluate(FRAME_RECORDER),
    stopFrames: () => t.evaluate<Frame[]>(`(() => { window.__themeFramesStop = true; return window.__themeFrames ?? []; })()`),
    isDev: () => t.evaluate<boolean>(`!!document.querySelector('script[src*="/@vite/client"]')`),
    loadLoose: async (raw, route) => {
      if (!(await t.evaluate<boolean>(`location.href.startsWith(${JSON.stringify(t.url)})`).catch(() => false))) await t.browser.navigate(t.url);
      await t
        .evaluate(
          `localStorage.clear(); sessionStorage.clear(); ${Object.entries(raw)
            .map(([key, value]) => `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});`)
            .join(' ')} history.replaceState(null, '', location.pathname + location.search + ${JSON.stringify(route)}); location.reload(); true`,
        )
        .catch(() => undefined); // konteks halaman bisa hilang saat reload dimulai
      await t.sleep(400);
      await t.browser.waitForLoad();
      await t.installHelpers();
    },
  };
}

/** Selisih nilai variabel terhitung vs acuan (paling banyak 4 untuk pesan). */
function varDiff(actual: Record<string, string>, expected: Record<string, string>): string[] {
  return Object.entries(expected)
    .filter(([name, value]) => actual[name] !== value)
    .map(([name, value]) => `--${name}: ${actual[name] ?? '(kosong)'} ≠ ${value}`)
    .slice(0, 4);
}

/* ------------------------------------------------------------------ */
/* (a) Tombol tema di header jalur                                     */
/* ------------------------------------------------------------------ */

async function toggle(t: SuiteContext, k: Kit, h: Helpers): Promise<void> {
  // Belum pernah memilih → ikut tema sistem (dan ikut berubah bila sistem berganti).
  await h.prefer('dark');
  await t.fresh({}, '#/sql');
  const sysDark = await h.html();
  const sysDarkBg = await h.backdrop();
  t.check('belum memilih + sistem gelap: jalur gelap seperti dulu, tidak ada yang disimpan', sysDark.theme === 'dark' && sysDark.saved === null && looksDarkTrack(sysDarkBg), `${JSON.stringify(sysDark)} ${sysDarkBg.bodyColor}`);
  await h.prefer('light');
  const followed = await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'light'`, 3000);
  await t.sleep(200);
  t.check('belum memilih: sistem berganti ke terang → jalur ikut terang tanpa muat ulang', followed && looksLightTrack(await h.backdrop()) && (await h.html()).saved === null);
  await h.prefer('dark');
  await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'dark'`, 3000);

  // Mouse: gelap → terang.
  const before = await h.toggleState();
  t.check('tombol tema di header jalur: ikon tema aktif, label & title menyebut aksinya', before?.label === 'Ganti ke tema terang' && before.title === before.label && before.current === 'dark', JSON.stringify(before));
  await k.mouseClick(TOGGLE);
  await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'light'`, 3000);
  await t.sleep(200);
  const afterClick = await h.html();
  const lightBg = await h.backdrop();
  const lightToggle = await h.toggleState();
  t.check(
    'klik tombol tema: jalur terang, tersimpan "light", label berganti',
    afterClick.saved === 'light' && !afterClick.landing && looksLightTrack(lightBg) && lightToggle?.label === 'Ganti ke tema gelap' && lightToggle.current === 'light',
    `${JSON.stringify(afterClick)} ${lightBg.bodyColor} ${JSON.stringify(lightToggle)}`,
  );
  const focusRing = await t.evaluate<string>(`(() => { const b = ${TOGGLE}; b.focus(); return document.activeElement === b ? 'fokus' : 'tidak'; })()`);
  // Keyboard: Enter lalu Spasi (fokus tetap di tombol yang sama).
  await k.press('Enter');
  const byEnter = await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'dark'`, 3000);
  await k.press('Space');
  const bySpace = await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'light'`, 3000);
  t.check('tombol tema bisa dipakai dengan keyboard (Enter → gelap, Spasi → terang)', focusRing === 'fokus' && byEnter && bySpace && (await h.html()).saved === 'light');

  // Pilihan tersimpan mengalahkan tema sistem setelah muat ulang.
  await t.reload();
  t.check('muat ulang: pilihan "light" tetap (walau sistem gelap)', (await h.html()).theme === 'light' && looksLightTrack(await h.backdrop()));

  // Tab lain mengganti tema → jalur ikut (event storage), tanpa muat ulang.
  const synced = await h.setThemeLive('dark');
  await t.sleep(150);
  t.check('tab lain mengganti tema (event storage): jalur ikut gelap', synced && looksDarkTrack(await h.backdrop()) && (await h.toggleState())?.current === 'dark');
  await h.setThemeLive('light');

  // Jalur → Beranda: pilihan dari jalur berlaku. Beranda → jalur: sebaliknya.
  await k.headerHome();
  const home = await h.html();
  const homeQ = await h.vars(['q-bg']);
  t.check('dari jalur (terang) ke Beranda: Beranda terang', home.theme === 'light' && home.landing && homeQ['q-bg'] === Q_TOKENS.light['q-bg'], `${JSON.stringify(home)} ${JSON.stringify(homeQ)}`);
  await k.click('theme-toggle');
  await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'dark'`, 3000);
  await k.click('home-primary');
  await k.waitTrack();
  await t.sleep(200);
  const track = await h.html();
  t.check('pilihan gelap di Beranda berlaku di jalur (jalur hangat ikut tanpa muat ulang)', track.theme === 'dark' && !track.landing && looksDarkTrack(await h.backdrop()) && (await h.toggleState())?.label === 'Ganti ke tema terang', JSON.stringify(track));

  // Jalur → landing jalur SQL: pilihan dari jalur berlaku di halaman landing.
  await k.mouseClick(TOGGLE);
  await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'light'`, 3000);
  await t.evaluate(`location.hash = '#/landing/sql'; true`);
  await k.waitFor(`!!${LANDING_PAGE('course')}`, 15_000);
  const landing = await h.html();
  t.check('pilihan terang di jalur berlaku di halaman landing jalur', landing.theme === 'light' && landing.landing && (await h.vars(['q-bg']))['q-bg'] === Q_TOKENS.light['q-bg'], JSON.stringify(landing));
  await h.prefer(null);

  // Letak tombol di berbagai lebar (XP 4 digit = header terpadat): tepat satu tombol tema terlihat, di dalam header,
  // tidak menimpa elemen header lain. Di bawah 394px ia berada di baris lambang (bukan di baris pil XP/streak).
  // Urutan fokus keyboard mengikuti urutan tampilan (WCAG 2.4.3): < 394px tepat setelah lambang (pojok kanan atas baris
  // lambang), mulai 394px tepat sebelum Reset (kotak bersama di ujung kanan).
  await k.freshRaw({ [THEME_KEY]: 'light', [PROGRESS_KEY]: JSON.stringify(progressWith(MISSIONS.slice(0, 56).map((m) => m.id), MISSIONS[56]?.id ?? '')) }, '#/sql');
  const problems: string[] = [];
  const order: string[] = [];
  for (const width of [360, 375, 393, 394, 414, 640, 768, 1024, 1440]) {
    await k.viewport(width, 800);
    const layout = await t.evaluate<{ count: number; inside: boolean; overlap: string[]; brandRow: boolean; prev: string | null; next: string | null }>(HEADER_LAYOUT);
    const ok = layout.count === 1 && layout.inside && layout.overlap.length === 0 && (width >= 394 || layout.brandRow);
    if (!ok) problems.push(`${width}px ${JSON.stringify(layout)}`);
    const inOrder = width < 394 ? layout.prev === 'Beranda' : layout.next === 'Reset progres';
    if (!inOrder) order.push(`${width}px: sebelum ${layout.prev ?? '-'}, sesudah ${layout.next ?? '-'}`);
  }
  await k.resetViewport();
  t.check('tombol tema: satu yang terlihat di setiap lebar (360–1440 px), di dalam header, tidak menimpa elemen lain; < 394px di baris lambang', problems.length === 0, problems.slice(0, 2).join(' | '));
  t.check('tombol tema: urutan fokus keyboard = urutan tampilan (< 394px setelah lambang Beranda; ≥ 394px sebelum Reset)', order.length === 0, order.slice(0, 3).join(' | '));
}

/** Letak tombol tema yang terlihat di header jalur (lihat pemakaiannya). */
const HEADER_LAYOUT = `(() => {
  const header = document.querySelector('header');
  const toggles = __t.all('[data-testid="track-theme-toggle"]');
  const toggle = toggles[0];
  if (!header || !toggle) return { count: toggles.length, inside: false, overlap: [], brandRow: false };
  const hr = header.getBoundingClientRect();
  const tr = toggle.getBoundingClientRect();
  const hit = (r) => r.left < tr.right - 0.5 && r.right > tr.left + 0.5 && r.top < tr.bottom - 0.5 && r.bottom > tr.top + 0.5;
  const overlap = [...header.querySelectorAll('button, h1, [role="group"], [title]')]
    .filter((e) => e !== toggle && !e.contains(toggle) && !toggle.contains(e) && __t.visible(e) && hit(e.getBoundingClientRect()))
    .map((e) => e.tagName.toLowerCase() + (e.getAttribute('aria-label') ? '[' + e.getAttribute('aria-label') + ']' : e.title ? '[' + e.title + ']' : ''));
  const brand = header.querySelector('button[aria-label="Beranda"]')?.getBoundingClientRect();
  const brandRow = !!brand && Math.abs((brand.top + brand.bottom) / 2 - (tr.top + tr.bottom) / 2) < 3;
  // Urutan fokus keyboard = urutan DOM tombol yang terlihat; tetangga tombol tema di urutan itu.
  const buttons = [...header.querySelectorAll('button')].filter(__t.visible);
  const at = buttons.indexOf(toggle);
  const name = (b) => (b ? b.getAttribute('aria-label') || b.title || b.innerText.trim() : null);
  return { count: toggles.length, inside: tr.left >= hr.left && tr.right <= hr.right && tr.top >= hr.top && tr.bottom <= hr.bottom, overlap, brandRow, prev: name(buttons[at - 1]), next: name(buttons[at + 1]) };
})()`;

/* ------------------------------------------------------------------ */
/* (b) '#/sql' dibuka langsung: tanpa kedipan, layar muat ikut tema     */
/* ------------------------------------------------------------------ */

async function directOpen(t: SuiteContext, k: Kit, h: Helpers): Promise<void> {
  const added = (await k.send('Page.addScriptToEvaluateOnNewDocument', { source: FRAME_RECORDER })) as { identifier?: string };
  try {
    for (const theme of THEMES) {
      // Sistem berlawanan dengan pilihan tersimpan: yang menang harus pilihan tersimpan, sejak frame pertama.
      await h.prefer(theme === 'light' ? 'dark' : 'light');
      // Mesin SQL (.wasm) ditahan supaya layar muat jalur terlihat cukup lama untuk diperiksa.
      await k.send('Fetch.enable', { patterns: [{ urlPattern: WASM_BINARY, requestStage: 'Request' }] });
      const paused = t.browser.waitForEvent('Fetch.requestPaused', 30_000);
      let requestId: string | undefined;
      try {
        await h.loadLoose({ [THEME_KEY]: theme }, '#/sql');
        const req = await paused;
        requestId = typeof req?.requestId === 'string' ? req.requestId : undefined;
        const loading = await k.waitFor(`__t.has('Menyiapkan database') || __t.has('Memuat')`, 15_000);
        await t.sleep(300);
        const loadingBg = await h.backdrop();
        t.check(
          `'#/sql' langsung (${theme}): layar muat jalur ikut tema selagi mesin SQL dimuat`,
          loading && requestId !== undefined && (theme === 'light' ? looksLightTrack(loadingBg) : looksDarkTrack(loadingBg)),
          `${loadingBg.bodyColor} ${Math.round(loadingBg.light * 100)}% terang / ${Math.round(loadingBg.dark * 100)}% gelap`,
        );
      } finally {
        if (requestId !== undefined) await k.send('Fetch.continueRequest', { requestId });
        await k.send('Fetch.disable');
      }
      const ready = await k.waitTrack();
      await t.sleep(300);
      const frames = await h.stopFrames();
      const dev = await h.isDev();
      const first = frames[0];
      // Server dev: CSS disuntik JS setelah gambar pertama → frame awal tanpa CSS = kanvas putih bawaan (sama seperti
      // sebelum ada tema terang; build produksi memuat CSS sebelum gambar pertama). Untuk tema terang tetap dinilai.
      const skipUnstyled = dev && theme === 'dark';
      const bad = flashes(frames, theme, { skipUnstyled });
      const unstyled = frames.filter((f) => !f.styled).length;
      t.check(
        `'#/sql' langsung (${theme}, sistem ${theme === 'light' ? 'gelap' : 'terang'}): data-theme sejak frame pertama, tanpa penanda landing`,
        ready && first !== undefined && first.theme === theme && !first.landing && frames.every((f) => f.theme === theme && !f.landing),
        first ? showFrame(first) : 'tidak ada frame',
      );
      t.check(
        `'#/sql' langsung (${theme}): tidak ada frame ${theme === 'light' ? 'gelap' : 'terang'} dari frame pertama sampai jalur siap`,
        frames.length > 5 && bad.length === 0,
        `${frames.length} frame${skipUnstyled ? `, ${unstyled} frame awal tanpa CSS (server dev) tidak dinilai` : ''}${bad[0] ? `; kilatan: ${showFrame(bad[0])}` : ''}`,
      );
      t.check(`'#/sql' langsung (${theme}): jalur siap dengan tema itu`, theme === 'light' ? looksLightTrack(await h.backdrop()) : looksDarkTrack(await h.backdrop()));
    }

    // Variasi alamat yang dirapikan router ('#//sql' dan '#///SQL/' = '#/sql'): skrip pra-gambar memakai aturan rute
    // parseRoute, jadi penanda landing TIDAK terpasang — dulu terpasang dan tidak ada yang melepasnya, sehingga palet
    // terang jalur tidak pernah aktif (jalur gelap di atas body putih landing, tombol tema tidak berpengaruh).
    await h.prefer('dark');
    for (const route of ['#//sql', '#///SQL/']) {
      await h.loadLoose({ [THEME_KEY]: 'light' }, route);
      const ready = await k.waitTrack();
      await t.sleep(300);
      const frames = await h.stopFrames();
      const state = await h.html();
      const hash = await t.evaluate<string>('location.hash');
      const slate950 = (await h.vars(['c-slate-950']))['c-slate-950'];
      const bad = flashes(frames, 'light', { skipUnstyled: false });
      t.check(
        `'${route}' langsung (terang, sistem gelap): dirapikan ke '#/sql', tanpa penanda landing sejak frame pertama, palet terang jalur aktif tanpa kilatan gelap`,
        ready && hash === '#/sql' && state.theme === 'light' && !state.landing && frames.length > 0 && frames.every((f) => !f.landing) && slate950 === '255 255 255' && looksLightTrack(await h.backdrop()) && bad.length === 0,
        `hash ${hash} ${JSON.stringify(state)} --c-slate-950 ${slate950}${frames[0] ? `; frame pertama ${showFrame(frames[0])}` : ''}${bad[0] ? `; kilatan ${showFrame(bad[0])}` : ''}`,
      );
    }
    // Tombol tema tetap bekerja di jalur yang dibuka lewat alamat itu.
    await k.mouseClick(TOGGLE);
    const toDark = await k.waitFor(`document.documentElement.getAttribute('data-theme') === 'dark'`, 3000);
    await t.sleep(200);
    t.check(`'#///SQL/' → tombol tema: jalur benar-benar gelap (palet ikut)`, toDark && looksDarkTrack(await h.backdrop()) && (await h.vars(['c-slate-950']))['c-slate-950'] === '2 6 23');
  } finally {
    if (added.identifier !== undefined) await k.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: added.identifier });
    await h.prefer(null);
  }
}

/* ------------------------------------------------------------------ */
/* (c) Beranda ↔ jalur ↔ landing: tema tetap, landing tidak ikut palet  */
/* ------------------------------------------------------------------ */

const PALETTE_NAMES = Object.keys(PALETTE.dark);
const Q_NAMES = Object.keys(Q_TOKENS.light);

async function navigation(t: SuiteContext, k: Kit, h: Helpers): Promise<void> {
  for (const theme of THEMES) {
    await k.freshRaw({ [THEME_KEY]: theme, [INTRO_KEY]: 'true' }, '#/');
    await k.waitHome();
    const label = theme === 'light' ? 'terang' : 'gelap';

    // Beranda: token q sesuai tokens.css; palet jalur TIDAK aktif (nilai asli).
    const homeVars = await h.vars([...PALETTE_NAMES, ...Q_NAMES]);
    const homeBad = [...varDiff(homeVars, Q_TOKENS[theme]), ...varDiff(homeVars, PALETTE.dark)];
    t.check(`Beranda ${label}: token --q-* = tokens.css, palet jalur --c-* tetap nilai asli`, homeBad.length === 0, homeBad.join('; '));

    // Beranda → jalur (layar muat jalur ikut): tanpa kedipan.
    await h.recordFrames();
    await k.click('home-primary');
    await k.waitTrack();
    await t.sleep(300);
    const toTrack = await h.stopFrames();
    const trackVars = await h.vars(PALETTE_NAMES);
    const trackBad = varDiff(trackVars, PALETTE[theme]);
    t.check(`Beranda → jalur (${label}): tema tetap, palet jalur ${label} aktif`, (await h.html()).theme === theme && trackBad.length === 0, trackBad.join('; '));
    const flash1 = flashes(toTrack, theme, { skipUnstyled: false });
    t.check(`Beranda → jalur (${label}): tidak ada frame berlawanan tema`, toTrack.length > 3 && flash1.length === 0, `${toTrack.length} frame${flash1[0] ? `; ${showFrame(flash1[0])}` : ''}`);

    // Jalur → Beranda.
    await h.recordFrames();
    await k.headerHome();
    await t.sleep(300);
    const toHome = await h.stopFrames();
    const back = await h.vars([...PALETTE_NAMES, ...Q_NAMES]);
    const backBad = [...varDiff(back, Q_TOKENS[theme]), ...varDiff(back, PALETTE.dark)];
    const flash2 = flashes(toHome, theme, { skipUnstyled: false });
    t.check(`jalur → Beranda (${label}): tema tetap, palet jalur dilepas, tanpa frame berlawanan`, (await h.html()).landing && backBad.length === 0 && flash2.length === 0, [...backBad, flash2[0] ? showFrame(flash2[0]) : ''].join('; '));

    // Katalog & landing jalur SQL: kelas palet di halaman landing tetap warna asli (mis. kartu kode bg-slate-900/70).
    await t.evaluate(`location.hash = '#/landing'; true`);
    const catalog = await k.waitFor(`!!${LANDING_PAGE('catalog')}`, 15_000);
    await t.evaluate(`location.hash = '#/landing/sql'; true`);
    const course = await k.waitFor(`!!${LANDING_PAGE('course')}`, 15_000);
    await t.sleep(300);
    const landingVars = await h.vars([...PALETTE_NAMES, ...Q_NAMES]);
    const landingBad = [...varDiff(landingVars, Q_TOKENS[theme]), ...varDiff(landingVars, PALETTE.dark)];
    const swatch = await t.evaluate<string | null>(`(() => { const el = [...document.querySelectorAll('[class~="bg-slate-900/70"]')][0]; return el ? getComputedStyle(el).backgroundColor : null; })()`);
    t.check(
      `katalog & landing SQL (${label}): tema tetap, token q = tokens.css, kelas palet tetap warna asli`,
      catalog && course && (await h.html()).theme === theme && landingBad.length === 0 && swatch === css('slate-900', 0.7),
      `${landingBad.join('; ')} bg-slate-900/70 = ${swatch ?? '(tidak ada)'}`,
    );

    // Landing → jalur (tombol utama landing) → Back.
    await h.recordFrames();
    await t.evaluate(`${tid('course-primary')}.click(); true`);
    await k.waitTrack();
    await t.sleep(300);
    const toTrack2 = await h.stopFrames();
    const flash3 = flashes(toTrack2, theme, { skipUnstyled: false });
    t.check(`landing → jalur (${label}): tema tetap, tanpa frame berlawanan`, (await h.html()).theme === theme && !(await h.html()).landing && flash3.length === 0, flash3[0] ? showFrame(flash3[0]) : '');
    await t.evaluate(`history.back(); true`);
    const backLanding = await k.waitFor(`!!${LANDING_PAGE('course')}`, 15_000);
    const afterBack = await h.vars(PALETTE_NAMES);
    t.check(`Back ke landing (${label}): tema tetap, palet jalur dilepas lagi`, backLanding && (await h.html()).theme === theme && varDiff(afterBack, PALETTE.dark).length === 0);
  }
}

/* ------------------------------------------------------------------ */
/* (e) Tema gelap identik + penyorot SQL; (f) portal                   */
/* ------------------------------------------------------------------ */

const TOKEN_SQL = "-- komentar\nSELECT nama, COUNT(*) AS jumlah, UPPER(kota) FROM pasien WHERE umur > 40 AND kota = 'Bogor' GROUP BY nama";

/** Warna terhitung elemen kunci layar misi (editor tidak sedang difokus). */
const KEY_ELEMENTS = `(() => {
  document.activeElement?.blur?.();
  const pick = (el, props) => (el ? Object.fromEntries(props.map((p) => [p, getComputedStyle(el)[p]])) : null);
  const code = __t.all('textarea')[0]?.closest('.relative')?.querySelector('code');
  const span = (cls) => code ? [...code.querySelectorAll('span')].find((s) => s.className.split(' ').includes(cls)) : null;
  return {
    body: pick(document.body, ['backgroundColor', 'color']),
    header: pick(document.querySelector('header'), ['backgroundColor', 'borderBottomColor']),
    panelSwitch: pick(document.querySelector('[aria-label="Panel kiri"]'), ['backgroundColor', 'borderTopColor']),
    title: pick([...document.querySelectorAll('h2')].find((h) => h.className.includes('text-slate-50') && __t.visible(h)), ['color']),
    scenario: pick([...document.querySelectorAll('section')].find((s) => s.querySelector('h3')?.innerText.trim().toLowerCase() === 'skenario' && __t.visible(s)), ['borderTopColor', 'backgroundImage']),
    editor: pick(__t.all('textarea')[0]?.closest('.bg-slate-950'), ['backgroundColor', 'borderTopColor']),
    run: pick(__t.all('button').find((b) => b.innerText.trim().startsWith('Run & Check')), ['backgroundColor', 'color']),
    keyword: pick(span('text-emerald-400'), ['color']),
    fn: pick(span('text-teal-300'), ['color']),
    str: pick(span('text-amber-300'), ['color']),
    num: pick(span('text-sky-300'), ['color']),
    comment: pick(span('text-slate-500'), ['color']),
    table: pick(span('text-fuchsia-300'), ['color']),
  };
})()`;

type KeyElements = Record<string, Record<string, string> | null>;

const DARK_EXPECTED: Record<string, Record<string, string>> = {
  body: { backgroundColor: css('slate-950'), color: css('slate-200') },
  header: { backgroundColor: css('slate-900', 0.8), borderBottomColor: css('slate-800') },
  panelSwitch: { backgroundColor: css('slate-900', 0.6), borderTopColor: css('slate-800') },
  title: { color: css('slate-50') },
  scenario: { borderTopColor: css('teal-500', 0.2), backgroundImage: `linear-gradient(to right bottom, ${css('teal-500', 0.1)}, ${css('slate-900', 0.4)})` },
  editor: { backgroundColor: css('slate-950'), borderTopColor: css('slate-800') },
  run: { backgroundColor: css('emerald-500'), color: css('slate-950') },
  keyword: { color: css('emerald-400') },
  fn: { color: css('teal-300') },
  str: { color: css('amber-300') },
  num: { color: css('sky-300') },
  comment: { color: css('slate-500') },
  table: { color: css('fuchsia-300') },
};

/** Kontras setiap jenis token SQL terhadap latar editor (warna akhir, latar editor padat). */
const TOKEN_CONTRAST = `(() => {
  ${PAGE_COLOR}
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const editor = __t.all('textarea')[0]?.closest('.bg-slate-950');
  const code = __t.all('textarea')[0]?.closest('.relative')?.querySelector('code');
  if (!editor || !code) return null;
  const bg = parse(getComputedStyle(editor).backgroundColor);
  const kinds = { kata_kunci: 'text-emerald-400', fungsi: 'text-teal-300', string: 'text-amber-300', angka: 'text-sky-300', komentar: 'text-slate-500', tabel: 'text-fuchsia-300', identifier: 'text-slate-200', operator: 'text-slate-400' };
  return Object.fromEntries(Object.entries(kinds).map(([k, cls]) => { const s = [...code.querySelectorAll('span')].find((x) => x.className.split(' ').includes(cls)); return [k, s ? Math.round(ratio(parse(getComputedStyle(s).color), bg) * 100) / 100 : null]; }));
})()`;

async function identityAndPortals(t: SuiteContext, k: Kit, h: Helpers): Promise<void> {
  await k.freshRaw({ [THEME_KEY]: 'dark' }, '#/sql');
  await k.waitTrack();
  await t.evaluate(FREEZE);
  await t.evaluate(`__t.waitHas('Hari Pertama di Unit IT', 15000)`);
  await t.evaluate(`__t.setSql(${JSON.stringify(TOKEN_SQL)}); true`);
  await t.sleep(200);

  // (e) Variabel palet tema gelap = tailwindcss/colors persis; tema terang = blok terang src/theme.css.
  const darkVars = await h.vars(PALETTE_NAMES);
  const original = Object.fromEntries(PALETTE_NAMES.map((n) => [n, TAILWIND.get(n.slice(2)) ?? '?']));
  const darkDiff = varDiff(darkVars, original);
  t.check(`tema gelap: ${PALETTE_NAMES.length} variabel --c-* = tailwindcss/colors persis`, PALETTE_NAMES.length >= 121 && darkDiff.length === 0, darkDiff.join('; '));
  const dark = await t.evaluate<KeyElements>(KEY_ELEMENTS);
  const mismatches = Object.entries(DARK_EXPECTED).flatMap(([name, props]) =>
    Object.entries(props)
      .filter(([prop, value]) => dark[name]?.[prop] !== value)
      .map(([prop, value]) => `${name}.${prop}: ${dark[name]?.[prop] ?? '(tidak ada)'} ≠ ${value}`),
  );
  t.check('tema gelap identik: latar body, header, panel, kartu skenario, editor, tombol Run & Check, judul, token SQL = nilai Tailwind asli', mismatches.length === 0, mismatches.slice(0, 4).join('; '));
  t.check(`tema gelap: latar body ${TRACK_DARK_BODY}`, dark.body?.backgroundColor === TRACK_DARK_BODY);
  const darkTokens = await t.evaluate<Record<string, number | null> | null>(TOKEN_CONTRAST);

  await h.setThemeLive('light');
  const lightVars = await h.vars(PALETTE_NAMES);
  const lightDiff = varDiff(lightVars, PALETTE.light);
  t.check('tema terang: variabel --c-* = blok terang src/theme.css', lightDiff.length === 0, lightDiff.join('; '));
  const light = await t.evaluate<KeyElements>(KEY_ELEMENTS);
  const changed = Object.keys(DARK_EXPECTED).filter((name) => JSON.stringify(light[name]) !== JSON.stringify(dark[name]));
  t.check('tema terang: elemen kunci berganti warna (body putih, header, editor, tombol, token)', light.body?.backgroundColor === 'rgb(255, 255, 255)' && changed.length === Object.keys(DARK_EXPECTED).length, `berubah: ${changed.join(', ')}`);
  const lightTokens = await t.evaluate<Record<string, number | null> | null>(TOKEN_CONTRAST);
  const weak = Object.entries(lightTokens ?? {}).filter(([, r]) => r === null || r < 4.5);
  t.check(
    'penyorot SQL tema terang: kata kunci, fungsi, string, angka, komentar, tabel, identifier, operator ≥ 4.5:1 terhadap latar editor',
    lightTokens !== null && weak.length === 0,
    `terang ${JSON.stringify(lightTokens)}; gelap (tidak diubah) ${JSON.stringify(darkTokens)}`,
  );

  // (f) Popup autocomplete = portal di <body>: ikut tema, juga saat tema diganti selagi terbuka.
  await t.evaluate(`__t.setSql('SELECT nama_dokter FROM '); (() => { const ta = __t.all('textarea')[0]; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); return true; })()`);
  await k.typeLetters('do');
  const open = await k.waitFor(`!!document.querySelector('[aria-label="Saran autocomplete"]')`, 4000);
  const popup = (selector: string) =>
    t.evaluate<{ inBody: boolean; bg: string; border: string; text: string } | null>(
      `(() => { const list = document.querySelector('[aria-label="Saran autocomplete"]'); const el = list?.closest('.fixed'); if (!el) return null; const opt = list.querySelector('[role="option"]') ?? list; return { inBody: el.parentElement === document.body, bg: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderTopColor, text: getComputedStyle(opt.querySelector(${JSON.stringify(selector)}) ?? opt).color }; })()`,
    );
  const popLight = await popup('span');
  await h.setThemeLive('dark');
  const popDark = await popup('span');
  const stillOpen = await t.evaluate<boolean>(`!!document.querySelector('[aria-label="Saran autocomplete"]')`);
  t.check(
    'popup autocomplete (portal di <body>) ikut tema: putih di terang, slate-900/95 asli di gelap, tetap terbuka saat tema diganti',
    open && popLight?.inBody === true && popLight.bg === 'rgb(255, 255, 255)' && popDark?.bg === css('slate-900', 0.95) && popDark.border === css('slate-700') && stillOpen,
    `terang ${JSON.stringify(popLight)} gelap ${JSON.stringify(popDark)}`,
  );
  await k.press('Escape');

  // Notifikasi lencana (lapisan fixed) ikut tema.
  await h.setThemeLive('light');
  await t.evaluate(`__t.setSql('select nama_dokter, spesialisasi from dokter'); true`);
  await t.sleep(150);
  await t.evaluate(`__t.click('Run & Check')`);
  const toastUp = await t.evaluate<boolean>(`__t.waitHas('Lencana baru!', 8000)`);
  const toast = () => t.evaluate<string | null>(`(() => { const el = [...document.querySelectorAll('[role="status"][aria-live="polite"] > div')].find((d) => d.textContent.includes('Lencana baru!')); return el ? getComputedStyle(el).backgroundColor : null; })()`);
  const toastLight = await toast();
  // Kartu "Jawaban benar!" (role=status, bergradien): di tema terang titik awal gradiennya mint yang jelas — dulu tint
  // hijau tua /15 di atas putih menjadi abu-sage nyaris putih, lebih pudar daripada kartu "Belum tepat".
  const successStart = await t.evaluate<{ rgb: number[]; text: string } | null>(SUCCESS_CARD_START);
  await h.setThemeLive('dark');
  const toastDark = await toast();
  const successDark = await t.evaluate<string | null>(`(() => { const el = [...document.querySelectorAll('[role="status"]')].find((d) => d.textContent.includes('Jawaban benar!') && getComputedStyle(d).backgroundImage.includes('gradient')); return el ? getComputedStyle(el).backgroundImage : null; })()`);
  t.check('notifikasi "Lencana baru!" ikut tema: putih di terang, slate-900/95 asli di gelap', toastUp && toastLight === 'rgb(255, 255, 255)' && toastDark === css('slate-900', 0.95), `terang ${toastLight} gelap ${toastDark}`);
  const [r = 0, g = 0, b = 0] = successStart?.rgb ?? [];
  t.check(
    'kartu "Jawaban benar!" tema terang: awal gradien mint yang jelas (hijau ≥ 30 di atas merah, tidak nyaris putih); tema gelap tetap emerald-500/15 → teal-500/5 → slate-900/40 asli',
    successStart !== null && g - r >= 30 && g - b >= 10 && r < 225 &&
      successDark === `linear-gradient(to right bottom, ${css('emerald-500', 0.15)}, ${css('teal-500', 0.05)}, ${css('slate-900', 0.4)})`,
    `terang ${JSON.stringify(successStart)} gelap ${successDark}`,
  );
}

/** Warna titik awal gradien kartu sukses, dikomposit di atas latar padat di belakangnya. */
const SUCCESS_CARD_START = String.raw`(() => {
  ${PAGE_COLOR}
  const el = [...document.querySelectorAll('[role="status"]')].find((d) => d.textContent.includes('Jawaban benar!') && getComputedStyle(d).backgroundImage.includes('gradient'));
  if (!el) return null;
  const image = getComputedStyle(el).backgroundImage;
  const first = parse((image.match(/rgba?\([^)]*\)/) || [''])[0]);
  let under = [255, 255, 255];
  for (let e = el.parentElement; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0.9) { under = c; break; } }
  return { rgb: [0, 1, 2].map((i) => Math.round(first[i] * first[3] + under[i] * (1 - first[3]))), text: image.slice(0, 120) };
})()`;

/* ------------------------------------------------------------------ */
/* (d) Pemindai kontras di setiap layar/keadaan                         */
/* ------------------------------------------------------------------ */

const ids = (pred: (m: (typeof MISSIONS)[number]) => boolean) => MISSIONS.filter(pred).map((m) => m.id);
const before = (id: string) => MISSIONS.slice(0, MISSIONS.findIndex((m) => m.id === id)).map((m) => m.id);
const solutionOf = (id: string) => {
  const m = MISSIONS.find((x) => x.id === id);
  return m?.kind === 'sql' ? m.solutionSql : '';
};
const payloadOf = (id: string) => {
  const m = MISSIONS.find((x) => x.id === id);
  return m?.kind === 'injection' ? m.solutionPayload : '';
};
const TIER1 = ids((m) => m.tier === 1);
const TIER12 = ids((m) => m.tier <= 2);
const FIXTURE = JSON.parse(readRepo('scripts/fixtures/storage-v1.json')) as Record<string, unknown>;
const FIXTURE_NO_EXAM = Object.fromEntries(Object.entries(FIXTURE).filter(([key]) => key !== EXAM_SESSION_KEY));
const progress = (done: string[], last: string) => ({ [PROGRESS_KEY]: progressWith(done, last) });

const DDL_WRONG = `CREATE TABLE jadwal_praktik (
  id_jadwal INTEGER PRIMARY KEY,
  id_dokter TEXT NOT NULL REFERENCES dokter (id_dokter),
  hari TEXT NOT NULL CHECK (hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu')),
  jam_mulai TEXT NOT NULL,
  jam_selesai TEXT NOT NULL,
  kuota INTEGER NOT NULL DEFAULT 20 CHECK (kuota > 0),
  CHECK (jam_selesai > jam_mulai)
);
INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai, kuota) VALUES ('D001', 'Senin', '08:00', '12:00', 25);
INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai) VALUES ('D007', 'Rabu', '13:00', '16:00');`;
const JSON_WRONG = `SELECT l.no_rawat, p.nama,
  l.payload ->> '$.component[0].valueQuantity.value' AS sistolik,
  l.payload ->> '$.component[1].valueQuantity.value' AS diastolik,
  'Normal' AS kategori
FROM satusehat_log l JOIN kunjungan k ON k.no_rawat = l.no_rawat JOIN pasien p ON p.no_rm = k.no_rm
WHERE l.payload ->> '$.code.coding[0].code' = '85354-9' AND l.status_kirim <> 'Gagal'
ORDER BY l.no_rawat;`;
/**
 * Query tanpa henti untuk memindai keadaan "penilaian sedang berjalan": ORDER BY memaksa seluruh rekursi dihitung dulu,
 * jadi batas 100.000 baris tidak menghentikannya — hanya batas waktu 8 detik atau tombol Hentikan.
 */
const RUNAWAY = 'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n) SELECT x FROM n ORDER BY x DESC LIMIT 5';
/** Math.random berbenih: soal ujian acak tetapi sama di setiap run (temuan kontras stabil). */
const SEED_RANDOM = `(() => { let x = 42; Math.random = () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; return true; })()`;

interface Driver {
  width: number;
  load: (storage?: Record<string, unknown>, route?: string, ready?: boolean) => Promise<void>;
  wait: (text: string, ms?: number) => Promise<void>;
  ev: <T = unknown>(expression: string) => Promise<T>;
  click: (label: string) => Promise<unknown>;
  clickMatch: (re: RegExp) => Promise<unknown>;
  mode: (label: string) => Promise<unknown>;
  tab: (label: string) => Promise<unknown>;
  setSql: (sql: string) => Promise<unknown>;
  run: (sql: string, button?: string) => Promise<void>;
  scan: (name: string) => Promise<void>;
}

interface ScanFlow {
  name: string;
  run: (d: Driver, t: SuiteContext, k: Kit) => Promise<void>;
}

const FLOWS: ScanFlow[] = [
  {
    name: 'misi',
    run: async (d, _t, k) => {
      await d.load();
      await d.wait('Hari Pertama di Unit IT');
      await d.scan('misi-awal');
      for (let i = 0; i < 3; i += 1) {
        if (await d.ev<boolean>(`__t.has('Hint berikutnya') || __t.has('Hint 1')`)) break;
        await d.clickMatch(/^(Lihat hint|Hint \(-20% XP\)|Hint berikutnya)/).catch(() => undefined);
        await d.ev(`__t.tick(300)`);
      }
      await d.scan('misi-hint');
      // Penilaian yang sedang berjalan (query tanpa henti di worker): tombol Run & Check nonaktif — termasuk label
      // pintasannya — dan indikator "Hentikan". Dipindai sebelum batas waktu 8 detik, lalu dihentikan.
      await d.setSql(RUNAWAY);
      await d.ev(`__t.tick(150)`);
      await d.click('Run & Check');
      if (!(await k.waitFor(`!!__t.button('Hentikan') && !!__t.button('Run & Check')?.disabled`, 6000))) throw new Error('indikator penilaian berjalan (tombol Hentikan) tidak muncul');
      await d.ev(`__t.tick(150)`);
      await d.scan('misi-berjalan');
      if (!(await d.ev<boolean>(`!!__t.button('Hentikan')`))) throw new Error('penilaian sudah berhenti sebelum pemindaian selesai (batas waktu worker)');
      await d.click('Hentikan');
      await d.ev(`__t.tick(300)`);
    },
  },
  {
    name: 'salah',
    run: async (d) => {
      await d.load(progress(['t1-select'], 't1-where'));
      await d.wait('Pasien BPJS Jabodetabek');
      await d.run("SELECT nama, kota, penjamin FROM pasien WHERE penjamin = 'BPJS' ORDER BY nama");
      await d.wait('Perbedaan');
      await d.ev(`__t.tick(400)`);
      await d.clickMatch(/^Perbedaan/);
      await d.scan('misi-salah-perbedaan');
      await d.clickMatch(/^Hasil Kamu/);
      await d.scan('misi-salah-hasil');
      await d.clickMatch(/^Seharusnya/);
      await d.scan('misi-salah-seharusnya');
      await d.clickMatch(/^Berdampingan/).catch(() => undefined);
      await d.scan('misi-salah-berdampingan');
    },
  },
  {
    name: 'benar',
    run: async (d) => {
      await d.load();
      await d.wait('Hari Pertama di Unit IT');
      await d.run('select nama_dokter, spesialisasi from dokter');
      await d.wait('Jawaban benar!');
      await d.ev(`__t.waitHas('Lencana baru!', 5000)`);
      await d.scan('misi-benar-lencana');
    },
  },
  {
    name: 'error',
    run: async (d) => {
      await d.load();
      await d.wait('Hari Pertama di Unit IT');
      await d.run('SELEC nama_dokter FROM dokterr');
      await d.wait('Query gagal dijalankan');
      await d.scan('misi-error-sql');
    },
  },
  {
    name: 'urutan',
    run: async (d) => {
      await d.load(progress(['t1-select'], 't1-where'));
      await d.wait('Pasien BPJS Jabodetabek');
      await d.run("SELECT kota, COUNT(*) AS jumlah FROM pasien WHERE penjamin = 'BPJS' GROUP BY kota ORDER BY jumlah DESC LIMIT 3", 'Urutan Eksekusi');
      await d.wait('Ditulis dari atas');
      await d.ev(`__t.tick(500)`);
      await d.scan('urutan-eksekusi');
    },
  },
  {
    name: 'schema',
    run: async (d) => {
      await d.load();
      await d.wait('Hari Pertama di Unit IT');
      await d.tab('Schema');
      await d.ev(`__t.tick(300)`);
      await d.ev(`(() => { const b = __t.all('button[aria-expanded="false"]').find(x => /pasien/.test(x.innerText)); b?.click(); return true; })()`);
      await d.ev(`__t.tick(300)`);
      await d.scan('schema-explorer');
    },
  },
  {
    name: 'autocomplete',
    run: async (d, _t, k) => {
      await d.load();
      await d.wait('Hari Pertama di Unit IT');
      await d.setSql('SELECT nama_dokter FROM ');
      await d.ev(`(() => { const ta = __t.all('textarea')[0]; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); return true; })()`);
      await k.typeLetters('do');
      if (!(await k.waitFor(`!!document.querySelector('[aria-label="Saran autocomplete"]')`, 4000))) throw new Error('popup autocomplete tidak muncul');
      await d.scan('autocomplete');
    },
  },
  {
    name: 'fix',
    run: async (d) => {
      await d.load(progress(before('t1-fix-tagihan'), 't1-fix-tagihan'));
      await d.wait('Laporan Tunggakan yang Kosong');
      await d.scan('misi-perbaiki-query');
    },
  },
  {
    name: 'tebak',
    run: async (d) => {
      await d.load(progress(before('t1-predict-distinct'), 't1-predict-distinct'));
      await d.wait('Tebak: DISTINCT Dua Kolom');
      await d.scan('tebak-hasil');
      await d.ev(`document.querySelector('[data-choice="d0"]')?.click(); true`);
      await d.ev(`__t.tick(200)`);
      await d.clickMatch(/^Periksa Jawaban/);
      await d.ev(`__t.tick(600)`);
      await d.scan('tebak-salah');
    },
  },
  {
    name: 'injection',
    run: async (d) => {
      await d.load(progress(before('t7-injection-bypass'), 't7-injection-bypass'));
      await d.wait('Portal Cek Pasien yang Bocor');
      await d.scan('lab-injection');
      await d.ev(`(() => { const input = __t.all('input[type="text"]')[0]; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, ${JSON.stringify(payloadOf('t7-injection-bypass'))}); input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      await d.ev(`__t.tick(200)`);
      await d.click('Kirim');
      await d.wait('Serangan berhasil', 10_000);
      await d.scan('lab-injection-berhasil');
    },
  },
  {
    name: 'konsep',
    run: async (d) => {
      await d.load(progress(before('t7-prepared-statement'), 't7-prepared-statement'));
      await d.wait('Prepared Statement');
      await d.scan('kartu-konsep');
    },
  },
  {
    name: 'boss',
    run: async (d) => {
      await d.load(progress(TIER1.filter((id) => !id.startsWith('boss')), 'boss-t1-skrining'));
      await d.ev(`__t.waitText('Misi 7', 20000)`);
      await d.ev(`__t.node('Boss: Undangan Skrining').click(); true`);
      await d.wait('Boss Tier 1: tanpa hint');
      await d.scan('boss');
    },
  },
  {
    name: 'ddl',
    run: async (d) => {
      await d.load(progress([...ids((m) => m.tier < 9), 't9-normalisasi'], 't9-create-table'));
      await d.wait('Jadwal Praktik Dokter');
      await d.scan('misi-ddl');
      await d.run(DDL_WRONG);
      await d.wait('Desain tabel belum sesuai');
      await d.ev(`__t.tick(300)`);
      await d.scan('misi-ddl-salah');
    },
  },
  {
    name: 'json',
    run: async (d) => {
      await d.load(progress(before('t10-json-each'), 't10-json-each'));
      await d.wait('Tekanan Darah dari Array Component');
      await d.scan('misi-json');
      await d.run(JSON_WRONG);
      await d.wait('Ada nilai yang berbeda');
      await d.ev(`__t.tick(300)`);
      await d.scan('misi-json-salah');
    },
  },
  {
    name: 'peta',
    run: async (d) => {
      await d.load(FIXTURE_NO_EXAM);
      await d.wait('Peta Misi');
      await d.scan('daftar-misi');
    },
  },
  {
    name: 'materi',
    run: async (d) => {
      await d.load();
      await d.mode('Materi');
      await d.wait('Materi SQL');
      await d.scan('materi-daftar');
      await d.ev(`(() => { const b = __t.all('button').find(x => x.innerText.trim().startsWith('WHERE: Menyaring Baris')); if (!b) throw new Error('artikel WHERE tidak ada'); b.click(); return true; })()`);
      await d.wait('Tagihan antara 400 ribu');
      await d.ev(`__t.tick(300)`);
      // Termasuk "Beda dialek" dan blok kode bersorot (seluruh artikel dirender; pemindai membaca seluruh dokumen).
      await d.scan('materi-artikel');
    },
  },
  {
    name: 'playground',
    run: async (d) => {
      await d.load();
      await d.mode('Free Playground');
      await d.wait('Free Playground');
      await d.run('SELECT p.nama, p.kota, k.tgl_kunjungan FROM pasien p JOIN kunjungan k ON k.no_rm = p.no_rm ORDER BY k.tgl_kunjungan DESC LIMIT 8', 'Run');
      await d.wait('Query berhasil');
      await d.scan('playground-hasil');
      await d.run("INSERT INTO poliklinik VALUES ('P99', 'Poli Uji', 'Gedung Z')", 'Run');
      await d.wait('1 baris diubah');
      await d.scan('playground-pesan');
      await d.run("SELECT d.nama_dokter, COUNT(*) FROM kunjungan k JOIN dokter d ON d.id_dokter = k.id_dokter WHERE k.id_poli = (SELECT id_poli FROM poliklinik WHERE nama_poli LIKE '%Umum%') GROUP BY d.nama_dokter", 'Explain');
      await d.ev(`__t.waitHas('SCAN', 10000)`);
      await d.ev(`__t.tick(400)`);
      await d.scan('explain');
    },
  },
  {
    name: 'perflab',
    run: async (d) => {
      await d.load();
      await d.mode('Free Playground');
      await d.ev(`[...document.querySelectorAll('[aria-label="Target database"] button')].find(b => b.innerText.includes('Data besar')).click(); true`);
      await d.wait('Lab Performa — data besar');
      const waitTime = `(async () => { const t0 = Date.now(); while (Date.now() - t0 < 90000) { const el = document.querySelector('[data-testid="lab-time"]'); if (el && !document.querySelector('[role="status"] .animate-spin')) return el.innerText; await new Promise(r => setTimeout(r, 100)); } return null; })()`;
      await d.click('Jalankan & ukur');
      await d.ev(`__t.tick(500)`);
      await d.ev(waitTime);
      await d.ev(`[...document.querySelectorAll('[aria-label="Percobaan siap pakai"] button')].find(b => b.innerText.startsWith('1b.')).click(); true`);
      await d.ev(`__t.tick(200)`);
      await d.click('Jalankan & ukur');
      await d.ev(`__t.tick(500)`);
      if ((await d.ev<string | null>(waitTime)) === null) throw new Error('Lab Performa tidak selesai');
      await d.scan('lab-performa');
    },
  },
  {
    name: 'progres',
    run: async (d) => {
      await d.load(FIXTURE_NO_EXAM);
      await d.mode('Progres');
      await d.wait('Peta Kelemahan');
      await d.scan('progres');
      await d.ev(`(() => { const b = __t.all('button[aria-expanded="false"]').find(x => x.closest('li')); b?.click(); return true; })()`);
      await d.ev(`__t.tick(300)`);
      await d.scan('progres-kelemahan-dibuka');
    },
  },
  {
    name: 'ujian',
    run: async (d) => {
      await d.load(progress(TIER12, 't3-bpjs-per-poli'));
      await d.mode('Ujian');
      await d.wait('Tier yang diujikan');
      await d.scan('ujian-pilih');
      await d.ev(`(() => { for (const box of document.querySelectorAll('input[type=checkbox]')) { const tier1 = box.closest('label')?.innerText.includes('Tier 1:'); if (box.checked !== tier1 && !box.disabled) box.click(); } return true; })()`);
      await d.ev(`[...document.querySelectorAll('[aria-label="Jumlah soal"] [role=radio]')].find(b => b.innerText.trim() === '5 soal').click(); true`);
      await d.ev(SEED_RANDOM);
      await d.click('Mulai ujian');
      await d.wait('Soal 1/5');
      const session = await d.ev<{ missionIds: string[] }>(`JSON.parse(localStorage.getItem(${JSON.stringify(EXAM_SESSION_KEY)}))`);
      for (const [i, id] of session.missionIds.entries()) {
        if (i > 2) break;
        await d.ev(`[...document.querySelectorAll('nav[aria-label="Daftar soal"] button')][${i}].click(); true`);
        await d.ev(`__t.waitText('Soal ${i + 1}/5', 3000)`);
        const sql = solutionOf(id);
        if (sql === '') await d.ev(`(document.querySelector(${JSON.stringify(i === 0 ? '[data-choice="answer"]' : '[data-choice="d0"]')}))?.click(); true`);
        else await d.setSql(i === 0 ? sql : 'SELECT 1 AS salah');
        await d.ev(`__t.tick(150)`);
      }
      await d.ev(`[...document.querySelectorAll('nav[aria-label="Daftar soal"] button')][0].click(); true`);
      await d.ev(`__t.tick(300)`);
      await d.scan('ujian-berjalan');
      await d.click('Kumpulkan jawaban');
      await d.ev(`__t.waitHas('Tinjauan soal', 20000)`);
      await d.ev(`__t.tick(300)`);
      await d.scan('ujian-rapor');
    },
  },
  {
    name: 'latihan',
    run: async (d) => {
      const recent = new Date(Date.now() - 86_400_000).toISOString();
      await d.load({
        [PROGRESS_KEY]: { ...progressWith(TIER1, 't2-inner-join'), streak: { current: 4, best: 4, lastActiveDate: '2000-01-01' } },
        [MISTAKES_KEY]: { events: [{ missionId: 't1-where', kind: 'rows-missing', at: recent }, { missionId: 't1-where', kind: 'rows-missing', at: recent }], solved: {} },
      });
      await d.mode('Ujian');
      await d.wait('Latihan ulang hari ini');
      await d.scan('latihan-ulang-mulai');
      await d.ev(`[...document.querySelectorAll('button')].find(b => b.innerText.startsWith('Mulai latihan ulang')).click(); true`);
      await d.wait('Soal 1/5');
      await d.ev(`__t.tick(300)`);
      await d.scan('latihan-ulang-berjalan');
    },
  },
  {
    name: 'muat',
    run: async (d, t, k) => {
      // Modul jalur ditahan → layar muat milik shell.
      await k.send('Fetch.enable', { patterns: [{ urlPattern: '*SqlTrack*', requestStage: 'Request' }] });
      const pausedTrack = t.browser.waitForEvent('Fetch.requestPaused', 20_000);
      try {
        await d.load({}, '#/sql', false);
        const req = await pausedTrack;
        await d.wait('Memuat');
        await d.scan('layar-muat');
        if (typeof req?.requestId === 'string') await k.send('Fetch.continueRequest', { requestId: req.requestId });
      } finally {
        await k.send('Fetch.disable');
      }
      // Mesin SQL ditahan → "Menyiapkan database".
      await t.browser.navigate('about:blank');
      await t.browser.navigate(t.url);
      await k.send('Fetch.enable', { patterns: [{ urlPattern: WASM_BINARY, requestStage: 'Request' }] });
      const pausedWasm = t.browser.waitForEvent('Fetch.requestPaused', 20_000);
      try {
        await d.load({}, '#/sql', false);
        const req = await pausedWasm;
        await d.wait('Menyiapkan database');
        await d.scan('layar-muat-db');
        if (typeof req?.requestId === 'string') await k.send('Fetch.continueRequest', { requestId: req.requestId });
      } finally {
        await k.send('Fetch.disable');
      }
      // Modul jalur gagal diunduh → layar gagal (pesan console dari kegagalan itu sendiri memang diharapkan).
      await t.browser.navigate('about:blank');
      await t.browser.navigate(t.url);
      await k.expectingConsole(/dynamically imported module|SqlTrack|error occurred in|error boundary|Failed to fetch|TrackBoundary/i, async () => {
        await k.send('Network.enable');
        await k.send('Network.setCacheDisabled', { cacheDisabled: true });
        await k.send('Fetch.enable', { patterns: [{ urlPattern: '*SqlTrack*', requestStage: 'Request' }] });
        let failing = true;
        const failLoop = (async () => {
          while (failing) {
            const r = await t.browser.waitForEvent('Fetch.requestPaused', 500);
            if (typeof r?.requestId === 'string') await k.send('Fetch.failRequest', { requestId: r.requestId, errorReason: 'Failed' }).catch(() => undefined);
          }
        })();
        try {
          await d.load({}, '#/sql', false);
          const failed = await k.waitFor(`!!document.querySelector('[role="alert"]') && document.querySelector('[role="alert"]').innerText.includes('gagal dimuat')`, 15_000);
          if (!failed) throw new Error('layar gagal tidak muncul');
          await d.scan('layar-gagal');
        } finally {
          failing = false;
          await failLoop;
          await k.send('Fetch.disable');
          await k.send('Network.setCacheDisabled', { cacheDisabled: false });
          await k.send('Network.disable');
        }
      });
      await t.browser.navigate('about:blank');
      await t.browser.navigate(t.url);
    },
  },
  {
    // Keadaan tambahan layar Misi & editor.
    name: 'ekstra',
    run: async (d, _t, k) => {
      await d.load(progress(['t1-select'], 't1-where'));
      await d.wait('Pasien BPJS Jabodetabek');
      await d.click('Show Solution');
      await d.wait('Solusi Referensi');
      await d.scan('ekstra-solusi');
      await d.load(progress(before('t7-sargable'), 't7-sargable'));
      await d.wait('Index Ada, Tapi Tidak Terpakai');
      await d.click('Run & Check');
      await d.ev(`__t.waitHas('index belum dipakai', 15000)`);
      await d.ev(`__t.tick(300)`);
      await d.scan('ekstra-sargable');
      await d.load(progress(before('t2-having'), 't2-having'));
      await d.wait('Diagnosa yang Sering Muncul');
      await d.run("SELECT kode_icd10, COUNT(*) AS n FROM diagnosa WHERE kode_icd10 <> 'Z00' GROUP BY kode_icd10 HAVING COUNT(*) >= 2 ORDER BY n DESC", 'Urutan Eksekusi');
      await d.ev(`__t.waitHas('Ditulis dari atas', 15000)`);
      await d.ev(`__t.tick(400)`);
      await d.ev(`[...document.querySelectorAll('[role="tab"]')].find(b => b.innerText.includes('HAVING'))?.click(); true`);
      await d.ev(`__t.tick(300)`);
      await d.scan('ekstra-having');
      await d.ev(`[...document.querySelectorAll('[role="tab"]')].find(b => b.innerText.includes('WHERE'))?.click(); true`);
      await d.ev(`__t.tick(300)`);
      await d.ev(`[...document.querySelectorAll('button')].find(b => /baris yang dibuang WHERE/.test(b.innerText))?.click(); true`);
      await d.ev(`__t.tick(300)`);
      await d.scan('ekstra-dibuang');
      await d.load(progress(before('t7-prepared-statement'), 't7-prepared-statement'));
      await d.wait('Prepared Statement');
      await d.ev(`(() => { const groups = [...new Set([...document.querySelectorAll('input[type=radio]')].map(r => r.name))]; groups.slice(0, 2).forEach((g, i) => { const opts = [...document.querySelectorAll('input[type=radio][name="' + g + '"]')]; opts[i === 0 ? 0 : 1]?.click(); }); return groups.length; })()`);
      await d.ev(`__t.tick(200)`);
      await d.clickMatch(/^Periksa Jawaban/);
      await d.ev(`__t.tick(500)`);
      await d.scan('ekstra-kuis');
      await d.load(progress(before('t1-predict-distinct'), 't1-predict-distinct'));
      await d.wait('Tebak: DISTINCT Dua Kolom');
      await d.ev(`document.querySelector('[data-choice="answer"]')?.click(); true`);
      await d.ev(`__t.tick(200)`);
      await d.clickMatch(/^Periksa Jawaban/);
      await d.ev(`__t.waitHas('Tebakanmu tepat', 8000)`);
      await d.ev(`__t.tick(400)`);
      await d.scan('ekstra-tebak-benar');
      await d.load(progress(before('t7-injection-bypass'), 't7-injection-bypass'));
      await d.wait('Portal Cek Pasien yang Bocor');
      await d.ev(`[...document.querySelectorAll('button[aria-pressed]')].find(b => b.innerText.includes('Mode aman'))?.click(); true`);
      await d.ev(`__t.tick(200)`);
      await d.click('Isi contoh normal');
      await d.ev(`__t.tick(200)`);
      await d.click('Kirim');
      await d.ev(`__t.tick(1200)`);
      await d.ev(`(() => { const el = document.querySelector('details'); if (el) el.open = true; return true; })()`);
      await d.ev(`__t.tick(200)`);
      await d.scan('ekstra-injection-aman');
      await d.load();
      await d.wait('Hari Pertama di Unit IT');
      await d.setSql('SELECT  FROM dokter');
      await d.ev(`(() => { const ta = __t.all('textarea')[0]; ta.focus(); ta.setSelectionRange(7, 7); return true; })()`);
      await k.typeLetters('n');
      await k.waitFor(`!!document.querySelector('[aria-label="Saran autocomplete"]')`, 4000);
      await k.press('ArrowDown');
      await d.ev(`__t.tick(150)`);
      await d.scan('ekstra-ac-kolom');
      await d.load(progress(before('t6-update'), 't6-update'));
      await d.wait('SEP yang Akhirnya Terbit');
      await d.run("UPDATE kunjungan SET no_sep = '0301R0011026V000110' WHERE no_rawat = '2026/10/09/000001';");
      await d.ev(`__t.tick(1500)`);
      await d.scan('ekstra-dml');
    },
  },
];

interface ScanRecord {
  width: number;
  state: string;
  theme: Theme;
  report: ContrastReport;
}

async function contrastEverywhere(t: SuiteContext, k: Kit, h: Helpers): Promise<void> {
  const records: ScanRecord[] = [];
  const usedDark = new Set<string>();
  const usedLight = new Set<LightExempt>();
  const STATES_PER_WIDTH = new Map<number, number>();

  for (const { width, height } of [
    { width: 1440, height: 900 },
    { width: 375, height: 812 },
  ]) {
    await k.viewport(width, height);
    const scan = async (state: string) => {
      const lines: string[] = [];
      let bad = 0;
      for (const theme of THEMES) {
        if (!(await h.setThemeLive(theme))) throw new Error(`tema ${theme} tidak terpasang`);
        await t.evaluate(FREEZE);
        const report = await t.evaluate<ContrastReport>(contrastScanExpression());
        records.push({ width, state, theme, report });
        const failing = report.issues.filter((issue: ContrastIssue) => {
          if (theme === 'light') {
            const exempt = lightExempt(issue);
            if (exempt !== undefined) usedLight.add(exempt);
            return exempt === undefined;
          }
          const key = contrastKey(issue);
          if (DARK_PREEXISTING.includes(key)) {
            usedDark.add(key);
            return false;
          }
          return true;
        });
        const surfaces = await t.evaluate<string[]>(OPPOSITE_SURFACES(theme));
        bad += failing.length + surfaces.length;
        lines.push(...formatContrastIssues(failing).map((line) => `${theme}: ${line}`), ...surfaces.map((s) => `${theme}: permukaan berlawanan tema ${s}`));
        if (report.scanned === 0 && !state.startsWith('layar-')) lines.push(`${theme}: tidak ada teks yang terpindai`);
      }
      await h.setThemeLive('light');
      STATES_PER_WIDTH.set(width, (STATES_PER_WIDTH.get(width) ?? 0) + 1);
      t.check(`kontras AA terang & gelap @${width}px: ${state}`, bad === 0 && lines.length === 0, lines.slice(0, 3).join(' | '));
    };

    const d: Driver = {
      width,
      ev: (expression) => t.evaluate(expression),
      load: async (storage = {}, route = '#/sql', ready = true) => {
        const raw = Object.fromEntries(Object.entries(storage).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
        await h.loadLoose({ ...raw, [THEME_KEY]: 'light' }, route);
        if (ready && !(await k.waitTrack(30_000))) throw new Error(`jalur tidak siap (${route})`);
        await t.evaluate(FREEZE);
      },
      wait: async (text, ms = 15_000) => {
        if (!(await t.evaluate<boolean>(`__t.waitHas(${JSON.stringify(text)}, ${ms})`))) throw new Error(`teks tidak muncul: ${text}`);
      },
      click: (label) => t.evaluate(`__t.click(${JSON.stringify(label)})`),
      clickMatch: (re) =>
        t.evaluate(`(() => { const b = __t.all('button').find(x => ${re.toString()}.test(x.innerText)); if (!b) throw new Error('tombol tidak ada: ' + ${JSON.stringify(re.toString())}); b.click(); return true; })()`),
      mode: (label) => t.evaluate(`__t.mode(${JSON.stringify(label)})`),
      tab: (label) => t.evaluate(`(() => { const b = __t.tab(${JSON.stringify(label)}); if (!b) throw new Error('tab tidak ada: ${label}'); b.click(); return true; })()`),
      setSql: (sql) => t.evaluate(`__t.setSql(${JSON.stringify(sql)}); true`),
      run: async (sql, button = 'Run & Check') => {
        await t.evaluate(`__t.setSql(${JSON.stringify(sql)}); true`);
        await t.sleep(150);
        await t.evaluate(`__t.click(${JSON.stringify(button)})`);
        // Tunggu eksekusinya selesai: indikator berjalan (dan tombol nonaktif) baru muncul setelah ±250 ms, dan saat
        // mesin sibuk eksekusi bisa lebih lama dari jeda tetap di alur — tanpa ini yang terpindai adalah keadaan
        // "sedang berjalan", bukan hasil yang dimaksud alur (keadaan berjalan dipindai sendiri: misi-berjalan).
        await t.sleep(350);
        await k.waitFor(`(() => { const b = __t.button(${JSON.stringify(button)}); return !__t.button('Hentikan') && (!b || !b.disabled); })()`, 20_000);
      },
      scan,
    };

    for (const flow of FLOWS) {
      try {
        await flow.run(d, t, k);
      } catch (err) {
        t.check(`alur ${flow.name} @${width}px berjalan sampai selesai`, false, err instanceof Error ? err.message : String(err));
        await k.send('Fetch.disable').catch(() => undefined);
        await t.browser.navigate(t.url).catch(() => undefined);
      }
    }
  }
  await k.resetViewport();

  const stale = DARK_PREEXISTING.filter((key) => !usedDark.has(key));
  t.check(
    `baseline tema gelap (pelanggaran lama, ${DARK_PREEXISTING.length} pasangan warna) masih semuanya ditemui — daftar hanya boleh menyusut`,
    stale.length === 0,
    stale.length > 0 ? `tidak lagi ditemui (hapus dari scripts/e2e/contrastAllow.ts): ${stale.slice(0, 4).join(' | ')}` : `${[...STATES_PER_WIDTH].map(([w, n]) => `${n} keadaan @${w}px`).join(', ')}`,
  );

  const staleLight = LIGHT_SCAN_EXEMPT.filter((e) => !usedLight.has(e));
  t.check(
    `pengecualian tema terang (${LIGHT_SCAN_EXEMPT.length} teks dekoratif aria-hidden, beralasan) masih semuanya terpakai`,
    staleLight.length === 0,
    staleLight.map((e) => e.selector).join(' | '),
  );

  const dump = process.env.E2E_CONTRAST_DUMP;
  if (dump) {
    const byKey = new Map<string, { theme: Theme; key: string; ratio: number; count: number; ariaHidden: boolean; disabled: boolean; example: string; states: Set<string> }>();
    for (const r of records) {
      for (const issue of r.report.issues) {
        const key = `${r.theme}|${contrastKey(issue)}`;
        const entry = byKey.get(key) ?? { theme: r.theme, key: contrastKey(issue), ratio: issue.ratio, count: 0, ariaHidden: issue.ariaHidden, disabled: issue.disabled, example: `«${issue.text}» — ${issue.selector}`, states: new Set<string>() };
        entry.count += issue.count;
        entry.states.add(`${r.state}@${r.width}`);
        byKey.set(key, entry);
      }
    }
    writeFileSync(dump, JSON.stringify([...byKey.values()].sort((a, b) => a.ratio - b.ratio).map((e) => ({ ...e, states: [...e.states] })), null, 1));
    console.log(`  (temuan kontras ditulis ke ${dump})`);
  }
}

/* ------------------------------------------------------------------ */

export async function themeSuite(t: SuiteContext): Promise<void> {
  const k = kit(t);
  const h = helpers(t, k);
  try {
    await toggle(t, k, h);
    await directOpen(t, k, h);
    await navigation(t, k, h);
    await identityAndPortals(t, k, h);
    await contrastEverywhere(t, k, h);
  } finally {
    await k.send('Fetch.disable').catch(() => undefined);
    await k.send('Emulation.clearDeviceMetricsOverride').catch(() => undefined);
    await k.send('Emulation.setEmulatedMedia', { features: [] }).catch(() => undefined);
  }
}
