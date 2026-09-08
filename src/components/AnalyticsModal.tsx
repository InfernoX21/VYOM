import React from 'react';
import { SimulationState } from '../simulation/simulationEngine';
import { AAVTelemetry } from '../types/slam';
import { BarChart3, Info } from 'lucide-react';
import { Modal } from './ui/Modal';
import { MetricTile, SectionLabel, ProgressBar, StatusBadge } from './ui/Panel';
import type { CoverageMetrics } from './Global3DMap';
import {
  FUSION_STAGE_LABEL,
  FUSION_STAGE_TONE,
  MISSION_STATUS_LABEL,
  MISSION_STATUS_TONE,
  formatCount,
  formatMissionTime,
} from '../design/labels';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  simState: SimulationState;
  /** Coverage measured by the 3D view, so analytics and the map never disagree. */
  coverage: CoverageMetrics | null;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  isOpen,
  onClose,
  simState,
  coverage,
}) => {
  const agentsList = Object.values(simState.agents) as AAVTelemetry[];

  const totalKeyframes = agentsList.reduce((acc, a) => acc + a.keyframesCount, 0);
  const totalLandmarks = agentsList.reduce((acc, a) => acc + a.landmarksCount, 0);
  const totalDistanceMeters = agentsList.reduce((acc, a) => acc + a.trajectory.length * 1.8, 0);
  /** Area comes from the map's occupancy grid so both views quote one figure. */
  const areaMappedSqM = coverage ? coverage.areaMappedM2 : 0;

  const isFused = simState.collabSlam.fusionStage === 'GLOBAL_FUSED';
  const coveragePercent = coverage ? Math.round(coverage.overallPercent) : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-5xl"
      icon={<BarChart3 className="h-4 w-4" />}
      title="Mission analytics"
      subtitle="Collaborative visual SLAM over a 5G edge deployment"
      footer={
        <>
          <span className="text-2xs text-ink-3">
            Figures read live from the simulation telemetry bus.
          </span>
          <div className="flex items-center gap-1.5">
            <StatusBadge
              label={MISSION_STATUS_LABEL[simState.missionStatus]}
              tone={MISSION_STATUS_TONE[simState.missionStatus]}
              dot
            />
            <StatusBadge
              label={FUSION_STAGE_LABEL[simState.collabSlam.fusionStage]}
              tone={FUSION_STAGE_TONE[simState.collabSlam.fusionStage]}
            />
          </div>
        </>
      }
    >
      {/* Simulation provenance */}
      <div className="flex items-start gap-2 rounded border border-line bg-surface-2 px-2.5 py-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />
        <p className="text-2xs leading-relaxed text-ink-3">
          Trajectories, feature correspondences, radio metrics and solver loads come from a
          deterministic testbed modelled on ORB-SLAM3 and COVINS benchmarks. Values represent
          simulated edge-validation conditions, not measurements from hardware.
        </p>
      </div>

      {/* Mission summary */}
      <div className="mt-3">
        <SectionLabel>Mission summary</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
          <MetricTile
            label="Mission time"
            value={formatMissionTime(simState.simTimeSeconds)}
            caption={`Rate ${simState.simSpeed}x`}
          />
          <MetricTile
            label="Distance covered"
            value={(totalDistanceMeters / 1000).toFixed(2)}
            unit="km"
            caption="All three vehicles"
          />
          <MetricTile
            label="Area surveyed"
            value={(areaMappedSqM / 10000).toFixed(2)}
            unit="ha"
            caption={`${formatCount(areaMappedSqM)} m² of occupancy grid`}
          />
          <MetricTile
            label="Map fusion"
            value={isFused ? 'Converged' : `${Math.round(simState.collabSlam.fusionProgress)}%`}
            caption="g2o Levenberg–Marquardt"
            tone={isFused ? 'success' : 'neutral'}
          />
        </div>
      </div>

      {/* Sector coverage — measured by the 3D view */}
      <div className="mt-3">
        <SectionLabel>Sector coverage</SectionLabel>
        {coverage ? (
          <div className="rounded border border-line bg-surface-2 px-2.5 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-2xs text-ink-2">Mapped grid cells</span>
              <span className="telemetry text-sm font-semibold text-ink">{coveragePercent}%</span>
            </div>
            <ProgressBar
              className="mt-1.5"
              value={coveragePercent}
              tone={coveragePercent > 80 ? 'success' : coveragePercent > 40 ? 'warning' : 'neutral'}
              label="Overall sector coverage"
            />
            <div className="mt-1 text-3xs text-ink-4">
              {formatCount(coverage.cellsMapped)} of {formatCount(coverage.cellsTotal)} cells ·{' '}
              {formatCount(coverage.gapCount)} gaps remaining
            </div>

            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {coverage.sectors.map((sector) => (
                <div key={sector.id} className="rounded-sm border border-line bg-surface-1 px-2 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-3xs text-ink-3">Sector {sector.id}</span>
                    <span className="telemetry text-2xs font-semibold text-ink">
                      {Math.round(sector.percent)}%
                    </span>
                  </div>
                  <ProgressBar
                    className="mt-1"
                    height={3}
                    value={sector.percent}
                    tone={sector.percent > 80 ? 'success' : sector.percent > 40 ? 'warning' : 'neutral'}
                    label={`Sector ${sector.id} coverage`}
                  />
                  <div className="mt-1 truncate text-3xs text-ink-4">{sector.assignedAgent}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded border border-line bg-surface-2 px-2.5 py-3 text-center text-2xs text-ink-4">
            Coverage is measured by the 3D view — start the mission to populate it.
          </p>
        )}
      </div>

      {/* Network and edge */}
      <div className="mt-3">
        <SectionLabel>Network and edge compute</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
          <MetricTile
            label="Latency"
            value={simState.network.latencyMs}
            unit="ms"
            caption="5G radio bearer"
            tone={simState.network.latencyMs > 50 ? 'danger' : simState.network.latencyMs > 20 ? 'warning' : 'success'}
          />
          <MetricTile
            label="Throughput"
            value={simState.network.throughputMbps}
            unit="Mbps"
            caption="Aggregate uplink"
          />
          <MetricTile
            label="Packet loss"
            value={`${simState.network.packetLossPercent}%`}
            caption="After retransmission"
            tone={simState.network.packetLossPercent > 1 ? 'warning' : 'success'}
          />
          <MetricTile
            label="Edge utilisation"
            value={`${simState.mec.cpuUsage}% / ${simState.mec.gpuUsage}%`}
            caption="CPU / GPU"
            tone={simState.mec.cpuUsage > 85 || simState.mec.gpuUsage > 90 ? 'warning' : 'neutral'}
            size="sm"
          />
        </div>
      </div>

      {/* Map product */}
      <div className="mt-3">
        <SectionLabel>Map product</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
          <MetricTile
            label="Keyframes"
            value={formatCount(totalKeyframes)}
            caption="Graph vertices"
          />
          <MetricTile
            label="Landmarks"
            value={formatCount(totalLandmarks)}
            caption="Triangulated 3D points"
          />
          <MetricTile
            label="Shared landmarks"
            value={formatCount(simState.collabSlam.sharedLandmarksCount)}
            caption="Matched across agents"
          />
          <MetricTile
            label="Loop closures"
            value={formatCount(simState.collabSlam.loopClosuresDetected)}
            caption="Inter-agent constraints"
          />
        </div>
      </div>

      {/* Per-agent breakdown */}
      <div className="mt-3">
        <SectionLabel>Per-vehicle breakdown</SectionLabel>
        <div className="overflow-x-auto rounded border border-line bg-surface-2">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-line text-3xs text-ink-3">
                <th className="px-2 py-1.5 font-medium">Callsign</th>
                <th className="px-2 py-1.5 font-medium">Sector</th>
                <th className="px-2 py-1.5 font-medium">Keyframes</th>
                <th className="px-2 py-1.5 font-medium">Landmarks</th>
                <th className="px-2 py-1.5 font-medium">Battery</th>
                <th className="px-2 py-1.5 font-medium">Drift RMSE</th>
                <th className="px-2 py-1.5 font-medium">Uplink</th>
              </tr>
            </thead>
            <tbody>
              {agentsList.map((a) => (
                <tr key={a.id} className="border-b border-line last:border-0">
                  <td className="px-2 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: a.color }}
                      />
                      <span className="telemetry text-2xs font-semibold text-ink">{a.callsign}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-2xs text-ink-2">{a.sector}</td>
                  <td className="telemetry px-2 py-1.5 text-2xs text-ink">
                    {formatCount(a.keyframesCount)}
                  </td>
                  <td className="telemetry px-2 py-1.5 text-2xs text-ink">
                    {formatCount(a.landmarksCount)}
                  </td>
                  <td className="telemetry px-2 py-1.5 text-2xs text-ink">
                    {Math.round(a.battery)}%
                  </td>
                  <td className="telemetry px-2 py-1.5 text-2xs text-ink">
                    {a.visualOdometryDrift.toFixed(1)} cm
                  </td>
                  <td className="telemetry px-2 py-1.5 text-2xs text-ink">
                    {a.uplinkRateMbps} Mbps
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};
