/**
 * Pengumpul pasangan warna teks/latar dari KODE layar jalur (untuk scripts/verify/theme.ts).
 *
 * Membaca berkas TSX/TS dengan TypeScript compiler API, lalu untuk setiap elemen JSX yang punya kelas warna teks
 * (text-<palet>-<shade>[/alfa], text-white/black) menyusun latar efektifnya: bg milik elemen itu sendiri, lalu bg
 * leluhur JSX terdekat, sampai latar padat (alfa 1). Bila rantai habis tanpa latar padat, dipakai dua latar cadangan:
 * halaman (slate-950) dan panel (slate-900/60 di atas halaman) — komponen bisa dirender di salah satunya.
 *
 * Yang ikut dihitung:
 * - alternatif className (cabang ?:, &&, template literal, cn()/clsx(), konstanta string & peta objek di berkas yang
 *   sama) → setiap kombinasi menjadi pasangan tersendiri;
 * - keadaan interaktif (hover:, focus:, aria-*:, group-hover:, …): warna keadaan itu, atau warna dasar bila tidak ada;
 * - varian `light:` (hanya tema terang) mengganti warna dasar/keadaan yang sama di tema terang;
 * - opacity-NN pada elemen & leluhur (mengurangi alfa teks; `light:opacity-NN` menggantinya di tema terang), ukuran &
 *   tebal huruf (teks besar → 3:1);
 * - ikon lucide (komponen ber-className di tag yang diimpor dari lucide-react atau bernama *Icon) → non-teks 3:1;
 * - garis fokus (focus*:outline-*, focus*:ring-*) terhadap latar induk → 3:1; placeholder: → 4.5:1;
 * - di luar JSX: string yang memuat kelas text- DAN bg- sekaligus, dan objek literal yang properti-propertinya memuat
 *   kelas text- dan bg- (peta gaya seperti mismatchStyle.ts) → dipasangkan seolah teks di atas latar itu.
 *
 * Kelas `disabled:`, `selection:`, `before:`/`after:` dan varian arbitrer `[&…]` diabaikan. Hasilnya perkiraan statis;
 * pemindai di halaman (scripts/e2e/contrast.ts) adalah pemeriksaan visual yang sebenarnya.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const THEMED = ['slate', 'emerald', 'amber', 'rose', 'sky', 'cyan', 'teal', 'violet', 'orange', 'yellow', 'fuchsia'] as const;
/** Semua palet bawaan Tailwind 3 (untuk mendeteksi palet yang TIDAK berbasis variabel). */
export const TAILWIND_PALETTES = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'] as const;

/** Berkas layar jalur yang diperiksa (relatif ke akar repo). */
export const TRACK_SCOPE = ['src/App.tsx', 'src/components', 'src/tracks', 'src/platform/screens.tsx', 'src/platform/BrandMark.tsx'];

export interface ColorRef {
  /** 'slate-300', 'white', 'black', 'transparent', 'current' */
  name: string;
  alpha: number;
}

export type PairKind = 'text' | 'icon' | 'placeholder' | 'focus';

export interface ThemeSide {
  fg: ColorRef;
  /** Lapisan latar dari yang paling dalam (elemen sendiri) ke luar; lapisan terakhir padat. */
  bg: ColorRef[];
  /** Pengali alfa dari opacity-NN elemen/leluhur. */
  opacity: number;
}

export interface ClassPair {
  file: string;
  line: number;
  kind: PairKind;
  /** '' = keadaan dasar; selain itu nama keadaan (hover, focus-visible, aria-pressed, …). */
  state: string;
  large: boolean;
  min: number;
  dark: ThemeSide;
  light: ThemeSide;
  /** Kunci yang mudah dibaca dan stabil (tanpa nomor baris): "text-slate-500 @ bg-slate-800/60 > bg-slate-950". */
  key: string;
}

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function readRepo(relative: string): string {
  return readFileSync(ROOT + relative, 'utf8');
}

export function trackFiles(scope: readonly string[] = TRACK_SCOPE): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    const st = statSync(ROOT + rel);
    if (st.isDirectory()) for (const name of readdirSync(ROOT + rel)) walk(`${rel}/${name}`);
    else if (/\.(tsx?|css)$/.test(rel)) out.push(rel);
  };
  for (const s of scope) walk(s);
  return out.sort();
}

/* ------------------------------------------------------------------ */
/* Token kelas                                                         */
/* ------------------------------------------------------------------ */

const COLOR_RE = new RegExp(
  `^(text|bg|border(?:-[trblxy])?|ring-offset|ring|outline|from|via|to|fill|stroke|divide|placeholder|accent|caret|decoration|shadow)-(${TAILWIND_PALETTES.join('|')}|white|black|transparent|current|inherit)(?:-(\\d{2,3}))?(?:\\/(\\d{1,3}|\\[[\\d.]+\\]))?$`,
);
const RESPONSIVE = /^(sm|md|lg|xl|2xl|max-\w+|min-\[.*\]|portrait|landscape|motion-safe|motion-reduce|contrast-more)$/;
const STRUCTURAL = /^(first|last|odd|even|only|first-of-type|last-of-type|empty)$/;
const STATE = /^(hover|focus|focus-visible|focus-within|active|visited|checked|open|enabled|group-hover|group-focus|group-focus-within|peer-checked|peer-focus|aria-[\w-]+|data-\[.*\]|group-aria-[\w-]+|group-data-\[.*\])$/;
const SKIP = /^(disabled|selection|file|marker|before|after|first-letter|first-line|backdrop|print|dark|rtl|ltr|read-only|invalid|required|indeterminate|default|autofill|target|placeholder-shown|group-disabled|peer-disabled|aria-disabled|supports-.*|\[.*\]|\*)$/;

export interface ParsedClass {
  util: string;
  light: boolean;
  /** '' dasar; nama keadaan; 'placeholder' */
  state: string;
  skip: boolean;
}

export function splitVariants(token: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of token) {
    if (ch === '[') depth += 1;
    if (ch === ']') depth -= 1;
    if (ch === ':' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

export function parseClass(token: string): ParsedClass {
  const parts = splitVariants(token.replace(/^!/, ''));
  const util = (parts.pop() ?? '').replace(/^!/, '');
  let light = false;
  let state = '';
  let skip = false;
  for (const v of parts) {
    if (v === 'light') light = true;
    else if (v === 'placeholder') state = 'placeholder';
    else if (RESPONSIVE.test(v) || STRUCTURAL.test(v)) continue;
    else if (STATE.test(v)) state = state === '' ? v : `${state}:${v}`;
    else if (SKIP.test(v)) skip = true;
    else skip = true; // varian tak dikenal: jangan ditebak
  }
  return { util, light, state, skip };
}

export interface ColorUtil {
  prop: string;
  color: ColorRef;
}

export function colorUtil(util: string): ColorUtil | null {
  const m = COLOR_RE.exec(util);
  if (!m) return null;
  const [, prop = '', palette = '', shade, alphaRaw] = m;
  const special = ['white', 'black', 'transparent', 'current', 'inherit'].includes(palette);
  if (!special && shade === undefined) return null;
  if (special && shade !== undefined) return null;
  let alpha = 1;
  if (alphaRaw !== undefined) alpha = alphaRaw.startsWith('[') ? Number(alphaRaw.slice(1, -1)) : Number(alphaRaw) / 100;
  if (palette === 'transparent') alpha = 0;
  return { prop: prop.replace(/^border-[trblxy]$/, 'border'), color: { name: special ? palette : `${palette}-${shade}`, alpha } };
}

const SIZE: Record<string, number> = { 'text-xs': 12, 'text-sm': 14, 'text-base': 16, 'text-lg': 18, 'text-xl': 20, 'text-2xl': 24, 'text-3xl': 30, 'text-4xl': 36, 'text-5xl': 48 };
const WEIGHT: Record<string, number> = { 'font-thin': 100, 'font-light': 300, 'font-normal': 400, 'font-medium': 500, 'font-semibold': 600, 'font-bold': 700, 'font-extrabold': 800, 'font-black': 900 };

function sizeOf(util: string): number | null {
  if (util in SIZE) return SIZE[util] ?? null;
  const px = /^text-\[(\d+(?:\.\d+)?)px\]$/.exec(util);
  if (px) return Number(px[1]);
  const rem = /^text-\[(\d+(?:\.\d+)?)rem\]$/.exec(util);
  return rem ? Number(rem[1]) * 16 : null;
}

/* ------------------------------------------------------------------ */
/* Alternatif className dari ekspresi                                  */
/* ------------------------------------------------------------------ */

const MAX_ALTS = 48;

function cartesian(lists: string[][]): string[] {
  let acc = [''];
  for (const list of lists) {
    const next: string[] = [];
    for (const a of acc) for (const b of list.length > 0 ? list : ['']) next.push(`${a} ${b}`);
    acc = [...new Set(next)].slice(0, MAX_ALTS);
  }
  return acc;
}

interface FileCtx {
  sf: ts.SourceFile;
  consts: Map<string, ts.Expression>;
  icons: Set<string>;
}

function objectStrings(obj: ts.ObjectLiteralExpression, ctx: FileCtx, prop: string | null, depth = 0): string[] {
  const out: string[] = [];
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const name = p.name.getText(ctx.sf).replace(/['"]/g, '');
    const init = p.initializer;
    if (ts.isObjectLiteralExpression(init) && depth < 2) out.push(...objectStrings(init, ctx, prop, depth + 1));
    else if (prop === null || name === prop) out.push(...alternatives(init, ctx, depth + 1));
  }
  return out;
}

function resolveObject(expr: ts.Expression, ctx: FileCtx): ts.ObjectLiteralExpression | null {
  let e: ts.Expression = expr;
  while (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) e = e.expression;
  if (ts.isIdentifier(e)) {
    let init = ctx.consts.get(e.text);
    while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init) || ts.isParenthesizedExpression(init))) init = init.expression;
    if (init && ts.isObjectLiteralExpression(init)) return init;
  }
  return null;
}

export function alternatives(expr: ts.Expression, ctx: FileCtx, depth = 0): string[] {
  if (depth > 8) return [''];
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr.text];
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isNonNullExpression(expr)) return alternatives(expr.expression, ctx, depth + 1);
  if (ts.isTemplateExpression(expr)) {
    const lists: string[][] = [[expr.head.text]];
    for (const span of expr.templateSpans) {
      lists.push(alternatives(span.expression, ctx, depth + 1));
      lists.push([span.literal.text]);
    }
    return cartesian(lists);
  }
  if (ts.isConditionalExpression(expr)) return [...new Set([...alternatives(expr.whenTrue, ctx, depth + 1), ...alternatives(expr.whenFalse, ctx, depth + 1)])];
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return [...alternatives(expr.right, ctx, depth + 1), ''];
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return [...new Set([...alternatives(expr.left, ctx, depth + 1), ...alternatives(expr.right, ctx, depth + 1)])];
    if (op === ts.SyntaxKind.PlusToken) return cartesian([alternatives(expr.left, ctx, depth + 1), alternatives(expr.right, ctx, depth + 1)]);
    return [''];
  }
  if (ts.isCallExpression(expr)) {
    const lists = expr.arguments.map((a) => (ts.isObjectLiteralExpression(a) ? [''] : alternatives(a, ctx, depth + 1)));
    // Argumen .join(' ') pada array literal: gabungkan isinya.
    if (ts.isPropertyAccessExpression(expr.expression) && expr.expression.name.text === 'join' && ts.isArrayLiteralExpression(expr.expression.expression)) {
      return cartesian(expr.expression.expression.elements.map((el) => alternatives(el, ctx, depth + 1)));
    }
    return cartesian(lists);
  }
  if (ts.isIdentifier(expr)) {
    const init = ctx.consts.get(expr.text);
    return init ? alternatives(init, ctx, depth + 1) : [''];
  }
  if (ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr)) {
    const obj = resolveObject(expr, ctx);
    if (!obj) return [''];
    const prop = ts.isPropertyAccessExpression(expr) ? expr.name.text : null;
    const strings = objectStrings(obj, ctx, prop, 0);
    return strings.length > 0 ? [...new Set(strings)].slice(0, MAX_ALTS) : [''];
  }
  return [''];
}

/* ------------------------------------------------------------------ */
/* Model elemen                                                        */
/* ------------------------------------------------------------------ */

interface Cand {
  color: ColorRef;
  light: boolean;
  state: string;
}

interface ElementModel {
  text: Cand[];
  bg: Cand[];
  placeholder: Cand[];
  focus: Cand[];
  size: number | null;
  weight: number | null;
  opacity: number;
  /** `light:opacity-NN` (null = sama dengan opacity). */
  opacityLight: number | null;
}

function model(classes: string): ElementModel {
  const m: ElementModel = { text: [], bg: [], placeholder: [], focus: [], size: null, weight: null, opacity: 1, opacityLight: null };
  let gradient = false;
  const from: Cand[] = [];
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    const p = parseClass(token);
    if (p.skip) continue;
    if (/^bg-gradient-to-/.test(p.util)) gradient = true;
    if (p.state === '' && !p.light) {
      const s = sizeOf(p.util);
      if (s !== null) m.size = s;
      if (p.util in WEIGHT) m.weight = WEIGHT[p.util] ?? null;
      const op = /^opacity-(\d+)$/.exec(p.util);
      if (op) m.opacity = Number(op[1]) / 100;
    }
    if (p.state === '' && p.light) {
      const op = /^opacity-(\d+)$/.exec(p.util);
      if (op) m.opacityLight = Number(op[1]) / 100;
    }
    const c = colorUtil(p.util);
    if (!c) continue;
    const cand: Cand = { color: c.color, light: p.light, state: p.state };
    if (p.state === 'placeholder') {
      if (c.prop === 'text' || c.prop === 'placeholder') m.placeholder.push({ ...cand, state: '' });
      continue;
    }
    if (c.prop === 'placeholder') m.placeholder.push(cand);
    else if (c.prop === 'text') m.text.push(cand);
    else if (c.prop === 'bg') m.bg.push(cand);
    else if (c.prop === 'from') from.push(cand);
    else if ((c.prop === 'outline' || c.prop === 'ring') && /focus/.test(p.state)) m.focus.push({ ...cand, state: '' });
  }
  // Latar gradien: titik awalnya dipakai sebagai perkiraan latar.
  if (gradient && m.bg.length === 0) m.bg.push(...from);
  return m;
}

function pick(list: Cand[], theme: 'dark' | 'light', state: string): Cand[] {
  const at = (s: string) => {
    const lightOnes = theme === 'light' ? list.filter((c) => c.light && c.state === s) : [];
    return lightOnes.length > 0 ? lightOnes : list.filter((c) => !c.light && c.state === s);
  };
  const exact = at(state);
  return exact.length > 0 ? exact : state === '' ? [] : at('');
}

const PAGE: ColorRef = { name: 'slate-950', alpha: 1 };
const PANEL: ColorRef = { name: 'slate-900', alpha: 0.6 };
const FALLBACKS: ColorRef[][] = [[PAGE], [PANEL, PAGE]];

interface Frame {
  alts: ElementModel[];
}

const spec = (c: ColorRef, prefix: string) => `${prefix}-${c.name}${c.alpha < 1 && c.alpha > 0 ? `/${Math.round(c.alpha * 100)}` : ''}`;

/** Rantai latar untuk satu tema: lapisan elemen + leluhur (keadaan dasar) sampai padat, lalu cadangan. */
function chains(own: Cand[][], ancestors: Frame[], theme: 'dark' | 'light'): ColorRef[][] {
  // own: pilihan latar elemen ini (sudah dipilih per keadaan); [] = tidak ada.
  let partial: ColorRef[][] = own.length > 0 ? own.map((cs) => cs.map((c) => c.color)) : [[]];
  const done: ColorRef[][] = [];
  const isSolid = (chain: ColorRef[]) => chain.length > 0 && (chain[chain.length - 1]?.alpha ?? 0) >= 1;
  for (const chain of partial) if (isSolid(chain)) done.push(chain);
  partial = partial.filter((c) => !isSolid(c));
  for (const frame of ancestors) {
    if (partial.length === 0) break;
    const options = new Map<string, ColorRef>();
    for (const alt of frame.alts) for (const c of pick(alt.bg, theme, '')) options.set(spec(c.color, 'bg'), c.color);
    if (options.size === 0) continue;
    const next: ColorRef[][] = [];
    for (const chain of partial) for (const color of options.values()) next.push([...chain, color]);
    partial = [];
    for (const chain of next.slice(0, 16)) (isSolid(chain) ? done : partial).push(chain);
  }
  for (const chain of partial) for (const fb of FALLBACKS) done.push([...chain, ...fb]);
  return done.slice(0, 24);
}

function bgKey(chain: ColorRef[]): string {
  return chain.map((c) => spec(c, 'bg')).join(' > ');
}

/* ------------------------------------------------------------------ */
/* Pengumpulan per berkas                                              */
/* ------------------------------------------------------------------ */

function fileContext(file: string, source: string): FileCtx {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const consts = new Map<string, ts.Expression>();
  const icons = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isVariableDeclarationList(node.parent) && node.parent.flags & ts.NodeFlags.Const) {
      consts.set(node.name.text, node.initializer);
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === 'lucide-react') {
      const named = node.importClause?.namedBindings;
      if (named && ts.isNamedImports(named)) for (const el of named.elements) icons.add(el.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { sf, consts, icons };
}

function classNameExpr(attrs: ts.JsxAttributes): ts.Expression | null {
  for (const a of attrs.properties) {
    if (!ts.isJsxAttribute(a) || a.name.getText() !== 'className' || !a.initializer) continue;
    if (ts.isStringLiteral(a.initializer)) return a.initializer;
    if (ts.isJsxExpression(a.initializer) && a.initializer.expression) return a.initializer.expression;
  }
  return null;
}

/** Opacity per tema: [gelap, terang]. Satu angka = sama di kedua tema. */
type Opacity = number | readonly [number, number];

function emit(out: ClassPair[], file: string, line: number, kind: PairKind, state: string, large: boolean, opacityIn: Opacity, dark: { fg: Cand; bg: ColorRef[] }, light: { fg: Cand; bg: ColorRef[] }): void {
  if (['current', 'inherit'].includes(dark.fg.color.name) || ['current', 'inherit'].includes(light.fg.color.name)) return;
  if (dark.fg.color.alpha === 0 || light.fg.color.alpha === 0) return; // text-transparent (mis. textarea editor di atas lapisan sorotan)
  const [opacity, opacityL] = typeof opacityIn === 'number' ? [opacityIn, opacityIn] : opacityIn;
  const min = kind === 'text' || kind === 'placeholder' ? (large ? 3 : 4.5) : 3;
  const prefix = kind === 'focus' ? 'ring' : kind === 'placeholder' ? 'placeholder' : 'text';
  const lightNote = light.fg.light ? ` [light:${spec(light.fg.color, prefix)}]` : '';
  const lightOpacity = opacityL !== opacity ? ` [light:opacity-${Math.round(opacityL * 100)}]` : '';
  const key = `${spec(dark.fg.color, prefix)}${opacity < 1 ? ` opacity-${Math.round(opacity * 100)}` : ''}${lightOpacity}${lightNote} @ ${bgKey(dark.bg)}`;
  out.push({ file, line, kind, state, large, min, dark: { fg: dark.fg.color, bg: dark.bg, opacity }, light: { fg: light.fg.color, bg: light.bg, opacity: opacityL }, key });
}

/** Pasangan untuk satu elemen (semua alternatif className × keadaan × rantai latar). */
function elementPairs(out: ClassPair[], file: string, line: number, alts: ElementModel[], ancestors: Frame[], isIcon: boolean): void {
  const inheritedSize = (): { size: number; weight: number; opacity: number; opacityLight: number } => {
    let size: number | null = null;
    let weight: number | null = null;
    let opacity = 1;
    let opacityLight = 1;
    for (const f of ancestors) {
      const a = f.alts[0];
      if (!a) continue;
      size ??= a.size;
      weight ??= a.weight;
      opacity *= a.opacity;
      opacityLight *= a.opacityLight ?? a.opacity;
    }
    return { size: size ?? 16, weight: weight ?? 400, opacity, opacityLight };
  };
  const inh = inheritedSize();
  for (const el of alts) {
    const size = el.size ?? inh.size;
    const weight = el.weight ?? inh.weight;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const opacity = [el.opacity * inh.opacity, (el.opacityLight ?? el.opacity) * inh.opacityLight] as const;
    const states = new Set<string>(['']);
    for (const c of [...el.text, ...el.bg]) states.add(c.state);
    for (const state of states) {
      const fgD = pick(el.text, 'dark', state);
      const fgL = pick(el.text, 'light', state);
      if (fgD.length === 0 || fgL.length === 0) continue;
      const ownD = pick(el.bg, 'dark', state);
      const ownL = pick(el.bg, 'light', state);
      const chainsD = chains(ownD.map((c) => [c]), ancestors, 'dark');
      const chainsL = chains(ownL.map((c) => [c]), ancestors, 'light');
      for (const [i, fd] of fgD.entries()) {
        const fl = fgL[Math.min(i, fgL.length - 1)];
        if (!fl) continue;
        for (const [j, cd] of chainsD.entries()) {
          const cl = chainsL[Math.min(j, chainsL.length - 1)];
          if (!cl) continue;
          emit(out, file, line, isIcon ? 'icon' : 'text', state, large, opacity, { fg: fd, bg: cd }, { fg: fl, bg: cl });
        }
      }
    }
    // Placeholder: terhadap latar elemen sendiri.
    for (const pd of el.placeholder.filter((c) => !c.light)) {
      const pl = el.placeholder.find((c) => c.light) ?? pd;
      const cd = chains(pick(el.bg, 'dark', '').map((c) => [c]), ancestors, 'dark');
      const cl = chains(pick(el.bg, 'light', '').map((c) => [c]), ancestors, 'light');
      for (const [j, chain] of cd.entries()) emit(out, file, line, 'placeholder', '', false, 1, { fg: pd, bg: chain }, { fg: pl, bg: cl[Math.min(j, cl.length - 1)] ?? chain });
    }
    // Garis fokus: terhadap latar INDUK (garis digambar di luar kotak elemen).
    for (const fd of el.focus.filter((c) => !c.light)) {
      const fl = el.focus.find((c) => c.light) ?? fd;
      const cd = chains([], ancestors, 'dark');
      const cl = chains([], ancestors, 'light');
      for (const [j, chain] of cd.entries()) emit(out, file, line, 'focus', '', false, 1, { fg: fd, bg: chain }, { fg: fl, bg: cl[Math.min(j, cl.length - 1)] ?? chain });
    }
  }
}

export function collectFilePairs(file: string, source: string): ClassPair[] {
  const ctx = fileContext(file, source);
  const out: ClassPair[] = [];
  const lineOf = (node: ts.Node) => ctx.sf.getLineAndCharacterOfPosition(node.getStart(ctx.sf)).line + 1;
  const usedInJsx = new Set<ts.Node>();

  const jsxAncestors = (node: ts.Node): Frame[] => {
    const frames: Frame[] = [];
    for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
      if (ts.isJsxElement(p)) {
        const expr = classNameExpr(p.openingElement.attributes);
        frames.push({ alts: expr ? alternatives(expr, ctx).map(model) : [model('')] });
      }
    }
    return frames;
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const expr = classNameExpr(node.attributes);
      if (expr) {
        const markUsed = (n: ts.Node) => {
          usedInJsx.add(n);
          ts.forEachChild(n, markUsed);
        };
        markUsed(expr);
        const alts = alternatives(expr, ctx).map(model);
        const tag = node.tagName.getText(ctx.sf);
        const isIcon = ts.isJsxSelfClosingElement(node) && /^[A-Z]/.test(tag) && (ctx.icons.has(tag) || /Icon$/.test(tag));
        const self = ts.isJsxOpeningElement(node) ? node.parent : node;
        elementPairs(out, file, lineOf(node), alts, jsxAncestors(self), isIcon);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ctx.sf);

  // Di luar JSX: string tunggal yang memuat text- dan bg-, dan objek literal berisi keduanya.
  const hasText = (s: string) => s.split(/\s+/).some((t) => colorUtil(parseClass(t).util)?.prop === 'text');
  const hasBg = (s: string) => s.split(/\s+/).some((t) => colorUtil(parseClass(t).util)?.prop === 'bg');
  const loose = (node: ts.Node) => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !usedInJsx.has(node) && hasText(node.text) && hasBg(node.text)) {
      elementPairs(out, file, lineOf(node), [model(node.text)], [], false);
    }
    if (ts.isObjectLiteralExpression(node)) {
      const strings: string[] = [];
      for (const p of node.properties) {
        if (ts.isPropertyAssignment(p) && (ts.isStringLiteral(p.initializer) || ts.isNoSubstitutionTemplateLiteral(p.initializer))) strings.push(p.initializer.text);
      }
      // Latar yang hanya satu kelas bg (mis. accent: 'bg-rose-500' untuk batang/titik) bukan wadah teks.
      const bgs = strings.filter((s) => hasBg(s) && !hasText(s) && s.trim().split(/\s+/).length > 1);
      const texts = strings.filter((s) => hasText(s) && !hasBg(s));
      for (const b of bgs) for (const t of texts) elementPairs(out, file, lineOf(node), [model(t)], [{ alts: [model(b)] }], false);
    }
    ts.forEachChild(node, loose);
  };
  loose(ctx.sf);
  return out;
}

export function collectTrackPairs(): ClassPair[] {
  return trackFiles()
    .filter((f) => /\.tsx?$/.test(f))
    .flatMap((f) => collectFilePairs(f, readRepo(f)));
}
