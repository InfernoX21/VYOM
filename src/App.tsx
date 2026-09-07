import React, { useState, useEffect, useMemo } from 'react';
import { SimulationEngine, SimulationState } from './simulation/simulationEngine';
import { CommandCenterHeader } from './components/CommandCenterHeader';
import { Global3DMap } from './components/Global3DMap';
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
  // Initialize simulation engine instance
  const engine = useMemo(() => new SimulationEngine('urban_disaster'), []);
  const [simState, setSimState] = useState<SimulationState>(() => engine.getState());
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>('AAV-01');

  // Modals state
  const [isFusionModalOpen, setIsFusionModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraModalAgentId, setCameraModalAgentId] = useState('AAV-01');
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);

  // Subscribe to simulation state
  useEffect(() => {
    const unsubscribe = engine.subscribe((newState) => {
      setSimState({ ...newState });
    });
    return () => unsubscribe();
  }, [engine]);

  // Handlers
  const handleStart = () => engine.start();
  const handlePause = () => engine.pause();
  const handleReset = () => engine.reset();
  const handleSetSpeed = (speed: number) => engine.setSpeed(speed);
  const handleToggleStressTest = () => engine.toggleStressTest();
  const handleTriggerFusion = () => {
    engine.triggerMapFusion();
    setIsFusionModalOpen(true);
  };
  const handleSelectScenario = (scenarioId: string) => engine.setScenario(scenarioId);

  const handleOpenLiveCamera = (agentId: string) => {
    setCameraModalAgentId(agentId);
    setIsCameraModalOpen(true);
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-black text-zinc-100 overflow-hidden font-sans antialiased select-none">
      {/* 1. Header Toolbar */}
      <CommandCenterHeader
        simState={simState}
        scenario={engine.getScenario()}
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
          setCameraModalAgentId('AAV-01');
          setIsCameraModalOpen(true);
        }}
        onOpenFusionModal={() => setIsFusionModalOpen(true)}
      />

      {/* 2. Main Command Center Grid */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 gap-2 bg-black">
        {/* Left Column / Centerpiece: Global 3D Tactical Map */}
        <div className="flex-[3] flex flex-col min-h-[380px] h-full rounded-sm overflow-hidden border border-zinc-800 bg-black">
          <Global3DMap
            simState={simState}
            scenario={engine.getScenario()}
            onSelectAgent={(id) => setSelectedAgentId(id)}
            selectedAgentId={selectedAgentId}
          />

          {/* Under Map: AAV Fleet Panel (always accessible for immediate multi-agent telemetry) */}
          <div className="shrink-0 p-1.5 bg-black border-t border-zinc-800">
            <AAVFleetPanel
              agents={simState.agents}
              selectedAgentId={selectedAgentId}
              onSelectAgent={(id) => setSelectedAgentId(id)}
              onOpenLiveCamera={handleOpenLiveCamera}
            />
          </div>
        </div>

        {/* Right Column: Mission Control Telemetry (Collab SLAM, 5G Network, MEC Server, System Log) */}
        <div className="flex-[2] flex flex-col gap-2 overflow-y-auto max-w-full lg:max-w-[540px] pr-0.5 scrollbar-thin">
          {/* Collaborative SLAM Panel */}
          <CollaborativeSLAMPanel
            collabSlam={simState.collabSlam}
            agents={simState.agents}
            onTriggerFusion={handleTriggerFusion}
            onOpenFusionModal={() => setIsFusionModalOpen(true)}
          />

          {/* 5G Network Panel */}
          <NetworkPanel
            network={simState.network}
            isStressTest={simState.isStressTest}
            onToggleStressTest={handleToggleStressTest}
          />

          {/* MEC Edge Computing Panel */}
          <MECPanel
            mec={simState.mec}
            isFusing={simState.collabSlam.fusionStage !== 'IDLE' && simState.collabSlam.fusionStage !== 'GLOBAL_FUSED'}
          />

          {/* Real-time Event System Log */}
          <SystemLogPanel events={simState.events} />
        </div>
      </div>

      {/* 3. Interactive Modals */}
      <MapFusionModal
        isOpen={isFusionModalOpen}
        onClose={() => setIsFusionModalOpen(false)}
        collabSlam={simState.collabSlam}
        agents={simState.agents}
        mec={simState.mec}
        onTriggerFusion={handleTriggerFusion}
      />

      <DroneCameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        agents={simState.agents}
        initialAgentId={cameraModalAgentId}
      />

      <AnalyticsModal
        isOpen={isAnalyticsModalOpen}
        onClose={() => setIsAnalyticsModalOpen(false)}
        simState={simState}
      />

      <ArchitectureModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
      />
    </div>
  );
}
