import React from 'react';
import { CollaborativeSLAMState, AAVTelemetry } from '../types/slam';
import { Network, CheckCircle2, ArrowRight, GitMerge, RefreshCw } from 'lucide-react';

interface CollaborativeSLAMPanelProps {
  collabSlam: CollaborativeSLAMState;
  agents: Record<string, AAVTelemetry>;
  onTriggerFusion: () => void;
  onOpenFusionModal: () => void;
}

export const CollaborativeSLAMPanel: React.FC<CollaborativeSLAMPanelProps> = ({
  collabSlam,
  agents,
  onTriggerFusion,
  onOpenFusionModal,
}) => {
  const isFused = collabSlam.fusionStage === 'GLOBAL_FUSED';
  const isOptimizing = collabSlam.fusionStage !== 'IDLE' && !isFused;

  return (
    <div className="bg-black border border-zinc-800 rounded-sm p-3 flex flex-col gap-2.5 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold font-sans text-zinc-100">
            Collaborative SLAM (COVINS-G)
          </h2>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-xs font-medium font-sans border ${
            isFused
              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
              : isOptimizing
              ? 'bg-yellow-950 text-yellow-300 border-yellow-700 animate-pulse'
              : 'bg-cyan-950 text-cyan-300 border-cyan-700'
          }`}
        >
          {isFused ? 'Global Fusion Complete' : isOptimizing ? 'Solving Pose Graph' : 'Local Submap Aggregation'}
        </span>
      </div>

      {/* Agents Mapping State (Exact prompt requirements) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {['AAV-01', 'AAV-02', 'AAV-03'].map((id) => {
          const agent = agents[id];
          if (!agent) return null;

          return (
            <div
              key={id}
              className="bg-zinc-950 p-2.5 rounded-xs border border-zinc-800 text-xs space-y-1.5 font-sans"
            >
              <div className="flex items-center justify-between border-b border-zinc-900 pb-1">
                <span className="font-semibold text-zinc-100" style={{ color: agent.color }}>
                  {agent.callsign}
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-xs ${
                    agent.localMapStatus === 'READY' || agent.localMapStatus === 'FUSED'
                      ? 'text-emerald-400 bg-emerald-950/60'
                      : 'text-amber-400 bg-amber-950/60'
                  }`}
                >
                  {agent.localMapStatus}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>Local Map:</span>
                <span className="font-semibold text-zinc-200">{agent.localMapStatus}</span>
              </div>
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>Keyframes:</span>
                <span className="font-mono tabular-nums font-semibold text-zinc-100">{agent.keyframesCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>Landmarks:</span>
                <span className="font-mono tabular-nums font-semibold text-cyan-300">{agent.landmarksCount.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Map Fusion Progress & Inter-Agent Overlap Matches */}
      <div className="bg-zinc-950 p-2.5 rounded-xs border border-zinc-800 text-xs space-y-2 font-sans">
        <div className="flex items-center justify-between">
          <span className="text-zinc-300 font-semibold">Map Fusion Status</span>
          <span className="font-mono tabular-nums font-semibold text-cyan-300">
            {isFused ? '100% Unified' : `${Math.round(collabSlam.fusionProgress)}% Complete`}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
          <div
            className={`h-full transition-all duration-300 ${
              isFused
                ? 'bg-emerald-500'
                : isOptimizing
                ? 'bg-yellow-400 animate-pulse'
                : 'bg-cyan-500'
            }`}
            style={{ width: `${Math.max(8, collabSlam.fusionProgress)}%` }}
          />
        </div>

        {/* Inter-Agent Overlap Correspondences */}
        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
          <div className="bg-zinc-900/90 p-1.5 rounded-xs border border-zinc-800 flex justify-between items-center">
            <span className="text-zinc-300">AAV-01 ↔ AAV-02</span>
            <span className="text-emerald-400 font-mono tabular-nums font-semibold">
              {collabSlam.sharedMatches[0] ? `${Math.round(collabSlam.sharedMatches[0].similarityScore * 100)}% Sim` : 'Scanning'}
            </span>
          </div>
          <div className="bg-zinc-900/90 p-1.5 rounded-xs border border-zinc-800 flex justify-between items-center">
            <span className="text-zinc-300">AAV-02 ↔ AAV-03</span>
            <span className="text-emerald-400 font-mono tabular-nums font-semibold">
              {collabSlam.sharedMatches[1] ? `${Math.round(collabSlam.sharedMatches[1].similarityScore * 100)}% Sim` : 'Scanning'}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Architectural Map Fusion ASCII Diagram */}
      <div className="bg-black p-2.5 rounded-xs border border-zinc-800 text-[11px] font-sans text-zinc-300">
        <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1 border-b border-zinc-900 pb-1">
          <span>COVINS-G Multi-Agent Fusion Flow:</span>
          <button
            onClick={onOpenFusionModal}
            className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer font-medium"
          >
            Expand Diagram
          </button>
        </div>
        <pre className="text-[10px] font-mono text-cyan-300 leading-tight select-none overflow-x-auto">
{`Map A (AAV-01) ──┐
Map B (AAV-02) ──┼──> Pose Graph Optimization ──> GLOBAL UNIFIED 3D MAP
Map C (AAV-03) ──┘`}
        </pre>
        <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-2 font-sans">
          <span>Shared Landmarks: <strong className="text-yellow-300 font-mono tabular-nums">{collabSlam.sharedLandmarksCount}</strong></span>
          <span>Alignment Confidence: <strong className="text-emerald-400 font-mono tabular-nums">{collabSlam.alignmentConfidence}%</strong></span>
        </div>
      </div>

      {/* Action Trigger Button */}
      <button
        id="btn-collab-slam-fuse"
        onClick={onTriggerFusion}
        disabled={isFused}
        className={`w-full py-2 px-3 font-semibold font-sans text-xs rounded-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
          isFused
            ? 'bg-emerald-950/80 border-emerald-600 text-emerald-400 cursor-default'
            : isOptimizing
            ? 'bg-yellow-600 text-black border-yellow-400 animate-pulse'
            : 'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
        }`}
      >
        <span>
          {isFused
            ? '3 Local Maps Fused into 1 Global 3D Map'
            : isOptimizing
            ? 'Executing Pose Graph Optimization...'
            : 'Trigger Collaborative Map Fusion'}
        </span>
      </button>
    </div>
  );
};
