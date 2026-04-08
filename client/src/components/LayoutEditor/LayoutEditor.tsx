import { useCallback, useRef, useState, type MouseEvent } from "react";
import { useProjectStore } from "../../stores/projectStore";
import type { KeySpec } from "../../types/project";
import { KeyProperties } from "./KeyProperties";

const UNIT_PX = 56;
const PADDING = 24;
const KEY_GAP = 2;
const SNAP_INCREMENT = 0.25;
const KEY_RADIUS = 5;

function snapToGrid(value: number): number {
  return Math.round(value / SNAP_INCREMENT) * SNAP_INCREMENT;
}

export function LayoutEditor() {
  const project = useProjectStore((s) => s.project);
  const selectedKeyIds = useProjectStore((s) => s.selectedKeyIds);
  const selectKey = useProjectStore((s) => s.selectKey);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const updateKey = useProjectStore((s) => s.updateKey);

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

  return (
    <div className="flex h-full gap-0">
      {/* SVG Canvas */}
      <div
        className="flex-1 overflow-auto rounded-xl"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
      >
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
                {/* Outer key body */}
                <rect
                  x={x} y={y} width={w} height={h} rx={KEY_RADIUS}
                  fill={isSelected ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.04)"}
                  stroke={isSelected ? "rgba(99, 102, 241, 0.7)" : isDragged ? "rgba(168, 85, 247, 0.5)" : "rgba(255, 255, 255, 0.08)"}
                  strokeWidth={isSelected ? 1.5 : 1}
                />
                {/* Inner top face (Cherry profile taper effect) */}
                <rect
                  x={x + 3} y={y + 2} width={w - 6} height={h - 7} rx={KEY_RADIUS - 1}
                  fill={isSelected ? "rgba(99, 102, 241, 0.15)" : "rgba(255, 255, 255, 0.025)"}
                  stroke={isSelected ? "rgba(99, 102, 241, 0.3)" : "rgba(255, 255, 255, 0.04)"}
                  strokeWidth={0.5}
                />
                {/* Label */}
                <text
                  x={x + w / 2} y={y + h / 2 - 1}
                  textAnchor="middle" dominantBaseline="central"
                  fill={isSelected ? "rgba(165, 180, 252, 0.9)" : "rgba(255, 255, 255, 0.4)"}
                  fontSize={key.w_u >= 2 ? 10 : key.w_u >= 1.5 ? 9.5 : 9}
                  fontFamily="'Geist', system-ui, sans-serif"
                  fontWeight={500}
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
  );
}
