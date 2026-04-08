import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { KeyboardPreview } from "./KeyboardPreview";

export function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 5, 8], fov: 45 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: "#09090b" }}
    >
      <color attach="background" args={["#09090b"]} />

      {/* Lighting */}
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1}
        color="#f0f0ff"
      />
      <directionalLight
        position={[-5, 8, -4]}
        intensity={0.3}
        color="#e0e0ff"
      />
      <pointLight position={[0, 6, 0]} intensity={0.15} color="#6366f1" />

      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        minDistance={2}
        maxDistance={20}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2.2}
        target={[1.5, 0, 0.6]}
      />
      <Environment preset="city" />

      {/* Contact shadow for grounding */}
      <ContactShadows
        position={[1.5, -0.2, 0.6]}
        opacity={0.35}
        scale={20}
        blur={2.5}
        far={4}
        color="#000"
      />

      {/* Keyboard */}
      <KeyboardPreview />
    </Canvas>
  );
}
