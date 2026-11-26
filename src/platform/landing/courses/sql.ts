/**
 * Data landing jalur SQL ('#/landing/sql'). Silabus, statistik, dan hitungan dibangun SAAT RUNTIME dari kurikulum
 * asli — TIERS/MISSIONS (src/data/missions) dan ARTICLES (src/data/materi) — supaya tidak pernah basi. Teks yang
 * menyebut angka lain memakai angka bernama yang sudah diverifikasi di lib/content.ts.
 *
 * Modul ini MENGIMPOR DATA MISI: hanya boleh dijangkau dari halaman yang dimuat malas (pages/CoursePage.tsx), tidak
 * pernah dari Beranda, tracks.ts, atau courses/catalog.ts. scripts/verify/courses.ts memeriksa silabus ini terhadap
 * kurikulum (jumlah, judul, urutan) dan menjaga aturan "ringan" tersebut.
 */
import { ARTICLES } from '../../../data/materi';
import { MISSIONS, TIERS, TOTAL_XP } from '../../../data/missions';
import { BOSS_SOLUTION_AFTER, isBoss } from '../../../lib/boss';
import { HINT_PENALTY } from '../../../lib/progress';
import type { Mission } from '../../../types';
import { PRODUCT_NAME } from '../../brand';
import {
  BADGE_COUNT,
  CTA as HOME_CTA,
  EXAM_QUESTION_COUNTS,
  LICENSE_NAME,
  MASCOT_NAME,
  PERF_LAB_VISITS,
  PRACTICE,
  RANK_COUNT,
  RANK_LADDER,
  REVIEW_INTERVAL_DAYS,
  ROUTES,
  TABLE_COUNT,
  formatNumber,
} from '../lib/content';
import { COURSE_SECTION_IDS, courseDocumentTitle } from '../lib/pagesContent';
import type { AvailableCourse, SyllabusArticle, SyllabusMission, SyllabusMissionKind, SyllabusTier } from './types';

/** Banyaknya contoh siap pakai di Free Playground (PLAYGROUND_EXAMPLES di src/components/PlaygroundSidebar.tsx — diverifikasi). */
export const PLAYGROUND_EXAMPLE_COUNT = 13;

/** Label badge jenis misi — kosakata yang sama dengan Beranda (FEATURES.tabs.missions.kinds di lib/content.ts). */
export const MISSION_KIND_LABEL: Readonly<Record<SyllabusMissionKind, string>> = {
  sql: 'Query SQL',
  fix: 'Perbaiki Query',
  predict: 'Tebak Hasil',
  injection: 'Lab Injection',
  concept: 'Kartu konsep',
  boss: 'Boss',
};

/** Jenis misi untuk tampilan: aturan yang sama dengan displayKind (src/components/MissionKind.tsx). */
export function missionKind(mission: Mission): SyllabusMissionKind {
  if (isBoss(mission)) return 'boss';
  if (mission.kind === 'sql' && mission.fix !== undefined) return 'fix';
  return mission.kind;
}

const HINT_PERCENT = Math.round(HINT_PENALTY * 100);
const BOSSES = MISSIONS.filter(isBoss);
const HERO_MISSION = PRACTICE.tabs.query;
/**
 * Query misi hero (PRACTICE.tabs.query — misi sungguhan) dengan baris yang dipadatkan supaya muat di kartu kecil.
 * Hanya spasi/baris yang berbeda; scripts/verify/courses.ts memastikan isinya sama persis dengan query misinya.
 */
const HERO_CODE = `SELECT no_rm, nama, kota
FROM pasien
WHERE penjamin = 'BPJS'
  AND (kota = 'Jakarta'
    OR kota = 'Bogor');`;
const FIRST_MISSION = MISSIONS[0];
const FIRST_RANK = RANK_LADDER[0]?.title ?? '';
const LAST_RANK = RANK_LADDER.at(-1)?.title ?? '';

/** "5, 10, atau 15". */
function orList(values: readonly number[]): string {
  if (values.length <= 1) return values.join('');
  return `${values.slice(0, -1).join(', ')}, atau ${String(values.at(-1))}`;
}

/** "1, 3, 7, 14, 30, lalu 60". */
function thenList(values: readonly number[]): string {
  if (values.length <= 1) return values.join('');
  return `${values.slice(0, -1).join(', ')}, lalu ${String(values.at(-1))}`;
}

function toSyllabusMission(mission: Mission): SyllabusMission {
  const kind = missionKind(mission);
  return {
    id: mission.id,
    order: mission.order,
    number: String(mission.order).padStart(2, '0'),
    title: mission.title,
    concept: mission.concept,
    kind,
    kindLabel: MISSION_KIND_LABEL[kind],
    xp: mission.xpReward,
  };
}

function toSyllabusArticle(article: (typeof ARTICLES)[number]): SyllabusArticle {
  return { id: article.id, title: article.title, summary: article.summary };
}

/** Silabus dari kurikulum asli: satu kartu per tier, misi urut order, materi urut seperti di aplikasi. */
export function buildSqlSyllabusTiers(): SyllabusTier[] {
  return TIERS.map((info) => {
    const missions = MISSIONS.filter((m) => m.tier === info.tier)
      .sort((a, b) => a.order - b.order)
      .map(toSyllabusMission);
    const articles = ARTICLES.filter((a) => a.tier === info.tier).map(toSyllabusArticle);
    const boss = missions.find((m) => m.kind === 'boss') ?? null;
    const chips = [`${missions.length} misi`, ...(boss ? ['1 Boss'] : []), `${articles.length} materi`];
    return {
      tier: info.tier,
      value: `tier-${info.tier}`,
      label: `Tier ${info.tier}`,
      title: info.name,
      description: info.description,
      missions,
      boss,
      articles,
      chips,
      start: { label: 'Mulai', href: ROUTES.sql },
    };
  });
}

const OTHER_TRACKS = ['js', 'rest', 'react', 'framework'] as const;

export const SQL_COURSE: AvailableCourse = {
  id: 'sql',
  title: 'SQL',
  status: 'tersedia',
  icon: 'database',
  env: 'browser',

  hero: {
    lead: 'Tulis query sungguhan di database rumah sakit: dari SELECT pertama sampai JOIN, window function, transaksi, index, keamanan, dan merancang tabel. Semuanya berjalan di browser dan dinilai saat itu juga.',
    cta: { start: 'Mulai belajar', resume: 'Lanjutkan', note: '(gratis)', href: ROUTES.sql },
    outline: { label: 'Lihat silabus', target: COURSE_SECTION_IDS.syllabus },
    secondary: { label: 'Playground SQL', href: ROUTES.playground },
    proof: 'Gratis · tanpa akun · berjalan di browsermu',
    connected: OTHER_TRACKS,
    logos: ['database'],
    glimpse: {
      label: HERO_MISSION.tierLabel,
      fileName: HERO_MISSION.fileName,
      code: HERO_CODE,
      verdict: PRACTICE.verdict.correct,
      xp: PRACTICE.verdict.xp(HERO_MISSION.xp),
    },
  },

  stats: [
    { value: MISSIONS.length, label: 'misi' },
    { value: BOSSES.length, label: 'Boss' },
    { value: ARTICLES.length, label: 'materi' },
    { value: TOTAL_XP, label: 'XP' },
  ],

  features: {
    title: 'Belajar dengan mengerjakan, bukan menonton',
    lead: 'Enam hal yang menemanimu dari misi pertama sampai Final Boss.',
    items: [
      {
        icon: 'table',
        title: 'Mulai dari SELECT',
        text: `Misi pertama, "${FIRST_MISSION?.title ?? ''}", cukup dengan satu SELECT. Tier berikutnya menambah konsep sedikit demi sedikit.`,
        token: { text: 'SELECT', tone: 'code' },
      },
      {
        icon: 'lightbulb',
        title: `Hint bertahap (−${HINT_PERCENT}% XP) & Show Solution`,
        text: `Hint dibuka satu per satu, dari arah umum sampai bentuk query; membukanya mengurangi ${HINT_PERCENT}% XP misi itu. Tetap buntu? Show Solution membuka jawabannya, dan misi itu tidak memberi XP.`,
        token: { text: `−${HINT_PERCENT}% XP`, tone: 'amber' },
      },
      {
        icon: 'clipboard-check',
        title: 'Dinilai otomatis',
        text: 'Yang dinilai adalah akibat query-mu: hasilnya, perubahan data, index yang dipakai, sampai desain tabel. Jawaban salah? Tab Perbedaan menunjukkan baris dan sel yang meleset.',
        token: { text: 'Tab Perbedaan', tone: 'neutral' },
      },
      {
        icon: 'book',
        title: `${ARTICLES.length} materi`,
        text: 'Artikel ringkas berisi contoh yang bisa dijalankan, jebakan umum, dan kotak Beda dialek. Bisa dibuka kapan saja tanpa mengurangi XP.',
        token: { text: 'Beda dialek', tone: 'primary' },
      },
      {
        icon: 'repeat',
        title: 'Ujian & latihan ulang terjadwal',
        text: `Mode Ujian berisi ${orList(EXAM_QUESTION_COUNTS)} soal acak dari misi yang sudah terbuka. Misi SQL dan Tebak Hasil yang sudah selesai muncul lagi sebagai kartu latihan ulang: jawab benar, jaraknya makin panjang (${thenList(REVIEW_INTERVAL_DAYS)} hari); jawab salah, muncul lagi besok.`,
        token: { text: `${REVIEW_INTERVAL_DAYS.join(' → ')} hari`, tone: 'neutral' },
      },
      {
        icon: 'medal',
        title: `Pangkat & ${BADGE_COUNT} lencana`,
        text: `XP membawamu melewati ${RANK_COUNT} pangkat, dari ${FIRST_RANK} sampai ${LAST_RANK}. Lencana dicatat untuk perjalanan, Boss, ketepatan, konsistensi, ujian, dan materi.`,
        token: { text: `${RANK_COUNT} pangkat`, tone: 'primary' },
      },
    ],
  },

  syllabus: {
    title: 'Silabus',
    lead: `${TIERS.length} tier, masing-masing ditutup satu Boss. Buka sebuah tier untuk melihat setiap misi dan materinya.`,
    meta: [`${TIERS.length} tier`, `${BOSSES.length} Boss`, `${MISSIONS.length} misi`, `${ARTICLES.length} materi`],
    tiers: buildSqlSyllabusTiers(),
    progress: (completed, total) => `${completed} dari ${total} misi selesai`,
  },

  parts: {
    title: 'Isi jalur SQL',
    lead: 'Setiap kartu membuka bagiannya langsung di aplikasi.',
    items: [
      {
        id: 'misi',
        icon: 'swords',
        title: 'Misi',
        text: 'Permintaan dari unit-unit rumah sakit, terbuka satu per satu dan ditutup Boss di setiap tier.',
        count: `${MISSIONS.length} misi`,
        href: ROUTES.missions,
      },
      {
        id: 'materi',
        icon: 'book',
        title: 'Materi',
        text: 'Baca konsepnya kapan saja, lengkap dengan pencarian sampai ke sintaks dialek.',
        count: `${ARTICLES.length} artikel`,
        href: ROUTES.articles,
      },
      {
        id: 'playground',
        icon: 'terminal',
        title: 'Free Playground',
        text: 'Jalankan query apa saja di database latihan, termasuk INSERT dan transaksi. Reset Database mengembalikan data awal.',
        count: `${PLAYGROUND_EXAMPLE_COUNT} contoh siap pakai`,
        href: ROUTES.playground,
      },
      {
        id: 'lab-performa',
        icon: 'gauge',
        title: 'Lab Performa',
        text: 'Ada di dalam Playground: ukur selisih SCAN dan SEARCH pada data besar sintetis, sebelum dan sesudah membuat index.',
        count: `${formatNumber(PERF_LAB_VISITS)} kunjungan`,
        href: ROUTES.playground,
      },
      {
        id: 'ujian',
        icon: 'timer',
        title: 'Mode Ujian & latihan ulang',
        text: 'Soal acak tanpa hint dengan batas waktu pilihan, plus kartu latihan ulang untuk misi yang jatuh tempo hari ini.',
        count: `${orList(EXAM_QUESTION_COUNTS)} soal`,
        href: ROUTES.exam,
      },
      {
        id: 'progres',
        icon: 'chart',
        title: 'Progres',
        text: 'XP, pangkat, lencana, Peta Kelemahan, dan cadangan progres ke file.',
        count: `${BADGE_COUNT} lencana`,
        href: ROUTES.progress,
      },
    ],
  },

  promise: { eyebrow: 'Apa yang kamu dapat', title: 'Semua yang kamu butuhkan untuk belajar SQL' },

  rows: {
    run: {
      title: 'Jalankan query SQL sungguhan',
      lead: 'Query-mu dijalankan SQLite (WebAssembly) langsung di browser, di database rumah sakit yang sama untuk semua misi, lalu dinilai saat itu juga.',
      tabsLabel: 'Jenis latihan',
      tabs: [
        { id: 'query', label: 'Query' },
        { id: 'fix', label: 'Perbaiki Query' },
        { id: 'predict', label: 'Tebak Hasil' },
        { id: 'injection', label: 'Lab Injection' },
        { id: 'playground', label: 'Playground' },
      ],
      panels: { result: 'Hasil', console: 'Konsol' },
      consoleLines: (rows) => ['Dijalankan SQLite (WebAssembly) di browser ini', `${rows} baris dikembalikan`, 'Dinilai dari hasilnya, bukan dari teks query'],
      columns: { input: 'Input', yours: 'Hasil kamu', expected: 'Seharusnya' },
      columnsByTab: {
        predict: { yours: 'Pilihanmu', expected: 'Jawaban yang benar' },
        injection: { yours: PRACTICE.tabs.injection.vulnerable.label, expected: 'Mode aman' },
      },
      consoleNoRun: 'Query Tebak Hasil tidak dijalankan: kamu membacanya, lalu memilih tabel hasilnya.',
      note: 'Contoh tampilan dari misi sungguhan. Di aplikasi, query-mu benar-benar dijalankan di browser dan dinilai dari hasilnya.',
      link: { label: 'Coba misi pertama', resume: 'Lanjutkan misimu', href: ROUTES.sql },
    },
    streak: {
      title: 'Bangun streak-mu',
      lead: 'Selesaikan satu misi, ujian, atau latihan ulang untuk menandai hari ini aktif. Hari aktif berturut-turut menjadi streak, dan rekor terbaikmu ikut dicatat.',
      calendarCaption: (monthLabel) => `${monthLabel}: hari-hari streak yang sedang berjalan`,
      note: 'Kalender ini ilustrasi: aplikasi menyimpan angka streak dan rekor terbaik, bukan riwayat per hari. Yang ditandai hanya hari-hari streak yang sedang berjalan.',
      weekdays: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
      activeLabel: 'Aktif',
      unknownLabel: 'Tidak tercatat',
      best: { label: 'Rekor terbaik', value: (days) => `${days} hari`, empty: 'Belum ada' },
      today: { label: 'Hari ini sudah dihitung?', yes: 'Sudah', no: 'Belum' },
      zeroTitle: 'Mulai streak baru hari ini',
      sampleNote: 'Belum ada progres di browser ini, jadi angka di sini hanya contoh.',
      sample: { best: 9, current: 5, activeToday: true },
    },
    anywhere: {
      title: 'Belajar di mana saja',
      lead: 'Tampilannya menyesuaikan dari laptop sampai ponsel. Cukup buka di browser; progresmu tersimpan di perangkat itu dan bisa dipindah lewat file cadangan.',
      floating: 'Tanpa instalasi',
      phoneLabel: 'Contoh tampilan daftar tier jalur SQL di ponsel',
      points: [
        { icon: 'zap', text: 'Tanpa instalasi' },
        { icon: 'hard-drive', text: 'Progres tersimpan di browsermu' },
        { icon: 'file-down', text: 'Bisa dicadangkan ke file' },
      ],
    },
    bosses: {
      title: `Taklukkan ${BOSSES.length} Boss`,
      lead: `Setiap tier ditutup satu Boss: soal gabungan tanpa hint yang memadukan konsep tier itu. Solusinya baru bisa dibuka setelah ${BOSS_SOLUTION_AFTER} percobaan.`,
      status: { locked: 'Terkunci', open: 'Terbuka', done: 'Selesai' },
      note: 'Status dibaca dari progres di browser ini.',
      rule: 'Boss terbuka setelah misi lain di tier-nya selesai, dan tidak mengunci tier berikutnya.',
    },
    ways: {
      title: 'Banyak cara belajar',
      lead: 'Macet di satu misi bukan jalan buntu. Pilih cara yang paling cocok untukmu.',
      tabsLabel: 'Cara belajar',
      tabs: [
        {
          id: 'materi',
          label: 'Materi',
          icon: 'book',
          title: `${ARTICLES.length} artikel materi`,
          text: 'Penjelasan singkat, contoh yang bisa dijalankan di database SIMRS, jebakan umum, dan perbandingan dialek.',
          bullets: ['Jalankan contoh di tempat atau buka di Playground', 'Pencarian sampai ke sintaks dialek, misalnya TOP atau NVL', 'Tidak mengurangi XP'],
        },
        {
          id: 'hint',
          label: 'Hint',
          icon: 'lightbulb',
          title: 'Hint bertahap',
          text: `Dari arah umum sampai bentuk query. Membuka hint mengurangi ${HINT_PERCENT}% XP misi itu; Boss tidak punya hint.`,
          bullets: ['Dibuka satu per satu, dengan konfirmasi', 'Show Solution bila tetap buntu (misi itu tidak memberi XP)', 'Tab Perbedaan menunjukkan baris yang berlebih atau kurang'],
        },
        {
          id: 'urutan',
          label: 'Urutan Eksekusi & Explain',
          icon: 'workflow',
          title: 'Lihat cara query dijalankan',
          text: 'Urutan Eksekusi menelusuri setiap tahap dari FROM sampai LIMIT lengkap dengan tabel antaranya. Explain menggambar query plan: SCAN atau SEARCH lewat index.',
          bullets: ['Urutan Eksekusi ada di misi SQL dan Playground', 'Explain ada di Playground, lengkap dengan saran index', 'Tahap terakhir selalu query aslimu, jadi hasilnya sama dengan Run'],
        },
        {
          id: 'playground',
          label: 'Playground',
          icon: 'terminal',
          title: 'Free Playground',
          text: 'Tanpa soal dan tanpa penilaian: coba query apa pun, termasuk INSERT, UPDATE, dan transaksi. Reset Database mengembalikan data awal.',
          bullets: [`${PLAYGROUND_EXAMPLE_COUNT} contoh siap pakai`, `Lab Performa dengan ${formatNumber(PERF_LAB_VISITS)} kunjungan sintetis`, 'Schema Explorer untuk melihat tabel dan relasinya'],
        },
      ],
    },
    ranks: {
      title: 'Naik pangkat & kumpulkan lencana',
      lead: `Setiap misi memberi XP. Kumpulkan sampai ${formatNumber(TOTAL_XP)} XP untuk naik melewati ${RANK_COUNT} pangkat, dan raih ${BADGE_COUNT} lencana di sepanjang jalan.`,
      cardLabel: 'Pangkat',
      badgesLabel: 'Lencana',
      link: { label: 'Lihat progresmu', href: ROUTES.progress },
    },
  },

  why: {
    title: 'Kenapa belajar SQL di sini',
    items: [
      {
        title: 'Kasus rumah sakit, bukan tabel contoh',
        text: `Setiap misi adalah permintaan dari unit rumah sakit, dikerjakan di ${TABLE_COUNT} tabel SIMRS: pasien, kunjungan, diagnosa, tagihan, sampai log SATUSEHAT. Datanya karangan, kasusnya akrab.`,
      },
      {
        title: 'Query-mu benar-benar dijalankan',
        text: 'SQLite berjalan di browsermu, dan jawaban dinilai dari hasilnya — tidak dicocokkan huruf demi huruf dengan kunci jawaban.',
      },
      {
        title: 'Salah itu bagian dari belajar',
        text: 'Tab Perbedaan menunjukkan apa yang meleset, Peta Kelemahan mencatat jenis kesalahanmu, dan latihan ulang memunculkan misi lama pada waktunya.',
      },
      {
        title: 'Gratis, tanpa akun, progresmu milikmu',
        text: `Tidak ada pendaftaran. Progres tersimpan di browser dan bisa diekspor ke file; kode sumbernya terbuka berlisensi ${LICENSE_NAME}.`,
      },
    ],
  },

  faq: {
    title: 'Pertanyaan tentang jalur SQL',
    items: [
      {
        id: 'sulit',
        question: 'Apakah SQL sulit untuk pemula?',
        answer: [
          'Tidak harus. Misi pertama cukup dengan satu SELECT, dan setiap tier menambah konsep sedikit demi sedikit.',
          'Kalau macet, ada Materi yang bisa dibuka kapan saja, Hint bertahap, dan tab Perbedaan yang menunjukkan bagian yang meleset.',
        ],
      },
      {
        id: 'lama',
        question: 'Berapa lama sampai selesai?',
        answer: [
          `Tergantung kecepatanmu: tidak ada batas waktu dan tidak ada jadwal yang harus diikuti. Jalur ini berisi ${MISSIONS.length} misi dalam ${TIERS.length} tier.`,
          'Progres tersimpan di browser setiap kali kamu menyelesaikan misi, jadi kamu bisa berhenti kapan saja dan melanjutkan dari misi terakhir.',
        ],
      },
      {
        id: 'gratis',
        question: 'Apakah jalur SQL gratis?',
        answer: [`Ya, seluruhnya. Tidak ada paket berbayar, iklan, atau pendaftaran. Kode sumbernya terbuka berlisensi ${LICENSE_NAME}.`],
      },
      {
        id: 'instal',
        question: 'Perlu memasang apa?',
        answer: [
          'Tidak ada. SQLite dijalankan sebagai WebAssembly di browsermu, jadi cukup browser modern dan koneksi internet untuk memuat aplikasinya.',
          'Query-mu sendiri tidak dikirim ke server mana pun.',
        ],
      },
      {
        id: 'dialek',
        question: 'Dialek SQL apa yang dipakai?',
        answer: [
          'SQLite. Sebagian besar yang kamu pelajari — SELECT, JOIN, GROUP BY, CTE, window function, transaksi — berlaku juga di database lain.',
          'Bagian yang berbeda dibahas di kotak Beda dialek setiap materi, yang membandingkan SQLite dengan SQL Server, MySQL / MariaDB, PostgreSQL, dan Oracle: misalnya LIMIT, TOP, dan FETCH FIRST, atau IFNULL, ISNULL, dan NVL.',
        ],
      },
      {
        id: 'lompat',
        question: 'Bisa langsung lompat ke tier lanjut?',
        answer: [
          'Tidak bisa. Misi terbuka berurutan, jadi tier lanjut terbuka setelah misi sebelumnya selesai. Kalau kamu sudah paham, misi awal biasanya cepat selesai.',
          'Yang terbuka sejak awal: semua Materi, kartu konsep, dan Free Playground. Boss tidak mengunci tier berikutnya.',
        ],
      },
    ],
  },

  related: {
    title: 'Jalur yang terhubung dengan SQL',
    lead: 'Jalur berikutnya memakai kasus SIMRS yang sama: datanya diolah dengan JavaScript & TypeScript, dibuka lewat REST API, ditampilkan dengan React, lalu disatukan dalam proyek framework.',
    note: 'Langkah 1–5 adalah urutan yang kami sarankan, bukan syarat.',
  },

  cta: {
    title: `Belajar SQL bersama ${MASCOT_NAME}`,
    lead: 'Misi pertama sudah menunggu. Gratis, tanpa akun, langsung di browser.',
    leadResume: 'Misi berikutnya sudah menunggu. Progresmu tersimpan di browser ini.',
    // Kalimat yang sama dengan CTA penutup Beranda saat semua misi tuntas.
    leadDone: HOME_CTA.allDone.lead,
    start: 'Mulai belajar',
    resume: 'Lanjutkan',
    href: ROUTES.sql,
  },

  meta: {
    title: courseDocumentTitle('SQL'),
    description: `Belajar SQL gratis lewat ${MISSIONS.length} misi kasus rumah sakit: SELECT, JOIN, window function, transaksi, index, sampai desain tabel. Langsung di browser, tanpa akun.`,
    ogTitle: `Belajar SQL lewat kasus rumah sakit — ${PRODUCT_NAME}`,
    ogDescription: `${MISSIONS.length} misi, ${BOSSES.length} Boss, dan ${ARTICLES.length} materi di database SIMRS. SQLite berjalan di browsermu dan jawaban dinilai saat itu juga.`,
  },
};
