import { useEffect, useRef, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { KeyboardPreview } from "./KeyboardPreview";
import { getEditableElements } from "../../lib/projectCompat";
import { useProjectStore } from "../../stores/projectStore";
import type { PlacedElementSpec } from "../../types/project";

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

function elementBlueprintShape(element: PlacedElementSpec) {
  const common = {
    stroke: "rgba(180, 196, 255, 0.34)",
    strokeWidth: 1.4,
    fill: "rgba(110, 124, 255, 0.06)",
  };

  if (element.element_type === "encoder" || element.element_type === "speaker" || element.element_type === "joystick") {
    const cx = element.x_mm + element.w_mm / 2;
    const cy = element.y_mm + element.h_mm / 2;
    const radius = Math.min(element.w_mm, element.h_mm) * 0.42;
    return <circle key={element.id} cx={cx} cy={cy} r={radius} {...common} />;
  }

  return (
    <rect
      key={element.id}
      x={element.x_mm}
      y={element.y_mm}
      width={element.w_mm}
      height={element.h_mm}
      rx={Math.min(element.w_mm, element.h_mm) * 0.14}
      {...common}
    />
  );
}

function SceneBlueprint() {
  const layout = useProjectStore((s) => s.project?.layout ?? null);

  const blueprint = useMemo(() => {
    const elements = layout ? getEditableElements(layout) : [];
    if (elements.length === 0) return null;
    const minX = Math.min(...elements.map((element) => element.x_mm));
    const minY = Math.min(...elements.map((element) => element.y_mm));
    const maxX = Math.max(...elements.map((element) => element.x_mm + element.w_mm));
    const maxY = Math.max(...elements.map((element) => element.y_mm + element.h_mm));
    const padding = 18;
    return {
      minX: minX - padding,
      minY: minY - padding,
      viewBox: `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      elements,
    };
  }, [layout]);

  if (!blueprint) return null;

  return (
    <div className="pointer-events-none absolute inset-[10%] z-0 opacity-80">
      <svg
        viewBox={blueprint.viewBox}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="scene-blueprint-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8994ff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#4cb0ff" stopOpacity="0.16" />
          </linearGradient>
        </defs>
        <rect
          x={blueprint.minX}
          y={blueprint.minY}
          width={blueprint.width}
          height={blueprint.height}
          rx={14}
          fill="rgba(255,255,255,0.015)"
          stroke="url(#scene-blueprint-stroke)"
          strokeWidth="1.6"
        />
        {blueprint.elements.map((element) => elementBlueprintShape(element))}
      </svg>
    </div>
  );
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
      const height = Math.max(7.4, fitDistance * 0.72);
      const targetY = Math.max(0.45, Math.min(1.2, fitDistance * 0.08));

      controlsRef.current.object.position.set(
        bounds.centerX - distance * 0.05,
        height,
        bounds.centerZ + distance,
      );
      controlsRef.current.target.set(bounds.centerX, targetY, bounds.centerZ);
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

function SceneStage() {
  const bounds = useSceneBounds();
  const radius = Math.max(4.6, Math.max(bounds.width, bounds.depth) * 0.72);

  return (
    <>
      <mesh position={[bounds.centerX, -0.195, bounds.centerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[radius, 64]} />
        <meshStandardMaterial color="#0a0d13" metalness={0.24} roughness={0.86} />
      </mesh>
      <mesh position={[bounds.centerX, -0.187, bounds.centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.72, radius * 0.78, 64]} />
        <meshBasicMaterial color="#6e7cff" transparent opacity={0.2} />
      </mesh>
      <mesh position={[bounds.centerX, -0.184, bounds.centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.88, radius * 0.92, 64]} />
        <meshBasicMaterial color="#4ba7ff" transparent opacity={0.08} />
      </mesh>
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
      <SceneBlueprint />
      <Canvas
        camera={{ position: [0, 8.8, 14.4], fov: 48 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        onPointerDown={() => setHintVisible(false)}
      >
        <SceneLighting />
        <SceneStage />
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
