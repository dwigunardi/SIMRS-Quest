/**
 * Pengendali Chrome/Edge headless lewat DevTools Protocol, tanpa dependensi tambahan (WebSocket & fetch bawaan Node ≥ 22).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freePort } from './ports';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') : undefined,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

export function findChrome(): string {
  const found = CANDIDATES.find((path): path is string => typeof path === 'string' && existsSync(path));
  if (!found) throw new Error('Chrome/Edge tidak ditemukan. Set variabel lingkungan CHROME_PATH ke lokasi chrome.exe.');
  return found;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface CdpMessage {
  id?: number;
  method?: string;
  result?: Record<string, unknown>;
  /** Payload event CDP (bentuknya bebas). */
  params?: Record<string, any>;
}

export class Browser {
  /** Error JS & console.error/warn dari halaman sejak `clearProblems()` terakhir. */
  readonly problems: string[] = [];
  private nextId = 0;
  private readonly pending = new Map<number, (value: Record<string, unknown>) => void>();

  private constructor(
    private readonly chrome: ChildProcess,
    private readonly profile: string,
    private readonly ws: WebSocket,
  ) {}

  static async launch(): Promise<Browser> {
    const port = await freePort();
    const profile = await mkdtemp(join(tmpdir(), 'simrs-e2e-'));
    const chrome = spawn(
      findChrome(),
      ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1400,900', 'about:blank'],
      { stdio: 'ignore' },
    );
    let url: string | undefined;
    for (let i = 0; i < 100 && !url; i += 1) {
      try {
        const list = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as Array<{ type: string; webSocketDebuggerUrl: string }>;
        url = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
      } catch {
        /* belum siap */
      }
      if (!url) await sleep(200);
    }
    if (!url) {
      chrome.kill();
      throw new Error('Chrome tidak merespons DevTools Protocol');
    }
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve());
      ws.addEventListener('error', () => reject(new Error('gagal tersambung ke Chrome')));
    });
    const browser = new Browser(chrome, profile, ws);
    ws.addEventListener('message', (event) => browser.onMessage(JSON.parse(String(event.data)) as CdpMessage));
    await browser.send('Runtime.enable');
    await browser.send('Page.enable');
    return browser;
  }

  private onMessage(msg: CdpMessage): void {
    if (msg.id !== undefined) {
      this.pending.get(msg.id)?.(msg.result ?? (msg as Record<string, unknown>));
      this.pending.delete(msg.id);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params?.exceptionDetails;
      this.problems.push(`exception: ${d?.exception?.description ?? d?.text ?? '?'}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params?.type)) {
      const text = (msg.params?.args ?? []).map((a: { value?: unknown; description?: string }) => a.value ?? a.description).join(' ');
      if (!/Download the React DevTools/.test(text)) this.problems.push(`console.${msg.params?.type}: ${text}`);
    }
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const id = ++this.nextId;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => this.pending.set(id, resolve));
  }

  /** Jalankan ekspresi JS di halaman (boleh async) dan kembalikan nilainya. */
  async evaluate<T = unknown>(expression: string): Promise<T> {
    const res = (await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })) as {
      result?: { value?: T };
      exceptionDetails?: { text?: string; exception?: { description?: string } };
    };
    if (res.exceptionDetails) throw new Error(`evaluate gagal: ${res.exceptionDetails.exception?.description ?? res.exceptionDetails.text}`);
    return res.result?.value as T;
  }

  /** Waktu bolak-balik evaluate sederhana — ukuran apakah thread utama halaman responsif. */
  async pingMs(): Promise<number> {
    const t0 = Date.now();
    await this.evaluate('1 + 1');
    return Date.now() - t0;
  }

  async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
    await this.waitForLoad();
  }

  /** Tunggu document selesai dimuat (setelah navigate/reload). */
  async waitForLoad(): Promise<void> {
    await sleep(300);
    for (let i = 0; i < 100; i += 1) {
      try {
        if ((await this.evaluate<string>('document.readyState')) === 'complete') return;
      } catch {
        /* konteks halaman sedang berganti */
      }
      await sleep(100);
    }
  }

  clearProblems(): void {
    this.problems.length = 0;
  }

  async close(): Promise<void> {
    try {
      this.ws.close();
    } catch {
      /* sudah tertutup */
    }
    this.chrome.kill();
    // Chrome butuh sesaat untuk melepas file profil.
    await rm(this.profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => undefined);
  }
}
