import React, { useState, useEffect, useRef } from 'react';
import { AAVTelemetry } from '../types/slam';
import { Camera } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Segmented } from './ui/Button';
import { StatusBadge, MetricTile, SectionLabel } from './ui/Panel';
import { COLOR } from '../design/tokens';
import { SLAM_MODE_LABEL, SLAM_MODE_TONE } from '../design/labels';

interface DroneCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Record<string, AAVTelemetry>;
  initialAgentId?: string;
  /** Feature tracking advances only while the simulation clock runs. */
  isRunning: boolean;
}

const CANVAS_W = 640;
const CANVAS_H = 360;
const FEATURE_COUNT = 64;

export const DroneCameraModal: React.FC<DroneCameraModalProps> = ({
  isOpen,
  onClose,
  agents,
  initialAgentId = 'AAV-01',
  isRunning,
}) => {
  const [activeAgentId, setActiveAgentId] = useState(initialAgentId);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (initialAgentId && agents[initialAgentId]) {
      setActiveAgentId(initialAgentId);
    }
  }, [initialAgentId, agents]);

  const agent = agents[activeAgentId] || (Object.values(agents)[0] as AAVTelemetry);

  /**
   * Synthetic ORB keypoint view. Draws a restrained grayscale scene with the
   * tracker overlay in the platform accent — no glow, no rainbow ramps.
   */
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !agent) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let frame = 0;

    const features = Array.from({ length: FEATURE_COUNT }, (_, i) => ({
      id: 400 + i,
      x: 40 + Math.random() * (CANVAS_W - 80),
      y: 40 + Math.random() * (CANVAS_H - 80),
      vx: (Math.random() - 0.5) * 1.4,
      vy: (Math.random() - 0.5) * 1.4,
    }));

    const render = () => {
      animId = requestAnimationFrame(render);
      if (isRunning) frame++;

      const w = CANVAS_W;
      const h = CANVAS_H;

      // Sensor background.
      ctx.fillStyle = COLOR.surface1;
      ctx.fillRect(0, 0, w, h);

      const horizonY = h * 0.42 + agent.orientation.pitch * 2;

      // Perspective ground lines converging on the horizon.
      ctx.strokeStyle = COLOR.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(w, horizonY);
      ctx.stroke();

      for (let x = -w; x <= w * 2; x += 60) {
        ctx.beginPath();
        ctx.moveTo(w / 2, horizonY);
        ctx.lineTo(x + (frame % 30) * 2, h);
        ctx.stroke();
      }

      // Structures in view.
      ctx.strokeStyle = COLOR.lineStrong;
      ctx.lineWidth = 1.5;
      const bx = w * 0.4 + Math.sin(frame * 0.02) * 40;
      const by = horizonY + 20;
      ctx.strokeRect(bx, by, 90, 80);
      ctx.strokeRect(bx - 120, by + 40, 70, 60);
      ctx.strokeRect(bx + 140, by + 10, 80, 110);

      // Attitude reticle.
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(agent.orientation.roll * (Math.PI / 180));
      ctx.strokeStyle = COLOR.ink3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.moveTo(-34, 0);
      ctx.lineTo(-12, 0);
      ctx.moveTo(12, 0);
      ctx.lineTo(34, 0);
      ctx.moveTo(0, -34);
      ctx.lineTo(0, -12);
      ctx.moveTo(0, 12);
      ctx.lineTo(0, 34);
      ctx.stroke();
      for (const offset of [-40, -20, 20, 40]) {
        ctx.beginPath();
        ctx.moveTo(-14, offset);
        ctx.lineTo(14, offset);
        ctx.stroke();
      }
      ctx.restore();

      // Tracked keypoints with optical-flow vectors.
      ctx.font = '9px "JetBrains Mono", monospace';
      for (let i = 0; i < features.length; i++) {
        const pt = features[i];
        if (isRunning) {
          pt.x += pt.vx + (Math.random() - 0.5) * 0.4;
          pt.y += pt.vy + (Math.random() - 0.5) * 0.4;
          if (pt.x < 20) pt.x = w - 30;
          if (pt.x > w - 20) pt.x = 30;
          if (pt.y < horizonY) pt.y = h - 30;
          if (pt.y > h - 20) pt.y = horizonY + 10;
        }

        ctx.strokeStyle = COLOR.success;
        ctx.lineWidth = 1;
        ctx.strokeRect(pt.x - 3, pt.y - 3, 6, 6);

        ctx.fillStyle = COLOR.successInk;
        ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);

        ctx.strokeStyle = COLOR.primary;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x - pt.vx * 6, pt.y - pt.vy * 6);
        ctx.stroke();

        if (i % 8 === 0) {
          ctx.fillStyle = COLOR.ink4;
          ctx.fillText(`${pt.id}`, pt.x + 5, pt.y - 4);
        }
      }

      // Tracker readout.
      ctx.fillStyle = COLOR.surface0;
      ctx.fillRect(8, 8, 186, 72);
      ctx.strokeStyle = COLOR.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(8, 8, 186, 72);

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = COLOR.ink;
      ctx.fillText(`${agent.callsign} stereo VIO`, 14, 24);
      ctx.fillStyle = COLOR.ink2;
      ctx.fillText(`Tracked ${agent.featuresTrackedPerFrame} / 300`, 14, 38);
      ctx.fillText(`Keyframes ${agent.keyframesCount}`, 14, 52);
      ctx.fillStyle = isRunning ? COLOR.successInk : COLOR.dangerInk;
      ctx.fillText(isRunning ? 'Tracking' : 'Held — mission paused', 14, 66);

      // Heading.
      ctx.fillStyle = COLOR.surface0;
      ctx.fillRect(w / 2 - 42, 8, 84, 22);
      ctx.strokeStyle = COLOR.line;
      ctx.strokeRect(w / 2 - 42, 8, 84, 22);
      ctx.fillStyle = COLOR.ink;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`HDG ${Math.round(agent.heading)}°`, w / 2, 23);
      ctx.textAlign = 'left';
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isOpen, activeAgentId, agent, isRunning]);

  if (!agent) return null;

  const agentList = Object.values(agents) as AAVTelemetry[];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-3xl"
      icon={<Camera className="h-4 w-4" />}
      title="Vision feed"
      subtitle="Onboard stereo camera with ORB keypoint tracking"
      toolbar={
        <div className="flex items-center justify-between gap-3">
          <Segmented
            aria-label="Select vehicle"
            options={agentList.map((a) => ({
              value: a.id,
              label: `${a.callsign} · ${a.sector}`,
              id: `cam-tab-${a.id}`,
            }))}
            value={activeAgentId}
            onChange={setActiveAgentId}
          />
          <div className="flex items-center gap-1.5">
            <StatusBadge
              label={SLAM_MODE_LABEL[agent.slamMode]}
              tone={SLAM_MODE_TONE[agent.slamMode]}
            />
            <StatusBadge
              label={isRunning ? 'Live' : 'Paused'}
              tone={isRunning ? 'success' : 'danger'}
              dot
            />
          </div>
        </div>
      }
    >
      <div className="overflow-hidden rounded-lg border border-white/15 bg-surface-1/60 backdrop-blur-md shadow-lg">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block h-auto w-full select-none"
        />
      </div>

      <div className="mt-3">
        <SectionLabel>Tracking and inertial telemetry</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <MetricTile
            label="Features / frame"
            value={agent.featuresTrackedPerFrame}
            unit="corners"
            caption="FAST detector"
            tone="success"
            size="sm"
          />
          <MetricTile
            label="Gyro"
            value={`${(agent.speed * 0.04).toFixed(2)}, ${(agent.orientation.pitch * 0.05).toFixed(
              2
            )}, 0.01`}
            unit="rad/s"
            caption="Body rates"
            size="sm"
          />
          <MetricTile
            label="Accelerometer"
            value="0.04, 0.12, 9.81"
            unit="m/s²"
            caption="Specific force"
            size="sm"
          />
          <MetricTile
            label="Odometry drift"
            value={agent.visualOdometryDrift.toFixed(1)}
            unit="cm"
            caption="Local VIO RMSE"
            tone={agent.visualOdometryDrift > 12 ? 'warning' : 'success'}
            size="sm"
          />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <MetricTile
          label="Altitude"
          value={agent.altitude.toFixed(1)}
          unit="m"
          caption="Above launch"
          size="sm"
        />
        <MetricTile
          label="Ground speed"
          value={agent.speed.toFixed(1)}
          unit="m/s"
          caption="Horizontal"
          size="sm"
        />
        <MetricTile
          label="Keyframes"
          value={agent.keyframesCount}
          caption="Local map"
          size="sm"
        />
        <MetricTile
          label="Landmarks"
          value={agent.landmarksCount}
          caption="Local map"
          size="sm"
        />
      </div>
    </Modal>
  );
};
