/**
 * Verifikasi tema terang/gelap layar jalur (src/theme.css + tailwind.config.js + index.html).
 *
 *  1. Palet  — src/theme.css mendefinisikan SEMUA palet berbasis variabel (THEMED_PALETTES × 50…950) di :root (gelap)
 *              DAN di blok terang; nilai gelap = tailwindcss/colors PERSIS (tampilan gelap identik dengan sebelumnya).
 *  2. Konfig — tailwind.config.js memetakan palet itu ke `rgb(var(--c-…) / <alpha-value>)` dan punya varian `light:`
 *              dengan selektor yang sama dengan blok terang theme.css.
 *  3. Kode   — layar jalur tidak memakai palet lain (warnanya tidak akan ikut tema), varian dark:, atau warna mati
 *              (hex/rgb di className) tanpa dicatat.
 *  4. Kontras — setiap pasangan teks/latar yang dipakai di kode (scripts/verify/themePairs.ts) dihitung di KEDUA tema.
 *              Tema terang wajib ≥ AA (4.5:1; teks besar/ikon/garis fokus 3:1) kecuali tercatat di
 *              scripts/verify/themeAllow.ts. Tema gelap tidak boleh berubah, jadi pelanggarannya hanya peringatan.
 *  5. Pra-gambar — index.html memasang data-theme untuk SEMUA rute (juga saat penyimpanan diblokir) sebelum
 *              data-q-landing, dan penanda landing itu dipasang dengan aturan rute yang sama dengan parseRoute
 *              (skripnya dijalankan di sandbox untuk banyak hash, mis. '#//sql').
 *  6. Permukaan — batang scrollbar tema terang ≥ 3:1 dan seleksi teks tema terang menjaga teks terpilih ≥ 4.5:1
 *              (nilai gelap keduanya tetap seperti semula).
 *
 * Tabel lengkap: `npx tsx scripts/verify/theme.ts --table [--fail] [--file=Header]`.
 */
import colors from 'tailwindcss/colors';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { THEME_KEY } from '../../src/lib/storageKeys';
import { RESERVED_SEGMENTS, parseRoute } from '../../src/platform/router';
import { THEMED, TAILWIND_PALETTES, collectTrackPairs, colorUtil, parseClass, readRepo, trackFiles, type ClassPair, type ColorRef } from './themePairs';
import { LIGHT_EXEMPT, LIGHT_PENDING, type AllowEntry } from './themeAllow';
import { assert, warn } from './report';

type Rgb = readonly [number, number, number];
export type Palette = Record<string, Rgb>;

export const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;
export const LIGHT_SELECTOR = "html[data-theme='light']:not([data-q-landing])";

/* ------------------------------------------------------------------ */
/* Warna                                                               */
/* ------------------------------------------------------------------ */

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)];
}

function luminance([r, g, b]: Rgb): number {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function over(top: Rgb, alpha: number, base: Rgb): Rgb {
  return [top[0] * alpha + base[0] * (1 - alpha), top[1] * alpha + base[1] * (1 - alpha), top[2] * alpha + base[2] * (1 - alpha)];
}

/** Blok variabel --c-* dari theme.css: { dark: {'slate-950': [2,6,23], …}, light: {…} } (light = dark + timpaan). */
export function readThemeCss(): { dark: Palette; light: Palette; lightOnly: Palette } {
  const css = readRepo('src/theme.css');
  const block = (selector: string): Palette => {
    const start = css.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`src/theme.css: blok "${selector}" tidak ditemukan`);
    const body = css.slice(start, css.indexOf('\n}', start));
    const out: Record<string, Rgb> = {};
    for (const m of body.matchAll(/--c-([a-z]+-\d+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) out[m[1] ?? ''] = [Number(m[2]), Number(m[3]), Number(m[4])];
    return out;
  };
  const dark = block(':root');
  const lightOnly = block(LIGHT_SELECTOR);
  return { dark, light: { ...dark, ...lightOnly }, lightOnly };
}

/**
 * Warna Tailwind asli per palet → shade → hex (dari tailwindcss/colors, tanpa cast). Hanya properti data yang dibaca:
 * nama lama (lightBlue, warmGray, …) adalah getter yang mencetak peringatan usang.
 */
const TAILWIND_HEX: ReadonlyMap<string, Readonly<Record<string, string>>> = new Map(
  Object.keys(colors).flatMap((name): Array<[string, Record<string, string>]> => {
    const scale: unknown = Object.getOwnPropertyDescriptor(colors, name)?.value;
    if (typeof scale !== 'object' || scale === null) return [];
    return [[name, Object.fromEntries(Object.entries(scale).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))]];
  }),
);

function resolve(ref: ColorRef, palette: Palette): Rgb {
  if (ref.name === 'white') return [255, 255, 255];
  if (ref.name === 'black' || ref.name === 'transparent') return [0, 0, 0];
  const rgb = palette[ref.name];
  if (rgb) return rgb;
  // Palet yang tidak berbasis variabel: nilai Tailwind asli di kedua tema.
  const [name = '', shade = ''] = ref.name.split('-');
  const hex = TAILWIND_HEX.get(name)?.[shade];
  if (!hex) throw new Error(`warna tidak dikenal: ${ref.name}`);
  return hexToRgb(hex);
}

export interface PairResult {
  pair: ClassPair;
  dark: number;
  light: number;
}

function ratioFor(side: ClassPair['dark'], palette: Palette): number {
  const layers = [...side.bg].reverse(); // dari luar (padat) ke dalam
  let bg: Rgb = [0, 0, 0];
  for (const [i, layer] of layers.entries()) {
    const c = resolve(layer, palette);
    bg = i === 0 ? c : over(c, layer.alpha, bg);
  }
  const fg = over(resolve(side.fg, palette), side.fg.alpha * side.opacity, bg);
  return contrast(fg, bg);
}

export function evaluatePairs(pairs: readonly ClassPair[], theme = readThemeCss()): PairResult[] {
  return pairs.map((pair) => ({ pair, dark: ratioFor(pair.dark, theme.dark), light: ratioFor(pair.light, theme.light) }));
}

/* ------------------------------------------------------------------ */
/* Daftar izin                                                         */
/* ------------------------------------------------------------------ */

function matches(entry: AllowEntry, r: PairResult): boolean {
  if (entry.file !== r.pair.file) return false;
  if (entry.state !== undefined && entry.state !== r.pair.state) return false;
  if (entry.key !== undefined) return r.pair.key === entry.key;
  if (entry.fg !== undefined && !r.pair.key.startsWith(`${entry.fg} `) && !r.pair.key.startsWith(`${entry.fg}[`)) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Pemeriksaan                                                         */
/* ------------------------------------------------------------------ */

function readTailwindConfig(): string {
  return readRepo('tailwind.config.js');
}

export function verifyTheme(): void {
  let checks = 0;
  const ok = (cond: boolean, msg: string) => {
    checks += 1;
    assert(cond, `tema: ${msg}`);
  };

  // 1. Palet di theme.css
  const theme = readThemeCss();
  for (const name of THEMED) {
    const scale = TAILWIND_HEX.get(name) ?? {};
    for (const shade of SHADES) {
      const key = `${name}-${shade}`;
      const original = scale[shade];
      const dark = theme.dark[key];
      ok(dark !== undefined, `src/theme.css :root tidak mendefinisikan --c-${key}`);
      ok(theme.lightOnly[key] !== undefined, `src/theme.css blok terang tidak mendefinisikan --c-${key}`);
      if (dark && original) ok(dark.join(' ') === hexToRgb(original).join(' '), `--c-${key} gelap = ${dark.join(' ')}, harus nilai Tailwind asli ${hexToRgb(original).join(' ')} (${original}) supaya tema gelap identik`);
    }
  }

  // 2. Konfigurasi Tailwind
  const config = readTailwindConfig();
  const listed = /THEMED_PALETTES\s*=\s*\[([^\]]*)\]/.exec(config)?.[1]?.match(/'([a-z]+)'/g)?.map((s) => s.slice(1, -1)) ?? [];
  ok(listed.join(',') === THEMED.join(','), `tailwind.config.js THEMED_PALETTES (${listed.join(',')}) harus sama dengan scripts/verify/themePairs.ts THEMED (${THEMED.join(',')})`);
  ok(config.includes('rgb(var(--c-${name}-${shade}) / <alpha-value>)'), 'tailwind.config.js: palet tema harus dipetakan ke rgb(var(--c-<palet>-<shade>) / <alpha-value>)');
  ok(config.includes(`LIGHT_SELECTOR = "${LIGHT_SELECTOR}"`) && /addVariant\('light'/.test(config), `tailwind.config.js: varian light: harus memakai selektor ${LIGHT_SELECTOR}`);
  const css = readRepo('src/theme.css');
  ok(css.includes(`${LIGHT_SELECTOR} {`), `src/theme.css: blok terang harus memakai selektor ${LIGHT_SELECTOR}`);
  ok(readRepo('src/index.css').includes("@import './theme.css'"), "src/index.css harus mengimpor './theme.css'");
  ok(!/rgb\(\s*\d+\s+\d+\s+\d+\s*\)/.test(readRepo('src/index.css')), 'src/index.css: warna (body, seleksi, scrollbar) harus lewat variabel/kelas palet, bukan rgb() mati');

  // 3. Kode layar jalur
  const hardcoded: string[] = [];
  for (const file of trackFiles()) {
    const source = readRepo(file);
    ok(!/(^|[\s"'`])dark:[a-z]/.test(source), `${file}: jangan memakai varian dark: (tema lewat palet variabel + varian light:)`);
    for (const m of source.matchAll(/(?<![\w-])((?:[\w-]+:)*(?:bg|text|border|ring|from|via|to|fill|stroke|divide|placeholder|outline|shadow|accent|caret|decoration)-([a-z]+)-\d{2,3}(?:\/[\w.[\]]+)?)(?![\w-])/g)) {
      const palette = m[2] ?? '';
      if ((TAILWIND_PALETTES as readonly string[]).includes(palette) && !(THEMED as readonly string[]).includes(palette)) {
        ok(false, `${file}: kelas ${m[1]} memakai palet "${palette}" yang tidak berbasis variabel (tidak ikut tema) — pakai palet tema atau tambahkan palet itu ke THEMED_PALETTES + src/theme.css`);
      }
    }
    for (const m of source.matchAll(/(?:bg|text|border|from|to|via|fill|stroke|shadow|drop-shadow|ring|outline)-\[[^\]]*(?:#[0-9a-fA-F]{3,8}|rgba?\()[^\]]*\]/g)) hardcoded.push(`${file}: ${m[0]}`);
  }
  if (hardcoded.length > 0) warn(`tema: ${hardcoded.length} warna mati di className layar jalur (tidak ikut tema; pastikan tetap layak di tema terang): ${hardcoded.join(' · ')}`);

  // 4. Kontras pasangan dari kode
  const results = evaluatePairs(collectTrackPairs(), theme);
  const lightFails = results.filter((r) => r.light < r.pair.min - 0.005);
  const exempt = (r: PairResult) => LIGHT_EXEMPT.some((e) => matches(e, r));
  const pending = (r: PairResult) => LIGHT_PENDING.some((e) => matches(e, r));
  const unexplained = lightFails.filter((r) => !exempt(r) && !pending(r));
  for (const r of unexplained.slice(0, 40)) {
    ok(false, `kontras terang ${r.light.toFixed(2)}:1 < ${r.pair.min} — ${r.pair.file}:${r.pair.line} ${r.pair.kind}${r.pair.state ? ` (${r.pair.state})` : ''} ${r.pair.key} (gelap ${r.dark.toFixed(2)}:1)`);
  }
  if (unexplained.length > 40) ok(false, `… dan ${unexplained.length - 40} pasangan terang lain di bawah AA (lihat: npx tsx scripts/verify/theme.ts --table --fail)`);
  const pendingHits = lightFails.filter((r) => pending(r) && !exempt(r));
  if (pendingHits.length > 0) warn(`tema: ${pendingHits.length} pasangan terang di bawah AA masih menunggu perbaikan komponen (scripts/verify/themeAllow.ts LIGHT_PENDING, ${LIGHT_PENDING.length} entri)`);
  // Entri izin yang sudah tidak mengenai pasangan gagal mana pun harus dihapus (daftar hanya boleh menyusut).
  for (const entry of [...LIGHT_PENDING, ...LIGHT_EXEMPT]) {
    const used = lightFails.some((r) => matches(entry, r));
    ok(used, `themeAllow.ts: entri ${entry.file} ${entry.key ?? entry.fg ?? ''} tidak lagi mengenai pasangan yang gagal — hapus dari daftar`);
  }
  const darkFails = results.filter((r) => r.dark < r.pair.min - 0.005);
  if (darkFails.length > 0) {
    const files = new Set(darkFails.map((r) => r.pair.file)).size;
    warn(`tema: ${darkFails.length} pasangan di tema GELAP di bawah AA (sudah ada sebelum tema terang, di ${files} berkas; tema gelap sengaja tidak diubah) — npx tsx scripts/verify/theme.ts --table --dark`);
  }

  // 5. Skrip pra-gambar
  const html = readRepo('index.html');
  const setTheme = html.indexOf("root.setAttribute('data-theme', theme)");
  const trackReturn = html.indexOf('return;', setTheme);
  const setLanding = html.indexOf("root.setAttribute('data-q-landing', '')");
  ok(setTheme > 0 && trackReturn > setTheme && setLanding > trackReturn, 'index.html: skrip pra-gambar harus memasang data-theme untuk SEMUA rute, lalu data-q-landing hanya untuk Beranda/landing');
  verifyPrepaint(html, ok);

  // 6. Scrollbar & seleksi teks tema terang (nilai gelap tetap seperti semula)
  verifySurfaces(theme, ok);

  console.log(`  tema: ${checks} pemeriksaan; ${results.length} pasangan warna dari kode (${new Set(results.map((r) => r.pair.file)).size} berkas) — terang gagal ${lightFails.length} (izin: ${lightFails.length - unexplained.length}), gelap di bawah AA ${darkFails.length}`);
}

/* ------------------------------------------------------------------ */
/* Skrip pra-gambar index.html (dijalankan di sandbox)                 */
/* ------------------------------------------------------------------ */

type Check = (cond: boolean, msg: string) => void;

interface PrepaintCase {
  hash: string;
  stored?: string | null;
  /** localStorage melempar (penyimpanan diblokir). */
  blocked?: boolean;
  systemDark?: boolean;
}

/** Atribut <html> yang dipasang skrip pra-gambar untuk satu keadaan (hash, penyimpanan, tema sistem). */
function runPrepaint(script: string, c: PrepaintCase): { theme: string | null; landing: boolean; error: string | null } {
  const attrs = new Map<string, string>();
  const matchMedia = (query: string) => ({ matches: query === '(prefers-color-scheme: dark)' && c.systemDark === true });
  const sandbox: Record<string, unknown> = {
    document: { documentElement: { setAttribute: (name: string, value: string) => attrs.set(name, value) } },
    location: { hash: c.hash },
    window: { matchMedia },
    matchMedia,
  };
  const storage = { getItem: (key: string) => (key === THEME_KEY ? (c.stored ?? null) : null) };
  Object.defineProperty(sandbox, 'localStorage', {
    enumerable: true,
    get: () => {
      if (c.blocked) throw new Error('SecurityError: penyimpanan diblokir');
      return storage;
    },
  });
  let error: string | null = null;
  try {
    runInNewContext(script, sandbox);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err); // skrip melempar: halaman asli juga tanpa atribut
  }
  return { theme: attrs.get('data-theme') ?? null, landing: attrs.has('data-q-landing'), error };
}

/**
 * Skrip pra-gambar memakai aturan rute yang SAMA dengan parseRoute: penanda landing terpasang tepat untuk hash yang
 * BUKAN layar jalur — termasuk variasi seperti '#//sql' (router membuka jalur dan merapikannya; bila penanda tertinggal,
 * palet terang jalur tidak pernah aktif). Tema selalu terpasang, juga saat penyimpanan diblokir (ikut tema sistem).
 */
export function verifyPrepaint(html: string, ok: Check): void {
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  ok(script !== undefined, 'index.html: skrip pra-gambar (script inline pertama) tidak ditemukan');
  if (script === undefined) return;
  ok(script.includes(`'${THEME_KEY}'`), `index.html: skrip pra-gambar harus membaca kunci tema ${THEME_KEY}`);
  const reserved = /\[((?:\s*'[^']*'\s*,?)+)\]\.indexOf\(first\)/.exec(script)?.[1]?.match(/'([^']*)'/g)?.map((s) => s.slice(1, -1)) ?? [];
  ok(
    [...reserved].sort().join(',') === [...RESERVED_SEGMENTS].sort().join(','),
    `index.html: daftar segmen non-jalur di skrip pra-gambar (${reserved.join(',')}) harus sama dengan RESERVED_SEGMENTS router (${RESERVED_SEGMENTS.join(',')})`,
  );
  const hashes = [
    '', '#', '#/', '#//', '#sql', '#/sql', '#/SQL', '#/sql/', '#//sql', '#///sql/ujian', '#/%73ql', '#/sql/misi', '#/sql%2F',
    '#/landing', '#/landing/', '#/LANDING/SQL', '#//landing/sql', '#/landing%2Fsql', '#/landingx', '#/profil', '#//runner',
    '#/Cari/x', '#/pengaturan/', '#/%E0%A4%A', '#/foo', '#/python', '#/%',
  ];
  const wrong: string[] = [];
  for (const hash of hashes) {
    const expectLanding = parseRoute(hash).kind !== 'track';
    for (const blocked of [false, true]) {
      const got = runPrepaint(script, { hash, stored: 'light', blocked, systemDark: true });
      if (got.error !== null) wrong.push(`'${hash}'${blocked ? ' (penyimpanan diblokir)' : ''}: skrip melempar ${got.error}`);
      else if (got.landing !== expectLanding) wrong.push(`'${hash}'${blocked ? ' (penyimpanan diblokir)' : ''}: data-q-landing ${got.landing ? 'terpasang' : 'tidak'}, harus ${expectLanding ? 'terpasang' : 'tidak'}`);
    }
  }
  ok(wrong.length === 0, `index.html: skrip pra-gambar berbeda dari parseRoute — ${wrong.slice(0, 4).join('; ')}`);
  const themeCases: Array<[PrepaintCase, string]> = [
    [{ hash: '#/sql', stored: 'light', systemDark: true }, 'light'],
    [{ hash: '#/', stored: 'dark', systemDark: false }, 'dark'],
    [{ hash: '#/sql', stored: null, systemDark: true }, 'dark'],
    [{ hash: '#/sql', stored: 'biru', systemDark: false }, 'light'],
    [{ hash: '#/sql', blocked: true, systemDark: true }, 'dark'],
    [{ hash: '#/', blocked: true, systemDark: false }, 'light'],
  ];
  for (const [c, expected] of themeCases) {
    const got = runPrepaint(script, c);
    ok(got.error === null && got.theme === expected, `index.html: skrip pra-gambar ${JSON.stringify(c)} memasang data-theme=${got.theme}${got.error ? ` (melempar ${got.error})` : ''}, harus ${expected} (pilihan tersimpan; selain itu tema sistem — juga saat penyimpanan diblokir)`);
  }
}

/* ------------------------------------------------------------------ */
/* Scrollbar & seleksi teks                                            */
/* ------------------------------------------------------------------ */

/** Nilai --c-scrollbar di satu blok theme.css: "R G B" atau var(--c-<palet>-<shade>). */
function scrollbarColor(css: string, selector: string, palette: Palette): Rgb | null {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return null;
  const body = css.slice(start, css.indexOf('\n}', start));
  const m = /--c-scrollbar:\s*(?:(\d+)\s+(\d+)\s+(\d+)|var\(--c-([a-z]+-\d+)\))\s*;/.exec(body);
  if (!m) return null;
  if (m[4] !== undefined) return palette[m[4]] ?? null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Warna teks yang sering dipilih/disalin di layar jalur (keterangan, angka, kata kunci di blok kode). */
const SELECTABLE_TEXT = ['slate-100', 'slate-200', 'slate-300', 'slate-400', 'slate-500', 'slate-600', 'emerald-300', 'emerald-400', 'teal-300', 'sky-300', 'amber-300', 'rose-300', 'rose-400', 'fuchsia-300', 'violet-300'];

/**
 * - Batang .scrollbar-thin: tema gelap tetap slate-700 asli; tema terang ≥ 3:1 (komponen non-teks) di atas halaman putih
 *   dan panel slate-900.
 * - Seleksi teks: tema gelap tetap bg-emerald-500/30; tema terang punya aturan sendiri yang menjaga teks terpilih
 *   ≥ 4.5:1 di atas halaman dan panel.
 */
function verifySurfaces(theme: { dark: Palette; light: Palette }, ok: Check): void {
  const css = readRepo('src/theme.css');
  const white = theme.light['slate-950'] ?? [255, 255, 255];
  const panel = theme.light['slate-900'] ?? [237, 241, 247];
  const darkBar = scrollbarColor(css, ':root', theme.dark);
  ok(darkBar !== null && darkBar.join(' ') === (theme.dark['slate-700'] ?? []).join(' '), 'src/theme.css: --c-scrollbar gelap harus slate-700 asli (tampilan gelap identik)');
  const lightBar = scrollbarColor(css, LIGHT_SELECTOR, theme.light);
  ok(lightBar !== null, 'src/theme.css: blok terang harus mendefinisikan --c-scrollbar');
  if (lightBar) {
    const [onWhite, onPanel] = [contrast(lightBar, white), contrast(lightBar, panel)];
    ok(Math.min(onWhite, onPanel) >= 3, `src/theme.css: batang scrollbar terang ${onWhite.toFixed(2)}:1 di halaman / ${onPanel.toFixed(2)}:1 di panel — harus ≥ 3:1 (komponen non-teks)`);
  }

  const index = readRepo('src/index.css');
  ok(/(^|\n)\s*::selection\s*\{\s*@apply bg-emerald-500\/30;/.test(index), 'src/index.css: ::selection dasar (tema gelap) harus tetap bg-emerald-500/30');
  const lightSel = new RegExp(`${LIGHT_SELECTOR.replace(/[[\]().*+?^$|\\]/g, '\\$&')} ::selection\\s*\\{\\s*@apply (bg-[\\w-]+/\\d+);`).exec(index)?.[1];
  ok(lightSel !== undefined, `src/index.css: tema terang perlu aturan seleksi sendiri (${LIGHT_SELECTOR} ::selection { @apply bg-…/NN; })`);
  const sel = lightSel === undefined ? null : colorUtil(lightSel)?.color;
  if (!sel) return;
  const weak: string[] = [];
  for (const [surfaceName, surface] of [['halaman', white], ['panel', panel]] as const) {
    const bg = over(resolve(sel, theme.light), sel.alpha, surface);
    for (const name of SELECTABLE_TEXT) {
      const ratio = contrast(resolve({ name, alpha: 1 }, theme.light), bg);
      if (ratio < 4.5) weak.push(`text-${name} di ${surfaceName} ${ratio.toFixed(2)}:1`);
    }
  }
  ok(weak.length === 0, `src/index.css: teks terpilih di tema terang (${lightSel}) di bawah 4.5:1 — ${weak.slice(0, 4).join('; ')}`);
}

/* ------------------------------------------------------------------ */
/* CLI: tabel                                                          */
/* ------------------------------------------------------------------ */

function printTable(argv: readonly string[]): void {
  const onlyFail = argv.includes('--fail');
  const darkMode = argv.includes('--dark');
  const fileFilter = argv.find((a) => a.startsWith('--file='))?.slice(7);
  const results = evaluatePairs(collectTrackPairs());
  const unique = new Map<string, PairResult & { count: number; lines: number[] }>();
  for (const r of results) {
    const k = `${r.pair.file}|${r.pair.kind}|${r.pair.state}|${r.pair.key}`;
    const prev = unique.get(k);
    if (prev) {
      prev.count += 1;
      if (!prev.lines.includes(r.pair.line)) prev.lines.push(r.pair.line);
    } else unique.set(k, { ...r, count: 1, lines: [r.pair.line] });
  }
  let rows = [...unique.values()];
  if (fileFilter) rows = rows.filter((r) => r.pair.file.includes(fileFilter));
  if (onlyFail) rows = rows.filter((r) => (darkMode ? r.dark : r.light) < r.pair.min - 0.005);
  rows.sort((a, b) => (darkMode ? a.dark - b.dark : a.light - b.light));
  console.log(`${rows.length} pasangan unik (dari ${results.length})\n  gelap  terang  min  jenis   berkas:baris  pasangan`);
  for (const r of rows) {
    const flagL = r.light < r.pair.min - 0.005 ? '✗' : ' ';
    const flagD = r.dark < r.pair.min - 0.005 ? '✗' : ' ';
    console.log(`${flagD}${r.dark.toFixed(2).padStart(5)} ${flagL}${r.light.toFixed(2).padStart(5)}  ${String(r.pair.min).padEnd(3)}  ${r.pair.kind.padEnd(7)} ${r.pair.file.replace(/^src\//, '')}:${r.lines.join(',')}${r.pair.state ? ` (${r.pair.state})` : ''}  ${r.pair.key}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--table')) printTable(process.argv.slice(2));
  else verifyTheme();
}

export { colorUtil, parseClass };
