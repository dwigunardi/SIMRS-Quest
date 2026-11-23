import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Progres pengguna tersimpan di localStorage milik origin http://localhost:5173. Tanpa strictPort, Vite diam-diam
  // pindah ke 5174 saat 5173 terpakai — origin lain, sehingga progres tampak "hilang". Lebih baik gagal dengan jelas.
  // (Uji E2E memakai port acaknya sendiri lewat konfigurasi inline di scripts/e2e/server.ts.)
  server: {
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: [],
  },
});
