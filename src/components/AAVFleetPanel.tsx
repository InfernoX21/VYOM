import React from 'react';
import { AAVTelemetry } from '../types/slam';
import {
  Battery,
  Wifi,
  Navigation,
  Crosshair,
  Camera,
  Activity,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface AAVFleetPanelProps {
  agents: Record<string, AAVTelemetry>;
  selectedAgentId?: string | null;
  onSelectAgent: (agentId: string) => void;
  onOpenLiveCamera: (agentId: string) => void;
}

export const AAVFleetPanel: React.FC<AAVFleetPanelProps> = ({
  agents,
  selectedAgentId,
  onSelectAgent,
  onOpenLiveCamera,
}) => {
  return (
    <div className="bg-black border border-zinc-800 rounded-sm p-3 flex flex-col gap-2.5 font-sans">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-semibold font-sans text-zinc-100">
            AAV Fleet Status (3 Agents)
          </h2>
        </div>
        <span className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-xs bg-emerald-950 text-emerald-400 border border-emerald-800">
          All Autonomous
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {(Object.values(agents) as AAVTelemetry[]).map((agent) => {
          const isSelected = selectedAgentId === agent.id;
          const statusColor =
            agent.status === 'FUSED'
              ? 'text-emerald-400 border-emerald-700 bg-emerald-950/50'
              : agent.status === 'MAPPING' || agent.status === 'EXPLORING'
              ? 'text-cyan-400 border-cyan-700 bg-cyan-950/50'
              : 'text-amber-400 border-amber-700 bg-amber-950/50';

          return (
            <div
              key={agent.id}
              id={`fleet-card-${agent.id}`}
              onClick={() => onSelectAgent(agent.id)}
              className={`p-2.5 rounded-sm border transition-all cursor-pointer font-sans text-xs ${
                isSelected
                  ? 'bg-zinc-900 border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.18)]'
                  : 'bg-zinc-950 border-zinc-800/90 hover:border-zinc-700'
              }`}
            >
              {/* Agent Title Bar */}
              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: agent.color }}
                  />
                  <span className="font-semibold text-zinc-100 text-sm">
                    {agent.callsign}
                  </span>
                  <span className="text-[10px] text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded-xs border border-zinc-800 font-medium">
                    Sector {agent.sector}
                  </span>
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-xs border ${statusColor}`}>
                  {agent.status}
                </span>
              </div>

              {/* Real-Time Telemetry: Position, Orientation, Battery, Altitude, Speed, SLAM, 5G */}
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px] text-zinc-300 mb-2 font-sans">
                <div>
                  <span className="text-zinc-500 text-[10px] font-medium block">Status</span>
                  <span className="font-semibold text-emerald-400">{agent.networkConnected ? 'Online' : 'Offline'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] font-medium block">Mission</span>
                  <span className="font-semibold text-cyan-300">
                    {agent.status === 'FUSED' ? 'Fused / Recon' : agent.status}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] font-medium block">Battery</span>
                  <div className="flex items-center gap-1 font-semibold">
                    <Battery className={`w-3.5 h-3.5 ${agent.battery < 25 ? 'text-rose-400 animate-pulse' : agent.battery < 50 ? 'text-amber-400' : 'text-emerald-400'}`} />
                    <span className={`font-mono tabular-nums ${agent.battery < 25 ? 'text-rose-400' : 'text-zinc-100'}`}>{Math.round(agent.battery)}%</span>
                    <span className="text-[9px] text-zinc-400 font-normal font-mono tabular-nums">({(agent.battery * 0.26).toFixed(0)}m)</span>
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] font-medium block">Altitude (AGL)</span>
                  <span className="font-semibold font-mono tabular-nums text-zinc-100">{agent.altitude.toFixed(1)} m</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] font-medium block">Ground Speed</span>
                  <span className="font-semibold font-mono tabular-nums text-zinc-100">{agent.speed.toFixed(1)} m/s <span className="text-[9px] text-zinc-400 font-normal font-mono tabular-nums">({(agent.speed * 3.6).toFixed(0)} km/h)</span></span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] font-medium block">5G Bearer</span>
                  <div className="flex items-center gap-1 font-semibold text-cyan-400 font-mono tabular-nums">
                    <Wifi className="w-3 h-3 text-cyan-400" />
                    <span>{agent.rsrpDbm} dBm</span>
                  </div>
                </div>
              </div>

              {/* Exact Real-Time 3D Position & 6-DOF Orientation */}
              <div className="bg-black/95 p-1.5 rounded-xs border border-zinc-800/90 text-[10px] space-y-1 mb-2 font-sans">
                <div className="flex justify-between items-center text-zinc-400">
                  <span className="text-zinc-500 font-medium">Position (X,Y,Z):</span>
                  <span className="text-cyan-300 font-mono tabular-nums font-semibold">
                    [{agent.position.x.toFixed(1)}, {agent.position.y.toFixed(1)}, {agent.position.z.toFixed(1)}]m
                  </span>
                </div>
                <div className="flex justify-between items-center text-zinc-400">
                  <span className="text-zinc-500 font-medium">Orientation (P,R,Y):</span>
                  <span className="text-amber-300 font-mono tabular-nums font-semibold">
                    P:{agent.orientation.pitch >= 0 ? '+' : ''}{agent.orientation.pitch.toFixed(1)}° R:{agent.orientation.roll >= 0 ? '+' : ''}{agent.orientation.roll.toFixed(1)}° Y:{Math.round(agent.orientation.yaw)}°
                  </span>
                </div>
              </div>

              {/* SLAM Sub-metrics & Local Mapping Status */}
              <div className="bg-black/80 p-2 rounded-xs border border-zinc-800/80 text-[10px] space-y-1 mb-2 font-sans">
                <div className="flex justify-between items-center text-zinc-400">
                  <span className="font-medium">Local Map:</span>
                  <span
                    className={`font-semibold ${
                      agent.localMapStatus === 'READY' || agent.localMapStatus === 'FUSED'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {agent.localMapStatus}
                  </span>
                </div>
                <div className="flex justify-between items-center text-zinc-400">
                  <span className="font-medium">Keyframes:</span>
                  <span className="font-mono tabular-nums font-semibold text-zinc-200">{agent.keyframesCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400">
                  <span className="font-medium">Landmarks:</span>
                  <span className="font-mono tabular-nums font-semibold text-cyan-300">{agent.landmarksCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400">
                  <span className="font-medium">Features / Frame:</span>
                  <span className="font-mono tabular-nums font-semibold text-zinc-200">{agent.featuresTrackedPerFrame} pts</span>
                </div>
              </div>

              {/* Action Button: Open Live CV Camera View */}
              <button
                id={`btn-agent-cam-${agent.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLiveCamera(agent.id);
                }}
                className="w-full py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-cyan-400 hover:text-cyan-300 rounded-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[11px] font-semibold font-sans"
              >
                <Camera className="w-3 h-3" />
                <span>Onboard Stereo CV Feed</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
