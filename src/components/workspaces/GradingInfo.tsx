import type { ReactNode } from 'react';
import { ArrowDownUp, DraftingCompass, FlaskConical, Gauge, ListChecks, Puzzle, Table2, Undo2 } from 'lucide-react';
import type { SqlGrading, SqlMission } from '../../types';

/**
 * Ringkasan cara penilaian misi SQL: jenis penilaian, apakah urutan baris dinilai,
 * konstruksi wajib, dan catatan khusus untuk misi DML/transaksi.
 * Regex requiredPatterns sengaja TIDAK ditampilkan agar tidak membocorkan jawaban.
 */

const DEFAULT_GRADING: SqlGrading = { type: 'result' };

function Chip({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  );
}

const NEUTRAL = 'border-slate-700 bg-slate-800/60 text-slate-300';
const SKY = 'border-sky-500/30 bg-sky-500/10 text-sky-300';
const AMBER = 'border-amber-500/30 bg-amber-500/10 text-amber-300 light:border-amber-700/40 light:bg-amber-950/40';
const CYAN = 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';

function GradingChips({ grading, orderMatters }: { grading: SqlGrading; orderMatters: boolean }) {
  switch (grading.type) {
    case 'result':
      return (
        <>
          <Chip className={NEUTRAL}>
            <ListChecks className="h-3 w-3" aria-hidden />
            Penilaian: hasil query
          </Chip>
          {grading.requireIndexOn ? (
            <Chip className={SKY}>
              <Gauge className="h-3 w-3" aria-hidden />+ wajib memakai index ({grading.requireIndexOn.table}.{grading.requireIndexOn.column})
            </Chip>
          ) : null}
          <Chip className={NEUTRAL}>
            <ArrowDownUp className="h-3 w-3" aria-hidden />
            {orderMatters ? 'Urutan baris ikut dinilai' : 'Urutan baris bebas'}
          </Chip>
        </>
      );
    case 'state':
      return (
        <Chip className={NEUTRAL}>
          <Table2 className="h-3 w-3" aria-hidden />
          Penilaian: isi tabel setelah query dijalankan (DB segar)
        </Chip>
      );
    case 'index':
      return (
        <Chip className={SKY}>
          <Gauge className="h-3 w-3" aria-hidden />
          Penilaian: index &amp; query plan (tabel {grading.table})
        </Chip>
      );
    case 'schema':
      return (
        <>
          <Chip className={CYAN}>
            <DraftingCompass className="h-3 w-3" aria-hidden />
            Penilaian: struktur {grading.objects.map((o) => o.name).join(', ')}
          </Chip>
          <Chip className={NEUTRAL}>
            <FlaskConical className="h-3 w-3" aria-hidden />
            {grading.probes.length} uji perilaku
          </Chip>
        </>
      );
    default: {
      const unreachable: never = grading;
      return unreachable;
    }
  }
}

export function GradingInfo({ mission }: { mission: SqlMission }) {
  const grading = mission.grading ?? DEFAULT_GRADING;
  const hasRequired = (mission.requiredPatterns?.length ?? 0) > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <GradingChips grading={grading} orderMatters={mission.orderMatters} />
        {hasRequired ? (
          <Chip className={AMBER}>
            <Puzzle className="h-3 w-3" aria-hidden />
            Wajib: {mission.concept}
          </Chip>
        ) : null}
      </div>
      {hasRequired ? (
        <p className="text-[11px] leading-relaxed text-slate-500">
          Misi ini mewajibkan konstruksi tertentu — lihat instruksi. Hasil yang benar tanpa konstruksi tersebut belum dihitung lulus.
        </p>
      ) : null}
      {grading.type === 'state' ? <StateNote label={grading.label} /> : null}
      {grading.type === 'schema' ? (
        <p className="text-[11px] leading-relaxed text-slate-500">
          Setelah skripmu dijalankan, penilai memeriksa struktur objeknya (kolom, tipe, NOT NULL, PRIMARY KEY, FOREIGN KEY, UNIQUE),
          lalu menjalankan sendiri serangkaian INSERT/UPDATE uji yang harus diterima atau ditolak — jadi CHECK, DEFAULT, dan trigger
          dinilai dari perilakunya. Skripmu cukup berisi yang diminta soal; coba-coba uji di Free Playground.
        </p>
      ) : null}
      {grading.type === 'index' ? (
        <p className="text-[11px] leading-relaxed text-slate-500">
          Setelah skripmu dijalankan, sistem memeriksa apakah index yang diminta ada, lalu menjalankan query uji dengan{' '}
          <code className="text-sky-300">EXPLAIN QUERY PLAN</code> untuk memastikan index itu benar-benar dipakai.
        </p>
      ) : null}
    </div>
  );
}

function StateNote({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
      <Undo2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
      <span>
        Yang diperiksa: <span className="text-slate-200">{label}</span>. Kamu boleh memakai{' '}
        <code className="text-emerald-300">BEGIN</code>, <code className="text-emerald-300">COMMIT</code>, dan{' '}
        <code className="text-emerald-300">ROLLBACK</code>. Setiap pemeriksaan dimulai dari database bersih, jadi tulis seluruh
        skrip sekaligus — perubahan dari percobaan sebelumnya tidak terbawa. Transaksi yang dibiarkan terbuka (BEGIN tanpa
        COMMIT/ROLLBACK) dianggap belum selesai.
      </span>
    </div>
  );
}
