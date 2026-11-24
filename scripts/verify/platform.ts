/**
 * Verifikasi lapisan platform (bagian headless):
 * - router hash   src/platform/router.ts   — parseRoute/formatRoute dan store (push, replace, tombol Kembali)
 * - registri      src/platform/tracks.ts   — aturan id/status, dan modulnya tetap ringan
 * - bundel awal   src/main.tsx             — impor statis Beranda + shell tidak menjangkau data misi, mesin SQL, atau jalur
 * - karantina     src/lib/storageGuard.ts  — aturan slot + pemasangan di pemuat progres, kesalahan, materi, jadwal, ujian
 * - resume        src/lib/resume.ts        — aturan "lanjut dari mana" (dipakai App dan Beranda)
 * - glance        src/tracks/sql/glance.ts — ringkasan Beranda untuk storage kosong/rusak (hanya membaca)
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ARTICLES } from '../../src/data/materi';
import { MISSIONS, TIERS } from '../../src/data/missions';
import { readStoredArticleReads } from '../../src/hooks/useArticleReads';
import { readStoredHistory } from '../../src/hooks/useExam';
import { readStoredMistakes } from '../../src/hooks/useMistakes';
import { readStoredDeck } from '../../src/hooks/useReviewDeck';
import { createEmptyProgress, loadProgress, saveProgress } from '../../src/lib/progress';
import { findPendingMission, pickInitialMissionId, requireFirstMission } from '../../src/lib/resume';
import {
  MAX_QUARANTINE_SLOTS,
  isBlankRaw,
  lastQuarantinedAt,
  quarantine,
  quarantineKey,
  readGuarded,
  readQuarantine,
} from '../../src/lib/storageGuard';
import {
  ARTICLE_READS_KEY,
  EXAM_HISTORY_KEY,
  EXAM_SESSION_KEY,
  MISTAKES_KEY,
  PROGRESS_KEY,
  REVIEW_KEY,
  SQL_GUARDED_KEYS,
  SQL_TRACK_KEYS,
} from '../../src/lib/storageKeys';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '../../src/platform/brand';
import { HOME_ROUTE, RESERVED_SEGMENTS, createRouteStore, formatRoute, parseRoute, type Route, type RouterEnv } from '../../src/platform/router';
import { TRACKS, getTrack } from '../../src/platform/tracks';
import { glance, guard } from '../../src/tracks/sql/glance';
import type { Mission, UserProgress } from '../../src/types';
import { MemoryStorage, firstDifference } from './memoryStorage';
import { assert } from './report';

type Check = (cond: boolean, msg: string) => void;

const track = (trackId: string, ...rest: string[]): Route => ({ kind: 'track', trackId, rest });

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

function verifyRouterPure(ok: Check): void {
  const cases: Array<[hash: string, expected: Route]> = [
    // Beranda: hash kosong dan segala yang tidak diawali '#/'.
    ['', HOME_ROUTE],
    ['#', HOME_ROUTE],
    ['#/', HOME_ROUTE],
    ['#//', HOME_ROUTE],
    ['#sql', HOME_ROUTE],
    ['sql', HOME_ROUTE],
    ['/sql', HOME_ROUTE],
    ['#!/sql', HOME_ROUTE],
    ['# /sql', HOME_ROUTE],
    // Jalur + sisa segmen; garis miring ganda/akhir diabaikan.
    ['#/sql', track('sql')],
    ['#/sql/', track('sql')],
    ['#/sql/ujian', track('sql', 'ujian')],
    ['#//sql//ujian', track('sql', 'ujian')],
    ['#/sql/ujian///', track('sql', 'ujian')],
    ['#/sql/misi/t1-select', track('sql', 'misi', 't1-select')],
    // Decode per segmen; gagal decode di mana pun → Beranda.
    ['#/sql/a%20b', track('sql', 'a b')],
    ['#/sql/a%2Fb', track('sql', 'a/b')],
    ['#/%E0%A4%A', HOME_ROUTE],
    ['#/sql/%E0%A4%A', HOME_ROUTE],
    ['#/%', HOME_ROUTE],
    // Huruf besar: id jalur dinormalkan, sisa segmen dibiarkan.
    ['#/SQL', track('sql')],
    ['#/Sql/Ujian', track('sql', 'Ujian')],
    // Id yang tidak terdaftar tetap rute jalur (shell yang memutuskan); segmen cadangan → Beranda.
    ['#/tidak-ada', track('tidak-ada')],
    ['#/js', track('js')],
    ...RESERVED_SEGMENTS.map((segment): [string, Route] => [`#/${segment}`, HOME_ROUTE]),
    ['#/Profil/saya', HOME_ROUTE],
    ['#/RUNNER', HOME_ROUTE],
  ];
  for (const [hash, expected] of cases) {
    let actual: Route | null = null;
    try {
      actual = parseRoute(hash);
    } catch {
      actual = null;
    }
    ok(firstDifference(actual, expected) === null, `parseRoute(${JSON.stringify(hash)}) = ${JSON.stringify(actual)}, seharusnya ${JSON.stringify(expected)}`);
    // Hash kanonik stabil: mem-parse hasil format tidak mengubah rute.
    if (actual) {
      const canonical = formatRoute(actual);
      ok(firstDifference(parseRoute(canonical), actual) === null, `bolak-balik ${JSON.stringify(hash)} → ${canonical} berubah`);
      ok(formatRoute(parseRoute(canonical)) === canonical, `hash kanonik ${canonical} tidak stabil`);
    }
  }
  ok(parseRoute('') === HOME_ROUTE && parseRoute('#/profil') === HOME_ROUTE, 'rute Beranda harus objek HOME_ROUTE yang sama (stabil untuk React)');

  const formats: Array<[route: Route, expected: string]> = [
    [HOME_ROUTE, '#/'],
    [track('sql'), '#/sql'],
    [track('sql', 'ujian'), '#/sql/ujian'],
    [track('sql', 'misi', 't1-select'), '#/sql/misi/t1-select'],
    [track('sql', 'a b', 'c/d'), '#/sql/a%20b/c%2Fd'],
    [track('sql', '', 'ujian', ''), '#/sql/ujian'],
    [track('SQL'), '#/sql'],
    [track(''), '#/'],
  ];
  for (const [route, expected] of formats) ok(formatRoute(route) === expected, `formatRoute(${JSON.stringify(route)}) = ${formatRoute(route)}, seharusnya ${expected}`);
  for (const route of [HOME_ROUTE, track('sql'), track('sql', 'ujian'), track('sql', 'a b', 'c/d', 'é✓'), track('framework', 'nest', '3')]) {
    ok(firstDifference(parseRoute(formatRoute(route)), route) === null, `parseRoute(formatRoute(${JSON.stringify(route)})) harus mengembalikan rute yang sama`);
  }
}

/** Lingkungan tiruan: seperti browser, 'hashchange' setelah location.hash TIDAK langsung terpicu (dipicu manual). */
class FakeEnv implements RouterEnv {
  hash = '';
  pushes: string[] = [];
  replaces: string[] = [];
  private readonly listeners = new Set<() => void>();
  getHash = () => this.hash;
  pushHash = (hash: string) => {
    this.hash = hash;
    this.pushes.push(hash);
  };
  replaceHash = (hash: string) => {
    this.hash = hash;
    this.replaces.push(hash);
  };
  onHashChange = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  get listenerCount(): number {
    return this.listeners.size;
  }
  fireHashChange(): void {
    for (const listener of this.listeners) listener();
  }
}

function verifyRouteStore(ok: Check): void {
  const env = new FakeEnv();
  const store = createRouteStore(env);
  ok(store.getRoute() === HOME_ROUTE, 'store: hash kosong → Beranda');
  ok(env.listenerCount === 0, 'store: tidak berlangganan hashchange sebelum ada pelanggan');

  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls += 1;
  });
  ok(env.listenerCount === 1, 'store: pelanggan pertama memasang satu pendengar hashchange');

  // Sudah di Beranda (hash kosong): navigate ke Beranda tidak menambah riwayat.
  store.navigate(HOME_ROUTE);
  ok(env.pushes.length === 0 && calls === 0, 'store: navigate ke rute yang sama tidak menambah entri riwayat');

  store.navigate(track('sql'));
  ok(env.pushes.join() === '#/sql' && env.replaces.length === 0, 'store: navigate biasa menambah entri riwayat (#/sql)');
  ok(calls === 1, 'store: pelanggan diberi tahu SEKETIKA saat navigate (tanpa menunggu hashchange)');
  const sqlRoute = store.getRoute();
  ok(firstDifference(sqlRoute, track('sql')) === null, 'store: rute menjadi jalur sql');
  env.fireHashChange(); // event browser yang menyusul
  ok(store.getRoute() === sqlRoute, 'store: getRoute mengembalikan objek yang SAMA selama hash tidak berubah');

  store.navigate(track('sql'));
  ok(env.pushes.length === 1, 'store: navigate ke hash yang sama diabaikan');

  // replace: replaceState tidak memicu hashchange — store sendiri yang memberi tahu pelanggan.
  const before = calls;
  store.navigate(track('sql', 'ujian'), { replace: true });
  ok(env.replaces.join() === '#/sql/ujian' && env.pushes.length === 1, 'store: replace mengganti entri riwayat, bukan menambah');
  ok(calls === before + 1 && firstDifference(store.getRoute(), track('sql', 'ujian')) === null, 'store: replace memberi tahu pelanggan walau tanpa hashchange');

  // replace boleh merapikan hash yang setara tetapi tidak kanonik.
  env.hash = '#/SQL//ujian/';
  store.navigate(track('sql', 'ujian'), { replace: true });
  ok(env.hash === '#/sql/ujian', 'store: replace merapikan hash yang tidak kanonik');

  // Tombol Kembali / tautan: hash berubah dari luar.
  env.hash = '';
  const beforeBack = calls;
  env.fireHashChange();
  ok(calls === beforeBack + 1 && store.getRoute() === HOME_ROUTE, 'store: perubahan hash dari luar (tombol Kembali) sampai ke pelanggan');

  unsubscribe();
  ok(env.listenerCount === 0, 'store: pelanggan terakhir pergi → pendengar hashchange dilepas');
  const afterUnsubscribe = calls;
  store.navigate(track('sql'));
  ok(calls === afterUnsubscribe, 'store: pelanggan yang sudah berhenti tidak dipanggil lagi');
}

/* ------------------------------------------------------------------ */
/* Registri jalur                                                      */
/* ------------------------------------------------------------------ */

function sourceOf(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');
}

/** Sumber impor STATIS sebuah berkas (import … from '…', export … from '…', import '…'). Impor dinamis tidak ikut. */
function staticImports(source: string): string[] {
  const found: string[] = [];
  const patterns = [/^import\s[^;]*?\sfrom\s+['"]([^'"]+)['"]/gm, /^export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/gm, /^import\s+['"]([^'"]+)['"]/gm];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) if (match[1] !== undefined) found.push(match[1]);
  }
  return found;
}

/** Seperti staticImports, tetapi tanpa `import type …` (dibuang saat kompilasi, tidak ikut ke bundel). */
function runtimeImports(source: string): string[] {
  const withoutTypeImports = source.replace(/^import\s+type\s[^;]*?\sfrom\s+['"][^'"]+['"];?/gm, '');
  return staticImports(withoutTypeImports);
}

/**
 * Semua yang terjangkau lewat impor STATIS dari `entry` = isi bundel awal. Berkas proyek dicatat sebagai path relatif
 * ('src/…'), paket npm sebagai namanya. Impor yang tidak bisa ditemukan berkasnya dicatat dengan awalan '?'.
 */
export function staticClosure(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  const fileAt = (path: string) => existsSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)));
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) continue; // paket npm, CSS, atau impor tak dikenal: tidak ditelusuri
    const dir = file.split('/').slice(0, -1);
    for (const spec of runtimeImports(sourceOf(file))) {
      if (!spec.startsWith('.')) {
        queue.push(spec);
        continue;
      }
      const parts = [...dir];
      for (const part of spec.split('/')) {
        if (part === '..') parts.pop();
        else if (part !== '.' && part !== '') parts.push(part);
      }
      const base = parts.join('/');
      const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((candidate) => /\.[a-z]+$/.test(candidate) && fileAt(candidate));
      queue.push(resolved ?? `?${base}`);
    }
  }
  return [...seen].sort();
}

/**
 * Yang boleh ikut bundel awal (Beranda + shell). Data misi/materi, mesin SQL, komponen jalur, dan modul cadangan hanya
 * boleh dijangkau lewat impor dinamis (manifest.load / manifest.glance / import('…/backupImport')). Menambah modul
 * ringan baru? Daftarkan di sini dengan sadar. Dipakai juga oleh scripts/verify/landing.ts.
 *
 * Berkas proyek: lapisan platform (termasuk landing), dua modul storage ringan, dan penyorot SQL (tokenizer murni +
 * peta kelas warna) yang dipakai jendela kode landing.
 */
export function isLightFile(file: string): boolean {
  return (
    file === 'src/main.tsx' ||
    file === 'src/index.css' ||
    file.startsWith('src/platform/') ||
    file === 'src/lib/storageGuard.ts' ||
    file === 'src/lib/storageKeys.ts' ||
    file === 'src/lib/sqlHighlight.ts' ||
    file === 'src/components/HighlightedCode.tsx'
  );
}

/** Paket npm yang boleh diimpor statis oleh Beranda. cobe dan canvas-confetti SENGAJA tidak ada: keduanya dimuat malas. */
const LIGHT_PACKAGES: readonly string[] = [
  'react',
  'react-dom/client',
  'lucide-react',
  'framer-motion',
  'clsx',
  'tailwind-merge',
  'class-variance-authority',
  'embla-carousel-react',
  'embla-carousel-autoplay',
];
/** Awalan paket yang boleh: primitif Radix dan logo teknologi yang diimpor per ikon (bukan indeks paketnya). */
const LIGHT_PACKAGE_PREFIXES: readonly string[] = ['@radix-ui/react-', '@icons-pack/react-simple-icons/icons/'];

export function isLightPackage(spec: string): boolean {
  return LIGHT_PACKAGES.includes(spec) || LIGHT_PACKAGE_PREFIXES.some((prefix) => spec.startsWith(prefix));
}

async function verifyRegistry(ok: Check): Promise<void> {
  ok(PRODUCT_NAME.trim() !== '' && PRODUCT_TAGLINE.trim() !== '', 'brand: nama produk & tagline tidak boleh kosong');

  const ids = TRACKS.map((t) => t.id);
  ok(new Set(ids).size === ids.length, `registri: id jalur harus unik (${ids.join(', ')})`);
  ok(TRACKS.some((t) => t.status === 'tersedia'), 'registri: minimal satu jalur tersedia');
  const wholeClass = (prefix: string) => new RegExp(`^${prefix}-[a-z]+-\\d{2,3}(/\\d{1,3})?$`);
  for (const t of TRACKS) {
    ok(/^[a-z][a-z0-9-]*$/.test(t.id), `registri: id "${t.id}" harus huruf kecil a-z, angka, atau tanda hubung`);
    ok(!RESERVED_SEGMENTS.includes(t.id), `registri: id "${t.id}" memakai segmen yang dicadangkan`);
    ok(firstDifference(parseRoute(formatRoute(track(t.id))), track(t.id)) === null, `registri: '#/${t.id}' harus terbaca sebagai jalur ${t.id}`);
    ok(getTrack(t.id) === t, `registri: getTrack("${t.id}") harus menemukan jalurnya`);
    ok(t.title.trim() !== '' && t.tagline.trim() !== '' && t.description.trim() !== '', `registri: ${t.id} butuh title, tagline, dan description`);
    ok(t.meta.length > 0 && t.meta.every((m) => m.trim() !== ''), `registri: ${t.id} butuh meta yang tidak kosong`);
    ok(wholeClass('text').test(t.accent.text) && wholeClass('bg').test(t.accent.bg) && wholeClass('border').test(t.accent.border), `registri: accent ${t.id} harus kelas Tailwind utuh (text-…, bg-…, border-…)`);
    if (t.status === 'tersedia') ok(typeof t.load === 'function' && typeof t.glance === 'function', `registri: jalur tersedia "${t.id}" wajib punya load & glance`);
    else ok(t.load === undefined && t.glance === undefined, `registri: jalur segera "${t.id}" tidak boleh punya load/glance`);
  }
  ok(getTrack('tidak-ada') === undefined, 'registri: getTrack id tak dikenal → undefined');

  // Jalur SQL: angka di kartu harus cocok dengan kurikulum, dan glance-nya memang fungsi glance jalur SQL.
  const sql = getTrack('sql');
  ok(sql?.status === 'tersedia', 'registri: jalur sql harus tersedia');
  for (const label of [`${MISSIONS.length} misi`, `${TIERS.length} tier`, `${ARTICLES.length} materi`]) {
    ok(sql?.meta.includes(label) === true, `registri: meta jalur sql harus memuat "${label}" (kurikulum berubah? perbarui src/platform/tracks.ts)`);
  }
  // `load` tidak diuji di sini: komponen jalur butuh browser (WASM, Web Worker).
  const loaded = await sql?.glance?.();
  ok(loaded?.glance === glance, 'registri: glance jalur sql harus memuat src/tracks/sql/glance');

  // Modul platform tetap ringan: tidak ada impor statis ke data jalur.
  const allowed: Record<string, readonly string[]> = {
    'src/platform/tracks.ts': ['react', 'lucide-react'],
    'src/platform/router.ts': ['react'],
    'src/platform/brand.ts': [],
  };
  for (const [file, list] of Object.entries(allowed)) {
    const extra = staticImports(sourceOf(file)).filter((spec) => !list.includes(spec));
    ok(extra.length === 0, `${file} harus tetap ringan — impor statis tak diizinkan: ${extra.join(', ')}`);
  }
  ok(staticImports("import a from './x';\nexport { b } from \"../y\";\nimport 'z';\nconst c = () => import('./dinamis');").join() === './x,../y,z', 'pemeriksa impor statis harus mengenali import/export-from dan mengabaikan impor dinamis');
  ok(runtimeImports("import type { A } from './tipe';\nimport { b, type C } from './nilai';").join() === './nilai', 'pemeriksa impor runtime harus membuang import type tetapi mempertahankan impor nilai');

  // Bundel awal (Beranda + shell): hanya yang lolos isLightFile / isLightPackage di atas.
  const initial = staticClosure('src/main.tsx');
  const heavy = initial.filter((item) => !isLightFile(item) && !isLightPackage(item));
  ok(heavy.length === 0, `bundel awal (impor statis dari src/main.tsx) harus tetap ringan — tidak diizinkan: ${heavy.join(', ')}`);
  for (const must of ['src/platform/PlatformShell.tsx', 'src/platform/Home.tsx', 'src/platform/router.ts', 'src/platform/tracks.ts', 'src/platform/home/useTrackGlance.ts']) {
    ok(initial.includes(must), `penelusur impor statis harus menjangkau ${must} dari src/main.tsx (penelusurnya rusak?)`);
  }
  // Pembanding: penelusur yang sama HARUS menemukan data misi dan sql.js di balik komponen jalur.
  const trackClosure = staticClosure('src/tracks/sql/SqlTrack.tsx');
  ok(trackClosure.includes('sql.js') && trackClosure.some((item) => item.startsWith('src/data/missions')), 'penelusur impor statis harus menemukan sql.js dan data misi di balik src/tracks/sql/SqlTrack.tsx');
}

/* ------------------------------------------------------------------ */
/* Karantina                                                           */
/* ------------------------------------------------------------------ */

const KEY = 'uji:kunci:v1';
const T1 = new Date('2026-11-20T03:00:00.000Z');
const T2 = new Date('2026-11-21T03:00:00.000Z');
const T3 = new Date('2026-11-22T03:00:00.000Z');
const T4 = new Date('2026-11-23T03:00:00.000Z');

function verifyQuarantine(ok: Check): void {
  // (a) Hanya nilai yang ada DAN berisi.
  const blank = new MemoryStorage();
  for (const raw of ['', '   ', 'null', '[]', '{}', '[[],{}]', '{"events":[],"solved":{}}']) {
    ok(isBlankRaw(raw) && !quarantine(blank, KEY, raw, T1), `karantina: nilai tanpa isi ${JSON.stringify(raw)} tidak dikarantina`);
  }
  ok(!quarantine(blank, KEY, null, T1) && !quarantine(blank, KEY, undefined, T1), 'karantina: nilai yang tidak ada tidak dikarantina');
  ok(blank.writes === 0, 'karantina: tidak ada yang tertulis untuk nilai kosong');
  for (const raw of ['{rusak', '0', 'false', '"teks"', '[0]', '{"version":2}']) ok(!isBlankRaw(raw), `karantina: ${JSON.stringify(raw)} dihitung berisi`);

  // (b) Salinan mentah + waktu di kunci turunan.
  const s = new MemoryStorage({ [KEY]: '{rusak' });
  ok(quarantineKey(KEY) === `${KEY}:karantina`, 'karantina: kunci turunan = <kunci>:karantina');
  ok(quarantine(s, KEY, '{rusak', T1), 'karantina: salinan baru harus tertulis');
  ok(firstDifference(readQuarantine(s, KEY), [{ at: T1.toISOString(), raw: '{rusak' }]) === null, 'karantina: slot berisi nilai mentah persis + waktu');
  ok(s.getItem(KEY) === '{rusak' && firstDifference(s.keys(), [KEY, `${KEY}:karantina`]) === null, 'karantina: kunci asli tidak disentuh');

  // (c) Isi sama tidak digandakan; isi berbeda menambah slot; maksimal 3, tertua dibuang.
  ok(!quarantine(s, KEY, '{rusak', T2) && readQuarantine(s, KEY).length === 1, 'karantina: isi yang sama tidak disimpan dua kali');
  ok(readQuarantine(s, KEY)[0]?.at === T1.toISOString(), 'karantina: waktu slot lama tidak berubah saat isi yang sama datang lagi');
  ok(quarantine(s, KEY, 'rusak-2', T2) && quarantine(s, KEY, 'rusak-3', T3), 'karantina: isi berbeda menambah slot');
  ok(readQuarantine(s, KEY).map((slot) => slot.raw).join('|') === '{rusak|rusak-2|rusak-3', 'karantina: slot tersusun tertua → terbaru, yang lama tidak hilang');
  ok(quarantine(s, KEY, 'rusak-4', T4), 'karantina: slot ke-4 tetap diterima');
  ok(MAX_QUARANTINE_SLOTS === 3 && readQuarantine(s, KEY).map((slot) => slot.raw).join('|') === 'rusak-2|rusak-3|rusak-4', 'karantina: maksimal 3 slot, yang tertua dibuang');
  ok(!quarantine(s, KEY, 'rusak-3', T4) && readQuarantine(s, KEY).length === 3, 'karantina: isi yang sudah ada di slot mana pun tidak digandakan');
  // Isi karantina yang tidak terbaca dibungkus, bukan ditimpa.
  const odd = new MemoryStorage({ [quarantineKey(KEY)]: 'catatan lama yang bukan JSON' });
  ok(readQuarantine(odd, KEY).length === 0, 'karantina: isi karantina tak terbaca → daftar kosong (tidak melempar)');
  ok(quarantine(odd, KEY, '{rusak', T1), 'karantina: tetap bisa menulis di atas isi karantina tak terbaca');
  ok(readQuarantine(odd, KEY).map((slot) => slot.raw).join('|') === 'catatan lama yang bukan JSON|{rusak', 'karantina: isi karantina tak terbaca dibungkus sebagai slot, tidak dibuang');

  // (d) Kegagalan storage tidak melempar.
  const full = new MemoryStorage({ [KEY]: '{rusak' });
  full.failWrites = true;
  let threw = false;
  try {
    ok(!quarantine(full, KEY, '{rusak', T1), 'karantina: kuota penuh → false');
    ok(readGuarded(full, KEY, () => null, undefined, T1) === null, 'karantina: readGuarded tetap mengembalikan null saat kuota penuh');
    const blocked = new MemoryStorage({ [KEY]: '{rusak' });
    blocked.failReads = true;
    ok(!quarantine(blocked, KEY, '{rusak', T1) && readQuarantine(blocked, KEY).length === 0 && lastQuarantinedAt(blocked, [KEY]) === null, 'karantina: storage yang diblokir → tanpa hasil');
    ok(readGuarded(blocked, KEY, (raw) => raw, undefined, T1) === null && readGuarded(null, KEY, (raw) => raw) === null, 'karantina: readGuarded tanpa storage → null');
  } catch {
    threw = true;
  }
  ok(!threw, 'karantina: kegagalan storage tidak boleh melempar');
  // Kuota penuh tidak merusak karantina yang sudah ada.
  s.failWrites = true;
  ok(!quarantine(s, KEY, 'rusak-5', T4) && readQuarantine(s, KEY).length === 3, 'karantina: gagal menulis tidak menghapus slot yang ada');
  s.failWrites = false;

  // (e) Kapan terakhir dikarantina.
  ok(lastQuarantinedAt(new MemoryStorage(), [KEY]) === null, 'karantina: belum pernah → null');
  ok(lastQuarantinedAt(s, [KEY]) === T4.toISOString(), 'karantina: waktu terbaru dari satu kunci');
  const multi = new MemoryStorage();
  quarantine(multi, 'a', 'x', T3);
  quarantine(multi, 'b', 'y', T1);
  ok(lastQuarantinedAt(multi, ['a', 'b']) === T3.toISOString() && lastQuarantinedAt(multi, ['b']) === T1.toISOString() && lastQuarantinedAt(multi, ['c']) === null, 'karantina: waktu terbaru di antara beberapa kunci');

  // readGuarded: nilai valid tidak pernah dikarantina; yang ditolak/menjadi kosong dikarantina.
  const g = new MemoryStorage({ valid: '[1,2]', rusak: '[1,2', kosong: '[]', disaring: '["x"]' });
  const parseList = (raw: string) => (JSON.parse(raw) as unknown[]).filter((v): v is number => typeof v === 'number');
  const isEmpty = (list: number[]) => list.length === 0;
  ok(readGuarded(g, 'tidak-ada', parseList, isEmpty, T1) === null && g.writes === 0, 'readGuarded: kunci tidak ada → null, tanpa karantina');
  ok(firstDifference(readGuarded(g, 'valid', parseList, isEmpty, T1), [1, 2]) === null && g.writes === 0, 'readGuarded: nilai valid dikembalikan, tanpa karantina');
  ok(firstDifference(readGuarded(g, 'kosong', parseList, isEmpty, T1), []) === null && g.writes === 0, 'readGuarded: nilai yang memang kosong tidak dikarantina');
  ok(readGuarded(g, 'rusak', parseList, isEmpty, T1) === null && readQuarantine(g, 'rusak')[0]?.raw === '[1,2', 'readGuarded: parser melempar → null + karantina');
  ok(firstDifference(readGuarded(g, 'disaring', parseList, isEmpty, T1), []) === null && readQuarantine(g, 'disaring')[0]?.raw === '["x"]', 'readGuarded: semua isi ditolak parser → hasil kosong + karantina');
}

/** Jalankan `fn` dengan `storage` sebagai localStorage global (pemuat aplikasi membaca global itu). */
function withLocalStorage<T>(storage: MemoryStorage, fn: () => T): T {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  try {
    return fn();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

const SAMPLE_PROGRESS: UserProgress = {
  ...createEmptyProgress(),
  xp: 50,
  streak: { current: 1, best: 1, lastActiveDate: '2026-11-20' },
  missions: { 't1-select': { completed: true, earnedXp: 50, hintUsed: false, hintsRevealed: 0, solutionShown: false, attempts: 1, completedAt: '2026-11-20T03:00:00.000Z' } },
  lastMissionId: 't1-select',
};

function verifyLoaders(ok: Check): void {
  // Progres (wajib): rusak → progres kosong + karantina; penyimpanan berikutnya menimpa kunci asli, karantina tetap.
  for (const raw of ['{"version":1,"xp":50,"str', JSON.stringify({ version: 2, xp: 50 }), JSON.stringify({ ...SAMPLE_PROGRESS, xp: -1 })]) {
    const s = new MemoryStorage({ [PROGRESS_KEY]: raw });
    withLocalStorage(s, () => {
      ok(firstDifference(loadProgress(), createEmptyProgress()) === null, `loadProgress: ${raw.slice(0, 24)}… → progres kosong`);
      ok(readQuarantine(s, PROGRESS_KEY)[0]?.raw === raw, `loadProgress: ${raw.slice(0, 24)}… harus dikarantina sebelum aplikasi lanjut`);
      loadProgress(); // StrictMode / event storage memanggilnya lagi
      ok(readQuarantine(s, PROGRESS_KEY).length === 1, 'loadProgress: pemanggilan ulang tidak menggandakan karantina');
      saveProgress(createEmptyProgress());
      ok(s.getItem(PROGRESS_KEY) === JSON.stringify(createEmptyProgress()) && readQuarantine(s, PROGRESS_KEY)[0]?.raw === raw, 'loadProgress: setelah kunci asli tertimpa, salinan rusaknya masih ada di karantina');
    });
  }
  const valid = new MemoryStorage({ [PROGRESS_KEY]: JSON.stringify(SAMPLE_PROGRESS) });
  withLocalStorage(valid, () => {
    ok(firstDifference(loadProgress(), SAMPLE_PROGRESS) === null && valid.writes === 0, 'loadProgress: progres valid dibaca utuh, tanpa menulis apa pun');
  });
  const fresh = new MemoryStorage();
  withLocalStorage(fresh, () => {
    ok(firstDifference(loadProgress(), createEmptyProgress()) === null && fresh.writes === 0, 'loadProgress: pengguna baru → progres kosong, tanpa karantina');
  });
  ok(firstDifference(loadProgress(), createEmptyProgress()) === null, 'loadProgress: tanpa localStorage (Node) → progres kosong');

  // Pemuat lain yang membuang SELURUH nilai: hasilnya sama seperti sebelumnya, ditambah karantina.
  const event = { missionId: 't1-where', kind: 'rows-missing', at: '2026-11-20T03:00:00.000Z' };
  const card = { box: 1, due: '2026-11-23', reviews: 1, lapses: 0 };
  const record = { id: 'ujian-x', purpose: 'exam', startedAt: '2026-11-20T03:00:00.000Z', finishedAt: '2026-11-20T03:10:00.000Z', timedOut: false, config: { tiers: [1], count: 1, minutes: null }, items: [] };
  const loaders: Array<{ name: string; key: string; read: () => unknown; size: (value: unknown) => number; valid: string; empty: string; broken: string[] }> = [
    {
      name: 'riwayat kesalahan',
      key: MISTAKES_KEY,
      read: readStoredMistakes,
      size: (v) => (v as { events: unknown[] }).events.length,
      valid: JSON.stringify({ events: [event], solved: {} }),
      empty: JSON.stringify({ events: [], solved: {} }),
      broken: ['{"events":[{"missionId"', '"teks"', JSON.stringify({ events: [{ ...event, kind: 'jenis-yang-dihapus' }], solved: {} })],
    },
    {
      name: 'materi dibaca',
      key: ARTICLE_READS_KEY,
      read: readStoredArticleReads,
      size: (v) => (v as ReadonlySet<string>).size,
      valid: JSON.stringify(['select']),
      empty: '[]',
      broken: ['["select",', JSON.stringify({ select: true }), '[1,2,3]'],
    },
    {
      name: 'jadwal latihan ulang',
      key: REVIEW_KEY,
      read: readStoredDeck,
      size: (v) => Object.keys(v as object).length,
      valid: JSON.stringify({ 't1-select': card }),
      empty: '{}',
      broken: ['{"t1-select":{"box":1', JSON.stringify([card]), JSON.stringify({ 't1-select': { ...card, box: 99 } })],
    },
    {
      name: 'riwayat ujian',
      key: EXAM_HISTORY_KEY,
      read: readStoredHistory,
      size: (v) => (v as unknown[]).length,
      valid: JSON.stringify([record]),
      empty: '[]',
      broken: ['[{"id":"ujian-x"', JSON.stringify({ 0: record }), JSON.stringify([{ ...record, startedAt: 'kapan' }])],
    },
  ];
  for (const loader of loaders) {
    ok(SQL_GUARDED_KEYS.includes(loader.key), `${loader.name}: kuncinya harus terdaftar di SQL_GUARDED_KEYS`);
    for (const raw of [loader.valid, loader.empty]) {
      const s = new MemoryStorage({ [loader.key]: raw });
      const size = withLocalStorage(s, () => loader.size(loader.read()));
      ok(size === (raw === loader.valid ? 1 : 0) && s.writes === 0, `${loader.name}: nilai ${raw === loader.valid ? 'valid' : 'kosong'} dibaca apa adanya, tanpa karantina`);
    }
    for (const raw of loader.broken) {
      const s = new MemoryStorage({ [loader.key]: raw });
      const size = withLocalStorage(s, () => {
        loader.read();
        return loader.size(loader.read());
      });
      ok(size === 0, `${loader.name}: ${raw.slice(0, 24)}… → kosong (perilaku lama)`);
      ok(readQuarantine(s, loader.key).length === 1 && readQuarantine(s, loader.key)[0]?.raw === raw, `${loader.name}: ${raw.slice(0, 24)}… harus dikarantina (sekali)`);
    }
    const fresh2 = new MemoryStorage();
    withLocalStorage(fresh2, () => loader.read());
    ok(fresh2.writes === 0, `${loader.name}: kunci belum ada → tanpa karantina`);
  }
  // Sesi ujian, lipatan brief, dan lencana terlihat sengaja tidak dijaga.
  ok(SQL_GUARDED_KEYS.length === 5 && !SQL_GUARDED_KEYS.includes(EXAM_SESSION_KEY) && SQL_GUARDED_KEYS.every((key) => SQL_TRACK_KEYS.includes(key)), 'karantina: hanya 5 kunci data pengguna yang dijaga (sesi ujian tidak)');
}

/* ------------------------------------------------------------------ */
/* Resume                                                              */
/* ------------------------------------------------------------------ */

const DONE = { completed: true, earnedXp: 0, hintUsed: false, hintsRevealed: 0, solutionShown: false, attempts: 1, completedAt: '2026-11-20T03:00:00.000Z' };

function progressWith(done: readonly Mission[], lastMissionId: string | null = null): UserProgress {
  return { ...createEmptyProgress(), missions: Object.fromEntries(done.map((m) => [m.id, DONE])), lastMissionId };
}

function verifyResume(ok: Check): void {
  const sorted = [...MISSIONS].sort((a, b) => a.order - b.order);
  const first = requireFirstMission(MISSIONS);
  const second = sorted[1];
  ok(first.id === sorted[0]?.id && first.kind !== 'concept', 'resume: misi pertama = order terkecil');

  // Pengguna baru → misi pertama, bukan kartu konsep yang selalu terbuka.
  const empty = createEmptyProgress();
  ok(pickInitialMissionId(MISSIONS, empty) === first.id, 'resume: pengguna baru mulai dari misi pertama');
  ok(findPendingMission(MISSIONS, empty)?.id === first.id, 'resume: misi tertunda pengguna baru = misi pertama');
  ok(MISSIONS.some((m) => m.kind === 'concept'), 'resume: kurikulum punya kartu konsep (dasar pemeriksaan berikut)');

  // lastMissionId: dipakai bila terbuka (walau sudah selesai), diabaikan bila terkunci / tidak dikenal.
  const locked = sorted.find((m) => m.kind !== 'concept' && m.order > 2);
  ok(locked !== undefined && pickInitialMissionId(MISSIONS, { ...empty, lastMissionId: locked?.id ?? '' }) === first.id, 'resume: lastMissionId yang masih terkunci diabaikan');
  ok(pickInitialMissionId(MISSIONS, { ...empty, lastMissionId: 'misi-yang-sudah-dihapus' }) === first.id, 'resume: lastMissionId yang tidak dikenal diabaikan');
  ok(pickInitialMissionId(MISSIONS, progressWith([first], first.id)) === first.id, 'resume: lastMissionId yang terbuka dipakai walau misinya sudah selesai');
  ok(second !== undefined && pickInitialMissionId(MISSIONS, progressWith([first])) === second?.id, 'resume: tanpa lastMissionId → misi terbuka pertama yang belum selesai');
  ok(findPendingMission(MISSIONS, progressWith([first]), second?.id)?.id !== second?.id, 'resume: excludeId dilewati');

  // Semua tuntas → tidak ada yang tertunda; misi awal tetap terdefinisi.
  const all = progressWith(MISSIONS);
  ok(findPendingMission(MISSIONS, all) === undefined, 'resume: semua misi tuntas → findPendingMission undefined');
  ok(pickInitialMissionId(MISSIONS, all) === first.id, 'resume: semua tuntas tanpa lastMissionId → misi pertama');
  const last = sorted[sorted.length - 1];
  ok(pickInitialMissionId(MISSIONS, { ...all, lastMissionId: last?.id ?? null }) === last?.id, 'resume: semua tuntas → tetap membuka lastMissionId');

  // Tinggal kartu konsep → kartu konsep itulah yang tertunda (bukan undefined).
  const onlyConceptsLeft = progressWith(MISSIONS.filter((m) => m.kind !== 'concept'));
  ok(findPendingMission(MISSIONS, onlyConceptsLeft)?.kind === 'concept', 'resume: bila hanya kartu konsep tersisa, kartu konsep yang ditawarkan');

  let threw = false;
  try {
    requireFirstMission([]);
  } catch {
    threw = true;
  }
  ok(threw, 'resume: daftar misi kosong harus melempar (kurikulum tidak boleh kosong)');
}

/* ------------------------------------------------------------------ */
/* Glance                                                              */
/* ------------------------------------------------------------------ */

function blockedStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  storage.failReads = true;
  return storage;
}

function verifyGlance(ok: Check): void {
  const now = new Date(2026, 10, 23, 12, 0, 0);
  const first = requireFirstMission(MISSIONS);

  const empty = new MemoryStorage();
  const fresh = glance(empty, now);
  ok(
    !fresh.started && fresh.completed === 0 && fresh.total === MISSIONS.length && fresh.xp === 0 && fresh.rank.title === 'IT Intern' && fresh.reviewDue === 0 && fresh.exam === null && fresh.weakness === null && fresh.quarantinedAt === null,
    `glance: storage kosong → ringkasan pengguna baru (dapat ${JSON.stringify(fresh)})`,
  );
  ok(fresh.resume?.missionId === first.id && fresh.resume.order === first.order && fresh.resume.title === first.title && fresh.resume.tierLabel.startsWith(`Tier ${first.tier}`), 'glance: pengguna baru "melanjutkan" dari misi pertama');
  ok(firstDifference(fresh.streak, { active: 0, best: 0, activeToday: false }) === null, 'glance: pengguna baru tanpa streak');
  ok(empty.writes === 0, 'glance: tidak menulis ke storage kosong');

  // Storage rusak di SEMUA kunci: tidak melempar, sama seperti pengguna baru, dan tidak mengkarantina (hanya membaca).
  const garbage = ['{rusak', 'null', '[1,2', '"teks"', '42', '{"version":9}', '[[]]', ''];
  const broken = new MemoryStorage(Object.fromEntries(SQL_TRACK_KEYS.map((key, i) => [key, garbage[i % garbage.length] ?? '{rusak'])));
  let result: ReturnType<typeof glance> | null = null;
  try {
    result = glance(broken, now);
  } catch {
    result = null;
  }
  ok(result !== null, 'glance: storage rusak tidak boleh melempar');
  ok(result !== null && firstDifference(result, fresh) === null, 'glance: storage rusak → sama dengan pengguna baru (started=false, quarantinedAt=null)');
  ok(broken.writes === 0 && broken.keys().length === SQL_TRACK_KEYS.length, 'glance: storage rusak tidak ditulis (karantina adalah tugas pemuat/penjaga, bukan glance)');

  // Penjaga data (dijalankan Beranda sebelum glance pertama): mengkarantina SETIAP kunci yang dijaga bila nilainya
  // tidak terbaca, tanpa mengubah kunci aslinya; data valid/kosong tidak disentuh; tidak pernah melempar.
  const rotten = new MemoryStorage(Object.fromEntries(SQL_TRACK_KEYS.map((key) => [key, '{rusak'])));
  guard(rotten, T2);
  for (const key of SQL_GUARDED_KEYS) {
    const slots = readQuarantine(rotten, key);
    ok(slots.length === 1 && slots[0]?.raw === '{rusak', `guard: nilai rusak di ${key} harus disalin ke karantina`);
    ok(rotten.getItem(key) === '{rusak', `guard: kunci asli ${key} tidak boleh diubah`);
  }
  ok(rotten.keys().length === SQL_TRACK_KEYS.length + SQL_GUARDED_KEYS.length, 'guard: hanya menambah kunci karantina untuk kunci yang dijaga');
  ok(glance(rotten, now).quarantinedAt === T2.toISOString(), 'guard → glance: karantina dari penjaga terbaca sebagai quarantinedAt');
  const writesAfterFirst = rotten.writes;
  guard(rotten, T3);
  ok(rotten.writes === writesAfterFirst, 'guard: dijalankan ulang pada isi yang sama tidak menulis lagi');
  const healthy = new MemoryStorage({ [PROGRESS_KEY]: JSON.stringify(progressWith(MISSIONS.slice(0, 3))), [REVIEW_KEY]: '{}', [SQL_GUARDED_KEYS[1] ?? '']: '{"events":[],"solved":{}}' });
  guard(healthy, T2);
  guard(new MemoryStorage(), T2);
  ok(healthy.writes === 0, 'guard: data valid atau kosong tidak dikarantina');
  let guardThrew = false;
  try {
    guard(blockedStorage(), T2);
    const full = new MemoryStorage({ [PROGRESS_KEY]: '{rusak' });
    full.failWrites = true;
    guard(full, T2);
  } catch {
    guardThrew = true;
  }
  ok(!guardThrew, 'guard: storage yang diblokir / penuh tidak boleh membuatnya melempar');

  const blocked = new MemoryStorage();
  blocked.failReads = true;
  let blockedOk = true;
  try {
    blockedOk = firstDifference(glance(blocked, now), fresh) === null;
  } catch {
    blockedOk = false;
  }
  ok(blockedOk, 'glance: storage yang diblokir → ringkasan pengguna baru, tanpa melempar');

  // Karantina yang dibuat pemuat terbaca oleh glance.
  quarantine(broken, PROGRESS_KEY, '{rusak', T2);
  quarantine(broken, REVIEW_KEY, '[1,2', T3);
  ok(glance(broken, now).quarantinedAt === T3.toISOString(), 'glance: quarantinedAt = waktu karantina terbaru di kunci jalur SQL');

  // started: ada entri misi ATAU xp > 0. Semua tuntas → resume null.
  const attempted = { ...createEmptyProgress(), missions: { [first.id]: { ...DONE, completed: false, completedAt: null, attempts: 2 } } };
  ok(glance(new MemoryStorage({ [PROGRESS_KEY]: JSON.stringify(attempted) }), now).started, 'glance: satu percobaan saja sudah dihitung "mulai"');
  ok(glance(new MemoryStorage({ [PROGRESS_KEY]: JSON.stringify({ ...createEmptyProgress(), xp: 10 }) }), now).started, 'glance: xp > 0 dihitung "mulai"');
  const allDone = glance(new MemoryStorage({ [PROGRESS_KEY]: JSON.stringify(progressWith(MISSIONS)) }), now);
  ok(allDone.resume === null && allDone.completed === MISSIONS.length && allDone.started, 'glance: semua misi tuntas → resume null');
}

export async function verifyPlatform(): Promise<void> {
  let checks = 0;
  const ok: Check = (cond, msg) => {
    checks += 1;
    assert(cond, `platform: ${msg}`);
  };
  verifyRouterPure(ok);
  verifyRouteStore(ok);
  await verifyRegistry(ok);
  verifyQuarantine(ok);
  verifyLoaders(ok);
  verifyResume(ok);
  verifyGlance(ok);
  console.log(`  ${checks} pemeriksaan platform (router, registri, karantina, resume, glance) ✓`);
}
