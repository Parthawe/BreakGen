import { useEffect, useRef, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { KeyboardPreview } from "./KeyboardPreview";
import { getEditableElements } from "../../lib/projectCompat";
import { useProjectStore } from "../../stores/projectStore";

const S = 0.1;

function useSceneBounds() {
  const layout = useProjectStore((s) => s.project?.layout ?? null);

  return useMemo(() => {
    const elements = layout ? getEditableElements(layout) : [];
    if (elements.length === 0) {
      return { centerX: 0, centerZ: 0, shadowScale: 25 };
    }
    const minX = Math.min(...elements.map((element) => element.x_mm));
    const minY = Math.min(...elements.map((element) => element.y_mm));
    const maxX = Math.max(...elements.map((element) => element.x_mm + element.w_mm));
    const maxY = Math.max(...elements.map((element) => element.y_mm + element.h_mm));
    const width = (maxX - minX) * S;
    const height = (maxY - minY) * S;
    return {
      centerX: ((minX + maxX) / 2) * S,
      centerZ: ((minY + maxY) / 2) * S,
      shadowScale: Math.max(18, Math.max(width, height) * 1.35),
    };
  }, [layout]);
}

function AutoTarget() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const bounds = useSceneBounds();

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(bounds.centerX, 0, bounds.centerZ);
      controlsRef.current.update();
    }
  }, [bounds.centerX, bounds.centerZ]);

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
  const bounds = useSceneBounds();

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[bounds.centerX + 6, 12, bounds.centerZ + 4]} intensity={1} color="#f0f0ff" />
      <directionalLight position={[bounds.centerX - 4, 8, bounds.centerZ - 3]} intensity={0.3} color="#e0e0ff" />
      <pointLight position={[bounds.centerX, 6, bounds.centerZ]} intensity={0.15} color="#6366f1" />
      <ContactShadows
        position={[bounds.centerX, -0.18, bounds.centerZ]}
        opacity={0.35}
        scale={bounds.shadowScale}
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
