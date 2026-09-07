import React from 'react';
import { MECMetrics } from '../types/slam';
import { Server, Cpu, HardDrive, Layers, Network, Activity } from 'lucide-react';
import { MECProcessingLoadChart } from './MECProcessingLoadChart';

interface MECPanelProps {
  mec: MECMetrics;
  isFusing: boolean;
}

export const MECPanel: React.FC<MECPanelProps> = ({ mec, isFusing }) => {
  return (
    <div className="bg-black border border-zinc-800 rounded-sm p-3 flex flex-col gap-2.5 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-semibold font-sans text-zinc-100">
            MEC (Edge Computing) Node
          </h2>
        </div>
        <div className="flex items-center gap-2 font-sans">
          <span className="text-[10px] text-zinc-400 font-medium">Edge Server:</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-xs font-semibold border ${
              mec.status === 'OPTIMIZING'
                ? 'bg-yellow-950 text-yellow-300 border-yellow-700 animate-pulse'
                : 'bg-emerald-950 text-emerald-300 border-emerald-700'
            }`}
          >
            MEC Status: {mec.status}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-sans">
        {/* CPU Usage */}
        <div className="bg-zinc-950 p-2.5 rounded-xs border border-zinc-800">
          <div className="flex justify-between items-center text-[10px] text-zinc-400 font-medium mb-1">
            <span>CPU Usage</span>
            <span className="font-mono tabular-nums font-semibold text-zinc-200">{mec.cpuUsage}%</span>
          </div>
          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                mec.cpuUsage > 75 ? 'bg-amber-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${mec.cpuUsage}%` }}
            />
          </div>
          <span className="text-[9px] text-zinc-500 block mt-1">64-Core AMD EPYC Edge</span>
        </div>

        {/* GPU Usage */}
        <div className="bg-zinc-950 p-2.5 rounded-xs border border-zinc-800">
          <div className="flex justify-between items-center text-[10px] text-zinc-400 font-medium mb-1">
            <span>GPU Usage</span>
            <span className="font-mono tabular-nums font-semibold text-zinc-200">{mec.gpuUsage}%</span>
          </div>
          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                mec.gpuUsage > 80 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${mec.gpuUsage}%` }}
            />
          </div>
          <span className="text-[9px] text-zinc-500 block mt-1">NVIDIA RTX Edge Tensor</span>
        </div>

        {/* Memory */}
        <div className="bg-zinc-950 p-2.5 rounded-xs border border-zinc-800">
          <div className="flex justify-between items-center text-[10px] text-zinc-400 font-medium mb-1">
            <span>Memory</span>
            <span className="font-mono tabular-nums font-semibold text-zinc-200">{mec.memoryGb} GB</span>
          </div>
          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${(mec.memoryGb / mec.totalMemoryGb) * 100}%` }}
            />
          </div>
          <span className="text-[9px] text-zinc-500 block mt-1">32.0 GB ECC Allocation</span>
        </div>

        {/* SLAM Processing Load */}
        <div className="bg-zinc-950 p-2.5 rounded-xs border border-zinc-800">
          <span className="text-[10px] text-zinc-400 font-medium block mb-0.5">SLAM Processing</span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold text-cyan-300">
              {mec.slamProcessingLoad > 0 ? 'Active' : 'Idle'}
            </span>
            <span className="text-[10px] font-mono tabular-nums text-zinc-400">({mec.slamProcessingLoad}%)</span>
          </div>
          <span className="text-[9px] text-zinc-500">DBoW2 Vocabulary Tree</span>
        </div>

        {/* Map Fusion Load */}
        <div className="bg-zinc-950 p-2.5 rounded-xs border border-zinc-800">
          <span className="text-[10px] text-zinc-400 font-medium block mb-0.5">Map Fusion Load</span>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-sm font-semibold ${
                isFusing || mec.mapFusionLoad > 0 ? 'text-amber-400' : 'text-zinc-400'
              }`}
            >
              {isFusing || mec.mapFusionLoad > 0 ? 'Active' : 'Standby'}
            </span>
            <span className="text-[10px] font-mono tabular-nums text-zinc-400">({mec.mapFusionLoad}%)</span>
          </div>
          <span className="text-[9px] text-zinc-500">Pose Graph Solver (g2o)</span>
        </div>

        {/* Active Agents */}
        <div className="bg-zinc-950 p-2.5 rounded-xs border border-zinc-800">
          <span className="text-[10px] text-zinc-400 font-medium block mb-0.5">Active Agents</span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold text-emerald-400">
              <span className="font-mono tabular-nums">{mec.activeAgents}</span> Synchronized
            </span>
          </div>
          <span className="text-[9px] text-zinc-500">AAV-01, AAV-02, AAV-03</span>
        </div>
      </div>

      {/* Real-Time Recharts Line Chart: SLAM Processing Load Trend & Bottleneck Detection */}
      <MECProcessingLoadChart
        loadHistory={mec.loadHistory}
        currentLoad={mec.slamProcessingLoad}
        peakLoad={mec.peakLoad}
        isFusing={isFusing}
      />

      {/* Backend Pose Graph Sub-engine Stats */}
      <div className="bg-black p-2 rounded-xs border border-zinc-800 flex flex-wrap items-center justify-between text-[10px] text-zinc-400 font-sans">
        <div>
          <span>Graph Nodes (Keyframes): </span>
          <span className="text-zinc-200 font-mono tabular-nums font-semibold">{mec.poseGraphNodes.toLocaleString()}</span>
        </div>
        <div>
          <span>Graph Edges (Covisibility): </span>
          <span className="text-cyan-300 font-mono tabular-nums font-semibold">{mec.poseGraphEdges.toLocaleString()}</span>
        </div>
        <div>
          <span>Solver Residual (Chi2): </span>
          <span className="text-emerald-400 font-mono tabular-nums font-semibold">{mec.chi2Error.toFixed(4)} m</span>
        </div>
      </div>
    </div>
  );
};
