import { useEffect, useRef, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
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
      return { centerX: 0, centerZ: 0, width: 12, depth: 10, shadowScale: 25 };
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
      width,
      depth: height,
      shadowScale: Math.max(18, Math.max(width, height) * 1.35),
    };
  }, [layout]);
}

function AutoTarget() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const bounds = useSceneBounds();

  useEffect(() => {
    if (controlsRef.current) {
      const perspectiveCamera = camera as {
        fov?: number;
        aspect?: number;
        position: { set: (x: number, y: number, z: number) => void };
      };
      const verticalFov = ((perspectiveCamera.fov ?? 48) * Math.PI) / 180;
      const aspect = perspectiveCamera.aspect ?? 1.6;
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
      const fitDistance = Math.max(
        bounds.width / (2 * Math.tan(horizontalFov / 2)),
        bounds.depth / (2 * Math.tan(verticalFov / 2)),
      );
      const distance = Math.max(12, fitDistance * 1.22);
      const height = Math.max(8.2, fitDistance * 0.86);

      controlsRef.current.object.position.set(
        bounds.centerX - distance * 0.08,
        height,
        bounds.centerZ + distance,
      );
      controlsRef.current.target.set(bounds.centerX, 0, bounds.centerZ);
      controlsRef.current.update();
    }
  }, [bounds.centerX, bounds.centerZ, bounds.depth, bounds.width, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      minDistance={6}
      maxDistance={30}
      minPolarAngle={0.55}
      maxPolarAngle={Math.PI / 2.2}
    />
  );
}

function SceneLighting() {
  const bounds = useSceneBounds();

  return (
    <>
      <ambientLight intensity={0.38} />
      <hemisphereLight intensity={0.34} color="#f2f4ff" groundColor="#0a0a0e" />
      <directionalLight position={[bounds.centerX + 5, 10, bounds.centerZ + 5]} intensity={1.2} color="#f4f3ff" />
      <directionalLight position={[bounds.centerX - 6, 7, bounds.centerZ - 4]} intensity={0.55} color="#d9ecff" />
      <pointLight position={[bounds.centerX + 1, 4.5, bounds.centerZ - 2]} intensity={0.22} color="#8fd6ff" />
      <pointLight position={[bounds.centerX - 2, 3.2, bounds.centerZ + 2]} intensity={0.18} color="#8b7cff" />
      <ContactShadows
        position={[bounds.centerX, -0.18, bounds.centerZ]}
        opacity={0.42}
        scale={bounds.shadowScale}
        blur={2.2}
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
        camera={{ position: [0, 8.8, 14.4], fov: 48 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#050609" }}
        onPointerDown={() => setHintVisible(false)}
      >
        <color attach="background" args={["#050609"]} />
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
