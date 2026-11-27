import type { Database } from 'sql.js';
import { useContext } from 'react';
import { Bug, Crown, FlaskConical, Footprints, Play, RotateCcw, ShieldCheck } from 'lucide-react';
import { SqlEditor } from './SqlEditor';
import { MissionOutput } from './MissionOutput';
import { ExecStepsCard, useExecSteps } from './exec/ExecStepsCard';
import { useDelayedFlag } from '../hooks/useDelayedFlag';
import { MistakeNudge } from './progress/MistakeNudge';
import { classifyCheck } from '../lib/mistakes';
import { GradingInfo } from './workspaces/GradingInfo';
import { AssistButtons, SECONDARY_BUTTON, WorkspaceHeader } from './workspaces/WorkspaceChrome';
import { RUN_SHORTCUT_LABEL } from '../lib/platform';
import { bossLabel } from '../lib/boss';
import { PerfLabContext } from './perf/PerfLabContext';
import type { CompletionSchema } from '../lib/sqlComplete';
import type { CheckResult, CompletionSummary, MissionProgress, SqlMission } from '../types';

export interface MissionWorkspaceProps {
  mission: SqlMission;
  missionProgress: MissionProgress;
  totalCount: number;
  sql: string;
  onSqlChange: (sql: string) => void;
  onRun: () => void;
  onHint: () => void;
  onShowSolution: () => void;
  onResetEditor: () => void;
  check: CheckResult | null;
  completion: CompletionSummary | null;
  /** Bertambah setiap kali Run & Check, agar animasi hasil (shake/pop-in) diputar ulang. */
  runId: number;
  ready: boolean;
  hasNextMission: boolean;
  onNextMission: () => void;
  /** DB seed murni untuk visualisasi urutan eksekusi (data yang sama dengan penilaian). */
  referenceDb: Database | null;
  schema: CompletionSchema;
  /** Penilaian sedang berjalan di worker. */
  running: boolean;
  onCancel: () => void;
}

export function MissionWorkspace({
  mission,
  missionProgress,
  totalCount,
  sql,
  onSqlChange,
  onRun,
  onHint,
  onShowSolution,
  onResetEditor,
  check,
  completion,
  runId,
  ready,
  hasNextMission,
  onNextMission,
  referenceDb,
  schema,
  running,
  onCancel,
}: MissionWorkspaceProps) {
  const steps = useExecSteps(referenceDb);
  const showRunning = useDelayedFlag(running);
  // Urutan eksekusi hanya bermakna untuk misi yang dinilai dari hasil SELECT (bukan DML/CREATE INDEX).
  const canVisualize = (mission.grading?.type ?? 'result') === 'result';
  // Misi optimasi (CREATE INDEX / query sargable): tawarkan mengukur query yang sama di data besar.
  const perfLab = useContext(PerfLabContext);
  const isPerfMission = mission.grading?.type === 'index' || (mission.grading?.type === 'result' && mission.grading.requireIndexOn !== undefined);
  return (
    <div className="flex flex-col gap-4">
      <WorkspaceHeader mission={mission} totalCount={totalCount} />
      {mission.fix ? <FixBanner bugCount={mission.fix.bugCount} /> : null}
      {mission.boss ? <BossBanner tier={mission.tier} xp={mission.xpReward} stepsAvailable={canVisualize} /> : null}
      <GradingInfo mission={mission} />

      <SqlEditor
        value={sql}
        onChange={onSqlChange}
        onRun={onRun}
        disabled={!ready}
        placeholder="Tulis query SQL kamu di sini…"
        minHeightClass="min-h-[220px]"
        schema={schema}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={!ready || showRunning}
          className="group inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 light:disabled:bg-slate-800 light:disabled:text-slate-500 light:disabled:opacity-100 light:disabled:shadow-none"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden />
          Run &amp; Check
          {/* Tema terang: selagi tombol nonaktif (mesin SQL belum siap / penilaian berjalan) tombolnya abu-abu, jadi keycap
              putih-di-hijau ikut menjadi keycap abu-abu terbaca (bukan teks putih di atas abu-abu). */}
          <kbd className="hidden rounded bg-emerald-700/40 px-1.5 py-px font-mono text-[10px] font-medium text-emerald-50 light:bg-emerald-50/40 light:text-slate-950 light:group-disabled:bg-slate-900 light:group-disabled:text-slate-500 sm:inline">
            {RUN_SHORTCUT_LABEL}
          </kbd>
        </button>
        {canVisualize ? (
          <button
            type="button"
            onClick={() => steps.show(sql)}
            disabled={!ready || referenceDb === null || steps.pending}
            className={`${SECONDARY_BUTTON} border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10`}
            title="Lihat isi tabel di setiap tahap: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT"
          >
            <Footprints className="h-4 w-4" aria-hidden />
            Urutan Eksekusi
          </button>
        ) : null}
        {perfLab && isPerfMission ? (
          <button
            type="button"
            onClick={() => perfLab.open(sql)}
            className={`${SECONDARY_BUTTON} border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10`}
            title="Buka Lab Performa: jalankan query ini di 200.000 kunjungan dan lihat selisih waktu SCAN vs SEARCH"
          >
            <FlaskConical className="h-4 w-4" aria-hidden />
            Uji di data besar
          </button>
        ) : null}
        <AssistButtons mission={mission} missionProgress={missionProgress} onHint={onHint} onShowSolution={onShowSolution} />
        <button
          type="button"
          onClick={onResetEditor}
          className={SECONDARY_BUTTON}
          title={mission.fix ? 'Kembalikan query bermasalah seperti semula' : 'Kembalikan editor ke query awal'}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          {mission.fix ? 'Query Awal' : 'Reset Editor'}
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70 light:text-emerald-500" aria-hidden />
          Penilaian selalu memakai database bersih
        </span>
      </div>

      <ExecStepsCard steps={steps} currentSql={sql} />

      <MissionOutput
        key={runId}
        successTitle={mission.boss ? `${bossLabel(mission.tier)} dikalahkan!` : undefined}
        check={check}
        completion={completion}
        running={showRunning}
        onCancel={onCancel}
        hasNextMission={hasNextMission}
        onNextMission={onNextMission}
        orderMatters={mission.orderMatters}
        afterFeedback={check ? <MistakeNudge missionId={mission.id} kind={classifyCheck(mission, check)} /> : null}
      />
    </div>
  );
}

function FixBanner({ bugCount }: { bugCount: number }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs leading-relaxed text-slate-300">
      <Bug className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden />
      <span>
        <span className="font-semibold text-rose-200">Perbaiki Bug.</span> Query di editor ditulis rekan kerja dan mengandung{' '}
        <span className="font-semibold text-rose-200">{bugCount} bug</span>. Jalankan dulu untuk melihat gejalanya, bandingkan dengan
        Expected Output di tab Perbedaan, lalu perbaiki seminimal mungkin. Tombol{' '}
        <span className="font-semibold text-emerald-300">Urutan Eksekusi</span> membantu menemukan di tahap mana hasilnya mulai
        menyimpang.
      </span>
    </div>
  );
}

function BossBanner({ tier, xp, stepsAvailable }: { tier: number; xp: number; stepsAvailable: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-yellow-400/40 bg-yellow-950/20 px-3 py-2 text-xs leading-relaxed text-slate-300">
      <Crown className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" aria-hidden />
      <span>
        <span className="font-semibold text-yellow-200">{bossLabel(tier)}.</span> Soal gabungan tanpa hint,
        bernilai <span className="font-semibold text-yellow-200">{xp} XP</span>. Kerjakan bertahap: tulis bagian kecil, jalankan, cek hasil
        antaranya {stepsAvailable ? (
          <>
            dengan <span className="font-semibold text-emerald-300">Urutan Eksekusi</span>
          </>
        ) : (
          'di Free Playground (tambahkan SELECT untuk melihat isi tabel)'
        )}
        , baru tambahkan bagian berikutnya.
      </span>
    </div>
  );
}
