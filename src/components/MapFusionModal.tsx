import React from 'react';
import { CollaborativeSLAMState, AAVTelemetry, MECMetrics } from '../types/slam';
import { X, CheckCircle2, ArrowRight, GitMerge, Cpu, Layers, Radio } from 'lucide-react';

interface MapFusionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collabSlam: CollaborativeSLAMState;
  agents: Record<string, AAVTelemetry>;
  mec: MECMetrics;
  onTriggerFusion: () => void;
}

export const MapFusionModal: React.FC<MapFusionModalProps> = ({
  isOpen,
  onClose,
  collabSlam,
  agents,
  mec,
  onTriggerFusion,
}) => {
  if (!isOpen) return null;

  const isFused = collabSlam.fusionStage === 'GLOBAL_FUSED';
  const isOptimizing = collabSlam.fusionStage !== 'IDLE' && !isFused;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 font-sans antialiased select-none">
      <div className="bg-zinc-950 border border-zinc-800 rounded-sm w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-black">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-yellow-400" />
            <div>
              <h2 className="text-base font-semibold font-sans text-zinc-100">
                Collaborative Map Fusion Pipeline
              </h2>
              <p className="text-[11px] text-zinc-400 font-sans">
                COVINS-G Server Centralized Pose Graph Optimization & Loop Closure
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Climax Architectural Flow (Exact Prompt Diagram) */}
        <div className="bg-zinc-950 p-4 rounded-xs border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-bold text-cyan-300">DATA & COMPUTATION FLOW PIPELINE:</span>
            <span className="text-[11px] text-zinc-400">
              {isFused ? 'STATUS: UNIFIED GLOBAL 3D MAP GENERATED' : isOptimizing ? 'STATUS: OPTIMIZING 6-DoF CONSTRAINTS' : 'STATUS: SUBMAP ACCUMULATION'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {/* Step 1: 3 AAVs */}
            <div className="bg-zinc-900/90 p-3 rounded-xs border border-zinc-800 flex flex-col justify-between">
              <div className="text-zinc-400 text-[10px] mb-1 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>1. ONBOARD LOCAL SLAM</span>
              </div>
              <div className="space-y-1 my-2">
                <div className="text-sky-300 font-bold">AAV-01 (Sector Alpha)</div>
                <div className="text-amber-300 font-bold">AAV-02 (Sector Bravo)</div>
                <div className="text-emerald-300 font-bold">AAV-03 (Sector Charlie)</div>
              </div>
              <p className="text-[10px] text-zinc-500 leading-tight">
                Stereo VIO feature tracking & keyframe selection running locally onboard drones.
              </p>
            </div>

            {/* Step 2: 5G Transport */}
            <div className="bg-zinc-900/90 p-3 rounded-xs border border-zinc-800 flex flex-col justify-between">
              <div className="text-zinc-400 text-[10px] mb-1 font-bold flex items-center gap-1">
                <Radio className="w-3 h-3 text-cyan-400" />
                <span>2. 5G URLLC NETWORK</span>
              </div>
              <div className="space-y-1 my-2 text-[11px]">
                <div className="text-zinc-300">Latency: <strong className="text-emerald-400">18 ms</strong></div>
                <div className="text-zinc-300">Slice: <strong className="text-cyan-400">eMBB + URLLC</strong></div>
                <div className="text-zinc-300">Packet Loss: <strong className="text-emerald-400">0.2%</strong></div>
              </div>
              <p className="text-[10px] text-zinc-500 leading-tight">
                Low-latency wireless transport of compressed keyframe packets to Edge Base Station.
              </p>
            </div>

            {/* Step 3: MEC Pose Graph Optimization */}
            <div className="bg-zinc-900/90 p-3 rounded-xs border border-cyan-700/60 flex flex-col justify-between">
              <div className="text-cyan-400 text-[10px] mb-1 font-bold flex items-center gap-1">
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>3. MEC EDGE OPTIMIZER</span>
              </div>
              <div className="space-y-1 my-2 text-[11px]">
                <div className="text-zinc-300">Place Rec: <strong className="text-yellow-400">DBoW2 Tree</strong></div>
                <div className="text-zinc-300">Solver: <strong className="text-cyan-300">g2o Levenberg-M.</strong></div>
                <div className="text-zinc-300">Residual: <strong className="text-emerald-400">{mec.chi2Error.toFixed(4)}m</strong></div>
              </div>
              <p className="text-[10px] text-zinc-500 leading-tight">
                Multi-agent data sync, inter-agent loop closures, and SE(3) pose graph relaxation.
              </p>
            </div>

            {/* Step 4: Unified 3D Global Map */}
            <div className={`p-3 rounded-xs border flex flex-col justify-between ${
              isFused
                ? 'bg-emerald-950/60 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'bg-zinc-900/90 border-zinc-800'
            }`}>
              <div className="text-emerald-400 text-[10px] mb-1 font-bold flex items-center gap-1">
                <Layers className="w-3 h-3 text-emerald-400" />
                <span>4. UNIFIED 3D MAP</span>
              </div>
              <div className="space-y-1 my-2 text-[11px]">
                <div className="text-zinc-300">Landmarks: <strong className="text-emerald-300">{collabSlam.globalLandmarksTotal || 3277}</strong></div>
                <div className="text-zinc-300">Keyframes: <strong className="text-zinc-100">{collabSlam.globalKeyframesTotal || 1086}</strong></div>
                <div className="text-zinc-300">Confidence: <strong className="text-emerald-400">{collabSlam.alignmentConfidence}%</strong></div>
              </div>
              <p className="text-[10px] text-zinc-500 leading-tight">
                Single metric global octree map available for joint mission planning & pathfinding.
              </p>
            </div>
          </div>
        </div>

        {/* Live Inter-Agent Correspondences Table */}
        <div className="bg-zinc-950 p-3 rounded-xs border border-zinc-800 text-xs">
          <span className="text-zinc-400 text-[11px] font-bold block mb-2">
            INTER-AGENT VISUAL CORRESPONDENCES (SHARED LANDMARKS):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="bg-zinc-900 p-2 rounded-xs border border-zinc-800 space-y-1">
              <div className="flex justify-between font-bold">
                <span className="text-sky-400">AAV-01</span>
                <span className="text-zinc-500">↔</span>
                <span className="text-amber-400">AAV-02</span>
              </div>
              <div className="flex justify-between text-zinc-400 text-[10px]">
                <span>Shared Region: Sector Alpha/Bravo Border</span>
                <span className="text-emerald-400 font-bold">94% BoW Match</span>
              </div>
              <div className="text-[10px] text-zinc-500">
                Transformation: SE(3) [dx: +124.2m, dy: -8.1m, dz: -4.0m, yaw: 39.8°]
              </div>
            </div>

            <div className="bg-zinc-900 p-2 rounded-xs border border-zinc-800 space-y-1">
              <div className="flex justify-between font-bold">
                <span className="text-amber-400">AAV-02</span>
                <span className="text-zinc-500">↔</span>
                <span className="text-emerald-400">AAV-03</span>
              </div>
              <div className="flex justify-between text-zinc-400 text-[10px]">
                <span>Shared Region: Sector Bravo/Charlie Border</span>
                <span className="text-emerald-400 font-bold">91% BoW Match</span>
              </div>
              <div className="text-[10px] text-zinc-500">
                Transformation: SE(3) [dx: -68.4m, dy: -118.5m, dz: +7.2m, yaw: 114.5°]
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <span className="text-xs text-zinc-400">
            {isFused
              ? '✅ Collaborative fusion solved and locked in Global Map memory.'
              : 'Execute non-linear least squares optimization across submaps.'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xs text-xs cursor-pointer transition-colors"
            >
              DISMISS
            </button>
            <button
              id="btn-modal-trigger-fusion"
              onClick={() => {
                onTriggerFusion();
              }}
              disabled={isFused}
              className={`px-4 py-1.5 rounded-xs font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                isFused
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700 cursor-default'
                  : isOptimizing
                  ? 'bg-yellow-600 text-black border border-yellow-400 animate-pulse'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-black border border-cyan-400'
              }`}
            >
              <span>{isFused ? 'MAP FUSED' : isOptimizing ? 'SOLVING...' : 'RUN MAP FUSION NOW'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
