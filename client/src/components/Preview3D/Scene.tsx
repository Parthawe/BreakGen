import { useEffect, useRef, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { KeyboardPreview } from "./KeyboardPreview";
import { useProjectStore } from "../../stores/projectStore";

const UNIT_MM = 19.05;
const S = 0.1;

function AutoTarget() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const keys = useProjectStore((s) => s.project?.layout.keys ?? []);

  const center = useMemo(() => {
    if (keys.length === 0) return [0, 0, 0] as const;
    const minX = Math.min(...keys.map((k) => k.x_u));
    const minY = Math.min(...keys.map((k) => k.y_u));
    const maxX = Math.max(...keys.map((k) => k.x_u + k.w_u));
    const maxY = Math.max(...keys.map((k) => k.y_u + (k.h_u ?? 1)));
    return [
      ((minX + maxX) / 2) * UNIT_MM * S,
      0,
      ((minY + maxY) / 2) * UNIT_MM * S,
    ] as const;
  }, [keys.length]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(center[0], center[1], center[2]);
      controlsRef.current.update();
    }
  }, [center]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      minDistance={2}
      maxDistance={20}
      minPolarAngle={0.3}
      maxPolarAngle={Math.PI / 2.2}
    />
  );
}

function SceneLighting() {
  const keys = useProjectStore((s) => s.project?.layout.keys ?? []);
  const center = useMemo(() => {
    if (keys.length === 0) return { x: 0, z: 0 };
    const minX = Math.min(...keys.map((k) => k.x_u));
    const maxX = Math.max(...keys.map((k) => k.x_u + k.w_u));
    const minY = Math.min(...keys.map((k) => k.y_u));
    const maxY = Math.max(...keys.map((k) => k.y_u + (k.h_u ?? 1)));
    return {
      x: ((minX + maxX) / 2) * UNIT_MM * S,
      z: ((minY + maxY) / 2) * UNIT_MM * S,
    };
  }, [keys.length]);

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[center.x + 6, 12, center.z + 4]} intensity={1} color="#f0f0ff" />
      <directionalLight position={[center.x - 4, 8, center.z - 3]} intensity={0.3} color="#e0e0ff" />
      <pointLight position={[center.x, 6, center.z]} intensity={0.15} color="#6366f1" />
      <ContactShadows
        position={[center.x, -0.18, center.z]}
        opacity={0.35}
        scale={25}
        blur={2.5}
        far={4}
        color="#000"
      />
    </>
  );
}

export function Scene() {
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: [0, 5, 8], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#050507" }}
        onPointerDown={() => setHintVisible(false)}
      >
        <color attach="background" args={["#050507"]} />
        <SceneLighting />
        <AutoTarget />
        <Environment preset="city" />
        <KeyboardPreview />
      </Canvas>
      {hintVisible && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] text-zinc-600 pointer-events-none transition-opacity duration-1000"
          style={{ opacity: hintVisible ? 0.7 : 0 }}>
          Drag to orbit &middot; Scroll to zoom
        </div>
      )}
    </div>
  );
}
