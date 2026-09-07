import {
  AAVTelemetry,
  CollaborativeSLAMState,
  Landmark3D,
  Keyframe,
  LatencySample,
  MECMetrics,
  MissionEvent,
  MissionStatus,
  NetworkMetrics,
  Scenario,
  SharedLandmarkMatch,
  Vector3D,
} from '../types/slam';
import { SCENARIOS } from './scenarios';

export interface SimulationState {
  missionStatus: MissionStatus;
  scenarioId: string;
  simTimeSeconds: number;
  simSpeed: number;
  isStressTest: boolean;
  agents: Record<string, AAVTelemetry>;
  landmarks: Landmark3D[];
  keyframes: Keyframe[];
  network: NetworkMetrics;
  mec: MECMetrics;
  collabSlam: CollaborativeSLAMState;
  events: MissionEvent[];
  fusedPointCloud: Landmark3D[];
}

export class SimulationEngine {
  private state: SimulationState;
  private listeners: ((state: SimulationState) => void)[] = [];
  private timer: number | null = null;
  private lastTickMs: number = 0;
  private scenario: Scenario;
  private eventCounter: number = 0;
  private lastLatencySampleTime: number = 0;
  private lastMecSampleTime: number = 0;

  constructor(initialScenarioId: string = 'urban_disaster') {
    this.scenario = SCENARIOS[initialScenarioId] || SCENARIOS.urban_disaster;
    this.state = this.createInitialState(this.scenario.id);
  }

  public subscribe(listener: (state: SimulationState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public getState(): SimulationState {
    return this.state;
  }

  public getScenario(): Scenario {
    return this.scenario;
  }

  public setScenario(scenarioId: string) {
    if (SCENARIOS[scenarioId]) {
      this.pause();
      this.scenario = SCENARIOS[scenarioId];
      this.state = this.createInitialState(scenarioId);
      this.addEvent('INFO', `Mission scenario switched to: ${this.scenario.name}`);
      this.notify();
    }
  }

  public start() {
    if (this.state.missionStatus === 'IDLE') {
      this.state.missionStatus = 'DEPLOYING';
      this.addEvent('INFO', 'MISSION START: 3 AAVs departing central launch pad for Sector assignment');
      this.addEvent('NETWORK', '5G URLLC radio bearer established with edge MEC node (Base Station 01)');
      this.addEvent('MEC', 'MEC COVINS collaborative SLAM server initialized in listening mode');
    } else if (this.state.missionStatus === 'COMPLETE') {
      this.reset();
      this.start();
      return;
    }

    if (this.timer) {
      clearInterval(this.timer);
    }

    this.lastTickMs = performance.now();
    this.timer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.2, (now - this.lastTickMs) / 1000);
      this.lastTickMs = now;
      this.tick(dt * this.state.simSpeed);
    }, 50); // 20 FPS physics/telemetry tick

    this.notify();
  }

  public pause() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.notify();
  }

  public reset() {
    this.pause();
    this.state = this.createInitialState(this.scenario.id);
    this.addEvent('INFO', 'Simulation reset to deployment staging configuration.');
    this.notify();
  }

  public setSpeed(speed: number) {
    this.state.simSpeed = speed;
    this.addEvent('INFO', `Simulation execution rate adjusted to ${speed}x`);
    this.notify();
  }

  public toggleStressTest() {
    this.state.isStressTest = !this.state.isStressTest;
    this.state.network.stressMode = this.state.isStressTest;
    if (this.state.isStressTest) {
      this.addEvent('WARN', '⚠️ 5G NETWORK STRESS TEST ACTIVATED: Artificial RF interference injected (Bandwidth throttled, latency spiking)');
    } else {
      this.addEvent('SUCCESS', '5G Network restored to normal URLLC operational parameters (18ms latency, 0.2% packet loss)');
    }
    this.notify();
  }

  public triggerMapFusion() {
    if (this.state.collabSlam.fusionStage === 'GLOBAL_FUSED') return;

    this.addEvent('SLAM', 'MANUAL OVERRIDE: Collaborative Map Fusion initiated across all connected agents');
    this.state.collabSlam.fusionStage = 'PLACE_RECOGNITION';
    this.state.missionStatus = 'FUSING';
    this.state.mec.status = 'OPTIMIZING';
    this.notify();
  }

  private createInitialState(scenarioId: string): SimulationState {
    // Dedicated Staging & Common Launch Pad at (0, -12, 0)
    const agents: Record<string, AAVTelemetry> = {
      'AAV-01': {
        id: 'AAV-01',
        callsign: 'AAV-01',
        sector: 'Alpha',
        color: '#38bdf8', // Cyan
        status: 'ONLINE',
        battery: 100,
        altitude: 0,
        speed: 0,
        heading: 0,
        position: { x: -3.8, y: -12, z: 0 },
        orientation: { roll: 0, pitch: 0, yaw: 0 },
        trajectory: [{ x: -3.8, y: -12, z: 0 }],
        slamMode: 'ORB-SLAM3_VIO',
        slamActive: false,
        keyframesCount: 0,
        landmarksCount: 0,
        featuresTrackedPerFrame: 0,
        visualOdometryDrift: 0.2,
        localMapStatus: 'NOT_STARTED',
        networkConnected: true,
        rsrpDbm: -68,
        uplinkRateMbps: 8.2,
        localPacketsSent: 0,
      },
      'AAV-02': {
        id: 'AAV-02',
        callsign: 'AAV-02',
        sector: 'Bravo',
        color: '#fbbf24', // Amber
        status: 'ONLINE',
        battery: 100,
        altitude: 0,
        speed: 0,
        heading: 0,
        position: { x: 0, y: -12, z: 0 },
        orientation: { roll: 0, pitch: 0, yaw: 0 },
        trajectory: [{ x: 0, y: -12, z: 0 }],
        slamMode: 'ORB-SLAM3_VIO',
        slamActive: false,
        keyframesCount: 0,
        landmarksCount: 0,
        featuresTrackedPerFrame: 0,
        visualOdometryDrift: 0.3,
        localMapStatus: 'NOT_STARTED',
        networkConnected: true,
        rsrpDbm: -71,
        uplinkRateMbps: 7.9,
        localPacketsSent: 0,
      },
      'AAV-03': {
        id: 'AAV-03',
        callsign: 'AAV-03',
        sector: 'Charlie',
        color: '#34d399', // Emerald
        status: 'ONLINE',
        battery: 100,
        altitude: 0,
        speed: 0,
        heading: 0,
        position: { x: 3.8, y: -12, z: 0 },
        orientation: { roll: 0, pitch: 0, yaw: 0 },
        trajectory: [{ x: 3.8, y: -12, z: 0 }],
        slamMode: 'ORB-SLAM3_VIO',
        slamActive: false,
        keyframesCount: 0,
        landmarksCount: 0,
        featuresTrackedPerFrame: 0,
        visualOdometryDrift: 0.2,
        localMapStatus: 'NOT_STARTED',
        networkConnected: true,
        rsrpDbm: -66,
        uplinkRateMbps: 8.5,
        localPacketsSent: 0,
      },
    };

    return {
      missionStatus: 'IDLE',
      scenarioId,
      simTimeSeconds: 0,
      simSpeed: 1.0,
      isStressTest: false,
      agents,
      landmarks: [],
      keyframes: [],
      network: {
        latencyMs: 18,
        throughputMbps: 24.6,
        packetLossPercent: 0.2,
        jitterMs: 2.1,
        signalQualityDbm: -68,
        sinrDb: 22.4,
        connectedAgents: 3,
        sliceType: '5G URLLC + eMBB',
        stressMode: false,
        packetsDropped: 0,
        totalPacketsTransmitted: 0,
        latencyHistory: Array.from({ length: 60 }, (_, i) => {
          const timestamp = -59 + i;
          // Normal URLLC baseline between 16 and 22 ms with 1-2 minor 25-28ms transients
          const isMinorJitter = i === 18 || i === 42;
          const latency = isMinorJitter ? 27 : Math.round(17 + Math.sin(i * 0.3) * 2.2 + (Math.random() * 2 - 1));
          return {
            timestamp,
            latencyMs: latency,
            isSpike: latency > 45,
          };
        }),
        spikeCountLast60s: 0,
        maxLatencyLast60s: 27,
        p95LatencyLast60s: 21,
      },
      mec: {
        status: 'ONLINE',
        cpuUsage: 28,
        gpuUsage: 35,
        memoryGb: 5.4,
        totalMemoryGb: 32.0,
        slamProcessingLoad: 32,
        mapFusionLoad: 0,
        activeAgents: 3,
        poseGraphNodes: 0,
        poseGraphEdges: 0,
        optimizationIterations: 0,
        chi2Error: 0.082,
        loadHistory: Array.from({ length: 30 }, (_, i) => {
          const timestamp = -29 + i;
          const load = Math.round(28 + Math.sin(i * 0.4) * 6 + (i > 12 && i < 18 ? 22 : 0) + (Math.random() * 3 - 1.5));
          return {
            time: `${timestamp}s`,
            timestamp,
            slamLoad: load,
            cpuUsage: Math.round(load * 0.8 + 8),
            gpuUsage: Math.round(load * 0.9 + 12),
            isBottleneck: load >= 75,
            activeThreads: 4,
          };
        }),
        peakLoad: 52,
        bottleneckCount: 0,
      },
      collabSlam: {
        fusionStage: 'IDLE',
        fusionProgress: 0,
        loopClosuresDetected: 0,
        sharedLandmarksCount: 0,
        relativePoseEstimated: false,
        globalKeyframesTotal: 0,
        globalLandmarksTotal: 0,
        alignmentConfidence: 0,
        sharedMatches: [],
      },
      events: [
        {
          id: 'ev_init_1',
          timestamp: '00:00:00',
          type: 'INFO',
          message: 'VYOM Collaborative Multi-AAV Command Center Ready (COVINS-5G testbed)',
        },
        {
          id: 'ev_init_2',
          timestamp: '00:00:01',
          type: 'NETWORK',
          message: '5G Core (gNodeB) localized: URLLC priority slice allocated for telemetry/submaps',
        },
      ],
      fusedPointCloud: [],
    };
  }

  private addEvent(type: MissionEvent['type'], message: string, agentId?: string) {
    this.eventCounter++;
    const s = Math.floor(this.state.simTimeSeconds);
    const hrs = String(Math.floor(s / 3600)).padStart(2, '0');
    const mins = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const secs = String(s % 60).padStart(2, '0');
    const timestamp = `${hrs}:${mins}:${secs}`;

    const newEvent: MissionEvent = {
      id: `ev_${this.eventCounter}_${Date.now()}`,
      timestamp,
      type,
      message,
      agentId,
    };

    // Keep up to 60 most recent events
    this.state.events = [newEvent, ...this.state.events.slice(0, 59)];
  }

  private tick(dt: number) {
    this.state.simTimeSeconds += dt;
    const t = this.state.simTimeSeconds;

    // 1. Mission Stage Progression
    if (this.state.missionStatus === 'DEPLOYING') {
      if (t > 4) {
        this.state.missionStatus = 'EXPLORING';
        this.addEvent('SLAM', 'AAVs reached operational cruising altitudes. Visual-Inertial SLAM (ORB-SLAM3) engaged.');
        for (const id in this.state.agents) {
          this.state.agents[id].status = 'EXPLORING';
          this.state.agents[id].slamActive = true;
          this.state.agents[id].localMapStatus = 'INITIALIZING';
        }
      }
    } else if (this.state.missionStatus === 'EXPLORING') {
      if (t > 12) {
        this.state.missionStatus = 'MAPPING';
        for (const id in this.state.agents) {
          this.state.agents[id].status = 'MAPPING';
          this.state.agents[id].localMapStatus = 'PROCESSING';
        }
        this.addEvent('SLAM', 'Sector visual odometry tracking stabilized. Generating high-density keyframes.');
      }
    }

    // 2. Trajectories and Kinematics
    this.updateAAVKinematics(t, dt);

    // 3. SLAM Feature & Landmark Generation
    this.updateSLAMGeneration(t, dt);

    // 4. 5G Network Simulation
    this.updateNetworkSimulation(t, dt);

    // 5. MEC Computation Simulation
    this.updateMECSimulation(t, dt);

    // 6. Collaborative SLAM & Automatic Fusion Triggering
    this.updateCollaborativeSLAM(t, dt);

    this.notify();
  }

  private updateAAVKinematics(t: number, dt: number) {
    if (this.state.missionStatus === 'IDLE') {
      // Drones remain staged on common launch pad
      for (const [id, agent] of Object.entries(this.state.agents)) {
        agent.speed = 0;
        agent.altitude = 0;
        agent.battery = 100;
        agent.orientation.pitch = 0;
        agent.orientation.roll = 0;
      }
      return;
    }

    const isDeploying = this.state.missionStatus === 'DEPLOYING';
    const targetAltitudes = { 'AAV-01': 42, 'AAV-02': 38, 'AAV-03': 45 };
    const launchPadBays: Record<string, { x: number; y: number }> = {
      'AAV-01': { x: -3.8, y: -12 },
      'AAV-02': { x: 0, y: -12 },
      'AAV-03': { x: 3.8, y: -12 },
    };
    const sectorEntryWaypoints: Record<string, { x: number; y: number }> = {
      'AAV-01': { x: -65, y: 55 },
      'AAV-02': { x: 70, y: 45 },
      'AAV-03': { x: 0, y: -75 },
    };

    for (const [id, agent] of Object.entries(this.state.agents)) {
      const targetAlt = targetAltitudes[id as keyof typeof targetAltitudes] || 40;
      const padPos = launchPadBays[id] || { x: 0, y: -12 };
      const sectorEntry = sectorEntryWaypoints[id] || { x: 0, y: 0 };

      // Battery consumption based on motor thrust and speed
      const dischargeRate = 0.045 + (agent.speed / 10) * 0.04;
      agent.battery = Math.max(12, agent.battery - dt * dischargeRate * 0.12);

      if (t < 3.5) {
        // --- PHASE 1: Vertical Liftoff from Common Launch Pad ---
        const climbProgress = Math.min(1.0, t / 3.5);
        agent.altitude = climbProgress * 18; // climb to 18m hover
        agent.position.x = padPos.x;
        agent.position.y = padPos.y;
        agent.position.z = agent.altitude;
        agent.speed = 5.1 * (1 - climbProgress * 0.3); // Vertical ascent speed
        agent.heading = 0;
        agent.orientation.yaw = 0;
        agent.orientation.pitch = Math.sin(t * 3) * 0.8;
        agent.orientation.roll = Math.cos(t * 2.8) * 0.6;
      } else if (t < 12.0) {
        // --- PHASE 2: Departure Vector Corridor to Assigned Sectors ---
        const transitProgress = Math.min(1.0, (t - 3.5) / 8.5);
        // Cubic smooth-step interpolation
        const s = transitProgress * transitProgress * (3 - 2 * transitProgress);

        const prevX = agent.position.x;
        const prevY = agent.position.y;

        agent.position.x = padPos.x + (sectorEntry.x - padPos.x) * s;
        agent.position.y = padPos.y + (sectorEntry.y - padPos.y) * s;
        agent.altitude = 18 + (targetAlt - 18) * s;
        agent.position.z = agent.altitude;

        const vx = (agent.position.x - prevX) / Math.max(dt, 0.001);
        const vy = (agent.position.y - prevY) / Math.max(dt, 0.001);
        agent.speed = Math.min(8.6, Math.hypot(vx, vy));

        const angle = (Math.atan2(vy, vx) * 180) / Math.PI;
        agent.heading = Math.round((angle + 360) % 360);
        agent.orientation.yaw = agent.heading;

        // Dynamic forward pitch (nose down with acceleration) and bank angle
        agent.orientation.pitch = -Math.min(14, (agent.speed / 8.5) * 12) + Math.sin(t * 2) * 0.6;
        if (id === 'AAV-01') {
          agent.orientation.roll = -12 + Math.sin(t * 1.5) * 1.5; // banking left
        } else if (id === 'AAV-02') {
          agent.orientation.roll = 14 + Math.cos(t * 1.5) * 1.5; // banking right
        } else {
          agent.orientation.roll = Math.sin(t * 2) * 1.2;
        }
      } else {
        // --- PHASE 3: Predefined Realistic Operational Survey Trajectories ---
        let cx = 0, cy = 0, rx = 28, ry = 22, omega = 0.12, phase = 0;
        if (id === 'AAV-01') {
          // Sector Alpha: Commercial Core Boustrophedon / Figure-eight
          cx = -62; cy = 52; rx = 24; ry = 20; omega = 0.14; phase = 0.4;
          agent.speed = 8.4 + Math.sin(t * 0.8) * 0.5;
        } else if (id === 'AAV-02') {
          // Sector Bravo: Logistics Hub Figure-eight Overpass Loops
          cx = 68; cy = 46; rx = 22; ry = 24; omega = 0.13; phase = 1.8;
          agent.speed = 7.9 + Math.cos(t * 0.7) * 0.6;
        } else if (id === 'AAV-03') {
          // Sector Charlie: Forward Perimeter Surveillance Sweep
          cx = 0; cy = -72; rx = 26; ry = 20; omega = 0.15; phase = 3.2;
          agent.speed = 8.8 + Math.sin(t * 0.9) * 0.4;
        }

        // Periodic excursions into inter-agent overlap corridors for collaborative SLAM
        const overlapBias = Math.sin(t * 0.08) * 12;
        const nextX = cx + Math.sin(t * omega + phase) * rx + (id === 'AAV-01' ? overlapBias : -overlapBias * 0.5);
        const nextY = cy + Math.sin(2 * (t * omega + phase)) * ry;

        const prevX = agent.position.x;
        const prevY = agent.position.y;
        const prevYaw = agent.orientation.yaw;

        agent.position.x = nextX;
        agent.position.y = nextY;
        // Subtle atmospheric turbulence altitude micro-variation
        agent.altitude = targetAlt + Math.sin(t * 1.1 + id.charCodeAt(4)) * 0.4;
        agent.position.z = agent.altitude;

        const vx = nextX - prevX;
        const vy = nextY - prevY;
        const targetAngle = (Math.atan2(vy, vx) * 180) / Math.PI;
        const normalizedAngle = (targetAngle + 360) % 360;

        // Smooth yaw tracking
        let yawDiff = normalizedAngle - prevYaw;
        while (yawDiff > 180) yawDiff -= 360;
        while (yawDiff < -180) yawDiff += 360;
        agent.orientation.yaw = (prevYaw + yawDiff * Math.min(1, dt * 5) + 360) % 360;
        agent.heading = Math.round(agent.orientation.yaw);

        // Realistic 6-DOF dynamic pitch and roll
        // Pitch: nose tilts down with forward cruise speed
        agent.orientation.pitch = -(agent.speed / 9.0) * 9.5 + Math.sin(t * 1.6) * 0.8;
        // Roll: banks into turn proportionally to turn rate
        const turnRate = yawDiff / Math.max(dt, 0.001);
        const targetRoll = -Math.max(-20, Math.min(20, turnRate * 0.22));
        agent.orientation.roll = targetRoll + Math.cos(t * 1.4) * 0.8;
      }

      // Record trajectory history (sample every 3 ticks or ~0.15s)
      const lastPoint = agent.trajectory[agent.trajectory.length - 1];
      const distFromLast = Math.hypot(agent.position.x - lastPoint.x, agent.position.y - lastPoint.y);
      if (distFromLast > 1.8) {
        agent.trajectory.push({ ...agent.position });
        if (agent.trajectory.length > 400) {
          agent.trajectory.shift();
        }
      }
    }
  }

  private updateSLAMGeneration(t: number, dt: number) {
    if (!['EXPLORING', 'MAPPING', 'FUSING', 'FUSED', 'COMPLETE'].includes(this.state.missionStatus)) return;

    for (const [id, agent] of Object.entries(this.state.agents)) {
      // Feature tracking counts
      agent.featuresTrackedPerFrame = Math.round(280 + Math.sin(t * 2 + id.charCodeAt(4)) * 60);

      // Keyframes creation rate (~1 keyframe every 0.6 sec of motion)
      if (Math.random() < dt * 1.8) {
        agent.keyframesCount += 1;
        const kf: Keyframe = {
          id: `kf_${id}_${agent.keyframesCount}`,
          agentId: id,
          timestamp: t,
          position: { ...agent.position },
          orientation: { ...agent.orientation },
          landmarkCount: Math.round(35 + Math.random() * 20),
          isLoopClosureCandidate: Math.random() > 0.85,
        };
        this.state.keyframes.push(kf);
        if (this.state.keyframes.length > 200) {
          this.state.keyframes.shift();
        }

        // Generate 3D visual landmarks near current building / ground location
        const landmarkBatchCount = Math.floor(4 + Math.random() * 5);
        agent.landmarksCount += landmarkBatchCount;

        for (let i = 0; i < landmarkBatchCount; i++) {
          const spread = 8 + Math.random() * 12;
          const angle = Math.random() * Math.PI * 2;
          const lx = agent.position.x + Math.cos(angle) * spread;
          const ly = agent.position.y + Math.sin(angle) * spread;
          // Projected landmark altitude on structures or terrain
          const lz = Math.max(0, Math.min(agent.position.z - 5, Math.random() * 32));

          const isSharedZone =
            Math.hypot(lx - 5, ly - 55) < 22 || // Sector Alpha/Bravo overlap
            Math.hypot(lx - 35, ly - (-15)) < 22 || // Bravo/Charlie overlap
            Math.hypot(lx - (-35), ly - (-15)) < 22; // Charlie/Alpha overlap

          const landmark: Landmark3D = {
            id: `lm_${id}_${this.state.landmarks.length + 1}`,
            position: { x: lx, y: ly, z: lz },
            agentId: id,
            descriptorId: Math.floor(Math.random() * 10000),
            confidence: 0.85 + Math.random() * 0.14,
            isShared: isSharedZone,
            sharedWithAgentId: isSharedZone
              ? id === 'AAV-01' ? 'AAV-02' : id === 'AAV-02' ? 'AAV-03' : 'AAV-01'
              : undefined,
          };

          this.state.landmarks.push(landmark);
          if (this.state.landmarks.length > 800) {
            this.state.landmarks.shift();
          }
        }

        // Periodic telemetry logging
        if (agent.keyframesCount === 50) {
          this.addEvent('SLAM', `${id}: Local submap initialized (50 keyframes, ${agent.landmarksCount} 3D landmarks)`, id);
          agent.localMapStatus = 'READY';
        } else if (agent.keyframesCount === 250) {
          this.addEvent('SLAM', `${id}: Submap density adequate for global alignment (>250 keyframes)`, id);
        }
      }
    }
  }

  private updateNetworkSimulation(t: number, dt: number) {
    const net = this.state.network;
    const isStressed = this.state.isStressTest;

    // Normal 5G metrics vs Stressed metrics
    if (isStressed) {
      // Periodic severe RF interference bursts / fading
      const spikeBurst = (Math.sin(t * 1.8) > 0.6) ? 25 + Math.random() * 25 : 0;
      net.latencyMs = Math.round(72 + Math.sin(t * 2.5) * 16 + spikeBurst + (Math.random() * 10 - 5));
      net.throughputMbps = Number((3.8 + Math.sin(t * 1.5) * 1.2).toFixed(1));
      net.packetLossPercent = Number((4.5 + Math.random() * 2.8).toFixed(1));
      net.jitterMs = Number((14.4 + Math.sin(t * 2) * 5.5).toFixed(1));
      net.signalQualityDbm = Math.round(-92 + Math.sin(t) * 6);
      net.sinrDb = Number((7.5 + Math.random() * 2.2).toFixed(1));
      net.packetsDropped += Math.floor(Math.random() * 3);
    } else {
      // Occasional minor network transient spike (~1-2% chance)
      const minorGlitch = Math.random() < 0.015 ? 12 : 0;
      net.latencyMs = Math.round(17.5 + Math.sin(t * 1.2) * 2.2 + minorGlitch + (Math.random() * 1.5 - 0.7));
      net.throughputMbps = Number((24.6 + Math.sin(t * 0.8) * 1.8 + Math.random() * 0.8).toFixed(1));
      net.packetLossPercent = Number((0.25 + Math.sin(t) * 0.08).toFixed(2));
      net.jitterMs = Number((2.1 + Math.sin(t * 2.5) * 0.4).toFixed(1));
      net.signalQualityDbm = Math.round(-68 + Math.sin(t * 0.5) * 3);
      net.sinrDb = Number((22.4 + Math.sin(t * 0.4) * 1.2).toFixed(1));
    }

    net.totalPacketsTransmitted += Math.floor(dt * 120);

    // Record latency sample for 60-second sliding window distribution
    if (!net.latencyHistory) {
      net.latencyHistory = [];
    }

    if (t - this.lastLatencySampleTime >= 0.5) {
      this.lastLatencySampleTime = t;
      const isSpike = net.latencyMs > 45;
      net.latencyHistory.push({
        timestamp: t,
        latencyMs: net.latencyMs,
        isSpike,
      });

      // Keep only samples from the last 60 seconds
      const cutoff = t - 60;
      net.latencyHistory = net.latencyHistory.filter((s) => s.timestamp >= cutoff);

      // Compute rolling metrics for the histogram and telemetry
      const latencies = net.latencyHistory.map((s) => s.latencyMs);
      net.spikeCountLast60s = net.latencyHistory.filter((s) => s.isSpike).length;
      net.maxLatencyLast60s = latencies.length > 0 ? Math.max(...latencies) : net.latencyMs;

      const sorted = [...latencies].sort((a, b) => a - b);
      const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
      net.p95LatencyLast60s = sorted[p95Index] || net.latencyMs;
    }

    // Update per-agent 5G uplink rates
    for (const [id, agent] of Object.entries(this.state.agents)) {
      agent.uplinkRateMbps = Number((net.throughputMbps / 3 + (id === 'AAV-01' ? 0.3 : -0.2)).toFixed(1));
      agent.rsrpDbm = net.signalQualityDbm + (id === 'AAV-01' ? 2 : id === 'AAV-02' ? -1 : 1);
      agent.localPacketsSent += Math.floor(dt * 40);
    }
  }

  private updateMECSimulation(t: number, dt: number) {
    const mec = this.state.mec;
    const isFusing = this.state.collabSlam.fusionStage !== 'IDLE' && this.state.collabSlam.fusionStage !== 'GLOBAL_FUSED';
    const isFused = this.state.collabSlam.fusionStage === 'GLOBAL_FUSED';

    // Base background loads
    if (isFusing) {
      mec.cpuUsage = Math.round(72 + Math.sin(t * 4) * 12);
      mec.gpuUsage = Math.round(84 + Math.sin(t * 3) * 10);
      mec.slamProcessingLoad = Math.round(88 + Math.random() * 8);
      mec.mapFusionLoad = Math.round(92 + Math.random() * 6);
      mec.memoryGb = Number((14.8 + Math.sin(t * 0.5) * 1.2).toFixed(1));
      mec.optimizationIterations += Math.floor(dt * 8);
      mec.chi2Error = Math.max(0.0042, mec.chi2Error * 0.96);
    } else if (isFused) {
      mec.cpuUsage = Math.round(34 + Math.sin(t * 0.5) * 4);
      mec.gpuUsage = Math.round(42 + Math.sin(t * 0.4) * 5);
      mec.slamProcessingLoad = 22;
      mec.mapFusionLoad = 8;
      mec.memoryGb = 9.8;
      mec.status = 'ONLINE';
    } else {
      mec.cpuUsage = Math.round(32 + Math.sin(t * 0.8) * 5);
      mec.gpuUsage = Math.round(44 + Math.sin(t * 0.6) * 6);
      mec.slamProcessingLoad = Math.round(35 + Math.sin(t) * 8);
      mec.mapFusionLoad = 0;
      mec.memoryGb = Number((6.2 + Math.sin(t * 0.2) * 0.4).toFixed(1));
      mec.status = 'ONLINE';
    }

    // Pose graph node and edge growth
    const totalKeyframes = Object.values(this.state.agents).reduce((acc, a) => acc + a.keyframesCount, 0);
    mec.poseGraphNodes = totalKeyframes;
    mec.poseGraphEdges = Math.round(totalKeyframes * 3.4 + this.state.collabSlam.loopClosuresDetected * 8);

    // Network stress adds frame reordering and queuing load to MEC
    if (this.state.network.stressMode && !isFusing && !isFused) {
      mec.slamProcessingLoad = Math.min(94, mec.slamProcessingLoad + Math.round(22 + Math.sin(t * 2.8) * 14 + Math.random() * 8));
      mec.cpuUsage = Math.min(95, mec.cpuUsage + 16);
      if (mec.slamProcessingLoad >= 75) {
        mec.status = 'OPTIMIZING';
      }
    }

    if (!mec.loadHistory) {
      mec.loadHistory = [];
    }

    // Record time-series sample every 1 second
    if (t - this.lastMecSampleTime >= 1.0) {
      this.lastMecSampleTime = t;
      const isBottleneck = mec.slamProcessingLoad >= 75;
      const elapsedSec = Math.floor(t);
      const timeStr = `${Math.floor(elapsedSec / 60).toString().padStart(2, '0')}:${Math.floor(elapsedSec % 60).toString().padStart(2, '0')}`;

      mec.loadHistory.push({
        time: timeStr,
        timestamp: t,
        slamLoad: mec.slamProcessingLoad,
        cpuUsage: mec.cpuUsage,
        gpuUsage: mec.gpuUsage,
        isBottleneck,
        activeThreads: isFusing ? 16 : 4,
      });

      // Keep recent 45 samples (approx 45 seconds of running history)
      if (mec.loadHistory.length > 45) {
        mec.loadHistory.shift();
      }

      const allLoads = mec.loadHistory.map((s) => s.slamLoad);
      mec.peakLoad = Math.max(...allLoads, mec.slamProcessingLoad);
      mec.bottleneckCount = mec.loadHistory.filter((s) => s.isBottleneck).length;
    }
  }

  private updateCollaborativeSLAM(t: number, dt: number) {
    const slam = this.state.collabSlam;

    // Automatic trigger check: When each agent has accumulated sufficient keyframes (>180) and time > 35s
    const allHaveSubmaps = Object.values(this.state.agents).every((a) => a.keyframesCount >= 180);
    if (slam.fusionStage === 'IDLE' && (allHaveSubmaps || t > 40)) {
      this.addEvent('SLAM', 'COVINS DETECTOR: Visual overlap threshold exceeded in Inter-Sector Buffer zone');
      this.addEvent('MEC', 'MEC Edge Server auto-triggered Multi-Agent Pose Graph Optimization (g2o backend)');
      slam.fusionStage = 'PLACE_RECOGNITION';
      this.state.missionStatus = 'FUSING';
      this.state.mec.status = 'OPTIMIZING';
    }

    if (slam.fusionStage === 'PLACE_RECOGNITION') {
      slam.fusionProgress = Math.min(35, slam.fusionProgress + dt * 15);
      slam.loopClosuresDetected = Math.min(14, Math.floor(slam.fusionProgress / 2.5));

      // Generate shared landmark correspondence matches between agents
      if (slam.sharedMatches.length === 0) {
        slam.sharedMatches = [
          {
            id: 'match_1',
            sourceAgentId: 'AAV-01',
            targetAgentId: 'AAV-02',
            sourceLandmarkPos: { x: 3, y: 52, z: 28 },
            targetLandmarkPos: { x: 7, y: 58, z: 30 },
            similarityScore: 0.94,
            residualErrorMeters: 0.038,
          },
          {
            id: 'match_2',
            sourceAgentId: 'AAV-02',
            targetAgentId: 'AAV-03',
            sourceLandmarkPos: { x: 32, y: -12, z: 22 },
            targetLandmarkPos: { x: 38, y: -18, z: 24 },
            similarityScore: 0.91,
            residualErrorMeters: 0.042,
          },
          {
            id: 'match_3',
            sourceAgentId: 'AAV-03',
            targetAgentId: 'AAV-01',
            sourceLandmarkPos: { x: -32, y: -14, z: 25 },
            targetLandmarkPos: { x: -38, y: -16, z: 26 },
            similarityScore: 0.93,
            residualErrorMeters: 0.035,
          },
        ];
        this.addEvent('SLAM', 'DBoW2 Vocabulary Tree: 3 inter-agent loop closure candidates identified with >90% BoW confidence');
      }

      if (slam.fusionProgress >= 35) {
        slam.fusionStage = 'POSE_GRAPH_OPT';
        slam.relativePoseEstimated = true;
        this.addEvent('MEC', 'SE(3) Relative Transformations estimated. Levenberg-Marquardt optimizer running on MEC GPU...');
      }
    } else if (slam.fusionStage === 'POSE_GRAPH_OPT') {
      slam.fusionProgress = Math.min(95, slam.fusionProgress + dt * 18);
      slam.sharedLandmarksCount = Math.round(180 + (slam.fusionProgress - 35) * 8);
      slam.alignmentConfidence = Math.min(98, Math.round(65 + (slam.fusionProgress - 35) * 0.55));

      if (slam.fusionProgress >= 95) {
        slam.fusionStage = 'GLOBAL_FUSED';
        slam.fusionProgress = 100;
        this.state.missionStatus = 'FUSED';
        this.state.mec.status = 'ONLINE';

        // Mark all agents as fused
        for (const id in this.state.agents) {
          this.state.agents[id].status = 'FUSED';
          this.state.agents[id].localMapStatus = 'FUSED';
          this.state.agents[id].slamMode = 'COVINS_COLLAB';
        }

        // Generate the high-density Global Fused Map
        this.generateGlobalFusedMap();

        this.addEvent('SUCCESS', '🎉 COLLABORATIVE MAP FUSION COMPLETE: Unified 3D Global Map generated at MEC Edge Server');
        this.addEvent('INFO', `Fused metrics: ${slam.globalLandmarksTotal} points, ${slam.globalKeyframesTotal} keyframes. Chi2 residual: 0.0042m`);
      }
    }
  }

  private generateGlobalFusedMap() {
    const fused: Landmark3D[] = [];
    const totalKeyframes = Object.values(this.state.agents).reduce((acc, a) => acc + a.keyframesCount, 0);

    // Merge all existing landmarks plus generate dense structural points on buildings and roads
    for (const lm of this.state.landmarks) {
      fused.push({
        ...lm,
        id: `fused_${lm.id}`,
        confidence: 0.98,
        isShared: true,
      });
    }

    // Add dense structural feature points along buildings to demonstrate high-definition 3D reconstruction
    for (const b of this.scenario.buildings) {
      const step = 4;
      for (let x = b.x - b.width / 2; x <= b.x + b.width / 2; x += step) {
        for (let y = b.y - b.depth / 2; y <= b.y + b.depth / 2; y += step) {
          // Roof point
          fused.push({
            id: `dense_roof_${b.id}_${x}_${y}`,
            position: { x, y, z: b.height },
            agentId: 'GLOBAL_FUSED',
            descriptorId: Math.floor(Math.random() * 10000),
            confidence: 0.99,
            isShared: true,
          });

          // Wall facades at heights
          for (let z = 0; z <= b.height; z += step * 1.5) {
            if (
              Math.abs(x - (b.x - b.width / 2)) < 1 ||
              Math.abs(x - (b.x + b.width / 2)) < 1 ||
              Math.abs(y - (b.y - b.depth / 2)) < 1 ||
              Math.abs(y - (b.y + b.depth / 2)) < 1
            ) {
              fused.push({
                id: `dense_wall_${b.id}_${x}_${y}_${z}`,
                position: { x, y, z },
                agentId: 'GLOBAL_FUSED',
                descriptorId: Math.floor(Math.random() * 10000),
                confidence: 0.97,
                isShared: true,
              });
            }
          }
        }
      }
    }

    this.state.fusedPointCloud = fused;
    this.state.collabSlam.globalLandmarksTotal = fused.length;
    this.state.collabSlam.globalKeyframesTotal = totalKeyframes;
  }
}
