import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useProjectStore } from "../../stores/projectStore";
import type { KeySpec } from "../../types/project";
import { KeyProperties } from "./KeyProperties";

const UNIT_PX = 62;
const PADDING = 28;
const KEY_GAP = 3;
const SNAP_INCREMENT = 0.25;
const KEY_RADIUS = 6;

function snapToGrid(value: number): number {
  return Math.round(value / SNAP_INCREMENT) * SNAP_INCREMENT;
}

export function LayoutEditor() {
  const project = useProjectStore((s) => s.project);
  const selectedKeyIds = useProjectStore((s) => s.selectedKeyIds);
  const selectKey = useProjectStore((s) => s.selectKey);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const updateKey = useProjectStore((s) => s.updateKey);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const pushUndo = useProjectStore((s) => s.pushUndo);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "Z" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const sel = useProjectStore.getState().selectedKeyIds;
        if (sel.length > 0 && document.activeElement === document.body) {
          e.preventDefault();
          sel.forEach((id) => useProjectStore.getState().removeKey(id));
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{
    keyId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const keys = project?.layout.keys ?? [];

  const minX = keys.reduce((min, k) => Math.min(min, k.x_u), 0);
  const minY = keys.reduce((min, k) => Math.min(min, k.y_u), 0);
  const maxX = keys.reduce((max, k) => Math.max(max, k.x_u + k.w_u), 0);
  const maxY = keys.reduce((max, k) => Math.max(max, k.y_u + k.h_u), 0);
  const svgWidth = (maxX - minX) * UNIT_PX + PADDING * 2;
  const svgHeight = (maxY - minY) * UNIT_PX + PADDING * 2;
  const ox = -minX * UNIT_PX;
  const oy = -minY * UNIT_PX;

  const handleKeyMouseDown = useCallback(
    (e: MouseEvent, key: KeySpec) => {
      e.stopPropagation();
      selectKey(key.id, e.shiftKey);
      pushUndo(); // Snapshot before drag
      if (!svgRef.current) return;
      const pt = svgRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
      setDragging({ keyId: key.id, startX: svgPt.x, startY: svgPt.y, origX: key.x_u, origY: key.y_u });
    },
    [selectKey]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !svgRef.current) return;
      const pt = svgRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
      const newX = snapToGrid(dragging.origX + (svgPt.x - dragging.startX) / UNIT_PX);
      const newY = snapToGrid(dragging.origY + (svgPt.y - dragging.startY) / UNIT_PX);
      updateKey(dragging.keyId, { x_u: Math.max(0, newX), y_u: Math.max(0, newY) });
    },
    [dragging, updateKey]
  );

  const handleMouseUp = useCallback(() => setDragging(null), []);
  const handleBackgroundClick = useCallback(() => { if (!dragging) clearSelection(); }, [dragging, clearSelection]);

  const selectedKey = keys.find((k) => selectedKeyIds.includes(k.id));
  const addKeyStore = useProjectStore((s) => s.addKey);

  const handleAddKey = () => {
    const maxY = keys.length > 0 ? Math.max(...keys.map((k) => k.y_u + k.h_u)) : 0;
    const id = `k_new_${Date.now().toString(36)}`;
    addKeyStore({
      id,
      label: "?",
      x_u: 0,
      y_u: maxY + 0.25,
      w_u: 1,
      h_u: 1,
      rotation_deg: 0,
      rotation_origin_x_u: 0,
      rotation_origin_y_u: 0,
      stabilizer: "none",
      keycap_asset_id: null,
      row: null,
      col: null,
    });
    useProjectStore.getState().selectKey(id);
  };

  const undoStack = useProjectStore((s) => s.undoStack);
  const redoStack = useProjectStore((s) => s.redoStack);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={handleAddKey}
          className="h-8 px-3.5 text-[12px] font-medium rounded-xl bg-white/[0.04] border border-white/[0.06] text-zinc-300 hover:bg-white/[0.07] hover:text-white transition-all flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          Add Key
        </button>
        <button onClick={undo} disabled={undoStack.length === 0} title="Undo (Cmd+Z)"
          className="h-8 w-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-white disabled:opacity-30 transition-all">
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M3 5l-2 2 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M1 7h7a3 3 0 000-6H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
        <button onClick={redo} disabled={redoStack.length === 0} title="Redo (Cmd+Shift+Z)"
          className="h-8 w-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-white disabled:opacity-30 transition-all">
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M9 5l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M11 7H4a3 3 0 010-6h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
        <div className="flex-1" />
        <span className="text-[12px] font-mono text-zinc-600">{keys.length} keys</span>
        <span className="text-[11px] text-zinc-700">Del to remove</span>
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
      {/* SVG Canvas */}
      <div className="flex-1 overflow-auto rounded-2xl bg-[#060609] border border-white/[0.04]">
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          className="select-none"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleBackgroundClick}
        >
          <defs>
            <pattern id="grid" width={UNIT_PX} height={UNIT_PX} patternUnits="userSpaceOnUse" x={PADDING + ox} y={PADDING + oy}>
              <circle cx={UNIT_PX} cy={UNIT_PX} r="0.5" fill="rgba(255,255,255,0.06)" />
            </pattern>
            <filter id="keyShadow">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.25" />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {keys.map((key) => {
            const isSelected = selectedKeyIds.includes(key.id);
            const isDragged = dragging?.keyId === key.id;
            const x = PADDING + ox + key.x_u * UNIT_PX + KEY_GAP / 2;
            const y = PADDING + oy + key.y_u * UNIT_PX + KEY_GAP / 2;
            const w = key.w_u * UNIT_PX - KEY_GAP;
            const h = (key.h_u ?? 1) * UNIT_PX - KEY_GAP;

            return (
              <g
                key={key.id}
                transform={key.rotation_deg ? `rotate(${key.rotation_deg}, ${x + w / 2}, ${y + h / 2})` : undefined}
                onMouseDown={(e) => handleKeyMouseDown(e, key)}
                className="cursor-pointer"
                filter={isDragged ? "url(#keyShadow)" : undefined}
              >
                {/* Key body */}
                <rect
                  x={x} y={y} width={w} height={h} rx={KEY_RADIUS}
                  fill={isSelected ? "rgba(129, 140, 248, 0.15)" : "rgba(255, 255, 255, 0.035)"}
                  stroke={isSelected ? "rgba(129, 140, 248, 0.5)" : isDragged ? "rgba(168, 85, 247, 0.4)" : "rgba(255, 255, 255, 0.06)"}
                  strokeWidth={isSelected ? 1.5 : 1}
                />
                {/* Label */}
                <text
                  x={x + w / 2} y={y + h / 2}
                  textAnchor="middle" dominantBaseline="central"
                  fill={isSelected ? "rgba(165, 180, 252, 0.95)" : "rgba(255, 255, 255, 0.45)"}
                  fontSize={key.w_u >= 2.25 ? 12 : key.w_u >= 1.5 ? 11.5 : 11}
                  fontFamily="'Geist', system-ui, sans-serif"
                  fontWeight={500}
                  letterSpacing="-0.01em"
                  pointerEvents="none"
                >
                  {key.label}
                </text>
                {/* Stab indicator */}
                {key.stabilizer !== "none" && (
                  <rect
                    x={x + 6} y={y + h - 5} width={w - 12} height={1.5} rx={0.75}
                    fill="rgba(251, 191, 36, 0.25)"
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Property Panel */}
      {selectedKey && (
        <KeyProperties
          keySpec={selectedKey}
          onUpdate={(updates) => updateKey(selectedKey.id, updates)}
          onDelete={() => useProjectStore.getState().removeKey(selectedKey.id)}
        />
      )}
      </div>
    </div>
  );
}
