/**
 * Pemindai kontras WCAG AA di halaman yang sedang tampil (dievaluasi lewat CDP Runtime.evaluate).
 *
 * Untuk setiap simpul teks yang TERLIHAT: warna AKHIR piksel teks dibandingkan dengan warna AKHIR piksel latar di
 * belakangnya, mengikuti model lukis CSS — latar setiap leluhur (ber-alfa atau padat) dilukis di atas permukaan di
 * bawahnya mulai dari kanvas (latar <body>/<html>, lalu putih), lalu isi setiap elemen ber-opacity (latar + teks
 * turunannya) dicampur ke permukaan di belakangnya. Jadi tombol `disabled:opacity-50` memudarkan latar DAN teksnya ke
 * arah halaman. Warna teks memperhitungkan alpha dan -webkit-text-fill-color. Latar gradien dihitung per titik warna
 * (diambil yang terburuk) dan ditandai `uncertain`. Ambang: 4.5:1, atau 3:1 untuk teks besar (≥ 24px, atau ≥ 18.66px dengan tebal ≥ 700).
 * Placeholder input/textarea yang kosong ikut diperiksa (::placeholder). Batas kontrol formulir (input/textarea/select
 * yang punya border) diperiksa sebagai komponen non-teks (≥ 3:1) dan dilaporkan terpisah (`kind: 'border'`).
 *
 * Batas yang disadari: latar dari pseudo-elemen (::before/::after), gambar, bayangan, dan elemen yang menumpuk secara
 * visual tetapi bukan leluhur DOM tidak terlihat oleh pemindai. Teks di dalam [aria-hidden] dan kontrol nonaktif tetap
 * dilaporkan tetapi ditandai (`ariaHidden`, `disabled`) supaya bisa dipilah — WCAG mengecualikan kontrol nonaktif.
 *
 * Pemakaian di suite E2E:
 *   const report = await scanContrast((expr) => t.evaluate(expr));
 *   t.check('kontras AA', report.issues.length === 0, formatContrastIssues(report.issues).slice(0, 3).join(' | '));
 */

export interface ContrastIssue {
  kind: 'text' | 'placeholder' | 'border';
  /** Rasio terhitung (dibulatkan 2 desimal). */
  ratio: number;
  /** Ambang yang berlaku (4.5, 3). */
  min: number;
  /** Warna teks/garis efektif "rgb(r g b)". */
  fg: string;
  /** Latar efektif "rgb(r g b)" (untuk latar gradien: titik warna terburuk). */
  bg: string;
  /** Potongan teks (≤ 48 karakter). */
  text: string;
  /** Jalur selektor ringkas elemen pemilik teks. */
  selector: string;
  fontSize: number;
  fontWeight: number;
  large: boolean;
  /** Latar gradien/gambar ikut dihitung → hasil perkiraan. */
  uncertain: boolean;
  ariaHidden: boolean;
  disabled: boolean;
  /** Berapa simpul identik (selektor + warna + teks) yang digabung. */
  count: number;
}

export interface ContrastReport {
  /** html[data-theme] saat dipindai. */
  theme: string | null;
  /** Jumlah simpul teks terlihat yang diperiksa. */
  scanned: number;
  issues: ContrastIssue[];
}

export interface ContrastOptions {
  /** Hanya teks yang (sebagian) berada di viewport. Bawaan: false (seluruh dokumen yang dirender). */
  viewportOnly?: boolean;
  /** Batasi ke subpohon ini (selektor CSS). Bawaan: body. */
  root?: string;
  /** Ikut laporkan teks di [aria-hidden] dan kontrol nonaktif. Bawaan: true (ditandai). */
  includeExempt?: boolean;
}

/** Ekspresi halaman yang menghasilkan ContrastReport. */
export function contrastScanExpression(options: ContrastOptions = {}): string {
  const opts = JSON.stringify({ viewportOnly: false, root: 'body', includeExempt: true, ...options });
  return `(() => {
  const OPTS = ${opts};
  const parse = (s) => {
    if (!s || s === 'transparent') return [0, 0, 0, 0];
    const n = (s.match(/-?[\\d.]+(e-?\\d+)?/g) || []).map(Number);
    if (/^color\\(srgb/.test(s)) return [n[0] * 255, n[1] * 255, n[2] * 255, n.length > 3 ? n[3] : 1];
    return [n[0] || 0, n[1] || 0, n[2] || 0, n.length > 3 ? n[3] : 1];
  };
  const over = (top, base) => { const a = top[3]; return [top[0] * a + base[0] * (1 - a), top[1] * a + base[1] * (1 - a), top[2] * a + base[2] * (1 - a), 1]; };
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fmt = (c) => 'rgb(' + Math.round(c[0]) + ' ' + Math.round(c[1]) + ' ' + Math.round(c[2]) + ')';
  const gradientColors = (img) => (img.match(/rgba?\\([^)]*\\)|color\\(srgb[^)]*\\)/g) || []).map(parse);
  const canvas = () => {
    for (const e of [document.body, document.documentElement]) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0.999) return c; }
    return [255, 255, 255, 1];
  };
  const lerp = (below, top, o) => [below[0] + (top[0] - below[0]) * o, below[1] + (top[1] - below[1]) * o, below[2] + (top[2] - below[2]) * o, 1];
  const styleCache = new Map();
  const styleOf = (e) => {
    let s = styleCache.get(e);
    if (!s) {
      const cs = getComputedStyle(e);
      s = { bg: parse(cs.backgroundColor), img: cs.backgroundImage && cs.backgroundImage !== 'none' ? gradientColors(cs.backgroundImage) : [], opacity: Number(cs.opacity) };
      styleCache.set(e, s);
    }
    return s;
  };
  /**
   * Warna akhir piksel latar (bg) dan piksel teks (fg) — model lukis CSS: tiap elemen melukis latarnya di atas
   * permukaan di bawahnya, lalu SELURUH isinya (latar + teks turunan) dicampur dengan opacity elemen itu ke permukaan
   * di bawahnya. Jadi opacity pada elemen yang membawa latar padat (mis. tombol disabled:opacity-50) ikut memudarkan
   * latar DAN teksnya ke arah halaman di belakangnya. Latar gradien → satu pasangan per titik warna (uncertain).
   * fgAlpha = alfa teks × semua opacity leluhur (untuk melewati teks yang praktis tak terlihat).
   */
  const composite = (el, fgRaw) => {
    const chain = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) chain.push(e);
    let uncertain = false;
    let fgAlpha = fgRaw[3];
    const render = (k, below) => {
      const s = styleOf(chain[k]);
      let surfaces = [s.bg[3] > 0 ? over(s.bg, below) : below];
      if (s.img.length > 0) { uncertain = true; surfaces = surfaces.flatMap((r) => s.img.map((g) => over(g, r))); }
      const inner = surfaces.flatMap((surface) => (k === 0 ? [[surface, over(fgRaw, surface)]] : render(k - 1, surface)));
      return s.opacity < 1 ? inner.map(([bg, fg]) => [lerp(below, bg, s.opacity), lerp(below, fg, s.opacity)]) : inner;
    };
    for (const e of chain) fgAlpha *= styleOf(e).opacity;
    // <html> dan <body> transparan → kanvas (warna latar body/html, lalu putih).
    return { pairs: render(chain.length - 1, canvas()), uncertain, fgAlpha };
  };
  const path = (el) => {
    const parts = [];
    for (let e = el, i = 0; e && e !== document.body && i < 4; e = e.parentElement, i += 1) {
      let p = e.tagName.toLowerCase();
      const tid = e.getAttribute('data-testid');
      if (tid) { parts.unshift(p + '[data-testid=' + tid + ']'); break; }
      if (e.id) { parts.unshift(p + '#' + e.id); break; }
      const cls = [...e.classList].filter((c) => /^(text-|bg-|border-|font-|rounded)/.test(c)).slice(0, 3);
      if (cls.length) p += '.' + cls.join('.').replace(/([/:\\[\\]])/g, '\\\\$1');
      parts.unshift(p);
    }
    return parts.join(' > ');
  };
  const flags = (el) => ({ ariaHidden: !!el.closest('[aria-hidden="true"]'), disabled: !!el.closest('button:disabled, input:disabled, textarea:disabled, select:disabled, fieldset:disabled, [aria-disabled="true"]') });
  const inView = (r) => r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  const hits = new Map();
  const report = (kind, el, fgRaw, text, min, size, weight) => {
    const b = composite(el, fgRaw);
    if (b.fgAlpha < 0.02) return;
    let worst = null;
    for (const [bg, fg] of b.pairs) {
      const r = ratio(fg, bg);
      if (!worst || r < worst.r) worst = { r, fg, bg };
    }
    if (!worst || worst.r >= min - 0.005) return;
    const f = flags(el);
    if (!OPTS.includeExempt && (f.ariaHidden || f.disabled)) return;
    const issue = { kind, ratio: Math.round(worst.r * 100) / 100, min, fg: fmt(worst.fg), bg: fmt(worst.bg), text: text.slice(0, 48), selector: path(el), fontSize: size, fontWeight: weight, large: min === 3 && kind !== 'border', uncertain: b.uncertain, ariaHidden: f.ariaHidden, disabled: f.disabled, count: 1 };
    const key = issue.kind + '|' + issue.selector + '|' + issue.fg + '|' + issue.bg + '|' + issue.text;
    const prev = hits.get(key);
    if (prev) prev.count += 1; else hits.set(key, issue);
  };
  const root = document.querySelector(OPTS.root) || document.body;
  let scanned = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.replace(/\\s+/g, ' ').trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'OPTION'].includes(el.tagName)) continue;
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter((r) => r.width >= 2 && r.height >= 2);
    if (rects.length === 0) continue;
    if (OPTS.viewportOnly && !rects.some(inView)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible') continue;
    const fill = cs.webkitTextFillColor;
    const fg = parse(fill && fill !== cs.color && !/currentcolor/i.test(fill) ? fill : cs.color);
    if (fg[3] === 0) continue;
    scanned += 1;
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    report('text', el, fg, text, large ? 3 : 4.5, size, weight);
  }
  for (const el of root.querySelectorAll('input, textarea, select')) {
    if (el.getClientRects().length === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    if (OPTS.viewportOnly && !inView(rect)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || Number(cs.opacity) === 0) continue;
    if (el.placeholder && !el.value) {
      const ph = getComputedStyle(el, '::placeholder');
      const size = parseFloat(ph.fontSize);
      report('placeholder', el, parse(ph.color), '[placeholder] ' + el.placeholder, 4.5, size, parseInt(ph.fontWeight, 10) || 400);
    }
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && !['checkbox', 'radio', 'range'].includes(el.type)) {
      const parent = el.parentElement || el;
      report('border', parent, parse(cs.borderTopColor), '[batas ' + el.tagName.toLowerCase() + (el.type ? ' ' + el.type : '') + ']', 3, 0, 0);
    }
  }
  return { theme: document.documentElement.getAttribute('data-theme'), scanned, issues: [...hits.values()].sort((a, b) => a.ratio - b.ratio) };
})()`;
}

/** Jalankan pemindai lewat fungsi evaluate milik Browser/SuiteContext. */
export function scanContrast(evaluate: <T>(expression: string) => Promise<T>, options: ContrastOptions = {}): Promise<ContrastReport> {
  return evaluate<ContrastReport>(contrastScanExpression(options));
}

/** Satu baris per pelanggaran: "2.31:1 < 4.5 rgb(…) di rgb(…) «teks» — selektor". */
export function formatContrastIssues(issues: readonly ContrastIssue[]): string[] {
  return issues.map((i) => {
    const marks = [i.uncertain ? 'gradien' : '', i.ariaHidden ? 'aria-hidden' : '', i.disabled ? 'nonaktif' : '', i.count > 1 ? `×${i.count}` : ''].filter(Boolean).join(',');
    return `${i.ratio.toFixed(2)}:1 < ${i.min} [${i.kind}${marks ? ` ${marks}` : ''}] ${i.fg} di ${i.bg} «${i.text}» — ${i.selector}`;
  });
}
