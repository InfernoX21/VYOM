import React from 'react';
import { SimulationState } from '../simulation/simulationEngine';
import { Scenario } from '../types/slam';
import { SCENARIOS } from '../simulation/scenarios';
import { Play, Pause, RotateCcw, BarChart3, BookOpen, Camera, Layers, Radio } from 'lucide-react';
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
  const { missionStatus, isRunning, collabSlam } = simState;
  const isPaused = missionStatus === 'PAUSED';
  const isComplete = missionStatus === 'COMPLETE';
  const isFused = collabSlam.fusionStage === 'GLOBAL_FUSED';
  const isFusingNow = collabSlam.fusionStage !== 'IDLE' && !isFused;

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
    <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface-1 px-3 py-2">
      {/* Identity */}
      <div className="flex shrink-0 items-center gap-2.5">
        <VyomLogo height={22} />
        <div className="hidden h-6 w-px bg-line sm:block" />
        <div className="hidden leading-tight sm:block">
          <div className="text-xs font-semibold text-ink">Collaborative SLAM</div>
          <div className="text-3xs text-ink-3">Multi-AAV mission control</div>
        </div>
      </div>

      {/* Mission clock + state */}
      <div className="flex shrink-0 items-center gap-3 rounded border border-line bg-surface-2 px-2.5 py-1">
        <div className="leading-tight">
          <div className="text-3xs text-ink-3">Mission time</div>
          <div id="mission-clock" className="telemetry text-sm font-semibold text-ink">
            {formatMissionTime(simState.simTimeSeconds)}
          </div>
        </div>
        <div className="h-7 w-px bg-line" />
        <div className="leading-tight">
          <div className="text-3xs text-ink-3">State</div>
          <StatusBadge
            id="mission-state-badge"
            label={MISSION_STATUS_LABEL[missionStatus]}
            tone={MISSION_STATUS_TONE[missionStatus]}
            dot
            className="mt-0.5"
          />
        </div>
      </div>

      {/* Run controls */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          id={isRunning ? 'btn-pause-mission' : 'btn-start-mission'}
          variant={isRunning ? 'danger' : 'success'}
          onClick={isRunning ? onPause : onStart}
          icon={
            isRunning ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )
          }
        >
          {runLabel}
        </Button>

        <Button
          id="btn-reset-mission"
          variant="neutral"
          iconOnly
          aria-label="Reset simulation"
          title="Reset simulation"
          onClick={onReset}
          icon={<RotateCcw className="h-3.5 w-3.5" />}
        />

        <Button
          id="btn-fuse-maps"
          variant="primary"
          disabled={isFused}
          onClick={onTriggerFusion}
          icon={<Layers className="h-3.5 w-3.5" />}
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
      <div className="flex min-w-0 shrink items-center gap-2">
        <label className="flex items-center gap-1.5 text-2xs text-ink-3">
          <span className="hidden md:inline">Scenario</span>
          <select
            id="scenario-selector"
            value={scenario.id}
            onChange={(e) => onSelectScenario(e.target.value)}
            className="h-7 max-w-[190px] rounded border border-line bg-surface-2 px-2 text-2xs text-ink hover:border-line-strong focus:border-primary focus:outline-none"
          >
            {Object.values(SCENARIOS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

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

      {/* Views */}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Button
          id="btn-open-camera-modal"
          variant="neutral"
          size="sm"
          onClick={onOpenCameraFeed}
          icon={<Camera className="h-3.5 w-3.5" />}
          title="Onboard camera and feature tracking"
        >
          <span className="hidden sm:inline">Vision feed</span>
        </Button>

        <Button
          id="btn-open-fusion-pipeline"
          variant="neutral"
          size="sm"
          onClick={onOpenFusionModal}
          icon={<Radio className="h-3.5 w-3.5" />}
          title="Map fusion pipeline"
        >
          <span className="hidden sm:inline">Fusion pipeline</span>
        </Button>

        <Button
          id="btn-open-analytics-modal"
          variant="neutral"
          size="sm"
          onClick={onOpenAnalytics}
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          title="Mission analytics"
        >
          <span className="hidden sm:inline">Analytics</span>
        </Button>

        <Button
          id="btn-open-architecture-modal"
          variant="neutral"
          size="sm"
          onClick={onOpenArchitecture}
          icon={<BookOpen className="h-3.5 w-3.5" />}
          title="System architecture reference"
        >
          <span className="hidden sm:inline">Architecture</span>
        </Button>
      </div>
    </header>
  );
};
