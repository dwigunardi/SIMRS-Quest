import type { Database } from 'sql.js';
import { BookOpen, Database as DatabaseIcon, GraduationCap, ShieldCheck, Target } from 'lucide-react';
import { MissionList } from './MissionList';
import { MissionBrief, MissionHelp } from './MissionBrief';
import { SchemaExplorer } from './SchemaExplorer';
import { MateriPanel } from './materi/MateriPanel';
import type { ExampleActions } from './materi/ArticleView';
import { articlesForMission } from '../data/materi';
import type { LeftTab, Mission, MissionProgress, TierInfo, UserProgress } from '../types';

export interface MissionSidebarProps {
  leftTab: LeftTab;
  onTabChange: (tab: LeftTab) => void;
  missions: Mission[];
  tiers: TierInfo[];
  progress: UserProgress;
  mission: Mission;
  missionProgress: MissionProgress;
  /** Solusi sedang ditampilkan (juga untuk misi yang sudah selesai, tanpa penalti). */
  solutionVisible: boolean;
  reward: number;
  onSelectMission: (missionId: string) => void;
  onRevealHint: () => void;
  onShowSolution: () => void;
  onCopySolution: (text: string) => void;
  /** DB seed murni (bukan db sesi Playground) — sama dengan data penilaian. */
  referenceDb: Database | null;
  /** true jika db sesi Playground sudah diubah; hanya untuk catatan informatif. */
  playgroundDirty: boolean;
  /** Materi yang dipilih di tab Materi (null = materi utama misi aktif). */
  articleId: string | null;
  onSelectArticle: (articleId: string) => void;
  articlesRead: ReadonlySet<string>;
  onArticleRead: (articleId: string) => void;
  exampleActions: ExampleActions;
  /** Lihat MateriPanel.focusSignal. */
  materiFocusSignal: number;
  /** Buka materi lewat tautan (pindah tab + gulir + fokus). */
  onOpenArticle: (articleId: string) => void;
}

const TABS: { id: LeftTab; label: string; icon: typeof Target }[] = [
  { id: 'mission', label: 'Hint & Misi', icon: Target },
  { id: 'materi', label: 'Materi', icon: GraduationCap },
  { id: 'schema', label: 'Schema', icon: DatabaseIcon },
];

export function MissionSidebar({
  leftTab,
  onTabChange,
  missions,
  tiers,
  progress,
  mission,
  missionProgress,
  solutionVisible,
  reward,
  onSelectMission,
  onRevealHint,
  onShowSolution,
  onCopySolution,
  referenceDb,
  playgroundDirty,
  articleId,
  onSelectArticle,
  articlesRead,
  onArticleRead,
  exampleActions,
  materiFocusSignal,
  onOpenArticle,
}: MissionSidebarProps) {
  // "Konsep baru": materi misi ini yang belum pernah dibuka (hanya selama misi belum selesai).
  // Kartu konsep sudah berisi materinya sendiri, jadi penanda tidak ditampilkan di sana (titik di tab tetap ada).
  const unread = missionProgress.completed ? [] : articlesForMission(mission).filter((a) => !articlesRead.has(a.id));
  const showCallout = unread.length > 0 && leftTab !== 'materi' && mission.kind !== 'concept';
  return (
    <div className="space-y-4">
      {/* Skenario & Tugas misi aktif selalu di paling atas, di luar tab, agar mudah dilihat. */}
      <MissionBrief key={mission.id} mission={mission} missionProgress={missionProgress} reward={reward} />

      {showCallout ? <NewConceptCallout titles={unread.map((a) => a.title)} onOpen={() => onOpenArticle(unread[0]?.id ?? '')} /> : null}

      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1" role="group" aria-label="Panel kiri">
        {TABS.map((tab) => {
          const active = tab.id === leftTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={active}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                active ? 'bg-slate-800 text-emerald-300 shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {tab.label}
              {tab.id === 'materi' && unread.length > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-sky-400" role="img" aria-label="ada materi belum dibaca" /> : null}
            </button>
          );
        })}
      </div>

      {leftTab === 'materi' ? (
        <MateriPanel
          mission={mission}
          articleId={articleId}
          onSelectArticle={onSelectArticle}
          read={articlesRead}
          onRead={onArticleRead}
          db={referenceDb}
          onOpenInPlayground={exampleActions.onOpenInPlayground}
          onVisualize={exampleActions.onVisualize}
          focusSignal={materiFocusSignal}
        />
      ) : null}
      {leftTab === 'mission' ? (
        <>
          <MissionHelp
            key={mission.id}
            mission={mission}
            missionProgress={missionProgress}
            solutionVisible={solutionVisible}
            onRevealHint={onRevealHint}
            onShowSolution={onShowSolution}
            onCopySolution={onCopySolution}
          />
          <MissionList
            missions={missions}
            tiers={tiers}
            progress={progress}
            activeMissionId={mission.id}
            onSelect={onSelectMission}
          />
        </>
      ) : null}
      {leftTab === 'schema' ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs leading-relaxed text-slate-400">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
            <span>
              Menampilkan data awal — sama persis dengan data yang dipakai untuk penilaian misi.
              {playgroundDirty ? ' Perubahan yang kamu buat di Free Playground tidak tampil di sini dan tidak memengaruhi penilaian.' : ''}
            </span>
          </p>
          {/* DB referensi tidak pernah dimutasi, jadi versinya konstan. */}
          <SchemaExplorer db={referenceDb} dbVersion={0} />
        </div>
      ) : null}
    </div>
  );
}

function NewConceptCallout({ titles, onOpen }: { titles: string[]; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-2.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2.5 text-left transition hover:bg-sky-500/15"
    >
      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden />
      <span className="min-w-0 flex-1 text-xs leading-relaxed text-slate-300">
        <span className="font-semibold text-sky-200">Konsep baru: {titles.join(', ')}.</span> Baca materinya dulu —{' '}
        <span className="text-emerald-300">gratis, tidak mengurangi XP</span>, lengkap dengan contoh yang bisa dijalankan.
      </span>
      <span className="shrink-0 self-center rounded-md bg-sky-500/20 px-2 py-0.5 text-[11px] font-semibold text-sky-100">Baca materi</span>
    </button>
  );
}
