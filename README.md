# SIMRS Quest 🏥

Aplikasi web untuk belajar ngoding dengan gaya permainan, bertema **Sistem Informasi Manajemen Rumah Sakit (SIMRS)**
(paket npm: `simrs-quest`). Aplikasi dibuka di **Beranda** — landing satu halaman — lalu masuk ke sebuah **jalur**
belajar. Jalur yang sudah tersedia adalah **SQL**; jalur JavaScript & TypeScript, REST API, React, dan
NestJS · Next.js · Laravel sudah terdaftar tetapi berstatus *Segera* (belum ada tanggalnya).

Tata letak jalur SQL meniru SQLBolt: layar terbagi dua, soal di kiri dan editor serta hasil di kanan.
Progresnya mengikuti gaya Duolingo: ada XP, rank, streak harian, dan misi yang terbuka satu per satu.

Semua berjalan **100% di browser** memakai SQLite 3.54 (WebAssembly lewat [sql.js](https://sql.js.org)).
Tidak perlu server, database eksternal, atau akun, dan tidak ada data yang dikirim ke mana pun.

## Beranda & platform

### Rute

Router-nya berbasis hash dan dibuat sendiri (`src/platform/router.ts`):

| Alamat | Layar |
|---|---|
| tanpa hash, `#`, `#/` | Beranda |
| `#/sql` | Jalur SQL (membuka misi "Lanjutkan") |
| `#/sql/misi`, `#/sql/materi`, `#/sql/playground`, `#/sql/progres`, `#/sql/ujian` | Tautan masuk ke sebuah mode jalur SQL; setelah modenya terbuka, URL dirapikan kembali ke `#/sql` |
| `#/js`, `#/rest`, `#/react`, `#/framework`, alamat lain | Dialihkan ke Beranda dengan pemberitahuan satu baris (jalur belum tersedia / halaman tidak ditemukan) |

Beranda → jalur dan jalur → Beranda adalah entri riwayat baru, jadi tombol Kembali/Maju browser bekerja dua arah;
pengalihan dan perapian URL memakai *replace* sehingga tidak menjebak tombol Kembali. Beranda mengingat posisi gulirnya
per entri riwayat: kembali lewat tombol Kembali memulihkan posisi terakhir, sedangkan navigasi biasa mulai dari atas.

**Satu jalur hangat** (`src/platform/PlatformShell.tsx`): jalur yang pernah dibuka tetap ter-mount saat pengguna pulang
ke Beranda — hanya disembunyikan. Draf editor, sesi Playground, dan timer ujian tetap hidup; ujian yang waktunya habis
terkumpul sendiri walau pengguna sedang di Beranda, dan mesin SQL tidak dimuat ulang saat "Lanjutkan" ditekan.

### Beranda (landing)

Beranda (`src/platform/Home.tsx` + `src/platform/landing/`) **ringan**: tidak memuat sql.js/`.wasm` dan tidak mengimpor
data misi secara statis. Ringkasan progres diambil lewat impor dinamis (`src/tracks/sql/glance.ts`) yang hanya membaca
`localStorage`; bagian di bawah lipatan dimuat malas sebagai satu chunk (bila gagal diunduh, tampil pesan dengan tombol
*Coba muat lagi*); bola dunia (cobe) baru dimuat saat terlihat dan confetti saat pertama dipakai.

Isinya, dari atas ke bawah:

1. **Navbar** — menu Jalur / Fitur / Tentang, tombol utama, tombol **jeda animasi**, dan tombol tema.
2. **Hero** — "Belajar [kata berganti] gratis", angka kurikulum, bola dunia dengan penanda kota asal pasien pada data
   latihan, dan maskot **Kapi**. Pengguna baru melihat "Mulai belajar"; pengguna lama melihat "Lanjutkan" + misi yang akan
   dibuka, lalu kartu **Hari ini** (pangkat, XP, bilah kemajuan, ujian yang masih berjalan dengan jam mundur, latihan
   ulang jatuh tempo, saran Peta Kelemahan, streak). "Pulihkan" memulihkan progres dari file cadangan langsung dari Beranda.
3. **Pita berjalan** — topik SQL yang sudah ada dan teknologi jalur berikutnya (bertanda *Segera*).
4. **Peta jalur** — tab kelima jalur dan peta zig-zag 10 tier SQL. Untuk pengguna lama garis hijaunya berhenti di tier
   tempat misi "Lanjutkan" berada, dan tier sebelumnya diberi centang.
5. **Jelajahi 72 misi** — peta mini: satu kotak per misi, belah ketupat = Boss.
6. **Belajar sambil praktik** — peragaan lima jenis latihan (Query, Perbaiki Query, Tebak Hasil, Lab Injection,
   Playground) dengan misi sungguhan dari kurikulum. Peragaan ini tidak menjalankan SQL.
7. **Contoh keluaran** — korsel angka hasil query di database latihan.
8. **Naik pangkat** — tiga dari delapan pangkat.
9. **Setiap pelajaran berarti** — Streak, Pangkat, Misi & Boss, Lencana, Ujian, Latihan ulang, Peta Kelemahan.
10. **Macet?** — tab Perbedaan, hint bertahap, Show Solution, Peta Kelemahan.
11. **Belajar di layar mana pun**, 12. **FAQ**, 13. **CTA penutup**, 14. **Footer**.

**Isinya dijaga benar.** Semua teks dan angka landing berada di satu berkas (`src/platform/landing/lib/content.ts`), dan
`npm run verify` mencocokkannya dengan aplikasi: jumlah misi/tier/boss/materi/lencana/pangkat, XP, tabel & kota di
database latihan, contoh misi di peragaan (query, hasil, hint, perbedaan), label yang dikutip dari layar jalur, dan
daftar kata yang tidak boleh muncul karena fiturnya tidak ada. Peragaan yang bukan tiruan layar diberi keterangan —
mis. kalender di panel Streak hanya ilustrasi (aplikasi menyimpan angka streak, bukan riwayat per hari).

**Tema terang/gelap** hanya milik Beranda: atribut `data-theme` pada `<html>` menukar variabel CSS
(`src/platform/landing/styles/tokens.css`, kelas Tailwind berawalan `q-`). Pilihan disimpan di `localStorage`
(`simrs-quest:theme:v1`); sebelum pernah memilih, tema mengikuti `prefers-color-scheme`. Layar jalur selalu gelap, dan
atribut tema dilepas begitu Beranda ditinggalkan. Kontras tiap pasangan warna dihitung (WCAG AA) di `npm run verify`.

**Gerak**: animasi memakai framer-motion dan menghormati `prefers-reduced-motion`. Tombol jeda di navbar menghentikan
semua gerak yang berjalan sendiri (pita, kata berganti, bola dunia, maskot) tanpa bergantung pada pengaturan sistem, dan
gerak berulang berhenti sendiri saat berada di luar layar — halaman yang tidak sedang menganimasikan apa pun tidak
meminta satu frame pun.

### Keamanan data pengguna

- **Karantina** (`src/lib/storageGuard.ts`): bila nilai di `localStorage` ada tetapi tidak terbaca (JSON terpotong, bentuk
  ditolak), salinan mentahnya disimpan di `<kunci>:karantina` (maks. 3 salinan) sebelum aplikasi lanjut dengan data
  kosong — nilai aslinya tidak pernah dihapus diam-diam. Beranda menjalankan penjagaan ini saat dibuka dan menampilkan
  peringatan dengan tombol *Pulihkan dari file cadangan*.
- **Fixture emas** (`scripts/fixtures/storage-v1.json`, `backup-format1.json`): data pengguna versi 1 yang dibekukan.
  `npm run verify` memastikan setiap parser masih membacanya tanpa kehilangan data dan nama kunci tidak berubah. Bila
  bagian ini merah, perbaiki kodenya — jangan menyunting fixture.
- **Port dev tetap**: progres tersimpan per *origin*, dan `npm run dev` selalu memakai `http://localhost:5173`
  (`strictPort`; bila port itu terpakai, Vite berhenti dengan pesan jelas alih-alih pindah diam-diam ke port lain
  sehingga progres tampak "hilang"). Untuk mencoba-coba **tanpa menyentuh progres asli**, jalankan di port lain —
  origin lain berarti `localStorage` yang terpisah:

  ```bash
  npm run dev -- --port 5199
  ```

### Kunci localStorage

Semua kunci didefinisikan di `src/lib/storageKeys.ts`.

| Kunci | Isi |
|---|---|
| `simrs-sql-quest:progress:v1` | Progres jalur SQL: XP, streak, status tiap misi, misi terakhir |
| `simrs-sql-quest:mistakes:v1` | Riwayat Peta Kelemahan |
| `simrs-sql-quest:materi-read:v1` | Materi yang sudah dibuka |
| `simrs-sql-quest:exam-session:v1`, `simrs-sql-quest:exams:v1` | Sesi ujian/latihan yang berjalan, dan riwayatnya |
| `simrs-sql-quest:review:v1` | Jadwal latihan ulang |
| `simrs-sql-quest:achievements-seen:v1`, `simrs-sql-quest:brief-fold:v1` | Lencana yang sudah diumumkan; pilihan lipat Skenario & Tugas |
| `<kunci>:karantina` | Salinan nilai yang tidak terbaca (lihat di atas) |
| `simrs-quest:home-intro:v1` | Catatan sekali tampil di Beranda sudah dilihat |
| `simrs-quest:quarantine-ack:v1` | Peringatan karantina terakhir yang sudah ditutup |
| `simrs-quest:theme:v1` | Tema Beranda (`light` / `dark`) |

Awalan `simrs-sql-quest:` adalah nama produk lama dan sengaja dibiarkan: mengganti satu huruf saja berarti progres
pengguna yang sudah ada "hilang".

### Library

| Library | Dipakai untuk |
|---|---|
| `react`, `react-dom`, `vite`, `typescript`, `tailwindcss` 3.4 | Dasar aplikasi |
| `sql.js` | SQLite (WebAssembly) untuk jalur SQL — tidak dimuat di Beranda |
| `lucide-react` | Ikon |
| `framer-motion` | Animasi Beranda (muncul saat terlihat, indikator tab, parallax, angka hitung-naik) |
| `@radix-ui/react-accordion`, `-tabs`, `-navigation-menu`, `-dialog` | FAQ, tab, menu navbar, dan menu geser layar sempit yang bisa dipakai dengan keyboard |
| `embla-carousel-react`, `embla-carousel-autoplay` | Korsel contoh keluaran |
| `cobe` | Bola dunia hero (dimuat malas) |
| `canvas-confetti` | Confetti kecil saat peragaan dinilai benar (dimuat malas) |
| `@icons-pack/react-simple-icons` | Logo teknologi jalur berikutnya di pita berjalan |
| `clsx`, `tailwind-merge`, `class-variance-authority` | Penyusun kelas komponen Beranda |
| `@fontsource/inter`, `-jetbrains-mono`, `-varela-round`, `-orbitron` | Font yang disajikan dari origin sendiri (tanpa Google Fonts): Inter & JetBrains Mono untuk layar jalur, Varela Round & Orbitron untuk Beranda |

## Fitur

Bagian ini menjelaskan isi **jalur SQL**.


- **72 misi dalam 10 tier**, dari `SELECT` pertama sampai window function, transaksi, optimasi index, lab SQL injection,
  kartu konsep, **desain tabel (DDL)**, serta **fungsi tanggal, teks & JSON (FHIR/SATUSEHAT)**, masing-masing ditutup **Boss Challenge** (lihat [Kurikulum](#kurikulum)).
- **Enam jenis misi**:
  - 🟢 **Misi SQL**: tulis query di editor, hasilnya dinilai otomatis.
  - 🔴 **Perbaiki Bug**: editor sudah berisi query rekan kerja yang hasilnya salah (jumlah bug disebutkan). Temukan dan
    perbaiki bug-nya: string peka huruf besar/kecil, `ORDER BY` tanpa `DESC`, filter tabel kanan LEFT JOIN di `WHERE`,
    `COUNT(*)` pada LEFT JOIN, pembagian bilangan bulat, JOIN yang menggandakan baris (*fan-out*), `NOT IN` + `NULL`.
  - 🟠 **Tebak Hasil**: baca query tanpa menjalankannya, lalu pilih tabel hasil yang benar. Setiap pilihan yang salah
    adalah hasil query yang mewakili salah paham umum (mis. DISTINCT hanya kolom pertama, HAVING sebelum WHERE,
    `COUNT(*)` vs `COUNT(kolom)`, RANK vs DENSE_RANK vs ROW_NUMBER). Semua tabel dihitung langsung di database, jadi kunci
    jawabannya tidak mungkin salah ketik. Setelah benar, SQL di balik setiap pilihan dan urutan eksekusinya bisa ditelusuri.
  - 🟣 **Lab Keamanan** (SQL injection): ketik *input form* pada tiruan portal RS yang rentan, lalu bandingkan dengan mode aman (prepared statement).
  - 🔵 **Kartu Konsep**: materi + contoh kode T-SQL / PL/pgSQL / MySQL / bahasa aplikasi, ditutup kuis pilihan ganda.
  - 👑 **Boss Challenge** (satu per tier, di akhir tier): satu soal gabungan yang memadukan beberapa konsep tier itu
    beserta jebakannya (OR tanpa kurung, filter LEFT JOIN di `WHERE`, JOIN *fan-out*, `LIKE` yang tidak memakai index,
    urutan INSERT vs FOREIGN KEY, dan seterusnya). Aturannya:
    - terbuka setelah **semua** misi lain di tier itu selesai (termasuk kartu konsep), dan **tidak mengunci** tier berikutnya;
    - **tanpa hint** dan tanpa materi khusus (semua materi tetap boleh dibuka); panel kiri hanya merekap misi yang
      konsepnya diulang;
    - **Show Solution baru aktif setelah 3 percobaan** Run & Check (tetap membuat boss bernilai 0 XP);
    - XP besar: 100 / 200 / 300 / 350 / 400 / 400 / 450 / 500 (tier 8: menulis ulang prosedur T-SQL berbasis CURSOR
      menjadi satu query set-based) / 600 (tier 9: merancang modul rawat inap), dan **Final Boss** tier 10 bernilai 650 XP:
      dashboard pasien diabetes (umur, kunjungan, HbA1c terakhir dari JSON FHIR, daftar poli). Sebutan "Final Boss"
      otomatis jatuh ke boss tier terakhir (dan `npm run verify` memastikan judul data selaras);
    - di Peta Misi boss bertanda mahkota, dan tier yang boss-nya sudah dikalahkan mendapat mahkota di judulnya.
- **Sembilan cara penilaian** (lihat [Jenis penilaian](#jenis-penilaian)): hasil query, hasil + konstruksi wajib, isi tabel
  setelah DML, keberadaan index, query plan, target serangan, kuis, pilihan tabel (tebak hasil), dan **DDL** (struktur
  tabel + uji perilaku: INSERT/UPDATE yang harus diterima atau ditolak).
- **Umpan balik yang mendidik**:
  - Pesan error SQLite dijelaskan dalam Bahasa Indonesia (termasuk error transaksi, window function, CTE rekursif), pesan aslinya tetap ditampilkan.
  - Tab **Perbedaan** (default saat jawaban salah) menampilkan satu tabel diff: sel yang berbeda (`nilai kamu → seharusnya`),
    baris berlebih, baris yang kurang, baris yang urutannya salah (jumlah pindahan minimal), serta kolom yang salah nama,
    tertukar urutannya, berlebih, atau kurang. Baris yang sudah sama bisa disembunyikan. Tab *Hasil Kamu*, *Seharusnya*,
    dan *Berdampingan* tetap tersedia.
  - Query plan (`SCAN` vs `SEARCH ... USING INDEX`) ditampilkan berwarna.
  - Jika konstruksi wajib (mis. `OVER (...)`, `WITH RECURSIVE`, `BEGIN ... COMMIT`) belum dipakai, kamu tetap melihat hasilmu plus pesan apa yang kurang.
- **Editor SQL ala IDE**: syntax highlighting (nama tabel yang dikenal diberi warna sendiri), nomor baris, dan
  **autocomplete** seperti IntelliSense di SQL Server Management Studio. Saran muncul saat mengetik: keyword (termasuk frasa
  seperti `GROUP BY`, `LEFT JOIN`), fungsi (disisipkan dengan `()` dan caret di dalamnya, plus keterangan singkat), tabel,
  kolom, dan alias. Sarannya sadar konteks: setelah `FROM`/`JOIN` hanya tabel, setelah `p.` hanya kolom tabel ber-alias `p`,
  kolom tabel yang disebut di query didahulukan, alias kolom SELECT ditawarkan di `ORDER BY`/`GROUP BY`/`HAVING`, dan tidak
  muncul di dalam string atau komentar. `↑/↓` memilih, `Tab`/`Enter` menyisipkan (Ctrl+Z membatalkan), `Esc` menutup,
  `Ctrl + Space` memunculkan saran secara manual. Di Playground daftar tabelnya mengikuti tabel/view buatanmu.
  `Ctrl/⌘ + Enter` menjalankan query, `Tab` untuk indentasi (`Esc` lalu `Tab` untuk keluar dari editor).
- **Urutan Eksekusi** (di Playground dan di misi SQL): query ditulis mulai dari `SELECT`, tetapi dijalankan mulai dari
  `FROM`. Fitur ini menampilkan urutan tulis berdampingan dengan urutan jalan, lalu menelusuri setiap tahap
  (WITH → FROM → setiap JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT) lengkap dengan **tabel
  antara**: kolom baru dari JOIN disorot, baris yang dibuang WHERE bisa dilihat, grup diberi warna berselang, HAVING
  menampilkan nilai agregat dan status lolos/dibuang tiap grup, jumlah baris masuk → keluar di setiap tahap, serta catatan
  seperti "alias SELECT di WHERE hanya diizinkan SQLite" atau "window function dihitung di tahap SELECT". Setiap tahap
  adalah SELECT turunan yang benar-benar dijalankan (hanya membaca), dan tahap terakhir selalu query asli, jadi hasilnya
  identik dengan tombol Run. Di misi, data yang dipakai adalah database awal yang sama dengan data penilaian.
- **Materi** (tab di panel kiri, gratis tanpa penalti XP): 39 artikel untuk konsep tier 1–10 plus "Urutan Eksekusi Query",
  masing-masing berisi penjelasan singkat, 2–3 **contoh yang bisa dijalankan** di database SIMRS (Jalankan di tempat,
  buka di Playground, atau langsung lihat **Urutan Eksekusi**-nya), **jebakan umum**, dan kotak **Beda dialek** yang
  membandingkan SQLite dengan SQL Server, MySQL/MariaDB, PostgreSQL, dan Oracle (mis. `LIMIT` vs `TOP` vs
  `FETCH FIRST`, `||` vs `+`/`CONCAT`, `IFNULL`/`ISNULL`/`NVL`, pembagian bilangan bulat, urutan NULL, `WITH RECURSIVE`,
  `RETURNING`/`OUTPUT`, `MERGE`/`ON CONFLICT`, perintah melihat query plan, placeholder prepared statement, sintaks partisi). Contoh yang mengubah data (INSERT/UPDATE/DELETE/transaksi) tidak dijalankan
  di tempat; contoh itu dibuka di Playground yang bisa di-Reset Database. Setiap misi (tier 1–10) tertaut ke materinya, kecuali Boss Challenge yang sengaja tanpa materi khusus. Materi index & query sargable memakai contoh `EXPLAIN QUERY PLAN`
  yang menampilkan SCAN vs SEARCH; materi tier 8 melengkapi kartu konsep dengan demo yang bisa dijalankan di SQLite
  (filter opsional & ORDER BY dinamis tanpa SQL dinamis, solusi set-based pengganti cursor, rentang tanggal sebagai analog
  partition pruning). Misi yang materinya belum dibaca diberi penanda **"Konsep baru"** di atas tab (tidak
  dipaksa; status "sudah dibaca" diingat browser dan ikut direset bersama progres). Contoh sengaja memakai kasus lain dari
  soal, dan `npm run verify` memastikan hasilnya tidak sama dengan Expected Output misi terkait.
- **Mode Materi** (tombol di header, atau "Layar penuh" dari tab Materi): semua artikel per tier dengan **pencarian**
  (judul, isi, contoh, jebakan, dan sintaks dialek — mis. cari `TOP`, `NVL`, `ROLLBACK`), artikel tampil lebar, dan daftar
  misi tempat konsepnya dilatih (misi yang masih terkunci ditandai).
- **Peta Kelemahan** (mode **Progres** di header): setiap percobaan yang belum benar dicatat jenis kesalahannya — sintaks,
  nama tabel/kolom, agregat & GROUP BY, window function, kolom hasil, baris berlebih, baris kurang, nilai/perhitungan,
  pengurutan, konstruksi wajib, DML & transaksi, index & sargable, SQL injection, membaca query (tebak hasil), kuis
  konsep. Klasifikasinya memakai alasan penilaian (mis. jumlah baris lebih banyak → *baris berlebih*) dan pesan error
  SQLite. Halaman ini menampilkan:
  - **Saran berikutnya**: materi yang perlu dibaca dan misi yang perlu diselesaikan/dilatih ulang untuk 3 kelemahan teratas.
  - **Jenis kesalahan** sebagai bar horizontal (angka ditulis di sampingnya), bisa dibuka untuk melihat misi yang terlibat
    (✓ = sudah teratasi) dan materi terkait.
  - **Topik yang paling sering salah** (dikelompokkan per materi).
  - Ringkasan: misi selesai, total percobaan, persentase misi yang langsung benar, kesalahan 7 hari terakhir, dan progres per tier.

  Bobotnya: kesalahan ≤ 7 hari = 1, ≤ 30 hari = 0,5, lebih lama = 0,25, dan setengahnya bila misinya sudah diselesaikan
  setelah kesalahan itu — jadi kelemahan yang baru dan belum teratasi naik ke atas. Riwayat disimpan di `localStorage`
  (`simrs-sql-quest:mistakes:v1`, maks. 1000 kejadian) dan ikut terhapus saat progres direset. Percobaan di mode aman
  lab injection tidak dihitung sebagai kesalahan. Bila jenis kesalahan yang sama terjadi ≥ 3× dalam 7 hari, kartu jawaban
  salah menampilkan penanda kecil ("Kesalahan jenis *Baris kurang* sudah 3× …") dengan tautan ke materi yang paling relevan
  untuk misi itu dan ke Peta Kelemahan.
- **Mode Ujian** (tombol **Ujian** di header): soal acak dari misi yang sudah terbuka, tanpa hint dan tanpa tahu benar/salah
  sampai dikumpulkan — untuk menguji ingatan atau persiapan tes kerja.
  - **Pengaturan**: pilih tier, 5/10/15 soal, dan batas waktu 15/30/45 menit atau tanpa batas. Soal diambil dari misi SQL,
    Perbaiki Bug, DDL, dan Tebak Hasil yang sudah terbuka, disebar merata antar tier lalu diacak (kartu konsep, lab
    injection, dan boss tidak ikut).
  - **Selama ujian**: navigasi bebas antar soal lewat palet nomor (hijau = sudah diisi), query boleh **dijalankan** untuk
    melihat hasilnya di database bersih — tetapi tidak dinilai. Jawaban tersimpan otomatis; timer berbasis tenggat sehingga
    tetap berjalan walau halaman di-refresh, dan sisa waktunya terlihat di tombol Ujian di header dari mode mana pun.
  - **Kumpulkan** (atau otomatis saat waktu habis, termasuk saat kamu sedang di mode lain): semua jawaban dinilai dengan
    mesin yang sama seperti misi (lewat worker), lalu tampil **rapor**: nilai, per tier, per jenis kesalahan, dan tinjauan
    setiap soal (pesan penilaian, jawabanmu vs solusi referensi, tautan ke misinya).
  - Tidak memberi XP dan tidak mengubah status misi; jawaban salah dicatat di **Peta Kelemahan** (jawaban benar menandai
    kesalahan lama sebagai teratasi). Riwayat 20 ujian/latihan terakhir tersimpan dan bisa dibuka lagi.
- **Latihan ulang terjadwal** (kartu *Latihan ulang hari ini* di mode Ujian; jumlah yang jatuh tempo tampil sebagai lencana
  di tombol Ujian): setiap misi yang sudah selesai (SQL non-boss & Tebak Hasil) muncul lagi menurut sistem kotak Leitner.
  - Misi yang baru selesai jatuh tempo **besok**. Jawaban benar menaikkan kotak sehingga jaraknya makin panjang
    (1 → 3 → 7 → 14 → 30 → 60 hari); jawaban salah mengembalikannya ke kotak 0 (besok). Soal yang dilewati tidak mengubah
    jadwal. Ujian biasa ikut memperbarui jadwal dengan aturan yang sama.
  - Sesi berisi 5 atau 10 soal **tanpa batas waktu**, memakai tampilan Mode Ujian. Prioritasnya: paling lama terlambat,
    sering salah dalam 30 hari terakhir (Peta Kelemahan), dan sering gagal saat diulang.
  - Rapor menampilkan kapan setiap misi muncul lagi ("ulang 3 hari lagi"). Menyelesaikan sesi latihan ulang **atau** ujian
    dihitung sebagai hari aktif untuk **streak** 🔥 (tanpa XP).
  - Tanggal memakai tanggal lokal seperti streak. Jadwal tersimpan di `localStorage` (`simrs-sql-quest:review:v1`), ikut
    ekspor/impor cadangan, dan ikut terhapus saat progres direset.
- **Lencana pencapaian** (mode **Progres**): 23 lencana dalam 6 kategori — Perjalanan (misi pertama, Tier 1–3, DDL, JSON,
  lab injection, tuntas semua), Boss (boss pertama, sekali tebas, Final Boss, semua boss), Ketepatan (10 misi langsung benar,
  satu tier tanpa hint/solusi, bangkit dari 5 kesalahan), Konsistensi (streak 3/7/30 hari), Ujian & Ulang (ujian pertama,
  nilai 100, 20 jawaban benar di latihan ulang, kotak ulang tertinggi), dan Materi (10 artikel, semua artikel).
  - Semua lencana **dihitung dari data yang sudah ada** (progres, Peta Kelemahan, riwayat ujian, jadwal ulang, materi yang
    dibaca), jadi tidak ada data lencana tersendiri yang bisa rusak dan cadangan progres otomatis mencakupnya.
  - Lencana yang baru diraih diumumkan sekali lewat notifikasi kecil; yang belum diraih menampilkan kemajuannya (mis. 7/10).
    Pengguna lama dan progres hasil impor cadangan dicatat diam-diam, tanpa rentetan notifikasi.
- **Cadangan progres** (mode **Progres**, kartu *Cadangan progres*): semua progres hanya tersimpan di `localStorage` browser,
  jadi bisa hilang saat cache dibersihkan. **Ekspor ke file** mengunduh `simrs-sql-quest-progres-YYYY-MM-DD.json` berisi
  progres (XP, misi, streak), riwayat Peta Kelemahan, materi yang sudah dibaca, riwayat ujian, dan jadwal latihan ulang. **Impor dari file** di browser/komputer
  lain menampilkan ringkasan cadangan vs progres saat ini, lalu **mengganti** (bukan menggabung) progres dan memuat ulang
  halaman. File yang bukan cadangan, dibuat versi aplikasi yang lebih baru, atau progresnya rusak ditolak tanpa mengubah
  apa pun; riwayat kesalahan/materi/ujian yang rusak dibersihkan. Draf editor, ujian yang sedang berjalan, dan preferensi
  tampilan tidak ikut dicadangkan.
- **Tautan dari pesan error**: kartu error menampilkan "Pelajari penyebabnya" untuk error yang umum, mis. `misuse of
  aggregate` → HAVING & Urutan Eksekusi, `ambiguous column name` → JOIN, `misuse of window function` → window function,
  `constraint failed` → INSERT/UPDATE, `no transaction is active` → transaksi. Di mode Misi materinya dibuka di tab Materi.
- **Skenario & Tugas selalu terlihat** di paling atas panel kiri, di luar tab *Hint & Misi* / *Materi* / *Schema*.
  Teks yang panjang bisa dilipat (*Selengkapnya* / *Lipat*). Secara default Skenario dilipat ke 3 baris dan Tugas terbuka,
  dan pilihan ini diingat browser.
- **Hint bertahap** (mengurangi XP 20%) dan **Show Solution** (misi bernilai 0 XP), keduanya dengan konfirmasi lebih dulu.
- **Free Playground**: jalankan query apa saja (termasuk `INSERT`, `UPDATE`, `DELETE`, `CREATE INDEX`, `BEGIN/ROLLBACK`,
  `EXPLAIN QUERY PLAN`) pada database sesi, dengan 13 contoh siap pakai. Tombol **Reset Database** mengembalikan data awal.
- **Lab Performa — data besar** (Free Playground → *Data besar*): database dengan skema yang sama tetapi berisi 200.000
  kunjungan, ±300.000 diagnosa, ±190.000 tagihan, dan 5.000 pasien sintetis (2025–2026, deterministik), supaya selisih SCAN
  vs SEARCH terasa dalam milidetik — di data latihan yang hanya puluhan baris keduanya sama-sama instan.
  - Data dibangkitkan di **worker terpisah** saat pertama dipakai (beberapa detik, ±75 MB memori): database Playground,
    penilaian misi, dan worker penilaian tidak tersentuh, dan halaman tetap responsif.
  - **Jalankan & ukur**: skrip baca dijalankan 3 kali dan waktu **median**-nya ditampilkan bersama jumlah baris, cuplikan 50
    baris, dan **query plan** berlabel SCAN/SEARCH. Untuk skrip "CREATE INDEX + SELECT", waktu SELECT diukur sendiri dan
    waktu membuat index ditampilkan terpisah — supaya biaya membuat index tidak terbaca sebagai lambatnya query.
  - **Riwayat run** sebagai batang untuk membandingkan sebelum/sesudah, dan 6 percobaan siap pakai dalam tiga pasang:
    cari satu SEP tanpa/ dengan index (±20 ms → < 0,1 ms), laporan bulanan `strftime` vs rentang tanggal, dan `LIKE 'I2%'`
    vs index + rentang kode. Index buatanmu bertahan sampai **Reset data besar**.
  - Misi optimasi (CREATE INDEX, query sargable, boss Tier 7) punya tombol **Uji di data besar** yang membawa query di
    editor ke lab. Batas waktu lab 30 detik (lebih longgar dari 8 detik penilaian); bila terlampaui atau dihentikan, data
    besar dibuang dan disiapkan ulang pada run berikutnya.
- **Explain (visualisasi query plan)** di Playground: tombol **Explain** (`Ctrl/⌘ + Shift + Enter`) menampilkan
  `EXPLAIN QUERY PLAN` setiap statement sebagai **pohon langkah berwarna** — full scan, scan seluruh index, pencarian lewat
  index/PRIMARY KEY, index sementara (AUTOMATIC), pengurutan di memori (temp B-tree), subquery berkorelasi, nested loop
  JOIN — masing-masing dengan penjelasan berbahasa Indonesia, jumlah baris tabel, kolom index, ringkasan per statement, dan
  tips (mis. "kolom dibungkus fungsi", "LIKE tidak memakai index", pengecekan FOREIGN KEY per baris, efek `LIMIT`,
  saran `CREATE INDEX`). Saran index hanya ditampilkan bila SQLite terbukti akan memakainya (diuji di **salinan skema
  kosong** dalam SAVEPOINT yang di-rollback, jadi cepat walau tabelnya besar) dan bisa langsung dibuat dengan satu klik,
  lalu plan di-Explain ulang untuk dibandingkan. Query **tidak dijalankan** (hanya di-parse), jadi aman untuk
  `UPDATE`/`DELETE` (satu-satunya efek: `changes()` koneksi kembali 0, perilaku bawaan SQLite); skrip ber-`PRAGMA` ditolak
  karena sebagian PRAGMA berlaku saat parse. Plan ditandai usang bila SQL di editor atau database berubah, dan diberi
  catatan bila ada `CREATE/DROP/ALTER` sebelumnya di skrip yang belum di-Run.
- **Query macet tidak membuat halaman macet** (dua lapis pengaman):
  - **Batas baris**: result set yang melewati 100.000 baris dihentikan dengan pesan penyebabnya (biasanya CTE rekursif
    tanpa syarat berhenti atau JOIN tanpa syarat). Berlaku di mana pun query dijalankan.
  - **Web Worker + batas waktu 8 detik**: Run & Check misi, Kirim di lab injection, Run di Playground, dan Urutan
    Eksekusi (misi & Playground) dijalankan dulu di worker terpisah. Saat berjalan > 250 ms tampil indikator dengan tombol
    **Hentikan**; lewat 8 detik worker dihentikan otomatis dan dibuat ulang. Mesin SQL yang kehabisan memori juga
    diperlakukan sama (tidak pernah diulang di thread utama). Halaman tetap responsif dan database tidak tersentuh.
  - Di Playground, query dicoba di **salinan** database sesi (dikirim ke worker hanya saat isinya berubah). Skrip yang
    hanya membaca memakai hasil salinan itu; skrip pengubah data baru dijalankan sungguhan setelah terbukti selesai. Bila
    ada transaksi terbuka atau tabel TEMP (salinan tidak akan setara), query dijalankan langsung seperti biasa.
  - Bila browser tidak mendukung worker / worker gagal dimuat, aplikasi otomatis kembali ke eksekusi langsung.
- **Schema Explorer**: tabel, jumlah baris, kolom (PK, FK, NOT NULL), daftar index, contoh 5 baris, dan relasi antar tabel
  (termasuk relasi ke tabel sendiri pada `struktur_organisasi`).
- **Progres tersimpan** di `localStorage` browser (lihat [Kunci localStorage](#kunci-localstorage)).
- **Responsif**: dua kolom di layar lebar (± 40% / 60%), bertumpuk di ponsel.

## Cara menjalankan

Kebutuhan: Node.js 18 atau lebih baru (disarankan 20+).

```bash
npm install
npm run dev
```

Lalu buka http://localhost:5173. Port ini tetap (lihat [Keamanan data pengguna](#keamanan-data-pengguna)); untuk mencoba
tanpa menyentuh progres yang sudah ada, pakai `npm run dev -- --port 5199`.

Untuk build produksi:

```bash
npm run build     # typecheck + build ke folder dist/
npm run preview   # sajikan hasil build secara lokal (http://localhost:4173)
```

Isi `dist/` berupa file statis, termasuk `assets/sql-wasm-*.wasm`, dan bisa di-hosting di mana saja.
Server-nya harus menyajikan file `.wasm` dengan content type `application/wasm`.

## Kurikulum

| Tier | Nama | Misi | XP/misi | Jenis |
|---|---|---|---|---|
| 1 | Dasar Query | 1–5: SELECT, WHERE, LIKE, ORDER BY + LIMIT, DISTINCT · 6 tebak hasil DISTINCT · 7 perbaiki bug (teks & DESC) · **8 boss**: undangan skrining (OR + kurung, NOT LIKE, ORDER BY 2 kolom, LIMIT) | 50 (boss 100) | SQL, Tebak, Bug, Boss |
| 2 | Relasi & Agregasi | 9–13: INNER JOIN, LEFT JOIN, COUNT/GROUP BY, SUM/AVG, HAVING · 14 tebak hasil WHERE vs HAVING · 15 perbaiki bug LEFT JOIN + COUNT · **16 boss**: pasien BPJS jarang kontrol (filter LEFT JOIN di ON, COUNT(kolom), HAVING, termasuk yang 0 kunjungan) | 100 (boss 200) | SQL, Tebak, Bug, Boss |
| 3 | Kasus Nyata SIMRS | 17–21: rekap BPJS, SEP kosong, kinerja dokter, CASE WHEN, subquery · 22 tebak hasil COUNT(\*) vs COUNT(kolom) · 23 perbaiki bug pembagian bilangan bulat · 24 perbaiki bug JOIN fan-out · **25 boss**: rapor beban dokter (diagnosa + tagihan tanpa fan-out, CASE) | 150 (boss 300) | SQL, Tebak, Bug, Boss |
| 4 | CTE, JOIN Lanjutan & Rekursif | 26–31: MIN/MAX, CTE, FULL OUTER JOIN, CROSS JOIN, WITH RECURSIVE (hierarki & deret tanggal) · 32 perbaiki bug NOT IN + NULL · **33 boss**: matriks tanggal × gedung (deret rekursif, CROSS JOIN, LEFT JOIN, 0 bukan NULL) | 175 (boss 350) | SQL, Bug, Boss |
| 5 | Window Functions | 34–35, 37–38: ROW_NUMBER (deduplikasi), RANK + PARTITION BY, running total, LAG/LEAD · 36 tebak hasil RANK/DENSE_RANK/ROW_NUMBER · **39 boss**: dua tagihan teratas per poli (RANK, LAG, SUM OVER untuk persentase) | 200 (boss 400) | SQL, Tebak, Boss |
| 6 | DML & Transaksi | 40–44: INSERT, UPDATE, DELETE, BEGIN…COMMIT, ROLLBACK · **45 boss**: tutup shift malam (INSERT berurutan sesuai FOREIGN KEY, UPDATE dengan subquery, DELETE bersyarat, satu transaksi) | 200 (boss 400) | SQL (penilaian isi tabel), Boss |
| 7 | Optimasi & Keamanan | 46 CREATE INDEX, 47 query sargable, 48 injection tautologi, 49 injection UNION, 50 prepared statement · **51 boss**: registri jantung koroner (CREATE INDEX + rentang sargable, bukan `LIKE`) | 225 (boss 450) | SQL, Lab, Konsep, Boss |
| 8 | Konsep Prosedural & Skala Besar | 52 SQL dinamis, 53 cursor, 54 partisi tabel · **55 boss**: pensiunkan cursor lama (set-based: CTE + LAG + agregasi) | 100 (boss 500) | Konsep, Boss |
| 9 | Desain Tabel & DDL | 56 kartu konsep normalisasi · 57 CREATE TABLE + constraint (jadwal praktik) · 58 ALTER TABLE ADD COLUMN (metode bayar) · 59 UPSERT `ON CONFLICT` (sinkronisasi pasien) · 60 CREATE VIEW (tagihan) · 61 CREATE TRIGGER (jejak audit status bayar) · 62 perbaiki bug DDL (FOREIGN KEY ke kolom tak unik, CHECK) · **63 boss**: modul rawat inap (dua tabel + data + view) | 250 (boss 600) | Konsep, SQL (penilaian DDL), Bug, Boss |
| 10 | Fungsi Tanggal, Teks & JSON | 64 umur & kelompok usia (`strftime`) · 65 hari tersibuk (`strftime('%w')`, urut Senin–Minggu) · 66 masking NIK & nama panggilan (`substr`, `instr`, `upper`) · 67 `group_concat … ORDER BY` + agregat bersyarat · 68 hasil lab di luar rujukan dari JSON FHIR (`->>`) · 69 tebak hasil `->` vs `->>` · 70 tekanan darah dari array `component` (`json_each` + pivot, jangan andalkan `[0]`) · 71 perbaiki bug `BETWEEN` pada kolom tanggal+jam · **72 Final Boss**: dashboard pasien diabetes | 275 (boss 650) | SQL, Tebak, Bug, Boss |

**Total XP: 14800**: 10850 dari misi biasa (7×50 + 7×100 + 8×150 + 7×175 + 5×200 + 5×200 + 5×225 + 3×100 + 7×250 +
8×275) ditambah 3950 dari boss (100 + 200 + 300 + 350 + 400 + 400 + 450 + 500 + 600 + 650).

### Teknik mana yang dipraktikkan langsung, mana yang hanya konsep?

| Teknik | Cara belajar | Alasan |
|---|---|---|
| SELECT, JOIN (termasuk FULL OUTER & CROSS), agregasi, subquery, CTE, CTE rekursif | ✅ Dijalankan & dinilai otomatis | Didukung penuh SQLite 3.54 |
| Window function (ROW_NUMBER, RANK, SUM OVER, LAG/LEAD) | ✅ Dijalankan & dinilai otomatis | Didukung sejak SQLite 3.25 |
| INSERT / UPDATE / DELETE, transaksi BEGIN/COMMIT/ROLLBACK | ✅ Dijalankan, dinilai dari isi tabel | Didukung; setiap penilaian memakai DB segar |
| Index & query sargable | ✅ Dijalankan, dinilai dari `EXPLAIN QUERY PLAN` | SQLite menampilkan SCAN/SEARCH dengan jelas |
| SQL injection & pencegahannya | ✅ Lab interaktif (form simulasi) + kartu konsep | Bukan soal menulis query, melainkan menyerang/menutup celah aplikasi |
| SQL dinamis (`sp_executesql`, `EXECUTE format()`, `PREPARE`) | 📘 Kartu konsep + kuis | SQLite tidak punya stored procedure / `EXEC` |
| Cursor (`DECLARE CURSOR`, `FETCH`, `FOR ... LOOP`) | 📘 Kartu konsep + kuis | SQLite tidak punya bahasa prosedural (T-SQL / PL/pgSQL) |
| CREATE TABLE + constraint, ALTER TABLE, UPSERT, VIEW, TRIGGER | ✅ Dijalankan, dinilai dari struktur + uji perilaku | Didukung SQLite 3.54 (CHECK, FOREIGN KEY, ADD COLUMN, `ON CONFLICT`, trigger per baris) |
| Fungsi tanggal & teks, `group_concat`, JSON (`->>`, `json_extract`, `json_each`, `json_object`) | ✅ Dijalankan & dinilai otomatis | Bawaan SQLite 3.54 (JSON1 & `group_concat … ORDER BY` sejak 3.44) |
| Normalisasi (1NF–3NF, denormalisasi) | 📘 Kartu konsep + kuis | Keputusan desain, bukan satu query; dipraktikkan di misi DDL dan Final Boss |
| Partisi tabel (`PARTITION BY RANGE`) | 📘 Kartu konsep + kuis | SQLite tidak mendukung partisi tabel |

Contoh kode di kartu konsep ditulis untuk SQL Server, PostgreSQL, MySQL, dan bahasa aplikasi (Node.js, PHP, Java, Python).
Contoh tersebut **tidak dijalankan** di browser; pemahamannya diuji lewat kuis.

## Jenis penilaian

| Jenis | Dipakai di | Cara kerja |
|---|---|---|
| **result** | Tier 1–5 (termasuk misi Perbaiki Bug & boss), misi 47, boss tier 8 | Result set **terakhir** query kamu dibandingkan dengan hasil `solutionSql`. Nama kolom tidak peka huruf besar/kecil, angka boleh selisih ±0,01, urutan baris hanya dinilai bila soal meminta `ORDER BY`. |
| **result + konstruksi wajib** | Tier 4–7 | Pemeriksaan tambahan di atas jenis lain: setelah hasil cocok, SQL kamu (tanpa komentar & string) dicek memakai konstruksi yang dilatih, mis. `WITH RECURSIVE`, `OVER (` / `OVER nama_window`, `FULL OUTER JOIN`. Jika belum, alasannya `missing-construct`. |
| **state** | Tier 6 (termasuk boss 45) | `solutionSql` dijalankan di DB segar A, SQL kamu di DB segar B, lalu `verifySql` (membaca **seluruh** tabel terdampak) dibandingkan. `UPDATE`/`DELETE` tanpa `WHERE` pasti ketahuan. Isi **semua** tabel lain juga dibandingkan, jadi perubahan nyasar ke tabel yang tidak ditampilkan ikut tertangkap. Transaksi yang dibiarkan terbuka (BEGIN tanpa COMMIT/ROLLBACK) dinilai salah (`open-transaction`). Misi transaksi (43–44 dan boss 45) dilacak per statement: perubahan di luar BEGIN … COMMIT, atau ROLLBACK yang tidak membatalkan apa pun, dinilai salah (`transaction-flow`). |
| **index** | Misi 46 | Setelah SQL kamu, harus ada index biasa (bukan partial index) di tabel yang diminta dengan kolom pertama yang tepat (`index-missing`), isi tabel tidak boleh berubah, dan `EXPLAIN QUERY PLAN` dari query uji harus berubah dari `SCAN` menjadi `SEARCH ... USING INDEX` (`plan-scan`). |
| **schema** (DDL) | Misi 57, 58, 60, 61, 62 dan boss 63 | `solutionSql` di DB segar A, SQL kamu di DB segar B. (1) Setiap objek yang diminta harus ada dengan jenis yang benar — tabel, view (bukan `CREATE TABLE … AS SELECT`), atau trigger di tabel yang tepat (`schema-object`). (2) Struktur tabel dibandingkan dengan hasil solusi: kolom, **afinitas** tipe (VARCHAR = TEXT, tetapi DATE = NUMERIC), NOT NULL, PRIMARY KEY, FOREIGN KEY (`REFERENCES t` tanpa kolom = PK induk), UNIQUE (constraint maupun `CREATE UNIQUE INDEX`; urutan kolom tidak berpengaruh) — perbedaannya ditampilkan berdampingan (`schema-structure`). (3) Serangkaian **uji perilaku** (INSERT/UPDATE/DELETE) dijalankan berurutan di A dan B dan harus sama-sama diterima/ditolak, sehingga CHECK, DEFAULT, dan isi trigger dinilai dari perilakunya, bukan dari cara menulisnya (`probe-mismatch`, uji pertama yang berbeda disebut nomornya). (4) Isi akhir (`verifySql`) dan seluruh tabel seed dibandingkan. Misi 59 (UPSERT) memakai **state** + konstruksi wajib `ON CONFLICT`. |
| **plan** (result + `requireIndexOn`) | Misi 47 dan boss 51 | Hasil harus benar **dan** plan statement terakhir harus melakukan `SEARCH` pada tabel itu lewat index yang diawali kolom yang diminta, dengan kesamaan (`col=?`) atau rentang dua sisi (`col>? AND col<?`). Full SCAN, index lain, rentang satu sisi, atau kolom yang masih dibungkus fungsi (mis. `strftime(...)`) dinilai `plan-scan`. `SCAN ... USING INDEX` tetap dihitung full scan. |
| **injection** | Misi 48–49 | Input form disambung mentah ke template SQL rentan (mode rentan) atau di-bind ke placeholder `?` (mode aman). Target tercapai jika result set terakhir memenuhi syarat (jumlah baris minimal / memuat nilai tertentu / memuat semua nilai dari query pembanding) dan, bila ditentukan, SQL rentan memuat konstruksi wajib (mis. `FROM billing`, agar nilai target tidak sekadar diketik). Di mode aman serangan selalu gagal, dan itulah pelajarannya. |
| **quiz** | Misi 50, 52–54 | Semua soal pilihan ganda harus dijawab benar. Setiap soal punya penjelasan. |
| **predict** (tebak hasil) | Misi 6, 14, 22, 36, 69 | Pilihan tabel yang dipilih harus hasil `query` misi. Tabel pengecoh dihitung dari SQL pengecoh di DB seed; jika salah, salah paham di balik pilihan itu langsung dijelaskan (`predict-wrong`). |

Semua penilaian memakai **database seed segar** dan ditutup setelahnya, jadi percobaan destruktif (termasuk payload
`'; DROP TABLE ...` di lab injection) tidak merusak soal lain maupun database playground.

## Skema database

Database dummy berisi 8 tabel dengan data fiktif (20 pasien, 32 kunjungan Oktober–November 2026, 16 log SATUSEHAT):

| Tabel | Kolom | Keterangan |
|---|---|---|
| `pasien` | **no_rm** (PK), nik (UNIQUE), nama, jenis_kelamin (`L`/`P`), tgl_lahir, kota, penjamin (`BPJS`/`Umum`/`Asuransi`) | Master pasien |
| `poliklinik` | **id_poli** (PK), nama_poli, gedung | Poliklinik rawat jalan |
| `dokter` | **id_dokter** (PK), nama_dokter, spesialisasi, id_poli → poliklinik | Dokter & tempat praktik |
| `kunjungan` | **no_rawat** (PK), no_rm → pasien, id_poli → poliklinik, id_dokter → dokter, tgl_kunjungan, no_sep (boleh NULL), status (`Selesai`/`Dirawat`/`Batal`) | Registrasi kunjungan |
| `diagnosa` | **id_diagnosa** (PK), no_rawat → kunjungan, kode_icd10, nama_penyakit, jenis (`Primer`/`Sekunder`) | Diagnosa ICD-10 |
| `billing` | **id_billing** (PK), no_rawat → kunjungan (UNIQUE), total_biaya (≥ 0), status_bayar (`Lunas`/`Belum Lunas`) | Tagihan per kunjungan |
| `struktur_organisasi` | **id_jabatan** (PK), nama_jabatan, nama_pejabat, id_atasan → struktur_organisasi (NULL = pucuk pimpinan) | 19 jabatan, kedalaman maks. 5 (Direktur Utama → Wadir → Kabid → Ka. Instalasi → Koordinator). Untuk latihan `WITH RECURSIVE`. |
| `satusehat_log` | **id_log** (PK), no_rawat → kunjungan, resource_type, payload (JSON, `CHECK json_valid`), status_kirim (`Terkirim`/`Gagal`/`Antri`), waktu_kirim (tanggal+jam, NULL bila antri), response (JSON OperationOutcome bila gagal) | 16 resource FHIR Observation: hasil lab (glukosa, HbA1c, kolesterol, leukosit, trombosit) dan tekanan darah (array `component`, satu data sengaja diastolik lebih dulu), termasuk 2 kiriman gagal yang dikirim ulang 31 Oktober. Untuk latihan JSON. |

Relasi antar tabel:

```
pasien.no_rm                    ◄── kunjungan.no_rm
poliklinik.id_poli              ◄── kunjungan.id_poli
poliklinik.id_poli              ◄── dokter.id_poli
dokter.id_dokter                ◄── kunjungan.id_dokter
kunjungan.no_rawat              ◄── diagnosa.no_rawat     (1 kunjungan : banyak diagnosa)
kunjungan.no_rawat              ◄── billing.no_rawat      (1 kunjungan : maks. 1 tagihan)
struktur_organisasi.id_jabatan  ◄── struktur_organisasi.id_atasan  (hierarki atasan-bawahan)
kunjungan.no_rawat              ◄── satusehat_log.no_rawat (1 kunjungan : banyak resource FHIR)
```

**Index**: selain index otomatis untuk PRIMARY KEY/UNIQUE, ada index eksplisit `idx_kunjungan_no_rm`,
`idx_kunjungan_tgl` (tgl_kunjungan), `idx_kunjungan_dokter`, dan `idx_diagnosa_no_rawat`.
`diagnosa(kode_icd10)`, `pasien(nama)`, dan `billing(status_bayar)` **sengaja tidak diberi index** (dipakai di misi optimasi dan contoh playground).

Tanggal disimpan sebagai teks `YYYY-MM-DD`, jadi bisa dibandingkan langsung (`tgl_kunjungan >= '2026-11-01'`).
`PRAGMA foreign_keys = ON` aktif, sehingga pelanggaran relasi di playground akan ditolak.

## Aturan XP, rank, streak & hint

**XP per misi**: Tier 1 = 50, Tier 2 = 100, Tier 3 = 150, Tier 4 = 175, Tier 5–6 = 200, Tier 7 = 225, Tier 8 = 100, Tier 9 = 250, Tier 10 = 275. Boss Challenge: 100 / 200 / 300 / 350 / 400 / 400 / 450 / 500 / 600, Final Boss 650 (total 14800 XP).

| Kondisi saat misi pertama kali diselesaikan | XP yang didapat |
|---|---|
| Tanpa bantuan | 100% |
| Pernah membuka hint (berapa pun langkahnya) | 80% (dibulatkan), penalti 20% |
| Pernah membuka solusi (misi SQL: query referensi, lab: contoh payload, kartu konsep & tebak hasil: "Tandai Jawaban") | 0 XP |

- XP hanya diberikan pada penyelesaian **pertama**. Mengulang misi yang sudah selesai tidak menambah XP.
- Membuka hint atau solusi **setelah** misi selesai tidak mengurangi XP yang sudah didapat.
- Sebelum hint pertama dan sebelum membuka solusi, muncul konfirmasi yang menjelaskan konsekuensi XP-nya.
- Di lab injection, misi selesai hanya jika serangan berhasil di **mode rentan**.

**Rank** (berdasarkan total XP):

| Rank | Minimal XP |
|---|---|
| 🩺 IT Intern | 0 |
| 💻 Junior Programmer RS | 300 (≈ Tier 1 tuntas) |
| 🏥 SIMRS Engineer | 1100 (≈ Tier 2 tuntas) |
| 🏆 Senior Healthcare Dev | 2600 (≈ Tier 3 tuntas) |
| 🗄️ Database Specialist RS | 5000 (≈ Tier 5 tuntas) |
| 🧠 Health Informatics Architect | 8000 (≈ Tier 7 tuntas) |
| 👑 Kepala Instalasi SIMRS | 10200 (≈ Tier 9 tuntas) |
| 🛰️ Direktur Transformasi Digital RS | 12500 (≈ Tier 10 tuntas) |

Ambangnya disusun dari XP kumulatif di akhir setiap tier (termasuk boss), dengan kelonggaran untuk penalti hint: rank
tertinggi tetap tercapai walau semua misi biasa memakai hint (10850 × 0,8 + 3950 XP boss = 12630 XP), tetapi tidak bila
banyak solusi dibuka.

**Streak 🔥** dihitung dari hari (tanggal lokal) berturut-turut kamu aktif: menyelesaikan minimal satu misi, **atau**
menyelesaikan satu sesi latihan ulang / ujian yang berisi minimal satu jawaban yang dinilai:

- Jawaban benar pada hari yang sama tidak menambah streak.
- Jawaban benar keesokan harinya menambah streak +1.
- Jika ada hari yang terlewat, streak dimulai lagi dari 1.

**Membuka misi**: misi pertama selalu terbuka, dan misi SQL/lab berikutnya terbuka setelah misi sebelumnya selesai.
**Kartu konsep selalu terbuka** (materi bacaan), jadi boleh dibaca kapan saja. **Boss Challenge** terbuka setelah semua
misi lain di tier-nya selesai, dan tidak mengunci tier berikutnya (boss bersifat tantangan, bukan gerbang). Boss tidak
punya hint; Show Solution baru aktif setelah 3 percobaan.

## Skrip npm

| Skrip | Fungsi |
|---|---|
| `npm run dev` | Menjalankan dev server Vite dengan hot reload. |
| `npm run build` | `tsc --noEmit`, lalu `vite build` ke `dist/`. |
| `npm run preview` | Menyajikan hasil build. |
| `npm run typecheck` | Pemeriksaan tipe TypeScript (strict) tanpa build. |
| `npm run verify` | Verifikasi seluruh kurikulum, platform, dan isi Beranda di Node (lihat di bawah). |
| `npm run e2e` | Uji end-to-end di Chrome/Edge sungguhan, headless (lihat [Uji E2E](#uji-e2e-di-browser)). Tambahkan `-- --preview` untuk menguji build produksi, atau `-- --only=boss,backup` untuk suite tertentu. |

`npm run verify` (`scripts/verify-missions.ts` + modul `scripts/verify/`) memeriksa:

- **Kurikulum** (`curriculum.ts`): 72 misi, id unik kebab-case, `order` 1–72 kontigu, jumlah misi & jenis per tier
  (termasuk jumlah misi Perbaiki Bug; tier 9 hanya grading `schema`/`state`), XP per tier, total 14800, 2–3 hint (boss: tanpa hint), tepat satu boss per tier di
  posisi terakhir yang tidak ditautkan dari materi dan `combines`-nya merujuk misi yang ada, aturan buka-kunci boss
  (terkunci sampai semua misi tier-nya selesai, tidak mengunci tier berikutnya, solusi terkunci sampai 3 percobaan), tidak ada field kosong; misi Perbaiki Bug punya
  `bugCount` ≥ 1, query awal ≠ solusi, dan tugasnya menyebut jumlah bug.
- **Tebak hasil** (`predictMissions.ts`): query & pengecoh hanya SELECT satu statement, 2–3 pengecoh, setiap tabel tidak
  kosong dan kecil (≤ 10 baris, ≤ 4 kolom), semua pilihan berbeda satu sama lain menurut aturan penilaian, urutan pilihan
  stabil.
- **Misi DDL** (`sqlMissions.ts`, grading `schema`): solusi benar-benar membuat/mengubah setiap objek, minimal 3 uji perilaku
  (masing-masing satu statement) dengan setidaknya satu yang diterima dan satu yang ditolak solusi, `verifySql` tidak kosong
  dan tanpa baris kembar, `SELECT 1` dinilai `schema-object`/`schema-structure`, dan solusi sendiri dinilai benar. Kasus
  uji Tier 9 (`scripts/test-cases/tier9.ts`) memastikan constraint yang hilang/terlalu longgar/tipe keliru ditolak, dan
  cara penulisan lain yang setara (constraint tabel vs kolom, CONSTRAINT bernama, CREATE UNIQUE INDEX, REFERENCES tanpa
  kolom, VARCHAR, BEFORE vs AFTER trigger) diterima.
- **Misi SQL** (`sqlMissions.ts`): solusi dinilai `correct`; `SELECT 1`, query kosong, dan syntax error ditolak;
  setiap kolom hasil disebut di teks tugas; `orderMatters` wajib punya `ORDER BY` yang **deterministik**
  (dicek ulang di DB dengan urutan fisik baris dibalik, jadi tie tanpa tie-breaker ketahuan); `requiredPatterns` valid dan dipenuhi solusi;
  misi `state` benar-benar mengubah tabel dan solusi tanpa COMMIT terdeteksi `open-transaction`;
  misi `index` berubah dari SCAN menjadi SEARCH; misi plan memakai index.
- **Lab & konsep** (`labMissions.ts`): template rentan memuat `{input}`, template aman tepat satu `?`; input contoh tidak
  memenuhi target dan memberi jumlah baris yang sama di kedua mode; payload solusi berhasil di mode rentan dan gagal di mode aman;
  payload bertumpuk tidak merusak percobaan berikutnya; struktur materi & kuis valid.
- **Kasus uji** (`testCases.ts`, data di `scripts/test-cases/`): jawaban "hampir benar" harus ditolak (sebagian dengan alasan
  yang dikunci, mis. `row-order`, `missing-construct`, `plan-scan`), formulasi setara harus diterima.
  Tier 4–7: minimal 2 kasus salah & 1 setara per misi. Misi `state` wajib menguji `UPDATE`/`DELETE` tanpa `WHERE`,
  dan misi transaksi wajib menguji transaksi yang dibiarkan terbuka. Boss: minimal 3 jebakan ditolak & 2 cara pengerjaan
  lain diterima (boss tanpa hint tidak boleh menuntut satu bentuk query), dan query awalnya tidak boleh lolos. Query bermasalah misi Perbaiki Bug harus dinilai
  salah, begitu juga perbaikan yang baru membereskan sebagian bug.
- **Isolasi mutasi**: query destruktif tidak memengaruhi penilaian berikutnya.
- **Diff hasil** (`resultDiff.ts`): kasus unit (sel berbeda, kurang/berlebih, urutan, kolom salah nama/tertukar/
  berlebih/kurang, duplikat, NULL, toleransi angka) dan konsistensi dengan penilaian untuk seluruh jawaban di
  `scripts/test-cases`: jawaban yang ditolak karena isi tabel harus terlihat berbeda di diff, jawaban setara harus identik.
- **Explain / query plan** (`planTree.ts`): 67 kasus tertarget untuk tiap bentuk plan (full scan, rowid, autoindex PK,
  COVERING, MIN/MAX dengan & tanpa index, temp B-tree, nested loop, CROSS JOIN, AUTOMATIC INDEX + saran ber-quote/unik,
  COLLATE NOCASE, subquery berkorelasi, IN/NOT IN, MULTI-INDEX OR, CTE/window/rekursif, UNION ALL, FULL OUTER JOIN,
  self-join, alias ambigu/ber-kutip/di view/di tabel turunan/di CTE, cek FOREIGN KEY termasuk ke tabel sendiri, partial index,
  LIMIT dengan/tanpa filter, tabel TEMP/FTS4/nama berspasi, `CREATE TABLE … AS` tanpa batas yang tidak boleh dijalankan); skrip campuran DML/DDL/transaksi tidak mengubah database (juga di dalam transaksi user
  yang terbuka); saran index yang diterapkan benar-benar mengubah plan; PRAGMA & SQL kosong ditolak; batas 20 statement;
  serta sapuan seluruh solusi misi + jawaban test case: tidak boleh ada baris plan yang tak dikenali.
- **Urutan eksekusi** (`execSteps.ts`): kasus unit (urutan langkah, JOIN bertahap, koma = CROSS JOIN, alias SELECT di
  WHERE/GROUP BY, kolom tabel lebih diutamakan daripada alias, GROUP BY posisi, agregat tanpa GROUP BY, window function,
  DISTINCT, CTE, komentar di tengah klausa, subquery, tabel turunan, skrip multi-statement; UNION/UPDATE/error/kosong ditolak
  dengan pesan) dan sapuan seluruh SELECT kurikulum (solusi, query bermasalah, query & pengecoh tebak hasil, jawaban test
  case): tidak ada langkah error, langkah terakhir identik dengan hasil query asli, WHERE lolos + dibuang = masuk.
- **Materi** (`materi.ts`): id unik, ≥ 2 bagian, jebakan umum, kelima dialek terisi, misi yang ditautkan ada, setiap misi
  punya materi; setiap contoh dijalankan (contoh di tempat: hanya SELECT, tidak kosong, ≤ 30 baris) dan hasilnya
  tidak boleh sama dengan Expected Output misi terkait maupun sama persis dengan solusi misi mana pun. Contoh Playground
  (DML) harus berjalan di DB segar dan tidak boleh menghasilkan kondisi tabel yang sama dengan solusi misi `state`
  terkait, tidak boleh membuat index yang diminta misi `index`, dan contoh tidak boleh memuat payload solusi lab injection. Pola tautan error diuji dengan error SQLite sungguhan, dan pencarian diuji dengan kata kunci contoh. Contoh materi juga ikut diuji di
  sapuan urutan eksekusi.
- **Peta kelemahan** (`weakness.ts`): setiap jawaban salah di `scripts/test-cases` diklasifikasikan sesuai alasan
  penilaiannya (termasuk arah *baris berlebih/kurang*), jawaban benar tidak dicatat, error SQLite sungguhan dipetakan ke
  jenis yang tepat, dan laporan diuji untuk bobot kebaruan, status teratasi, urutan, rekomendasi, statistik, serta data
  rusak/usang yang harus diabaikan.
- **Eksekusi terlindungi** (`worker.ts`): logika worker (`handleRequest`) menghasilkan hasil identik dengan pemanggilan
  langsung dan bisa di-structured-clone; salinan DB sesi melihat tabel buatan user, tidak menumpuk perubahan, menegakkan
  FOREIGN KEY, dan meminta salinan ulang bila versinya tidak dipegang; snapshot ditolak saat transaksi terbuka / ada
  objek TEMP dan koneksi tetap utuh; error fatal mesin SQL dikenali; rekursi tanpa henti dihentikan batas baris; dan
  `isReadOnlyScript` untuk 11 kasus. (Batas waktu & tombol Hentikan diuji di Chrome sungguhan lewat `npm run e2e`.)
- **Cadangan progres** (`backup.ts`): ekspor → impor menghasilkan isi storage yang sama (progres lama diganti), ekspor dari
  storage kosong/rusak tetap valid, file bukan JSON / aplikasi lain / format lebih baru / progres rusak ditolak dengan
  pesan yang jelas, bagian opsional yang rusak dibersihkan, dan kegagalan penyimpanan dilaporkan.
- **Mode ujian** (`exam.ts`): soal yang boleh keluar (hanya misi terbuka; tanpa kartu konsep, lab, dan boss), sebaran soal
  mewakili setiap tier yang punya soal (25 seed acak), soal unik dan benar-benar acak antar sesi, jumlah soal menyesuaikan
  bila kurang, tenggat & sisa waktu, jawaban awal dihitung belum dijawab, ringkasan rapor, sesi/riwayat tersimpan yang
  rusak atau berisi misi tak dikenal dibuang, riwayat dibatasi 20, dan riwayat ujian ikut ekspor/impor cadangan.
- **Latihan ulang** (`review.ts`): aritmetika tanggal lokal (akhir bulan/tahun, kabisat, DST), kartu bawaan dari tanggal
  selesai (misi belum selesai, boss, dan kartu konsep tidak diulang), urutan prioritas (keterlambatan + kesalahan 30 hari
  terakhir + kegagalan), aturan kotak (benar naik sampai kotak 5 / 60 hari, salah kembali ke besok, dilewati tidak berubah),
  sesi review tanpa batas waktu dengan urutan prioritas, streak dari aktivitas (sekali per hari, tanpa XP), validasi deck
  tersimpan, dan jadwal ikut cadangan.
- **Lencana** (`achievements.ts`): id unik, tidak ada lencana bertarget 0, progres kosong tidak meraih apa pun, kurikulum
  tuntas tanpa bantuan meraih semua lencana perjalanan/boss/ketepatan/streak, aturan khusus (boss 3 percobaan bukan "Sekali
  Tebas", satu hint membatalkan "Mandiri", benar sebelum kesalahan terakhir bukan "bangkit", ujian sempurna harus ≥ 5 soal
  dan tanpa soal kosong, latihan ulang dihitung terpisah dari ujian), dan impor cadangan mengosongkan daftar yang diumumkan.
- **Lab Performa** (`perfLab.ts`): data besar selesai dibangkitkan di bawah batas waktu, jumlah baris tepat, **tanpa
  pelanggaran FOREIGN KEY**, tersebar di 730 tanggal, data seed asli tetap ada; pengukuran menghitung semua baris tetapi
  hanya menyimpan cuplikan; setiap pasang percobaan bawaan berubah dari SCAN ke SEARCH dengan **hasil yang sama** dan
  **waktu lebih cepat**; waktu membuat index dipisah dari waktu SELECT; lewat worker, database besar dibuat saat pertama
  dipakai, bertahan antar-permintaan, dan hilang setelah reset.
- **Autocomplete** (`sqlComplete.ts`): konteks tabel/kolom/alias/CTE, kualifier `alias.`, prioritas kolom tabel yang disebut,
  diam di dalam string/komentar, fungsi disisipkan dengan `()`.
- **Fixture emas** (`fixtures.ts`): nama kunci storage tidak berubah, setiap parser membaca `scripts/fixtures/storage-v1.json`
  tanpa kehilangan data, file cadangan format 1 masih diterima dan memulihkan storage yang sama, dan ringkasan Beranda
  dari fixture itu memberi angka yang ditetapkan.
- **Platform** (`platform.ts`): router (hash apa pun → rute, tanpa melempar; bentuk kanonik), registri jalur (yang tersedia
  wajib punya `load` & `glance`, yang *segera* tidak), karantina (salinan mentah, maks. 3, tidak pernah melempar), aturan
  "Lanjutkan", ringkasan Beranda untuk storage kosong/rusak/diblokir (hanya membaca), penjaga data yang dijalankan Beranda
  (mengkarantina setiap kunci yang dijaga tanpa mengubah kunci aslinya), dan **bundel awal tetap ringan**: berkas yang
  terjangkau secara statis dari `src/main.tsx` tidak boleh memuat data misi, sql.js, cobe, atau canvas-confetti.
- **Landing** (`landing.ts`): angka di `content.ts` sama dengan kurikulum; tabel, jumlah baris, kota pasien, dan cuplikan
  tabel sama dengan hasil seed; daftar jalur & tautan cocok dengan registri dan router; contoh misi di peragaan dihitung
  ulang (query, hasil, hint pertama/kedua, baris bug, tab Perbedaan, jenis kesalahan); klaim tentang Boss, Mode Ujian,
  dan pangkat diuji terhadap aturan aplikasi; **label yang dikutip** (nama tab pembanding, judul sukses, nama mode, tombol
  cadangan, alat Playground) dicocokkan dengan komponennya; **kata terlarang** dicari di `content.ts` dan semua berkas
  landing (hal yang tidak ada di aplikasi: akun, toko aplikasi, papan peringkat, asisten AI, testimoni, dan sejenisnya);
  **kontras** tiap pasangan token warna lolos WCAG AA di tema terang dan gelap; dan berkas landing tidak memakai varian
  `dark:` Tailwind.

### Uji E2E di browser

`npm run e2e` (`scripts/e2e/`) menjalankan aplikasi sendiri lewat API Vite (server dev, atau build produksi + preview
dengan `--preview`) pada port bebas, membuka Chrome/Edge headless lewat DevTools Protocol dengan profil sementara, lalu
menjalankan setiap suite dari browser bersih. Tidak ada dependensi tambahan: cukup Node ≥ 22 dan Chrome atau Edge
terpasang (lokasi lain: set `CHROME_PATH`). Server, browser, dan folder sementara selalu dibereskan di akhir.

| Suite | Yang diuji |
|---|---|
| `home` | Beranda & shell platform: Beranda bersih (satu h1, tanpa `.wasm`, tanpa gulir horizontal di 1400/390/320 px, tombol utama tidak mencuri fokus pengunjung baru sehingga Spasi tetap menggulir), masuk jalur lalu pulang dengan jalur tetap hangat (draf editor, Back/Forward), ringkasan pengguna lama (kartu "Hari ini" di lipatan pertama dengan pangkat, XP, dan bilah kemajuan; Enter melanjutkan) & catatan sekali tampil, peta jalur yang garis hijaunya berhenti di tier saat ini, latihan ulang jatuh tempo dan tautan masuk `#/sql/…`, ujian berjalan (jam mundur, kumpul otomatis di balik Beranda, "Waktu habis"), pengalihan rute tak dikenal (pemberitahuan terlihat walau halaman sedang digulir), karantina progres rusak sejak Beranda dibuka, pulihkan cadangan lewat pemilih file asli, tema terang/gelap (layar jalur tetap gelap), interaksi landing (tab, FAQ dengan keyboard, Hint & Run & Check pada peragaan, korsel, menu navbar, menu layar sempit), gerak (tombol jeda, gerak dikurangi saat halaman terbuka maupun sejak muat awal, halaman tidak meminta frame saat diam), posisi gulir yang pulih lewat tombol Kembali, keadaan semua misi tuntas, serta dua kegagalan unduhan (ringkasan progres, bagian bawah halaman + coba lagi) |
| `worker` | Penilaian lewat Web Worker, batas 100.000 baris, halaman tetap responsif saat query macet, batas waktu 8 detik, tombol Hentikan, worker dibuat ulang, Playground (salinan DB sesi, INSERT sungguhan, transaksi terbuka), Urutan Eksekusi pada query macet |
| `boss` | Boss terkunci sampai semua misi tier selesai, tanpa hint, Show Solution terkunci 3 percobaan, tier berikutnya tetap terbuka, pesan di tab Materi, perayaan "Boss dikalahkan" dengan XP penuh |
| `backup` | Ekspor mengunduh file berisi progres/kesalahan/materi, impor di browser kosong memulihkan semuanya, file yang salah ditolak tanpa mengubah progres |
| `exam` | Pengaturan (tier, jumlah soal, waktu), timer & jam di header, tanpa Hint/Show Solution, Jalankan tanpa menilai, palet soal terjawab, sesi & jawaban bertahan setelah refresh, kumpulkan → nilai 60 untuk 3/5 benar, rapor & riwayat, kumpul otomatis saat waktu habis walau sedang di mode Misi |
| `review` | Lencana jatuh tempo di header, kartu latihan ulang menyebut misi yang sering salah, sesi tanpa batas waktu dengan misi yang sering salah sebagai soal pertama, rapor "ulang 3 hari lagi"/"ulang besok", jadwal tersimpan (4 naik ke kotak 1, 1 tetap kotak 0), jumlah jatuh tempo berkurang, streak menjadi 1 hari |
| `achievements` | Misi pertama memunculkan notifikasi "Lencana baru!", galeri di mode Progres (1/23 diraih, kemajuan 1/10), pengguna lama dengan progres tidak mendapat notifikasi saat membuka aplikasi maupun setelah refresh |
| `perflab` | Halaman responsif saat data besar disiapkan, percobaan 1a = SCAN, 1b = SEARCH dengan waktu membuat index terpisah dan lebih cepat dari SCAN, riwayat bertahan saat pindah target, database sesi tidak tersentuh, Reset data besar, tombol "Uji di data besar" dari misi sargable |
| `tier10` | Tabel `satusehat_log` di Schema Explorer, jalur JSON tanpa `$` → pesan ramah + tautan materi JSON, jebakan `component[0]` ditolak, jawaban berbasis kode LOINC benar (+275 XP), Final Boss tier 10 di Peta Misi |
| `ddl` | Misi CREATE TABLE di UI: chip penilaian, struktur salah ditampilkan berdampingan, uji perilaku yang gagal disebut nomornya, jawaban benar, "Konsep baru", Final Boss di tier 9, kategori "Desain tabel & DDL" di Peta Kelemahan |

Setiap suite juga gagal bila ada error JavaScript atau `console.error`/`warn` di halaman.

## Struktur folder

```
├── index.html                    # termasuk skrip kecil pemasang tema Beranda sebelum gambar pertama
├── scripts/
│   ├── verify-missions.ts        # npm run verify (entry point)
│   ├── verify/                   # report, curriculum, sqlMissions, labMissions, predictMissions, testCases,
│   │                             # planTree, resultDiff, execSteps, sqlComplete, materi, weakness, worker, backup, exam,
│   │                             # review, achievements, perfLab, fixtures, platform, landing, memoryStorage
│   ├── fixtures/                 # fixture emas: storage-v1.json, backup-format1.json (JANGAN disunting)
│   ├── test-cases/               # kasus uji per tier: tier1-3.ts, tier4.ts … tier10.ts, bosses.ts, index.ts, types.ts
│   └── e2e/                      # npm run e2e: run (entry), server (Vite), browser (CDP), context (helper), suites/
└── src/
    ├── main.tsx                  # entry React → platform/PlatformShell
    ├── fonts.css / index.css     # font lokal (@fontsource) & gaya dasar layar jalur
    ├── platform/                 # lapisan platform (ringan; tanpa data misi & mesin SQL)
    │   ├── router.ts             # router hash: parseRoute, formatRoute, navigate, useRoute
    │   ├── PlatformShell.tsx     # rute → layar; "satu jalur hangat"; pengalihan + pemberitahuan
    │   ├── tracks.ts             # registri jalur + kontrak TrackProps / TrackGlance / GlanceFn / GuardFn
    │   ├── Home.tsx              # Beranda: ringkasan, pemberitahuan, pulihkan cadangan, posisi gulir, bagian bawah malas
    │   ├── home/                 # useTrackGlance (ringkasan + penjaga data), useBackupRestore
    │   ├── brand.ts / BrandMark.tsx / screens.tsx   # nama produk, logo, layar pemuatan & galat platform
    │   └── landing/
    │       ├── LandingBelow.tsx  # bagian 4–13 (satu chunk malas)
    │       ├── lib/              # content.ts (SEMUA teks & angka), motion.ts, scroll.ts, cn.ts
    │       ├── sections/         # Navbar, Hero, TodayStrip, CategoryMarquee, Roadmap, CatalogStrip, PracticeSection,
    │       │                     # ShowcaseSection, Ranks, Gamification, MascotHint, Devices, FAQ, FinalCTA, Footer,
    │       │                     # Notices, RestorePanel
    │       ├── ui/               # LandingRoot, Section, Button3D, Pill, Card, Tabs, Accordion, NavDropdown, MobileMenu,
    │       │                     # CodeWindow, Mockups, Reveal, CountUp, ThemeToggle, Icon
    │       ├── illustrations/    # Mascot (Kapi), Globe, FloatingBits, Wave, confetti
    │       ├── hooks/            # useTheme, usePrefersReducedMotion (+ jeda animasi), useCountUp, useTypewriter
    │       └── styles/           # tokens.css (variabel warna terang/gelap), landing.css, fonts.css
    ├── tracks/sql/               # SqlTrack.tsx (pembungkus jalur SQL), glance.ts (ringkasan & penjaga data untuk Beranda)
    ├── App.tsx                   # layar jalur SQL (mode, misi aktif, wiring)
    ├── types.ts                  # kontrak tipe bersama (Mission = SqlMission | InjectionMission | ConceptMission | PredictMission)
    ├── db/seed.ts                # SCHEMA_SQL, SEED_SQL, TABLE_ORDER, TABLE_DESCRIPTIONS
    ├── data/missions/
    │   ├── index.ts              # TIERS, MISSIONS, getMissionById, getNextMission, TOTAL_XP
    │   ├── tier1-3.ts            # misi inti tier 1–3
    │   ├── tier4.ts … tier10.ts  # satu file per tier lanjutan (tier9 = DDL, tier10 = tanggal/teks/JSON)
    │   └── bosses.ts             # 10 Boss Challenge (BOSS_XP) — satu di akhir setiap tier
    ├── data/materi/              # artikel Materi: umum.ts, tier1.ts … tier10.ts, index.ts (articlesForMission)
    ├── lib/
    │   ├── sqlEngine.ts          # executeSql, executePrepared, explainQueryPlan, toFriendlyError, getSchemaInfo
    │   ├── validator.ts          # checkMission / runSolution untuk grading result | state | index | schema
    │   ├── schemaCheck.ts        # grading DDL: fakta struktur (afinitas, PK, FK, UNIQUE), uji perilaku (probe), pesan
    │   ├── boss.ts               # aturan Boss Challenge: isBoss, bossBlockers, solusi terkunci sampai 3 percobaan
    │   ├── backup.ts             # cadangan progres: createBackup, parseBackup (validasi), applyBackup
    │   ├── exam.ts               # mode ujian: pemilihan soal, sesi & tenggat, rapor, validasi data tersimpan
    │   ├── review.ts             # latihan ulang terjadwal: kartu Leitner, prioritas jatuh tempo, tanggal lokal
    │   ├── achievements.ts       # 23 lencana, dihitung dari data yang ada (tanpa state lencana tersendiri)
    │   ├── bigData.ts            # dataset besar Lab Performa: SQL pembangkit deterministik (200rb kunjungan)
    │   ├── perfLab.ts            # Lab Performa: pengukuran (median, cuplikan, plan SCAN/SEARCH), percobaan bawaan
    │   ├── queryPlan.ts          # analisis EXPLAIN QUERY PLAN (SCAN vs SEARCH per tabel) untuk penilaian
    │   ├── planTree.ts           # Explain di Playground: explainScript, pohon langkah, ringkasan & tips
    │   ├── plan/                 # sqlText (normalisasi SQL), schema (salinan skema + saran index),
    │   │                         # names (alias/CTE/view), classify (klasifikasi baris plan)
    │   ├── requiredPatterns.ts   # pengecekan konstruksi wajib
    │   ├── injection.ts          # buildVulnerableSql, runInjection (mode rentan / aman)
    │   ├── quiz.ts               # checkQuiz
    │   ├── compare.ts            # compareResults, cellsEqual
    │   ├── resultDiff.ts         # diff hasil vs Expected Output untuk tab Perbedaan
    │   ├── execSteps.ts          # urutan eksekusi: langkah FROM → … → LIMIT + tabel antara (exec/parseSelect.ts)
    │   ├── sqlComplete.ts        # autocomplete editor (keyword, fungsi, tabel, kolom, alias)
    │   ├── predict.ts            # pilihan & penilaian misi tebak hasil
    │   ├── materiSearch.ts       # pencarian materi (mode Materi)
    │   ├── errorTopics.ts        # pesan error SQLite → materi terkait
    │   ├── sqlGuard.ts           # klien worker SQL: batas waktu, Hentikan, salinan DB sesi, fallback; sqlGuard (penilaian)
    │   │                         # dan labGuard (worker terpisah untuk Lab Performa)
    │   ├── mistakes.ts           # klasifikasi jenis kesalahan (Peta Kelemahan)
    │   ├── weakness.ts           # laporan Peta Kelemahan: bobot, kategori, topik, rekomendasi
    │   ├── progress.ts / ranks.ts# XP, unlock, streak, rank
    │   ├── resume.ts             # misi yang dibuka "Lanjutkan" (dipakai jalur dan ringkasan Beranda)
    │   ├── storageKeys.ts        # SEMUA kunci localStorage (jalur SQL + platform)
    │   ├── storageGuard.ts       # karantina nilai tersimpan yang tidak terbaca; browserStorage
    │   ├── backupImport.ts       # baca & terapkan file cadangan (dipakai Beranda lewat impor dinamis)
    │   ├── sqlHighlight.ts       # tokenizer lossless untuk highlighting
    │   └── sqlLoader.ts / platform.ts
    ├── workers/                  # sqlWorker (entry Web Worker), handleRequest (logika, bisa diuji), protocol
    ├── hooks/                    # useSqlEngine, useProgress, usePlayground (Run/Explain/Urutan Eksekusi), useCompletionSchema,
    │                             # useArticleReads (status materi dibaca), useMistakes (riwayat kesalahan), useBriefFold,
    │                             # useExam (sesi ujian/latihan, timer & kumpul otomatis, penilaian, riwayat), useReviewDeck,
    │                             # useAchievements (lencana + notifikasi), usePerfLab (state Lab Performa)
    └── components/
        ├── workspaces/           # MissionPanel (switch per kind), InjectionWorkspace, ConceptWorkspace, ConceptQuiz, PredictWorkspace,
        │                         # useMissionDrafts (draf per misi), useMissionRunner (penilaian + penyelesaian)
        ├── MissionWorkspace.tsx  # editor + Run & Check untuk misi SQL
        ├── MissionOutput.tsx     # hasil/umpan balik (dipakai misi SQL & lab)
        ├── MissionBrief.tsx / MissionList.tsx / MissionSidebar.tsx
        ├── SchemaExplorer.tsx / ResultTable.tsx / SqlEditor.tsx / HighlightedCode.tsx / ViewNote.tsx
        ├── plan/                 # QueryPlanView, PlanStatementCard, PlanTree, planStyle (visualisasi Explain)
        ├── exec/                 # ExecutionStepsView, StepTable, ExecStepsCard, stepStyle (urutan eksekusi)
        ├── editor/               # CompletionPopup, useAutocomplete, textInsert (autocomplete editor)
        ├── progress/             # ProgressSidebar, WeaknessView, MistakeNudge, BackupCard, Achievements (mode Progres)
        ├── perf/                 # PerfLab (Lab Performa di Free Playground), PerfLabContext (tombol dari misi optimasi)
        ├── exam/                 # ReviewStart (latihan ulang hari ini), ExamSetup, ExamQuestion, ExamSidebar, ExamReport
        ├── materi/               # MateriPanel (tab Materi), ArticleView (contoh interaktif, jebakan, beda dialek),
        │                         # ReferenceSidebar/ReferenceView (mode Materi), MateriLinkContext (tautan dari error)
        └── Playground*.tsx / Header.tsx / AppScreens.tsx / SuccessCelebration.tsx
```

## Cara menambah misi baru

Aturan umum untuk semua jenis (lihat `MissionBase` di `src/types.ts`):

- `id` unik dalam format kebab-case dan **stabil**, karena dipakai sebagai kunci progres di localStorage.
- `order` melanjutkan urutan global (kontigu), `tier` dan `xpReward` mengikuti tabel kurikulum.
- `story` berupa skenario rumah sakit yang realistis, `hint` berisi 2–3 langkah dari umum ke spesifik tanpa membocorkan jawaban.
- Tulis misi di file tier yang sesuai (`src/data/missions/tierN.ts`), lalu tambahkan kasus uji di `scripts/test-cases/tierN.ts`.
- Jika jumlah misi, jenis per tier, atau total XP berubah, sesuaikan konstanta di `scripts/verify/curriculum.ts`.
- Boss Challenge ditulis di `src/data/missions/bosses.ts` (`boss.combines`, `hint: []`, XP dari `BOSS_XP`), kasus ujinya di
  `scripts/test-cases/bosses.ts` (minimal 3 jebakan & 2 formulasi setara). Jangan tautkan boss dari materi.
- Jalankan `npm run verify` dan `npm run typecheck`. Keduanya harus lolos.

**Misi SQL** (`kind: 'sql'`):

- `task` menyebut **semua nama kolom hasil** persis (termasuk alias) dan semua tie-breaker pengurutan.
- `solutionSql` adalah query referensi, `starterSql` isi awal editor (komentar + awal query).
- `orderMatters: true` hanya untuk soal yang meminta `ORDER BY`; pastikan tidak ada baris yang seri pada seluruh kunci urutan.
- `grading` (opsional, default `{ type: 'result' }`):
  - `{ type: 'result', requireIndexOn: { table: 'kunjungan', column: 'tgl_kunjungan' } }` untuk misi query sargable.
  - `{ type: 'state', verifySql, label, transaction? }`: `verifySql` membaca **seluruh** tabel terdampak dengan `ORDER BY` lengkap; `orderMatters: true`.
    `transaction: { requireRolledBackChange }` untuk misi transaksi (setiap perubahan wajib di dalam transaksi).
  - `{ type: 'index', table, column, probeSql }`: `probeSql` harus SCAN sebelum index dibuat.
  - `{ type: 'schema', objects, probes, verifySql, label }` untuk DDL: `objects` = `{ name, type: 'table' | 'view' | 'trigger' }`
    yang harus dibuat/diubah; `probes` = statement uji `{ sql, description }` (satu statement masing-masing, minimal 3, ada
    yang diterima dan ada yang ditolak solusi) — hasil yang diharapkan diambil otomatis dari DB solusi, jadi cukup tulis
    uji yang mewakili setiap aturan di soal; `verifySql` membaca isi akhir setelah uji dengan `ORDER BY`; `orderMatters: true`.
    Sebut nama & tipe setiap kolom di teks tugas, karena afinitas tipe ikut dinilai.
- `requiredPatterns` (opsional): `{ pattern, message }`, regex dicocokkan tanpa peka huruf besar/kecil.
  Dengan `` String.raw`\bOVER\s*\(` `` cukup satu backslash.
- Kasus uji: minimal 2 query salah yang masuk akal dan 1 formulasi setara. Untuk misi `state`, sertakan
  `UPDATE`/`DELETE` tanpa `WHERE`; untuk misi transaksi, sertakan kasus lupa `COMMIT` (`reason: 'open-transaction'`).
- **Perbaiki Bug**: isi `fix: { bugCount }`, tulis query bermasalah di `starterSql` dan query benar di `solutionSql`. `task`
  menjelaskan hasil yang DIINGINKAN dan menyebut "N bug". Tambahkan kasus uji untuk perbaikan sebagian (hanya satu bug).

**Tebak hasil** (`kind: 'predict'`):

- `query`: SELECT yang ditebak, sebaiknya dengan `ORDER BY` deterministik (`orderMatters: true`) dan hasil kecil.
- `distractors`: 2–3 `{ sql, misconception }`. `sql` menghasilkan tabel yang dikira benar oleh orang yang punya salah
  paham tertentu; `misconception` menjelaskan salah pahamnya. Semua tabel harus berbeda satu sama lain.
- `explanation`: alasan hasil `query` seperti itu, ditampilkan setelah jawaban benar.

**Lab injection** (`kind: 'injection'`):

- `lab.vulnerableTemplate` memuat `{input}` yang disambung mentah; `lab.safeTemplate` versi aman dengan tepat satu `?`
  (untuk LIKE: `LIKE '%' || ? || '%'`).
- `lab.sampleInput` adalah input wajar (harus menampilkan ≥1 baris dan belum memenuhi target).
- `lab.goal`: `{ type: 'row-count-at-least', count, description }`, `{ type: 'contains-value', value, description }`, atau
  `{ type: 'contains-all-values', referenceSql, description }` (setiap nilai kolom pertama `referenceSql` harus tampil).
- `lab.requiredPatterns` (opsional): `{ pattern, message }` yang wajib ada pada SQL rentan hasil penyambungan.
- `solutionPayload` harus berhasil di mode rentan dan gagal di mode aman.
- Kasus uji berisi payload (`answer`) yang dijalankan di mode rentan.

**Kartu konsep** (`kind: 'concept'`):

- `sections`: minimal 2, masing-masing `heading`, `body` (paragraf dipisah baris kosong; mendukung `kode`, **tebal**, dan daftar "- "),
  serta `examples` opsional `{ dialect, code, caption? }`.
- `quiz`: 3–5 soal, masing-masing ≥3 opsi unik, `correctIndex`, dan `explanation`.
- Kartu konsep tidak punya kasus uji di `scripts/test-cases`; integritas kuis diperiksa oleh `npm run verify`.

**Materi** (`src/data/materi/*.ts`, tipe `Article`):

- `missions`: misi yang memakai konsepnya; misi pertama = tempat konsep diperkenalkan (penanda "Konsep baru").
- `sections`: 2–3 bagian dengan `examples` `{ title, sql, note?, run? }` — default SELECT yang dijalankan di tempat
  (hasil ≤ 30 baris); `run: 'playground'` untuk contoh yang mengubah data. Pakai kasus yang berbeda dari soal misi
  terkait (diperiksa otomatis).
- Pola error baru yang perlu ditautkan ke materi: tambahkan di `src/lib/errorTopics.ts` plus kasus uji di `scripts/verify/materi.ts`.
- `pitfalls`: jebakan umum; `dialects`: `{ label, syntax: { sqlite, sqlServer, mysql, postgresql, oracle }, note? }`.

Jika butuh data baru, ubah `src/db/seed.ts`, lalu jalankan ulang `npm run verify`, karena expected output semua misi ikut berubah.
