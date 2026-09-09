import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Crosshair, Eye, Maximize2, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

type ViewMode = 'PHYSICAL' | 'SYSTEM';
type ComponentId =
  | 'battery' | 'motor' | 'gps' | 'lidar360' | 'sim' | 'usb' | 'propeller'
  | 'frontCamera' | 'bottomCamera' | 'payloadLoop' | 'lidar';

type DronePart = {
  id: ComponentId;
  number: string;
  name: string;
  function: string;
  specs: string[];
  location: string;
  reference: string;
  assembled: [number, number, number];
  exploded: [number, number, number];
};

const PARTS: DronePart[] = [
  { id: 'battery', number: '01', name: 'Battery enclosure', function: 'Protects and carries the flight battery.', specs: [], location: 'Central body', reference: 'Drone Anatomy, §1.1', assembled: [0, 0.18, 0], exploded: [0, -1.5, 0] },
  { id: 'motor', number: '02', name: 'Motor', function: 'Provides rotor drive for flight.', specs: [], location: 'At the ends of the airframe arms', reference: 'Drone Anatomy, §1.1', assembled: [0, 0.3, 0], exploded: [0, 0.8, 0] },
  { id: 'gps', number: '03', name: 'GPS', function: 'Provides onboard multi-constellation positioning.', specs: ['Multi-constellation onboard GPS'], location: 'Top of airframe', reference: 'Drone Anatomy, §1.1; Sensor and Features, §1.2', assembled: [0, 0.86, 0], exploded: [0, 2.45, 0] },
  { id: 'lidar360', number: '04', name: 'LIDAR-360', function: 'Provides 360-degree obstacle detection and avoidance.', specs: ['Range: up to 30 m', 'Angular resolution: 0.375°', 'Update rate: 10 Hz'], location: 'Top of airframe', reference: 'Drone Anatomy, §1.1; Sensor and Features, §1.2', assembled: [0, 0.56, 0], exploded: [0, 1.6, 0] },
  { id: 'sim', number: '05', name: 'SIM access slot', function: 'Provides access to the 5G nano SIM used for cellular connectivity.', specs: ['5G nano SIM'], location: 'Side access', reference: 'Drone Anatomy, §1.1; Network Connectivity', assembled: [0.88, 0.16, 0], exploded: [2.1, 0.16, 0] },
  { id: 'usb', number: '06', name: 'USB access slot', function: 'Provides a physical USB access point.', specs: [], location: 'Side access', reference: 'Drone Anatomy, §1.1', assembled: [-0.88, 0.16, 0], exploded: [-2.1, 0.16, 0] },
  { id: 'propeller', number: '07', name: 'Propeller', function: 'Produces lift when driven by the motors.', specs: [], location: 'Above each motor', reference: 'Drone Anatomy, §1.1', assembled: [0, 0.6, 0], exploded: [0, 1.65, 0] },
  { id: 'frontCamera', number: '08', name: 'Front camera', function: 'Wide-angle forward imaging.', specs: ['12 MP Raspberry Pi wide-angle camera'], location: 'Front of airframe', reference: 'Drone Anatomy, §1.1; Sensor and Features, §1.2', assembled: [0, 0.05, 0.82], exploded: [0, 0.05, 2.05] },
  { id: 'bottomCamera', number: '09', name: 'Bottom camera', function: 'Downward imaging.', specs: ['5 MP Raspberry Pi camera'], location: 'Bottom of airframe', reference: 'Drone Anatomy, §1.1; Sensor and Features, §1.2', assembled: [0, -0.42, 0], exploded: [0, -2.25, 0] },
  { id: 'payloadLoop', number: '10', name: 'Payload eye loop', function: 'Provides a payload attachment point.', specs: [], location: 'Underside of airframe', reference: 'Drone Anatomy, §1.1', assembled: [0, -0.25, -0.72], exploded: [0, -1.1, -1.85] },
  { id: 'lidar', number: '11', name: 'LIDAR', function: 'Down-facing obstacle and ground sensing.', specs: ['Range: up to 8 m', 'Update rate: 100 Hz'], location: 'Bottom of airframe', reference: 'Drone Anatomy, §1.1; Sensor and Features, §1.2', assembled: [0, -0.48, 0.38], exploded: [0, -2.1, 1.5] },
];

const partById = Object.fromEntries(PARTS.map((part) => [part.id, part])) as Record<ComponentId, DronePart>;
const VIEWS: { label: string; position: [number, number, number] }[] = [
  { label: 'Front', position: [0, 1.3, 9] }, { label: 'Rear', position: [0, 1.3, -9] },
  { label: 'Top', position: [0, 9, 0.01] }, { label: 'Bottom', position: [0, -8, 0.01] },
  { label: 'Left', position: [-9, 1.3, 0] }, { label: 'Right', position: [9, 1.3, 0] },
  { label: 'Isometric', position: [7, 5.5, 8] },
];

const makeMaterial = (color: number, metalness = 0.55) => new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.34 });

function makeText(text: string, color = '#e7e4dc') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '600 30px ui-monospace, monospace';
  ctx.fillStyle = color; ctx.fillText(text, 10, 56);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
  sprite.scale.set(3.4, 0.64, 1);
  return sprite;
}

function DroneViewer({ separation, selected, onSelect, labels, connections, overlays, cameraPreset }: {
  separation: number; selected: ComponentId | null; onSelect: (id: ComponentId) => void; labels: boolean;
  connections: boolean; overlays: boolean; cameraPreset: [number, number, number] | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const separationRef = useRef(separation); separationRef.current = separation;
  const labelsRef = useRef(labels); labelsRef.current = labels;
  const connectionsRef = useRef(connections); connectionsRef.current = connections;
  const overlaysRef = useRef(overlays); overlaysRef.current = overlays;
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    const element = host.current; if (!element) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0d0e);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100); camera.position.set(7, 5.5, 8); cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); element.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xf5eee0, 0x111417, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(6, 9, 5); scene.add(key);
    const grid = new THREE.GridHelper(18, 18, 0x2b3236, 0x182025); grid.position.y = -2.7; scene.add(grid);
    const root = new THREE.Group(); scene.add(root);
    const groups: Partial<Record<ComponentId, THREE.Group>> = {};
    const callouts = new THREE.Group(); scene.add(callouts);
    const overlayGroup = new THREE.Group(); scene.add(overlayGroup);
    const bodyMat = makeMaterial(0x2e3538); const accentMat = makeMaterial(0xc57a2b); const lensMat = makeMaterial(0x15262d, 0.8);
    const add = (id: ComponentId, object: THREE.Object3D) => { const g = new THREE.Group(); g.userData.partId = id; g.add(object); root.add(g); groups[id] = g; };
    add('battery', new THREE.Mesh(new THREE.BoxGeometry(1.65, .56, 1.25), bodyMat));
    const motors = new THREE.Group(); [[-1.7, -1.35], [1.7, -1.35], [-1.7, 1.35], [1.7, 1.35]].forEach(([x, z]) => { const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x), .13, .14), bodyMat); arm.position.set(x / 2, 0, z); motors.add(arm); const motor = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .32, 20), accentMat); motor.position.set(x, .08, z); motors.add(motor); }); add('motor', motors);
    const props = new THREE.Group(); [[-1.7, -1.35], [1.7, -1.35], [-1.7, 1.35], [1.7, 1.35]].forEach(([x, z]) => { const blade = new THREE.Mesh(new THREE.BoxGeometry(1.05, .05, .16), makeMaterial(0x525b5f)); blade.position.set(x, .32, z); props.add(blade); const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; props.add(blade2); }); add('propeller', props);
    add('gps', new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .16, 18), makeMaterial(0xe5e2d9))); add('lidar360', new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, .25, 32), accentMat));
    const sim = new THREE.Mesh(new THREE.BoxGeometry(.08, .18, .42), makeMaterial(0x151a1d)); add('sim', sim); const usb = sim.clone(); usb.scale.set(1, 1.15, 1.1); add('usb', usb);
    const front = new THREE.Mesh(new THREE.BoxGeometry(.7, .28, .2), lensMat); add('frontCamera', front); const bottom = new THREE.Mesh(new THREE.BoxGeometry(.46, .16, .46), lensMat); add('bottomCamera', bottom);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(.22, .06, 10, 20), accentMat); loop.rotation.x = Math.PI / 2; add('payloadLoop', loop); add('lidar', new THREE.Mesh(new THREE.CylinderGeometry(.25, .34, .22, 20), makeMaterial(0xd4d7d5)));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, .012, 8, 72), new THREE.MeshBasicMaterial({ color: 0x4dc6a8, transparent: true, opacity: .35 })); ring.rotation.x = Math.PI / 2; ring.position.y = .55; overlayGroup.add(ring);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.25, 3.2, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0x5ca7d7, transparent: true, opacity: .12, side: THREE.DoubleSide })); beam.position.set(0, -2.05, .38); overlayGroup.add(beam);
    const frontFov = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.3, 4, 1, true), new THREE.MeshBasicMaterial({ color: 0xc57a2b, transparent: true, opacity: .10, side: THREE.DoubleSide })); frontFov.rotation.x = Math.PI / 2; frontFov.position.set(0, .05, 2.55); overlayGroup.add(frontFov);
    const axes = new THREE.AxesHelper(2.2); overlayGroup.add(axes);
    const ray = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let dragging = false; let previous = { x: 0, y: 0 }; let yaw = .65; let pitch = .42; let radius = 12;
    const resize = () => { const { width, height } = element.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix(); };
    const pointerDown = (event: PointerEvent) => { dragging = true; previous = { x: event.clientX, y: event.clientY }; element.setPointerCapture(event.pointerId); };
    const pointerMove = (event: PointerEvent) => { if (!dragging) return; yaw -= (event.clientX - previous.x) * .008; pitch = Math.max(-1.35, Math.min(1.35, pitch - (event.clientY - previous.y) * .008)); previous = { x: event.clientX, y: event.clientY }; };
    const pointerUp = (event: PointerEvent) => { if (Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 3) { const rect = element.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); ray.setFromCamera(pointer, camera); const hit = ray.intersectObjects(root.children, true)[0]; const group = hit?.object.parent?.userData.partId ? hit.object.parent : hit?.object.parent?.parent; if (group?.userData.partId) onSelectRef.current(group.userData.partId); } dragging = false; };
    const wheel = (event: WheelEvent) => { radius = Math.max(5, Math.min(20, radius + event.deltaY * .012)); };
    element.addEventListener('pointerdown', pointerDown); element.addEventListener('pointermove', pointerMove); element.addEventListener('pointerup', pointerUp); element.addEventListener('wheel', wheel, { passive: true }); const observer = new ResizeObserver(resize); observer.observe(element); resize();
    let frame = 0; const animate = () => { const f = separationRef.current; PARTS.forEach((part) => { const group = groups[part.id]!; const [ax, ay, az] = part.assembled; const [ex, ey, ez] = part.exploded; group.position.set(ax + (ex - ax) * f, ay + (ey - ay) * f, az + (ez - az) * f); group.traverse((object) => { const material = (object as THREE.Mesh).material as THREE.Material | undefined; if (material && 'emissive' in material) { const active = selectedRef.current === part.id; (material as THREE.MeshStandardMaterial).emissive.setHex(active ? 0x805017 : 0x000000); (material as THREE.MeshStandardMaterial).opacity = selectedRef.current && !active ? .23 : 1; (material as THREE.MeshStandardMaterial).transparent = !!selectedRef.current; } }); });
      callouts.clear(); PARTS.forEach((part, index) => { const g = groups[part.id]!; const p = g.position.clone(); const side = index % 2 ? 1 : -1; const end = p.clone().add(new THREE.Vector3(side * 2.2, 1.0 + (index % 3) * .22, 0)); const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, end]), new THREE.LineBasicMaterial({ color: selectedRef.current === part.id ? 0xe5a047 : 0x899197 })); line.visible = connectionsRef.current; callouts.add(line); const label = makeText(`${part.number}  ${part.name.toUpperCase()}`, selectedRef.current === part.id ? '#f0ae58' : '#d9dedf'); label.position.copy(end).add(new THREE.Vector3(side * .9, .1, 0)); label.visible = labelsRef.current; callouts.add(label); });
      callouts.visible = labelsRef.current || connectionsRef.current; overlayGroup.visible = overlaysRef.current; const cp = camera.position; const target = targetRef.current; if (!dragging) { const desired = new THREE.Vector3(radius * Math.cos(pitch) * Math.sin(yaw), radius * Math.sin(pitch) + .4, radius * Math.cos(pitch) * Math.cos(yaw)); cp.lerp(desired, .08); } camera.lookAt(target); renderer.render(scene, camera); frame = requestAnimationFrame(animate); }; animate();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); element.removeEventListener('pointerdown', pointerDown); element.removeEventListener('pointermove', pointerMove); element.removeEventListener('pointerup', pointerUp); element.removeEventListener('wheel', wheel); renderer.dispose(); element.removeChild(renderer.domElement); };
  }, []);
  useEffect(() => { if (cameraPreset && cameraRef.current) cameraRef.current.position.set(...cameraPreset); }, [cameraPreset]);
  return <div ref={host} className="h-[520px] min-h-[420px] w-full cursor-grab border border-line bg-[#0b0d0e] active:cursor-grabbing" aria-label="Interactive drone technical model" />;
}

const SystemView = () => (
  <div className="grid min-h-[520px] place-items-center border border-line bg-[#0b0d0e] p-5">
    <div className="grid w-full max-w-4xl grid-cols-1 gap-4 text-center md:grid-cols-4">
      <ArchitectureNode title="Sensors" items={['GPS', 'IMU', 'LIDAR-360', 'Down-facing LIDAR', 'Front camera', 'Bottom camera']} />
      <ArchitectureNode title="Drone control / computation" items={['Flight / control system']} />
      <ArchitectureNode title="Communication" items={['Wi-Fi 802.11ac', '5G module', '5G / 4G / 3G']} />
      <ArchitectureNode title="Ground control" items={['5G network / gNodeB', 'Ground control GUI']} />
    </div>
    <div className="mt-7 w-full max-w-3xl border-t border-line pt-4 text-center">
      <div className="telemetry text-3xs text-ink-4">NETWORK PATH</div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-2xs font-semibold text-ink"><span>DRONE</span><span className="text-primary">→</span><span>5G MODULE</span><span className="text-primary">→</span><span>5G NETWORK / gNodeB</span><span className="text-primary">→</span><span>GROUND CONTROL SYSTEM</span></div>
    </div>
  </div>
);

const ArchitectureNode = ({ title, items }: { title: string; items: string[] }) => <section className="relative border border-line bg-surface-1 p-4 text-left md:after:absolute md:after:-right-4 md:after:top-1/2 md:after:text-primary md:after:content-['→']"><h3 className="telemetry text-2xs font-semibold text-primary-ink">{title.toUpperCase()}</h3><ul className="mt-3 space-y-1.5 text-2xs text-ink-2">{items.map((item) => <li key={item}>{item}</li>)}</ul></section>;

export const DroneArchitectureModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [view, setView] = useState<ViewMode>('PHYSICAL'); const [separation, setSeparation] = useState(0); const [selected, setSelected] = useState<ComponentId | null>(null);
  const [labels, setLabels] = useState(true); const [connections, setConnections] = useState(true); const [overlays, setOverlays] = useState(true); const [query, setQuery] = useState(''); const [cameraPreset, setCameraPreset] = useState<[number, number, number] | null>(null); const [showDocs, setShowDocs] = useState(false);
  const active = selected ? partById[selected] : null;
  const matches = useMemo(() => query.trim() ? PARTS.filter((part) => `${part.name} ${part.function}`.toLowerCase().includes(query.toLowerCase())) : [], [query]);
  const reset = useCallback(() => { setSeparation(0); setSelected(null); setQuery(''); setCameraPreset([7, 5.5, 8]); }, []);
  return <Modal isOpen={isOpen} onClose={onClose} width="max-w-[1440px]" icon={<Box className="h-4 w-4" />} title="3D drone architecture" subtitle="Signaltron 5G Labs autonomous drone · technical digital twin" toolbar={<div className="flex min-w-max items-center gap-2"><div className="flex overflow-hidden border border-line"><button className={`px-3 py-1.5 text-2xs ${view === 'PHYSICAL' ? 'bg-surface-3 text-ink' : 'text-ink-3'}`} onClick={() => setView('PHYSICAL')}>Physical view</button><button className={`border-l border-line px-3 py-1.5 text-2xs ${view === 'SYSTEM' ? 'bg-surface-3 text-ink' : 'text-ink-3'}`} onClick={() => setView('SYSTEM')}>System view</button></div><Button variant="neutral" size="sm" onClick={() => setShowDocs((value) => !value)} icon={<BookOpenFallback />}>Documentation</Button></div>} footer={<div className="flex w-full items-center justify-between"><span className="text-3xs text-ink-4">Source: Signaltron 5G Labs Drone Kit Training Manual</span><Button variant="neutral" size="sm" onClick={onClose}>Close</Button></div>}>
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 space-y-2"><div className="flex flex-wrap items-center justify-between gap-2 border border-line bg-surface-1 p-2"><div className="flex items-center gap-1"><Button variant="primary" size="sm" onClick={() => setSeparation(1)}>Exploded view</Button><Button variant="neutral" size="sm" onClick={() => setSeparation(0)}>Assembled</Button><Button variant="ghost" size="sm" onClick={reset} icon={<RotateCcw className="h-3 w-3" />}>Reset</Button></div><span className="telemetry text-3xs text-ink-3">{separation === 0 ? 'ASSEMBLED' : separation === 1 ? 'FULL EXPLODED' : 'CUSTOM EXPLODED'}</span></div>
        <div className="flex items-center gap-2 border border-line bg-surface-1 px-3 py-2"><SlidersHorizontal className="h-3.5 w-3.5 text-ink-3" /><span className="text-3xs text-ink-3">Compact</span><input aria-label="Exploded view separation" type="range" min="0" max="1" step="0.01" value={separation} onChange={(event) => setSeparation(Number(event.target.value))} className="accent-primary flex-1" /><span className="text-3xs text-ink-3">Full exploded</span></div>
        {view === 'PHYSICAL' ? <DroneViewer separation={separation} selected={selected} onSelect={setSelected} labels={labels} connections={connections} overlays={overlays} cameraPreset={cameraPreset} /> : <SystemView />}
        <div className="flex flex-wrap items-center gap-1.5 border border-line bg-surface-1 p-2"><span className="mr-1 text-3xs text-ink-4">CAMERA</span>{VIEWS.map((preset) => <button key={preset.label} className="border border-line px-2 py-1 text-3xs text-ink-2 hover:bg-surface-2" onClick={() => { setView('PHYSICAL'); setCameraPreset(preset.position); }}>{preset.label}</button>)}<button className="ml-2 border border-line px-2 py-1 text-3xs text-ink-2 hover:bg-surface-2" onClick={() => setCameraPreset([7, 5.5, 8])}>Fit model</button></div>
      </section>
      <aside className="space-y-2"><section className="border border-line bg-surface-1 p-3"><div className="flex items-center gap-2 border-b border-line pb-2"><Search className="h-3.5 w-3.5 text-ink-3" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search component..." className="w-full bg-transparent text-2xs text-ink outline-none placeholder:text-ink-4" /></div>{matches.length > 0 && <div className="mt-2 space-y-1">{matches.map((part) => <button key={part.id} className="w-full border border-line px-2 py-1.5 text-left text-2xs text-ink-2 hover:bg-surface-2" onClick={() => { setSelected(part.id); setView('PHYSICAL'); }}>{part.number} · {part.name}</button>)}</div>}</section>
        <section className="border border-line bg-surface-1 p-3"><h3 className="telemetry text-2xs text-primary-ink">DRONE ARCHITECTURE</h3><div className="mt-2 space-y-1 text-2xs text-ink-2"><Status label="Model" value="STDR-2445" /><Status label="View" value={separation ? 'Exploded' : 'Assembled'} /><Status label="Components" value="11" /><Status label="Sensors" value="Simulation" /><Status label="Cameras" value="2" /><Status label="LIDAR" value="2" /><Status label="Positioning" value="GPS" /><Status label="Communication" value="5G / Wi-Fi" /></div></section>
        <section className="border border-line bg-surface-1 p-3"><h3 className="telemetry text-2xs text-primary-ink">ENGINEERING OVERLAYS</h3><div className="mt-2 grid grid-cols-2 gap-1.5">{[[labels, setLabels, 'Labels'], [connections, setConnections, 'Connections'], [overlays, setOverlays, 'Sensor coverage']] .map(([value, setter, label]) => <button key={label as string} className={`border px-2 py-1.5 text-3xs ${value ? 'border-primary bg-primary/10 text-primary-ink' : 'border-line text-ink-3'}`} onClick={() => (setter as React.Dispatch<React.SetStateAction<boolean>>)((current) => !current)}>{value ? 'Hide' : 'Show'} {label as string}</button>)}</div><p className="mt-2 text-3xs leading-relaxed text-ink-4">Coverage overlays represent the manual-described 360° LIDAR scan, down-facing LIDAR beam, and camera fields of view.</p></section>
        <section className="border border-line bg-surface-1 p-3">{active ? <><div className="flex items-start justify-between gap-2"><h3 className="telemetry text-2xs text-primary-ink">{active.number} · {active.name.toUpperCase()}</h3><Crosshair className="h-3.5 w-3.5 text-primary" /></div><p className="mt-2 text-2xs leading-relaxed text-ink-2">{active.function}</p>{active.specs.length > 0 && <div className="mt-3 space-y-1">{active.specs.map((spec) => <div key={spec} className="text-2xs text-ink-3">{spec}</div>)}</div>}<div className="mt-3 border-t border-line pt-2 text-3xs text-ink-4">Location: {active.location}<br />Manual reference: {active.reference}</div></> : <><h3 className="telemetry text-2xs text-primary-ink">COMPONENT INSPECTION</h3><p className="mt-2 text-2xs leading-relaxed text-ink-3">Select a labeled component or search the assembly to inspect its manual-supported role and specifications.</p></>}</section>
      </aside>
    </div>
    {showDocs && <section className="mt-3 border border-line bg-surface-1 p-3"><h3 className="telemetry text-2xs text-primary-ink">DOCUMENTATION</h3><div className="mt-2 grid gap-2 text-2xs text-ink-3 sm:grid-cols-2 lg:grid-cols-4"><span>Drone Anatomy · §1.1</span><span>Sensor and Features · §1.2</span><span>Assembly</span><span>Network Connectivity</span><span>Camera</span><span>GPS</span><span>LIDAR</span></div><p className="mt-2 text-3xs text-ink-4">Component entries cite the relevant manual section. No page number is displayed where it could not be confirmed from the provided manual source.</p></section>}
  </Modal>;
};

const Status = ({ label, value }: { label: string; value: string }) => <div className="flex justify-between gap-2"><span className="text-ink-4">{label.toUpperCase()}</span><span className="telemetry text-ink">{value}</span></div>;
const BookOpenFallback = () => <Eye className="h-3 w-3" />;
