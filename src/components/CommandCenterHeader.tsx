import React from 'react';
import { SimulationState } from '../simulation/simulationEngine';
import { AAVTelemetry, Scenario } from '../types/slam';
import { SCENARIOS } from '../simulation/scenarios';
import { Play, Pause, BarChart3, BookOpen, Camera, ChevronDown, Layers, Radio } from 'lucide-react';
import { VyomLogo } from './VyomLogo';
import { Button, Segmented } from './ui/Button';
import { StatusBadge } from './ui/Panel';
import {
  FUSION_STAGE_SHORT,
  MISSION_STATUS_LABEL,
  MISSION_STATUS_TONE,
  formatMissionTime,
} from '../design/labels';

interface CommandCenterHeaderProps {
  simState: SimulationState;
  scenario: Scenario;
  coveragePercent: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSetSpeed: (speed: number) => void;
  onToggleStressTest: () => void;
  onTriggerFusion: () => void;
  onSelectScenario: (scenarioId: string) => void;
  onOpenAnalytics: () => void;
  onOpenArchitecture: () => void;
  onOpenCameraFeed: () => void;
  onOpenFusionModal: () => void;
}

const SPEED_OPTIONS = [
  { value: '0.5', label: '0.5x' },
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '5', label: '5x' },
];

export const CommandCenterHeader: React.FC<CommandCenterHeaderProps> = ({
  simState,
  scenario,
  coveragePercent,
  onStart,
  onPause,
  onReset,
  onSetSpeed,
  onToggleStressTest,
  onTriggerFusion,
  onSelectScenario,
  onOpenAnalytics,
  onOpenArchitecture,
  onOpenCameraFeed,
  onOpenFusionModal,
}) => {
  const [isPanelMenuOpen, setIsPanelMenuOpen] = React.useState(false);
  const { missionStatus, isRunning, collabSlam } = simState;
  const isPaused = missionStatus === 'PAUSED';
  const isComplete = missionStatus === 'COMPLETE';
  const isFused = collabSlam.fusionStage === 'GLOBAL_FUSED';
  const isFusingNow = collabSlam.fusionStage !== 'IDLE' && !isFused;
  const onlineAavs = (Object.values(simState.agents) as AAVTelemetry[]).filter(
    (agent) => agent.networkConnected
  ).length;

  /* Run control: Start (green) -> Pause (red) -> Resume (green). */
  const runLabel = isRunning
    ? 'Pause mission'
    : isPaused
    ? 'Resume mission'
    : isComplete
    ? 'Run again'
    : 'Start mission';

  const fuseLabel = isFused
    ? 'Maps fused'
    : isFusingNow
    ? `Fusing — ${FUSION_STAGE_SHORT[collabSlam.fusionStage]}`
    : 'Fuse maps';

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-line bg-surface-1">
      <div className="flex items-center gap-3 overflow-visible px-3 py-2">
      {/* Identity */}
      <div className="flex shrink-0 items-center gap-2">
        <VyomLogo height={20} />
        <div className="h-5 w-px bg-white/10" />
        <div className="leading-tight">
          <div className="text-2xs font-semibold text-ink">Collaborative Visual-SLAM</div>
          <div className="text-3xs text-ink-3">Autonomous mission control</div>
        </div>
      </div>

      <div className="h-5 w-px shrink-0 bg-white/10" />

      {/* Mission state summary */}
      <div className="flex shrink-0 items-center gap-3 border-x border-line px-3">
        <label className="flex items-center gap-1 text-2xs text-ink-3">
          Mission
          <select
            id="scenario-selector"
            value={scenario.id}
            onChange={(e) => onSelectScenario(e.target.value)}
            className="h-7 max-w-[180px] border border-line bg-surface-2 px-2 text-2xs font-medium text-ink hover:border-line-strong focus:border-primary focus:outline-none"
          >
            {Object.values(SCENARIOS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="leading-tight">
          <div className="text-3xs text-ink-3">Time</div>
          <div id="mission-clock" className="telemetry text-xs font-semibold text-ink">
            {formatMissionTime(simState.simTimeSeconds)}
          </div>
        </div>
        <div className="leading-tight">
          <div className="text-3xs text-ink-3">State</div>
          <StatusBadge
            id="mission-state-badge"
            label={MISSION_STATUS_LABEL[missionStatus]}
            tone={MISSION_STATUS_TONE[missionStatus]}
            dot
          />
        </div>
        <div className="leading-tight">
          <div className="text-3xs text-ink-3">AAVs</div>
          <div className="telemetry text-xs font-semibold text-ink">{onlineAavs}/3</div>
        </div>
        <div className="leading-tight">
          <div className="text-3xs text-ink-3">Coverage</div>
          <div className="telemetry text-xs font-semibold text-ink">{Math.round(coveragePercent)}%</div>
        </div>
        <div className="leading-tight">
          <div className="text-3xs text-ink-3">Latency</div>
          <div className="telemetry text-xs font-semibold text-ink">{simState.network.latencyMs} ms</div>
        </div>
      </div>

      {/* Run controls */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          id={isRunning ? 'btn-pause-mission' : 'btn-start-mission'}
          variant={isRunning ? 'danger' : 'success'}
          size="sm"
          onClick={isRunning ? onPause : onStart}
          icon={
            isRunning ? (
              <Pause className="h-3 w-3 fill-current" />
            ) : (
              <Play className="h-3 w-3 fill-current" />
            )
          }
        >
          {runLabel}
        </Button>

        <Button
          id="btn-fuse-maps"
          variant="primary"
          size="sm"
          disabled={isFused}
          onClick={onTriggerFusion}
          icon={<Layers className="h-3 w-3" />}
          title={
            isFused
              ? 'Local maps are already fused into the unified map'
              : 'Fuse all local maps into a unified global map'
          }
        >
          {fuseLabel}
        </Button>
      </div>

      {/* Scenario + rate + stress */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Segmented
          aria-label="Simulation rate"
          mono
          options={SPEED_OPTIONS.map((o) => ({ ...o, id: `speed-btn-${o.label}` }))}
          value={String(simState.simSpeed)}
          onChange={(v) => onSetSpeed(Number(v))}
        />

        <Button
          id="btn-stress-test"
          variant={simState.isStressTest ? 'danger' : 'neutral'}
          size="sm"
          onClick={onToggleStressTest}
          title="Inject 5G radio interference to show degraded-link behaviour"
        >
          {simState.isStressTest ? 'Interference on' : 'Stress test'}
        </Button>
      </div>

      <div className="relative shrink-0">
        <Button
          id="btn-panel-menu"
          variant="neutral"
          size="sm"
          onClick={() => setIsPanelMenuOpen((isOpen) => !isOpen)}
          aria-expanded={isPanelMenuOpen}
          aria-haspopup="menu"
          icon={<ChevronDown className="h-3 w-3" />}
        >
          Panels
        </Button>

        {isPanelMenuOpen && (
          <div
            role="menu"
            className="absolute right-full top-0 z-50 mr-1.5 flex min-w-44 flex-col gap-1 rounded-md border border-line bg-surface-1 p-1.5"
          >
            <Button id="btn-open-camera-modal" variant="neutral" size="sm" onClick={() => { onOpenCameraFeed(); setIsPanelMenuOpen(false); }} icon={<Camera className="h-3 w-3" />}>
              Vision feed
            </Button>
            <Button id="btn-open-fusion-pipeline" variant="neutral" size="sm" onClick={() => { onOpenFusionModal(); setIsPanelMenuOpen(false); }} icon={<Radio className="h-3 w-3" />}>
              Fusion pipeline
            </Button>
            <Button id="btn-open-analytics-modal" variant="neutral" size="sm" onClick={() => { onOpenAnalytics(); setIsPanelMenuOpen(false); }} icon={<BarChart3 className="h-3 w-3" />}>
              Analytics
            </Button>
            <Button id="btn-open-architecture-modal" variant="neutral" size="sm" onClick={() => { onOpenArchitecture(); setIsPanelMenuOpen(false); }} icon={<BookOpen className="h-3 w-3" />}>
              Architecture
            </Button>
          </div>
        )}
      </div>

      </div>
    </header>
  );
};
