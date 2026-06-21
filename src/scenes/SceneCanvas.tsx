import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { useStore } from '../lib/store.js';
import { SingleScene } from './SingleScene.js';
import { CubeScene } from './CubeScene.js';
import { ReptileScene } from './ReptileScene.js';
import { GrowthScene, type GrowthMetrics } from './GrowthScene.js';
import { VacuumScene, type VacuumHudMetrics } from './VacuumScene.js';

export function SceneCanvas({
  onMetrics,
  onVacuumMetrics,
}: {
  onMetrics?: (m: GrowthMetrics) => void;
  onVacuumMetrics?: (m: VacuumHudMetrics | null) => void;
}) {
  const scene = useStore((s) => s.scene);
  return (
    <Canvas
      shadows
      camera={{ position: [3, 2.4, 3.6], fov: 40 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      <color attach="background" args={['#1a1d21']} />
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[5, 7, 4]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-4, 2, -3]} intensity={0.35} />
      <Environment preset="city" />
      {scene === 'single' && <SingleScene />}
      {scene === 'cube' && <CubeScene />}
      {scene === 'reptile' && <ReptileScene />}
      {scene === 'growth' && <GrowthScene onMetrics={onMetrics} />}
      {scene === 'vacuum' && <VacuumScene onMetrics={onVacuumMetrics} />}
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}
