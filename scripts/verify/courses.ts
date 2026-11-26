/**
 * Verifikasi halaman katalog ('#/landing') dan landing per jalur ('#/landing/<id>'):
 *
 * - registri   data jalur (src/platform/landing/courses/) = registri jalur: id unik & sama urutannya, status, judul,
 *              ikon; ringkasan katalog lengkap; urutan belajar yang disarankan SQL → JS & TS → REST → React → framework
 * - SQL        silabus SAMA dengan kurikulum (tier, judul & deskripsi tier, misi per tier dan urutannya, jenis misi,
 *              Boss, materi per tier); statistik & hitungan cocok; 6 fitur, 4 alasan, 6 FAQ; contoh latihan merujuk
 *              PRACTICE yang sudah diverifikasi; klaim di teks (hint, ujian, dialek, Playground) cocok dengan aplikasi
 * - segera     tanpa silabus/statistik/angka pelajaran; rencana bertanda rencana; tanpa tanggal; cara mengerjakan
 *              sesuai keputusan pemilik (browser / VS Code + runner lokal); FAQ jujur; semua ajakan ke SQL
 * - tautan     setiap href di data jalur, katalog, 404, dan label bersama adalah hash kanonik yang dikenal router
 *              (bukan '#id'); tujuan gulir hero adalah section yang ada
 * - meta       judul tab "Belajar {Nama} — Jalur Interaktif Gratis | SIMRS Quest", deskripsi, JSON-LD (Course +
 *              BreadcrumbList + FAQPage / ItemList)
 * - progres    pembaca progres silabus hanya membaca, tidak melempar, dan status Boss mengikuti aturan aplikasi
 * - ringan     halaman & data jalur TIDAK terjangkau statis dari Beranda (src/main.tsx); shell memuatnya dengan
 *              import(); halaman katalog tidak memuat data misi; tidak ada halaman yang menjangkau mesin SQL
 *
 * Kata terlarang di berkas-berkas baru diperiksa scripts/verify/landing.ts (memindai seluruh src/platform/landing).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { displayKind } from '../../src/components/MissionKind';
import { PLAYGROUND_EXAMPLES } from '../../src/components/PlaygroundSidebar';
import { ARTICLES } from '../../src/data/materi';
import { MISSIONS, TIERS, TOTAL_XP } from '../../src/data/missions';
import { isBoss } from '../../src/lib/boss';
import { HINT_PENALTY, createEmptyProgress } from '../../src/lib/progress';
import { PROGRESS_KEY } from '../../src/lib/storageKeys';
import { PRODUCT_NAME } from '../../src/platform/brand';
import { COURSES, MISSION_KIND_LABEL, PLAYGROUND_EXAMPLE_COUNT, getCourse, isAvailableCourse, type CourseData } from '../../src/platform/landing/courses';
import { COURSES_BY_STEP, COURSE_SUMMARIES, SUGGESTED_ORDER, courseSummary, matchesQuery, relatedCourses } from '../../src/platform/landing/courses/catalog';
import { readCourseProgress } from '../../src/platform/landing/courses/progress';
import { catalogJsonLd, courseJsonLd } from '../../src/platform/landing/courses/seo';
import * as content from '../../src/platform/landing/lib/content';
import { CATALOG, CATALOG_META, CATALOG_SECTION_IDS, COURSE_SECTION_IDS, COURSE_UI, NOT_FOUND, NOT_FOUND_META, PAGE_UI, countWord, courseDocumentTitle } from '../../src/platform/landing/lib/pagesContent';
import { APP_SUCCESS, RUN_EXAMPLES } from '../../src/platform/landing/pages/course/rows/runExamples';
import { courseHref, formatRoute, parseRoute } from '../../src/platform/router';
import { TRACKS as REGISTRY, getTrack } from '../../src/platform/tracks';
import type { UserProgress } from '../../src/types';
import { FORBIDDEN, isEngineItem, landingFiles } from './landing';
import { MemoryStorage, firstDifference } from './memoryStorage';
import { staticClosure, staticImports } from './platform';
import { assert } from './report';

type Check = (cond: boolean, msg: string) => void;

function readSource(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Semua string di dalam sebuah nilai (fungsi dilewati), beserta jalurnya — untuk memeriksa teks & tautan. */
function strings(value: unknown, path = '$'): Array<{ path: string; text: string }> {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, `${path}[${index}]`));
  if (typeof value === 'object' && value !== null) return Object.entries(value).flatMap(([key, item]) => strings(item, `${path}.${key}`));
  return [];
}

/** Segmen masuk jalur SQL yang benar-benar dikenali (ENTRY_MODES di src/App.tsx). */
function entrySegments(): string[] {
  const source = readSource('src/App.tsx');
  const block = /const ENTRY_MODES[^=]*=\s*new Map<[^>]*>\(\[([\s\S]*?)\]\);/.exec(source)?.[1] ?? '';
  return [...block.matchAll(/\['([a-z-]+)',/g)].map((match) => match[1] ?? '');
}

/**
 * Hash tujuan yang sah: kanonik, dan rutenya Beranda / katalog / landing jalur yang ada / jalur yang TERSEDIA (tanpa
 * segmen, atau dengan satu segmen masuk yang dikenali). Jalur 'segera' tidak boleh ditaut langsung (akan dialihkan).
 */
function hrefProblem(hash: string, entries: readonly string[]): string | null {
  if (!hash.startsWith('#/')) return 'bukan rute (jangan memakai "#id" untuk gulir — pakai scrollToSection)';
  const route = parseRoute(hash);
  if (formatRoute(route) !== hash) return `tidak kanonik (seharusnya ${formatRoute(route)})`;
  switch (route.kind) {
    case 'home':
    case 'catalog':
      return null;
    case 'course':
      return getTrack(route.slug) ? null : `landing jalur "${route.slug}" tidak ada di registri`;
    case 'track': {
      if (getTrack(route.trackId)?.status !== 'tersedia') return `jalur "${route.trackId}" belum tersedia — tautkan ke landing-nya`;
      if (route.rest.length === 0) return null;
      return route.rest.length === 1 && entries.includes(route.rest[0] ?? '') ? null : `segmen masuk "${route.rest.join('/')}" tidak dikenali jalur`;
    }
    default:
      return 'rute tidak dikenal';
  }
}

/* ------------------------------------------------------------------ */
/* Registri ↔ data jalur                                               */
/* ------------------------------------------------------------------ */

function verifyRegistryMatch(ok: Check): void {
  const ids = COURSES.map((c) => c.id);
  ok(same(ids, REGISTRY.map((t) => t.id)), `courses: id & urutan harus sama dengan registri (${REGISTRY.map((t) => t.id).join(', ')}), sekarang ${ids.join(', ')}`);
  ok(new Set(ids).size === ids.length, 'courses: id jalur harus unik');
  for (const track of REGISTRY) {
    const course = getCourse(track.id);
    ok(course !== undefined, `courses: jalur registri "${track.id}" belum punya data landing`);
    if (!course) continue;
    ok(course.status === track.status, `courses ${track.id}: status "${course.status}" ≠ registri "${track.status}"`);
    ok(course.title === track.title, `courses ${track.id}: judul "${course.title}" ≠ registri "${track.title}"`);
    ok(course.icon === content.TRACKS.find((t) => t.id === track.id)?.icon, `courses ${track.id}: ikon harus sama dengan menu navbar (content.TRACKS)`);
    const summary = courseSummary(track.id);
    ok(summary !== undefined && summary.href === courseHref(track.id) && summary.env === course.env && summary.status === track.status && summary.description === track.description, `catalog ${track.id}: ringkasan kartu harus cocok dengan registri & data jalur`);
  }
  ok(same(COURSE_SUMMARIES.map((c) => c.id), REGISTRY.map((t) => t.id)), 'catalog: COURSE_SUMMARIES harus memuat semua jalur registri, urut registri');
  ok(same(SUGGESTED_ORDER, ['sql', 'js', 'rest', 'react', 'framework']), 'catalog: urutan yang disarankan harus SQL → JS & TS → REST API → React → framework');
  ok(same([...SUGGESTED_ORDER].sort(), REGISTRY.map((t) => t.id).sort()), 'catalog: SUGGESTED_ORDER harus memuat setiap jalur registri tepat sekali');
  ok(same(COURSES_BY_STEP.map((c) => c.step), SUGGESTED_ORDER.map((_, i) => i + 1)), 'catalog: langkah harus 1..n mengikuti SUGGESTED_ORDER');
  for (const course of COURSE_SUMMARIES) {
    const related = relatedCourses(course.id);
    ok(related.length === COURSE_SUMMARIES.length - 1 && !related.some((r) => r.id === course.id), `catalog: relatedCourses("${course.id}") harus semua jalur lain`);
    ok(course.logos.length >= 1 && course.logos.length <= 3, `catalog ${course.id}: 1–3 logo`);
    ok(matchesQuery(course, course.title) && matchesQuery(course, '') && !matchesQuery(course, 'zzzz-tidak-ada'), `catalog ${course.id}: pencarian harus cocok dengan judulnya sendiri`);
  }
  ok(COURSE_SUMMARIES.filter((c) => matchesQuery(c, 'react')).map((c) => c.id).join() === 'react', 'catalog: mencari "react" harus menemukan jalur React saja');
  ok(COURSE_SUMMARIES.filter((c) => c.env === 'vscode').map((c) => c.id).join() === 'framework', 'catalog: hanya jalur framework yang dikerjakan di VS Code (keputusan pemilik)');
}

/* ------------------------------------------------------------------ */
/* Bagian bersama setiap jalur                                         */
/* ------------------------------------------------------------------ */

function verifyCommon(ok: Check, course: CourseData): void {
  const id = course.id;
  const { hero, meta } = course;
  ok(hero.lead.trim() !== '' && hero.proof.trim() !== '', `courses ${id}: hero butuh deskripsi & baris bukti`);
  ok(hero.cta.start.trim() !== '' && hero.cta.resume.trim() !== '' && hero.cta.note.trim() !== '', `courses ${id}: tombol utama hero butuh teks mulai/lanjutkan/catatan`);
  ok(hero.logos.length >= 1 && hero.logos.length <= 3, `courses ${id}: kartu logo hero berisi 1–3 logo`);
  ok(new Set(hero.connected).size === hero.connected.length && hero.connected.every((other) => other !== id && getTrack(other) !== undefined), `courses ${id}: "Terhubung dengan" harus jalur lain di registri, tanpa duplikat`);
  const target = course.status === 'tersedia' ? COURSE_SECTION_IDS.syllabus : COURSE_SECTION_IDS.plan;
  ok(hero.outline.target === target, `courses ${id}: tombol "${hero.outline.label}" harus menggulir ke section ${target}`);
  ok(meta.title === courseDocumentTitle(course.title) && meta.title === `Belajar ${course.title} — Jalur Interaktif Gratis | ${PRODUCT_NAME}`, `courses ${id}: judul tab harus "Belajar ${course.title} — Jalur Interaktif Gratis | ${PRODUCT_NAME}"`);
  ok(meta.description.length >= 70 && meta.description.length <= 170, `courses ${id}: meta description ${meta.description.length} karakter (harus 70–170)`);
  ok(meta.ogTitle.trim() !== '' && meta.ogDescription.trim() !== '', `courses ${id}: og:title & og:description tidak boleh kosong`);
  ok(course.cta.title === `Belajar ${course.title} bersama ${content.MASCOT_NAME}`, `courses ${id}: CTA penutup harus "Belajar ${course.title} bersama ${content.MASCOT_NAME}"`);
  // Pengguna yang sudah mulai / sudah tuntas tidak boleh disambut seperti pengunjung baru.
  ok(
    course.cta.leadResume.trim() !== '' && course.cta.leadDone.trim() !== '' && new Set([course.cta.lead, course.cta.leadResume, course.cta.leadDone]).size === 3 && ![course.cta.leadResume, course.cta.leadDone].some((s) => /pertama/i.test(s)),
    `courses ${id}: CTA penutup butuh kalimat sendiri untuk pengguna yang sudah mulai dan yang sudah tuntas (tanpa "misi pertama")`,
  );
  ok(course.related.title.includes(course.title) && /saran/i.test(course.related.note), `courses ${id}: "Jalur yang terhubung" harus menyebut jalurnya dan menyatakan urutannya saran`);
  const faqIds = course.faq.items.map((item) => item.id);
  ok(course.faq.items.length === 6, `courses ${id}: FAQ harus 6 pertanyaan (sekarang ${course.faq.items.length})`);
  ok(new Set(faqIds).size === faqIds.length, `courses ${id}: id FAQ harus unik`);
  for (const item of course.faq.items) ok(item.question.trim().endsWith('?') && item.answer.length > 0 && item.answer.every((p) => p.trim() !== ''), `courses ${id}: FAQ ${item.id} butuh pertanyaan dan jawaban`);
}

/* ------------------------------------------------------------------ */
/* Jalur SQL (tersedia)                                                */
/* ------------------------------------------------------------------ */

function verifySql(ok: Check): void {
  const course = getCourse('sql');
  if (!course || !isAvailableCourse(course)) {
    ok(false, 'courses: jalur sql harus berstatus tersedia dengan data lengkap');
    return;
  }
  const bosses = MISSIONS.filter(isBoss);
  ok(same(course.stats, [
    { value: MISSIONS.length, label: 'misi' },
    { value: bosses.length, label: 'Boss' },
    { value: ARTICLES.length, label: 'materi' },
    { value: TOTAL_XP, label: 'XP' },
  ]), `courses sql: statistik harus ${MISSIONS.length} misi · ${bosses.length} Boss · ${ARTICLES.length} materi · ${TOTAL_XP} XP`);
  ok(course.features.items.length === 6, `courses sql: tepat 6 fitur (sekarang ${course.features.items.length})`);
  ok(course.why.items.length === 4, `courses sql: tepat 4 alasan (sekarang ${course.why.items.length})`);
  ok(course.parts.items.length >= 4, 'courses sql: "Isi jalur" minimal 4 kartu');
  ok(new Set(course.parts.items.map((p) => p.id)).size === course.parts.items.length, 'courses sql: id kartu "Isi jalur" harus unik');

  // Silabus = kurikulum.
  const { syllabus } = course;
  ok(syllabus.tiers.length === TIERS.length, `silabus: ${syllabus.tiers.length} tier, kurikulum ${TIERS.length}`);
  ok(same(syllabus.meta, [`${TIERS.length} tier`, `${bosses.length} Boss`, `${MISSIONS.length} misi`, `${ARTICLES.length} materi`]), 'silabus: baris meta harus jumlah tier, Boss, misi, dan materi kurikulum');
  ok(new Set(syllabus.tiers.map((t) => t.value)).size === syllabus.tiers.length, 'silabus: nilai accordion tiap tier harus unik');
  TIERS.forEach((info, index) => {
    const tier = syllabus.tiers[index];
    if (!tier) return;
    const missions = MISSIONS.filter((m) => m.tier === info.tier).sort((a, b) => a.order - b.order);
    const articles = ARTICLES.filter((a) => a.tier === info.tier);
    const boss = missions.find(isBoss);
    ok(tier.tier === info.tier && tier.title === info.name && tier.description === info.description && tier.label === `Tier ${info.tier}`, `silabus tier ${info.tier}: nomor/judul/deskripsi harus sama dengan kurikulum`);
    ok(same(tier.missions.map((m) => m.id), missions.map((m) => m.id)), `silabus tier ${info.tier}: daftar & urutan misi harus sama dengan kurikulum`);
    tier.missions.forEach((m, i) => {
      const real = missions[i];
      if (!real) return;
      const kind = displayKind(real);
      ok(m.title === real.title && m.order === real.order && m.number === String(real.order).padStart(2, '0') && m.concept === real.concept && m.xp === real.xpReward, `silabus misi ${real.id}: judul/nomor/konsep/XP tidak cocok`);
      ok(m.kind === kind && m.kindLabel === MISSION_KIND_LABEL[kind], `silabus misi ${real.id}: jenis "${m.kind}" ≠ aplikasi "${kind}"`);
    });
    ok(tier.boss?.id === boss?.id && (boss === undefined || tier.missions.some((m) => m.id === boss.id)), `silabus tier ${info.tier}: Boss harus ${boss?.id ?? '(tidak ada)'}`);
    ok(same(tier.articles.map((a) => a.id), articles.map((a) => a.id)), `silabus tier ${info.tier}: materi harus artikel tier itu, urut seperti di aplikasi`);
    ok(same(tier.chips, [`${missions.length} misi`, ...(boss ? ['1 Boss'] : []), `${articles.length} materi`]), `silabus tier ${info.tier}: chip harus "${missions.length} misi", "1 Boss", "${articles.length} materi"`);
    ok(tier.start.href === content.ROUTES.sql, `silabus tier ${info.tier}: tombol Mulai harus membuka jalur SQL`);
  });
  ok(syllabus.tiers.reduce((sum, t) => sum + t.missions.length, 0) === MISSIONS.length, 'silabus: total misi harus sama dengan kurikulum');
  ok(syllabus.tiers.reduce((sum, t) => sum + t.articles.length, 0) === ARTICLES.length, 'silabus: setiap artikel materi harus muncul tepat sekali');
  ok(syllabus.tiers.every((t) => t.boss !== null) && /masing-masing ditutup satu Boss/.test(syllabus.lead ?? ''), 'silabus: klaim "masing-masing ditutup satu Boss" harus benar');
  ok(syllabus.progress(3, MISSIONS.length) === `3 dari ${MISSIONS.length} misi selesai`, 'silabus: pill kemajuan harus "{n} dari {total} misi selesai"');

  // Kosakata jenis misi = Beranda (FEATURES.tabs.missions.kinds).
  const homeKinds = content.FEATURES.tabs.missions.kinds.map((k) => k.label).sort();
  ok(same(Object.values(MISSION_KIND_LABEL).sort(), homeKinds), `jenis misi: label harus sama dengan Beranda (${homeKinds.join(', ')})`);

  // Klaim di teks.
  const allText = strings(course).map((s) => s.text).join('\n');
  const pct = `${Math.round(HINT_PENALTY * 100)}%`;
  ok(course.features.items.some((f) => f.text.includes(pct)) && course.rows.ways.tabs.some((t) => t.text.includes(pct)), `courses sql: penalti hint harus disebut ${pct}`);
  ok(course.features.items[0]?.text.includes(MISSIONS[0]?.title ?? '?') === true, 'courses sql: fitur "Mulai dari SELECT" harus menyebut judul misi pertama');
  ok(MISSIONS[0]?.concept === 'SELECT', 'courses sql: klaim "mulai dari SELECT" — misi pertama harus berkonsep SELECT');
  ok(PLAYGROUND_EXAMPLE_COUNT === PLAYGROUND_EXAMPLES.length, `courses sql: PLAYGROUND_EXAMPLE_COUNT ${PLAYGROUND_EXAMPLE_COUNT} ≠ ${PLAYGROUND_EXAMPLES.length} contoh di Playground`);
  for (const n of content.EXAM_QUESTION_COUNTS) ok(allText.includes(String(n)), `courses sql: pilihan ${n} soal ujian harus disebut`);
  for (const days of content.REVIEW_INTERVAL_DAYS) ok(course.features.items.some((f) => f.text.includes(String(days))), `courses sql: jarak latihan ulang ${days} hari harus disebut`);
  const dialectText = JSON.stringify(ARTICLES.map((a) => a.dialects));
  for (const syntax of ['TOP', 'FETCH FIRST', 'IFNULL', 'ISNULL', 'NVL']) ok(dialectText.includes(syntax), `courses sql: FAQ dialek menyebut ${syntax}, tetapi kotak Beda dialek materi tidak memuatnya`);
  ok(readSource('src/components/materi/ArticleView.tsx').includes("'MySQL / MariaDB'"), 'courses sql: FAQ dialek menyebut "MySQL / MariaDB" — label itu harus ada di layar Materi');
  ok(course.rows.run.tabs.every((tab) => tab.label === content.PRACTICE.tabs[tab.id].label), 'courses sql: tab "Jalankan query" harus merujuk contoh PRACTICE dengan label yang sama');
  ok(/ilustrasi/i.test(course.rows.streak.note) && /bukan riwayat per hari/.test(course.rows.streak.note), 'courses sql: kalender streak harus disebut ilustrasi (aplikasi tidak menyimpan riwayat per hari)');
  ok(!/freeze|double or nothing/i.test(allText), 'courses sql: tidak ada streak freeze / double or nothing');
  ok(course.rows.bosses.title.includes(String(bosses.length)) && /tidak mengunci/.test(course.rows.bosses.rule), `courses sql: baris Boss harus menyebut ${bosses.length} Boss dan aturan "tidak mengunci tier berikutnya"`);
  ok(course.parts.items.some((p) => p.count.includes(content.formatNumber(content.PERF_LAB_VISITS))), 'courses sql: kartu Lab Performa harus menyebut jumlah kunjungan sintetis');
  ok(course.hero.cta.href === content.ROUTES.sql && course.cta.href === content.ROUTES.sql && course.hero.secondary.href === content.ROUTES.playground, 'courses sql: tombol hero/CTA ke #/sql, tombol kedua ke #/sql/playground');
  ok(course.hero.proof === 'Gratis · tanpa akun · berjalan di browsermu', 'courses sql: baris bukti hero');

  // Panggung hero: cuplikan misi SUNGGUHAN (query sama persis, hanya baris/spasi yang dipadatkan) + penilaian aplikasi.
  const glimpse = course.hero.glimpse;
  const heroMission = content.PRACTICE.tabs.query;
  const squash = (sql: string) => sql.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').trim();
  ok(glimpse !== undefined && squash(glimpse.code) === squash(heroMission.code), 'courses sql: kode di panggung hero harus query misi PRACTICE.tabs.query (hanya beda baris/spasi)');
  ok(
    glimpse !== undefined && glimpse.label === heroMission.tierLabel && glimpse.fileName === heroMission.fileName && glimpse.verdict === content.PRACTICE.verdict.correct && glimpse.xp === content.PRACTICE.verdict.xp(heroMission.xp),
    'courses sql: label, nama berkas, judul penilaian, dan XP panggung hero harus dari misi yang sama',
  );

  // Potongan antarmuka di grid fitur: semuanya benar-benar ada di aplikasi.
  const tokens = course.features.items.map((item) => item.token.text);
  ok(tokens.length === 6 && new Set(tokens).size === 6, 'courses sql: setiap fitur punya satu potongan antarmuka, tanpa duplikat');
  ok(tokens.includes('SELECT') && tokens.includes(`−${pct} XP`), `courses sql: fitur memuat kata kunci SELECT dan penalti hint −${pct} XP`);
  ok(tokens.includes('Tab Perbedaan') && readSource('src/components/MissionOutput.tsx').includes("label: 'Perbedaan'"), 'courses sql: "Tab Perbedaan" harus tab yang ada di layar hasil misi');
  ok(tokens.includes('Beda dialek') && readSource('src/components/materi/ArticleView.tsx').includes('Beda dialek'), 'courses sql: "Beda dialek" harus kotak yang ada di layar Materi');
  ok(tokens.includes(`${content.REVIEW_INTERVAL_DAYS.join(' → ')} hari`) && tokens.includes(`${content.RANK_COUNT} pangkat`), 'courses sql: jadwal latihan ulang & jumlah pangkat di potongan fitur harus angka aplikasi');
  const reviewFeature = course.features.items.find((item) => item.icon === 'repeat')?.text ?? '';
  ok(/jawab benar/i.test(reviewFeature) && /besok/.test(reviewFeature) && /SQL dan Tebak Hasil/.test(reviewFeature), 'courses sql: fitur latihan ulang harus menyebut aturannya (benar → makin jarang, salah → besok) dan jenis misinya');

  // Baris "Jalankan query": tab yang tidak dinilai "hasil vs seharusnya" tidak boleh digambarkan begitu.
  const { run } = course.rows;
  const injection = content.PRACTICE.tabs.injection;
  ok(run.columnsByTab.injection?.yours === injection.vulnerable.label && run.columnsByTab.injection.expected !== run.columns.expected, 'Lab Injection: kolomnya mode rentan vs mode aman, bukan "Hasil kamu / Seharusnya"');
  ok(run.columnsByTab.predict !== undefined && run.columnsByTab.predict.yours !== run.columns.yours, 'Tebak Hasil: kolomnya pilihanmu vs jawaban yang benar');
  ok(RUN_EXAMPLES.injection.verdict === 'match' && RUN_EXAMPLES.injection.verdictText?.title === APP_SUCCESS.injection.title, 'Lab Injection: kebocoran di mode rentan adalah TUJUAN misi — penilaiannya "Serangan berhasil!", bukan "Belum tepat"');
  ok(readSource('src/components/workspaces/InjectionWorkspace.tsx').includes(`successTitle="${APP_SUCCESS.injection.title}"`), `Lab Injection: judul "${APP_SUCCESS.injection.title}" harus judul sukses di layar misinya`);
  const predictSource = readSource('src/components/workspaces/PredictWorkspace.tsx');
  ok(predictSource.includes(`title="${APP_SUCCESS.predict.title}"`) && predictSource.includes(`subtitle="${APP_SUCCESS.predict.detail}"`), 'Tebak Hasil: judul & keterangan sukses harus sama dengan layar misinya');
  ok(!RUN_EXAMPLES.predict.executes && RUN_EXAMPLES.predict.verdictText?.title === APP_SUCCESS.predict.title && /tidak dijalankan/.test(run.consoleNoRun), 'Tebak Hasil: query-nya tidak dijalankan (tanpa "Menjalankan query…") dan konsolnya mengatakan itu');
  ok(['query', 'fix', 'injection', 'playground'].every((id) => RUN_EXAMPLES[id as keyof typeof RUN_EXAMPLES].executes), 'jalankan query: selain Tebak Hasil, contohnya memang dijalankan');
  ok(!/pertama/i.test(run.link.resume), 'jalankan query: tombol untuk pengguna yang sudah mulai tidak boleh menyebut "misi pertama" (#/sql membuka misi yang sedang berjalan)');
  ok(!/\d/.test(course.rows.streak.zeroTitle), 'streak: judul untuk streak 0 tidak menampilkan angka');
}

/* ------------------------------------------------------------------ */
/* Jalur 'segera'                                                      */
/* ------------------------------------------------------------------ */

const DATE_PATTERN = /\b20\d{2}\b|bulan depan|minggu depan|kuartal|tahun ini|tahun depan|\bQ[1-4]\b|januari|februari|maret|april|\bmei\b|juni|juli|agustus|september|oktober|november|desember/i;
const LESSON_COUNT = /\b\d+\s*(misi|pelajaran|materi|modul|bab|tier|jam|minggu|hari|video|kuis|latihan|soal|proyek|level)\b/i;

function verifySoon(ok: Check): void {
  const soon = COURSES.filter((c) => c.status === 'segera');
  ok(soon.length === REGISTRY.filter((t) => t.status === 'segera').length, 'courses: setiap jalur segera punya data landing');
  for (const course of soon) {
    const id = course.id;
    for (const key of ['syllabus', 'stats', 'features', 'parts', 'rows', 'why', 'promise']) ok(!(key in course), `courses ${id} (segera): tidak boleh punya "${key}" (tanpa silabus/angka karangan)`);
    if (isAvailableCourse(course)) continue;
    const { plan, how, waiting } = course;
    ok(plan.topics.length >= 4 && plan.topics.length <= 6, `courses ${id}: rencana materi 4–6 topik (sekarang ${plan.topics.length})`);
    ok(plan.badge === 'Rencana' && /rencana/i.test(plan.note) && /berubah/i.test(plan.note), `courses ${id}: rencana harus bertanda "Rencana" dan menyatakan bisa berubah`);
    ok(/rencana|disiapkan/i.test(course.hero.lead) && /rencana/i.test(how.lead ?? ''),`courses ${id}: hero & "Cara mengerjakannya" harus menyatakan ini rencana`);
    for (const step of how.steps) ok(/direncanakan|rencana/i.test(step.text), `courses ${id}: langkah "${step.title}" harus menyatakan rencana (jalurnya belum ada)`);
    // Seluruh teks jalur (FAQ, terkait, ajakan, bukti hero, …), kecuali kalimat yang menyebut jalur SQL yang memang ada.
    for (const s of strings(course).filter((item) => !/\bSQL\b/.test(item.text))) {
      ok(!LESSON_COUNT.test(s.text), `courses ${id}: ${s.path} menyebut angka pelajaran ("${LESSON_COUNT.exec(s.text)?.[0] ?? ''}") — jalur segera tidak boleh punya angka karangan`);
    }
    // Landing jalur segera tidak punya editor; editornya (kelak) ada di layar jalur, bukan di halaman ini.
    for (const s of strings(course)) ok(!/di halaman ini/i.test(s.text), `courses ${id}: ${s.path} menyebut "di halaman ini" — halaman landing tidak punya editor`);
    for (const s of strings(course)) ok(!DATE_PATTERN.test(s.text), `courses ${id}: ${s.path} menyebut waktu/tanggal ("${DATE_PATTERN.exec(s.text)?.[0] ?? ''}") — belum ada tanggal rilis`);
    const expectedEnv = id === 'framework' ? 'vscode' : 'browser';
    ok(course.env === expectedEnv && how.env === expectedEnv, `courses ${id}: dikerjakan di ${expectedEnv} (keputusan pemilik)`);
    const howText = strings(how).map((s) => s.text).join(' ');
    if (expectedEnv === 'vscode') ok(/VS Code/.test(howText) && /runner lokal/i.test(howText) && /hasil test ke aplikasi/i.test(howText), `courses ${id}: cara mengerjakan harus VS Code + runner lokal yang melaporkan hasil test ke aplikasi`);
    else ok(/browser/i.test(howText), `courses ${id}: cara mengerjakan harus di editor browser`);
    ok(waiting.title === 'Sambil menunggu, mulai dari SQL' && waiting.cta.href === content.ROUTES.sql, `courses ${id}: ajakan "Sambil menunggu, mulai dari SQL" ke #/sql`);
    ok(course.hero.cta.href === content.ROUTES.sql && course.cta.href === content.ROUTES.sql, `courses ${id}: tombol hero & CTA penutup ke jalur SQL`);
    const faqIds = course.faq.items.map((item) => item.id);
    for (const required of ['kapan', 'coba', 'instal', 'progres-sql']) ok(faqIds.includes(required), `courses ${id}: FAQ jujur harus menjawab "${required}"`);
    ok(/belum ada tanggal/i.test(course.faq.items.find((i) => i.id === 'kapan')?.answer.join(' ') ?? ''), `courses ${id}: FAQ "kapan" harus menyatakan belum ada tanggal`);
  }
}

/* ------------------------------------------------------------------ */
/* Tautan                                                              */
/* ------------------------------------------------------------------ */

function verifyLinks(ok: Check): void {
  const entries = entrySegments();
  ok(same(entries, ['misi', 'materi', 'playground', 'progres', 'ujian']), `tautan: segmen masuk jalur SQL terbaca dari src/App.tsx (${entries.join(', ')})`);
  const sources: Record<string, unknown> = {
    ...Object.fromEntries(COURSES.map((c) => [`courses.${c.id}`, c])),
    CATALOG,
    NOT_FOUND,
    COURSE_UI,
    'content.NAV': content.NAV,
    'content.FOOTER': content.FOOTER,
    'content.EXPLORE': content.EXPLORE,
    'content.TRACKS': content.TRACKS,
  };
  let count = 0;
  for (const [name, value] of Object.entries(sources)) {
    for (const s of strings(value)) {
      const looksLikeHref = s.text.startsWith('#') || /href$/i.test(s.path);
      if (!looksLikeHref || /^https:\/\//.test(s.text)) continue;
      count += 1;
      const problem = hrefProblem(s.text, entries);
      ok(problem === null, `tautan ${name}${s.path.slice(1)} = "${s.text}": ${problem ?? ''}`);
    }
  }
  ok(count >= 40, `tautan: pemeriksa hanya menemukan ${count} href (penelusurnya rusak?)`);
  ok(hrefProblem('#/js', entries) !== null && hrefProblem('#faq', entries) !== null && hrefProblem('#/landing/sql', entries) === null && hrefProblem('#/sql/ujian', entries) === null, 'tautan: pemeriksa href harus menolak jalur segera & "#id" dan menerima landing/segmen masuk');
}

/* ------------------------------------------------------------------ */
/* Katalog, 404, meta & JSON-LD                                        */
/* ------------------------------------------------------------------ */

function verifyCatalogAndMeta(ok: Check): void {
  const logos = CATALOG.hero.logos;
  ok(logos.length === 6, 'katalog: hero berisi 6 kartu logo (5 jalur + database SIMRS)');
  ok(same(logos.filter((l) => l.trackId !== undefined).map((l) => l.trackId), REGISTRY.map((t) => t.id)), 'katalog: kartu logo jalur harus semua jalur registri, urut registri');
  ok(logos.some((l) => l.trackId === undefined && l.sub === `${content.TABLE_COUNT} tabel`), `katalog: kartu "Database SIMRS" harus menyebut ${content.TABLE_COUNT} tabel`);
  ok(CATALOG.hero.proof.includes(`${content.MISSION_COUNT} misi siap dikerjakan`) && CATALOG.hero.proof.some((p) => p.includes(content.LICENSE_NAME)), 'katalog: baris bukti nyata (jumlah misi, lisensi)');
  ok(same(CATALOG.browse.filters.map((f) => f.id), ['all', 'tersedia', 'segera', 'browser', 'vscode']), 'katalog: chip saringan Semua, Tersedia, Segera, Di browser, VS Code');
  ok(CATALOG.start.cta.href === content.ROUTES.sql && /SQL/.test(CATALOG.start.cta.label), 'katalog: "Belum tahu mulai dari mana?" → MULAI DARI SQL (#/sql)');
  ok(same(CATALOG.how.steps.map((s) => s.number), ['01', '02', '03']), 'katalog: cara kerja 3 langkah bernomor');
  ok(CATALOG.faq.items.length >= 5 && new Set(CATALOG.faq.items.map((i) => i.id)).size === CATALOG.faq.items.length && CATALOG.faq.items.every((i) => i.question.endsWith('?')), 'katalog: FAQ minimal 5 pertanyaan unik');
  ok(CATALOG_SECTION_IDS.faq === 'faq' && COURSE_SECTION_IDS.faq === 'faq' && content.SECTION_IDS.faq === 'faq', "id section FAQ harus 'faq' (tautan footer)");
  for (const ids of [Object.values(COURSE_SECTION_IDS), Object.values(CATALOG_SECTION_IDS)]) ok(new Set(ids).size === ids.length, 'id section halaman harus unik');
  ok(CATALOG_META.title.endsWith(PRODUCT_NAME) && CATALOG_META.description.length <= 170 && NOT_FOUND_META.robots === 'noindex', 'meta katalog & 404 (404 tidak diindeks)');
  for (const text of strings(CATALOG).map((s) => s.text)) ok(!DATE_PATTERN.test(text), `katalog: "${text.slice(0, 40)}…" menyebut waktu/tanggal`);

  // Teks katalog yang bergantung pada status registri tidak boleh basi saat sebuah jalur dibuka.
  const catalogText = strings({ CATALOG, CATALOG_META }).map((s) => s.text);
  const available = REGISTRY.filter((t) => t.status === 'tersedia');
  const soonTracks = REGISTRY.filter((t) => t.status === 'segera');
  // Jumlah jalur yang dieja ("Lima jalur") harus salah satu hitungan registri saat ini: semua, tersedia, atau segera.
  const countWords = new Set([REGISTRY.length, available.length, soonTracks.length].map((n) => countWord(n).toLowerCase()));
  for (const text of catalogText) {
    ok(!/di halaman ini/i.test(text), `katalog: "${text.slice(0, 50)}…" menyebut "di halaman ini" — editor jalur ada di layar jalur, bukan di halaman katalog`);
    for (const match of text.matchAll(/\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+jalur\b/gi)) {
      ok(countWords.has((match[1] ?? '').toLowerCase()), `katalog: "${text.slice(0, 50)}…" menyebut "${match[0]}" — tidak cocok dengan registri (${REGISTRY.length} jalur, ${available.length} tersedia, ${soonTracks.length} segera)`);
    }
  }
  ok(CATALOG.browse.lead(available.length, soonTracks.length) === `${countWord(available.length)} jalur sudah bisa dikerjakan, ${countWord(soonTracks.length, false)} lainnya sedang disiapkan.`, 'katalog: kalimat pembuka "Telusuri" dihitung dari registri (bilangan kecil dieja)');
  const [readyPart = '', preparingPart = ''] = CATALOG_META.ogDescription.split(/(?<=\.)\s+/);
  ok(available.every((t) => readyPart.includes(t.title)) && soonTracks.every((t) => preparingPart.includes(t.title) && !readyPart.includes(t.title)) && /disiapkan/.test(preparingPart), 'katalog: og:description harus menyebut jalur tersedia sebagai bisa dikerjakan dan SEMUA jalur segera sebagai sedang disiapkan (sesuai registri)');
  const freeAnswer = CATALOG.faq.items.find((item) => item.id === 'gratis')?.answer.join(' ') ?? '';
  ok(soonTracks.length === 0 || (/belum dibuka/.test(freeAnswer) && !/^Ya\b/.test(freeAnswer)), 'katalog: FAQ "gratis" tidak boleh menjanjikan harga jalur yang belum dibuka');

  // JSON-LD: node Course (gratis, penyedia) hanya untuk jalur yang memang tersedia.
  const base = 'https://contoh.test/';
  for (const course of COURSES) {
    const ld = courseJsonLd(course, base);
    const graph = ld['@graph'];
    const types = Array.isArray(graph) ? graph.map((node: { '@type'?: string }) => node['@type']) : [];
    const expected = course.status === 'tersedia' ? ['Course', 'BreadcrumbList', 'FAQPage'] : ['BreadcrumbList', 'FAQPage'];
    ok(ld['@context'] === 'https://schema.org' && same(types, expected), `JSON-LD ${course.id}: @graph harus ${expected.join(' + ')}`);
    const text = JSON.stringify(ld);
    ok(text.includes(`${base}#/landing/${course.id}`) && course.faq.items.every((item) => text.includes(JSON.stringify(item.question))), `JSON-LD ${course.id}: url halaman dan semua pertanyaan FAQ harus ada`);
    ok(!/aggregateRating|ratingValue|reviewCount|enrollment|timeRequired|duration/i.test(text), `JSON-LD ${course.id}: tanpa rating, jumlah peserta, atau durasi`);
    if (course.status === 'segera') ok(!/"Offer"|isAccessibleForFree|"Course"/.test(text), `JSON-LD ${course.id}: jalur segera tidak boleh diklaim sebagai kursus yang ditawarkan`);
  }
  const catalogLd = JSON.stringify(catalogJsonLd(COURSE_SUMMARIES, base));
  ok(COURSE_SUMMARIES.every((c) => catalogLd.includes(`${base}${c.href}`)) && catalogLd.includes('"ItemList"') && catalogLd.includes('"FAQPage"'), 'JSON-LD katalog: ItemList semua jalur + FAQPage');
}

/* ------------------------------------------------------------------ */
/* Progres (hanya membaca)                                             */
/* ------------------------------------------------------------------ */

const DONE = { completed: true, earnedXp: 50, hintUsed: false, hintsRevealed: 0, solutionShown: false, attempts: 1, completedAt: '2026-11-20T03:00:00.000Z' };

function progressWith(ids: readonly string[]): UserProgress {
  return { ...createEmptyProgress(), xp: ids.length * 50, streak: { current: 2, best: 6, lastActiveDate: '2026-11-23' }, missions: Object.fromEntries(ids.map((id) => [id, DONE])), lastMissionId: ids.at(-1) ?? null };
}

function verifyProgressReader(ok: Check): void {
  const now = new Date(2026, 10, 23, 12, 0, 0);
  const bosses = MISSIONS.filter(isBoss);
  const empty = new MemoryStorage();
  const fresh = readCourseProgress('sql', empty, now);
  ok(!fresh.started && fresh.completed === 0 && fresh.total === MISSIONS.length && empty.writes === 0, 'progres: storage kosong → belum mulai, tanpa menulis');
  ok(bosses.every((b) => fresh.bossStates[b.id] === 'locked'), 'progres: pengguna baru → semua Boss terkunci');

  const tierOne = MISSIONS.filter((m) => m.tier === 1);
  const bossOne = tierOne.find(isBoss);
  const withoutBoss = new MemoryStorage({ [PROGRESS_KEY]: JSON.stringify(progressWith(tierOne.filter((m) => !isBoss(m)).map((m) => m.id))) });
  const open = readCourseProgress('sql', withoutBoss, now);
  ok(bossOne !== undefined && open.bossStates[bossOne.id] === 'open' && open.completed === tierOne.length - 1 && open.started, 'progres: tier 1 tanpa Boss selesai → Boss tier 1 terbuka');
  ok(open.streak.best === 6 && open.streak.activeToday && open.streak.active === 2 && withoutBoss.writes === 0, 'progres: streak dibaca apa adanya (tanpa menulis)');
  const withBoss = readCourseProgress('sql', new MemoryStorage({ [PROGRESS_KEY]: JSON.stringify(progressWith([...tierOne.map((m) => m.id), 'misi-lama-yang-sudah-dihapus'])) }), now);
  ok(bossOne !== undefined && withBoss.bossStates[bossOne.id] === 'done' && withBoss.completed === tierOne.length, 'progres: Boss selesai → "done"; id misi yang tidak ada tidak dihitung');

  let threw = false;
  try {
    const broken = new MemoryStorage({ [PROGRESS_KEY]: '{"version":1,"xp":5' });
    const blocked = new MemoryStorage();
    blocked.failReads = true;
    ok(firstDifference({ ...readCourseProgress('sql', broken, now), completedIds: [] }, { ...fresh, completedIds: [] }) === null && broken.writes === 0, 'progres: data rusak → seperti pengguna baru, tanpa karantina/menulis');
    ok(!readCourseProgress('sql', blocked, now).started && !readCourseProgress('sql', null, now).started, 'progres: storage diblokir / tidak ada → kosong');
  } catch {
    threw = true;
  }
  ok(!threw, 'progres: pembaca tidak boleh melempar');
  const soon = readCourseProgress('react', new MemoryStorage({ [PROGRESS_KEY]: JSON.stringify(progressWith(['t1-select'])) }), now);
  ok(!soon.started && soon.total === 0, 'progres: jalur segera tidak punya progres');
}

/* ------------------------------------------------------------------ */
/* Ringan: halaman dimuat malas                                        */
/* ------------------------------------------------------------------ */

const PAGE_DIRS = ['src/platform/landing/pages/', 'src/platform/landing/courses/'];

function verifyLazyPages(ok: Check): void {
  const initial = staticClosure('src/main.tsx');
  const leaked = initial.filter((item) => PAGE_DIRS.some((dir) => item.startsWith(dir)) || item === 'src/platform/landing/lib/pagesContent.ts');
  ok(leaked.length === 0, `bundel awal (Beranda + shell) tidak boleh menjangkau halaman/data jalur secara statis: ${leaked.join(', ')}`);
  ok(initial.includes('src/platform/landing/layout/PageFallback.tsx') && initial.includes('src/platform/PlatformShell.tsx'), 'penelusur: shell harus menjangkau PageFallback (penelusurnya rusak?)');
  ok(!initial.includes('src/platform/landing/layout/pageStatus.tsx') && !initial.includes('src/platform/landing/layout/PageLayout.tsx'), 'bundel awal: status & layout halaman landing ikut chunk halaman, bukan bundel Beranda');

  const shell = readSource('src/platform/PlatformShell.tsx');
  const shellStatic = staticImports(shell);
  ok(!shellStatic.some((spec) => spec.includes('/pages/') || spec.includes('/courses/')), `PlatformShell.tsx: halaman landing hanya boleh diimpor dinamis (statis: ${shellStatic.filter((s) => s.includes('/pages/')).join(', ')})`);
  ok(shell.includes(`import('./landing/pages/LandingPages')`), 'PlatformShell.tsx: tuan rumah halaman landing harus dimuat dengan import()');
  const host = readSource('src/platform/landing/pages/LandingPages.tsx');
  const hostStatic = staticImports(host);
  for (const page of ['CatalogPage', 'CoursePage', 'NotFoundPage']) {
    ok(host.includes(`import('./${page}')`) && !hostStatic.some((spec) => spec.endsWith(`/${page}`)), `LandingPages.tsx: ${page} harus chunk sendiri (import() dinamis, bukan impor statis)`);
  }
  for (const file of ['src/platform/Home.tsx', 'src/platform/tracks.ts']) {
    const closure = staticClosure(file);
    ok(!closure.some((item) => PAGE_DIRS.some((dir) => item.startsWith(dir))), `${file} tidak boleh menjangkau halaman/data jalur`);
  }

  const pages = landingFiles().filter((file) => file.startsWith('src/platform/landing/pages/'));
  ok(pages.includes('src/platform/landing/pages/CatalogPage.tsx') && pages.includes('src/platform/landing/pages/CoursePage.tsx') && pages.includes('src/platform/landing/pages/NotFoundPage.tsx'), 'halaman katalog, landing jalur, dan 404 harus ada');
  for (const file of pages) {
    const engine = staticClosure(file).filter(isEngineItem);
    ok(engine.length === 0, `${file}: tidak boleh menjangkau mesin SQL / layar jalur (${engine.join(', ')})`);
  }
  // Pembanding: penelusur yang sama harus menemukan data misi di balik halaman landing jalur.
  ok(staticClosure('src/platform/landing/pages/CoursePage.tsx').some((item) => item.startsWith('src/data/missions')), 'penelusur: CoursePage harus menjangkau data misi (silabus dibangun dari kurikulum)');
  // Katalog tidak perlu data misi.
  ok(!staticClosure('src/platform/landing/pages/CatalogPage.tsx').some((item) => item.startsWith('src/data/')), 'halaman katalog tidak boleh memuat data misi/materi (pakai courses/catalog.ts)');
  for (const light of ['src/platform/landing/courses/catalog.ts', 'src/platform/landing/courses/soon.ts', 'src/platform/landing/courses/seo.ts', 'src/platform/landing/lib/pagesContent.ts']) {
    ok(!staticClosure(light).some((item) => item.startsWith('src/data/')), `${light} harus ringan (tanpa data misi)`);
  }
}

/**
 * Kata terlarang atas teks yang DIRENDER: landing.ts memindai sumber src/platform/landing/**, tetapi silabus SQL
 * merender judul misi, konsep, deskripsi tier, dan judul materi dari src/data saat runtime.
 */
function verifyRenderedWording(ok: Check): void {
  const rendered = [...strings(COURSES), ...strings({ CATALOG, CATALOG_META, NOT_FOUND, NOT_FOUND_META, COURSE_UI, PAGE_UI })];
  ok(rendered.length > 500, `kata terlarang: hanya ${rendered.length} teks terbaca (penelusurnya rusak?)`);
  for (const [label, pattern] of FORBIDDEN) {
    const hit = rendered.find((s) => pattern.test(s.text));
    ok(hit === undefined, `kata terlarang "${label}" di teks yang dirender: ${hit?.path ?? ''} "${hit?.text.slice(0, 60) ?? ''}"`);
  }
}

export function verifyCourses(): void {
  let checks = 0;
  const ok: Check = (cond, msg) => {
    checks += 1;
    assert(cond, `jalur: ${msg}`);
  };
  verifyRegistryMatch(ok);
  for (const course of COURSES) verifyCommon(ok, course);
  verifyRenderedWording(ok);
  verifySql(ok);
  verifySoon(ok);
  verifyLinks(ok);
  verifyCatalogAndMeta(ok);
  verifyProgressReader(ok);
  verifyLazyPages(ok);
  console.log(`  ${checks} pemeriksaan halaman jalur (registri, silabus, segera, tautan, meta, progres, malas) ✓`);
}
