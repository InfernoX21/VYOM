import React from 'react';
import { AAVTelemetry } from '../types/slam';
import { Battery, Camera, Navigation } from 'lucide-react';
import { Panel, PanelHeader, StatusBadge, DataRow } from './ui/Panel';
import { Button } from './ui/Button';
import {
  AGENT_STATUS_LABEL,
  AGENT_STATUS_TONE,
  LOCAL_MAP_LABEL,
  LOCAL_MAP_TONE,
  formatCount,
} from '../design/labels';

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
  const list = Object.values(agents) as AAVTelemetry[];
  const onlineCount = list.filter((a) => a.networkConnected).length;

  return (
    <Panel className="shrink-0">
      <PanelHeader
        icon={<Navigation className="h-3.5 w-3.5" />}
        title="AAV fleet"
        subtitle={`${list.length} vehicles`}
        actions={
          <StatusBadge
            label={`${onlineCount}/${list.length} linked`}
            tone={onlineCount === list.length ? 'success' : 'danger'}
            dot
          />
        }
      />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {list.map((agent) => {
          const isSelected = selectedAgentId === agent.id;
          const batteryTone =
            agent.battery < 25 ? 'danger' : agent.battery < 50 ? 'warning' : 'success';

          return (
            <div
              key={agent.id}
              id={`fleet-card-${agent.id}`}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => onSelectAgent(agent.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectAgent(agent.id);
                }
              }}
              className={`flex flex-col gap-2 rounded-md border p-2.5 transition-colors duration-200 ${
                isSelected
                  ? 'border-primary-line bg-surface-3'
                  : 'border-line bg-surface-2 hover:border-line-strong hover:bg-surface-3'
              }`}
            >
              {/* Identity */}
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: agent.color }}
                  />
                  <span className="telemetry text-xs font-semibold text-ink">{agent.callsign}</span>
                  <span className="truncate text-3xs text-ink-3">Sector {agent.sector}</span>
                </div>
                <StatusBadge
                  label={AGENT_STATUS_LABEL[agent.status]}
                  tone={AGENT_STATUS_TONE[agent.status]}
                />
              </div>

              {/* Flight telemetry */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <div>
                  <div className="text-3xs text-ink-3">Battery</div>
                  <div className="flex items-center gap-1">
                    <Battery
                      className={`h-3.5 w-3.5 ${
                        batteryTone === 'danger'
                          ? 'text-danger'
                          : batteryTone === 'warning'
                          ? 'text-warning'
                          : 'text-success'
                      }`}
                    />
                    <span className="telemetry text-2xs font-semibold text-ink">
                      {Math.round(agent.battery)}%
                    </span>
                    <span className="telemetry text-3xs text-ink-4">
                      {(agent.battery * 0.26).toFixed(0)} min
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-3xs text-ink-3">Altitude</div>
                  <div className="telemetry text-2xs font-semibold text-ink">
                    {agent.altitude.toFixed(1)} m
                  </div>
                </div>
                <div>
                  <div className="text-3xs text-ink-3">Ground speed</div>
                  <div className="telemetry text-2xs font-semibold text-ink">
                    {agent.speed.toFixed(1)} m/s
                  </div>
                </div>
                <div>
                  <div className="text-3xs text-ink-3">5G signal</div>
                  <div className="telemetry text-2xs font-semibold text-ink">
                    {agent.rsrpDbm} dBm
                  </div>
                </div>
              </div>

              {/* Pose */}
              <div className="tile space-y-1 px-2 py-1.5">
                <DataRow
                  label="Position X,Y,Z"
                  value={`${agent.position.x.toFixed(1)}, ${agent.position.y.toFixed(
                    1
                  )}, ${agent.position.z.toFixed(1)} m`}
                />
                <DataRow
                  label="Attitude P,R,Y"
                  value={`${agent.orientation.pitch.toFixed(1)}°, ${agent.orientation.roll.toFixed(
                    1
                  )}°, ${Math.round(agent.orientation.yaw)}°`}
                />
              </div>

              {/* SLAM */}
              <div className="tile space-y-1 px-2 py-1.5">
                <DataRow
                  label="Local map"
                  value={LOCAL_MAP_LABEL[agent.localMapStatus]}
                  tone={LOCAL_MAP_TONE[agent.localMapStatus]}
                  prose
                />
                <DataRow label="Keyframes" value={formatCount(agent.keyframesCount)} />
                <DataRow label="Landmarks" value={formatCount(agent.landmarksCount)} />
                <DataRow
                  label="Features / frame"
                  value={formatCount(agent.featuresTrackedPerFrame)}
                />
              </div>

              <Button
                id={`btn-agent-cam-${agent.id}`}
                variant="neutral"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLiveCamera(agent.id);
                }}
                icon={<Camera className="h-3 w-3" />}
              >
                Onboard camera
              </Button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};
