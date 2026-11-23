/**
 * Konteks bersama untuk setiap suite E2E: helper DOM di halaman, pencatatan hasil, dan state awal yang bersih.
 */
import type { Browser } from './browser';

/** Helper yang dipasang di halaman sebagai `window.__t` (dipanggil dari ekspresi `evaluate`). */
const PAGE_HELPERS = `
window.__t = {
  text: () => document.body.innerText,
  has: (s) => document.body.innerText.toLowerCase().includes(String(s).toLowerCase()),
  waitText: async (s, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (document.body.innerText.includes(s)) return true; await new Promise(r => setTimeout(r, 50)); } return false; },
  waitHas: async (s, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (__t.has(s)) return true; await new Promise(r => setTimeout(r, 50)); } return false; },
  waitAny: async (list, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const hit = list.find(s => document.body.innerText.includes(s)); if (hit) return hit; await new Promise(r => setTimeout(r, 50)); } return null; },
  setSql: (sql) => { const ta = document.querySelector('textarea'); const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(ta, sql); ta.dispatchEvent(new Event('input', { bubbles: true })); },
  buttons: (label) => [...document.querySelectorAll('button')].filter(b => b.innerText.trim().split('\\n')[0].trim() === label),
  button: (label) => __t.buttons(label)[0],
  click: (label) => { const b = __t.button(label); if (!b) throw new Error('tombol tidak ada: ' + label); b.click(); return !b.disabled; },
  node: (title) => [...document.querySelectorAll('li button')].find(b => b.innerText.includes(title)),
  tab: (label) => [...document.querySelectorAll('[aria-label="Panel kiri"] button')].find(b => b.innerText.includes(label)),
  mode: (label) => { const b = [...document.querySelectorAll('[aria-label="Mode aplikasi"] button')].find(x => x.title === label); if (!b) throw new Error('mode tidak ada: ' + label); b.click(); return true; },
  tick: (ms = 150) => new Promise(r => setTimeout(r, ms)),
  tableText: () => [...document.querySelectorAll('table')].map(t => t.innerText).join(' | '),
  tableFlat: () => __t.tableText().split(/\\s+/).join(' '),
};
window.confirm = () => true;
window.alert = (msg) => { (window.__alerts ??= []).push(String(msg)); };
true;
`;

export const PROGRESS_KEY = 'simrs-sql-quest:progress:v1';

export interface CheckResult {
  suite: string;
  name: string;
  ok: boolean;
  detail: string;
}

export class SuiteContext {
  readonly results: CheckResult[] = [];

  constructor(
    readonly browser: Browser,
    readonly url: string,
    readonly suite: string,
  ) {}

  evaluate<T = unknown>(expression: string): Promise<T> {
    return this.browser.evaluate<T>(expression);
  }

  check(name: string, ok: boolean, detail = ''): void {
    this.results.push({ suite: this.suite, name, ok, detail });
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Pasang ulang helper (wajib setelah halaman dimuat ulang). */
  installHelpers(): Promise<unknown> {
    return this.evaluate(PAGE_HELPERS);
  }

  /** Mulai dari browser bersih; `storage` = isi localStorage awal (key → nilai JSON). */
  async fresh(storage: Record<string, unknown> = {}): Promise<void> {
    if (!(await this.evaluate<boolean>(`location.href.startsWith(${JSON.stringify(this.url)})`).catch(() => false))) {
      await this.browser.navigate(this.url);
    }
    // Storage diganti dan halaman dimuat ulang dalam SATU langkah: bila dipisah, halaman lama (yang mungkin masih
    // memuat) sempat menulis state-nya sendiri ke storage di antara keduanya.
    await this.evaluate(
      `localStorage.clear(); sessionStorage.clear(); ${Object.entries(storage)
        .map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(v))});`)
        .join(' ')} location.reload(); true`,
    ).catch(() => undefined); // konteks halaman bisa hilang saat reload dimulai
    await this.afterLoad();
  }

  async reload(): Promise<void> {
    await this.browser.send('Page.reload', { ignoreCache: false });
    await this.afterLoad();
  }

  private async afterLoad(): Promise<void> {
    await this.browser.waitForLoad();
    await this.installHelpers();
    // document 'complete' belum berarti aplikasi siap: mesin SQL (WASM) masih dimuat di balik layar pemuatan.
    // Tunggu sampai tombol mode di header ada agar suite tidak berlomba dengan layar pemuatan.
    await this.evaluate(`(async () => { const t0 = Date.now(); while (Date.now() - t0 < 30000 && !document.querySelector('[aria-label="Mode aplikasi"] button')) await new Promise(r => setTimeout(r, 50)); return true; })()`);
  }

  /** Penutup setiap suite: tidak boleh ada error JS atau console.error/warn selama suite berjalan. */
  checkConsole(): void {
    const problems = [...this.browser.problems];
    this.check('tidak ada error/warning console', problems.length === 0, problems.slice(0, 3).join(' | '));
  }
}

/** Progres tersimpan dengan daftar misi yang sudah selesai (format UserProgress versi 1). */
export function progressWith(missionIds: readonly string[], lastMissionId: string, xpPerMission = 50): Record<string, unknown> {
  const done = { completed: true, earnedXp: xpPerMission, hintUsed: false, hintsRevealed: 0, solutionShown: false, attempts: 1, completedAt: '2026-11-20T03:00:00.000Z' };
  return {
    version: 1,
    xp: missionIds.length * xpPerMission,
    streak: { current: 1, best: 1, lastActiveDate: '2026-11-20' },
    missions: Object.fromEntries(missionIds.map((id) => [id, done])),
    lastMissionId,
  };
}
