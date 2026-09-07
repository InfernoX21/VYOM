import React from 'react';
import { SimulationState } from '../simulation/simulationEngine';
import { Scenario } from '../types/slam';
import { SCENARIOS } from '../simulation/scenarios';
import {
  Play,
  Pause,
  RotateCcw,
  Activity,
  Cpu,
  BarChart3,
  BookOpen,
  Camera,
  Shield,
  Radio,
} from 'lucide-react';
import { VyomLogo } from './VyomLogo';

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
  const isRunning = simState.missionStatus !== 'IDLE' && simState.missionStatus !== 'COMPLETE';
  const formatTime = (totalSeconds: number) => {
    const s = Math.floor(totalSeconds);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    const ms = Math.floor((totalSeconds % 1) * 10);
    return `${mm}:${ss}.${ms}`;
  };

  return (
    <header className="w-full bg-black border-b border-zinc-800 text-zinc-100 px-4 py-1.5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 shadow-md select-none font-sans">
      {/* Brand & Mission Status */}
      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-2.5">
          <VyomLogo height={28} className="shrink-0" />
        </div>
        <div className="h-7 w-[1px] bg-zinc-800 hidden sm:block"></div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xs md:text-sm font-bold font-sans text-zinc-100">
              VYOM <span className="text-zinc-400 font-normal">| Collaborative Visual-SLAM</span>
            </h1>
            <span className="text-[10px] px-1.5 py-0.5 rounded-xs font-sans font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800">
              5G + MEC
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-xs font-sans font-medium bg-zinc-900 text-zinc-400 border border-zinc-800">
              Simulation
            </span>
          </div>

        </div>
      </div>

      {/* Middle: Mission Timer, Scenario Selector, & Core Mission Execution Buttons */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Mission Clock */}
        <div className="bg-zinc-950 px-3 py-1.5 rounded-sm border border-zinc-800 flex items-center gap-2">
          <Activity className={`w-3.5 h-3.5 ${isRunning ? 'text-emerald-400 animate-pulse' : 'text-zinc-600'}`} />
          <div className="flex flex-col">
            <span className="text-[9px] font-sans font-medium text-zinc-400 leading-none">Mission Time</span>
            <span className="text-xs font-semibold font-mono tabular-nums text-zinc-100">
              {formatTime(simState.simTimeSeconds)}
            </span>
          </div>
        </div>

        {/* Mission Status Badge */}
        <div className="bg-zinc-950 px-3 py-1.5 rounded-sm border border-zinc-800 flex flex-col">
          <span className="text-[9px] font-sans font-medium text-zinc-400 leading-none">Mission State</span>
          <span
            className={`text-xs font-semibold font-sans ${
              simState.missionStatus === 'FUSED' || simState.missionStatus === 'COMPLETE'
                ? 'text-emerald-400'
                : simState.missionStatus === 'FUSING'
                ? 'text-yellow-400 animate-pulse'
                : simState.missionStatus === 'MAPPING' || simState.missionStatus === 'EXPLORING'
                ? 'text-cyan-400'
                : 'text-zinc-300'
            }`}
          >
            {simState.missionStatus}
          </span>
        </div>

        {/* Scenario Selector */}
        <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-sm border border-zinc-800">
          <span className="text-[11px] font-sans font-medium text-zinc-400">Scenario:</span>
          <select
            id="scenario-selector"
            value={scenario.id}
            onChange={(e) => onSelectScenario(e.target.value)}
            className="bg-black text-xs font-sans text-cyan-300 border border-zinc-700 px-2 py-1 rounded-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {Object.values(SCENARIOS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Simulation Execution Controls */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-sm border border-zinc-800">
          {!isRunning ? (
            <button
              id="btn-start-mission"
              onClick={onStart}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-semibold font-sans text-xs rounded-xs shadow transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Mission
            </button>
          ) : (
            <button
              id="btn-pause-mission"
              onClick={onPause}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-semibold font-sans text-xs rounded-xs transition-colors cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              Pause
            </button>
          )}

          <button
            id="btn-reset-mission"
            onClick={onReset}
            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xs transition-colors cursor-pointer"
            title="Reset Simulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Primary Climax Trigger: COLLABORATIVE MAP FUSION */}
        <button
          id="btn-fuse-maps"
          onClick={onTriggerFusion}
          disabled={simState.collabSlam.fusionStage === 'GLOBAL_FUSED'}
          className={`flex items-center justify-center px-3 py-1.5 font-semibold font-sans text-xs rounded-xs border transition-all cursor-pointer ${
            simState.collabSlam.fusionStage === 'GLOBAL_FUSED'
              ? 'bg-emerald-950/80 border-emerald-600 text-emerald-400 opacity-90 cursor-default'
              : simState.collabSlam.fusionStage !== 'IDLE'
              ? 'bg-yellow-600 text-black border-yellow-500 animate-pulse'
              : 'bg-gradient-to-r from-amber-600 to-yellow-500 text-black border-amber-400 hover:brightness-110 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
          }`}
        >
          {simState.collabSlam.fusionStage === 'GLOBAL_FUSED'
            ? 'Maps Fused (Unified)'
            : simState.collabSlam.fusionStage !== 'IDLE'
            ? 'Fusing Pose Graph...'
            : 'Fuse Maps'}
        </button>

        {/* Speed Controls */}
        <div className="flex items-center gap-0.5 bg-zinc-950 p-1 rounded-sm border border-zinc-800 font-mono tabular-nums text-[11px]">
          {[0.5, 1, 2, 5].map((spd) => (
            <button
              key={spd}
              id={`speed-btn-${spd}x`}
              onClick={() => onSetSpeed(spd)}
              className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer ${
                simState.simSpeed === spd
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Network Stress Demo Toggle */}
        <button
          id="btn-stress-test"
          onClick={onToggleStressTest}
          className={`flex items-center justify-center px-2.5 py-1.5 rounded-xs border font-sans font-medium text-xs transition-colors cursor-pointer ${
            simState.isStressTest
              ? 'bg-amber-950 border-amber-500 text-amber-300 animate-pulse'
              : 'bg-black border-zinc-700 text-zinc-300 hover:border-amber-500/70 hover:bg-zinc-900'
          }`}
          title="Toggle 5G RF interference stress demo"
        >
          <span>{simState.isStressTest ? '5G Stressed (86ms)' : 'Stress Test'}</span>
        </button>
      </div>

      {/* Right Side: Modal Triggers (Synthetic Camera, Fusion Pipeline, Analytics, Architecture) */}
      <div className="flex items-center gap-1.5 font-sans text-xs">
        <button
          id="btn-open-camera-modal"
          onClick={onOpenCameraFeed}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-cyan-500/70 text-cyan-400 rounded-xs transition-colors cursor-pointer font-medium"
          title="View simulated drone camera feature extraction"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Vision Feed</span>
        </button>

        <button
          id="btn-open-fusion-pipeline"
          onClick={onOpenFusionModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-yellow-500/70 text-yellow-400 rounded-xs transition-colors cursor-pointer font-medium"
          title="Examine Collaborative Map Fusion Diagram"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Fusion Pipeline</span>
        </button>

        <button
          id="btn-open-analytics-modal"
          onClick={onOpenAnalytics}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 rounded-xs transition-colors cursor-pointer font-medium"
        >
          <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
          <span>Analytics</span>
        </button>

        <button
          id="btn-open-architecture-modal"
          onClick={onOpenArchitecture}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 rounded-xs transition-colors cursor-pointer font-medium"
        >
          <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
          <span>Architecture</span>
        </button>
      </div>
    </header>
  );
};
