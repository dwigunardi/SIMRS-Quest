/**
 * Data landing empat jalur berstatus 'segera' (JavaScript & TypeScript, REST API, React, NestJS · Next.js · Laravel).
 *
 * ATURAN ISI (diperiksa scripts/verify/courses.ts):
 * - Jujur: jalurnya BELUM ADA. Tidak ada tanggal rilis, silabus rinci, jumlah pelajaran, atau angka karangan.
 * - "Rencana materi" diturunkan dari deskripsi di registri (src/platform/tracks.ts) dan DITANDAI sebagai rencana yang
 *   bisa berubah (badge + catatan wajib tampil).
 * - "Cara mengerjakannya" mengikuti keputusan pemilik: JS/TS, REST API, React di editor browser; NestJS · Next.js ·
 *   Laravel di VS Code dengan runner lokal yang melaporkan hasil test ke aplikasi.
 * - Semua ajakan mengarah ke jalur SQL yang sudah tersedia.
 *
 * Modul ini RINGAN (tanpa data misi): angka SQL yang disebut memakai angka bernama dari lib/content.ts.
 */
import { LICENSE_NAME, MASCOT_NAME, MISSION_COUNT, ROUTES, type FaqItem } from '../lib/content';
import { COURSE_SECTION_IDS, courseDocumentTitle } from '../lib/pagesContent';
import type { CourseCta, CourseHero, CourseRelated, CourseWaiting, IconItem, SoonCourse } from './types';

const PLAN_BADGE = 'Rencana';
const PLAN_NOTE = 'Ini rencana, bukan silabus: topik, urutan, dan isinya masih bisa berubah sebelum jalur ini dibuka.';
const RELATED_NOTE = 'Langkah 1–5 adalah urutan yang kami sarankan, bukan syarat.';

/** Bagian hero yang sama untuk semua jalur 'segera'. */
function soonHero(lead: string, proof: string, connected: readonly string[], logos: CourseHero['logos']): CourseHero {
  return {
    lead,
    cta: { start: 'Mulai dari SQL', resume: 'Lanjutkan SQL', note: '(gratis)', href: ROUTES.sql },
    outline: { label: 'Lihat rencana', target: COURSE_SECTION_IDS.plan },
    secondary: { label: 'Playground SQL', href: ROUTES.playground },
    proof,
    connected,
    logos,
  };
}

/** "Sambil menunggu, mulai dari SQL". */
function waitingFor(text: string): CourseWaiting {
  return {
    title: 'Sambil menunggu, mulai dari SQL',
    text,
    reasons: [`${MISSION_COUNT} misi SQL siap dikerjakan sekarang`, 'Kasus rumah sakit yang sama', 'Gratis, tanpa akun, langsung di browser'],
    cta: { label: 'Mulai dari SQL', href: ROUTES.sql },
  };
}

function ctaFor(title: string): CourseCta {
  return {
    title: `Belajar ${title} bersama ${MASCOT_NAME}`,
    lead: 'Jalur ini belum dibuka. Sambil menunggu, kerjakan misi SQL dengan kasus rumah sakit yang sama.',
    leadResume: 'Jalur ini belum dibuka. Sambil menunggu, lanjutkan misi SQL-mu dengan kasus rumah sakit yang sama.',
    leadDone: 'Jalur ini belum dibuka. Sementara itu, ulangi misi SQL, coba Playground, atau uji diri di Mode Ujian.',
    start: 'Mulai dari SQL',
    resume: 'Lanjutkan SQL',
    href: ROUTES.sql,
  };
}

function relatedFor(title: string, lead: string): CourseRelated {
  return { title: `Jalur yang terhubung dengan ${title}`, lead, note: RELATED_NOTE };
}

/** Pertanyaan yang sama untuk semua jalur 'segera' (kapan, sudah bisa dicoba, progres SQL, berbayar). */
function commonFaq(title: string): { when: FaqItem; tryNow: FaqItem; progress: FaqItem; price: FaqItem } {
  return {
    when: {
      id: 'kapan',
      question: `Kapan jalur ${title} tersedia?`,
      answer: ['Belum ada tanggalnya. Selama masih disiapkan, jalur ini ditandai Segera di seluruh aplikasi.'],
    },
    tryNow: {
      id: 'coba',
      question: 'Sudah bisa dicoba?',
      answer: [`Belum. Yang sudah bisa dikerjakan saat ini adalah jalur SQL: ${MISSION_COUNT} misi dengan kasus rumah sakit yang sama.`],
    },
    progress: {
      id: 'progres-sql',
      question: 'Apakah progres SQL-ku berpengaruh?',
      answer: [
        'Progres SQL tersimpan terpisah di browser ini dan tidak tersentuh oleh halaman ini.',
        'Bagaimana jalur ini nanti memakai bekal dari jalur SQL belum ditentukan.',
      ],
    },
    price: {
      id: 'biaya',
      question: 'Apakah jalur ini berbayar?',
      answer: [`Semua yang ada di aplikasi ini saat ini gratis, tanpa iklan dan tanpa akun, dan kode sumbernya terbuka berlisensi ${LICENSE_NAME}.`],
    },
  };
}

/** `subject` = apa yang dikerjakan, mis. "menulis dan menjalankan kode" (huruf kecil; disisipkan di tengah kalimat). */
const BROWSER_STEPS = (subject: string): readonly IconItem[] => [
  {
    icon: 'app-window',
    title: 'Editor di browser',
    text: `Rencananya kamu ${subject} di editor browser di dalam aplikasi, seperti misi SQL. Tidak ada yang perlu dipasang.`,
  },
  { icon: 'database', title: 'Kasus SIMRS yang sama', text: 'Data pasien, kunjungan, dan tagihan yang kamu kenal dari jalur SQL direncanakan dipakai lagi.' },
  { icon: 'clipboard-check', title: 'Dinilai otomatis', text: 'Jawabanmu direncanakan diperiksa oleh test, seperti misi SQL yang dinilai dari hasilnya.' },
];

/* ------------------------------------------------------------------ */
/* JavaScript & TypeScript                                             */
/* ------------------------------------------------------------------ */

const JS_TITLE = 'JavaScript & TypeScript';
const JS_FAQ = commonFaq(JS_TITLE);

const JS_COURSE: SoonCourse = {
  id: 'js',
  title: JS_TITLE,
  status: 'segera',
  icon: 'braces',
  env: 'browser',
  hero: soonHero(
    'Jalur ini sedang disiapkan. Rencananya: dasar bahasa sampai tipe yang ketat, dengan kasus SIMRS — mengolah data pasien, menghitung tagihan, dan menulis fungsi yang lolos pengujian, langsung di editor browser.',
    'Belum ada tanggal rilis · jalur SQL sudah bisa dikerjakan sekarang',
    ['sql', 'rest', 'react', 'framework'],
    ['si-javascript', 'si-typescript'],
  ),
  plan: {
    title: 'Rencana materi',
    lead: 'Gambaran isi yang sedang disiapkan, diturunkan dari tujuan jalur ini.',
    badge: PLAN_BADGE,
    note: PLAN_NOTE,
    topics: [
      { icon: 'braces', title: 'Dasar bahasa lewat data pasien', text: 'Variabel, kondisi, dan fungsi untuk membaca dan memeriksa data pasien.' },
      { icon: 'rows', title: 'Mengolah daftar kunjungan', text: 'Array dan objek: menyaring, mengelompokkan, dan merangkum kunjungan.' },
      { icon: 'sigma', title: 'Menghitung tagihan', text: 'Logika billing: menjumlahkan biaya, membedakan penjamin, dan memeriksa status bayar.' },
      { icon: 'pencil-ruler', title: 'Tipe yang ketat dengan TypeScript', text: 'Memodelkan pasien, kunjungan, dan tagihan sebagai tipe supaya kesalahan tertangkap sebelum kode dijalankan.' },
      { icon: 'clipboard-check', title: 'Fungsi yang lolos pengujian', text: 'Menulis fungsi yang dinilai otomatis oleh kumpulan test.' },
    ],
  },
  how: {
    title: 'Cara mengerjakannya',
    lead: 'Rencananya, jalur ini dikerjakan langsung di browser seperti jalur SQL.',
    env: 'browser',
    steps: BROWSER_STEPS('menulis dan menjalankan kode'),
    note: 'Detailnya masih bisa berubah sebelum jalur ini dibuka.',
  },
  waiting: waitingFor(
    'Jalur ini direncanakan memakai kasus rumah sakit yang sama dengan jalur SQL: pasien, kunjungan, dan tagihan. Mengenal tabel-tabelnya lebih dulu membuat langkah berikutnya lebih ringan.',
  ),
  faq: {
    title: `Pertanyaan tentang jalur ${JS_TITLE}`,
    items: [
      JS_FAQ.when,
      JS_FAQ.tryNow,
      { id: 'instal', question: 'Perlu memasang apa?', answer: ['Rencananya tidak ada: jalur ini dikerjakan di editor browser, seperti jalur SQL.'] },
      JS_FAQ.progress,
      JS_FAQ.price,
      {
        id: 'sambil-menunggu',
        question: 'Apa yang bisa kupelajari sambil menunggu?',
        answer: ['Jalur SQL. Kamu akan mengenal tabel pasien, kunjungan, dan tagihan yang direncanakan dipakai lagi di jalur ini.'],
      },
    ],
  },
  related: relatedFor(JS_TITLE, 'Urutan yang kami sarankan dimulai dari SQL: kenali datanya dulu, lalu olah dengan JavaScript & TypeScript sebelum membukanya lewat REST API.'),
  cta: ctaFor(JS_TITLE),
  meta: {
    title: courseDocumentTitle(JS_TITLE),
    description: 'Rencana jalur JavaScript & TypeScript: mengolah data pasien dan menghitung tagihan dengan kasus rumah sakit. Segera; jalur SQL sudah bisa dikerjakan sekarang.',
    ogTitle: `Jalur ${JS_TITLE} sedang disiapkan`,
    ogDescription: 'Dasar bahasa sampai tipe yang ketat, dengan kasus SIMRS, di editor browser. Belum ada tanggal rilis.',
  },
};

/* ------------------------------------------------------------------ */
/* REST API                                                            */
/* ------------------------------------------------------------------ */

const REST_TITLE = 'REST API';
const REST_FAQ = commonFaq(REST_TITLE);

const REST_COURSE: SoonCourse = {
  id: 'rest',
  title: REST_TITLE,
  status: 'segera',
  icon: 'globe',
  env: 'browser',
  hero: soonHero(
    'Jalur ini sedang disiapkan. Rencananya: merancang dan memanggil REST API di atas database SIMRS yang sama — resource, metode, kode status, validasi, dan paginasi.',
    'Belum ada tanggal rilis · jalur SQL sudah bisa dikerjakan sekarang',
    ['sql', 'js', 'react', 'framework'],
    ['globe'],
  ),
  plan: {
    title: 'Rencana materi',
    lead: 'Gambaran isi yang sedang disiapkan, diturunkan dari tujuan jalur ini.',
    badge: PLAN_BADGE,
    note: PLAN_NOTE,
    topics: [
      { icon: 'globe', title: 'Resource & alamat', text: 'Memetakan pasien, kunjungan, dan tagihan menjadi resource dengan alamat yang rapi.' },
      { icon: 'arrow-left-right', title: 'Metode HTTP', text: 'GET, POST, PUT, PATCH, dan DELETE: kapan memakai yang mana.' },
      { icon: 'check', title: 'Kode status', text: 'Membedakan 200, 201, 400, dan 404 supaya pemanggil tahu apa yang terjadi.' },
      { icon: 'shield-alert', title: 'Validasi input', text: 'Menolak data pendaftaran yang tidak lengkap atau tidak masuk akal.' },
      { icon: 'rows', title: 'Paginasi', text: 'Membagi daftar kunjungan yang panjang menjadi halaman-halaman.' },
    ],
  },
  how: {
    title: 'Cara mengerjakannya',
    lead: 'Rencananya, jalur ini dikerjakan langsung di browser seperti jalur SQL.',
    env: 'browser',
    steps: BROWSER_STEPS('merancang dan memanggil endpoint'),
    note: 'Detailnya masih bisa berubah sebelum jalur ini dibuka.',
  },
  waiting: waitingFor(
    'Endpoint di jalur ini direncanakan berdiri di atas database SIMRS yang sama dengan jalur SQL. Memahami tabel dan relasinya lebih dulu membuat rancangan API-mu lebih masuk akal.',
  ),
  faq: {
    title: `Pertanyaan tentang jalur ${REST_TITLE}`,
    items: [
      REST_FAQ.when,
      REST_FAQ.tryNow,
      {
        id: 'instal',
        question: 'Perlu memasang server atau aplikasi lain?',
        answer: ['Rencananya tidak: jalur ini dikerjakan di editor browser, seperti jalur SQL.'],
      },
      REST_FAQ.progress,
      REST_FAQ.price,
      {
        id: 'bekal',
        question: 'Bekal apa yang membantu?',
        answer: ['Memahami tabel dan relasi di database SIMRS. Jalur SQL membahasnya dari SELECT pertama sampai JOIN dan desain tabel.'],
      },
    ],
  },
  related: relatedFor(REST_TITLE, 'REST API membuka data SIMRS bagi aplikasi lain. Datanya berasal dari tabel di jalur SQL, dan hasilnya nanti ditampilkan oleh React.'),
  cta: ctaFor(REST_TITLE),
  meta: {
    title: courseDocumentTitle(REST_TITLE),
    description: 'Rencana jalur REST API: resource, metode, kode status, validasi, dan paginasi di atas database SIMRS. Segera; jalur SQL sudah bisa dikerjakan sekarang.',
    ogTitle: `Jalur ${REST_TITLE} sedang disiapkan`,
    ogDescription: 'Merancang dan memanggil REST API di atas database SIMRS yang sama, di editor browser. Belum ada tanggal rilis.',
  },
};

/* ------------------------------------------------------------------ */
/* React                                                               */
/* ------------------------------------------------------------------ */

const REACT_TITLE = 'React';
const REACT_FAQ = commonFaq(REACT_TITLE);

const REACT_COURSE: SoonCourse = {
  id: 'react',
  title: REACT_TITLE,
  status: 'segera',
  icon: 'atom',
  env: 'browser',
  hero: soonHero(
    'Jalur ini sedang disiapkan. Rencananya: komponen, state, dan pengambilan data untuk layar-layar SIMRS — dari daftar pasien sampai formulir pendaftaran.',
    'Belum ada tanggal rilis · jalur SQL sudah bisa dikerjakan sekarang',
    ['sql', 'js', 'rest', 'framework'],
    ['si-react'],
  ),
  plan: {
    title: 'Rencana materi',
    lead: 'Gambaran isi yang sedang disiapkan, diturunkan dari tujuan jalur ini.',
    badge: PLAN_BADGE,
    note: PLAN_NOTE,
    topics: [
      { icon: 'app-window', title: 'Komponen layar loket', text: 'Memecah layar pendaftaran menjadi komponen yang bisa dipakai ulang.' },
      { icon: 'repeat', title: 'State & interaksi', text: 'Antrean yang bergerak saat pasien dipanggil: state, event, dan render ulang.' },
      { icon: 'rows', title: 'Daftar pasien', text: 'Menampilkan, menyaring, dan mengurutkan data dalam bentuk daftar.' },
      { icon: 'pencil-ruler', title: 'Formulir pendaftaran', text: 'Input terkendali dan validasi sebelum data dikirim.' },
      { icon: 'globe', title: 'Mengambil data', text: 'Memuat data rekam medis dari API, lengkap dengan keadaan memuat dan gagal.' },
    ],
  },
  how: {
    title: 'Cara mengerjakannya',
    lead: 'Rencananya, jalur ini dikerjakan langsung di browser seperti jalur SQL.',
    env: 'browser',
    steps: BROWSER_STEPS('membangun komponen dan melihat hasilnya'),
    note: 'Detailnya masih bisa berubah sebelum jalur ini dibuka.',
  },
  waiting: waitingFor(
    'Layar-layar di jalur ini direncanakan menampilkan data rumah sakit yang sama dengan jalur SQL. Mengenal datanya lebih dulu membuatmu tahu apa yang sebenarnya sedang ditampilkan.',
  ),
  faq: {
    title: `Pertanyaan tentang jalur ${REACT_TITLE}`,
    items: [
      REACT_FAQ.when,
      REACT_FAQ.tryNow,
      { id: 'instal', question: 'Perlu memasang apa?', answer: ['Rencananya tidak ada: jalur ini dikerjakan di editor browser, seperti jalur SQL.'] },
      REACT_FAQ.progress,
      REACT_FAQ.price,
      {
        id: 'bekal',
        question: 'Perlu bisa JavaScript dulu?',
        answer: ['React ditulis dengan JavaScript, jadi dasar bahasanya membantu. Karena itu jalur JavaScript & TypeScript ada sebelum React dalam urutan yang kami sarankan.'],
      },
    ],
  },
  related: relatedFor(REACT_TITLE, 'React menampilkan data yang dibuka REST API dan diolah dengan JavaScript & TypeScript — semuanya berawal dari tabel di jalur SQL.'),
  cta: ctaFor(REACT_TITLE),
  meta: {
    title: courseDocumentTitle(REACT_TITLE),
    description: 'Rencana jalur React: komponen, state, dan pengambilan data untuk layar loket, antrean, dan rekam medis. Segera; jalur SQL sudah bisa dikerjakan sekarang.',
    ogTitle: `Jalur ${REACT_TITLE} sedang disiapkan`,
    ogDescription: 'Antarmuka loket, antrean, dan rekam medis dengan React, di editor browser. Belum ada tanggal rilis.',
  },
};

/* ------------------------------------------------------------------ */
/* NestJS · Next.js · Laravel                                          */
/* ------------------------------------------------------------------ */

const FW_TITLE = 'NestJS · Next.js · Laravel';
const FW_FAQ = commonFaq(FW_TITLE);

const FRAMEWORK_COURSE: SoonCourse = {
  id: 'framework',
  title: FW_TITLE,
  status: 'segera',
  icon: 'layers',
  env: 'vscode',
  hero: soonHero(
    'Jalur ini sedang disiapkan. Rencananya: membangun modul SIMRS sebagai proyek nyata — struktur proyek, migrasi, dan pengujian — di VS Code, dengan runner lokal yang melaporkan hasil test ke aplikasi.',
    'Belum ada tanggal rilis · direncanakan dikerjakan di VS Code',
    ['sql', 'js', 'rest', 'react'],
    ['si-nestjs', 'si-nextdotjs', 'si-laravel'],
  ),
  plan: {
    title: 'Rencana materi',
    lead: 'Gambaran isi yang sedang disiapkan, diturunkan dari tujuan jalur ini.',
    badge: PLAN_BADGE,
    note: PLAN_NOTE,
    topics: [
      { icon: 'layers', title: 'Struktur proyek', text: 'Menata modul SIMRS mengikuti konvensi framework: routing, controller, dan service.' },
      { icon: 'table', title: 'Migrasi database', text: 'Membuat dan mengubah tabel SIMRS lewat migrasi, bukan lewat SQL yang diketik manual.' },
      { icon: 'workflow', title: 'Satu modul utuh', text: 'Satu fitur dari database sampai antarmuka, misalnya pendaftaran pasien.' },
      { icon: 'clipboard-check', title: 'Pengujian', text: 'Menulis dan menjalankan test supaya modulnya terbukti benar.' },
      { icon: 'square-stack', title: 'Tiga ekosistem', text: 'Konsep yang sama di NestJS, Next.js, dan Laravel.' },
    ],
  },
  how: {
    title: 'Cara mengerjakannya',
    lead: 'Rencananya, jalur ini dikerjakan di komputermu sendiri sebagai proyek sungguhan.',
    env: 'vscode',
    steps: [
      { icon: 'terminal', title: 'Proyek di VS Code', text: 'Rencananya kamu mengerjakan proyek framework di VS Code, di komputermu sendiri.' },
      { icon: 'clipboard-check', title: 'Runner lokal menjalankan test', text: 'Runner yang direncanakan berjalan di komputermu menjalankan test proyek itu.' },
      { icon: 'chart', title: 'Hasilnya tercatat di aplikasi', text: 'Runner direncanakan melaporkan hasil test ke aplikasi, sehingga kemajuanmu tercatat seperti misi di jalur SQL.' },
    ],
    note: 'Detail runner dan cara memasangnya belum final.',
  },
  waiting: waitingFor(
    'Modul-modul di jalur ini direncanakan dibangun di atas database SIMRS yang sama. Migrasi, relasi, dan query yang baik semuanya berawal dari memahami tabel — persis yang dilatih jalur SQL.',
  ),
  faq: {
    title: `Pertanyaan tentang jalur ${FW_TITLE}`,
    items: [
      FW_FAQ.when,
      FW_FAQ.tryNow,
      {
        id: 'instal',
        question: 'Perlu memasang apa?',
        answer: [
          'Rencananya VS Code dan runner lokal, ditambah perangkat yang dibutuhkan framework-nya: Node.js untuk NestJS dan Next.js, PHP untuk Laravel. Daftar pastinya belum final.',
        ],
      },
      FW_FAQ.progress,
      FW_FAQ.price,
      {
        id: 'beda',
        question: 'Kenapa jalur ini tidak di browser seperti jalur lain?',
        answer: ['Karena isinya proyek utuh dengan framework sungguhan: struktur folder, migrasi, dan test yang dijalankan di komputermu. Runner lokal menghubungkan hasilnya kembali ke aplikasi.'],
      },
    ],
  },
  related: relatedFor(FW_TITLE, 'Jalur ini menyatukan semua langkah sebelumnya — data, logika, API, dan antarmuka — dalam satu proyek framework.'),
  cta: ctaFor(FW_TITLE),
  meta: {
    title: courseDocumentTitle(FW_TITLE),
    description: 'Rencana jalur NestJS · Next.js · Laravel: membangun modul SIMRS sebagai proyek nyata di VS Code dengan runner lokal. Segera; jalur SQL sudah bisa dikerjakan.',
    ogTitle: 'Jalur NestJS · Next.js · Laravel sedang disiapkan',
    ogDescription: 'Proyek utuh dengan framework sungguhan: struktur proyek, migrasi, dan pengujian. Belum ada tanggal rilis.',
  },
};

export const SOON_COURSES: readonly SoonCourse[] = [JS_COURSE, REST_COURSE, REACT_COURSE, FRAMEWORK_COURSE];
