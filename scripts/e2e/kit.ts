/**
 * Alat bantu bersama suite E2E yang memakai Beranda, halaman landing, dan shell platform (suites/home.ts,
 * suites/courses.ts): potongan ekspresi halaman (penanda siap, permintaan .wasm, latar gelap/terang, tema layar jalur)
 * dan `kit(t)` —
 * tunggu-kondisi, klik mouse/keyboard sungguhan lewat CDP, ukuran layar, jalur hangat yang tersembunyi.
 */
import type { SuiteContext } from './context';

/* ------------------------------------------------------------------ */
/* Potongan ekspresi halaman                                           */
/* ------------------------------------------------------------------ */

export const HOME_READY = `__t.all('[data-testid="home"][data-ready="true"]').length > 0`;
export const TRACK_READY = `(__t.all('[aria-label="Mode aplikasi"] button').length > 0 && __t.all('[data-testid="home"]').length === 0)`;
export const AT_HOME_URL = `['', '#', '#/'].includes(location.hash)`;
/** Elemen terlihat ber-data-testid tertentu (atau undefined). */
export const tid = (id: string) => `__t.all('[data-testid="${id}"]')[0]`;
/** Halaman katalog/landing jalur yang sedang tampil dan sudah siap (data-page = catalog | course | not-found). */
export const LANDING_PAGE = (page: string) => `__t.all('[data-testid="landing-page"][data-page="${page}"][data-ready="true"]')[0]`;

/**
 * Permintaan biner WebAssembly sungguhan. Di server dev, `sql-wasm.wasm?import&url` adalah modul JS kecil yang hanya
 * mengekspor URL (ikut terambil saat chunk jalur dipramuat) — itu BUKAN mesin SQL, jadi tidak dihitung.
 *
 * Buffer Resource Timing bawaan hanya 250 entri; server dev memuat ratusan modul sehingga permintaan yang datang
 * belakangan (justru .wasm) tidak tercatat. Suite ini memperbesar buffer itu sejak dokumen dibuat (RESOURCE_BUFFER).
 */
export const RESOURCE_BUFFER = 5000;

export const WASM_REQUESTS = `performance.getEntriesByType('resource').map(e => new URL(e.name)).filter(u => u.pathname.endsWith('.wasm') && !/[?&]import\\b/.test(u.search)).map(u => u.pathname.split('/').pop())`;

/**
 * Seberapa gelap/terang layar yang sedang tampil, dihitung dari warna latar TERHITUNG (luminans relatif: 0 = hitam,
 * 1 = putih): `body` = latar <body>; `dark` / `light` = bagian titik contoh (kisi 8×6 di seluruh layar) yang latar
 * padat terdekatnya gelap (< 0.1) / terang (> 0.6); `brightest` / `darkest` = titik paling terang / paling gelap.
 * Tombol berwarna boleh ada, tetapi permukaan layar harus mengikuti tema.
 * Warna diambil setelah transisi CSS yang sedang berjalan selesai (paling lama 2 detik): sesaat setelah tema diganti,
 * elemen berkelas `transition` masih berada di antara warna lama dan baru — saat mesin sibuk, lebih lama dari jeda tetap
 * di suite. getAnimations() juga memaksa gaya dihitung, jadi transisi yang baru akan dimulai ikut terlihat.
 */
export const BACKDROP = `(async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 2000 && document.getAnimations().some((a) => a instanceof CSSTransition && a.playState === 'running')) await new Promise((r) => setTimeout(r, 50));
  const parse = (color) => { const n = (color.match(/[\\d.]+/g) ?? []).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return { alpha: n.length > 3 ? n[3] : 1, lum: 0.2126 * f(n[0] ?? 0) + 0.7152 * f(n[1] ?? 0) + 0.0722 * f(n[2] ?? 0) }; };
  const solid = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.alpha > 0.9) return c.lum; } return 1; };
  const lums = [];
  for (let ix = 0; ix < 8; ix += 1) for (let iy = 0; iy < 6; iy += 1) lums.push(solid(document.elementFromPoint(innerWidth * (ix + 0.5) / 8, innerHeight * (iy + 0.5) / 6)));
  const bodyColor = getComputedStyle(document.body).backgroundColor;
  return { body: parse(bodyColor).lum, bodyColor, dark: lums.filter(l => l < 0.1).length / lums.length, light: lums.filter(l => l > 0.6).length / lums.length, brightest: Math.max(...lums), darkest: Math.min(...lums) };
})()`;

export interface Backdrop {
  body: number;
  bodyColor: string;
  dark: number;
  light: number;
  brightest: number;
  darkest: number;
}

/** Latar body layar jalur bertema gelap — nilai slate-950 Tailwind asli (tema gelap identik dengan sebelum ada tema terang). */
export const TRACK_DARK_BODY = 'rgb(2, 6, 23)';
/** Layar jalur gelap: latar body slate-950 asli, hampir semua permukaan gelap, tidak ada permukaan terang. */
export const looksDarkTrack = (b: Backdrop) => b.bodyColor === TRACK_DARK_BODY && b.dark >= 0.85 && b.brightest < 0.75;
/** Layar jalur terang: latar body terang dan hampir semua permukaan terang (tombol aksen berwarna tua boleh ada). */
export const looksLightTrack = (b: Backdrop) => b.body > 0.9 && b.light >= 0.85;

export interface KeySpec {
  key: string;
  code: string;
  vk: number;
  text?: string;
}
export const KEYS = {
  Enter: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
  Space: { key: ' ', code: 'Space', vk: 32, text: ' ' },
  Escape: { key: 'Escape', code: 'Escape', vk: 27 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
  Tab: { key: 'Tab', code: 'Tab', vk: 9 },
} satisfies Record<string, KeySpec>;

/* ------------------------------------------------------------------ */
/* Alat bantu                                                          */
/* ------------------------------------------------------------------ */

export function kit(t: SuiteContext) {
  const send = (method: string, params: Record<string, unknown> = {}) => t.browser.send(method, params);

  /** Tunggu sampai ekspresi halaman bernilai benar. */
  const waitFor = (expr: string, ms = 10_000) =>
    t.evaluate<boolean>(
      `(async () => { const t0 = Date.now(); while (Date.now() - t0 < ${ms}) { try { if (${expr}) return true; } catch (e) { /* halaman sedang berganti */ } await new Promise(r => setTimeout(r, 50)); } return false; })()`,
    );

  const text = (id: string) => t.evaluate<string>(`(${tid(id)}?.innerText ?? '').replace(/\\s+/g, ' ').trim()`);
  const shown = (id: string) => t.evaluate<boolean>(`!!${tid(id)}`);
  const click = (id: string) => t.evaluate(`(() => { const el = ${tid(id)}; if (!el) throw new Error('tidak terlihat: ${id}'); el.click(); return true; })()`);
  const hash = () => t.evaluate<string>(`location.hash`);
  const stored = <T>(key: string) => t.evaluate<T | null>(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}) ?? 'null')`);
  /** Seluruh isi localStorage sebagai satu teks, untuk memastikan "tidak ada yang berubah". */
  const snapshot = () => t.evaluate<string>(`JSON.stringify(Object.entries(localStorage).sort(([a], [b]) => (a < b ? -1 : 1)))`);

  const waitHome = (ms = 30_000) => waitFor(`${HOME_READY} && ${AT_HOME_URL}`, ms);
  const waitTrack = (ms = 40_000) => waitFor(TRACK_READY, ms);

  /** Halaman dimuat ulang oleh aplikasi sendiri (mis. setelah memulihkan cadangan). */
  const afterAppReload = async () => {
    await t.sleep(500);
    await t.browser.waitForLoad();
    await t.installHelpers();
    return waitFor(`${HOME_READY} || ${TRACK_READY}`, 30_000);
  };

  /** Seperti t.fresh, tetapi nilai storage ditulis MENTAH (untuk data rusak yang bukan JSON). */
  const freshRaw = async (raw: Record<string, string>, route: string) => {
    await t
      .evaluate(
        `localStorage.clear(); sessionStorage.clear(); ${Object.entries(raw)
          .map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`)
          .join(' ')} history.replaceState(null, '', location.pathname + location.search + ${JSON.stringify(route)}); location.reload(); true`,
      )
      .catch(() => undefined);
    return afterAppReload();
  };

  /** Klik dengan mouse sungguhan pada elemen hasil `elementExpr` (digulir ke tengah layar lebih dulu). */
  const mouseClick = async (elementExpr: string): Promise<boolean> => {
    const found = await t.evaluate<boolean>(`(() => { const el = ${elementExpr}; if (!el) return false; el.scrollIntoView({ block: 'center', behavior: 'instant' }); return true; })()`);
    if (!found) return false;
    await t.sleep(450); // animasi masuk (geser 24px) selesai dulu supaya titik kliknya tidak meleset
    const p = await t.evaluate<{ x: number; y: number } | null>(`(() => { const el = ${elementExpr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if (!p) return false;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    return true;
  };

  /** Tekan satu tombol keyboard sungguhan (menuju elemen yang sedang terfokus). */
  const press = async (name: keyof typeof KEYS) => {
    const spec: KeySpec = KEYS[name];
    const base = { key: spec.key, code: spec.code, windowsVirtualKeyCode: spec.vk, nativeVirtualKeyCode: spec.vk };
    await send('Input.dispatchKeyEvent', spec.text === undefined ? { type: 'rawKeyDown', ...base } : { type: 'keyDown', ...base, text: spec.text, unmodifiedText: spec.text });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  };

  /** Ketik huruf satu per satu seperti pengguna (memicu autocomplete editor). */
  const typeLetters = async (letters: string) => {
    for (const ch of letters) {
      const vk = ch.toUpperCase().charCodeAt(0);
      const base = { key: ch, code: `Key${ch.toUpperCase()}`, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
      await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: ch, unmodifiedText: ch });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    }
  };

  const viewport = async (width: number, height: number) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
    await t.sleep(300);
  };
  const resetViewport = async () => {
    await send('Emulation.clearDeviceMetricsOverride');
    await t.sleep(300);
  };

  /** Pulang lewat tombol Beranda di header jalur. */
  const headerHome = async () => {
    await t.evaluate(`(() => { const b = __t.all('button[aria-label="Beranda"]')[0]; if (!b) throw new Error('tombol Beranda di header jalur tidak terlihat'); b.click(); return true; })()`);
    return waitHome();
  };

  /** Keadaan jalur yang "hangat" di balik Beranda: harus tersembunyi seluruhnya dan tidak memegang fokus. */
  const hiddenTrack = () =>
    t.evaluate<{ host: boolean; hidden: boolean; visible: number; focusInside: boolean; popups: number; strays: string[] }>(`(() => {
      const host = document.querySelector('[data-testid="track-host"]');
      const strays = [...document.body.children].filter(e => e.id !== 'root' && !['SCRIPT', 'STYLE'].includes(e.tagName) && __t.visible(e) && e.getBoundingClientRect().width > 1).map(e => e.tagName.toLowerCase() + (e.getAttribute('role') ? '[' + e.getAttribute('role') + ']' : ''));
      return {
        host: !!host,
        hidden: !!host && host.hidden,
        visible: host ? [host, ...host.querySelectorAll('*')].filter(__t.visible).length : 0,
        focusInside: !!host && host.contains(document.activeElement),
        popups: __t.all('[aria-label="Saran autocomplete"]').length,
        strays,
      };
    })()`);

  /** Pilih file di <input type="file"> Beranda (pemilih file asli tidak bisa dibuka di headless). */
  const pickFile = (content: string, name: string) =>
    t.evaluate(`(() => {
      const input = document.querySelector('[data-testid="home-restore-file"]');
      const dt = new DataTransfer();
      dt.items.add(new File([${JSON.stringify(content)}], ${JSON.stringify(name)}, { type: 'application/json' }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);

  /**
   * Pesan console yang MEMANG diharapkan selama sebuah langkah (mis. React melaporkan chunk yang sengaja diblokir):
   * jalankan `run`, lalu pastikan setiap pesan baru cocok dengan `allowed` dan buang dari daftar — pesan lain tetap
   * tinggal dan menggagalkan pemeriksaan console di akhir suite. Mengembalikan pesan yang dibuang.
   */
  const expectingConsole = async (allowed: RegExp, run: () => Promise<void>): Promise<string[]> => {
    const problems = t.browser.problems;
    const start = problems.length;
    await run();
    await t.sleep(150);
    const fresh = problems.splice(start);
    problems.push(...fresh.filter((line) => !allowed.test(line)));
    return fresh.filter((line) => allowed.test(line));
  };

  /** Muat Beranda TANPA menunggu data-ready (untuk keadaan gagal yang memang tidak pernah "siap"). */
  const loadHomeLoosely = async (storage: Record<string, unknown> = {}) => {
    await t
      .evaluate(
        `localStorage.clear(); sessionStorage.clear(); ${Object.entries(storage)
          .map(([key, value]) => `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(value))});`)
          .join(' ')} history.replaceState(null, '', location.pathname + location.search + '#/'); location.reload(); true`,
      )
      .catch(() => undefined);
    await t.sleep(400);
    await t.browser.waitForLoad();
    await t.installHelpers();
    return waitFor(`__t.all('[data-testid="home"]').length > 0`, 20_000);
  };

  return { send, waitFor, text, shown, click, hash, stored, snapshot, waitHome, waitTrack, afterAppReload, freshRaw, mouseClick, press, typeLetters, viewport, resetViewport, headerHome, hiddenTrack, pickFile, expectingConsole, loadHomeLoosely };
}

export type Kit = ReturnType<typeof kit>;
