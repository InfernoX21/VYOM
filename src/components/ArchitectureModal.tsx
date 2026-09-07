import React, { useState } from 'react';
import { BookOpen, X, Code2, Server, Cpu, Radio, Shield, Layers } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ROS2' | 'NETWORKING' | 'HARDWARE'>('OVERVIEW');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 font-sans antialiased select-none">
      <div className="bg-black border border-zinc-750 rounded-sm w-full max-w-4xl p-5 shadow-2xl flex flex-col gap-4 text-zinc-200 max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 font-sans">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-semibold font-sans text-zinc-100">
                Collaborative Visual-SLAM over 5G MEC Architecture
              </h2>
              <p className="text-xs text-zinc-400 font-sans">
                System Specifications, Communication Protocols, & Hardware Migration Roadmap
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2 text-xs">
          {[
            { id: 'OVERVIEW', label: '1. SYSTEM ARCHITECTURE & DATA FLOW' },
            { id: 'ROS2', label: '2. ROS 2 & COVINS SLAM' },
            { id: 'NETWORKING', label: '3. 5G URLLC & MEC' },
            { id: 'HARDWARE', label: '4. PHYSICAL HARDWARE MIGRATION' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xs transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-cyan-500 text-black font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto pr-2 space-y-4 text-xs leading-relaxed text-zinc-300">
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-3">
              <div className="bg-zinc-950 p-3 rounded-xs border border-zinc-800">
                <h3 className="font-bold text-cyan-300 mb-1">CORE RESEARCH PROBLEM & MOTIVATION:</h3>
                <p>
                  A single Autonomous Aerial Vehicle (AAV) using Visual-Inertial SLAM is severely constrained by onboard battery, field of view, and computational payload limits. Mapping large urban disaster or tactical surveillance zones with one drone is slow and presents single-point-of-failure risks.
                </p>
                <p className="mt-2 text-zinc-400">
                  This platform demonstrates a distributed collaborative paradigm: three lightweight AAVs simultaneously explore distinct sectors, maintain local Visual Odometry onboard, and stream keyframe descriptors over a 5G low-latency slice to a Multi-access Edge Computing (MEC) server running a centralized COVINS-G collaborative SLAM backend.
                </p>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xs border border-zinc-800">
                <h3 className="font-bold text-cyan-300 mb-2">SYSTEM TOPOLOGY:</h3>
                <pre className="text-cyan-400 text-[11px] p-2 bg-black rounded border border-zinc-800 select-text">
{`AAV-01 (Sector Alpha) ──┐
AAV-02 (Sector Bravo) ──┼──> [5G URLLC Radio Access] ──> [MEC Edge Server] ──> Unified 3D Global Map
AAV-03 (Sector Charlie) ──┘        (Latency < 20ms)         (g2o Pose Graph Opt)    (Common WGS84 Reference)`}
                </pre>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-zinc-950 p-3 rounded-xs border border-zinc-800">
                  <span className="text-cyan-400 font-bold block mb-1">ONBOARD AAV RESPONSIBILITIES:</span>
                  <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px]">
                    <li>Stereo camera frame acquisition (30 FPS)</li>
                    <li>High-rate IMU pre-integration (200 Hz)</li>
                    <li>FAST corner extraction + ORB descriptor calculation</li>
                    <li>Local frame-to-frame Visual Odometry (6-DoF pose)</li>
                    <li>Keyframe selection logic (parallax thresholding)</li>
                    <li>Telemetry packaging for 5G transmission</li>
                  </ul>
                </div>

                <div className="bg-zinc-950 p-3 rounded-xs border border-zinc-800">
                  <span className="text-emerald-400 font-bold block mb-1">MEC SERVER RESPONSIBILITIES:</span>
                  <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px]">
                    <li>Multi-agent data stream synchronization</li>
                    <li>DBoW2 / NetVLAD place recognition</li>
                    <li>Inter-agent loop closure candidate detection</li>
                    <li>Relative 6-DoF SE(3) transformation calculation</li>
                    <li>Global Pose Graph Optimization (g2o / Ceres)</li>
                    <li>Octree map generation & global coordinate fusion</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ROS2' && (
            <div className="space-y-3">
              <div className="bg-zinc-950 p-3 rounded-xs border border-zinc-800">
                <h3 className="font-bold text-cyan-300 mb-1">ROS 2 NODES & MESSAGE TOPICS:</h3>
                <p className="text-zinc-400 mb-2">
                  The software architecture mirrors standard ROS 2 Humble/Iron nodes and COVINS (Collaborative Visual-Inertial SLAM) data structures:
                </p>
                <div className="space-y-2 text-[11px]">
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800 font-mono">
                    <span className="text-emerald-400 font-bold">/aav_01/camera/image_raw</span> : <span className="text-zinc-400">sensor_msgs/msg/Image (stereo pair)</span>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800 font-mono">
                    <span className="text-emerald-400 font-bold">/aav_01/imu/data</span> : <span className="text-zinc-400">sensor_msgs/msg/Imu (200Hz angular/linear)</span>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800 font-mono">
                    <span className="text-emerald-400 font-bold">/aav_01/covins/keyframe_out</span> : <span className="text-zinc-400">covins_msgs/msg/Keyframe (pose, features, BoW vector)</span>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800 font-mono">
                    <span className="text-cyan-400 font-bold">/mec/covins_server/global_map</span> : <span className="text-zinc-400">sensor_msgs/msg/PointCloud2 (unified 3D point cloud)</span>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800 font-mono">
                    <span className="text-cyan-400 font-bold">/mec/pose_graph/markers</span> : <span className="text-zinc-400">visualization_msgs/msg/MarkerArray (optimized graph edges)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'NETWORKING' && (
            <div className="space-y-3">
              <div className="bg-zinc-950 p-3 rounded-xs border border-zinc-800">
                <h3 className="font-bold text-cyan-300 mb-1">5G STANDALONE (SA) & EDGE MEC TOPOLOGY:</h3>
                <p className="text-zinc-400 mb-2">
                  Collaborative SLAM imposes heterogeneous Quality of Service (QoS) requirements that are addressed via 5G Network Slicing:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] mt-3">
                  <div className="p-2.5 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-cyan-400 font-bold block mb-1">SLICE 1: URLLC (Ultra-Reliable Low Latency)</span>
                    <p className="text-zinc-400">
                       Allocated for critical telemetry, emergency geofencing, heartbeat packets, and instantaneous loop closure confirmations. Guaranteed latency &lt; 20ms, packet loss &lt; 0.1%.
                    </p>
                  </div>
                  <div className="p-2.5 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-amber-400 font-bold block mb-1">SLICE 2: eMBB (Enhanced Mobile Broadband)</span>
                    <p className="text-zinc-400">
                      Allocated for high-bandwidth point clouds, keyframe image descriptors, and 3D submap transmissions (~10-30 Mbps per vehicle). Adaptive frame decimation triggers if RF signal degrades.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xs border border-zinc-800">
                <h3 className="font-bold text-cyan-300 mb-1">WHY EDGE PROCESSING MATTERS (STRESS DEMO INSIGHT):</h3>
                <p className="text-zinc-400">
                  During network degradation or tactical electronic countermeasures (jamming), our decentralized architecture ensures each AAV continues local flight stabilization and visual odometry without crashing. When 5G bandwidth is restored, the MEC server ingests queued keyframes and re-converges the global pose graph!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'HARDWARE' && (
            <div className="space-y-3">
              <div className="bg-zinc-950 p-3 rounded-xs border border-zinc-800">
                <h3 className="font-bold text-cyan-300 mb-1">TRANSITIONING FROM SIMULATION TO PHYSICAL HARDWARE:</h3>
                <p className="text-zinc-400 mb-2">
                  The software interfaces and state managers are deliberately built so that physical hardware components directly map to the software architecture:
                </p>
                <div className="space-y-2 text-[11px]">
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-emerald-400 font-bold">1. AAV Hardware:</span>
                    <span className="text-zinc-300 ml-2">
                      Holybro X500 / ModalAI Starling quadcopters equipped with Intel RealSense D435i / OAK-D stereo-inertial cameras, Pixhawk 6C flight controller (PX4 Autopilot).
                    </span>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-emerald-400 font-bold">2. Onboard Compute:</span>
                    <span className="text-zinc-300 ml-2">
                      NVIDIA Jetson Orin Nano / Xavier NX running Ubuntu 22.04 LTS, ROS 2 Humble, and ORB-SLAM3 / OpenVINS binary node.
                    </span>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-cyan-400 font-bold">3. 5G Modems:</span>
                    <span className="text-zinc-300 ml-2">
                      Quectel RM500Q-AE 5G NR M.2 module connected via USB 3.1 to onboard Jetson, communicating with private 5G gNodeB (Amarisoft Callbox / Open5GS).
                    </span>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-yellow-400 font-bold">4. MEC Edge Server:</span>
                    <span className="text-zinc-300 ml-2">
                      Edge compute blade (AMD EPYC + NVIDIA RTX A5000) running COVINS-G backend server with WebSocket/gRPC transport bridge feeding this web command center.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs rounded-xs cursor-pointer transition-colors"
          >
            CLOSE ARCHITECTURE GUIDE
          </button>
        </div>
      </div>
    </div>
  );
};
