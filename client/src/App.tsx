import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";

function App() {
  return (
    <div className="flex h-screen w-screen bg-neutral-950">
      {/* Sidebar */}
      <aside className="w-72 border-r border-neutral-800 flex flex-col">
        <div className="p-4 border-b border-neutral-800">
          <h1 className="text-lg font-semibold text-white tracking-tight">
            BreakGen
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Keyboard Intent Compiler
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {["Template", "Switches", "Keycaps", "Layout", "PCB", "Export"].map(
            (step, i) => (
              <button
                key={step}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-neutral-400 hover:text-white hover:bg-neutral-800/50 transition-colors flex items-center gap-3"
              >
                <span className="w-5 h-5 rounded-full border border-neutral-700 flex items-center justify-center text-[10px] text-neutral-600">
                  {i + 1}
                </span>
                {step}
              </button>
            )
          )}
        </nav>

        <div className="p-4 border-t border-neutral-800">
          <p className="text-[10px] text-neutral-600">
            Phase 0 — Foundation
          </p>
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 relative">
        <Canvas
          camera={{ position: [0, 8, 12], fov: 50 }}
          gl={{ antialias: true }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 10, 5]} intensity={0.8} />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={5}
            maxDistance={30}
          />
          <Environment preset="studio" />

          {/* Placeholder ground plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>

          {/* Placeholder keyboard outline — will be replaced by real layout */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[10, 0.3, 4]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.3} roughness={0.8} />
          </mesh>
        </Canvas>

        {/* Status overlay */}
        <div className="absolute bottom-4 left-4 text-xs text-neutral-600">
          No project loaded
        </div>
      </main>
    </div>
  );
}

export default App;
