export type MissionStatus = 'IDLE' | 'DEPLOYING' | 'EXPLORING' | 'MAPPING' | 'FUSING' | 'FUSED' | 'COMPLETE';

export type AgentStatus = 'OFFLINE' | 'INITIALIZING' | 'ONLINE' | 'EXPLORING' | 'MAPPING' | 'TRANSMITTING' | 'FUSED';

export type SLAMMode = 'ORB-SLAM3_VIO' | 'COVINS_COLLAB' | 'DEGRADED_ODOM';

export interface Vector3D {
  x: number;
  y: number;
  z: number; // altitude
}

export interface Orientation3D {
  roll: number;
  pitch: number;
  yaw: number;
}

export interface Landmark3D {
  id: string;
  position: Vector3D;
  agentId: string;
  descriptorId: number;
  confidence: number;
  isShared?: boolean;
  sharedWithAgentId?: string;
}

export interface Keyframe {
  id: string;
  agentId: string;
  timestamp: number;
  position: Vector3D;
  orientation: Orientation3D;
  landmarkCount: number;
  isLoopClosureCandidate?: boolean;
}

export interface AAVTelemetry {
  id: string;
  callsign: string; // e.g. "AAV-01"
  sector: 'Alpha' | 'Bravo' | 'Charlie';
  color: string;
  status: AgentStatus;
  battery: number; // %
  altitude: number; // m
  speed: number; // m/s
  heading: number; // degrees
  position: Vector3D;
  orientation: Orientation3D;
  trajectory: Vector3D[];
  
  // SLAM specific
  slamMode: SLAMMode;
  slamActive: boolean;
  keyframesCount: number;
  landmarksCount: number;
  featuresTrackedPerFrame: number;
  visualOdometryDrift: number; // cm RMSE
  localMapStatus: 'NOT_STARTED' | 'INITIALIZING' | 'PROCESSING' | 'READY' | 'FUSED';
  
  // 5G specific
  networkConnected: boolean;
  rsrpDbm: number;
  uplinkRateMbps: number;
  localPacketsSent: number;
}

export interface LatencySample {
  timestamp: number; // in simulation seconds
  latencyMs: number;
  isSpike: boolean;
}

export interface NetworkMetrics {
  latencyMs: number;
  throughputMbps: number;
  packetLossPercent: number;
  jitterMs: number;
  signalQualityDbm: number;
  sinrDb: number;
  connectedAgents: number;
  sliceType: '5G URLLC + eMBB';
  stressMode: boolean;
  packetsDropped: number;
  totalPacketsTransmitted: number;
  latencyHistory: LatencySample[];
  spikeCountLast60s?: number;
  maxLatencyLast60s?: number;
  p95LatencyLast60s?: number;
}

export interface MECLoadSample {
  time: string;
  timestamp: number;
  slamLoad: number; // %
  cpuUsage: number;
  gpuUsage: number;
  isBottleneck: boolean;
  activeThreads: number;
}

export interface MECMetrics {
  status: 'ONLINE' | 'STANDBY' | 'OPTIMIZING';
  cpuUsage: number; // %
  gpuUsage: number; // %
  memoryGb: number;
  totalMemoryGb: number;
  slamProcessingLoad: number; // %
  mapFusionLoad: number; // %
  activeAgents: number;
  poseGraphNodes: number;
  poseGraphEdges: number;
  optimizationIterations: number;
  chi2Error: number;
  loadHistory: MECLoadSample[];
  peakLoad?: number;
  bottleneckCount?: number;
}

export interface SharedLandmarkMatch {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  sourceLandmarkPos: Vector3D;
  targetLandmarkPos: Vector3D;
  similarityScore: number;
  residualErrorMeters: number;
}

export interface CollaborativeSLAMState {
  fusionStage: 'IDLE' | 'GATHERING_SUBMAPS' | 'PLACE_RECOGNITION' | 'POSE_GRAPH_OPT' | 'GLOBAL_FUSED';
  fusionProgress: number; // 0 to 100
  loopClosuresDetected: number;
  sharedLandmarksCount: number;
  relativePoseEstimated: boolean;
  globalKeyframesTotal: number;
  globalLandmarksTotal: number;
  alignmentConfidence: number; // %
  sharedMatches: SharedLandmarkMatch[];
}

export interface MissionEvent {
  id: string;
  timestamp: string;
  type: 'INFO' | 'SLAM' | 'NETWORK' | 'MEC' | 'WARN' | 'SUCCESS';
  message: string;
  agentId?: string;
}

export interface SectorDefinition {
  id: 'Alpha' | 'Bravo' | 'Charlie';
  name: string;
  description: string;
  center: Vector3D;
  radius: number;
  assignedAgent: string;
  buildingCount: number;
}

export interface Building3D {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  type: 'structure' | 'rubble' | 'industrial' | 'tower';
  sector: 'Alpha' | 'Bravo' | 'Charlie' | 'Neutral';
}

export interface Scenario {
  id: 'urban_disaster' | 'search_rescue' | 'infrastructure_inspection';
  name: string;
  description: string;
  threatLevel: 'DEFCON 3' | 'DEFCON 4' | 'TACTICAL_ADVISORY';
  initialZoom: number;
  sectors: SectorDefinition[];
  buildings: Building3D[];
  groundRadius: number;
}
