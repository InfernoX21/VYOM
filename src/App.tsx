import { useState, useEffect, useMemo } from 'react';
import { SimulationEngine, SimulationState } from './simulation/simulationEngine';
import { CommandCenterHeader } from './components/CommandCenterHeader';
import { Global3DMap, CoverageMetrics } from './components/Global3DMap';
import { AAVFleetPanel } from './components/AAVFleetPanel';
import { NetworkPanel } from './components/NetworkPanel';
import { MECPanel } from './components/MECPanel';
import { CollaborativeSLAMPanel } from './components/CollaborativeSLAMPanel';
import { SystemLogPanel } from './components/SystemLogPanel';
import { MapFusionModal } from './components/MapFusionModal';
import { DroneCameraModal } from './components/DroneCameraModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { ArchitectureModal } from './components/ArchitectureModal';

export default function App() {
  const engine = useMemo(() => new SimulationEngine('urban_disaster'), []);
  const [simState, setSimState] = useState<SimulationState>(() => engine.getState());
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>('AAV-01');

  /** Sector coverage is measured by the 3D view; lifted here so analytics agrees with the map. */
  const [coverage, setCoverage] = useState<CoverageMetrics | null>(null);

  const [isFusionModalOpen, setIsFusionModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraModalAgentId, setCameraModalAgentId] = useState('AAV-01');
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = engine.subscribe((newState) => {
      setSimState({ ...newState });
    });
    return () => unsubscribe();
  }, [engine]);

  const handleStart = () => engine.start();
  const handlePause = () => engine.pause();
  const handleReset = () => engine.reset();
  const handleSetSpeed = (speed: number) => engine.setSpeed(speed);
  const handleToggleStressTest = () => engine.toggleStressTest();
  const handleSelectScenario = (scenarioId: string) => engine.setScenario(scenarioId);

  /** Fusion drives the engine; the pipeline view opens so progress is visible. */
  const handleTriggerFusion = () => {
    engine.triggerMapFusion();
    setIsFusionModalOpen(true);
  };

  const handleOpenLiveCamera = (agentId: string) => {
    setCameraModalAgentId(agentId);
    setIsCameraModalOpen(true);
  };

  const isFusing =
    simState.collabSlam.fusionStage !== 'IDLE' &&
    simState.collabSlam.fusionStage !== 'GLOBAL_FUSED';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface-0 text-ink">
      <CommandCenterHeader
        simState={simState}
        scenario={engine.getScenario()}
        coveragePercent={coverage?.overallPercent ?? 0}
        onStart={handleStart}
        onPause={handlePause}
        onReset={handleReset}
        onSetSpeed={handleSetSpeed}
        onToggleStressTest={handleToggleStressTest}
        onTriggerFusion={handleTriggerFusion}
        onSelectScenario={handleSelectScenario}
        onOpenAnalytics={() => setIsAnalyticsModalOpen(true)}
        onOpenArchitecture={() => setIsArchitectureModalOpen(true)}
        onOpenCameraFeed={() => {
          setCameraModalAgentId(selectedAgentId ?? 'AAV-01');
          setIsCameraModalOpen(true);
        }}
        onOpenFusionModal={() => setIsFusionModalOpen(true)}
      />

      {/* Main workspace: the 3D view stays dominant, telemetry sits in a fixed rail. */}
      <main className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 lg:flex-row lg:overflow-hidden">
        <div className="flex min-h-[380px] flex-[3] flex-col gap-2 overflow-hidden">
          <section className="flex shrink-0 items-center justify-between gap-4 border border-line bg-surface-1 px-3 py-2">
            <div className="min-w-0">
              <div className="text-3xs font-medium text-ink-3">Mission objective</div>
              <div className="truncate text-2xs font-medium text-ink">{engine.getScenario().missionObjective}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-3xs text-ink-3">Operation</div>
              <div className="text-2xs font-semibold text-primary-ink">{engine.getScenario().operationLabel}</div>
            </div>
          </section>
          <div className="panel min-h-0 flex-1 overflow-hidden bg-surface-0">
            <Global3DMap
              simState={simState}
              scenario={engine.getScenario()}
              onSelectAgent={(id) => setSelectedAgentId(id)}
              selectedAgentId={selectedAgentId}
              onCoverageChange={setCoverage}
            />
          </div>

          <AAVFleetPanel
            agents={simState.agents}
            selectedAgentId={selectedAgentId}
            onSelectAgent={(id) => setSelectedAgentId(id)}
            onOpenLiveCamera={handleOpenLiveCamera}
          />
        </div>

        <div className="flex w-full min-h-0 flex-[2] flex-col gap-2 overflow-y-auto lg:max-w-[480px] xl:max-w-[540px]">
          <CollaborativeSLAMPanel
            collabSlam={simState.collabSlam}
            agents={simState.agents}
            missionStatus={simState.missionStatus}
            onTriggerFusion={handleTriggerFusion}
            onOpenFusionModal={() => setIsFusionModalOpen(true)}
          />

          <NetworkPanel
            network={simState.network}
            isStressTest={simState.isStressTest}
            onToggleStressTest={handleToggleStressTest}
          />

          <MECPanel mec={simState.mec} isFusing={isFusing} />

          <SystemLogPanel events={simState.events} />
        </div>
      </main>

      <MapFusionModal
        isOpen={isFusionModalOpen}
        onClose={() => setIsFusionModalOpen(false)}
        collabSlam={simState.collabSlam}
        agents={simState.agents}
        mec={simState.mec}
        network={simState.network}
        onTriggerFusion={handleTriggerFusion}
      />

      <DroneCameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        agents={simState.agents}
        initialAgentId={cameraModalAgentId}
        isRunning={simState.isRunning}
      />

      <AnalyticsModal
        isOpen={isAnalyticsModalOpen}
        onClose={() => setIsAnalyticsModalOpen(false)}
        simState={simState}
        coverage={coverage}
      />

      <ArchitectureModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
      />
    </div>
  );
}
