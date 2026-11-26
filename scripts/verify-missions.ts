/**
 * Verifikasi jalur SQL (72 misi termasuk 10 Boss Challenge, 10 tier, 39 materi) dan fondasi platform.
 * Jalankan dengan `npm run verify`. Bagian-bagiannya, menurut urutan jalan:
 *
 *  1. Aturan kurikulum     — scripts/verify/curriculum.ts (bentuk kurikulum, tier, XP & rank)
 *  2. Misi per jenis       — sql (result/state/index/skema, termasuk Perbaiki Query & DDL), injection, concept,
 *                            predict (Tebak Hasil: scripts/verify/predictMissions.ts)
 *  3. Isolasi mutasi       — query destruktif tidak bocor ke penilaian berikutnya
 *  4. Kasus uji            — scripts/test-cases/*.ts (jawaban salah & formulasi setara; query bermasalah
 *                            misi Perbaiki Query harus dinilai salah)
 *  5. Explain (query plan) — scripts/verify/planTree.ts (visualisasi plan di Playground)
 *  6. Diff hasil           — scripts/verify/resultDiff.ts (tab Perbedaan saat jawaban salah)
 *  7. Urutan eksekusi      — scripts/verify/execSteps.ts (FROM → WHERE → … → LIMIT, tabel antara per langkah)
 *  8. Materi               — scripts/verify/materi.ts (contoh bisa dijalankan, tautan misi, anti-bocoran jawaban)
 *  9. Peta kelemahan       — scripts/verify/weakness.ts (klasifikasi kesalahan & laporan)
 * 10. Eksekusi terlindungi — scripts/verify/worker.ts (worker SQL, snapshot sesi, batas baris)
 * 11. Cadangan progres     — scripts/verify/backup.ts (ekspor/impor file JSON)
 * 12. Mode ujian           — scripts/verify/exam.ts (pemilihan soal, sesi, rapor, data tersimpan)
 * 13. Latihan ulang        — scripts/verify/review.ts (jadwal Leitner, prioritas, tanggal lokal)
 * 14. Lencana              — scripts/verify/achievements.ts (definisi & aturan lencana)
 * 15. Lab Performa         — scripts/verify/perfLab.ts (dataset besar, pengukuran, SCAN → SEARCH)
 * 16. Fixture emas         — scripts/verify/fixtures.ts (data pengguna versi 1 di scripts/fixtures/*.json masih terbaca
 *                            utuh: parser storage, file cadangan format 1, ringkasan Beranda)
 * 17. Platform             — scripts/verify/platform.ts (router hash, registri jalur, bundel awal Beranda tetap ringan,
 *                            karantina storage, aturan "lanjut dari mana", glance untuk storage kosong/rusak)
 * 18. Autocomplete editor  — scripts/verify/sqlComplete.ts
 * 19. Landing (Beranda)    — scripts/verify/landing.ts (angka & contoh di src/platform/landing/lib/content.ts sama dengan
 *                            data sebenarnya, kata terlarang, kontras warna WCAG AA, berkas landing tetap ringan)
 * 20. Halaman jalur        — scripts/verify/courses.ts (katalog '#/landing' & landing per jalur: data = registri,
 *                            silabus SQL = kurikulum, jalur 'segera' jujur, tautan dikenal router, meta & JSON-LD,
 *                            pembaca progres hanya membaca, halaman dimuat malas & tidak menyentuh mesin SQL)
 *
 * Kegagalan → exit code 1. Peringatan (⚠) hanya informasi.
 */
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { MISSIONS } from '../src/data/missions';
import type { Mission } from '../src/types';
import { createSeededDatabase } from '../src/lib/sqlEngine';
import { verifyCurriculum } from './verify/curriculum';
import { verifyExecSteps } from './verify/execSteps';
import { verifyMateri } from './verify/materi';
import { verifyWeakness } from './verify/weakness';
import { verifyWorker } from './verify/worker';
import { verifyBackup } from './verify/backup';
import { verifyExam } from './verify/exam';
import { verifyReview } from './verify/review';
import { verifyAchievements } from './verify/achievements';
import { verifyPerfLab } from './verify/perfLab';
import { verifyFixtures } from './verify/fixtures';
import { verifyPlatform } from './verify/platform';
import { verifyLanding } from './verify/landing';
import { verifyCourses } from './verify/courses';
import { verifyConceptMission, verifyInjectionMission } from './verify/labMissions';
import { failures, guard, guardAsync, section, warnings } from './verify/report';
import { verifyPlanTree } from './verify/planTree';
import { verifyPredictMission } from './verify/predictMissions';
import { verifyResultDiff } from './verify/resultDiff';
import { verifySqlComplete } from './verify/sqlComplete';
import { verifyMutationIsolation, verifySqlMission } from './verify/sqlMissions';
import { verifyTestCases } from './verify/testCases';

function verifyMission(SQL: SqlJsStatic, mission: Mission): void {
  switch (mission.kind) {
    case 'sql':
      verifySqlMission(SQL, mission);
      return;
    case 'injection':
      verifyInjectionMission(SQL, mission);
      return;
    case 'concept':
      verifyConceptMission(mission);
      return;
    case 'predict':
      verifyPredictMission(SQL, mission);
      return;
    default: {
      const unreachable: never = mission;
      throw new Error(`kind misi tidak dikenal: ${JSON.stringify(unreachable)}`);
    }
  }
}

async function main(): Promise<void> {
  const SQL = await initSqlJs();

  section('Aturan kurikulum');
  guard('kurikulum', verifyCurriculum);

  section('Misi');
  MISSIONS.forEach((mission) => guard(mission.id, () => verifyMission(SQL, mission)));

  section('Isolasi mutasi (DB segar per penilaian)');
  guard('isolasi', () => verifyMutationIsolation(SQL));

  section('Kasus uji (scripts/test-cases)');
  guard('kasus uji', () => verifyTestCases(SQL));

  section('Explain / query plan (Playground)');
  guard('query plan', () => verifyPlanTree(SQL));

  section('Diff hasil vs Expected (tab Perbedaan)');
  guard('diff hasil', () => verifyResultDiff(SQL));

  section('Urutan eksekusi (Playground & misi)');
  guard('urutan eksekusi', () => verifyExecSteps(SQL));

  section('Materi');
  guard('materi', () => verifyMateri(SQL));

  section('Peta kelemahan');
  guard('peta kelemahan', () => verifyWeakness(SQL));

  section('Eksekusi terlindungi (worker & batas baris)');
  guard('worker', () => verifyWorker(SQL));

  section('Cadangan progres (ekspor/impor)');
  guard('cadangan', verifyBackup);

  section('Mode ujian');
  guard('ujian', verifyExam);

  section('Latihan ulang terjadwal');
  guard('latihan ulang', verifyReview);

  section('Lencana pencapaian');
  guard('lencana', verifyAchievements);

  section('Lab Performa (dataset besar)');
  guard('lab performa', () => verifyPerfLab(SQL));

  section('Fixture emas (data pengguna versi 1)');
  guard('fixture emas', verifyFixtures);

  section('Platform (router, registri jalur, karantina, resume, glance)');
  await guardAsync('platform', verifyPlatform);

  section('Autocomplete editor');
  guard('autocomplete', () => {
    const db = createSeededDatabase(SQL);
    try {
      verifySqlComplete(db);
    } finally {
      db.close();
    }
  });

  section('Landing (isi Beranda benar, kontras warna, tetap ringan)');
  guard('landing', () => verifyLanding(SQL));

  section('Halaman jalur (katalog & landing per jalur)');
  guard('halaman jalur', verifyCourses);

  if (warnings.length > 0) console.warn(`\n⚠ ${warnings.length} peringatan.`);
  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} pemeriksaan gagal.`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n✓ Semua ${MISSIONS.length} misi lolos verifikasi.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
