import React from 'react';
import { CollaborativeSLAMState, AAVTelemetry, MissionStatus, FUSION_STAGE_ORDER } from '../types/slam';
import { GitMerge, Check, ExternalLink, Layers } from 'lucide-react';
import { Panel, PanelHeader, StatusBadge, ProgressBar, SectionLabel, DataRow } from './ui/Panel';
import { Button } from './ui/Button';
import {
  FUSION_STAGE_LABEL,
  FUSION_STAGE_SHORT,
  FUSION_STAGE_TONE,
  LOCAL_MAP_LABEL,
  LOCAL_MAP_TONE,
  formatCount,
} from '../design/labels';

interface CollaborativeSLAMPanelProps {
  collabSlam: CollaborativeSLAMState;
  agents: Record<string, AAVTelemetry>;
  missionStatus: MissionStatus;
  onTriggerFusion: () => void;
  onOpenFusionModal: () => void;
}

/** Sector pairs whose overlap yields inter-agent correspondences. */
const PAIRS: [string, string][] = [
  ['AAV-01', 'AAV-02'],
  ['AAV-02', 'AAV-03'],
  ['AAV-03', 'AAV-01'],
];

export const CollaborativeSLAMPanel: React.FC<CollaborativeSLAMPanelProps> = ({
  collabSlam,
  agents,
  missionStatus,
  onTriggerFusion,
  onOpenFusionModal,
}) => {
  const { fusionStage, fusionProgress } = collabSlam;
  const isFused = fusionStage === 'GLOBAL_FUSED';
  const isRunningPipeline = fusionStage !== 'IDLE' && !isFused;
  const currentIndex = FUSION_STAGE_ORDER.indexOf(fusionStage);

  // Stage list excludes IDLE — it is the absence of a pipeline, not a step.
  const steps = FUSION_STAGE_ORDER.slice(1);

  return (
    <Panel>
      <PanelHeader
        icon={<GitMerge className="h-3.5 w-3.5" />}
        title="Collaborative SLAM"
        subtitle="Three local maps to one global map"
        actions={
          <StatusBadge
            label={FUSION_STAGE_LABEL[fusionStage]}
            tone={FUSION_STAGE_TONE[fusionStage]}
            dot
          />
        }
      />

      {/* Per-agent local maps */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {PAIRS.map((p) => p[0])
          .map((id) => agents[id])
          .filter(Boolean)
          .map((agent) => (
            <div key={agent.id} className="tile space-y-1 px-2.5 py-2">
              <div className="flex items-center justify-between gap-1.5 border-b border-line pb-1.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: agent.color }}
                  />
                  <span className="telemetry text-2xs font-semibold text-ink">
                    {agent.callsign}
                  </span>
                </span>
                <StatusBadge
                  label={LOCAL_MAP_LABEL[agent.localMapStatus]}
                  tone={LOCAL_MAP_TONE[agent.localMapStatus]}
                />
              </div>
              <DataRow label="Keyframes" value={formatCount(agent.keyframesCount)} />
              <DataRow label="Landmarks" value={formatCount(agent.landmarksCount)} />
            </div>
          ))}
      </div>

      {/* Pipeline progress */}
      <div className="mt-3 rounded border border-line bg-surface-2 px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xs font-medium text-ink-2">
            {isFused ? 'Unified map published' : FUSION_STAGE_LABEL[fusionStage]}
          </span>
          <span className="telemetry text-2xs font-semibold text-ink">
            {Math.round(fusionProgress)}%
          </span>
        </div>

        <ProgressBar
          className="mt-1.5"
          value={fusionProgress}
          tone={isFused ? 'success' : isRunningPipeline ? 'warning' : 'neutral'}
          label="Map fusion progress"
        />

        {/* Stage checklist — makes the sequence legible, not just a bar. */}
        <ol className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {steps.map((stage) => {
            const index = FUSION_STAGE_ORDER.indexOf(stage);
            const done = currentIndex > index || isFused;
            const active = currentIndex === index && !isFused;
            return (
              <li
                key={stage}
                className={`flex items-center gap-1.5 text-3xs ${
                  done ? 'text-success-ink' : active ? 'text-warning-ink' : 'text-ink-4'
                }`}
              >
                <span
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
                    done
                      ? 'border-success-line bg-success-dim'
                      : active
                      ? 'border-warning-line bg-warning-dim'
                      : 'border-line bg-surface-3'
                  }`}
                >
                  {done && <Check className="h-2.5 w-2.5" />}
                </span>
                {FUSION_STAGE_SHORT[stage]}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Inter-agent correspondences */}
      <div className="mt-3">
        <SectionLabel>Inter-agent correspondences</SectionLabel>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {PAIRS.map(([a, b], i) => {
            const match = collabSlam.sharedMatches[i];
            return (
              <div
                key={`${a}-${b}`}
                className="tile flex items-center justify-between gap-2 px-2 py-1.5"
              >
                <span className="telemetry text-3xs text-ink-2">
                  {a} / {b}
                </span>
                <span
                  className={`telemetry text-3xs font-semibold ${
                    match ? 'text-success-ink' : 'text-ink-4'
                  }`}
                >
                  {match ? `${Math.round(match.similarityScore * 100)}%` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Aggregate fusion metrics */}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <div className="tile px-2 py-1.5">
          <div className="text-3xs text-ink-3">Shared landmarks</div>
          <div className="telemetry text-2xs font-semibold text-ink">
            {formatCount(collabSlam.sharedLandmarksCount)}
          </div>
        </div>
        <div className="tile px-2 py-1.5">
          <div className="text-3xs text-ink-3">Alignment confidence</div>
          <div className="telemetry text-2xs font-semibold text-ink">
            {collabSlam.alignmentConfidence}%
          </div>
        </div>
      </div>

      {missionStatus === 'PAUSED' && (
        <p className="mt-2 text-3xs text-danger-ink">
          Mission paused — fusion resumes with the simulation clock.
        </p>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-1.5">
        <Button
          id="btn-collab-slam-fuse"
          variant="primary"
          className="flex-1"
          disabled={isFused}
          onClick={onTriggerFusion}
          icon={<Layers className="h-3.5 w-3.5" />}
        >
          {isFused
            ? 'Maps fused'
            : isRunningPipeline
            ? `Fusing — ${FUSION_STAGE_SHORT[fusionStage]}`
            : 'Fuse maps'}
        </Button>
        <Button
          variant="neutral"
          onClick={onOpenFusionModal}
          icon={<ExternalLink className="h-3.5 w-3.5" />}
          title="Open the fusion pipeline view"
        >
          Pipeline
        </Button>
      </div>
    </Panel>
  );
};
