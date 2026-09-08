import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Modal, ModalTabs } from './ui/Modal';
import { SectionLabel } from './ui/Panel';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'overview' | 'slam' | 'network' | 'hardware';

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'System architecture' },
  { value: 'slam', label: 'ROS 2 and COVINS' },
  { value: 'network', label: '5G and edge' },
  { value: 'hardware', label: 'Hardware migration' },
];

/** Card used throughout the reference — one topic, one bordered block. */
const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded border border-line bg-surface-2 px-3 py-2.5">
    <h3 className="mb-1.5 text-2xs font-semibold text-ink">{title}</h3>
    <div className="space-y-2 text-2xs leading-relaxed text-ink-2">{children}</div>
  </section>
);

/** ROS topic / hardware line: a mono identifier plus prose. */
const Entry: React.FC<{ name: string; children: React.ReactNode }> = ({ name, children }) => (
  <div className="rounded-sm border border-line bg-surface-1 px-2 py-1.5">
    <div className="telemetry text-2xs font-semibold text-primary-ink">{name}</div>
    <div className="mt-0.5 text-2xs text-ink-3">{children}</div>
  </div>
);

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-4xl"
      icon={<BookOpen className="h-4 w-4" />}
      title="System architecture"
      subtitle="Collaborative visual SLAM over a 5G edge deployment"
      toolbar={<ModalTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />}
    >
      {activeTab === 'overview' && (
        <div className="space-y-2">
          <Block title="Problem and motivation">
            <p>
              A single autonomous aerial vehicle running visual-inertial SLAM is limited by battery,
              field of view and onboard compute. Mapping a large urban disaster zone with one
              vehicle is slow and leaves a single point of failure.
            </p>
            <p className="text-ink-3">
              VYOM demonstrates the distributed alternative: three vehicles explore separate
              sectors, each keeping visual odometry onboard, and stream keyframe descriptors over a
              low-latency 5G slice to an edge server running a centralised COVINS-G backend.
            </p>
          </Block>

          <Block title="Topology">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-4">
              {[
                { step: '1', name: 'Three AAVs', detail: 'Sectors Alpha, Bravo, Charlie' },
                { step: '2', name: '5G radio access', detail: 'URLLC slice, latency under 20 ms' },
                { step: '3', name: 'MEC edge server', detail: 'g2o pose-graph optimisation' },
                { step: '4', name: 'Unified 3D map', detail: 'Common metric reference frame' },
              ].map((node) => (
                <div key={node.step} className="rounded-sm border border-line bg-surface-1 px-2 py-2">
                  <div className="telemetry text-3xs text-ink-4">Stage {node.step}</div>
                  <div className="mt-0.5 text-2xs font-semibold text-ink">{node.name}</div>
                  <div className="mt-0.5 text-3xs text-ink-3">{node.detail}</div>
                </div>
              ))}
            </div>
          </Block>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Block title="Onboard the vehicle">
              <ul className="list-inside list-disc space-y-1 text-ink-3">
                <li>Stereo frame acquisition at 30 fps</li>
                <li>IMU pre-integration at 200 Hz</li>
                <li>FAST corner extraction and ORB descriptors</li>
                <li>Frame-to-frame visual odometry, 6-DoF pose</li>
                <li>Keyframe selection by parallax threshold</li>
                <li>Telemetry packaging for 5G transmission</li>
              </ul>
            </Block>

            <Block title="On the edge server">
              <ul className="list-inside list-disc space-y-1 text-ink-3">
                <li>Multi-agent stream synchronisation</li>
                <li>DBoW2 and NetVLAD place recognition</li>
                <li>Inter-agent loop closure detection</li>
                <li>Relative SE(3) transform estimation</li>
                <li>Global pose-graph optimisation (g2o, Ceres)</li>
                <li>Octree map generation and coordinate fusion</li>
              </ul>
            </Block>
          </div>
        </div>
      )}

      {activeTab === 'slam' && (
        <div className="space-y-2">
          <Block title="ROS 2 nodes and topics">
            <p className="text-ink-3">
              The software layout mirrors ROS 2 Humble nodes and COVINS message structures, so the
              simulation and a physical stack expose the same interfaces.
            </p>
            <div className="space-y-1.5">
              <Entry name="/aav_01/camera/image_raw">sensor_msgs/msg/Image — stereo pair</Entry>
              <Entry name="/aav_01/imu/data">
                sensor_msgs/msg/Imu — 200 Hz angular rate and specific force
              </Entry>
              <Entry name="/aav_01/covins/keyframe_out">
                covins_msgs/msg/Keyframe — pose, features, bag-of-words vector
              </Entry>
              <Entry name="/mec/covins_server/global_map">
                sensor_msgs/msg/PointCloud2 — unified point cloud
              </Entry>
              <Entry name="/mec/pose_graph/markers">
                visualization_msgs/msg/MarkerArray — optimised graph edges
              </Entry>
            </div>
          </Block>

          <Block title="Fusion sequence">
            <ol className="list-inside list-decimal space-y-1 text-ink-3">
              <li>Collect local submaps from each vehicle once its map is ready to fuse.</li>
              <li>Match landmarks between overlapping sectors using bag-of-words scoring.</li>
              <li>Estimate the relative SE(3) transform for each matched pair.</li>
              <li>Optimise the joint pose graph with Levenberg–Marquardt until χ² converges.</li>
              <li>Publish the unified map in a common metric frame.</li>
            </ol>
          </Block>
        </div>
      )}

      {activeTab === 'network' && (
        <div className="space-y-2">
          <Block title="5G standalone slicing">
            <p className="text-ink-3">
              Collaborative SLAM imposes two very different quality-of-service profiles, so traffic
              is split across slices.
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="rounded-sm border border-line bg-surface-1 px-2.5 py-2">
                <SectionLabel className="mb-1">URLLC slice</SectionLabel>
                <p className="text-2xs text-ink-3">
                  Critical telemetry, geofence enforcement, heartbeats and loop-closure
                  confirmations. Target latency under 20 ms with packet loss under 0.1%.
                </p>
              </div>
              <div className="rounded-sm border border-line bg-surface-1 px-2.5 py-2">
                <SectionLabel className="mb-1">eMBB slice</SectionLabel>
                <p className="text-2xs text-ink-3">
                  Point clouds, keyframe descriptors and submap transfers at roughly 10–30 Mbps per
                  vehicle. Frame decimation engages when the radio link degrades.
                </p>
              </div>
            </div>
          </Block>

          <Block title="Why the edge split matters">
            <p className="text-ink-3">
              Under interference each vehicle keeps flying and keeps its own visual odometry, so
              degradation costs map freshness rather than flight safety. When the link recovers, the
              edge server ingests the queued keyframes and re-converges the global pose graph. The
              stress-test control in the header demonstrates exactly this behaviour.
            </p>
          </Block>
        </div>
      )}

      {activeTab === 'hardware' && (
        <div className="space-y-2">
          <Block title="From simulation to hardware">
            <p className="text-ink-3">
              Interfaces and state managers are arranged so each simulated component maps onto a
              specific piece of hardware.
            </p>
            <div className="space-y-1.5">
              <Entry name="Airframe">
                Holybro X500 or ModalAI Starling quadcopters with Intel RealSense D435i / OAK-D
                stereo-inertial cameras and a Pixhawk 6C flight controller running PX4.
              </Entry>
              <Entry name="Onboard compute">
                NVIDIA Jetson Orin Nano or Xavier NX on Ubuntu 22.04 with ROS 2 Humble and an
                ORB-SLAM3 or OpenVINS node.
              </Entry>
              <Entry name="Radio">
                Quectel RM500Q-AE 5G NR module over USB 3.1, attached to a private gNodeB
                (Amarisoft Callbox or Open5GS).
              </Entry>
              <Entry name="Edge server">
                Edge blade with AMD EPYC and NVIDIA RTX A5000 running the COVINS-G backend, bridged
                to this command centre over WebSocket or gRPC.
              </Entry>
            </div>
          </Block>
        </div>
      )}
    </Modal>
  );
};
