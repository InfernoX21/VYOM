import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { SimulationState } from '../simulation/simulationEngine';
import { Scenario, AAVTelemetry, SectorDefinition } from '../types/slam';
import {
  Layers,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  Check,
  Compass,
  Radio,
  Wifi,
  Scan,
  Eye,
  AlertTriangle,
  Crosshair,
} from 'lucide-react';
import { HEX, AGENT_HEX, AGENT_COLOR } from '../design/tokens';
import { CAMERA_MODE_LABEL, formatCount } from '../design/labels';
import { Button, Segmented } from './ui/Button';
import { StatusBadge, ProgressBar } from './ui/Panel';

/* -------------------------------------------------------------------------- */
/* Coverage contract — the map measures it, analytics consumes it              */
/* -------------------------------------------------------------------------- */

export interface CoverageGap {
  sector: string;
  /** Where inside the sector the deficit sits, e.g. "North-east edge". */
  region: string;
  x: number;
  y: number;
  unmappedPercent: number;
  assignedAgent: string;
}

export interface SectorCoverage {
  id: string;
  name: string;
  percent: number;
  assignedAgent: string;
  cellsMapped: number;
  cellsTotal: number;
}

export interface CoverageMetrics {
  overallPercent: number;
  cellsMapped: number;
  cellsTotal: number;
  /** Ground area of one occupancy cell, m². */
  cellAreaM2: number;
  /** cellsMapped × cellAreaM2 — the only area figure the UI should quote. */
  areaMappedM2: number;
  gapCount: number;
  sectors: SectorCoverage[];
  gaps: CoverageGap[];
}

interface Global3DMapProps {
  simState: SimulationState;
  scenario: Scenario;
  onSelectAgent?: (agentId: string) => void;
  selectedAgentId?: string | null;
  /** Publishes the measured survey so other views quote the same numbers. */
  onCoverageChange?: (metrics: CoverageMetrics) => void;
}

/* -------------------------------------------------------------------------- */
/* Survey model                                                               */
/* -------------------------------------------------------------------------- */

/** Occupancy cell edge in metres — the resolution of the survey grid. */
const CELL_M = 3;
/** Downward sensor footprint radius stamped along each track. */
const SENSOR_RADIUS_M = 20;
/** Track is resampled every this many metres before stamping. */
const STAMP_STEP_M = 2;
/** A sector below this percentage reports a coverage gap. */
const GAP_THRESHOLD_PCT = 72;
/** Coverage is remeasured at most this often, in ms. */
const MEASURE_INTERVAL_MS = 250;

const AGENT_BIT: Record<string, number> = { 'AAV-01': 1, 'AAV-02': 2, 'AAV-03': 4 };
const AGENT_IDS = ['AAV-01', 'AAV-02', 'AAV-03'];

type PaletteMode = 'UNIFORM' | 'AGENT';
type CameraMode = 'TACTICAL' | 'TOP_DOWN' | 'MEC' | 'AAV-01' | 'AAV-02' | 'AAV-03';

interface SurveyGrid {
  dim: number;
  cellM: number;
  half: number;
  /** One byte per cell holding a bitmask of the vehicles that observed it. */
  mask: Uint8Array;
  /** 1 where the cell belongs to at least one sector. */
  inSurvey: Uint8Array;
  surveyTotal: number;
  sectors: { def: SectorDefinition; cells: Int32Array }[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  image: ImageData;
}

/** World (x, y) → grid column / row. Row 0 is the +y edge, matching texture v. */
const toCol = (g: SurveyGrid, x: number) => Math.floor((x + g.half) / g.cellM);
const toRow = (g: SurveyGrid, y: number) => Math.floor((g.half - y) / g.cellM);
const cellX = (g: SurveyGrid, col: number) => -g.half + (col + 0.5) * g.cellM;
const cellY = (g: SurveyGrid, row: number) => g.half - (row + 0.5) * g.cellM;

function buildSurveyGrid(scen: Scenario): SurveyGrid {
  const half = scen.groundRadius;
  const dim = Math.max(48, Math.round((half * 2) / CELL_M));
  const cellM = (half * 2) / dim;

  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  const grid: SurveyGrid = {
    dim,
    cellM,
    half,
    mask: new Uint8Array(dim * dim),
    inSurvey: new Uint8Array(dim * dim),
    surveyTotal: 0,
    sectors: [],
    canvas,
    ctx,
    image: ctx.createImageData(dim, dim),
  };

  for (const def of scen.sectors) {
    const cells: number[] = [];
    const r2 = def.radius * def.radius;
    const c0 = Math.max(0, toCol(grid, def.center.x - def.radius));
    const c1 = Math.min(dim - 1, toCol(grid, def.center.x + def.radius));
    const r0 = Math.max(0, toRow(grid, def.center.y + def.radius));
    const r1 = Math.min(dim - 1, toRow(grid, def.center.y - def.radius));

    for (let row = r0; row <= r1; row++) {
      const wy = cellY(grid, row);
      for (let col = c0; col <= c1; col++) {
        const wx = cellX(grid, col);
        const dx = wx - def.center.x;
        const dy = wy - def.center.y;
        if (dx * dx + dy * dy > r2) continue;
        const idx = row * dim + col;
        cells.push(idx);
        if (!grid.inSurvey[idx]) {
          grid.inSurvey[idx] = 1;
          grid.surveyTotal++;
        }
      }
    }
    grid.sectors.push({ def, cells: Int32Array.from(cells) });
  }

  return grid;
}

/** Stamps one sensor footprint. Returns true when new ground was covered. */
function stampFootprint(g: SurveyGrid, x: number, y: number, bit: number): boolean {
  const c0 = Math.max(0, toCol(g, x - SENSOR_RADIUS_M));
  const c1 = Math.min(g.dim - 1, toCol(g, x + SENSOR_RADIUS_M));
  const r0 = Math.max(0, toRow(g, y + SENSOR_RADIUS_M));
  const r1 = Math.min(g.dim - 1, toRow(g, y - SENSOR_RADIUS_M));
  const r2 = SENSOR_RADIUS_M * SENSOR_RADIUS_M;
  let changed = false;

  for (let row = r0; row <= r1; row++) {
    const dy = cellY(g, row) - y;
    const dy2 = dy * dy;
    for (let col = c0; col <= c1; col++) {
      const dx = cellX(g, col) - x;
      if (dx * dx + dy2 > r2) continue;
      const idx = row * g.dim + col;
      if ((g.mask[idx] & bit) === 0) {
        g.mask[idx] |= bit;
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * Repaints the overlay texture from the occupancy mask. Unmapped cells stay
 * fully transparent, so the terrain reads through where nothing was surveyed.
 */
function paintSurveyGrid(g: SurveyGrid, mode: PaletteMode) {
  const data = g.image.data;
  for (let i = 0; i < g.mask.length; i++) {
    const bits = g.mask[i];
    const o = i * 4;
    if (bits === 0) {
      data[o + 3] = 0;
      continue;
    }
    const overlap = (bits & 1 ? 1 : 0) + (bits & 2 ? 1 : 0) + (bits & 4 ? 1 : 0);

    if (mode === 'AGENT' && overlap === 1) {
      const hex =
        bits & 1 ? AGENT_HEX['AAV-01'] : bits & 2 ? AGENT_HEX['AAV-02'] : AGENT_HEX['AAV-03'];
      data[o] = (hex >> 16) & 255;
      data[o + 1] = (hex >> 8) & 255;
      data[o + 2] = hex & 255;
      data[o + 3] = 150;
    } else {
      // Uniform survey shading: denser where footprints overlap.
      data[o] = 200;
      data[o + 1] = 206;
      data[o + 2] = 214;
      data[o + 3] = overlap >= 3 ? 132 : overlap === 2 ? 104 : 74;
    }
  }
  g.ctx.putImageData(g.image, 0, 0);
}

/** Compass wording for a deficit centroid relative to its sector centre. */
function describeRegion(dx: number, dy: number): string {
  if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return 'Sector core';
  const ns = dy > 6 ? 'North' : dy < -6 ? 'South' : '';
  const ew = dx > 6 ? 'east' : dx < -6 ? 'west' : '';
  if (ns && ew) return `${ns}-${ew} edge`;
  if (ns) return `${ns} edge`;
  return `${ew.charAt(0).toUpperCase()}${ew.slice(1)} edge`;
}

function measureCoverage(g: SurveyGrid): CoverageMetrics {
  const cellAreaM2 = g.cellM * g.cellM;
  const sectors: SectorCoverage[] = [];
  const gaps: CoverageGap[] = [];

  for (const { def, cells } of g.sectors) {
    let mapped = 0;
    let gapX = 0;
    let gapY = 0;
    let gapN = 0;

    for (let i = 0; i < cells.length; i++) {
      const idx = cells[i];
      if (g.mask[idx] !== 0) {
        mapped++;
      } else {
        const row = Math.floor(idx / g.dim);
        gapX += cellX(g, idx - row * g.dim);
        gapY += cellY(g, row);
        gapN++;
      }
    }

    const percent = cells.length === 0 ? 0 : Math.round((mapped / cells.length) * 100);
    sectors.push({
      id: def.id,
      name: def.name,
      percent,
      assignedAgent: def.assignedAgent,
      cellsMapped: mapped,
      cellsTotal: cells.length,
    });

    if (percent < GAP_THRESHOLD_PCT && gapN > 0) {
      const cx = gapX / gapN;
      const cy = gapY / gapN;
      gaps.push({
        sector: def.id,
        region: describeRegion(cx - def.center.x, cy - def.center.y),
        x: cx,
        y: cy,
        unmappedPercent: 100 - percent,
        assignedAgent: def.assignedAgent,
      });
    }
  }

  let cellsMapped = 0;
  for (let i = 0; i < g.mask.length; i++) {
    if (g.inSurvey[i] && g.mask[i] !== 0) cellsMapped++;
  }
  const cellsTotal = g.surveyTotal;

  return {
    overallPercent: cellsTotal === 0 ? 0 : (cellsMapped / cellsTotal) * 100,
    cellsMapped,
    cellsTotal,
    cellAreaM2,
    areaMappedM2: Math.round(cellsMapped * cellAreaM2),
    gapCount: gaps.length,
    sectors,
    gaps,
  };
}

const EMPTY_COVERAGE: CoverageMetrics = {
  overallPercent: 0,
  cellsMapped: 0,
  cellsTotal: 0,
  cellAreaM2: CELL_M * CELL_M,
  areaMappedM2: 0,
  gapCount: 0,
  sectors: [],
  gaps: [],
};

/* -------------------------------------------------------------------------- */
/* Small scene helpers                                                        */
/* -------------------------------------------------------------------------- */

/** Flat ground ring, used for range circles and sector perimeters. */
function makeRing(inner: number, outer: number, color: number, opacity: number, segments = 64) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, segments),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** Camera-facing text label drawn to a canvas texture. */
function makeLabel(text: string, color: string, worldWidth: number) {
  const pad = 8;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const font = '500 26px Inter, system-ui, sans-serif';
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + pad * 2;
  canvas.width = width;
  canvas.height = 40;

  const ctx2 = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx2.font = font;
  ctx2.fillStyle = color;
  ctx2.textBaseline = 'middle';
  ctx2.fillText(text, pad, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.85 })
  );
  sprite.scale.set(worldWidth, (worldWidth * canvas.height) / canvas.width, 1);
  return sprite;
}

function disposeSceneGraph(scene: THREE.Scene) {
  scene.traverse((obj) => {
    const withGeom = obj as THREE.Mesh;
    if (withGeom.geometry) withGeom.geometry.dispose();
    const material = (obj as THREE.Mesh).material as
      | (THREE.Material & { map?: THREE.Texture | null })
      | (THREE.Material & { map?: THREE.Texture | null })[]
      | undefined;
    const list = Array.isArray(material) ? material : material ? [material] : [];
    for (const mat of list) {
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Layer toggle row                                                           */
/* -------------------------------------------------------------------------- */

const LayerToggle: React.FC<{
  id: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  active: boolean;
  onToggle: () => void;
}> = ({ id, icon, label, hint, active, onToggle }) => (
  <button
    id={id}
    type="button"
    aria-pressed={active}
    onClick={onToggle}
    className={`flex w-full items-center justify-between gap-2 rounded-sm border px-2 py-1.5 text-2xs transition-colors duration-100 ${
      active
        ? 'border-line-strong bg-surface-3 text-ink'
        : 'border-line bg-surface-1 text-ink-3 hover:bg-surface-2 hover:text-ink-2'
    }`}
  >
    <span className="flex min-w-0 items-center gap-2">
      <span className={active ? 'text-primary-ink' : 'text-ink-4'}>{icon}</span>
      <span className="truncate">{label}</span>
    </span>
    <span className="flex shrink-0 items-center gap-1.5">
      {hint && <span className="telemetry text-3xs text-ink-4">{hint}</span>}
      <span
        className={`flex h-3 w-3 items-center justify-center rounded-sm border ${
          active ? 'border-primary bg-primary text-surface-0' : 'border-line-strong'
        }`}
      >
        {active && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
    </span>
  </button>
);

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export const Global3DMap: React.FC<Global3DMapProps> = ({
  simState,
  scenario,
  onSelectAgent,
  selectedAgentId,
  onCoverageChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Scene object registries, rebuilt whenever the scenario changes.
  const droneGroupsRef = useRef<Record<string, THREE.Group>>({});
  const rotorsRef = useRef<THREE.Mesh[]>([]);
  const statusRingsRef = useRef<Record<string, THREE.Mesh>>({});
  const selectRingsRef = useRef<Record<string, THREE.Mesh>>({});
  const trackLinesRef = useRef<Record<string, THREE.Line>>({});
  const footprintsRef = useRef<Record<string, THREE.LineSegments>>({});
  const dropLinesRef = useRef<Record<string, THREE.Line>>({});
  const uplinksRef = useRef<Record<string, THREE.Line>>({});
  const packetsRef = useRef<Record<string, THREE.Mesh>>({});
  const landmarkCloudsRef = useRef<Record<string, THREE.Points>>({});
  const matchLinesRef = useRef<THREE.LineSegments | null>(null);
  const fusedCloudRef = useRef<THREE.Points | null>(null);
  const fusedCountRef = useRef(0);

  // Survey overlay.
  const grid = useMemo(() => buildSurveyGrid(scenario), [scenario]);
  const overlayMeshRef = useRef<THREE.Mesh | null>(null);
  const overlayTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const gapGroupRef = useRef<THREE.Group | null>(null);
  const lastStampRef = useRef<Record<string, { x: number; y: number } | null>>({});
  const lastMeasureRef = useRef(0);
  const publishedRef = useRef<CoverageMetrics | null>(null);

  /** Read by the render loop so it never closes over stale simulation state. */
  const liveRef = useRef({ isRunning: false });

  // Layer state.
  const [showSurvey, setShowSurvey] = useState(true);
  const [showTracks, setShowTracks] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showUplinks, setShowUplinks] = useState(true);
  const [showFootprints, setShowFootprints] = useState(false);
  const [showGapMarkers, setShowGapMarkers] = useState(true);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>('UNIFORM');
  const [overlayOpacity, setOverlayOpacity] = useState(0.7);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isSurveyPanelOpen, setIsSurveyPanelOpen] = useState(true);
  const [coverage, setCoverage] = useState<CoverageMetrics>(EMPTY_COVERAGE);

  const [cameraMode, setCameraMode] = useState<CameraMode>('TACTICAL');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Orbit state.
  const isDraggingRef = useRef(false);
  const dragDistRef = useRef(0);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const orbitRef = useRef({ radius: 200, theta: 0.8, phi: 1.05 });
  const targetRef = useRef(new THREE.Vector3(0, 0, 5));

  const updateCameraPosition = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const { radius, theta, phi } = orbitRef.current;
    const target = targetRef.current;
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(target);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Scene construction                                                  */
  /* ------------------------------------------------------------------ */

  const buildEnvironment = useCallback(
    (scene: THREE.Scene, scen: Scenario) => {
      const radius = scen.groundRadius;

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(radius * 2, radius * 2, 1, 1),
        new THREE.MeshStandardMaterial({ color: HEX.ground, roughness: 0.96, metalness: 0.04 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // Restrained survey grid: minor lines every ~8 m, no accent colour.
      const gridHelper = new THREE.GridHelper(radius * 2, 40, HEX.gridMajor, HEX.gridMinor);
      const gridMat = gridHelper.material as THREE.Material;
      gridMat.transparent = true;
      gridMat.opacity = 0.55;
      gridHelper.position.y = 0.04;
      scene.add(gridHelper);

      // Range rings every 40 m for scale reference.
      for (const r of [40, 80, 120, 160]) {
        if (r > radius) continue;
        const ring = makeRing(r - 0.2, r + 0.2, HEX.line, 0.7);
        ring.position.y = 0.08;
        scene.add(ring);
      }

      // Sector perimeters, tinted by the vehicle that owns the sector.
      for (const sector of scen.sectors) {
        const color = AGENT_HEX[sector.assignedAgent] ?? HEX.lineStrong;

        const perimeter = makeRing(sector.radius - 0.35, sector.radius + 0.35, color, 0.45, 72);
        perimeter.position.set(sector.center.x, 0.16, -sector.center.y);
        scene.add(perimeter);

        const fill = new THREE.Mesh(
          new THREE.CircleGeometry(sector.radius, 64),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.025,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        fill.rotation.x = -Math.PI / 2;
        fill.position.set(sector.center.x, 0.12, -sector.center.y);
        scene.add(fill);

        const label = makeLabel(`Sector ${sector.id}`, '#aab0b8', 22);
        label.position.set(sector.center.x, 6, -sector.center.y);
        scene.add(label);
      }

      // Scenario-specific mission points make search and surveillance activity legible.
      for (const poi of scen.pointsOfInterest) {
        const color = poi.kind === 'SURVIVOR' ? HEX.success : poi.kind === 'BREACH' || poi.kind === 'ANOMALY' ? HEX.danger : HEX.primary;
        const marker = new THREE.Mesh(
          new THREE.ConeGeometry(2.2, 6, 4),
          new THREE.MeshBasicMaterial({ color })
        );
        marker.position.set(poi.position.x, 3, -poi.position.y);
        marker.rotation.y = Math.PI / 4;
        scene.add(marker);
        const poiLabel = makeLabel(poi.label, '#d8dde4', 18);
        poiLabel.position.set(poi.position.x, 8, -poi.position.y);
        scene.add(poiLabel);
      }

      // Structures: solid dark volumes with a single edge highlight.
      const structureMat = new THREE.MeshStandardMaterial({
        color: HEX.building,
        roughness: 0.85,
        metalness: 0.12,
      });
      const rubbleMat = new THREE.MeshStandardMaterial({
        color: HEX.surface1,
        roughness: 0.96,
        metalness: 0.04,
      });
      const edgeMat = new THREE.LineBasicMaterial({
        color: HEX.buildingEdge,
        transparent: true,
        opacity: 0.55,
      });
      const roofMat = new THREE.MeshStandardMaterial({ color: HEX.surface3, roughness: 0.7 });

      for (const b of scen.buildings) {
        if (b.type === 'tower') continue; // the edge node mast is built separately
        const geom = new THREE.BoxGeometry(b.width, b.height, b.depth);
        const mesh = new THREE.Mesh(geom, b.type === 'rubble' ? rubbleMat : structureMat);
        mesh.position.set(b.x, b.height / 2, -b.y);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), edgeMat);
        edges.position.copy(mesh.position);
        scene.add(edges);

        if (b.type === 'rubble') {
          const slab = new THREE.Mesh(
            new THREE.BoxGeometry(b.width * 0.6, 1.2, b.depth * 0.5),
            rubbleMat
          );
          slab.position.set(b.x + 2, b.height + 0.5, -b.y - 1);
          slab.rotation.set(0.2, 0.4, -0.3);
          scene.add(slab);
        } else if (b.height > 25) {
          const plant = new THREE.Mesh(
            new THREE.BoxGeometry(b.width * 0.32, 3.2, b.depth * 0.32),
            roofMat
          );
          plant.position.set(b.x, b.height + 1.6, -b.y);
          scene.add(plant);

          // Obstruction light — the one red in the scene, and it means something.
          const light = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 8, 8),
            new THREE.MeshBasicMaterial({ color: HEX.danger })
          );
          light.position.set(b.x + b.width * 0.3, b.height + 3.4, -b.y + b.depth * 0.3);
          scene.add(light);
        }
      }

      if (scen.environment === 'WILDLAND_SEARCH') {
        const vegetationMat = new THREE.MeshStandardMaterial({ color: 0x25382a, roughness: 1 });
        for (let x = -150; x <= 150; x += 22) {
          for (let y = -130; y <= 120; y += 19) {
            const offset = ((x * 13 + y * 7) % 11) - 5;
            const treeHeight = 12 + Math.abs(offset);
            const tree = new THREE.Mesh(new THREE.ConeGeometry(3.5, treeHeight, 7), vegetationMat);
            tree.position.set(x + offset, treeHeight / 2, -(y - offset));
            scene.add(tree);
          }
        }
      } else if (scen.environment === 'CRITICAL_INFRASTRUCTURE') {
        const fenceMat = new THREE.LineBasicMaterial({ color: HEX.lineStrong, transparent: true, opacity: 0.75 });
        const fence = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-115, 1, -95), new THREE.Vector3(115, 1, -95),
            new THREE.Vector3(115, 1, 95), new THREE.Vector3(-115, 1, 95),
          ]),
          fenceMat
        );
        scene.add(fence);
        for (let x = -110; x <= 110; x += 20) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5, 6), new THREE.MeshBasicMaterial({ color: HEX.lineStrong }));
          post.position.set(x, 2.5, -95);
          scene.add(post);
        }
      }

      // Road surface.
      const roadMat = new THREE.MeshBasicMaterial({ color: HEX.surface1 });
      const roadX = new THREE.Mesh(new THREE.PlaneGeometry(radius * 1.8, 14), roadMat);
      roadX.rotation.x = -Math.PI / 2;
      roadX.position.y = 0.05;
      scene.add(roadX);

      const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(14, radius * 1.8), roadMat);
      roadZ.rotation.x = -Math.PI / 2;
      roadZ.position.y = 0.06;
      scene.add(roadZ);

      const stripeMat = new THREE.LineDashedMaterial({
        color: HEX.ink4,
        dashSize: 3,
        gapSize: 4,
        transparent: true,
        opacity: 0.55,
      });
      for (const pts of [
        [new THREE.Vector3(-radius * 0.9, 0.07, 0), new THREE.Vector3(radius * 0.9, 0.07, 0)],
        [new THREE.Vector3(0, 0.08, -radius * 0.9), new THREE.Vector3(0, 0.08, radius * 0.9)],
      ]) {
        const stripe = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), stripeMat);
        stripe.computeLineDistances();
        scene.add(stripe);
      }

      // Launch pad with one bay per vehicle.
      const pad = new THREE.Group();
      pad.position.set(0, 0.1, 12);

      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(9, 9.5, 0.2, 8),
        new THREE.MeshStandardMaterial({ color: HEX.surface2, roughness: 0.85, metalness: 0.1 })
      );
      platform.position.y = 0.1;
      pad.add(platform);

      const padEdge = makeRing(8.3, 8.7, HEX.primary, 0.55, 40);
      padEdge.position.y = 0.21;
      pad.add(padEdge);

      const padInner = makeRing(5.2, 5.4, HEX.ink4, 0.6, 40);
      padInner.position.y = 0.22;
      pad.add(padInner);

      AGENT_IDS.forEach((id, i) => {
        const x = -3.8 + i * 3.8;
        const bay = makeRing(1.6, 1.8, AGENT_HEX[id], 0.8, 28);
        bay.position.set(x, 0.23, 0);
        pad.add(bay);

        const cross = new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x - 1.2, 0.24, 0),
            new THREE.Vector3(x + 1.2, 0.24, 0),
            new THREE.Vector3(x, 0.24, -1.2),
            new THREE.Vector3(x, 0.24, 1.2),
          ]),
          new THREE.LineBasicMaterial({ color: AGENT_HEX[id], transparent: true, opacity: 0.6 })
        );
        pad.add(cross);
      });

      const markerMat = new THREE.MeshBasicMaterial({ color: HEX.success });
      for (const [bx, bz] of [
        [-7.5, -7.5],
        [7.5, -7.5],
        [-7.5, 7.5],
        [7.5, 7.5],
      ]) {
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), markerMat);
        marker.position.set(bx, 0.7, bz);
        pad.add(marker);
      }

      const padLabel = makeLabel('Launch pad', '#7b818a', 16);
      padLabel.position.set(0, 5, 0);
      pad.add(padLabel);
      scene.add(pad);

      // Survey overlay plane driven by the occupancy grid.
      const texture = new THREE.CanvasTexture(grid.canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      overlayTextureRef.current = texture;

      const overlay = new THREE.Mesh(
        new THREE.PlaneGeometry(radius * 2, radius * 2),
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: overlayOpacity,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      overlay.rotation.x = -Math.PI / 2;
      overlay.position.y = 0.1;
      overlay.visible = showSurvey;
      scene.add(overlay);
      overlayMeshRef.current = overlay;

      const gapGroup = new THREE.Group();
      gapGroup.position.y = 0.18;
      gapGroup.visible = showSurvey && showGapMarkers;
      scene.add(gapGroup);
      gapGroupRef.current = gapGroup;
    },
    // Initial visibility/opacity are read once; dedicated effects keep them live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grid]
  );

  const buildEdgeNode = useCallback((scene: THREE.Scene) => {
    const group = new THREE.Group();
    group.position.set(0, 0, -5);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 9, 2, 8),
      new THREE.MeshStandardMaterial({ color: HEX.surface2, roughness: 0.8 })
    );
    base.position.y = 1;
    group.add(base);

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 2.4, 48, 6),
      new THREE.MeshStandardMaterial({ color: HEX.surface4, metalness: 0.55, roughness: 0.45 })
    );
    mast.position.y = 25;
    group.add(mast);

    // Tri-sector active antenna units.
    const panelMat = new THREE.MeshStandardMaterial({ color: HEX.ink4, roughness: 0.5 });
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5, 2.5), panelMat);
      panel.position.set(Math.cos(angle) * 3, 44, Math.sin(angle) * 3);
      panel.rotation.y = -angle;
      group.add(panel);
    }

    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 0.5, 16),
      new THREE.MeshStandardMaterial({ color: HEX.ink3, metalness: 0.3, roughness: 0.6 })
    );
    dish.position.set(0, 36, 1.8);
    dish.rotation.x = Math.PI / 2;
    group.add(dish);

    const obstruction = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 12),
      new THREE.MeshBasicMaterial({ color: HEX.danger })
    );
    obstruction.position.y = 50;
    group.add(obstruction);

    const label = makeLabel('Edge node · gNodeB-01', '#aab0b8', 30);
    label.position.set(0, 56, 0);
    group.add(label);

    scene.add(group);
  }, []);

  const buildVehicles = useCallback((scene: THREE.Scene) => {
    for (const id of AGENT_IDS) {
      const color = AGENT_HEX[id];
      const drone = new THREE.Group();
      drone.userData.agentId = id;

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.8, 3.2),
        new THREE.MeshStandardMaterial({ color: HEX.surface3, metalness: 0.65, roughness: 0.35 })
      );
      drone.add(body);

      const shell = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.3, 2.2),
        new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.4 })
      );
      shell.position.y = 0.5;
      drone.add(shell);

      // Stereo camera pair.
      const lensMat = new THREE.MeshBasicMaterial({ color: HEX.ink2 });
      for (const lx of [-0.6, 0.6]) {
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 12), lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(lx, -0.2, 1.7);
        drone.add(lens);
      }

      const armMat = new THREE.MeshStandardMaterial({ color: HEX.surface4, metalness: 0.5 });
      for (const yaw of [Math.PI / 4, -Math.PI / 4]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.6, 8), armMat);
        arm.rotation.z = Math.PI / 2;
        arm.rotation.y = yaw;
        drone.add(arm);
      }

      const rotorMat = new THREE.MeshBasicMaterial({
        color: HEX.ink4,
        transparent: true,
        opacity: 0.55,
      });
      for (const [mx, mz] of [
        [1.3, 1.3],
        [-1.3, 1.3],
        [1.3, -1.3],
        [-1.3, -1.3],
      ]) {
        const rotor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.2), rotorMat);
        rotor.position.set(mx, 0.4, mz);
        drone.add(rotor);
        rotorsRef.current.push(rotor);
      }

      // Health ring under the airframe — green nominal, amber degraded, red held.
      const statusRing = makeRing(2.5, 2.9, HEX.success, 0.85, 32);
      statusRing.position.y = -0.7;
      drone.add(statusRing);
      statusRingsRef.current[id] = statusRing;

      // Selection ring, shown for the vehicle selected anywhere in the app.
      const selectRing = makeRing(3.5, 3.9, HEX.primary, 0.9, 32);
      selectRing.position.y = -0.7;
      selectRing.visible = false;
      drone.add(selectRing);
      selectRingsRef.current[id] = selectRing;

      // Invisible pick target: the airframe is only ~3 m across at orbit range.
      const pickTarget = new THREE.Mesh(
        new THREE.SphereGeometry(5, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      pickTarget.userData.agentId = id;
      drone.add(pickTarget);

      scene.add(drone);
      droneGroupsRef.current[id] = drone;

      const track = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
      );
      track.frustumCulled = false;
      scene.add(track);
      trackLinesRef.current[id] = track;

      const drop = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineDashedMaterial({
          color: HEX.ink4,
          dashSize: 2,
          gapSize: 1.5,
          transparent: true,
          opacity: 0.4,
        })
      );
      scene.add(drop);
      dropLinesRef.current[id] = drop;

      // Downward camera footprint, off by default and toggleable as a layer.
      const fw = 12;
      const fdist = 25;
      const footprint = new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute(
          'position',
          new THREE.Float32BufferAttribute(
            [
              0, 0, 0, -fw, -fdist, fw,
              0, 0, 0, fw, -fdist, fw,
              0, 0, 0, fw, -fdist, -fw,
              0, 0, 0, -fw, -fdist, -fw,
              -fw, -fdist, fw, fw, -fdist, fw,
              fw, -fdist, fw, fw, -fdist, -fw,
              fw, -fdist, -fw, -fw, -fdist, -fw,
              -fw, -fdist, -fw, -fw, -fdist, fw,
            ],
            3
          )
        ),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22 })
      );
      footprint.visible = false;
      scene.add(footprint);
      footprintsRef.current[id] = footprint;

      const uplink = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(),
          new THREE.Vector3(0, 48, -5),
        ]),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.32 })
      );
      scene.add(uplink);
      uplinksRef.current[id] = uplink;

      const packet = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 10, 10),
        new THREE.MeshBasicMaterial({ color })
      );
      scene.add(packet);
      packetsRef.current[id] = packet;

      // Landmarks read white-grey for every vehicle; identity comes from tracks.
      const cloud = new THREE.Points(
        new THREE.BufferGeometry(),
        new THREE.PointsMaterial({
          size: 1.5,
          color: HEX.landmark,
          transparent: true,
          opacity: 0.7,
        })
      );
      cloud.frustumCulled = false;
      scene.add(cloud);
      landmarkCloudsRef.current[id] = cloud;
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /* Scene lifecycle                                                     */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // A scenario swap discards the old graph, so clear every registry first.
    droneGroupsRef.current = {};
    rotorsRef.current = [];
    statusRingsRef.current = {};
    selectRingsRef.current = {};
    trackLinesRef.current = {};
    footprintsRef.current = {};
    dropLinesRef.current = {};
    uplinksRef.current = {};
    packetsRef.current = {};
    landmarkCloudsRef.current = {};
    matchLinesRef.current = null;
    fusedCloudRef.current = null;
    fusedCountRef.current = 0;
    lastStampRef.current = {};

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(HEX.surface0);
    scene.fog = new THREE.FogExp2(HEX.surface0, 0.0017);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1200);
    cameraRef.current = camera;
    updateCameraPosition();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(HEX.surface4, 1.5);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xdfe3e8, 1.45);
    key.position.set(80, 140, 120);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    key.shadow.camera.near = 10;
    key.shadow.camera.far = 420;
    key.shadow.camera.left = -170;
    key.shadow.camera.right = 170;
    key.shadow.camera.top = 170;
    key.shadow.camera.bottom = -170;
    scene.add(key);

    const sky = new THREE.HemisphereLight(HEX.surface3, HEX.surface0, 0.55);
    scene.add(sky);

    buildEnvironment(scene, scenario);
    buildEdgeNode(scene);
    buildVehicles(scene);

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      // Rotors turn only while the mission clock runs.
      if (liveRef.current.isRunning) {
        for (const rotor of rotorsRef.current) rotor.rotation.z += delta * 40;
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      disposeSceneGraph(scene);
      overlayTextureRef.current?.dispose();
      overlayTextureRef.current = null;
      overlayMeshRef.current = null;
      gapGroupRef.current = null;
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      sceneRef.current = null;
    };
  }, [scenario, buildEnvironment, buildEdgeNode, buildVehicles, updateCameraPosition]);

  /* ------------------------------------------------------------------ */
  /* Overlay palette / opacity                                           */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    paintSurveyGrid(grid, paletteMode);
    if (overlayTextureRef.current) overlayTextureRef.current.needsUpdate = true;
  }, [grid, paletteMode]);

  useEffect(() => {
    const overlay = overlayMeshRef.current;
    if (!overlay) return;
    overlay.visible = showSurvey;
    (overlay.material as THREE.MeshBasicMaterial).opacity = overlayOpacity;
    if (gapGroupRef.current) gapGroupRef.current.visible = showSurvey && showGapMarkers;
  }, [showSurvey, overlayOpacity, showGapMarkers]);

  /* ------------------------------------------------------------------ */
  /* Per-tick simulation sync                                            */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    liveRef.current.isRunning = simState.isRunning;

    const agents = Object.entries(simState.agents) as [string, AAVTelemetry][];
    const paused = simState.missionStatus === 'PAUSED';

    for (const [id, agent] of agents) {
      // World axes: x east, y altitude, z south — so world z is -position.y.
      const wx = agent.position.x;
      const wy = agent.position.z;
      const wz = -agent.position.y;

      const drone = droneGroupsRef.current[id];
      if (drone) {
        drone.position.set(wx, wy, wz);
        drone.rotation.y = -THREE.MathUtils.degToRad(agent.heading);
        drone.rotation.z = THREE.MathUtils.degToRad(agent.orientation.roll);
        drone.rotation.x = THREE.MathUtils.degToRad(agent.orientation.pitch);
      }

      const statusRing = statusRingsRef.current[id];
      if (statusRing) {
        const mat = statusRing.material as THREE.MeshBasicMaterial;
        const hex =
          agent.status === 'OFFLINE'
            ? HEX.ink4
            : paused
            ? HEX.danger
            : agent.slamMode === 'DEGRADED_ODOM' || !agent.networkConnected
            ? HEX.warning
            : HEX.success;
        mat.color.setHex(hex);
        statusRing.visible = agent.altitude > 0.5;
      }

      const selectRing = selectRingsRef.current[id];
      if (selectRing) selectRing.visible = selectedAgentId === id;

      const drop = dropLinesRef.current[id];
      if (drop) {
        const pos = drop.geometry.attributes.position as THREE.BufferAttribute;
        pos.setXYZ(0, wx, wy, wz);
        pos.setXYZ(1, wx, 0, wz);
        pos.needsUpdate = true;
        drop.computeLineDistances();
        drop.visible = agent.altitude > 1;
      }

      const footprint = footprintsRef.current[id];
      if (footprint) {
        footprint.visible = showFootprints && agent.altitude > 2;
        footprint.position.set(wx, wy, wz);
        footprint.rotation.y = -THREE.MathUtils.degToRad(agent.heading);
      }

      const uplink = uplinksRef.current[id];
      if (uplink) {
        const pos = uplink.geometry.attributes.position as THREE.BufferAttribute;
        pos.setXYZ(0, wx, wy, wz);
        pos.setXYZ(1, 0, 48, -5);
        pos.needsUpdate = true;
        uplink.visible = showUplinks && agent.networkConnected;
        const mat = uplink.material as THREE.LineBasicMaterial;
        mat.color.setHex(simState.isStressTest ? HEX.danger : AGENT_HEX[id]);
      }

      const packet = packetsRef.current[id];
      if (packet) {
        // Phase advances on simulated time, so packets hold still when paused.
        const speed = simState.isStressTest ? 0.35 : 0.9;
        const offset = id === 'AAV-01' ? 0 : id === 'AAV-02' ? 0.33 : 0.66;
        const t = (simState.simTimeSeconds * speed + offset) % 1;
        packet.position.set(wx * (1 - t), wy * (1 - t) + 48 * t, wz * (1 - t) - 5 * t);
        packet.visible = showUplinks && agent.networkConnected && agent.altitude > 2;
        (packet.material as THREE.MeshBasicMaterial).color.setHex(
          simState.isStressTest ? HEX.danger : AGENT_HEX[id]
        );
      }

      const track = trackLinesRef.current[id];
      if (track) {
        if (agent.trajectory.length > 1) {
          track.geometry.setFromPoints(
            agent.trajectory.map((p) => new THREE.Vector3(p.x, p.z, -p.y))
          );
          track.visible = showTracks;
        } else {
          track.visible = false;
        }
      }
    }

    // Landmark clouds — one buffer per vehicle, rewritten in place.
    for (const id of AGENT_IDS) {
      const cloud = landmarkCloudsRef.current[id];
      if (!cloud) continue;
      if (!showLandmarks) {
        cloud.visible = false;
        continue;
      }
      const own = simState.landmarks.filter((l) => l.agentId === id);
      if (own.length === 0) {
        cloud.visible = false;
        continue;
      }
      const buffer = new Float32Array(own.length * 3);
      for (let i = 0; i < own.length; i++) {
        const p = own[i].position;
        buffer[i * 3] = p.x;
        buffer[i * 3 + 1] = p.z;
        buffer[i * 3 + 2] = -p.y;
      }
      cloud.geometry.setAttribute('position', new THREE.BufferAttribute(buffer, 3));
      cloud.visible = true;
    }

    // Inter-agent correspondences: orange, because fusion owns that colour.
    const matches = simState.collabSlam.sharedMatches;
    if (showLandmarks && matches.length > 0) {
      if (!matchLinesRef.current) {
        const lines = new THREE.LineSegments(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({ color: HEX.primary, transparent: true, opacity: 0.8 })
        );
        lines.frustumCulled = false;
        scene.add(lines);
        matchLinesRef.current = lines;
      }
      const coords: number[] = [];
      for (const m of matches) {
        coords.push(m.sourceLandmarkPos.x, m.sourceLandmarkPos.z, -m.sourceLandmarkPos.y);
        coords.push(m.targetLandmarkPos.x, m.targetLandmarkPos.z, -m.targetLandmarkPos.y);
      }
      matchLinesRef.current.geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(coords, 3)
      );
      matchLinesRef.current.visible = true;
    } else if (matchLinesRef.current) {
      matchLinesRef.current.visible = false;
    }

    // Unified map: single-hue elevation ramp, rebuilt only when it changes.
    const fused = simState.fusedPointCloud;
    const isFused = simState.collabSlam.fusionStage === 'GLOBAL_FUSED';
    if (showLandmarks && isFused && fused.length > 0) {
      if (!fusedCloudRef.current) {
        const cloud = new THREE.Points(
          new THREE.BufferGeometry(),
          new THREE.PointsMaterial({
            size: 2.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
          })
        );
        cloud.frustumCulled = false;
        scene.add(cloud);
        fusedCloudRef.current = cloud;
      }
      if (fusedCountRef.current !== fused.length) {
        const positions = new Float32Array(fused.length * 3);
        const colors = new Float32Array(fused.length * 3);
        for (let i = 0; i < fused.length; i++) {
          const p = fused[i].position;
          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.z;
          positions[i * 3 + 2] = -p.y;
          const t = Math.min(1, Math.max(0, p.z / 45));
          colors[i * 3] = 0.55 + 0.43 * t;
          colors[i * 3 + 1] = 0.28 + 0.37 * t;
          colors[i * 3 + 2] = 0.12 + 0.28 * t;
        }
        const geom = fusedCloudRef.current.geometry;
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        fusedCountRef.current = fused.length;
      }
      fusedCloudRef.current.visible = true;
    } else if (fusedCloudRef.current) {
      fusedCloudRef.current.visible = false;
    }

    /* ---------------- survey accumulation ---------------- */

    // A reset clears the accumulated survey so coverage restarts honestly.
    if (simState.missionStatus === 'IDLE' && simState.simTimeSeconds < 0.2) {
      if (lastStampRef.current['AAV-01'] !== null || grid.mask.some((v) => v !== 0)) {
        grid.mask.fill(0);
        lastStampRef.current = { 'AAV-01': null, 'AAV-02': null, 'AAV-03': null };
        paintSurveyGrid(grid, paletteMode);
        if (overlayTextureRef.current) overlayTextureRef.current.needsUpdate = true;
        lastMeasureRef.current = 0;
      }
    }

    let stamped = false;
    for (const [id, agent] of agents) {
      const bit = AGENT_BIT[id] ?? 0;
      if (!bit || agent.altitude < 0.5) continue;

      const last = lastStampRef.current[id];
      if (!last) {
        // First stamp of a run also lays down the track flown so far.
        for (const p of agent.trajectory) {
          if (stampFootprint(grid, p.x, p.y, bit)) stamped = true;
        }
        if (stampFootprint(grid, agent.position.x, agent.position.y, bit)) stamped = true;
        lastStampRef.current[id] = { x: agent.position.x, y: agent.position.y };
        continue;
      }

      if (Math.hypot(agent.position.x - last.x, agent.position.y - last.y) >= STAMP_STEP_M) {
        if (stampFootprint(grid, agent.position.x, agent.position.y, bit)) stamped = true;
        lastStampRef.current[id] = { x: agent.position.x, y: agent.position.y };
      }
    }

    if (stamped) {
      paintSurveyGrid(grid, paletteMode);
      if (overlayTextureRef.current) overlayTextureRef.current.needsUpdate = true;
    }

    // Remeasure on a slow cadence; publish only when the figures move.
    const now = performance.now();
    if (now - lastMeasureRef.current >= MEASURE_INTERVAL_MS) {
      lastMeasureRef.current = now;
      const measured = measureCoverage(grid);
      const prev = publishedRef.current;
      const changed =
        !prev ||
        prev.cellsMapped !== measured.cellsMapped ||
        prev.gapCount !== measured.gapCount ||
        prev.cellsTotal !== measured.cellsTotal;

      if (changed) {
        publishedRef.current = measured;
        setCoverage(measured);
        onCoverageChange?.(measured);

        if (gapGroupRef.current) {
          const group = gapGroupRef.current;
          while (group.children.length > 0) {
            const child = group.children[0];
            group.remove(child);
            const mesh = child as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            const mat = mesh.material as THREE.Material | undefined;
            if (mat) mat.dispose();
            child.traverse((sub) => {
              const subMesh = sub as THREE.Mesh;
              if (subMesh.geometry) subMesh.geometry.dispose();
              const subMat = subMesh.material as THREE.Material | undefined;
              if (subMat) subMat.dispose();
            });
          }

          for (const gap of measured.gaps) {
            const marker = new THREE.Group();
            marker.position.set(gap.x, 0, -gap.y);

            const ring = makeRing(15, 17, HEX.warning, 0.45, 40);
            marker.add(ring);

            const pole = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 9, 0),
              ]),
              new THREE.LineDashedMaterial({
                color: HEX.warning,
                dashSize: 1.4,
                gapSize: 1.4,
                transparent: true,
                opacity: 0.6,
              })
            );
            pole.computeLineDistances();
            marker.add(pole);

            const cap = new THREE.Mesh(
              new THREE.OctahedronGeometry(1.2, 0),
              new THREE.MeshBasicMaterial({ color: HEX.warning, transparent: true, opacity: 0.85 })
            );
            cap.position.y = 9;
            marker.add(cap);

            group.add(marker);
          }
        }
      }
    }

    // Follow mode keeps the orbit target locked to the vehicle.
    if (cameraMode.startsWith('AAV-')) {
      const followed = simState.agents[cameraMode];
      if (followed) {
        targetRef.current.set(followed.position.x, followed.position.z, -followed.position.y);
        updateCameraPosition();
      }
    }
  }, [
    simState,
    grid,
    paletteMode,
    showTracks,
    showLandmarks,
    showUplinks,
    showFootprints,
    selectedAgentId,
    cameraMode,
    onCoverageChange,
    updateCameraPosition,
  ]);

  /* ------------------------------------------------------------------ */
  /* Camera presets, orbit, picking, fullscreen                          */
  /* ------------------------------------------------------------------ */

  const applyCameraMode = useCallback(
    (mode: CameraMode) => {
      setCameraMode(mode);
      if (mode === 'TACTICAL') {
        orbitRef.current = { radius: 200, theta: 0.8, phi: 1.05 };
        targetRef.current.set(0, 0, 5);
      } else if (mode === 'TOP_DOWN') {
        orbitRef.current = { radius: 215, theta: 0, phi: 0.06 };
        targetRef.current.set(0, 0, 0);
      } else if (mode === 'MEC') {
        orbitRef.current = { radius: 110, theta: 2.2, phi: 1.25 };
        targetRef.current.set(0, 28, -5);
      } else {
        // Following a vehicle also selects it, so every panel agrees.
        orbitRef.current = { radius: 48, theta: 0.9, phi: 1.15 };
        onSelectAgent?.(mode);
      }
      updateCameraPosition();
    },
    [onSelectAgent, updateCameraPosition]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragDistRef.current = 0;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
    dragDistRef.current += Math.abs(dx) + Math.abs(dy);

    orbitRef.current.theta -= dx * 0.008;
    orbitRef.current.phi = Math.max(
      0.05,
      Math.min(Math.PI / 2 - 0.04, orbitRef.current.phi - dy * 0.008)
    );
    updateCameraPosition();
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  /** Click selects a vehicle; drags are ignored. */
  const handleClick = (e: React.MouseEvent) => {
    if (dragDistRef.current > 5) return;
    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera || !onSelectAgent) return;

    const rect = container.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);

    const hits = raycaster.intersectObjects(Object.values(droneGroupsRef.current), true);
    if (hits.length === 0) return;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && !obj.userData.agentId) obj = obj.parent;
    if (obj?.userData.agentId) onSelectAgent(obj.userData.agentId as string);
  };

  // Wheel zoom needs a non-passive listener to cancel page scroll.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbitRef.current.radius = Math.max(
        26,
        Math.min(360, orbitRef.current.radius + e.deltaY * 0.15)
      );
      updateCameraPosition();
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [updateCameraPosition]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void container.requestFullscreen?.();
    }
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  const activeLayers = [showSurvey, showTracks, showLandmarks, showUplinks, showFootprints].filter(
    Boolean
  ).length;
  const coveragePercent = Math.round(coverage.overallPercent);
  const isFusedNow = simState.collabSlam.fusionStage === 'GLOBAL_FUSED';

  return (
    <div
      ref={containerRef}
      id="global-3d-map-container"
      className="relative h-full w-full cursor-grab select-none overflow-hidden bg-surface-0 active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
    >
      {/* Top bar: layer menu on the left, view controls on the right */}
      <div className="pointer-events-none absolute inset-x-2 top-2 z-30 flex items-start justify-between gap-2">
        <div className="pointer-events-auto relative" onMouseDown={(e) => e.stopPropagation()}>
          <Button
            id="btn-map-layers"
            size="sm"
            variant="neutral"
            active={isLayersOpen}
            icon={<Layers className="h-3.5 w-3.5" />}
            onClick={(e) => {
              e.stopPropagation();
              setIsLayersOpen((open) => !open);
            }}
          >
            <span>Layers</span>
            <span className="telemetry text-3xs text-ink-3">{activeLayers}/5</span>
            {isLayersOpen ? (
              <ChevronUp className="h-3 w-3 text-ink-3" />
            ) : (
              <ChevronDown className="h-3 w-3 text-ink-3" />
            )}
          </Button>

          {isLayersOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 top-full z-40 mt-1.5 w-64 rounded-md border border-line bg-surface-1 p-2.5"
            >
              <div className="mb-1.5 flex items-center justify-between border-b border-white/10 pb-1.5">
                <span className="text-2xs font-medium text-ink-2">Map layers</span>
                <span className="telemetry text-3xs text-ink-4">{activeLayers} active</span>
              </div>
              <div className="space-y-1">
                <LayerToggle
                  id="toggle-layer-survey"
                  icon={<Scan className="h-3.5 w-3.5" />}
                  label="Survey coverage"
                  hint={`${coveragePercent}%`}
                  active={showSurvey}
                  onToggle={() => setShowSurvey((v) => !v)}
                />
                <LayerToggle
                  id="toggle-layer-tracks"
                  icon={<Compass className="h-3.5 w-3.5" />}
                  label="Vehicle tracks"
                  active={showTracks}
                  onToggle={() => setShowTracks((v) => !v)}
                />
                <LayerToggle
                  id="toggle-layer-landmarks"
                  icon={<Radio className="h-3.5 w-3.5" />}
                  label="SLAM landmarks"
                  active={showLandmarks}
                  onToggle={() => setShowLandmarks((v) => !v)}
                />
                <LayerToggle
                  id="toggle-layer-uplinks"
                  icon={<Wifi className="h-3.5 w-3.5" />}
                  label="5G uplinks"
                  active={showUplinks}
                  onToggle={() => setShowUplinks((v) => !v)}
                />
                <LayerToggle
                  id="toggle-layer-footprints"
                  icon={<Eye className="h-3.5 w-3.5" />}
                  label="Camera footprint"
                  active={showFootprints}
                  onToggle={() => setShowFootprints((v) => !v)}
                />
              </div>
            </div>
          )}
        </div>

        <div
          className="pointer-events-auto flex flex-wrap items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Segmented<CameraMode>
            aria-label="Camera preset"
            value={cameraMode}
            onChange={applyCameraMode}
            options={[
              { value: 'TACTICAL', label: 'Orbit', id: 'btn-cam-tactical', title: CAMERA_MODE_LABEL.TACTICAL },
              { value: 'TOP_DOWN', label: 'Top-down', id: 'btn-cam-topdown', title: CAMERA_MODE_LABEL.TOP_DOWN },
              { value: 'MEC', label: 'Edge node', id: 'btn-cam-mec', title: CAMERA_MODE_LABEL.MEC },
            ]}
          />
          <Segmented<CameraMode>
            aria-label="Follow vehicle"
            mono
            value={cameraMode}
            onChange={applyCameraMode}
            options={AGENT_IDS.map((id) => ({
              value: id as CameraMode,
              label: id,
              id: `btn-cam-${id.toLowerCase()}`,
              title: CAMERA_MODE_LABEL[id],
            }))}
          />
          <Button
            id="btn-map-fullscreen"
            size="sm"
            variant="neutral"
            iconOnly
            aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            title={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            onClick={toggleFullscreen}
            icon={
              isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />
            }
          />
        </div>
      </div>

      {/* Survey panel */}
      <div
        id="survey-panel"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute right-2 top-12 z-20 max-h-[calc(100%-3.5rem)] w-64 overflow-y-auto rounded-md border border-line bg-surface-1"
      >
        <button
          type="button"
          aria-expanded={isSurveyPanelOpen}
          onClick={() => setIsSurveyPanelOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-2 border-b border-line bg-surface-2 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-3"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Scan className="h-3.5 w-3.5 shrink-0 text-ink-3" />
            <span className="truncate text-2xs font-medium text-ink">Area surveyed</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="telemetry text-2xs font-semibold text-ink">{coveragePercent}%</span>
            {isSurveyPanelOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-ink-3" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-ink-3" />
            )}
          </span>
        </button>

        {isSurveyPanelOpen && (
          <div className="space-y-2 p-2.5">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-3xs text-ink-3">Mapped ground</span>
                <span className="telemetry text-2xs font-semibold text-ink">
                  {formatCount(coverage.areaMappedM2)} m²
                </span>
              </div>
              <ProgressBar
                className="mt-1.5"
                value={coveragePercent}
                tone={coveragePercent > 80 ? 'success' : coveragePercent > 40 ? 'warning' : 'neutral'}
                label="Overall survey coverage"
              />
              <div className="mt-1 text-3xs text-ink-4">
                {formatCount(coverage.cellsMapped)} of {formatCount(coverage.cellsTotal)} cells ·{' '}
                {coverage.cellAreaM2.toFixed(0)} m² each
              </div>
            </div>

            <div className="space-y-1.5 border-t border-white/10 pt-2">
              {coverage.sectors.length === 0 ? (
                <p className="text-3xs text-ink-4">Start the mission to begin the survey.</p>
              ) : (
                coverage.sectors.map((sector) => (
                  <div key={sector.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-sm"
                          style={{ backgroundColor: AGENT_COLOR[sector.assignedAgent] ?? '#7b818a' }}
                        />
                        <span className="truncate text-3xs text-ink-3">
                          Sector {sector.id} · {sector.assignedAgent}
                        </span>
                      </span>
                      <span className="telemetry text-3xs font-semibold text-ink">
                        {Math.round(sector.percent)}%
                      </span>
                    </div>
                    <ProgressBar
                      className="mt-1"
                      height={3}
                      value={sector.percent}
                      tone={
                        sector.percent > 80 ? 'success' : sector.percent > 40 ? 'warning' : 'neutral'
                      }
                      label={`Sector ${sector.id} coverage`}
                    />
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-white/10 pt-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-3xs text-ink-3">Coverage gaps</span>
                <StatusBadge
                  label={coverage.gapCount === 0 ? 'None' : `${coverage.gapCount} open`}
                  tone={coverage.gapCount === 0 ? 'success' : 'warning'}
                />
              </div>
              {coverage.gaps.length === 0 ? (
                <p className="text-3xs text-ink-4">
                  Every sector probe is inside a sensor footprint.
                </p>
              ) : (
                <ul className="max-h-24 space-y-1 overflow-y-auto pr-0.5">
                  {coverage.gaps.map((gap) => (
                    <li
                      key={`${gap.sector}-${gap.region}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-surface-2/50 backdrop-blur-md px-1.5 py-1"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0 text-warning-ink" />
                        <span className="min-w-0">
                          <span className="block truncate text-3xs text-ink-2">
                            {gap.sector} · {gap.region}
                          </span>
                          <span className="telemetry block text-3xs text-ink-4">
                            {gap.unmappedPercent}% unmapped
                          </span>
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        iconOnly
                        aria-label={`Follow ${gap.assignedAgent}`}
                        title={`Follow ${gap.assignedAgent}`}
                        onClick={() => applyCameraMode(gap.assignedAgent as CameraMode)}
                        icon={<Crosshair className="h-3 w-3" />}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5 border-t border-white/10 pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-3xs text-ink-3">Overlay</span>
                <Segmented
                  aria-label="Survey overlay palette"
                  value={paletteMode}
                  onChange={setPaletteMode}
                  options={[
                    { value: 'UNIFORM', label: 'Uniform', id: 'btn-palette-uniform' },
                    { value: 'AGENT', label: 'By vehicle', id: 'btn-palette-agent' },
                  ]}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-3xs text-ink-3">Opacity</span>
                <Segmented
                  aria-label="Survey overlay opacity"
                  mono
                  value={String(overlayOpacity)}
                  onChange={(v) => setOverlayOpacity(Number(v))}
                  options={[
                    { value: '0.4', label: '40%' },
                    { value: '0.7', label: '70%' },
                    { value: '0.95', label: '95%' },
                  ]}
                />
              </div>
              <LayerToggle
                id="toggle-gap-markers"
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                label="Gap markers on terrain"
                active={showGapMarkers}
                onToggle={() => setShowGapMarkers((v) => !v)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom: legend and fusion notice */}
      <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex flex-wrap items-end justify-between gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/15 bg-surface-1/80 backdrop-blur-xl px-3 py-1.5 text-3xs text-ink-2 shadow-lg">
            {AGENT_IDS.map((id) => (
              <span key={id} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ backgroundColor: AGENT_COLOR[id] }}
                />
                <span className="telemetry">{id}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-ink-2" />
              <span>Landmarks</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-primary" />
              <span>Shared matches</span>
            </span>
          </div>

          <div className="hidden rounded-lg border border-white/15 bg-surface-1/80 backdrop-blur-xl px-3 py-1.5 text-3xs text-ink-3 xl:block shadow-lg">
            Drag to orbit · scroll to zoom · click a vehicle to select
          </div>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
          {simState.isStressTest && (
            <StatusBadge label="Radio interference injected" tone="danger" dot />
          )}
          {isFusedNow && (
            <StatusBadge
              label={`Unified map · ${formatCount(simState.fusedPointCloud.length)} points`}
              tone="success"
            />
          )}
        </div>
      </div>
    </div>
  );
};
