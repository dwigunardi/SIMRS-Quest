import { useEffect, useState } from 'react';
import { useArticleReads } from './hooks/useArticleReads';
import { useMistakes } from './hooks/useMistakes';
import { useCompletionSchema } from './hooks/useCompletionSchema';
import { useSqlEngine } from './hooks/useSqlEngine';
import { usePlayground } from './hooks/usePlayground';
import { useProgress } from './hooks/useProgress';
import { MISSIONS, TIERS, getMissionById, getNextMission } from './data/missions';
import { calcReward, getMissionProgress, isMissionUnlocked } from './lib/progress';
import { solutionAttemptsLeft } from './lib/boss';
import { Header } from './components/Header';
import { ErrorScreen, LoadingScreen } from './components/AppScreens';
import { MissionSidebar } from './components/MissionSidebar';
import { MissionPanel } from './components/workspaces/MissionPanel';
import { useMissionDrafts } from './components/workspaces/useMissionDrafts';
import { useMissionRunner } from './components/workspaces/useMissionRunner';
import { PlaygroundSidebar } from './components/PlaygroundSidebar';
import { PlaygroundWorkspace } from './components/PlaygroundWorkspace';
import { MateriLinkContext, type MateriLinks } from './components/materi/MateriLinkContext';
import { ReferenceSidebar } from './components/materi/ReferenceSidebar';
import { ReferenceView, type MissionAccess } from './components/materi/ReferenceView';
import { MistakeNudgeContext, type MistakeNudgeLinks } from './components/progress/MistakeNudge';
import { ProgressSidebar } from './components/progress/ProgressSidebar';
import { ExamSidebar } from './components/exam/ExamSidebar';
import { ExamSetup } from './components/exam/ExamSetup';
import { ExamQuestion } from './components/exam/ExamQuestion';
import { ExamReport } from './components/exam/ExamReport';
import { useExam } from './hooks/useExam';
import { useReviewDeck } from './hooks/useReviewDeck';
import { useAchievements } from './hooks/useAchievements';
import { usePerfLab } from './hooks/usePerfLab';
import { PerfLab } from './components/perf/PerfLab';
import { PerfLabContext, type PerfLabLink } from './components/perf/PerfLabContext';
import { AchievementToasts, AchievementsPanel } from './components/progress/Achievements';
import { ReviewStart } from './components/exam/ReviewStart';
import { describeDue, dueItems, forecast, cardFor } from './lib/review';
import { toLocalDateKey } from './lib/progress';
import { formatClock, isExamMission } from './lib/exam';
import { WeaknessView } from './components/progress/WeaknessView';
import { ARTICLES } from './data/materi';
import { buildWeaknessReport } from './lib/weakness';
import { findPendingMission, pickInitialMissionId, requireFirstMission } from './lib/resume';
import type { AppMode, LeftTab } from './types';

const HINT_CONFIRM = 'Membuka hint akan mengurangi 20% XP misi ini. Lanjutkan?';
const SOLUTION_CONFIRM = 'Melihat solusi membuat misi ini bernilai 0 XP. Lanjutkan?';
const DEFAULT_PLAYGROUND_SQL =
  '-- Free Playground: bebas bereksperimen dengan database SIMRS\nSELECT no_rm, nama, kota, penjamin\nFROM pasien\nLIMIT 10;';

const FIRST_MISSION = requireFirstMission(MISSIONS);

/** Segmen URL setelah '#/sql' → mode yang dibuka ("niat masuk" dari Beranda atau tautan langsung). */
const ENTRY_MODES: ReadonlyMap<string, AppMode> = new Map<string, AppMode>([
  ['misi', 'mission'],
  ['materi', 'reference'],
  ['playground', 'playground'],
  ['progres', 'progress'],
  ['ujian', 'exam'],
]);
const NO_ENTRY: readonly string[] = [];

/**
 * Props dari platform (src/tracks/sql/SqlTrack.tsx). Semuanya opsional supaya App tetap bisa dirender berdiri sendiri.
 * Bentuknya sama dengan TrackProps di platform/tracks.
 */
export interface AppProps {
  /** false = pengguna sedang di Beranda; App tetap ter-mount (draf, Playground, timer ujian jalan terus) tetapi tersembunyi. */
  active?: boolean;
  /** Sisa segmen URL setelah id jalur, mis. ['ujian']. Diproses sekali lalu dilaporkan lewat onEntryConsumed. */
  entry?: readonly string[];
  onEntryConsumed?: () => void;
  onHome?: () => void;
}

export default function App({ active = true, entry = NO_ENTRY, onEntryConsumed, onHome }: AppProps = {}) {
  const engine = useSqlEngine();
  const progressApi = useProgress();
  const { progress } = progressApi;
  const drafts = useMissionDrafts();
  const mistakes = useMistakes();
  const runner = useMissionRunner(engine.SQL, progressApi, mistakes);
  const reviewDeck = useReviewDeck();
  const exam = useExam(engine.SQL, engine.referenceDb, progress, mistakes, (record) => {
    // Ujian maupun latihan ulang memperbarui jadwal ulang misi yang sudah selesai, dan dihitung hari aktif (streak).
    reviewDeck.apply(progress, record.items);
    if (record.items.some((item) => item.status !== 'unanswered')) progressApi.markActive();
  });
  const today = toLocalDateKey(new Date());
  const due = dueItems(MISSIONS, progress, reviewDeck.deck, mistakes.events, today);
  const playground = usePlayground(engine, DEFAULT_PLAYGROUND_SQL);
  const perfLab = usePerfLab();
  /** Free Playground: database sesi (kecil, bisa diubah) atau Lab Performa (data besar di worker terpisah). */
  const [playgroundTarget, setPlaygroundTarget] = useState<'session' | 'big'>('session');
  // Autocomplete: misi memakai skema DB seed; Playground memakai DB sesi (bisa berubah lewat CREATE/DROP).
  const missionSchema = useCompletionSchema(engine.referenceDb);
  const playgroundSchema = useCompletionSchema(engine.db, engine.dbVersion);
  const articleReads = useArticleReads();
  // Lencana dihitung dari data yang ada; yang baru diraih diumumkan lewat toast (setelah mesin SQL siap). Selama jalur
  // tersembunyi di balik Beranda pengumuman ditahan — mis. lencana dari ujian yang terkumpul otomatis baru muncul saat
  // pengguna kembali, bukan habis tanpa pernah terlihat.
  const achievements = useAchievements(
    { missions: MISSIONS, progress, mistakes, exams: exam.history, reviewDeck: reviewDeck.deck, articlesRead: articleReads.read, articleCount: ARTICLES.length },
    engine.status === 'ready' && active,
  );
  /** Materi yang dipilih di tab Materi; null = materi utama misi aktif (direset saat pindah misi). */
  const [articleId, setArticleId] = useState<string | null>(null);
  /** Artikel yang dibuka di mode Materi (layar penuh). */
  const [referenceArticleId, setReferenceArticleId] = useState<string | null>(null);
  /** Bertambah saat materi dibuka lewat tautan di mode Misi (tab Materi digulir & judulnya difokus). */
  const [materiFocusSignal, setMateriFocusSignal] = useState(0);

  const [mode, setMode] = useState<AppMode>('mission');
  const [leftTab, setLeftTab] = useState<LeftTab>('mission');
  const [activeMissionId, setActiveMissionId] = useState<string>(() => pickInitialMissionId(MISSIONS, progress));
  /**
   * Misi yang solusinya sedang dilihat di sesi ini. Untuk misi yang sudah selesai,
   * markSolutionShown sengaja tidak mengubah progres (tanpa penalti retroaktif),
   * jadi visibilitas solusi disimpan terpisah di sini.
   */
  const [viewedSolutions, setViewedSolutions] = useState<ReadonlySet<string>>(() => new Set());

  // "Niat masuk" sekali pakai: '#/sql/ujian' dkk. memindahkan mode, lalu platform menormalkan URL menjadi '#/sql'.
  // Berlaku saat jalur baru dimuat maupun saat jalur yang masih hangat dimasuki lagi; segmen yang tidak dikenal
  // diabaikan tetapi tetap dilaporkan supaya URL-nya dirapikan. Mode sendiri tetap state (belum hidup di URL).
  // Harus berada di atas return awal di bawah (aturan hooks) — mode yang dipilih berlaku begitu mesin SQL siap.
  useEffect(() => {
    if (!active || entry.length === 0) return;
    const target = ENTRY_MODES.get(entry[0] ?? '');
    if (target) setMode(target);
    onEntryConsumed?.();
  }, [active, entry, onEntryConsumed]);

  if (engine.status === 'loading') return <LoadingScreen onHome={onHome} />;
  if (engine.status === 'error') return <ErrorScreen message={engine.error} onHome={onHome} />;

  const mission = getMissionById(activeMissionId) ?? FIRST_MISSION;
  const missionProgress = getMissionProgress(progress, mission.id);
  const reward = missionProgress.completed ? missionProgress.earnedXp : calcReward(mission, missionProgress);
  const solutionVisible = missionProgress.solutionShown || viewedSolutions.has(mission.id);
  // Misi berikutnya menurut order bila sudah terbuka. Bila belum (mis. boss yang masih menunggu kartu konsep
  // tier-nya) atau ini misi terakhir: lanjut ke misi yang belum selesai, sehingga pesan "semua misi tuntas"
  // hanya muncul bila memang tidak ada lagi yang tersisa.
  const following = getNextMission(mission.id);
  const nextMission =
    following && isMissionUnlocked(MISSIONS, progress, following.id) ? following : findPendingMission(MISSIONS, progress, mission.id);
  const ready = engine.SQL !== null;

  const selectMission = (missionId: string) => {
    if (!isMissionUnlocked(MISSIONS, progress, missionId)) return;
    setActiveMissionId(missionId);
    progressApi.setLastMission(missionId);
    setArticleId(null);
    runner.clear();
  };

  /** Contoh di Materi: buka di Playground (opsional langsung dengan Urutan Eksekusi). */
  const exampleActions = {
    onOpenInPlayground: (sql: string) => {
      playground.loadSql(sql);
      setMode('playground');
    },
    onVisualize: (sql: string) => {
      playground.loadAndVisualize(sql);
      setMode('playground');
    },
  };

  /** "Salin solusi": SQL ke editor (misi sql) atau payload ke form (lab injection). */
  const copySolution = (text: string) => {
    switch (mission.kind) {
      case 'sql':
        drafts.setSql(mission.id, text);
        return;
      case 'injection':
        drafts.setInjectionInput(mission.id, text);
        return;
      case 'concept':
      case 'predict':
        return;
      default: {
        const unreachable: never = mission;
        return unreachable;
      }
    }
  };

  const revealHint = () => {
    setLeftTab('mission');
    const total = mission.hint.length;
    if (missionProgress.hintsRevealed >= total) return; // termasuk Boss Challenge (tanpa hint)
    // Konfirmasi hanya saat hint pertama benar-benar akan memotong XP
    // (tidak perlu jika misi sudah selesai atau solusi sudah dibuka → XP sudah 0).
    const needsConfirm = !missionProgress.completed && !missionProgress.hintUsed && !missionProgress.solutionShown;
    if (needsConfirm && !window.confirm(HINT_CONFIRM)) return;
    progressApi.revealHint(mission.id, Math.min(missionProgress.hintsRevealed + 1, total));
  };

  const showSolution = () => {
    if (solutionVisible) {
      setLeftTab('mission');
      return;
    }
    // Boss: solusi terkunci sampai jumlah percobaan minimum tercapai.
    if (solutionAttemptsLeft(mission, missionProgress) > 0) return;
    // solutionVisible false ⇒ solutionShown false, jadi cukup cek status selesai.
    if (!missionProgress.completed && !window.confirm(SOLUTION_CONFIRM)) return;
    progressApi.showSolution(mission.id);
    setViewedSolutions((prev) => new Set(prev).add(mission.id));
    setLeftTab('mission');
  };

  const goToNextMission = () => {
    if (!nextMission) return;
    selectMission(nextMission.id);
  };

  const resetProgress = () => {
    progressApi.resetProgress();
    setActiveMissionId(FIRST_MISSION.id);
    drafts.resetAll();
    setViewedSolutions(new Set());
    articleReads.reset();
    mistakes.reset();
    exam.abandon();
    exam.clearHistory();
    reviewDeck.reset();
    achievements.reset();
    setArticleId(null);
    runner.clear();
  };

  const isMission = mode === 'mission';

  const materiLinks: MateriLinks = {
    openArticle: (id) => {
      if (mode === 'mission') {
        setArticleId(id);
        setLeftTab('materi');
        setMateriFocusSignal((n) => n + 1);
        return;
      }
      setReferenceArticleId(id);
      setMode('reference');
    },
    openReference: (id) => {
      setReferenceArticleId(id);
      setMode('reference');
    },
  };
  const nudgeLinks: MistakeNudgeLinks = { events: mistakes.events, openProgress: () => setMode('progress') };
  const missionAccess = (missionId: string): MissionAccess => {
    if (getMissionProgress(progress, missionId).completed) return 'done';
    return isMissionUnlocked(MISSIONS, progress, missionId) ? 'open' : 'locked';
  };
  const openMission = (missionId: string) => {
    selectMission(missionId);
    setMode('mission');
  };

  let sidebar;
  let panel;
  if (isMission) {
    sidebar = (
      <MissionSidebar
        leftTab={leftTab}
        onTabChange={setLeftTab}
        missions={MISSIONS}
        tiers={TIERS}
        progress={progress}
        mission={mission}
        missionProgress={missionProgress}
        solutionVisible={solutionVisible}
        reward={reward}
        onSelectMission={selectMission}
        onRevealHint={revealHint}
        onShowSolution={showSolution}
        onCopySolution={copySolution}
        referenceDb={engine.referenceDb}
        playgroundDirty={engine.isDirty}
        articleId={articleId}
        onSelectArticle={setArticleId}
        articlesRead={articleReads.read}
        onArticleRead={articleReads.markRead}
        exampleActions={exampleActions}
        materiFocusSignal={materiFocusSignal}
        onOpenArticle={materiLinks.openArticle}
      />
    );
    panel = (
      <MissionPanel
        key={mission.id}
        mission={mission}
        missionProgress={missionProgress}
        totalCount={MISSIONS.length}
        drafts={drafts}
        runner={runner}
        ready={ready}
        solutionVisible={solutionVisible}
        hasNextMission={nextMission !== undefined}
        onNextMission={goToNextMission}
        onHint={revealHint}
        onShowSolution={showSolution}
        referenceDb={engine.referenceDb}
        schema={missionSchema}
      />
    );
  } else if (mode === 'reference') {
    // Tanpa pilihan, artikel pertama yang tampil — sidebar harus menyorot artikel yang sama.
    const shownArticleId = referenceArticleId ?? ARTICLES[0]?.id ?? null;
    sidebar = <ReferenceSidebar activeId={shownArticleId} onSelect={setReferenceArticleId} read={articleReads.read} />;
    panel = (
      <ReferenceView
        articleId={shownArticleId}
        focusOnMount={referenceArticleId !== null}
        db={engine.referenceDb}
        onRead={articleReads.markRead}
        missionAccess={missionAccess}
        onOpenMission={openMission}
        onOpenInPlayground={exampleActions.onOpenInPlayground}
        onVisualize={exampleActions.onVisualize}
      />
    );
  } else if (mode === 'progress') {
    const report = buildWeaknessReport(mistakes.events, mistakes.solved, progress, MISSIONS, ARTICLES, Date.now());
    sidebar = <ProgressSidebar report={report} missions={MISSIONS} tiers={TIERS} progress={progress} />;
    panel = (
      <div className="space-y-6">
        <WeaknessView report={report} missionAccess={missionAccess} onOpenMission={openMission} onOpenArticle={materiLinks.openArticle} />
        <AchievementsPanel list={achievements.list} />
      </div>
    );
  } else if (mode === 'exam') {
    sidebar = <ExamSidebar exam={exam} />;
    const examMission = exam.session ? getMissionById(exam.session.missionIds[exam.current] ?? '') : undefined;
    if (exam.grading) {
      panel = (
        <div className="mx-auto max-w-md space-y-3 py-16 text-center" role="status">
          <p className="text-lg font-semibold text-slate-100">Menilai jawaban…</p>
          <p className="text-sm tabular-nums text-slate-400">
            {exam.grading.done}/{exam.grading.total} soal
          </p>
        </div>
      );
    } else if (exam.session && examMission && isExamMission(examMission)) {
      const session = exam.session;
      panel = (
        <ExamQuestion
          mission={examMission}
          answer={session.answers[examMission.id]}
          index={exam.current}
          total={session.missionIds.length}
          onAnswer={(answer) => exam.setAnswer(examMission.id, answer)}
          onNavigate={exam.setCurrent}
          SQL={engine.SQL}
          referenceDb={engine.referenceDb}
          schema={missionSchema}
        />
      );
    } else if (exam.report) {
      const nextReview = (missionId: string) => {
        const m = getMissionById(missionId);
        const card = m ? cardFor(reviewDeck.deck, m, progress) : null;
        return card ? describeDue(card.due, today) : null;
      };
      panel = (
        <ExamReport record={exam.report} nextReview={nextReview} onNewExam={() => exam.openReport(null)} onOpenMission={openMission} onOpenProgress={() => setMode('progress')} />
      );
    } else {
      panel = (
        <div className="space-y-6">
          <ReviewStart due={due} forecast={forecast(MISSIONS, progress, reviewDeck.deck, today)} today={today} onStart={exam.startReview} />
          <ExamSetup progress={progress} onStart={exam.start} />
        </div>
      );
    }
  } else {
    sidebar = (
      <PlaygroundSidebar
        db={engine.db}
        dbVersion={engine.dbVersion}
        onLoadExample={(sql) => {
          playground.setSql(sql);
          setPlaygroundTarget('session');
        }}
      />
    );
    panel = (
      <div className="flex flex-col gap-4">
        <div className="flex w-fit rounded-lg border border-slate-800 bg-slate-950/60 p-1" role="group" aria-label="Target database">
          {(
            [
              ['session', 'Database sesi'],
              ['big', 'Data besar (Lab Performa)'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={playgroundTarget === value}
              onClick={() => setPlaygroundTarget(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                playgroundTarget === value ? 'bg-slate-800 text-emerald-300 shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {playgroundTarget === 'session' ? (
          <PlaygroundWorkspace playground={playground} ready={ready && engine.db !== null} isDirty={engine.isDirty} schema={playgroundSchema} />
        ) : (
          <PerfLab lab={perfLab} schema={missionSchema} />
        )}
      </div>
    );
  }

  const perfLabLink: PerfLabLink = {
    open: (sql) => {
      perfLab.setSql(sql);
      setPlaygroundTarget('big');
      setMode('playground');
    },
  };

  return (
    <MateriLinkContext.Provider value={materiLinks}>
      <MistakeNudgeContext.Provider value={nudgeLinks}>
        <PerfLabContext.Provider value={perfLabLink}>
        <div className="flex min-h-screen flex-col bg-slate-950 lg:h-screen lg:overflow-hidden">
          <Header
            onHome={onHome}
            progress={progress}
            rankProgress={progressApi.rankProgress}
            completedCount={progressApi.completedCount}
            totalCount={MISSIONS.length}
            mode={mode}
            onModeChange={setMode}
            onResetProgress={resetProgress}
            examClock={exam.session ? (exam.remaining === null ? 'aktif' : formatClock(exam.remaining)) : null}
            reviewDue={due.length}
          />
          <main className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[minmax(340px,2fr)_3fr]">
            <aside className="scrollbar-thin border-b border-slate-800 p-4 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
              {sidebar}
            </aside>
            {/* key per mode: pindah mode selalu mulai dari atas panel (posisi gulir mode lain tidak terbawa). */}
            <section key={mode} className="scrollbar-thin p-4 lg:min-h-0 lg:overflow-y-auto">
              {panel}
            </section>
          </main>
          <AchievementToasts toasts={achievements.toasts} onDismiss={achievements.dismiss} />
        </div>
        </PerfLabContext.Provider>
      </MistakeNudgeContext.Provider>
    </MateriLinkContext.Provider>
  );
}
