import type { Database } from 'sql.js';
import type { CompletionSchema } from '../../lib/sqlComplete';
import { MissionWorkspace } from '../MissionWorkspace';
import { ConceptWorkspace } from './ConceptWorkspace';
import { InjectionWorkspace } from './InjectionWorkspace';
import { PredictWorkspace } from './PredictWorkspace';
import type { MissionDrafts } from './useMissionDrafts';
import type { MissionRunner } from './useMissionRunner';
import type { Mission, MissionProgress } from '../../types';

export interface MissionPanelProps {
  mission: Mission;
  missionProgress: MissionProgress;
  totalCount: number;
  drafts: MissionDrafts;
  runner: MissionRunner;
  ready: boolean;
  solutionVisible: boolean;
  hasNextMission: boolean;
  onNextMission: () => void;
  onHint: () => void;
  onShowSolution: () => void;
  /** DB seed murni (tidak pernah disentuh query user) — untuk urutan eksekusi & pilihan tebak hasil. */
  referenceDb: Database | null;
  /** Tabel & kolom untuk autocomplete editor. */
  schema: CompletionSchema;
}

/** Panel kanan mode Misi: memilih workspace sesuai jenis misi. */
export function MissionPanel({
  mission,
  missionProgress,
  totalCount,
  drafts,
  runner,
  ready,
  solutionVisible,
  hasNextMission,
  onNextMission,
  onHint,
  onShowSolution,
  referenceDb,
  schema,
}: MissionPanelProps) {
  // Hasil percobaan hanya dipakai bila milik misi ini (hasil misi lain tidak pernah bocor).
  const current = runner.attempt?.missionId === mission.id ? runner.attempt : null;
  const common = { missionProgress, totalCount, onHint, onShowSolution, hasNextMission, onNextMission, runId: runner.runId };
  // Penilaian di worker sedang berjalan untuk misi ini (tampilkan indikator + tombol Hentikan).
  const running = runner.runningMissionId === mission.id;

  switch (mission.kind) {
    case 'sql': {
      const sql = drafts.sqlFor(mission);
      return (
        <MissionWorkspace
          {...common}
          mission={mission}
          sql={sql}
          onSqlChange={(next) => drafts.setSql(mission.id, next)}
          onRun={() => runner.runSql(mission, sql)}
          onResetEditor={() => drafts.setSql(mission.id, mission.starterSql)}
          check={current?.kind === 'sql' ? current.check : null}
          completion={runner.completion}
          ready={ready}
          referenceDb={referenceDb}
          schema={schema}
          running={running}
          onCancel={runner.cancel}
        />
      );
    }
    case 'injection': {
      const input = drafts.injectionInputFor(mission.id);
      const safeMode = drafts.safeModeFor(mission.id);
      return (
        <InjectionWorkspace
          {...common}
          mission={mission}
          input={input}
          onInputChange={(next) => drafts.setInjectionInput(mission.id, next)}
          safeMode={safeMode}
          onSafeModeChange={(next) => drafts.setSafeMode(mission.id, next)}
          onSubmit={() => runner.submitInjection(mission, input, safeMode)}
          run={current?.kind === 'injection' ? current.run : null}
          running={running}
          onCancel={runner.cancel}
          completion={runner.completion}
          ready={ready}
        />
      );
    }
    case 'concept': {
      const answers = drafts.quizAnswersFor(mission.id);
      return (
        <ConceptWorkspace
          {...common}
          mission={mission}
          answers={answers}
          onAnswer={(questionId, optionIndex) => drafts.setQuizAnswer(mission.id, questionId, optionIndex)}
          onCheck={() => runner.submitQuiz(mission, answers)}
          attempt={current?.kind === 'concept' ? current : null}
          completion={runner.completion}
          solutionVisible={solutionVisible}
        />
      );
    }
    case 'predict':
      return (
        <PredictWorkspace
          {...common}
          mission={mission}
          db={referenceDb}
          choiceId={drafts.predictChoiceFor(mission.id)}
          onChoose={(choiceId) => drafts.setPredictChoice(mission.id, choiceId)}
          onCheck={(choice) => runner.submitPredict(mission, choice)}
          attempt={current?.kind === 'predict' ? current : null}
          completion={runner.completion}
          solutionVisible={solutionVisible}
        />
      );
    default: {
      const unreachable: never = mission;
      return unreachable;
    }
  }
}
