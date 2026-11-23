import { useId, type FormEvent, type KeyboardEvent } from 'react';
import { Crosshair, Globe, Lock, LockOpen, Send, ShieldAlert, Sparkles, TriangleAlert } from 'lucide-react';
import { MissionOutput } from '../MissionOutput';
import { MistakeNudge } from '../progress/MistakeNudge';
import { useDelayedFlag } from '../../hooks/useDelayedFlag';
import { classifyCheck } from '../../lib/mistakes';
import { HighlightedCode } from '../HighlightedCode';
import { InjectionExplainer } from './InjectionExplainer';
import { InjectionPreview } from './InjectionPreview';
import { AssistButtons, SECONDARY_BUTTON, WorkspaceHeader } from './WorkspaceChrome';
import { RUN_SHORTCUT_LABEL, isRunShortcut } from '../../lib/platform';
import type { CompletionSummary, InjectionMission, InjectionRun, MissionProgress } from '../../types';

export interface InjectionWorkspaceProps {
  mission: InjectionMission;
  missionProgress: MissionProgress;
  totalCount: number;
  input: string;
  onInputChange: (input: string) => void;
  safeMode: boolean;
  onSafeModeChange: (safeMode: boolean) => void;
  onSubmit: () => void;
  /** Percobaan sedang berjalan di worker. */
  running: boolean;
  onCancel: () => void;
  onHint: () => void;
  onShowSolution: () => void;
  run: InjectionRun | null;
  completion: CompletionSummary | null;
  runId: number;
  ready: boolean;
  hasNextMission: boolean;
  onNextMission: () => void;
}

export function InjectionWorkspace({
  mission,
  missionProgress,
  totalCount,
  input,
  onInputChange,
  safeMode,
  onSafeModeChange,
  onSubmit,
  running,
  onCancel,
  onHint,
  onShowSolution,
  run,
  completion,
  runId,
  ready,
  hasNextMission,
  onNextMission,
}: InjectionWorkspaceProps) {
  const { lab } = mission;
  const showRunning = useDelayedFlag(running);

  return (
    <div className="flex flex-col gap-4">
      <WorkspaceHeader mission={mission} totalCount={totalCount} />

      <div className="flex items-start gap-2 rounded-lg border border-violet-500/30 bg-violet-950/20 px-3 py-2 text-xs leading-relaxed text-slate-300">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden />
        <span>
          <span className="font-semibold text-violet-200">Lab Keamanan.</span> Kamu berperan sebagai penguji keamanan: ketik{' '}
          <em>input form</em> (bukan query SQL) yang disisipkan server ke query-nya.{' '}
          <span className="text-amber-200/90">Hanya untuk latihan di lingkungan sendiri</span> — menguji sistem orang lain tanpa izin
          adalah tindak pidana.
        </span>
      </div>

      <GoalCard description={lab.goal.description} />

      <PortalForm
        mission={mission}
        input={input}
        onInputChange={onInputChange}
        onSubmit={onSubmit}
        busy={showRunning}
        ready={ready}
        safeMode={safeMode}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SafeModeToggle safeMode={safeMode} onChange={onSafeModeChange} />
        <AssistButtons mission={mission} missionProgress={missionProgress} onHint={onHint} onShowSolution={onShowSolution} />
      </div>

      <InjectionPreview lab={lab} input={input} safeMode={safeMode} />

      <MissionOutput
        key={runId}
        check={run?.check ?? null}
        completion={completion}
        running={showRunning}
        onCancel={onCancel}
        hasNextMission={hasNextMission}
        onNextMission={onNextMission}
        idle={<InjectionIdle />}
        noResultMessage="Halaman tidak menampilkan tabel apa pun — statement terakhir yang dijalankan server bukan SELECT."
        successTitle="Serangan berhasil!"
        successDetail="target serangan tercapai"
        afterFeedback={
          // Mode aman memang dirancang agar serangan gagal — tidak dicatat sebagai kesalahan.
          run && !run.safeMode ? <MistakeNudge missionId={mission.id} kind={classifyCheck(mission, run.check)} /> : null
        }
      />

      {run ? <ExecutedSql run={run} /> : null}

      <InjectionExplainer
        key={mission.id}
        lab={lab}
        succeeded={run?.goalMet === true || missionProgress.completed}
        revealAttack={run?.goalMet === true || missionProgress.completed || missionProgress.solutionShown}
      />
    </div>
  );
}

function GoalCard({ description }: { description: string }) {
  return (
    <section className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">Target serangan</p>
        <p className="text-sm leading-relaxed text-slate-200">{description}</p>
      </div>
    </section>
  );
}

interface PortalFormProps {
  mission: InjectionMission;
  input: string;
  onInputChange: (input: string) => void;
  onSubmit: () => void;
  /** Percobaan sebelumnya masih berjalan → tombol Kirim nonaktif. */
  busy: boolean;
  ready: boolean;
  safeMode: boolean;
}

/** Tiruan halaman portal rumah sakit dengan satu kolom input yang rentan. */
function PortalForm({ mission, input, onInputChange, onSubmit, ready, safeMode, busy }: PortalFormProps) {
  const { lab } = mission;
  const inputId = useId();
  const pathSlug = mission.id.replace(/^t\d+-/, '');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (ready) onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isRunShortcut(event)) return;
    event.preventDefault();
    if (ready) onSubmit();
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg shadow-black/30">
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/80 px-3 py-2" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-2 flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-md bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] text-slate-400">
          {safeMode ? <Lock className="h-3 w-3 text-emerald-400" /> : <Globe className="h-3 w-3 text-slate-500" />}
          portal.rs-latihan.local/{pathSlug}
        </span>
      </div>
      <div className="border-b border-slate-800 bg-gradient-to-r from-teal-600/30 via-emerald-600/20 to-transparent px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-300/80">RS Latihan · Portal Internal</p>
        <h3 className="text-sm font-bold text-slate-100">{lab.formTitle}</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2 px-4 py-4">
        <label htmlFor={inputId} className="block text-xs font-medium text-slate-300">
          {lab.inputLabel}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={inputId}
            type="text"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={lab.placeholder}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
          />
          <button
            type="submit"
            disabled={!ready || busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden />
            Kirim
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <button
            type="button"
            onClick={() => onInputChange(lab.sampleInput)}
            className={`${SECONDARY_BUTTON} px-2 py-1 text-xs`}
            title={`Isi dengan input wajar: ${lab.sampleInput}`}
          >
            <Sparkles className="h-3.5 w-3.5 text-teal-300" aria-hidden />
            Isi contoh normal
          </button>
          <span>
            Enter atau{' '}
            <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-px font-mono text-[10px] text-slate-300">
              {RUN_SHORTCUT_LABEL}
            </kbd>{' '}
            untuk mengirim
          </span>
        </div>
      </form>
    </section>
  );
}

function SafeModeToggle({ safeMode, onChange }: { safeMode: boolean; onChange: (safeMode: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={safeMode}
      onClick={() => onChange(!safeMode)}
      title="Bandingkan: server yang memakai prepared statement memperlakukan input sebagai data, bukan kode."
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
        safeMode
          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
          : 'border-slate-700 text-slate-300 hover:border-emerald-500/40 hover:bg-slate-800'
      }`}
    >
      {safeMode ? <Lock className="h-4 w-4 text-emerald-300" aria-hidden /> : <LockOpen className="h-4 w-4 text-rose-300" aria-hidden />}
      Mode aman (prepared statement)
      <span
        className={`rounded px-1.5 py-px text-[10px] font-bold uppercase ${safeMode ? 'bg-emerald-500/25 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}
      >
        {safeMode ? 'aktif' : 'mati'}
      </span>
    </button>
  );
}

function InjectionIdle() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-800 bg-slate-900/30 px-6 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 ring-1 ring-violet-500/30">
        <ShieldAlert className="h-6 w-6 text-violet-400" aria-hidden />
      </div>
      <p className="text-sm font-medium text-slate-300">Halaman hasil masih kosong</p>
      <p className="max-w-sm text-xs leading-relaxed text-slate-500">
        Coba dulu input normal dengan tombol <span className="font-semibold text-teal-300">Isi contoh normal</span>, amati SQL yang
        dibentuk server, lalu rancang input yang mengubah makna query tersebut.
      </p>
    </div>
  );
}

function ExecutedSql({ run }: { run: InjectionRun }) {
  return (
    <details className="group overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200">
        {run.safeMode ? (
          <Lock className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
        ) : (
          <TriangleAlert className="h-3.5 w-3.5 text-rose-400" aria-hidden />
        )}
        SQL yang benar-benar dieksekusi server pada percobaan terakhir ({run.safeMode ? 'mode aman' : 'mode rentan'})
      </summary>
      <div className="border-t border-slate-800">
        <HighlightedCode code={run.executedSql} className="p-3" />
      </div>
    </details>
  );
}
