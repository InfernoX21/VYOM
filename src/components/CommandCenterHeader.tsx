import React from 'react';
import { SimulationState } from '../simulation/simulationEngine';
import { Scenario } from '../types/slam';
import { SCENARIOS } from '../simulation/scenarios';
import { Play, Pause, BarChart3, BookOpen, Camera, Layers, Radio } from 'lucide-react';
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
    <header className="flex shrink-0 items-center gap-3 border-b border-line bg-surface-1 px-3 py-1.5 overflow-x-auto">
      {/* Identity */}
      <div className="flex shrink-0 items-center gap-2">
        <VyomLogo height={20} />
        <div className="h-5 w-px bg-line" />
        <div className="leading-tight">
          <div className="text-2xs font-semibold text-ink">Collaborative SLAM</div>
          <div className="text-3xs text-ink-3">Multi-AAV mission control</div>
        </div>
      </div>

      <div className="h-5 w-px shrink-0 bg-line" />

      {/* Mission clock + state */}
      <div className="flex shrink-0 items-center gap-2.5 rounded border border-line bg-surface-2 px-2 py-0.5">
        <div className="leading-tight">
          <div className="text-3xs text-ink-3">Mission time</div>
          <div id="mission-clock" className="telemetry text-xs font-semibold text-ink">
            {formatMissionTime(simState.simTimeSeconds)}
          </div>
        </div>
        <div className="h-6 w-px bg-line" />
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

      <div className="h-5 w-px shrink-0 bg-line" />

      {/* Scenario + rate + stress */}
      <div className="flex shrink-0 items-center gap-1.5">
        <label className="flex items-center gap-1 text-2xs text-ink-3">
          Scenario
          <select
            id="scenario-selector"
            value={scenario.id}
            onChange={(e) => onSelectScenario(e.target.value)}
            className="h-6 max-w-[180px] rounded border border-line bg-surface-2 px-1.5 text-2xs text-ink hover:border-line-strong focus:border-primary focus:outline-none"
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Views — right-aligned */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          id="btn-open-camera-modal"
          variant="neutral"
          size="sm"
          onClick={onOpenCameraFeed}
          icon={<Camera className="h-3 w-3" />}
          title="Onboard camera and feature tracking"
        >
          Vision feed
        </Button>

        <Button
          id="btn-open-fusion-pipeline"
          variant="neutral"
          size="sm"
          onClick={onOpenFusionModal}
          icon={<Radio className="h-3 w-3" />}
          title="Map fusion pipeline"
        >
          Fusion pipeline
        </Button>

        <Button
          id="btn-open-analytics-modal"
          variant="neutral"
          size="sm"
          onClick={onOpenAnalytics}
          icon={<BarChart3 className="h-3 w-3" />}
          title="Mission analytics"
        >
          Analytics
        </Button>

        <Button
          id="btn-open-architecture-modal"
          variant="neutral"
          size="sm"
          onClick={onOpenArchitecture}
          icon={<BookOpen className="h-3 w-3" />}
          title="System architecture reference"
        >
          Architecture
        </Button>
      </div>
    </header>
  );
};
