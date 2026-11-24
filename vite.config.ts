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
  build: {
    rollupOptions: {
      output: {
        // Pustaka yang dipakai Beranda sejak layar pertama dipisah dari kode aplikasi: isinya jarang berubah, jadi
        // tetap ter-cache di browser saat aplikasi diperbarui, dan tidak ada satu berkas JS raksasa. Daftarnya SENGAJA
        // sempit — pola "semua node_modules" akan ikut menyeret sql.js dan pustaka lain yang harus tetap dimuat malas.
        manualChunks(id) {
          const path = id.replace(/\\/g, '/');
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(path)) return 'react';
          if (/\/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(path)) return 'motion';
          return undefined;
        },
      },
    },
  },
});
