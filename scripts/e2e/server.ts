/**
 * Menjalankan aplikasi untuk uji E2E lewat API Vite (bukan proses terpisah), sehingga server selalu ikut berhenti.
 * - dev: server Vite biasa (seperti `npm run dev`)
 * - preview: build produksi ke folder sementara, lalu `vite preview` (seperti hasil deploy)
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, createServer, preview } from 'vite';
import { freePort } from './ports';

export interface AppServer {
  url: string;
  close: () => Promise<void>;
}

export async function startApp(mode: 'dev' | 'preview'): Promise<AppServer> {
  const port = await freePort();
  if (mode === 'dev') {
    const server = await createServer({ logLevel: 'warn', server: { port, strictPort: true, host: '127.0.0.1' } });
    await server.listen();
    return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
  }
  const outDir = await mkdtemp(join(tmpdir(), 'simrs-e2e-dist-'));
  await build({ logLevel: 'warn', build: { outDir, emptyOutDir: true } });
  const server = await preview({ logLevel: 'warn', build: { outDir }, preview: { port, strictPort: true, host: '127.0.0.1' } });
  return {
    url: `http://127.0.0.1:${port}/`,
    close: async () => {
      await server.close();
      await rm(outDir, { recursive: true, force: true });
    },
  };
}
