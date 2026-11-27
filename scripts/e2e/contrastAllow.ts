/**
 * Daftar izin pemindai kontras di halaman (scripts/e2e/contrast.ts) untuk suite 'theme' (scripts/e2e/suites/theme.ts).
 *
 * TEMA TERANG — wajib nol pelanggaran AA. Satu-satunya pengecualian yang boleh dicatat di LIGHT_SCAN_EXEMPT: teks
 * DEKORATIF yang memang aria-hidden (tidak dibacakan dan tidak membawa informasi), masing-masing dengan alasannya.
 * Kontrol nonaktif TIDAK dikecualikan: labelnya tetap harus terbaca (gaya `light:disabled:` di komponen).
 *
 * TEMA GELAP — tampilannya wajib identik piksel dengan sebelum ada tema terang (HEAD fbbd2d3), jadi pelanggaran AA
 * yang SUDAH ADA di sana tidak boleh diperbaiki diam-diam di cabang ini. DARK_PREEXISTING mencatat pasangan warna itu
 * (warna akhir teks @ warna akhir latar, keduanya nilai Tailwind asli). Dibuktikan sudah ada sebelumnya: pemindai yang
 * sama dijalankan pada build HEAD fbbd2d3 dan menghasilkan himpunan pasangan yang sama. Pasangan gelap BARU (tidak ada
 * di daftar) menggagalkan suite. Daftar ini HANYA BOLEH MENYUSUT: entri yang tidak lagi ditemui di layar mana pun
 * juga menggagalkan suite (hapus entrinya). Menunggu keputusan pemilik: memperbaikinya berarti mengubah tampilan gelap.
 *
 * Memperbarui daftar: `E2E_CONTRAST_DUMP=<file.json> npm run e2e -- --only=theme` menulis semua temuan (kedua tema,
 * kedua lebar) ke file itu.
 */
import type { ContrastIssue } from './contrast';

/** Kunci pasangan warna temuan: "text rgb(100 116 139) @ rgb(15 23 42)". */
export function contrastKey(issue: Pick<ContrastIssue, 'kind' | 'fg' | 'bg'>): string {
  return `${issue.kind} ${issue.fg} @ ${issue.bg}`;
}

export interface LightExempt {
  /** Potongan jalur selektor temuan (ContrastIssue.selector). */
  selector: string;
  /** Teks temuan harus cocok (opsional). */
  text?: RegExp;
  reason: string;
}

/** Teks dekoratif aria-hidden yang boleh di bawah AA di tema terang (alasan wajib). */
export const LIGHT_SCAN_EXEMPT: readonly LightExempt[] = [
  {
    // src/components/progress/Achievements.tsx — medali lencana yang BELUM diraih.
    selector: 'span.rounded-full.text-xl',
    text: /^\p{Extended_Pictographic}/u,
    reason:
      'Medali emoji lencana terkunci: aria-hidden & dekoratif. Emoji digambar dengan warnanya sendiri (bukan warna teks), ' +
      'lalu sengaja dipudarkan (grayscale + opacity-50) sebagai tanda "belum diraih"; nama, syarat, ikon gembok, dan ' +
      'kemajuan lencana tertulis di sebelahnya dengan kontras penuh.',
  },
];

export function lightExempt(issue: ContrastIssue): LightExempt | undefined {
  if (!issue.ariaHidden) return undefined;
  return LIGHT_SCAN_EXEMPT.find((e) => issue.selector.includes(e.selector) && (e.text === undefined || e.text.test(issue.text)));
}

/** Pasangan warna di bawah AA yang sudah ada di tema gelap sebelum cabang ini (lihat komentar berkas). */
// Urut dari rasio terendah. Komentar: rasio, warna teks, contoh teks — elemen. Kategori besarnya: teks sekunder
// slate-500/600 di panel & tint gelap (3.1–4.2:1), nomor baris/kepala kolom slate-600 (2.4–2.6:1), batas input
// slate-700 (1.7–2:1), label pintasan di tombol Run (3.2:1), tombol violet "Kirim" (4.2:1), kontrol nonaktif ber-opacity.
export const DARK_PREEXISTING: readonly string[] = [
  'text rgb(41 50 69) @ rgb(2 6 23)', // 1.57 (nonaktif) «(» — span.text-xs.text-slate-500
  // Keadaan "penilaian sedang berjalan" (alur misi → misi-berjalan): tombol Run & Check nonaktif = disabled:opacity-50
  // dan label pintasannya. Kelas gelapnya sama persis dengan HEAD fbbd2d3 (MissionWorkspace.tsx: bg-emerald-500
  // text-slate-950 disabled:opacity-50; kbd bg-emerald-700/40 text-emerald-50) — keadaan ini baru dipindai sekarang.
  'text rgb(119 130 134) @ rgb(7 83 68)', // 2.29 (nonaktif) «Ctrl + Enter» — kbd.rounded.bg-emerald-700/40.font-mono
  'text rgb(2 6 23) @ rgb(9 96 76)', // 2.66 slate-950 (nonaktif) «Run & Check» — button.rounded-lg.bg-emerald-500.text-sm
  'text rgb(71 85 105) @ rgb(63 47 26)', // 1.70 slate-600 «NULL» — span.text-slate-600
  'border rgb(51 65 85) @ rgb(15 23 42)', // 1.72 slate-700 «[batas input text]» — div
  'text rgb(54 65 86) @ rgb(9 15 33)', // 1.87 «0» — span.text-xs.text-slate-500
  'text rgb(51 65 83) @ rgb(2 11 26)', // 1.89 (nonaktif) «#» — span.text-slate-500
  'border rgb(51 65 85) @ rgb(2 6 23)', // 1.95 slate-700 «[batas input search]» — div
  'text rgb(71 85 105) @ rgb(21 29 47)', // 2.21 slate-600 (nonaktif) «WHERE + AND/OR» — span.rounded.font-mono.bg-slate-800/60
  'text rgb(71 85 105) @ rgb(15 23 42)', // 2.36 slate-600 «#» — th.border-b.border-r.border-slate-800
  'text rgb(71 85 105) @ rgb(10 16 34)', // 2.49 slate-600 (aria-hidden) «1» — div
  'text rgb(71 85 105) @ rgb(7 13 31)', // 2.55 slate-600 «…» — td.border-b.border-slate-800/70.text-center
  'text rgb(71 85 105) @ rgb(7 12 30)', // 2.57 slate-600 (nonaktif) «50» — span.text-slate-600
  'placeholder rgb(71 85 105) @ rgb(2 6 23)', // 2.66 slate-600 «[placeholder] mis. RM-0001» — input#:r1:
  'text rgb(100 116 139) @ rgb(15 55 59)', // 2.72 slate-500 «tabel · 4 kolom» — span.font-sans.text-[10.5px].text-slate-500
  'text rgb(2 6 23) @ rgb(127 76 42)', // 2.84 slate-950 (nonaktif) «Periksa Jawaban» — button.rounded-lg.bg-orange-400.text-sm
  'text rgb(82 89 104) @ rgb(2 6 23)', // 2.87 (nonaktif) «Show Solution» — button.rounded-lg.border-slate-700.text-sm
  'text rgb(86 93 108) @ rgb(7 13 31)', // 2.92 (nonaktif) «Sebelumnya» — button.rounded-md.border-slate-700.text-xs
  'text rgb(100 116 139) @ rgb(30 41 59)', // 3.07 slate-500 «Query ditulis mulai dari SELECT,  — span.text-xs.text-slate-500
  'text rgb(236 253 245) @ rgb(11 159 112)', // 3.21 emerald-50 «Ctrl + Enter» — kbd.rounded.bg-emerald-700/40.font-mono
  'text rgb(100 116 139) @ rgb(22 31 48)', // 3.48 slate-500 «1» — span.text-[11px].text-slate-500
  'text rgb(100 116 139) @ rgb(4 33 39)', // 3.53 slate-500 «< 1 ms» — div.text-[11px].text-slate-500
  'text rgb(100 116 139) @ rgb(9 32 42)', // 3.54 slate-500 «7» — span.text-xs.text-slate-500
  'text rgb(100 116 139) @ rgb(17 30 33)', // 3.58 slate-500 «· terbaik» — span.text-slate-500
  'text rgb(100 116 139) @ rgb(27 26 23)', // 3.66 slate-500 «Mengulang konsep dari» — p.text-[11px].font-semibold.text-slate-500
  'text rgb(100 116 139) @ rgb(27 23 42)', // 3.69 slate-500 «A90» — td.border-b.border-slate-800/70.text-slate-500
  'text rgb(100 116 139) @ rgb(15 23 42)', // 3.75 slate-500 «20 baris» — span.text-[10.5px].text-slate-500
  'text rgb(158 103 15) @ rgb(26 21 22)', // 3.78 «50» — span.font-normal.text-amber-500/60
  'text rgb(100 116 139) @ rgb(14 22 41)', // 3.78 slate-500 «20» — span
  'text rgb(110 124 144) @ rgb(23 32 51)', // 3.82 «hari» — span.text-xs
  'text rgb(100 116 139) @ rgb(3 22 44)', // 3.82 slate-500 «Tanpa batas waktu · dihitung hari — span.text-[11px].text-slate-500
  'text rgb(100 116 139) @ rgb(13 20 39)', // 3.85 slate-500 «12» — span
  'text rgb(100 116 139) @ rgb(11 18 36)', // 3.92 slate-500 «untuk menjalankan» — span
  'text rgb(100 116 139) @ rgb(3 19 30)', // 3.96 slate-500 «4» — span.text-[11px].text-slate-500
  'text rgb(100 116 139) @ rgb(10 16 34)', // 3.97 slate-500 «0» — span.text-xs.text-slate-500
  'text rgb(100 116 139) @ rgb(4 17 34)', // 3.98 slate-500 «< 1 ms» — p.text-[11px].text-slate-500
  'text rgb(100 116 139) @ rgb(4 16 36)', // 3.99 slate-500 «< 1 ms» — p.text-[11px].text-slate-500
  'text rgb(116 122 134) @ rgb(18 26 44)', // 4.01 (aria-hidden) «🧭» — span.rounded-full.text-xl.bg-slate-800
  'text rgb(100 116 139) @ rgb(9 15 33)', // 4.02 slate-500 «Misi selesai» — p.text-[11px].text-slate-500
  'text rgb(100 116 139) @ rgb(14 14 22)', // 4.04 slate-500 «0» — span.text-xs.text-slate-500
  'text rgb(100 116 139) @ rgb(3 14 33)', // 4.05 slate-500 «= membaca seluruh tabel baris dem — p.text-[11px].text-slate-500
  'text rgb(100 116 139) @ rgb(13 9 43)', // 4.06 slate-500 «< 1 ms» — p.text-[11px].text-slate-500
  'text rgb(100 116 139) @ rgb(19 11 18)', // 4.07 slate-500 «< 1 ms» — p.text-[11px].text-slate-500
  'text rgb(100 116 139) @ rgb(7 13 31)', // 4.07 slate-500 «dihitung di database awal (data y — span.text-[11px].text-slate-500
  'text rgb(100 116 139) @ rgb(7 12 30)', // 4.08 slate-500 «0» — span.text-xs.text-slate-500
  'text rgb(100 116 139) @ rgb(17 9 27)', // 4.09 slate-500 «2» — span.text-[11px].text-slate-500
  'text rgb(100 116 139) @ rgb(2 12 31)', // 4.09 slate-500 «Agar portabel, ulangi ekspresinya — span
  'text rgb(100 116 139) @ rgb(6 11 29)', // 4.10 slate-500 «0» — span.text-[10px].text-slate-500
  'text rgb(100 116 139) @ rgb(5 10 28)', // 4.14 slate-500 «12 baris» — span.text-[10.5px].text-slate-500
  'text rgb(100 116 139) @ rgb(3 10 28)', // 4.15 slate-500 «0» — span.text-xs.text-slate-500
  'text rgb(100 116 139) @ rgb(4 9 26)', // 4.17 slate-500 «Ditulis dari atas ke bawah · nomo — p.text-[11px].font-semibold.text-slate-500
  'text rgb(100 116 139) @ rgb(11 6 23)', // 4.19 slate-500 «Pesan asli SQLite» — p.text-[10px].font-semibold.text-slate-500
  'text rgb(255 255 255) @ rgb(139 92 246)', // 4.23 white «Kirim» — button.rounded-lg.bg-violet-500.text-sm
  'text rgb(100 116 139) @ rgb(2 6 23)', // 4.24 slate-500 «Misi» — span.text-slate-500
];
