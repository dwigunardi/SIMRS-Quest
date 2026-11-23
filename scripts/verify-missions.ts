/**
 * Verifikasi kurikulum SIMRS SQL Quest (55 misi termasuk 8 Boss Challenge, 8 tier). Jalankan dengan `npm run verify`.
 *
 * 1. Bentuk kurikulum      — scripts/verify/curriculum.ts
 * 2. Misi per jenis        — sql (result/state/index, termasuk Perbaiki Query), injection, concept,
 *                            predict (Tebak Hasil: scripts/verify/predictMissions.ts)
 * 3. Isolasi mutasi        — query destruktif tidak bocor ke penilaian berikutnya
 * 4. Kasus uji             — scripts/test-cases/*.ts (jawaban salah & formulasi setara; query bermasalah
 *                            misi Perbaiki Query harus dinilai salah)
 * 5. Explain (query plan)  — scripts/verify/planTree.ts (visualisasi plan di Playground)
 * 6. Diff hasil           — scripts/verify/resultDiff.ts (tab Perbedaan saat jawaban salah)
 * 7. Urutan eksekusi      — scripts/verify/execSteps.ts (FROM → WHERE → … → LIMIT, tabel antara per langkah)
 * 8. Autocomplete editor  — scripts/verify/sqlComplete.ts
 * 9. Materi               — scripts/verify/materi.ts (contoh bisa dijalankan, tautan misi, anti-bocoran jawaban)
 * 10. Peta kelemahan      — scripts/verify/weakness.ts (klasifikasi kesalahan & laporan)
 * 11. Eksekusi terlindungi — scripts/verify/worker.ts (worker SQL, snapshot sesi, batas baris)
 * 12. Cadangan progres    — scripts/verify/backup.ts (ekspor/impor file JSON)
 * 13. Mode ujian          — scripts/verify/exam.ts (pemilihan soal, sesi, rapor, data tersimpan)
 * 14. Latihan ulang       — scripts/verify/review.ts (jadwal Leitner, prioritas, tanggal lokal)
 * 15. Lencana             — scripts/verify/achievements.ts (definisi & aturan lencana)
 * 16. Lab Performa        — scripts/verify/perfLab.ts (dataset besar, pengukuran, SCAN → SEARCH)
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
import { verifyConceptMission, verifyInjectionMission } from './verify/labMissions';
import { failures, guard, section, warnings } from './verify/report';
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

  section('Autocomplete editor');
  guard('autocomplete', () => {
    const db = createSeededDatabase(SQL);
    try {
      verifySqlComplete(db);
    } finally {
      db.close();
    }
  });

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
