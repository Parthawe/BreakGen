import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { KeyboardPreview } from "./KeyboardPreview";

export function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 6, 10], fov: 50 }}
      gl={{ antialias: true }}
      shadows
    >
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={25}
        target={[1.5, 0, 0.8]}
      />
      <Environment preset="studio" />

      {/* Ground plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[1.5, -0.6, 0.8]}
        receiveShadow
      >
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#111113" />
      </mesh>

      {/* Keyboard — keycaps + plate rendered together */}
      <KeyboardPreview />
    </Canvas>
  );
}
