import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { SimulationState } from '../simulation/simulationEngine';
import { Scenario, AAVTelemetry } from '../types/slam';
import {
  Compass,
  Maximize2,
  Minimize2,
  Radio,
  Layers,
  Eye,
  Crosshair,
  Wifi,
  Scan,
  AlertTriangle,
  Flame,
  ChevronDown,
  ChevronUp,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

export interface CoverageGapInfo {
  sector: string;
  quadrant: string;
  x: number;
  y: number;
  unmappedPercent: number;
  assignedAgent: string;
}

export interface CoverageMetrics {
  overallPercent: number;
  alphaPercent: number;
  bravoPercent: number;
  charliePercent: number;
  totalAreaM2: number;
  gapsCount: number;
  gapsList: CoverageGapInfo[];
}

interface Global3DMapProps {
  simState: SimulationState;
  scenario: Scenario;
  onSelectAgent?: (agentId: string) => void;
  selectedAgentId?: string | null;
}

export const Global3DMap: React.FC<Global3DMapProps> = ({
  simState,
  scenario,
  onSelectAgent,
  selectedAgentId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Dynamic visual object references
  const droneMeshesRef = useRef<Record<string, THREE.Group>>({});
  const rotorMeshesRef = useRef<THREE.Mesh[]>([]);
  const trajectoryLinesRef = useRef<Record<string, THREE.Line>>({});
  const cameraFrustumsRef = useRef<Record<string, THREE.LineSegments>>({});
  const dropLinesRef = useRef<Record<string, THREE.Line>>({});
  const networkBeamsRef = useRef<Record<string, THREE.Line>>({});
  const packetParticlesRef = useRef<Record<string, THREE.Mesh>>({});
  const localPointsRef = useRef<Record<string, THREE.Points>>({});
  const sharedMatchesLinesRef = useRef<THREE.LineSegments | null>(null);
  const globalFusedPointsRef = useRef<THREE.Points | null>(null);
  const radarSweepRef = useRef<THREE.Mesh | null>(null);

  // Heatmap Overlay & Coverage references
  const heatmapMeshRef = useRef<THREE.Mesh | null>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heatmapTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const gapMarkersGroupRef = useRef<THREE.Group | null>(null);
  const exploredPointsRef = useRef<Record<string, { x: number; y: number }[]>>({
    'AAV-01': [],
    'AAV-02': [],
    'AAV-03': [],
  });

  // Layer toggles (essential mission layers)
  const [showTrajectories, setShowTrajectories] = useState(true);
  const [showPointCloud, setShowPointCloud] = useState(true);
  const [show5GLinks, setShow5GLinks] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [isLayersDropdownOpen, setIsLayersDropdownOpen] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState<'THERMAL' | 'AGENT_SPECTRUM'>('THERMAL');
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.72);
  const [showCoverageGaps, setShowCoverageGaps] = useState(true);
  const [isCoveragePanelOpen, setIsCoveragePanelOpen] = useState(true);
  const [coverageMetrics, setCoverageMetrics] = useState<CoverageMetrics>({
    overallPercent: 0,
    alphaPercent: 0,
    bravoPercent: 0,
    charliePercent: 0,
    totalAreaM2: 0,
    gapsCount: 3,
    gapsList: [],
  });

  const [cameraMode, setCameraMode] = useState<'TACTICAL' | 'TOP_DOWN' | 'AAV-01' | 'AAV-02' | 'AAV-03' | 'MEC'>('TACTICAL');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Camera Orbit State
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const cameraSphericalRef = useRef({ radius: 190, theta: 0.8, phi: 1.1 });
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 5));

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#000000');
    scene.fog = new THREE.FogExp2('#000000', 0.0022);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0x18181b, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xe4e4e7, 1.8);
    dirLight.position.set(70, 90, 120);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 400;
    dirLight.shadow.camera.left = -150;
    dirLight.shadow.camera.right = 150;
    dirLight.shadow.camera.top = 150;
    dirLight.shadow.camera.bottom = -150;
    scene.add(dirLight);

    const blueHemisphere = new THREE.HemisphereLight(0x27272a, 0x000000, 0.7);
    scene.add(blueHemisphere);

    // 5. Build Environment
    buildEnvironment(scene, scenario);

    // 6. Build 5G Base Station & MEC Tower
    buildMECTower(scene);

    // 7. Setup Drones & Visual Objects
    buildDroneMeshes(scene);

    // 8. Handle Resize
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 9. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Spin rotors
      for (const rotor of rotorMeshesRef.current) {
        rotor.rotation.z += delta * 45;
      }

      // Rotate radar sweep
      if (radarSweepRef.current) {
        radarSweepRef.current.rotation.z -= delta * 1.5;
      }

      // Pulsate coverage gap markers if visible
      if (gapMarkersGroupRef.current && gapMarkersGroupRef.current.visible) {
        const pulse = (Math.sin(elapsed * 4) + 1) * 0.5;
        gapMarkersGroupRef.current.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
            const mat = (child as THREE.Mesh).material as THREE.Material & { opacity?: number };
            if (typeof mat.opacity === 'number') {
              mat.opacity = 0.35 + pulse * 0.55;
            }
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (heatmapTextureRef.current) {
        heatmapTextureRef.current.dispose();
      }
      if (heatmapMeshRef.current) {
        heatmapMeshRef.current.geometry.dispose();
        (heatmapMeshRef.current.material as THREE.Material).dispose();
      }
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [scenario]);

  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = cameraSphericalRef.current;
    const target = cameraTargetRef.current;

    cameraRef.current.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    cameraRef.current.position.y = target.y + radius * Math.cos(phi);
    cameraRef.current.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.lookAt(target);
  }, []);

  // Update dynamic objects when simState updates
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Update Drones, Trajectories, and Frustums
    for (const [id, agent] of Object.entries(simState.agents) as [string, AAVTelemetry][]) {
      const droneMesh = droneMeshesRef.current[id];
      if (droneMesh) {
        // Three.js: X is East/West, Y is Altitude, Z is North/South
        droneMesh.position.set(agent.position.x, agent.position.z, -agent.position.y);
        droneMesh.rotation.y = -THREE.MathUtils.degToRad(agent.heading);
        droneMesh.rotation.z = THREE.MathUtils.degToRad(agent.orientation.roll);
        droneMesh.rotation.x = THREE.MathUtils.degToRad(agent.orientation.pitch);

        // Update Drop line to ground
        const dropLine = dropLinesRef.current[id];
        if (dropLine) {
          const positions = dropLine.geometry.attributes.position as THREE.BufferAttribute;
          positions.setXYZ(0, agent.position.x, agent.position.z, -agent.position.y);
          positions.setXYZ(1, agent.position.x, 0, -agent.position.y);
          positions.needsUpdate = true;
          dropLine.visible = agent.altitude > 1;
        }

        // Camera Frustums omitted to prevent visual clutter
        const frustum = cameraFrustumsRef.current[id];
        if (frustum) {
          frustum.visible = false;
        }

        // Update 5G Network Beam from Drone to MEC Tower (at x: 0, y: 50, z: -5)
        const beam = networkBeamsRef.current[id];
        if (beam) {
          const pos = beam.geometry.attributes.position as THREE.BufferAttribute;
          pos.setXYZ(0, agent.position.x, agent.position.z, -agent.position.y);
          pos.setXYZ(1, 0, 48, -5);
          pos.needsUpdate = true;
          beam.visible = show5GLinks && agent.networkConnected;
          // Stress mode color change
          const mat = beam.material as THREE.LineBasicMaterial;
          mat.color.set(simState.isStressTest ? '#f59e0b' : agent.color);
        }

        // Update Flying 5G Packet Particle
        const packet = packetParticlesRef.current[id];
        if (packet) {
          const t = (performance.now() / 1000 * (simState.isStressTest ? 0.8 : 2.2) + (id === 'AAV-01' ? 0 : id === 'AAV-02' ? 0.33 : 0.66)) % 1;
          packet.position.set(
            agent.position.x * (1 - t) + 0 * t,
            agent.position.z * (1 - t) + 48 * t,
            -agent.position.y * (1 - t) - 5 * t
          );
          packet.visible = show5GLinks && agent.networkConnected && agent.altitude > 2;
        }
      }

      // Update Trajectory Ribbon
      let trajLine = trajectoryLinesRef.current[id];
      if (trajLine && agent.trajectory.length > 1) {
        const points = agent.trajectory.map((p) => new THREE.Vector3(p.x, p.z, -p.y));
        trajLine.geometry.setFromPoints(points);
        trajLine.visible = showTrajectories;
      }
    }

    // Update 3D SLAM Point Cloud (Local Landmarks per Agent)
    if (showPointCloud) {
      for (const id of ['AAV-01', 'AAV-02', 'AAV-03']) {
        const agentLandmarks = simState.landmarks.filter((l) => l.agentId === id);
        let ptsObj = localPointsRef.current[id];

        if (!ptsObj) {
          const geom = new THREE.BufferGeometry();
          const colorHex = id === 'AAV-01' ? 0x38bdf8 : id === 'AAV-02' ? 0xfbbf24 : 0x34d399;
          const mat = new THREE.PointsMaterial({
            size: 2.2,
            color: colorHex,
            transparent: true,
            opacity: 0.85,
          });
          ptsObj = new THREE.Points(geom, mat);
          scene.add(ptsObj);
          localPointsRef.current[id] = ptsObj;
        }

        if (agentLandmarks.length > 0) {
          const posArray = new Float32Array(agentLandmarks.length * 3);
          for (let i = 0; i < agentLandmarks.length; i++) {
            const p = agentLandmarks[i].position;
            posArray[i * 3] = p.x;
            posArray[i * 3 + 1] = p.z;
            posArray[i * 3 + 2] = -p.y;
          }
          ptsObj.geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
          ptsObj.visible = true;
        } else {
          ptsObj.visible = false;
        }
      }
    } else {
      for (const id in localPointsRef.current) {
        localPointsRef.current[id].visible = false;
      }
    }

    // Update Shared Landmark Correspondences (Yellow/Cyan link rays between AAVs during Loop Closure)
    if (showPointCloud && simState.collabSlam.sharedMatches.length > 0) {
      if (!sharedMatchesLinesRef.current) {
        const geom = new THREE.BufferGeometry();
        const mat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2, transparent: true, opacity: 0.9 });
        const lines = new THREE.LineSegments(geom, mat);
        scene.add(lines);
        sharedMatchesLinesRef.current = lines;
      }
      const coords: number[] = [];
      for (const match of simState.collabSlam.sharedMatches) {
        coords.push(match.sourceLandmarkPos.x, match.sourceLandmarkPos.z, -match.sourceLandmarkPos.y);
        coords.push(match.targetLandmarkPos.x, match.targetLandmarkPos.z, -match.targetLandmarkPos.y);
      }
      sharedMatchesLinesRef.current.geometry.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
      sharedMatchesLinesRef.current.visible = true;
    } else if (sharedMatchesLinesRef.current) {
      sharedMatchesLinesRef.current.visible = false;
    }

    // Update Global Fused 3D Point Cloud (High density fused representation)
    if (showPointCloud && simState.collabSlam.fusionStage === 'GLOBAL_FUSED') {
      if (!globalFusedPointsRef.current) {
        const geom = new THREE.BufferGeometry();
        const mat = new THREE.PointsMaterial({
          size: 2.8,
          vertexColors: true,
          transparent: true,
          opacity: 0.95,
        });
        const pts = new THREE.Points(geom, mat);
        scene.add(pts);
        globalFusedPointsRef.current = pts;
      }

      if (simState.fusedPointCloud.length > 0) {
        const posArray = new Float32Array(simState.fusedPointCloud.length * 3);
        const colArray = new Float32Array(simState.fusedPointCloud.length * 3);

        for (let i = 0; i < simState.fusedPointCloud.length; i++) {
          const pt = simState.fusedPointCloud[i].position;
          posArray[i * 3] = pt.x;
          posArray[i * 3 + 1] = pt.z;
          posArray[i * 3 + 2] = -pt.y;

          // Height-based elevation coloring for unified 3D map (Cyan -> Emerald -> Gold -> Orange)
          const normH = Math.min(1, Math.max(0, pt.z / 45));
          if (normH < 0.3) {
            colArray[i * 3] = 0.2;
            colArray[i * 3 + 1] = 0.8;
            colArray[i * 3 + 2] = 1.0; // Cyan
          } else if (normH < 0.6) {
            colArray[i * 3] = 0.2;
            colArray[i * 3 + 1] = 0.9;
            colArray[i * 3 + 2] = 0.5; // Green
          } else if (normH < 0.85) {
            colArray[i * 3] = 0.95;
            colArray[i * 3 + 1] = 0.85;
            colArray[i * 3 + 2] = 0.2; // Yellow
          } else {
            colArray[i * 3] = 1.0;
            colArray[i * 3 + 1] = 0.45;
            colArray[i * 3 + 2] = 0.2; // Orange
          }
        }

        globalFusedPointsRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        globalFusedPointsRef.current.geometry.setAttribute('color', new THREE.BufferAttribute(colArray, 3));
        globalFusedPointsRef.current.visible = true;
      }
    } else if (globalFusedPointsRef.current) {
      globalFusedPointsRef.current.visible = false;
    }

    // ==========================================
    // Update Ground Heatmap & Coverage Density
    // ==========================================
    if (simState.missionStatus === 'IDLE' || simState.simTimeSeconds < 0.2) {
      exploredPointsRef.current = { 'AAV-01': [], 'AAV-02': [], 'AAV-03': [] };
    }

    // Accumulate dense ground coverage points from AAV positions and trajectories
    for (const [id, agent] of Object.entries(simState.agents) as [string, AAVTelemetry][]) {
      if (!exploredPointsRef.current[id]) {
        exploredPointsRef.current[id] = [];
      }
      const history = exploredPointsRef.current[id];
      if (agent.trajectory && agent.trajectory.length > 0) {
        if (history.length === 0) {
          history.push(...agent.trajectory.map((p) => ({ x: p.x, y: p.y })));
        } else {
          const last = history[history.length - 1];
          const d = Math.hypot(agent.position.x - last.x, agent.position.y - last.y);
          if (d > 1.5) {
            history.push({ x: agent.position.x, y: agent.position.y });
          }
        }
      }
    }

    // Render Canvas and update Three.js texture
    if (heatmapCanvasRef.current && heatmapTextureRef.current) {
      renderHeatmapCanvas(
        heatmapCanvasRef.current,
        simState.agents,
        exploredPointsRef.current,
        scenario.groundRadius,
        heatmapMode
      );
      heatmapTextureRef.current.needsUpdate = true;
    }

    if (heatmapMeshRef.current) {
      heatmapMeshRef.current.visible = showHeatmap;
      const mat = heatmapMeshRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = heatmapOpacity;
      }
    }

    // Compute coverage percentages and identify gaps
    const calculatedMetrics = computeSectorCoverage(
      scenario,
      simState.agents,
      exploredPointsRef.current
    );
    setCoverageMetrics(calculatedMetrics);

    // Update 3D gap markers on terrain
    if (gapMarkersGroupRef.current) {
      update3DGapMarkers(
        gapMarkersGroupRef.current,
        calculatedMetrics.gapsList,
        showHeatmap && showCoverageGaps
      );
    }

    // Camera follow mode updates
    if (cameraMode.startsWith('AAV-')) {
      const followAgent = simState.agents[cameraMode];
      if (followAgent) {
        cameraTargetRef.current.set(followAgent.position.x, followAgent.position.z, -followAgent.position.y);
        updateCameraPosition();
      }
    }
  }, [
    simState,
    showTrajectories,
    showPointCloud,
    show5GLinks,
    showHeatmap,
    heatmapMode,
    heatmapOpacity,
    showCoverageGaps,
    scenario,
    cameraMode,
    updateCameraPosition,
  ]);

  // ==========================================
  // Area Exploration & Sector Coverage Analysis
  // ==========================================
  function computeSectorCoverage(
    scen: Scenario,
    agents: Record<string, AAVTelemetry>,
    exploredPoints: Record<string, { x: number; y: number }[]>
  ): CoverageMetrics {
    const sectors = scen.sectors || [];
    const sectorResults: Record<string, number> = { Alpha: 0, Bravo: 0, Charlie: 0 };
    const gapsList: CoverageGapInfo[] = [];

    // Aggregate all points from agents and explored history
    const allTrajectoryPoints: { x: number; y: number }[] = [];
    for (const [id, agent] of Object.entries(agents)) {
      if (agent.trajectory) {
        for (const p of agent.trajectory) {
          allTrajectoryPoints.push({ x: p.x, y: p.y });
        }
      }
      const history = exploredPoints[id];
      if (history) {
        for (const p of history) {
          allTrajectoryPoints.push({ x: p.x, y: p.y });
        }
      }
    }

    const sensorRadius = 20; // 20m sensor footprint

    for (const sector of sectors) {
      const probes: { x: number; y: number; quadrant: string }[] = [];
      probes.push({ x: sector.center.x, y: sector.center.y, quadrant: 'Core' });

      // Concentric rings of test probes
      const ringFractions = [0.3, 0.6, 0.85];
      const ringCounts = [6, 8, 10];

      for (let r = 0; r < ringFractions.length; r++) {
        const rad = sector.radius * ringFractions[r];
        const count = ringCounts[r];
        for (let i = 0; i < count; i++) {
          const angle = (i * Math.PI * 2) / count;
          const px = sector.center.x + Math.cos(angle) * rad;
          const py = sector.center.y + Math.sin(angle) * rad;
          const quad =
            Math.cos(angle) >= 0
              ? Math.sin(angle) >= 0 ? 'NE' : 'SE'
              : Math.sin(angle) >= 0 ? 'NW' : 'SW';
          probes.push({ x: px, y: py, quadrant: quad });
        }
      }

      let covered = 0;
      const unvisited: { x: number; y: number; quadrant: string }[] = [];

      for (const probe of probes) {
        let isCovered = false;
        for (let i = 0; i < allTrajectoryPoints.length; i++) {
          const pt = allTrajectoryPoints[i];
          const dx = pt.x - probe.x;
          const dy = pt.y - probe.y;
          if (dx * dx + dy * dy <= sensorRadius * sensorRadius) {
            isCovered = true;
            break;
          }
        }
        if (isCovered) {
          covered++;
        } else {
          unvisited.push(probe);
        }
      }

      const coveragePct = Math.min(100, Math.round((covered / probes.length) * 100));
      sectorResults[sector.id] = coveragePct;

      if (coveragePct < 72 && unvisited.length > 0) {
        const avgX = unvisited.reduce((s, p) => s + p.x, 0) / unvisited.length;
        const avgY = unvisited.reduce((s, p) => s + p.y, 0) / unvisited.length;

        const quadCounts: Record<string, number> = {};
        for (const p of unvisited) {
          quadCounts[p.quadrant] = (quadCounts[p.quadrant] || 0) + 1;
        }
        let topQuad = 'Perimeter';
        let maxQ = 0;
        for (const [q, cnt] of Object.entries(quadCounts)) {
          if (cnt > maxQ) {
            maxQ = cnt;
            topQuad = q;
          }
        }

        gapsList.push({
          sector: sector.id,
          quadrant: `${topQuad} Quadrant`,
          x: avgX,
          y: avgY,
          unmappedPercent: 100 - coveragePct,
          assignedAgent: sector.assignedAgent || 'AAV',
        });
      }
    }

    const alpha = sectorResults.Alpha ?? 0;
    const bravo = sectorResults.Bravo ?? 0;
    const charlie = sectorResults.Charlie ?? 0;
    const overall = Math.round((alpha + bravo + charlie) / 3);

    const totalM2 = Math.round(
      ((alpha * Math.PI * 48 * 48) + (bravo * Math.PI * 52 * 52) + (charlie * Math.PI * 50 * 50)) / 100
    ) + (overall > 0 ? 2100 : 0);

    return {
      overallPercent: overall,
      alphaPercent: alpha,
      bravoPercent: bravo,
      charliePercent: charlie,
      totalAreaM2: totalM2,
      gapsCount: gapsList.length,
      gapsList,
    };
  }

  // ==========================================
  // Render Dynamic Terrain Heatmap Canvas
  // ==========================================
  function renderHeatmapCanvas(
    canvas: HTMLCanvasElement,
    agents: Record<string, AAVTelemetry>,
    exploredPoints: Record<string, { x: number; y: number }[]>,
    groundRadius: number,
    mode: 'THERMAL' | 'AGENT_SPECTRUM'
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear to fully transparent (0 opacity in unvisited gaps)
    ctx.clearRect(0, 0, w, h);

    const toX = (wx: number) => ((wx + groundRadius) / (2 * groundRadius)) * w;
    const toY = (wy: number) => (1 - (wy + groundRadius) / (2 * groundRadius)) * h;
    const sensorRadiusPx = Math.max(16, Math.round((19 / (2 * groundRadius)) * w));

    // Overlapping coverage increases density with additive blending
    ctx.globalCompositeOperation = 'lighter';

    for (const [id, agent] of Object.entries(agents)) {
      const history = exploredPoints[id] || [];
      const points =
        history.length > 0
          ? history
          : agent.trajectory
          ? agent.trajectory.map((p) => ({ x: p.x, y: p.y }))
          : [];

      if (points.length === 0) continue;

      const agentColor =
        id === 'AAV-01'
          ? { r: 56, g: 189, b: 248 }
          : id === 'AAV-02'
          ? { r: 251, g: 191, b: 36 }
          : { r: 52, g: 211, b: 153 };

      // 1. Draw continuous swath corridor ribbon
      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(toX(points[0].x), toY(points[0].y));
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(toX(points[i].x), toY(points[i].y));
        }
        ctx.lineWidth = sensorRadiusPx * 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (mode === 'THERMAL') {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.20)';
        } else {
          ctx.strokeStyle = `rgba(${agentColor.r}, ${agentColor.g}, ${agentColor.b}, 0.22)`;
        }
        ctx.stroke();
      }

      // 2. Soft radial gradient disks along trajectory waypoints
      const step = Math.max(1, Math.floor(points.length / 75));
      for (let i = 0; i < points.length; i += step) {
        const pt = points[i];
        const px = toX(pt.x);
        const py = toY(pt.y);
        const recency = (i + 1) / points.length;
        const alphaScale = 0.5 + recency * 0.5;

        const grad = ctx.createRadialGradient(px, py, 2, px, py, sensorRadiusPx);

        if (mode === 'THERMAL') {
          // Thermal density: Amber core -> Emerald mid -> Cyan fringe -> Transparent edge
          grad.addColorStop(0, `rgba(245, 158, 11, ${0.40 * alphaScale})`);
          grad.addColorStop(0.35, `rgba(16, 185, 129, ${0.30 * alphaScale})`);
          grad.addColorStop(0.7, `rgba(6, 182, 212, ${0.18 * alphaScale})`);
          grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
        } else {
          grad.addColorStop(0, `rgba(${agentColor.r}, ${agentColor.g}, ${agentColor.b}, ${0.45 * alphaScale})`);
          grad.addColorStop(0.5, `rgba(${agentColor.r}, ${agentColor.g}, ${agentColor.b}, ${0.25 * alphaScale})`);
          grad.addColorStop(1, `rgba(${agentColor.r}, ${agentColor.g}, ${agentColor.b}, 0)`);
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, sensorRadiusPx, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Current active sensor footprint
      const cpx = toX(agent.position.x);
      const cpy = toY(agent.position.y);
      const currGrad = ctx.createRadialGradient(cpx, cpy, 3, cpx, cpy, sensorRadiusPx * 1.3);

      if (mode === 'THERMAL') {
        currGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
        currGrad.addColorStop(0.3, 'rgba(245, 158, 11, 0.50)');
        currGrad.addColorStop(0.7, 'rgba(6, 182, 212, 0.28)');
        currGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      } else {
        currGrad.addColorStop(0, 'rgba(255, 255, 255, 0.70)');
        currGrad.addColorStop(0.4, `rgba(${agentColor.r}, ${agentColor.g}, ${agentColor.b}, 0.55)`);
        currGrad.addColorStop(1, `rgba(${agentColor.r}, ${agentColor.g}, ${agentColor.b}, 0)`);
      }

      ctx.fillStyle = currGrad;
      ctx.beginPath();
      ctx.arc(cpx, cpy, sensorRadiusPx * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  // ==========================================
  // Update 3D Coverage Gap Markers on Terrain
  // ==========================================
  function update3DGapMarkers(
    group: THREE.Group,
    gapsList: CoverageGapInfo[],
    visible: boolean
  ) {
    group.visible = visible;
    if (!visible) return;

    // Clear previous children
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) (child as any).material.dispose();
    }

    for (const gap of gapsList) {
      const markerGroup = new THREE.Group();
      markerGroup.position.set(gap.x, 0, -gap.y);

      // Hazard boundary ring on terrain
      const ringGeom = new THREE.RingGeometry(16, 18.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = -Math.PI / 2;
      markerGroup.add(ring);

      // Inner dashed zone indicator
      const innerRingGeom = new THREE.RingGeometry(10.5, 12, 24);
      const innerRingMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const innerRing = new THREE.Mesh(innerRingGeom, innerRingMat);
      innerRing.rotation.x = -Math.PI / 2;
      markerGroup.add(innerRing);

      // Vertical dashed beacon line
      const poleGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 10, 0),
      ]);
      const poleMat = new THREE.LineDashedMaterial({
        color: 0xf59e0b,
        dashSize: 1.5,
        gapSize: 1.5,
        transparent: true,
        opacity: 0.8,
      });
      const pole = new THREE.Line(poleGeom, poleMat);
      pole.computeLineDistances();
      markerGroup.add(pole);

      // Floating hazard beacon octahedron
      const beaconGeom = new THREE.OctahedronGeometry(1.4, 0);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.9,
      });
      const beacon = new THREE.Mesh(beaconGeom, beaconMat);
      beacon.position.y = 10;
      markerGroup.add(beacon);

      group.add(markerGroup);
    }
  }

  // Environment Construction
  function buildEnvironment(scene: THREE.Scene, scen: Scenario) {
    // Ground plane with subtle military grid texture
    const groundGeom = new THREE.PlaneGeometry(scen.groundRadius * 2, scen.groundRadius * 2, 40, 40);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x020203,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Tactical Grid
    const grid = new THREE.GridHelper(scen.groundRadius * 2, 80, 0x27272a, 0x09090b);
    grid.position.y = 0.05;
    scene.add(grid);

    // Concentric Range Rings (50m, 100m, 150m)
    for (const radius of [40, 80, 120, 160]) {
      const ringGeom = new THREE.RingGeometry(radius - 0.25, radius + 0.25, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x27272a, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.1;
      scene.add(ring);
    }

    // Sectors boundaries (Alpha, Bravo, Charlie)
    const sectorColors = { Alpha: 0x38bdf8, Bravo: 0xfbbf24, Charlie: 0x34d399 };
    for (const sector of scen.sectors) {
      const col = sectorColors[sector.id] || 0x64748b;

      // Sector perimeter circle
      const circGeom = new THREE.RingGeometry(sector.radius - 0.4, sector.radius + 0.4, 48);
      const circMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      const circ = new THREE.Mesh(circGeom, circMat);
      circ.rotation.x = -Math.PI / 2;
      circ.position.set(sector.center.x, 0.2, -sector.center.y);
      scene.add(circ);

      // Sector fill zone (subtle glow)
      const fillGeom = new THREE.CircleGeometry(sector.radius, 48);
      const fillMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.04, side: THREE.DoubleSide });
      const fill = new THREE.Mesh(fillGeom, fillMat);
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(sector.center.x, 0.15, -sector.center.y);
      scene.add(fill);

      // Sector center beacon marker
      const markerGeom = new THREE.CylinderGeometry(1.5, 1.5, 0.4, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8 });
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.set(sector.center.x, 0.3, -sector.center.y);
      scene.add(marker);
    }

    // 3D Buildings with rooftop detailing and rubble
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x0c0c0e,
      roughness: 0.8,
      metalness: 0.2,
    });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x52525b, transparent: true, opacity: 0.5 });
    const rubbleMat = new THREE.MeshStandardMaterial({
      color: 0x141416,
      roughness: 0.95,
      metalness: 0.05,
    });
    const hvacMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.6 });

    for (const b of scen.buildings) {
      if (b.type === 'tower') continue; // MEC Tower is built separately
      const geom = new THREE.BoxGeometry(b.width, b.height, b.depth);
      const mesh = new THREE.Mesh(geom, b.type === 'rubble' ? rubbleMat : buildingMat);
      mesh.position.set(b.x, b.height / 2, -b.y);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // CAD/Wireframe edges
      const edges = new THREE.EdgesGeometry(geom);
      const line = new THREE.LineSegments(edges, edgeMat);
      line.position.copy(mesh.position);
      scene.add(line);

      // Rooftop structures for taller buildings
      if (b.height > 25 && b.type !== 'rubble') {
        // Rooftop elevator penthouse / HVAC
        const hvacGeom = new THREE.BoxGeometry(b.width * 0.35, 3.5, b.depth * 0.35);
        const hvac = new THREE.Mesh(hvacGeom, hvacMat);
        hvac.position.set(b.x, b.height + 1.75, -b.y);
        scene.add(hvac);

        // Rooftop warning antenna
        const antennaGeom = new THREE.CylinderGeometry(0.1, 0.1, 6, 6);
        const antennaMat = new THREE.MeshBasicMaterial({ color: 0x64748b });
        const antenna = new THREE.Mesh(antennaGeom, antennaMat);
        antenna.position.set(b.x + b.width * 0.3, b.height + 3, -b.y + b.depth * 0.3);
        scene.add(antenna);

        const beaconGeom = new THREE.SphereGeometry(0.4, 8, 8);
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const beacon = new THREE.Mesh(beaconGeom, beaconMat);
        beacon.position.set(b.x + b.width * 0.3, b.height + 6, -b.y + b.depth * 0.3);
        scene.add(beacon);
      } else if (b.type === 'rubble') {
        // Angled collapse slabs
        const slabGeom = new THREE.BoxGeometry(b.width * 0.6, 1.2, b.depth * 0.5);
        const slab = new THREE.Mesh(slabGeom, rubbleMat);
        slab.position.set(b.x + 2, b.height + 0.5, -b.y - 1);
        slab.rotation.set(0.2, 0.4, -0.3);
        scene.add(slab);
      }
    }

    // Asphalt Roads (cross intersections)
    const roadMat = new THREE.MeshBasicMaterial({ color: 0x0a101d });
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(scen.groundRadius * 1.8, 14), roadMat);
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.set(0, 0.06, 0);
    scene.add(roadX);

    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(14, scen.groundRadius * 1.8), roadMat);
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.set(0, 0.07, 0);
    scene.add(roadZ);

    // Dashed Road Centerlines
    const stripeMat = new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 3, gapSize: 3 });
    const stripeGeomX = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-scen.groundRadius * 0.9, 0.08, 0),
      new THREE.Vector3(scen.groundRadius * 0.9, 0.08, 0),
    ]);
    const stripeX = new THREE.Line(stripeGeomX, stripeMat);
    stripeX.computeLineDistances();
    scene.add(stripeX);

    const stripeGeomZ = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.09, -scen.groundRadius * 0.9),
      new THREE.Vector3(0, 0.09, scen.groundRadius * 0.9),
    ]);
    const stripeZ = new THREE.Line(stripeGeomZ, stripeMat);
    stripeZ.computeLineDistances();
    scene.add(stripeZ);

    // ==========================================
    // Central Staging & Common Launch Pad (x: 0, z: 12)
    // ==========================================
    const padGroup = new THREE.Group();
    padGroup.position.set(0, 0.1, 12);

    // Main octagonal reinforced concrete launch platform
    const padPlatformGeom = new THREE.CylinderGeometry(9, 9.5, 0.2, 8);
    const padPlatformMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.2 });
    const padPlatform = new THREE.Mesh(padPlatformGeom, padPlatformMat);
    padPlatform.position.y = 0.1;
    padGroup.add(padPlatform);

    // Platform hazard border ring
    const hazardRingGeom = new THREE.RingGeometry(8.2, 8.8, 32);
    const hazardRingMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const hazardRing = new THREE.Mesh(hazardRingGeom, hazardRingMat);
    hazardRing.rotation.x = -Math.PI / 2;
    hazardRing.position.y = 0.21;
    padGroup.add(hazardRing);

    // Inner landing circle
    const innerRingGeom = new THREE.RingGeometry(5.2, 5.5, 32);
    const innerRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const innerRing = new THREE.Mesh(innerRingGeom, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.22;
    padGroup.add(innerRing);

    // 3 Distinct Common Launch Bays (Alpha: x=-3.8, Bravo: x=0, Charlie: x=3.8)
    const bayConfigs = [
      { id: 'PAD-01', x: -3.8, color: 0x38bdf8, label: 'BAY 1 (ALPHA)' },
      { id: 'PAD-02', x: 0, color: 0xfbbf24, label: 'BAY 2 (BRAVO)' },
      { id: 'PAD-03', x: 3.8, color: 0x34d399, label: 'BAY 3 (CHARLIE)' },
    ];

    for (const bay of bayConfigs) {
      const bayRingGeom = new THREE.RingGeometry(1.6, 1.8, 24);
      const bayRingMat = new THREE.MeshBasicMaterial({ color: bay.color, side: THREE.DoubleSide });
      const bayRing = new THREE.Mesh(bayRingGeom, bayRingMat);
      bayRing.rotation.x = -Math.PI / 2;
      bayRing.position.set(bay.x, 0.23, 0);
      padGroup.add(bayRing);

      // Pad crosshairs
      const crosshairGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(bay.x - 1.2, 0.24, 0),
        new THREE.Vector3(bay.x + 1.2, 0.24, 0),
        new THREE.Vector3(bay.x, 0.24, -1.2),
        new THREE.Vector3(bay.x, 0.24, 1.2),
      ]);
      const crosshairMat = new THREE.LineBasicMaterial({ color: bay.color, transparent: true, opacity: 0.7 });
      const crosshair = new THREE.LineSegments(crosshairGeom, crosshairMat);
      padGroup.add(crosshair);
    }

    // 4 Corner Runway Guidance Beacons (Pulsating green/amber lights)
    const beaconCoords = [
      [-7.5, -7.5],
      [7.5, -7.5],
      [-7.5, 7.5],
      [7.5, 7.5],
    ];
    for (const [bx, bz] of beaconCoords) {
      const postGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.8, 8);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
      const post = new THREE.Mesh(postGeom, postMat);
      post.position.set(bx, 0.4, bz);
      padGroup.add(post);

      const lightGeom = new THREE.SphereGeometry(0.3, 8, 8);
      const lightMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const light = new THREE.Mesh(lightGeom, lightMat);
      light.position.set(bx, 0.8, bz);
      padGroup.add(light);
    }

    // Taxiway connecting launch pad to main crossroads
    const taxiwayGeom = new THREE.PlaneGeometry(8, 12);
    const taxiwayMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const taxiway = new THREE.Mesh(taxiwayGeom, taxiwayMat);
    taxiway.rotation.x = -Math.PI / 2;
    taxiway.position.set(0, 0.05, -6);
    padGroup.add(taxiway);

    scene.add(padGroup);

    // ==========================================
    // Ground Heatmap Overlay Plane (Area Explored Density)
    // ==========================================
    const heatmapCanvas = document.createElement('canvas');
    heatmapCanvas.width = 512;
    heatmapCanvas.height = 512;
    heatmapCanvasRef.current = heatmapCanvas;

    const heatmapTexture = new THREE.CanvasTexture(heatmapCanvas);
    heatmapTexture.minFilter = THREE.LinearFilter;
    heatmapTexture.magFilter = THREE.LinearFilter;
    heatmapTexture.generateMipmaps = false;
    heatmapTextureRef.current = heatmapTexture;

    const heatmapGeom = new THREE.PlaneGeometry(scen.groundRadius * 2, scen.groundRadius * 2);
    const heatmapMat = new THREE.MeshBasicMaterial({
      map: heatmapTexture,
      transparent: true,
      opacity: heatmapOpacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.DoubleSide,
    });
    const heatmapMesh = new THREE.Mesh(heatmapGeom, heatmapMat);
    heatmapMesh.rotation.x = -Math.PI / 2;
    heatmapMesh.position.y = 0.11;
    heatmapMesh.visible = showHeatmap;
    scene.add(heatmapMesh);
    heatmapMeshRef.current = heatmapMesh;

    // Coverage Gap 3D Markers Group
    const gapGroup = new THREE.Group();
    gapGroup.name = 'coverage-gaps-group';
    gapGroup.position.y = 0.16;
    gapGroup.visible = showHeatmap && showCoverageGaps;
    scene.add(gapGroup);
    gapMarkersGroupRef.current = gapGroup;
  }

  // Build Central 5G Base Station & MEC Edge Tower
  function buildMECTower(scene: THREE.Scene) {
    const group = new THREE.Group();
    group.position.set(0, 0, -5);

    // Tower base platform
    const baseGeom = new THREE.CylinderGeometry(8, 9, 2, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.y = 1;
    group.add(base);

    // Lattice mast
    const mastGeom = new THREE.CylinderGeometry(1.2, 2.5, 48, 6);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
    const mast = new THREE.Mesh(mastGeom, mastMat);
    mast.position.y = 25;
    group.add(mast);

    // 5G Active Antenna Units (AAU) panels (Tri-sector)
    const panelGeom = new THREE.BoxGeometry(1.2, 5, 2.5);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.3 });
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const panel = new THREE.Mesh(panelGeom, panelMat);
      panel.position.set(Math.cos(angle) * 3, 44, Math.sin(angle) * 3);
      panel.rotation.y = -angle;
      group.add(panel);
    }

    // Top Beacon
    const beaconGeom = new THREE.SphereGeometry(0.8, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const beacon = new THREE.Mesh(beaconGeom, beaconMat);
    beacon.position.y = 50;
    group.add(beacon);

    // Microwave dish
    const dishGeom = new THREE.CylinderGeometry(2, 2, 0.6, 16);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
    const dish = new THREE.Mesh(dishGeom, dishMat);
    dish.position.set(0, 36, 1.8);
    dish.rotation.x = Math.PI / 2;
    group.add(dish);

    // Rotating Radar Sweep Ring
    const radarGeom = new THREE.RingGeometry(2, 140, 32, 1, 0, Math.PI / 3);
    const radarMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const radar = new THREE.Mesh(radarGeom, radarMat);
    radar.rotation.x = -Math.PI / 2;
    radar.position.y = 0.4;
    radarSweepRef.current = radar;
    group.add(radar);

    scene.add(group);
  }

  // Build Procedural Quadcopter Drone Models
  function buildDroneMeshes(scene: THREE.Scene) {
    const agentConfigs = [
      { id: 'AAV-01', color: 0x38bdf8 },
      { id: 'AAV-02', color: 0xfbbf24 },
      { id: 'AAV-03', color: 0x34d399 },
    ];

    for (const cfg of agentConfigs) {
      const drone = new THREE.Group();

      // Main fuselage
      const bodyGeom = new THREE.BoxGeometry(2.4, 0.8, 3.2);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      drone.add(body);

      // Top accent shield with agent color
      const shieldGeom = new THREE.BoxGeometry(1.6, 0.3, 2.2);
      const shieldMat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.3, metalness: 0.5 });
      const shield = new THREE.Mesh(shieldGeom, shieldMat);
      shield.position.y = 0.5;
      drone.add(shield);

      // Front Stereo SLAM Camera lens
      const camGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 12);
      const camMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const leftCam = new THREE.Mesh(camGeom, camMat);
      leftCam.rotation.x = Math.PI / 2;
      leftCam.position.set(-0.6, -0.2, 1.7);
      drone.add(leftCam);

      const rightCam = new THREE.Mesh(camGeom, camMat);
      rightCam.rotation.x = Math.PI / 2;
      rightCam.position.set(0.6, -0.2, 1.7);
      drone.add(rightCam);

      // 4 Carbon Arms & Rotor Motors
      const armGeom = new THREE.CylinderGeometry(0.12, 0.12, 3.6, 8);
      const armMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });

      const arm1 = new THREE.Mesh(armGeom, armMat);
      arm1.rotation.z = Math.PI / 2;
      arm1.rotation.y = Math.PI / 4;
      drone.add(arm1);

      const arm2 = new THREE.Mesh(armGeom, armMat);
      arm2.rotation.z = Math.PI / 2;
      arm2.rotation.y = -Math.PI / 4;
      drone.add(arm2);

      // 4 Rotor blades
      const rotorGeom = new THREE.BoxGeometry(2.4, 0.05, 0.2);
      const rotorMat = new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.7 });
      const motorOffsets = [
        [1.3, 0.4, 1.3],
        [-1.3, 0.4, 1.3],
        [1.3, 0.4, -1.3],
        [-1.3, 0.4, -1.3],
      ];

      for (const [mx, my, mz] of motorOffsets) {
        const rotor = new THREE.Mesh(rotorGeom, rotorMat);
        rotor.position.set(mx, my, mz);
        drone.add(rotor);
        rotorMeshesRef.current.push(rotor);
      }

      scene.add(drone);
      droneMeshesRef.current[cfg.id] = drone;

      // Trajectory line
      const trajGeom = new THREE.BufferGeometry();
      const trajMat = new THREE.LineBasicMaterial({ color: cfg.color, linewidth: 2, transparent: true, opacity: 0.75 });
      const trajLine = new THREE.Line(trajGeom, trajMat);
      scene.add(trajLine);
      trajectoryLinesRef.current[cfg.id] = trajLine;

      // Drop line to ground
      const dropGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
      const dropMat = new THREE.LineDashedMaterial({ color: cfg.color, dashSize: 2, gapSize: 1.5, transparent: true, opacity: 0.4 });
      const dropLine = new THREE.Line(dropGeom, dropMat);
      scene.add(dropLine);
      dropLinesRef.current[cfg.id] = dropLine;

      // Downward SLAM Camera Frustum Wireframe
      const frustumGeom = new THREE.BufferGeometry();
      // Frustum apex at (0,0,0), base projecting downwards (z forward, y downward)
      const fw = 12, fh = 8, fdist = 25;
      const fVerts = [
        0, 0, 0,   -fw, -fdist, fw,
        0, 0, 0,   fw, -fdist, fw,
        0, 0, 0,   fw, -fdist, -fw,
        0, 0, 0,   -fw, -fdist, -fw,
        -fw, -fdist, fw,   fw, -fdist, fw,
        fw, -fdist, fw,   fw, -fdist, -fw,
        fw, -fdist, -fw,  -fw, -fdist, -fw,
        -fw, -fdist, -fw, -fw, -fdist, fw,
      ];
      frustumGeom.setAttribute('position', new THREE.Float32BufferAttribute(fVerts, 3));
      const frustumMat = new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.25 });
      const frustum = new THREE.LineSegments(frustumGeom, frustumMat);
      scene.add(frustum);
      cameraFrustumsRef.current[cfg.id] = frustum;

      // 5G Network Beam to MEC
      const beamGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 48, -5)]);
      const beamMat = new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.4 });
      const beam = new THREE.Line(beamGeom, beamMat);
      scene.add(beam);
      networkBeamsRef.current[cfg.id] = beam;

      // 5G Flying Packet Particle
      const packetGeom = new THREE.SphereGeometry(0.8, 12, 12);
      const packetMat = new THREE.MeshBasicMaterial({ color: cfg.color });
      const packet = new THREE.Mesh(packetGeom, packetMat);
      scene.add(packet);
      packetParticlesRef.current[cfg.id] = packet;
    }
  }

  // Camera preset controls
  const handleSetCameraMode = (mode: typeof cameraMode) => {
    setCameraMode(mode);
    if (mode === 'TACTICAL') {
      cameraSphericalRef.current = { radius: 190, theta: 0.8, phi: 1.1 };
      cameraTargetRef.current = new THREE.Vector3(0, 0, 5);
      updateCameraPosition();
    } else if (mode === 'TOP_DOWN') {
      cameraSphericalRef.current = { radius: 210, theta: 0, phi: 0.05 };
      cameraTargetRef.current = new THREE.Vector3(0, 0, 0);
      updateCameraPosition();
    } else if (mode === 'MEC') {
      cameraSphericalRef.current = { radius: 120, theta: 2.2, phi: 1.3 };
      cameraTargetRef.current = new THREE.Vector3(0, 30, -5);
      updateCameraPosition();
    }
  };

  // Mouse interaction for Orbit
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    cameraSphericalRef.current.theta -= dx * 0.008;
    cameraSphericalRef.current.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, cameraSphericalRef.current.phi - dy * 0.008));
    updateCameraPosition();
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    cameraSphericalRef.current.radius = Math.max(30, Math.min(350, cameraSphericalRef.current.radius + e.deltaY * 0.15));
    updateCameraPosition();
  };

  return (
    <div
      ref={containerRef}
      id="global-3d-map-container"
      className="relative w-full h-full min-h-[420px] bg-black overflow-hidden select-none cursor-grab active:cursor-grabbing border border-zinc-800"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Top Left: Map Layers Dropdown Menu */}
      <div className="absolute top-2.5 left-2.5 z-30 font-sans select-none pointer-events-auto">
        <button
          id="btn-map-layers-dropdown"
          onClick={(e) => {
            e.stopPropagation();
            setIsLayersDropdownOpen(!isLayersDropdownOpen);
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border backdrop-blur-md shadow-lg transition-all cursor-pointer text-xs font-semibold ${
            isLayersDropdownOpen
              ? 'bg-zinc-900 border-cyan-500 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
              : 'bg-black/90 border-zinc-800 text-zinc-100 hover:border-zinc-700 hover:bg-zinc-950'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Layers</span>
          <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-xs bg-zinc-900 border border-zinc-800 text-zinc-400 font-medium">
            {[showHeatmap, showTrajectories, showPointCloud, show5GLinks].filter(Boolean).length}/4
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isLayersDropdownOpen ? 'rotate-180 text-cyan-400' : ''}`} />
        </button>

        {/* Dropdown Menu Popup */}
        {isLayersDropdownOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full left-0 mt-1.5 w-64 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-sm shadow-2xl p-2.5 z-40 space-y-1.5 font-sans animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 px-1">
              <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">Map Layers</span>
              <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                {[showHeatmap, showTrajectories, showPointCloud, show5GLinks].filter(Boolean).length} Active
              </span>
            </div>

            {/* Layer Toggles List */}
            <div className="space-y-1 pt-1">
              {/* Heatmap Toggle */}
              <button
                id="toggle-dropdown-heatmap"
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`w-full flex items-center justify-between p-2 rounded-xs border text-xs transition-all cursor-pointer ${
                  showHeatmap
                    ? 'bg-zinc-900/90 border-amber-500/60 text-amber-300 font-semibold'
                    : 'bg-black/60 border-zinc-850 text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Scan className={`w-3.5 h-3.5 ${showHeatmap ? 'text-amber-400' : 'text-zinc-500'}`} />
                  <span>Area Density Heatmap</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono tabular-nums px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60">
                    {coverageMetrics.overallPercent}%
                  </span>
                  <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${showHeatmap ? 'bg-amber-500 border-amber-400' : 'border-zinc-700'}`}>
                    {showHeatmap && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                  </div>
                </div>
              </button>

              {/* Trajectories Toggle */}
              <button
                id="toggle-dropdown-trajectories"
                onClick={() => setShowTrajectories(!showTrajectories)}
                className={`w-full flex items-center justify-between p-2 rounded-xs border text-xs transition-all cursor-pointer ${
                  showTrajectories
                    ? 'bg-zinc-900/90 border-cyan-500/60 text-cyan-300 font-semibold'
                    : 'bg-black/60 border-zinc-850 text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Compass className={`w-3.5 h-3.5 ${showTrajectories ? 'text-cyan-400' : 'text-zinc-500'}`} />
                  <span>AAV Trajectories</span>
                </div>
                <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${showTrajectories ? 'bg-cyan-500 border-cyan-400' : 'border-zinc-700'}`}>
                  {showTrajectories && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                </div>
              </button>

              {/* Point Cloud Toggle */}
              <button
                id="toggle-dropdown-pointcloud"
                onClick={() => setShowPointCloud(!showPointCloud)}
                className={`w-full flex items-center justify-between p-2 rounded-xs border text-xs transition-all cursor-pointer ${
                  showPointCloud
                    ? 'bg-zinc-900/90 border-cyan-500/60 text-cyan-300 font-semibold'
                    : 'bg-black/60 border-zinc-850 text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Radio className={`w-3.5 h-3.5 ${showPointCloud ? 'text-cyan-400' : 'text-zinc-500'}`} />
                  <span>3D SLAM Point Cloud</span>
                </div>
                <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${showPointCloud ? 'bg-cyan-500 border-cyan-400' : 'border-zinc-700'}`}>
                  {showPointCloud && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                </div>
              </button>

              {/* 5G Links Toggle */}
              <button
                id="toggle-dropdown-5glinks"
                onClick={() => setShow5GLinks(!show5GLinks)}
                className={`w-full flex items-center justify-between p-2 rounded-xs border text-xs transition-all cursor-pointer ${
                  show5GLinks
                    ? 'bg-zinc-900/90 border-cyan-500/60 text-cyan-300 font-semibold'
                    : 'bg-black/60 border-zinc-850 text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wifi className={`w-3.5 h-3.5 ${show5GLinks ? 'text-cyan-400' : 'text-zinc-500'}`} />
                  <span>5G RF Mesh Links</span>
                </div>
                <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${show5GLinks ? 'bg-cyan-500 border-cyan-400' : 'border-zinc-700'}`}>
                  {show5GLinks && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top Right: Thinner Camera View Selector & Fullscreen */}
      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 bg-black/90 backdrop-blur-md p-0.5 rounded-xs border border-zinc-800 text-[10px] shadow-lg">
        <button
          id="btn-cam-tactical"
          onClick={() => handleSetCameraMode('TACTICAL')}
          className={`px-1.5 py-0.5 rounded-xs font-mono font-medium transition-colors cursor-pointer leading-tight ${
            cameraMode === 'TACTICAL' ? 'bg-cyan-600 text-black font-bold' : 'text-zinc-300 hover:bg-zinc-900'
          }`}
        >
          TACTICAL
        </button>
        <button
          id="btn-cam-topdown"
          onClick={() => handleSetCameraMode('TOP_DOWN')}
          className={`px-1.5 py-0.5 rounded-xs font-mono font-medium transition-colors cursor-pointer leading-tight ${
            cameraMode === 'TOP_DOWN' ? 'bg-cyan-600 text-black font-bold' : 'text-zinc-300 hover:bg-zinc-900'
          }`}
        >
          TOP-DOWN
        </button>
        <button
          id="btn-cam-mec"
          onClick={() => handleSetCameraMode('MEC')}
          className={`px-1.5 py-0.5 rounded-xs font-mono font-medium transition-colors cursor-pointer leading-tight ${
            cameraMode === 'MEC' ? 'bg-cyan-600 text-black font-bold' : 'text-zinc-300 hover:bg-zinc-900'
          }`}
        >
          MEC TOWER
        </button>
        <div className="h-3 w-px bg-zinc-800 mx-0.5" />
        <button
          id="btn-cam-aav01"
          onClick={() => handleSetCameraMode('AAV-01')}
          className={`px-1.5 py-0.5 rounded-xs font-mono text-[10px] transition-colors cursor-pointer leading-tight ${
            cameraMode === 'AAV-01' ? 'bg-sky-500 text-black font-bold' : 'text-sky-400 hover:bg-zinc-900'
          }`}
        >
          AAV-1
        </button>
        <button
          id="btn-cam-aav02"
          onClick={() => handleSetCameraMode('AAV-02')}
          className={`px-1.5 py-0.5 rounded-xs font-mono text-[10px] transition-colors cursor-pointer leading-tight ${
            cameraMode === 'AAV-02' ? 'bg-amber-500 text-black font-bold' : 'text-amber-400 hover:bg-zinc-900'
          }`}
        >
          AAV-2
        </button>
        <button
          id="btn-cam-aav03"
          onClick={() => handleSetCameraMode('AAV-03')}
          className={`px-1.5 py-0.5 rounded-xs font-mono text-[10px] transition-colors cursor-pointer leading-tight ${
            cameraMode === 'AAV-03' ? 'bg-emerald-500 text-black font-bold' : 'text-emerald-400 hover:bg-zinc-900'
          }`}
        >
          AAV-3
        </button>
      </div>

      {/* Top Right (Below Cam Modes): Area Exploration & Coverage Monitor HUD */}
      <div
        id="coverage-monitor-panel"
        className="absolute top-9 right-2.5 z-10 w-80 bg-black/92 backdrop-blur-md border border-zinc-800 rounded-sm shadow-2xl font-mono text-xs overflow-hidden transition-all duration-150"
      >
        {/* Panel Header */}
        <div
          onClick={() => setIsCoveragePanelOpen(!isCoveragePanelOpen)}
          className="flex items-center justify-between px-2.5 py-1.5 bg-zinc-900/80 border-b border-zinc-800/80 cursor-pointer hover:bg-zinc-800/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Scan className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="font-bold text-zinc-200 tracking-wider text-[11px]">AREA EXPLORED & GAPS</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60 font-bold">
              {coverageMetrics.overallPercent}% COVERED
            </span>
            {isCoveragePanelOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </div>
        </div>

        {/* Panel Body */}
        {isCoveragePanelOpen && (
          <div className="p-2.5 flex flex-col gap-2.5 text-[11px]">
            {/* Top Coverage Status Summary */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-400 text-[10px] uppercase tracking-wider">Operational Swath Coverage</span>
                <span className="text-zinc-300 font-bold">{coverageMetrics.totalAreaM2.toLocaleString()} m²</span>
              </div>
              <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-0.2">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${coverageMetrics.overallPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px]">
                <span className={coverageMetrics.gapsCount > 0 ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                  {coverageMetrics.gapsCount > 0
                    ? `⚠️ ${coverageMetrics.gapsCount} COVERAGE GAP${coverageMetrics.gapsCount > 1 ? 'S' : ''} IDENTIFIED`
                    : '✓ FULL SECTOR SURVEY COMPLETE'}
                </span>
                <span className="text-zinc-500">{coverageMetrics.overallPercent}% / 100%</span>
              </div>
            </div>

            {/* Per-Sector Exploration Breakdown */}
            <div className="space-y-1.5 bg-zinc-950/70 p-2 rounded-xs border border-zinc-800/60">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                Sector Density Saturation
              </div>
              {/* Alpha */}
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-sky-300 font-medium">Sector Alpha (AAV-01)</span>
                  <span className="text-sky-400 font-bold">{coverageMetrics.alphaPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-400 transition-all duration-200" style={{ width: `${coverageMetrics.alphaPercent}%` }} />
                </div>
              </div>
              {/* Bravo */}
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-amber-300 font-medium">Sector Bravo (AAV-02)</span>
                  <span className="text-amber-400 font-bold">{coverageMetrics.bravoPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 transition-all duration-200" style={{ width: `${coverageMetrics.bravoPercent}%` }} />
                </div>
              </div>
              {/* Charlie */}
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-emerald-300 font-medium">Sector Charlie (AAV-03)</span>
                  <span className="text-emerald-400 font-bold">{coverageMetrics.charliePercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 transition-all duration-200" style={{ width: `${coverageMetrics.charliePercent}%` }} />
                </div>
              </div>
            </div>

            {/* Coverage Gaps Alert List */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                <span>Active Coverage Gaps</span>
                <span className="text-amber-400 font-bold">{coverageMetrics.gapsCount} Unmapped</span>
              </div>
              {coverageMetrics.gapsList.length === 0 ? (
                <div className="flex items-center gap-2 p-1.5 rounded-xs bg-emerald-950/40 border border-emerald-800/50 text-[10px] text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Zero blind spots. Multi-AAV trajectories provide full swath saturation.</span>
                </div>
              ) : (
                <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
                  {coverageMetrics.gapsList.map((gap, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded-xs bg-amber-950/30 border border-amber-700/40 flex items-center justify-between text-[10px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                        <div>
                          <div className="text-amber-200 font-semibold">
                            {gap.sector} ({gap.quadrant})
                          </div>
                          <div className="text-zinc-400 text-[9px]">{gap.unmappedPercent}% deficit</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSetCameraMode(gap.assignedAgent as any)}
                        className="px-1.5 py-0.5 rounded-xs bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-600/50 text-[9px] cursor-pointer transition-colors"
                      >
                        VIEW {gap.assignedAgent}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Heatmap Overlay Display Controls */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-[10px]">PALETTE MODE:</span>
                <div className="flex items-center gap-1">
                  <button
                    id="btn-heatmap-thermal"
                    onClick={() => setHeatmapMode('THERMAL')}
                    className={`px-1.5 py-0.5 rounded-xs text-[10px] border cursor-pointer transition-colors ${
                      heatmapMode === 'THERMAL'
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300 font-bold'
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    THERMAL
                  </button>
                  <button
                    id="btn-heatmap-agent"
                    onClick={() => setHeatmapMode('AGENT_SPECTRUM')}
                    className={`px-1.5 py-0.5 rounded-xs text-[10px] border cursor-pointer transition-colors ${
                      heatmapMode === 'AGENT_SPECTRUM'
                        ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 font-bold'
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    AGENTS
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-[10px]">OPACITY:</span>
                <div className="flex items-center gap-1">
                  {[0.4, 0.72, 0.95].map((opVal) => (
                    <button
                      key={opVal}
                      onClick={() => setHeatmapOpacity(opVal)}
                      className={`px-1.5 py-0.5 rounded-xs text-[10px] border cursor-pointer transition-colors ${
                        heatmapOpacity === opVal
                          ? 'bg-zinc-800 border-zinc-500 text-zinc-100 font-bold'
                          : 'border-zinc-800 text-zinc-500 hover:bg-zinc-800/50'
                      }`}
                    >
                      {Math.round(opVal * 100)}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-zinc-300 text-[10px] cursor-pointer">
                  <input
                    id="toggle-gap-markers"
                    type="checkbox"
                    checked={showCoverageGaps}
                    onChange={(e) => setShowCoverageGaps(e.target.checked)}
                    className="accent-amber-500 w-3 h-3 rounded-xs"
                  />
                  <span>Show 3D Gap Beacons on Terrain</span>
                </label>
              </div>

              {/* Visual Heatmap Density Color Key */}
              <div className="mt-1">
                <div className="flex items-center justify-between text-[9px] text-zinc-500 mb-0.5 font-mono">
                  <span>UNVISITED (0%)</span>
                  <span>MED (50%)</span>
                  <span>HIGH OVERLAP (100%)</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-black via-cyan-500 via-emerald-400 to-amber-400 border border-zinc-800" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom HUD: Tactical Map Legends & System Notices */}
      <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none flex flex-wrap items-end justify-between gap-2.5">
        {/* Left: Map Legend (Agent Colors & Heatmap Scale) */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 max-w-full">
          {showHeatmap && (
            <div className="bg-black/90 backdrop-blur-md px-2.5 py-1.5 rounded-sm border border-amber-900/60 text-[10px] font-mono flex items-center gap-2 text-zinc-300 shadow-lg shrink-0">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-amber-300 font-semibold">HEATMAP:</span>
              <div className="flex items-center gap-1">
                <span className="w-10 h-1.5 rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400" />
                <span className="text-zinc-400 text-[9px]">(LOW → HIGH)</span>
              </div>
              {showCoverageGaps && coverageMetrics.gapsCount > 0 && (
                <span className="text-amber-400 text-[9px] font-bold border-l border-zinc-800 pl-1.5">
                  {coverageMetrics.gapsCount} GAPS
                </span>
              )}
            </div>
          )}

          <div className="bg-black/90 backdrop-blur-md px-2.5 py-1.5 rounded-sm border border-zinc-800 text-[10px] font-mono flex flex-wrap items-center gap-2.5 sm:gap-3 text-zinc-300 shadow-lg shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <span>AAV-01 <span className="text-zinc-500 hidden sm:inline">(Alpha)</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>AAV-02 <span className="text-zinc-500 hidden sm:inline">(Bravo)</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>AAV-03 <span className="text-zinc-500 hidden sm:inline">(Charlie)</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping" />
              <span className="text-yellow-300">Shared Match</span>
            </div>
          </div>
        </div>

        {/* Right: Fusion Status Notice */}
        <div className="pointer-events-auto flex flex-col items-end gap-1.5 shrink-0">
          {simState.collabSlam.fusionStage === 'GLOBAL_FUSED' && (
            <div className="bg-emerald-950/90 border border-emerald-500/70 text-emerald-300 text-xs px-2.5 py-1 rounded-sm font-mono flex items-center gap-2 shadow-lg backdrop-blur-md">
              <span>UNIFIED 3D GLOBAL MAP ACTIVE ({simState.fusedPointCloud.length.toLocaleString()} POINTS)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
