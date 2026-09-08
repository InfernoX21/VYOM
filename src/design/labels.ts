/**
 * Human-readable labels for every enum the UI renders.
 *
 * Raw enum identifiers (`GLOBAL_FUSED`, `ORB-SLAM3_VIO`, `POSE_GRAPH_OPT`) are
 * fine on the wire but read as machine output on screen. Every surface pulls
 * its display string from here so the same state never has two names.
 */

import type {
  AgentStatus,
  AAVTelemetry,
  FusionStage,
  MECMetrics,
  MissionEvent,
  MissionStatus,
  SLAMMode,
  Scenario,
} from '../types/slam';
import type { Tone } from './tokens';

/* -------------------------------------------------------------------------- */
/* Mission status                                                             */
/* -------------------------------------------------------------------------- */

export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  IDLE: 'Idle',
  DEPLOYING: 'Deploying',
  EXPLORING: 'Exploring',
  MAPPING: 'Mapping',
  PAUSED: 'Paused',
  FUSING: 'Fusing maps',
  FUSED: 'Maps fused',
  COMPLETE: 'Complete',
};

export const MISSION_STATUS_TONE: Record<MissionStatus, Tone> = {
  IDLE: 'neutral',
  DEPLOYING: 'primary',
  EXPLORING: 'success',
  MAPPING: 'success',
  PAUSED: 'danger',
  FUSING: 'warning',
  FUSED: 'success',
  COMPLETE: 'success',
};

/* -------------------------------------------------------------------------- */
/* Agent status                                                               */
/* -------------------------------------------------------------------------- */

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  OFFLINE: 'Offline',
  INITIALIZING: 'Initialising',
  ONLINE: 'Online',
  EXPLORING: 'Exploring',
  MAPPING: 'Mapping',
  TRANSMITTING: 'Transmitting',
  FUSED: 'Fused',
};

export const AGENT_STATUS_TONE: Record<AgentStatus, Tone> = {
  OFFLINE: 'neutral',
  INITIALIZING: 'primary',
  ONLINE: 'success',
  EXPLORING: 'success',
  MAPPING: 'success',
  TRANSMITTING: 'primary',
  FUSED: 'success',
};

/* -------------------------------------------------------------------------- */
/* Local map status                                                           */
/* -------------------------------------------------------------------------- */

type LocalMapStatus = AAVTelemetry['localMapStatus'];

export const LOCAL_MAP_LABEL: Record<LocalMapStatus, string> = {
  NOT_STARTED: 'Not started',
  INITIALIZING: 'Initialising',
  PROCESSING: 'Building',
  READY: 'Ready to fuse',
  FUSED: 'Fused',
};

export const LOCAL_MAP_TONE: Record<LocalMapStatus, Tone> = {
  NOT_STARTED: 'neutral',
  INITIALIZING: 'primary',
  PROCESSING: 'primary',
  READY: 'success',
  FUSED: 'success',
};

/* -------------------------------------------------------------------------- */
/* SLAM mode                                                                  */
/* -------------------------------------------------------------------------- */

export const SLAM_MODE_LABEL: Record<SLAMMode, string> = {
  'ORB-SLAM3_VIO': 'Onboard visual-inertial',
  COVINS_COLLAB: 'Collaborative SLAM',
  DEGRADED_ODOM: 'Degraded odometry',
};

export const SLAM_MODE_TONE: Record<SLAMMode, Tone> = {
  'ORB-SLAM3_VIO': 'neutral',
  COVINS_COLLAB: 'success',
  DEGRADED_ODOM: 'danger',
};

/* -------------------------------------------------------------------------- */
/* Fusion pipeline                                                            */
/* -------------------------------------------------------------------------- */

export const FUSION_STAGE_LABEL: Record<FusionStage, string> = {
  IDLE: 'Standby',
  GATHERING_SUBMAPS: 'Collecting local maps',
  PLACE_RECOGNITION: 'Matching landmarks',
  ALIGNMENT: 'Estimating alignment',
  POSE_GRAPH_OPT: 'Optimising pose graph',
  GLOBAL_FUSED: 'Unified map published',
};

/** Short form for progress bars and dense tiles. */
export const FUSION_STAGE_SHORT: Record<FusionStage, string> = {
  IDLE: 'Standby',
  GATHERING_SUBMAPS: 'Local maps',
  PLACE_RECOGNITION: 'Landmarks',
  ALIGNMENT: 'Alignment',
  POSE_GRAPH_OPT: 'Optimisation',
  GLOBAL_FUSED: 'Unified',
};

export const FUSION_STAGE_TONE: Record<FusionStage, Tone> = {
  IDLE: 'neutral',
  GATHERING_SUBMAPS: 'warning',
  PLACE_RECOGNITION: 'warning',
  ALIGNMENT: 'warning',
  POSE_GRAPH_OPT: 'warning',
  GLOBAL_FUSED: 'success',
};

/* -------------------------------------------------------------------------- */
/* MEC server                                                                 */
/* -------------------------------------------------------------------------- */

export const MEC_STATUS_LABEL: Record<MECMetrics['status'], string> = {
  ONLINE: 'Online',
  STANDBY: 'Standby',
  OPTIMIZING: 'Optimising',
};

export const MEC_STATUS_TONE: Record<MECMetrics['status'], Tone> = {
  ONLINE: 'success',
  STANDBY: 'neutral',
  OPTIMIZING: 'warning',
};

/* -------------------------------------------------------------------------- */
/* Mission log                                                                */
/* -------------------------------------------------------------------------- */

export const LOG_TYPE_LABEL: Record<MissionEvent['type'], string> = {
  INFO: 'System',
  SLAM: 'Collaborative SLAM',
  NETWORK: '5G Network',
  MEC: 'Edge Server',
  WARN: 'Warning',
  SUCCESS: 'Milestone',
};

/** Compact tag shown in the log gutter. */
export const LOG_TYPE_TAG: Record<MissionEvent['type'], string> = {
  INFO: 'System',
  SLAM: 'SLAM',
  NETWORK: 'Network',
  MEC: 'Edge',
  WARN: 'Warning',
  SUCCESS: 'Milestone',
};

export const LOG_TYPE_TONE: Record<MissionEvent['type'], Tone> = {
  INFO: 'neutral',
  SLAM: 'primary',
  NETWORK: 'neutral',
  MEC: 'primary',
  WARN: 'danger',
  SUCCESS: 'success',
};

/* -------------------------------------------------------------------------- */
/* Scenario                                                                   */
/* -------------------------------------------------------------------------- */

export const THREAT_LEVEL_LABEL: Record<Scenario['threatLevel'], string> = {
  'DEFCON 3': 'Elevated readiness',
  'DEFCON 4': 'Standard readiness',
  TACTICAL_ADVISORY: 'Advisory',
};

/* -------------------------------------------------------------------------- */
/* Camera / view modes                                                        */
/* -------------------------------------------------------------------------- */

export const CAMERA_MODE_LABEL: Record<string, string> = {
  TACTICAL: 'Orbit view',
  TOP_DOWN: 'Top-down',
  MEC: 'Edge node',
  'AAV-01': 'AAV-01 onboard',
  'AAV-02': 'AAV-02 onboard',
  'AAV-03': 'AAV-03 onboard',
};

/* -------------------------------------------------------------------------- */
/* Formatters                                                                 */
/* -------------------------------------------------------------------------- */

/** `mm:ss.d` mission clock. */
export function formatMissionTime(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  const tenths = Math.floor((s % 1) * 10);
  return `${mm}:${ss}.${tenths}`;
}

/** Thousands-separated integer for counts. */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}
