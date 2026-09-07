import React, { useState, useEffect, useRef } from 'react';
import { AAVTelemetry } from '../types/slam';
import { Camera, X, Crosshair, Activity, Cpu, Compass, Layers } from 'lucide-react';

interface DroneCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Record<string, AAVTelemetry>;
  initialAgentId?: string;
}

export const DroneCameraModal: React.FC<DroneCameraModalProps> = ({
  isOpen,
  onClose,
  agents,
  initialAgentId = 'AAV-01',
}) => {
  const [activeAgentId, setActiveAgentId] = useState(initialAgentId);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (initialAgentId && agents[initialAgentId]) {
      setActiveAgentId(initialAgentId);
    }
  }, [initialAgentId, agents]);

  const agent = agents[activeAgentId] || Object.values(agents)[0];

  // Render synthetic computer-vision camera feed with ORB keypoints and optical flow
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    // Fixed synthetic landmarks in the camera's FOV
    const featurePoints = Array.from({ length: 65 }, () => ({
      x: 40 + Math.random() * (canvas.width - 80),
      y: 40 + Math.random() * (canvas.height - 80),
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      trackedFrames: Math.floor(10 + Math.random() * 40),
    }));

    const render = () => {
      frame++;
      animId = requestAnimationFrame(render);

      const w = canvas.width;
      const h = canvas.height;

      // Dark tactical camera sensor background (with subtle noise/monochrome tint)
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, w, h);

      // Perspective ground grid / building outlines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const horizonY = h * 0.42 + (agent ? agent.orientation.pitch * 2 : 0);

      // Horizon line
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(w, horizonY);
      ctx.stroke();

      // Perspective ground lines
      for (let x = -w; x <= w * 2; x += 60) {
        ctx.beginPath();
        ctx.moveTo(w / 2, horizonY);
        ctx.lineTo(x + (frame % 30) * 2, h);
        ctx.stroke();
      }

      // Simulated structures / rubble in camera view
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      const bx = (w * 0.4 + Math.sin(frame * 0.02) * 40);
      const by = horizonY + 20;
      ctx.strokeRect(bx, by, 90, 80);
      ctx.strokeRect(bx - 120, by + 40, 70, 60);
      ctx.strokeRect(bx + 140, by + 10, 80, 110);

      // Pitch & Roll crosshair ladder
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((agent ? agent.orientation.roll : 0) * (Math.PI / 180));
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 1.2;

      // Center crosshair reticle
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.moveTo(-35, 0); ctx.lineTo(-12, 0);
      ctx.moveTo(12, 0); ctx.lineTo(35, 0);
      ctx.moveTo(0, -35); ctx.lineTo(0, -12);
      ctx.moveTo(0, 12); ctx.lineTo(0, 35);
      ctx.stroke();

      // Pitch ladder rungs
      for (const offset of [-40, -20, 20, 40]) {
        ctx.beginPath();
        ctx.moveTo(-16, offset);
        ctx.lineTo(16, offset);
        ctx.stroke();
      }
      ctx.restore();

      // Draw tracked ORB/FAST feature points with green crosshairs and velocity trails
      ctx.font = '9px monospace';
      for (let i = 0; i < featurePoints.length; i++) {
        const pt = featurePoints[i];
        pt.x += pt.vx + (Math.random() - 0.5) * 0.4;
        pt.y += pt.vy + (Math.random() - 0.5) * 0.4;

        // Wrap around boundaries
        if (pt.x < 20) pt.x = w - 30;
        if (pt.x > w - 20) pt.x = 30;
        if (pt.y < horizonY) pt.y = h - 30;
        if (pt.y > h - 20) pt.y = horizonY + 10;

        // Draw green corner box
        ctx.strokeStyle = '#10b981'; // emerald green ORB tracker
        ctx.lineWidth = 1;
        ctx.strokeRect(pt.x - 3, pt.y - 3, 6, 6);

        // Center dot
        ctx.fillStyle = '#34d399';
        ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);

        // Optical flow vector
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x - pt.vx * 6, pt.y - pt.vy * 6);
        ctx.stroke();

        if (i % 8 === 0) {
          ctx.fillStyle = '#6ee7b7';
          ctx.fillText(`ID:${400 + i}`, pt.x + 5, pt.y - 4);
        }
      }

      // HUD Telemetry Overlays
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(8, 8, 180, 75);
      ctx.strokeStyle = '#27272a';
      ctx.strokeRect(8, 8, 180, 75);

      ctx.font = '10px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`${agent.callsign} STEREO VIO (ORB-SLAM3)`, 14, 24);
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText(`TRACKED PTS: ${agent.featuresTrackedPerFrame} / 300`, 14, 38);
      ctx.fillText(`KEYFRAMES: ${agent.keyframesCount}`, 14, 52);
      ctx.fillText(`STATUS: TRACKING_GOOD`, 14, 66);

      // Compass Heading at Top
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(w / 2 - 40, 8, 80, 24);
      ctx.strokeRect(w / 2 - 40, 8, 80, 24);
      ctx.fillStyle = '#f4f4f5';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`HDG: ${agent.heading}°`, w / 2, 24);
      ctx.textAlign = 'left';
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isOpen, activeAgentId, agent]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 font-sans antialiased select-none">
      <div className="bg-black border border-zinc-750 rounded-sm w-full max-w-3xl p-4 shadow-2xl flex flex-col gap-3 text-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 font-sans">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold font-sans text-zinc-100">
              Visual-Inertial Odometry Feed (ORB Keypoints)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Agent Selector Bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">SELECT VEHICLE:</span>
          {(Object.values(agents) as AAVTelemetry[]).map((a) => (
            <button
              key={a.id}
              onClick={() => setActiveAgentId(a.id)}
              className={`px-3 py-1 text-xs rounded-xs font-bold border transition-colors cursor-pointer ${
                activeAgentId === a.id
                  ? 'bg-cyan-500 text-black border-cyan-400'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {a.callsign} ({a.sector})
            </button>
          ))}
        </div>

        {/* Canvas Display */}
        <div className="relative rounded-xs border border-zinc-800 overflow-hidden bg-black flex justify-center items-center">
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            className="w-full h-auto max-h-[360px] object-contain"
          />
        </div>

        {/* IMU & Feature Tracking Telemetry Readouts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-zinc-950 p-2 rounded-xs border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">Features Tracked:</span>
            <span className="font-bold text-emerald-400">{agent.featuresTrackedPerFrame} FAST corners</span>
          </div>
          <div className="bg-zinc-950 p-2 rounded-xs border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">IMU Gyro (rad/s):</span>
            <span className="font-bold text-zinc-200">
              [{(agent.speed * 0.04).toFixed(2)}, {(agent.orientation.pitch * 0.05).toFixed(2)}, 0.01]
            </span>
          </div>
          <div className="bg-zinc-950 p-2 rounded-xs border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">IMU Accel (m/s²):</span>
            <span className="font-bold text-cyan-300">[0.04, 0.12, 9.81]</span>
          </div>
          <div className="bg-zinc-950 p-2 rounded-xs border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">Local VIO RMSE:</span>
            <span className="font-bold text-emerald-400">{agent.visualOdometryDrift.toFixed(1)} cm</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-xs cursor-pointer transition-colors"
          >
            CLOSE FEED
          </button>
        </div>
      </div>
    </div>
  );
};
