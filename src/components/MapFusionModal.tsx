import React from 'react';
import {
  CollaborativeSLAMState,
  AAVTelemetry,
  MECMetrics,
  NetworkMetrics,
  FUSION_STAGE_ORDER,
} from '../types/slam';
import { Radio, Cpu, Layers, Check, ArrowRight, Navigation } from 'lucide-react';
import { Modal } from './ui/Modal';
import { StatusBadge, ProgressBar, SectionLabel, DataRow, MetricTile } from './ui/Panel';
import { Button } from './ui/Button';
import {
  FUSION_STAGE_LABEL,
  FUSION_STAGE_SHORT,
  FUSION_STAGE_TONE,
  LOCAL_MAP_LABEL,
  LOCAL_MAP_TONE,
  formatCount,
} from '../design/labels';

interface MapFusionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collabSlam: CollaborativeSLAMState;
  agents: Record<string, AAVTelemetry>;
  mec: MECMetrics;
  network: NetworkMetrics;
  onTriggerFusion: () => void;
}

/** Sector-boundary description for each overlapping pair. */
const PAIR_REGION: Record<string, string> = {
  'AAV-01/AAV-02': 'Alpha / Bravo boundary',
  'AAV-02/AAV-03': 'Bravo / Charlie boundary',
  'AAV-03/AAV-01': 'Charlie / Alpha boundary',
};

export const MapFusionModal: React.FC<MapFusionModalProps> = ({
  isOpen,
  onClose,
  collabSlam,
  agents,
  mec,
  network,
  onTriggerFusion,
}) => {
  const { fusionStage, fusionProgress } = collabSlam;
  const isFused = fusionStage === 'GLOBAL_FUSED';
  const isRunningPipeline = fusionStage !== 'IDLE' && !isFused;
  const currentIndex = FUSION_STAGE_ORDER.indexOf(fusionStage);
  const steps = FUSION_STAGE_ORDER.slice(1);

  const agentList = Object.values(agents) as AAVTelemetry[];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-5xl"
      icon={<Radio className="h-4 w-4" />}
      title="Map fusion pipeline"
      subtitle="COVINS-G server: inter-agent loop closure and pose-graph optimisation"
      footer={
        <>
          <span className="min-w-0 truncate text-2xs text-ink-3">
            {isFused
              ? 'Unified map solved and held in the global map store.'
              : 'Runs non-linear least-squares optimisation across the three local maps.'}
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="neutral" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              id="btn-modal-trigger-fusion"
              variant="primary"
              size="sm"
              disabled={isFused}
              onClick={onTriggerFusion}
              icon={<Layers className="h-3.5 w-3.5" />}
            >
              {isFused
                ? 'Maps fused'
                : isRunningPipeline
                ? `Fusing — ${FUSION_STAGE_SHORT[fusionStage]}`
                : 'Run map fusion'}
            </Button>
          </div>
        </>
      }
    >
      {/* Stage progress */}
      <div className="rounded-lg border border-white/15 bg-surface-2/50 backdrop-blur-md px-3 py-2.5 shadow-md">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs font-semibold text-ink">
              {FUSION_STAGE_LABEL[fusionStage]}
            </span>
            <StatusBadge
              label={isFused ? 'Complete' : isRunningPipeline ? 'Running' : 'Standby'}
              tone={FUSION_STAGE_TONE[fusionStage]}
              dot
            />
          </div>
          <span className="telemetry text-sm font-semibold text-ink">
            {Math.round(fusionProgress)}%
          </span>
        </div>

        <ProgressBar
          className="mt-2"
          height={6}
          value={fusionProgress}
          tone={isFused ? 'success' : isRunningPipeline ? 'warning' : 'neutral'}
          label="Map fusion progress"
        />

        <ol className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {steps.map((stage) => {
            const index = FUSION_STAGE_ORDER.indexOf(stage);
            const done = currentIndex > index || isFused;
            const active = currentIndex === index && !isFused;
            return (
              <li
                key={stage}
                className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-3xs transition-all ${
                  done
                    ? 'border-success-line bg-success-dim/80 backdrop-blur-sm text-success-ink'
                    : active
                    ? 'border-warning-line bg-warning-dim/80 backdrop-blur-sm text-warning-ink animate-pulse'
                    : 'border-white/10 bg-surface-1/50 backdrop-blur-sm text-ink-4'
                }`}
              >
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  {done ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span className="truncate">{FUSION_STAGE_SHORT[stage]}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Data path: onboard SLAM -> 5G -> edge -> unified map */}
      <div className="mt-3">
        <SectionLabel>Data and computation path</SectionLabel>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          {/* 1. Onboard SLAM */}
          <div className="tile flex flex-col gap-1.5 px-2.5 py-2">
            <div className="flex items-center gap-1.5 border-b border-line pb-1.5">
              <Navigation className="h-3 w-3 shrink-0 text-ink-3" />
              <span className="text-2xs font-medium text-ink-2">1. Onboard SLAM</span>
            </div>
            <div className="space-y-1">
              {agentList.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: agent.color }}
                    />
                    <span className="telemetry truncate text-3xs text-ink-2">{agent.callsign}</span>
                  </span>
                  <StatusBadge
                    label={LOCAL_MAP_LABEL[agent.localMapStatus]}
                    tone={LOCAL_MAP_TONE[agent.localMapStatus]}
                  />
                </div>
              ))}
            </div>
            <p className="text-3xs leading-snug text-ink-4">
              Stereo visual-inertial tracking and keyframe selection run on each vehicle.
            </p>
          </div>

          {/* 2. 5G transport */}
          <div className="tile flex flex-col gap-1.5 px-2.5 py-2">
            <div className="flex items-center gap-1.5 border-b border-line pb-1.5">
              <Radio className="h-3 w-3 shrink-0 text-ink-3" />
              <span className="text-2xs font-medium text-ink-2">2. 5G transport</span>
            </div>
            <div className="space-y-1">
              <DataRow
                label="Latency"
                value={`${network.latencyMs} ms`}
                tone={network.latencyMs > 50 ? 'danger' : network.latencyMs > 20 ? 'warning' : 'success'}
              />
              <DataRow label="Slice" value={network.sliceType} prose />
              <DataRow
                label="Packet loss"
                value={`${network.packetLossPercent}%`}
                tone={network.packetLossPercent > 1 ? 'warning' : 'success'}
              />
              <DataRow label="Uplink" value={`${network.throughputMbps} Mbps`} />
            </div>
            <p className="text-3xs leading-snug text-ink-4">
              Compressed keyframe packets travel to the edge base station over the URLLC slice.
            </p>
          </div>

          {/* 3. Edge optimiser */}
          <div className="tile flex flex-col gap-1.5 px-2.5 py-2">
            <div className="flex items-center gap-1.5 border-b border-line pb-1.5">
              <Cpu className="h-3 w-3 shrink-0 text-ink-3" />
              <span className="text-2xs font-medium text-ink-2">3. Edge optimiser</span>
            </div>
            <div className="space-y-1">
              <DataRow label="Place recognition" value="DBoW2 tree" prose />
              <DataRow label="Solver" value="g2o Levenberg–Marquardt" prose />
              <DataRow label="Residual (χ²)" value={`${mec.chi2Error.toFixed(4)} m`} />
              <DataRow label="Iterations" value={formatCount(mec.optimizationIterations)} />
            </div>
            <p className="text-3xs leading-snug text-ink-4">
              Inter-agent loop closures and SE(3) pose-graph relaxation across all submaps.
            </p>
          </div>

          {/* 4. Unified map */}
          <div
            className={`flex flex-col gap-1.5 rounded border px-2.5 py-2 ${
              isFused ? 'border-success-line bg-success-dim' : 'border-line bg-surface-2'
            }`}
          >
            <div className="flex items-center gap-1.5 border-b border-line pb-1.5">
              <Layers className="h-3 w-3 shrink-0 text-ink-3" />
              <span className="text-2xs font-medium text-ink-2">4. Unified map</span>
            </div>
            <div className="space-y-1">
              <DataRow label="Landmarks" value={formatCount(collabSlam.globalLandmarksTotal)} />
              <DataRow label="Keyframes" value={formatCount(collabSlam.globalKeyframesTotal)} />
              <DataRow
                label="Confidence"
                value={`${collabSlam.alignmentConfidence}%`}
                tone={isFused ? 'success' : 'neutral'}
              />
              <DataRow label="Loop closures" value={formatCount(collabSlam.loopClosuresDetected)} />
            </div>
            <p className="text-3xs leading-snug text-ink-4">
              One metric global map for joint planning and path finding.
            </p>
          </div>
        </div>
      </div>

      {/* Correspondences */}
      <div className="mt-3">
        <SectionLabel>Inter-agent visual correspondences</SectionLabel>
        {collabSlam.sharedMatches.length === 0 ? (
          <p className="rounded border border-line bg-surface-2 px-2.5 py-3 text-center text-2xs text-ink-4">
            No correspondences yet — they appear once landmark matching runs.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {collabSlam.sharedMatches.map((match) => {
              const key = `${match.sourceAgentId}/${match.targetAgentId}`;
              const dx = match.targetLandmarkPos.x - match.sourceLandmarkPos.x;
              const dy = match.targetLandmarkPos.y - match.sourceLandmarkPos.y;
              const dz = match.targetLandmarkPos.z - match.sourceLandmarkPos.z;
              return (
                <div key={match.id} className="tile space-y-1.5 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2 border-b border-line pb-1.5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="telemetry text-2xs font-semibold text-ink">
                        {match.sourceAgentId}
                      </span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-ink-4" />
                      <span className="telemetry text-2xs font-semibold text-ink">
                        {match.targetAgentId}
                      </span>
                    </span>
                    <StatusBadge
                      label={`${Math.round(match.similarityScore * 100)}% match`}
                      tone={match.similarityScore > 0.85 ? 'success' : 'warning'}
                    />
                  </div>
                  <div className="text-3xs text-ink-3">{PAIR_REGION[key] ?? 'Shared overlap'}</div>
                  <DataRow
                    label="SE(3) translation"
                    value={`${dx.toFixed(1)}, ${dy.toFixed(1)}, ${dz.toFixed(1)} m`}
                  />
                  <DataRow
                    label="Residual"
                    value={`${match.residualErrorMeters.toFixed(3)} m`}
                    tone={match.residualErrorMeters > 0.5 ? 'warning' : 'success'}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Aggregate */}
      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <MetricTile
          label="Shared landmarks"
          value={formatCount(collabSlam.sharedLandmarksCount)}
          caption="Matched across agents"
          size="sm"
        />
        <MetricTile
          label="Graph nodes"
          value={formatCount(mec.poseGraphNodes)}
          caption="Keyframe vertices"
          size="sm"
        />
        <MetricTile
          label="Graph edges"
          value={formatCount(mec.poseGraphEdges)}
          caption="Covisibility constraints"
          size="sm"
        />
        <MetricTile
          label="Relative pose"
          value={collabSlam.relativePoseEstimated ? 'Estimated' : 'Pending'}
          caption="Agent-to-agent transform"
          tone={collabSlam.relativePoseEstimated ? 'success' : 'neutral'}
          size="sm"
        />
      </div>
    </Modal>
  );
};
