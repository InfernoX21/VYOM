import React from 'react';
import { NetworkMetrics } from '../types/slam';
import { Wifi } from 'lucide-react';
import { LatencyHistogram } from './LatencyHistogram';
import { Panel, PanelHeader, StatusBadge, MetricTile, DataRow } from './ui/Panel';
import { Button } from './ui/Button';
import { formatCount } from '../design/labels';

interface NetworkPanelProps {
  network: NetworkMetrics;
  isStressTest: boolean;
  onToggleStressTest: () => void;
}

export const NetworkPanel: React.FC<NetworkPanelProps> = ({
  network,
  isStressTest,
  onToggleStressTest,
}) => {
  const latencyTone =
    network.latencyMs > 50 ? 'danger' : network.latencyMs > 20 ? 'warning' : 'success';
  const lossTone =
    network.packetLossPercent > 2 ? 'danger' : network.packetLossPercent > 1 ? 'warning' : 'success';

  return (
    <Panel>
      <PanelHeader
        icon={<Wifi className="h-3.5 w-3.5" />}
        title="5G Network"
        subtitle={network.sliceType}
        actions={
          <StatusBadge
            label={isStressTest ? 'Degraded' : 'Nominal'}
            tone={isStressTest ? 'danger' : 'success'}
            dot
          />
        }
      />

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <MetricTile
          label="Latency"
          value={network.latencyMs}
          unit="ms"
          caption="URLLC target < 20 ms"
          tone={latencyTone}
        />
        <MetricTile
          label="Throughput"
          value={network.throughputMbps}
          unit="Mbps"
          caption="Uplink to edge"
        />
        <MetricTile
          label="Packet loss"
          value={`${network.packetLossPercent}%`}
          caption="After retransmission"
          tone={lossTone}
        />
        <MetricTile label="Jitter" value={network.jitterMs} unit="ms" caption="Delay variation" />
        <MetricTile
          label="Signal"
          value={network.signalQualityDbm}
          unit="dBm"
          caption={`SINR ${network.sinrDb} dB`}
        />
        <MetricTile
          label="Linked AAVs"
          value={`${network.connectedAgents}/3`}
          caption="Active radios"
          tone={network.connectedAgents === 3 ? 'success' : 'danger'}
        />
      </div>

      <div className="mt-3">
        <LatencyHistogram
          latencyHistory={network.latencyHistory}
          currentLatency={network.latencyMs}
          isStressTest={isStressTest}
        />
      </div>

      {/* Interference control — the same action as the header toggle. */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded border border-line bg-surface-2 px-2.5 py-2">
        <div className="min-w-0">
          <div className="text-2xs font-medium text-ink-2">Link profile</div>
          <div className="mt-0.5 flex items-center gap-2 text-3xs">
            <span className={isStressTest ? 'text-ink-4' : 'font-semibold text-success-ink'}>
              Nominal <span className="telemetry">18 ms</span>
            </span>
            <span className="text-ink-4">/</span>
            <span className={isStressTest ? 'font-semibold text-danger-ink' : 'text-ink-4'}>
              Interference <span className="telemetry">86 ms</span>
            </span>
          </div>
        </div>
        <Button
          id="btn-network-toggle-inline"
          size="sm"
          variant={isStressTest ? 'danger' : 'neutral'}
          onClick={onToggleStressTest}
        >
          {isStressTest ? 'Restore link' : 'Inject interference'}
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4">
        <DataRow label="Packets sent" value={formatCount(network.totalPacketsTransmitted)} />
        <DataRow label="Packets dropped" value={formatCount(network.packetsDropped)} />
      </div>
    </Panel>
  );
};
