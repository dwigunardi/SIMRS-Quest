import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Crown, Lock, Map as MapIcon } from 'lucide-react';
import { getMissionProgress, isMissionUnlocked } from '../lib/progress';
import { isBoss } from '../lib/boss';
import { KindIcon, displayKind } from './MissionKind';
import type { Mission, Tier, TierInfo, UserProgress } from '../types';

export interface MissionListProps {
  missions: Mission[];
  tiers: TierInfo[];
  progress: UserProgress;
  activeMissionId: string;
  onSelect: (missionId: string) => void;
}

type NodeState = 'completed' | 'active' | 'unlocked' | 'locked';

const LOCKED_TOOLTIP = 'Selesaikan misi sebelumnya dulu';

function lockedTooltip(mission: Mission): string {
  return isBoss(mission) ? `Selesaikan semua misi Tier ${mission.tier} (termasuk kartu konsep) untuk membuka boss ini` : LOCKED_TOOLTIP;
}

export function MissionList({ missions, tiers, progress, activeMissionId, onSelect }: MissionListProps) {
  const [listOpen, setListOpen] = useState(true);
  /**
   * Pilihan buka/tutup tier yang dibuat user. Tier tanpa pilihan mengikuti default:
   * hanya tier yang berisi misi aktif yang terbuka (8 tier × 55 misi terlalu panjang bila terbuka semua).
   */
  const [tierOverrides, setTierOverrides] = useState<ReadonlyMap<Tier, boolean>>(() => new Map());

  const sorted = [...missions].sort((a, b) => a.order - b.order);
  const completedTotal = sorted.filter((m) => getMissionProgress(progress, m.id).completed).length;
  const activeMission = sorted.find((m) => m.id === activeMissionId);

  const isTierOpen = (tier: Tier) => tierOverrides.get(tier) ?? tier === activeMission?.tier;

  const toggleTier = (tier: Tier) => {
    const open = isTierOpen(tier);
    setTierOverrides((prev) => new Map(prev).set(tier, !open));
  };

  const getNodeState = (mission: Mission): NodeState => {
    if (getMissionProgress(progress, mission.id).completed) return 'completed';
    if (mission.id === activeMissionId) return 'active';
    if (isMissionUnlocked(missions, progress, mission.id)) return 'unlocked';
    return 'locked';
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60">
      <button
        type="button"
        onClick={() => setListOpen((open) => !open)}
        aria-expanded={listOpen}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <MapIcon className="h-4 w-4 text-emerald-400" aria-hidden />
        <span className="text-sm font-semibold text-slate-100">Peta Misi</span>
        <span className="text-xs tabular-nums text-slate-500">
          {completedTotal}/{sorted.length} selesai
        </span>
        {!listOpen && activeMission && (
          <span className="ml-2 hidden truncate text-xs text-slate-400 sm:inline">
            • Sedang: Misi {activeMission.order} — {activeMission.title}
          </span>
        )}
        <span className="ml-auto text-slate-500">
          {listOpen ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
        </span>
      </button>

      {listOpen && (
        <div className="space-y-2 border-t border-slate-800 px-3 pb-3 pt-2">
          {tiers.map((tier) => {
            const tierMissions = sorted.filter((m) => m.tier === tier.tier);
            if (tierMissions.length === 0) return null;
            return (
              <TierSection
                key={tier.tier}
                tier={tier}
                missions={tierMissions}
                collapsed={!isTierOpen(tier.tier)}
                onToggle={() => toggleTier(tier.tier)}
                getNodeState={getNodeState}
                isActive={(id) => id === activeMissionId}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

interface TierSectionProps {
  tier: TierInfo;
  missions: Mission[];
  collapsed: boolean;
  onToggle: () => void;
  getNodeState: (mission: Mission) => NodeState;
  isActive: (missionId: string) => boolean;
  onSelect: (missionId: string) => void;
}

function TierSection({ tier, missions, collapsed, onToggle, getNodeState, isActive, onSelect }: TierSectionProps) {
  const states = missions.map(getNodeState);
  const done = states.filter((s) => s === 'completed').length;
  const percent = Math.round((done / missions.length) * 100);
  const allDone = done === missions.length;
  const bossIndex = missions.findIndex(isBoss);
  const bossBeaten = bossIndex >= 0 && states[bossIndex] === 'completed';

  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
        title={tier.description}
      >
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
            allDone ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-teal-300'
          }`}
        >
          {allDone ? <Check className="h-4 w-4" aria-hidden /> : tier.tier}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-slate-200">
                Tier {tier.tier}: {tier.name}
              </span>
              {bossBeaten ? <Crown className="h-3.5 w-3.5 shrink-0 text-yellow-300" aria-label="boss dikalahkan" /> : null}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-slate-500">
              {done}/{missions.length}
            </span>
          </span>
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-800">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </span>
        </span>
        <span className="text-slate-500">
          {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        </span>
      </button>

      {!collapsed && (
        <ol className="relative px-3 pb-3">
          {missions.map((mission, index) => (
            <MissionNode
              key={mission.id}
              mission={mission}
              state={states[index] ?? 'locked'}
              active={isActive(mission.id)}
              isLast={index === missions.length - 1}
              onSelect={onSelect}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

interface MissionNodeProps {
  mission: Mission;
  state: NodeState;
  active: boolean;
  isLast: boolean;
  onSelect: (missionId: string) => void;
}

const NODE_CIRCLE_CLASS: Record<NodeState, string> = {
  completed: 'border-emerald-400 bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30',
  active: 'border-teal-300 bg-teal-500/20 text-teal-200',
  unlocked: 'border-teal-500/60 bg-slate-900 text-teal-300',
  locked: 'border-slate-700 bg-slate-900 text-slate-600',
};

function MissionNode({ mission, state, active, isLast, onSelect }: MissionNodeProps) {
  const locked = state === 'locked';
  const boss = isBoss(mission);
  const tooltip = lockedTooltip(mission);
  const connectorClass = state === 'completed' ? 'bg-emerald-500/60' : 'bg-slate-800';

  return (
    // Tooltip juga dipasang di <li>: sebagian browser tidak menampilkan `title` pada tombol disabled.
    <li className="relative flex gap-3 pt-2" title={locked ? tooltip : undefined}>
      {!isLast && <span className={`absolute left-[21px] top-12 h-[calc(100%-2.25rem)] w-0.5 ${connectorClass}`} aria-hidden />}
      <button
        type="button"
        disabled={locked}
        onClick={() => onSelect(mission.id)}
        title={locked ? tooltip : `Misi ${mission.order}: ${mission.title}`}
        aria-current={active ? 'step' : undefined}
        className={`group flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition ${
          locked ? 'cursor-not-allowed' : 'hover:bg-slate-800/60'
        } ${active ? 'bg-slate-800/70' : ''}`}
      >
        <span
          className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-xs font-bold transition ${
            boss && state !== 'completed' && !locked ? BOSS_CIRCLE_CLASS : NODE_CIRCLE_CLASS[state]
          } ${active ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950' : ''}`}
        >
          <NodeGlyph state={state} order={mission.order} boss={boss} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-medium ${locked ? 'text-slate-500' : 'text-slate-200'}`}>
            {mission.title}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-[11px]">
            <KindIcon kind={displayKind(mission)} className={`h-3.5 w-3.5 shrink-0 ${locked ? 'opacity-40' : ''}`} />
            <span
              className={`truncate rounded px-1.5 py-px font-mono ${locked ? 'bg-slate-800/60 text-slate-600' : 'bg-slate-800 text-teal-300'}`}
            >
              {mission.concept}
            </span>
            <span className={`shrink-0 ${locked ? 'text-slate-600' : 'text-amber-400/80'}`}>{mission.xpReward} XP</span>
          </span>
        </span>
      </button>
    </li>
  );
}

const BOSS_CIRCLE_CLASS = 'border-yellow-300 bg-yellow-400/15 text-yellow-200 shadow-md shadow-yellow-400/20';

function NodeGlyph({ state, order, boss }: { state: NodeState; order: number; boss: boolean }) {
  if (state === 'completed') return boss ? <Crown className="h-4 w-4" strokeWidth={2.5} aria-label="Boss dikalahkan" /> : <Check className="h-4 w-4" strokeWidth={3} aria-label="Selesai" />;
  if (state === 'locked') return <Lock className="h-3.5 w-3.5" aria-label="Terkunci" />;
  return boss ? <Crown className="h-4 w-4" aria-label={`Boss, misi ${order}`} /> : <span className="tabular-nums">{order}</span>;
}
