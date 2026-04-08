import { useCallback, useRef, useState, type MouseEvent } from "react";
import { useProjectStore } from "../../stores/projectStore";
import type { KeySpec } from "../../types/project";
import { KeyProperties } from "./KeyProperties";

const UNIT_PX = 58; // pixels per keyboard unit
const PADDING = 20; // canvas padding
const KEY_GAP = 2; // gap between keys in px
const SNAP_INCREMENT = 0.25; // snap to 0.25u

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

  // Compute SVG viewBox
  const maxX = keys.reduce(
    (max, k) => Math.max(max, k.x_u + k.w_u),
    0
  );
  const maxY = keys.reduce(
    (max, k) => Math.max(max, k.y_u + k.h_u),
    0
  );
  const svgWidth = maxX * UNIT_PX + PADDING * 2;
  const svgHeight = maxY * UNIT_PX + PADDING * 2;

  const handleKeyMouseDown = useCallback(
    (e: MouseEvent, key: KeySpec) => {
      e.stopPropagation();
      selectKey(key.id, e.shiftKey);

      if (!svgRef.current) return;
      const pt = svgRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(
        svgRef.current.getScreenCTM()!.inverse()
      );

      setDragging({
        keyId: key.id,
        startX: svgPt.x,
        startY: svgPt.y,
        origX: key.x_u,
        origY: key.y_u,
      });
    },
    [selectKey]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !svgRef.current) return;

      const pt = svgRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(
        svgRef.current.getScreenCTM()!.inverse()
      );

      const dx = (svgPt.x - dragging.startX) / UNIT_PX;
      const dy = (svgPt.y - dragging.startY) / UNIT_PX;

      const newX = snapToGrid(dragging.origX + dx);
      const newY = snapToGrid(dragging.origY + dy);

      updateKey(dragging.keyId, {
        x_u: Math.max(0, newX),
        y_u: Math.max(0, newY),
      });
    },
    [dragging, updateKey]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    if (!dragging) clearSelection();
  }, [dragging, clearSelection]);

  const selectedKey = keys.find((k) => selectedKeyIds.includes(k.id));

  return (
    <div className="flex h-full">
      {/* SVG Canvas */}
      <div className="flex-1 overflow-auto bg-neutral-900/50 rounded-lg border border-neutral-800">
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
          {/* Grid lines */}
          <defs>
            <pattern
              id="grid"
              width={UNIT_PX}
              height={UNIT_PX}
              patternUnits="userSpaceOnUse"
              x={PADDING}
              y={PADDING}
            >
              <path
                d={`M ${UNIT_PX} 0 L 0 0 0 ${UNIT_PX}`}
                fill="none"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Keys */}
          {keys.map((key) => {
            const isSelected = selectedKeyIds.includes(key.id);
            const isDragging = dragging?.keyId === key.id;
            const x = PADDING + key.x_u * UNIT_PX + KEY_GAP / 2;
            const y = PADDING + key.y_u * UNIT_PX + KEY_GAP / 2;
            const w = key.w_u * UNIT_PX - KEY_GAP;
            const h = (key.h_u ?? 1) * UNIT_PX - KEY_GAP;

            return (
              <g
                key={key.id}
                transform={
                  key.rotation_deg
                    ? `rotate(${key.rotation_deg}, ${x + w / 2}, ${y + h / 2})`
                    : undefined
                }
                onMouseDown={(e) => handleKeyMouseDown(e, key)}
                className="cursor-pointer"
              >
                {/* Key body */}
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={4}
                  fill={
                    isSelected
                      ? "rgba(99, 102, 241, 0.3)"
                      : "rgba(255, 255, 255, 0.06)"
                  }
                  stroke={
                    isSelected
                      ? "rgb(99, 102, 241)"
                      : isDragging
                        ? "rgb(168, 85, 247)"
                        : "rgba(255, 255, 255, 0.12)"
                  }
                  strokeWidth={isSelected ? 2 : 1}
                />
                {/* Key label */}
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isSelected ? "rgb(165, 180, 252)" : "rgba(255, 255, 255, 0.5)"}
                  fontSize={key.w_u >= 1.5 ? 11 : 10}
                  fontFamily="Inter, system-ui, sans-serif"
                  pointerEvents="none"
                >
                  {key.label}
                </text>
                {/* Stabilizer indicator */}
                {key.stabilizer !== "none" && (
                  <line
                    x1={x + 4}
                    y1={y + h - 4}
                    x2={x + w - 4}
                    y2={y + h - 4}
                    stroke="rgba(251, 191, 36, 0.3)"
                    strokeWidth={2}
                    strokeLinecap="round"
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
          onDelete={() => {
            useProjectStore.getState().removeKey(selectedKey.id);
          }}
        />
      )}
    </div>
  );
}
