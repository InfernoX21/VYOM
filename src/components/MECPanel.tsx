import React from 'react';
import { MECMetrics } from '../types/slam';
import { Server } from 'lucide-react';
import { MECProcessingLoadChart } from './MECProcessingLoadChart';
import { Panel, PanelHeader, StatusBadge, MetricTile, ProgressBar, DataRow } from './ui/Panel';
import { MEC_STATUS_LABEL, MEC_STATUS_TONE, formatCount } from '../design/labels';
import type { Tone } from '../design/tokens';

interface MECPanelProps {
  mec: MECMetrics;
  isFusing: boolean;
}

/** Utilisation gauge: label, telemetry value, rail. */
const Gauge: React.FC<{
  label: string;
  value: string;
  percent: number;
  caption: string;
  tone: Tone;
}> = ({ label, value, percent, caption, tone }) => (
  <div className="tile px-2.5 py-2">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-3xs text-ink-3">{label}</span>
      <span className="telemetry text-2xs font-semibold text-ink">{value}</span>
    </div>
    <ProgressBar className="mt-1.5" value={percent} tone={tone} label={`${label} utilisation`} />
    <div className="mt-1 truncate text-3xs text-ink-4">{caption}</div>
  </div>
);

export const MECPanel: React.FC<MECPanelProps> = ({ mec, isFusing }) => {
  const cpuTone: Tone = mec.cpuUsage > 90 ? 'danger' : mec.cpuUsage > 75 ? 'warning' : 'success';
  const gpuTone: Tone = mec.gpuUsage > 92 ? 'danger' : mec.gpuUsage > 80 ? 'warning' : 'success';
  const memPercent = (mec.memoryGb / mec.totalMemoryGb) * 100;
  const memTone: Tone = memPercent > 90 ? 'danger' : memPercent > 75 ? 'warning' : 'success';
  const fusionActive = isFusing || mec.mapFusionLoad > 0;

  return (
    <Panel>
      <PanelHeader
        icon={<Server className="h-3.5 w-3.5" />}
        title="Edge compute"
        subtitle="MEC node at gNodeB-01"
        actions={
          <StatusBadge label={MEC_STATUS_LABEL[mec.status]} tone={MEC_STATUS_TONE[mec.status]} dot />
        }
      />

      {/* Hardware utilisation */}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        <Gauge
          label="CPU"
          value={`${mec.cpuUsage}%`}
          percent={mec.cpuUsage}
          caption="64-core EPYC"
          tone={cpuTone}
        />
        <Gauge
          label="GPU"
          value={`${mec.gpuUsage}%`}
          percent={mec.gpuUsage}
          caption="RTX tensor cores"
          tone={gpuTone}
        />
        <Gauge
          label="Memory"
          value={`${mec.memoryGb} / ${mec.totalMemoryGb} GB`}
          percent={memPercent}
          caption="ECC allocation"
          tone={memTone}
        />
      </div>

      {/* Workloads */}
      <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        <MetricTile
          label="SLAM processing"
          value={mec.slamProcessingLoad > 0 ? 'Active' : 'Idle'}
          unit={`${mec.slamProcessingLoad}%`}
          caption="DBoW2 vocabulary tree"
          tone={mec.slamProcessingLoad > 0 ? 'success' : 'neutral'}
          size="sm"
        />
        <MetricTile
          label="Map fusion"
          value={fusionActive ? 'Active' : 'Standby'}
          unit={`${mec.mapFusionLoad}%`}
          caption="Pose graph solver (g2o)"
          tone={fusionActive ? 'warning' : 'neutral'}
          size="sm"
        />
        <MetricTile
          label="Synchronised AAVs"
          value={mec.activeAgents}
          unit="of 3"
          caption="AAV-01, AAV-02, AAV-03"
          tone={mec.activeAgents === 3 ? 'success' : 'danger'}
          size="sm"
        />
      </div>

      <div className="mt-3">
        <MECProcessingLoadChart
          loadHistory={mec.loadHistory}
          currentLoad={mec.slamProcessingLoad}
          peakLoad={mec.peakLoad}
          isFusing={isFusing}
        />
      </div>

      {/* Pose-graph backend */}
      <div className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-3">
        <DataRow label="Graph nodes" value={formatCount(mec.poseGraphNodes)} />
        <DataRow label="Graph edges" value={formatCount(mec.poseGraphEdges)} />
        <DataRow label="Residual (χ²)" value={`${mec.chi2Error.toFixed(4)} m`} />
      </div>
    </Panel>
  );
};
