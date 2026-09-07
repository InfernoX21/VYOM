import React from 'react';
import { NetworkMetrics } from '../types/slam';
import { Wifi, ArrowDownUp, AlertTriangle, CheckCircle, ShieldCheck } from 'lucide-react';
import { LatencyHistogram } from './LatencyHistogram';

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
  return (
    <div className="bg-black border border-zinc-800 rounded-sm p-3 flex flex-col gap-2.5 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <Wifi className={`w-4 h-4 ${isStressTest ? 'text-amber-400 animate-pulse' : 'text-cyan-400'}`} />
          <h2 className="text-xs font-semibold font-sans text-zinc-100">
            5G Network
          </h2>
        </div>
        <div className="flex items-center gap-1.5 font-sans">
          <span className="text-[10px] px-1.5 py-0.5 rounded-xs bg-zinc-900 text-zinc-300 border border-zinc-700 font-medium">
            {network.sliceType}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-xs font-semibold border ${
              isStressTest
                ? 'bg-amber-950 text-amber-300 border-amber-700 animate-pulse'
                : 'bg-emerald-950 text-emerald-300 border-emerald-700'
            }`}
          >
            {isStressTest ? 'Degraded' : 'Optimal'}
          </span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="bg-zinc-950 p-2.5 rounded-xs border border-zinc-800 space-y-2 font-sans">
        <div className="flex items-center justify-between text-[11px] pb-1 border-b border-zinc-900">
          <span className="text-zinc-400 font-medium">5G Link Status</span>
          <span className="text-cyan-400 font-medium">Active (gNodeB-01)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {/* Latency */}
          <div className="bg-zinc-900/90 p-2 rounded-xs border border-zinc-800">
            <span className="text-[10px] text-zinc-400 font-medium block mb-0.5">Latency</span>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-base font-semibold font-mono tabular-nums ${
                  network.latencyMs > 50 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {network.latencyMs}
              </span>
              <span className="text-[10px] text-zinc-400 font-sans">ms</span>
            </div>
            <span className="text-[9px] text-zinc-500 font-sans">Target: &lt;20ms URLLC</span>
          </div>

          {/* Throughput */}
          <div className="bg-zinc-900/90 p-2 rounded-xs border border-zinc-800">
            <span className="text-[10px] text-zinc-400 font-medium block mb-0.5">Throughput</span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-semibold font-mono tabular-nums text-cyan-300">
                {network.throughputMbps}
              </span>
              <span className="text-[10px] text-zinc-400 font-sans">Mbps</span>
            </div>
            <span className="text-[9px] text-zinc-500 font-sans">Submap Stream Rate</span>
          </div>

          {/* Packet Loss */}
          <div className="bg-zinc-900/90 p-2 rounded-xs border border-zinc-800">
            <span className="text-[10px] text-zinc-400 font-medium block mb-0.5">Packet Loss</span>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-base font-semibold font-mono tabular-nums ${
                  network.packetLossPercent > 2 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {network.packetLossPercent}%
              </span>
            </div>
            <span className="text-[9px] text-zinc-500 font-sans">HARQ Retransmissions</span>
          </div>

          {/* Jitter */}
          <div className="bg-zinc-900/90 p-2 rounded-xs border border-zinc-800">
            <span className="text-[10px] text-zinc-400 font-medium block mb-0.5">Jitter</span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-semibold font-mono tabular-nums text-zinc-200">
                {network.jitterMs}
              </span>
              <span className="text-[10px] text-zinc-400 font-sans">ms</span>
            </div>
            <span className="text-[9px] text-zinc-500 font-sans">Packet delay var</span>
          </div>

          {/* Signal Quality */}
          <div className="bg-zinc-900/90 p-2 rounded-xs border border-zinc-800">
            <span className="text-[10px] text-zinc-400 font-medium block mb-0.5">Signal Quality</span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-semibold font-mono tabular-nums text-cyan-400">
                {network.signalQualityDbm}
              </span>
              <span className="text-[10px] text-zinc-400 font-sans">dBm</span>
            </div>
            <span className="text-[9px] text-zinc-500 font-sans">SINR: <span className="font-mono tabular-nums">{network.sinrDb}</span> dB</span>
          </div>

          {/* Connected Agents */}
          <div className="bg-zinc-900/90 p-2 rounded-xs border border-zinc-800">
            <span className="text-[10px] text-zinc-400 font-medium block mb-0.5">Connected Agents</span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-semibold font-mono tabular-nums text-emerald-400">
                {network.connectedAgents}/3
              </span>
            </div>
            <span className="text-[9px] text-emerald-400/80 font-sans">3 Active Radios</span>
          </div>
        </div>
      </div>

      {/* Real-time D3 Mini-Histogram: Distribution of Latency Spikes Over Last 60s */}
      <LatencyHistogram
        latencyHistory={network.latencyHistory}
        currentLatency={network.latencyMs}
        isStressTest={isStressTest}
      />

      {/* Network Stress Demo Comparison Card */}
      <div className="bg-zinc-950 p-2 rounded-xs border border-zinc-800 flex items-center justify-between text-[11px] font-sans">
        <div>
          <span className="text-[10px] text-zinc-400 font-medium block">5G Performance Profile</span>
          <div className="flex items-center gap-3 mt-0.5">
            <span className={isStressTest ? 'text-zinc-500' : 'text-emerald-400 font-semibold'}>
              Normal 5G (<span className="font-mono tabular-nums">18 ms</span>)
            </span>
            <span className="text-zinc-600">vs</span>
            <span className={isStressTest ? 'text-amber-400 font-semibold' : 'text-zinc-500'}>
              Stressed (<span className="font-mono tabular-nums">86 ms</span>)
            </span>
          </div>
        </div>
        <button
          id="btn-network-toggle-inline"
          onClick={onToggleStressTest}
          className={`px-2 py-1 rounded-xs border text-[10px] font-semibold transition-colors cursor-pointer ${
            isStressTest
              ? 'bg-amber-900/60 border-amber-500 text-amber-300'
              : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500'
          }`}
        >
          {isStressTest ? 'Restore Normal' : 'Inject Interference'}
        </button>
      </div>

      {/* Packet Stream Telemetry */}
      <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1 font-sans">
        <span>Transmitted Packets: <strong className="font-mono tabular-nums text-zinc-300">{network.totalPacketsTransmitted.toLocaleString()}</strong></span>
        <span>Dropped: <strong className="font-mono tabular-nums text-zinc-300">{network.packetsDropped}</strong></span>
      </div>
    </div>
  );
};
