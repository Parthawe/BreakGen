import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { getEditableElements } from "../../lib/projectCompat";
import { useProjectStore } from "../../stores/projectStore";
import type { PlacedElementSpec } from "../../types/project";
import { KeyProperties } from "./KeyProperties";

const DESKTOP_UNIT_PX = 62;
const MOBILE_UNIT_PX = 44;
const PADDING = 28;
const KEY_GAP = 3;
const SNAP_INCREMENT = 0.25;
const KEY_RADIUS = 6;
const DEFAULT_UNIT_MM = 19.05;

const ELEMENT_TONES: Record<string, { fill: string; stroke: string; accent: string }> = {
  key_switch: { fill: "rgba(255,255,255,0.035)", stroke: "rgba(255,255,255,0.06)", accent: "rgba(255,255,255,0.45)" },
  button: { fill: "rgba(74, 222, 128, 0.08)", stroke: "rgba(74, 222, 128, 0.22)", accent: "rgba(134, 239, 172, 0.95)" },
  encoder: { fill: "rgba(251, 191, 36, 0.08)", stroke: "rgba(251, 191, 36, 0.24)", accent: "rgba(253, 224, 71, 0.95)" },
  pad: { fill: "rgba(248, 113, 113, 0.09)", stroke: "rgba(248, 113, 113, 0.25)", accent: "rgba(252, 165, 165, 0.95)" },
  display: { fill: "rgba(56, 189, 248, 0.08)", stroke: "rgba(56, 189, 248, 0.24)", accent: "rgba(125, 211, 252, 0.95)" },
  joystick: { fill: "rgba(236, 72, 153, 0.08)", stroke: "rgba(236, 72, 153, 0.24)", accent: "rgba(249, 168, 212, 0.95)" },
  speaker: { fill: "rgba(244, 114, 182, 0.08)", stroke: "rgba(244, 114, 182, 0.24)", accent: "rgba(251, 207, 232, 0.95)" },
  microphone: { fill: "rgba(20, 184, 166, 0.08)", stroke: "rgba(20, 184, 166, 0.24)", accent: "rgba(94, 234, 212, 0.95)" },
  sensor: { fill: "rgba(45, 212, 191, 0.08)", stroke: "rgba(45, 212, 191, 0.24)", accent: "rgba(153, 246, 228, 0.95)" },
  battery: { fill: "rgba(250, 204, 21, 0.08)", stroke: "rgba(250, 204, 21, 0.24)", accent: "rgba(254, 240, 138, 0.95)" },
  usb_port: { fill: "rgba(96, 165, 250, 0.08)", stroke: "rgba(96, 165, 250, 0.24)", accent: "rgba(191, 219, 254, 0.95)" },
};

function snapToGrid(value: number): number {
  return Math.round(value / SNAP_INCREMENT) * SNAP_INCREMENT;
}

function elementU(element: PlacedElementSpec, unitPitchMm: number) {
  return {
    x_u: element.x_mm / unitPitchMm,
    y_u: element.y_mm / unitPitchMm,
    w_u: element.w_mm / unitPitchMm,
    h_u: element.h_mm / unitPitchMm,
  };
}

export function LayoutEditor() {
  const [compactViewport, setCompactViewport] = useState(false);
  const project = useProjectStore((s) => s.project);
  const selectedElementIds = useProjectStore((s) => s.selectedElementIds);
  const selectElement = useProjectStore((s) => s.selectElement);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const updateElement = useProjectStore((s) => s.updateElement);
  const removeElement = useProjectStore((s) => s.removeElement);
  const addElement = useProjectStore((s) => s.addElement);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const pushUndo = useProjectStore((s) => s.pushUndo);
  const undoStack = useProjectStore((s) => s.undoStack);
  const redoStack = useProjectStore((s) => s.redoStack);
  const unitPx = compactViewport ? MOBILE_UNIT_PX : DESKTOP_UNIT_PX;

  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setCompactViewport(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const unitPitchMm = project?.layout.unit_pitch_mm ?? DEFAULT_UNIT_MM;
  const elements = useMemo(
    () => (project ? getEditableElements(project.layout) : []),
    [project],
  );

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
        const sel = useProjectStore.getState().selectedElementIds;
        if (sel.length > 0 && document.activeElement === document.body) {
          e.preventDefault();
          sel.forEach((id) => useProjectStore.getState().removeElement(id));
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{
    elementId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const minX = elements.reduce((min, element) => Math.min(min, elementU(element, unitPitchMm).x_u), 0);
  const minY = elements.reduce((min, element) => Math.min(min, elementU(element, unitPitchMm).y_u), 0);
  const maxX = elements.reduce((max, element) => {
    const u = elementU(element, unitPitchMm);
    return Math.max(max, u.x_u + u.w_u);
  }, 0);
  const maxY = elements.reduce((max, element) => {
    const u = elementU(element, unitPitchMm);
    return Math.max(max, u.y_u + u.h_u);
  }, 0);
  const svgWidth = (maxX - minX) * unitPx + PADDING * 2;
  const svgHeight = (maxY - minY) * unitPx + PADDING * 2;
  const ox = -minX * unitPx;
  const oy = -minY * unitPx;

  const handleElementMouseDown = useCallback(
    (e: MouseEvent, element: PlacedElementSpec) => {
      e.stopPropagation();
      selectElement(element.id, e.shiftKey);
      pushUndo();
      if (!svgRef.current) return;
      const pt = svgRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
      const u = elementU(element, unitPitchMm);
      setDragging({
        elementId: element.id,
        startX: svgPt.x,
        startY: svgPt.y,
        origX: u.x_u,
        origY: u.y_u,
      });
    },
    [pushUndo, selectElement, unitPitchMm],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !svgRef.current) return;
      const pt = svgRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
      const newX = snapToGrid(dragging.origX + (svgPt.x - dragging.startX) / unitPx);
      const newY = snapToGrid(dragging.origY + (svgPt.y - dragging.startY) / unitPx);
      updateElement(dragging.elementId, {
        x_mm: Math.max(0, newX) * unitPitchMm,
        y_mm: Math.max(0, newY) * unitPitchMm,
      });
    },
    [dragging, unitPitchMm, unitPx, updateElement],
  );

  const handleMouseUp = useCallback(() => setDragging(null), []);
  const handleBackgroundClick = useCallback(() => { if (!dragging) clearSelection(); }, [dragging, clearSelection]);

  const selectedElement = elements.find((element) => selectedElementIds.includes(element.id));

  const handleAddElement = () => {
      const maxElementY = elements.length > 0
      ? Math.max(...elements.map((element) => element.y_mm + element.h_mm))
      : 0;
    const id = `el_${Date.now().toString(36)}`;
    const buttonFamilies = new Set(["gamepad", "pedal_controller", "breath_controller", "handheld_companion", "retro_handheld"]);
    const buttonLike = buttonFamilies.has(project?.product_family ?? "");
    addElement({
      id,
      element_type: buttonLike ? "button" : "key_switch",
      label: buttonLike ? "Btn" : "?",
      footprint_id: buttonLike ? "tact_button" : "mx_switch",
      x_mm: 0,
      y_mm: maxElementY + unitPitchMm * 0.25,
      w_mm: unitPitchMm,
      h_mm: unitPitchMm,
      rotation_deg: 0,
      mounting: {},
      appearance_ref: null,
      electrical_ref: null,
      metadata: {},
      stabilizer: "none",
      keycap_asset_id: null,
      row: null,
      col: null,
    });
  };

  return (
    <div className="layout-editor flex h-full flex-col">
      <div className="layout-editor-toolbar mb-4 flex items-center gap-3">
        <button
          onClick={handleAddElement}
          className="glass-chip flex h-8 items-center gap-2 rounded-xl px-3.5 text-[12px] font-semibold text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          Add Element
        </button>
        <button
          onClick={undo}
          disabled={undoStack.length === 0}
          title="Undo (Cmd+Z)"
          className="glass-chip flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-tertiary)] transition-all hover:text-[var(--text-primary)] disabled:opacity-30"
        >
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M3 5l-2 2 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M1 7h7a3 3 0 000-6H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
        <button
          onClick={redo}
          disabled={redoStack.length === 0}
          title="Redo (Cmd+Shift+Z)"
          className="glass-chip flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-tertiary)] transition-all hover:text-[var(--text-primary)] disabled:opacity-30"
        >
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M9 5l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M11 7H4a3 3 0 010-6h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
        <div className="flex-1" />
        <span className="layout-editor-stat text-[12px] font-mono text-[var(--text-tertiary)]">{elements.length} elements</span>
        <span className="layout-editor-shortcut text-[11px] text-[var(--text-muted)]">Del to remove</span>
      </div>

      <div className="layout-editor-workarea flex min-h-0 flex-1 gap-4">
        <div className="layout-editor-canvas glass glass-strong flex-1 overflow-auto rounded-2xl">
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
              <pattern id="grid" width={unitPx} height={unitPx} patternUnits="userSpaceOnUse" x={PADDING + ox} y={PADDING + oy}>
                <circle cx={unitPx} cy={unitPx} r="0.5" fill="rgba(255,255,255,0.06)" />
              </pattern>
              <filter id="keyShadow">
                <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.25" />
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {elements.map((element) => {
              const isSelected = selectedElementIds.includes(element.id);
              const isDragged = dragging?.elementId === element.id;
              const tone = ELEMENT_TONES[element.element_type] ?? ELEMENT_TONES.key_switch;
              const u = elementU(element, unitPitchMm);
              const x = PADDING + ox + u.x_u * unitPx + KEY_GAP / 2;
              const y = PADDING + oy + u.y_u * unitPx + KEY_GAP / 2;
              const w = u.w_u * unitPx - KEY_GAP;
              const h = u.h_u * unitPx - KEY_GAP;

              return (
                <g
                  key={element.id}
                  transform={element.rotation_deg ? `rotate(${element.rotation_deg}, ${x + w / 2}, ${y + h / 2})` : undefined}
                  onMouseDown={(e) => handleElementMouseDown(e, element)}
                  className="cursor-pointer"
                  filter={isDragged ? "url(#keyShadow)" : undefined}
                >
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={element.element_type === "button" ? Math.min(w, h) / 2.5 : KEY_RADIUS}
                    fill={isSelected ? "rgba(129, 140, 248, 0.15)" : tone.fill}
                    stroke={isSelected ? "rgba(129, 140, 248, 0.5)" : isDragged ? "rgba(168, 85, 247, 0.4)" : tone.stroke}
                    strokeWidth={isSelected ? 1.5 : 1}
                  />
                  {element.element_type === "encoder" && (
                    <>
                      <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) * 0.28} fill="rgba(251,191,36,0.22)" stroke="rgba(251,191,36,0.4)" />
                      <path d={`M ${x + w / 2} ${y + h / 2} L ${x + w / 2} ${y + h * 0.28}`} stroke="rgba(253,224,71,0.95)" strokeWidth="1.5" strokeLinecap="round" />
                    </>
                  )}
                  {element.element_type === "display" && (
                    <rect
                      x={x + 6}
                      y={y + 6}
                      width={Math.max(0, w - 12)}
                      height={Math.max(0, h - 12)}
                      rx={4}
                      fill="rgba(14, 165, 233, 0.18)"
                      stroke="rgba(125, 211, 252, 0.35)"
                    />
                  )}
                  {element.element_type === "speaker" && (
                    <>
                      <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) * 0.22} fill="rgba(244,114,182,0.14)" stroke="rgba(244,114,182,0.24)" />
                      {[0, 60, 120, 180, 240, 300].map((angle) => {
                        const rad = (angle * Math.PI) / 180;
                        const r = Math.min(w, h) * 0.28;
                        return (
                          <circle
                            key={angle}
                            cx={x + w / 2 + Math.cos(rad) * r}
                            cy={y + h / 2 + Math.sin(rad) * r}
                            r={1.6}
                            fill="rgba(251, 207, 232, 0.55)"
                          />
                        );
                      })}
                    </>
                  )}
                  {element.element_type === "usb_port" && (
                    <rect
                      x={x + 6}
                      y={y + h / 2 - 4}
                      width={Math.max(0, w - 12)}
                      height={8}
                      rx={3}
                      fill="rgba(96, 165, 250, 0.16)"
                      stroke="rgba(191, 219, 254, 0.35)"
                    />
                  )}
                  <text
                    x={x + w / 2}
                    y={y + h / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isSelected ? "rgba(165, 180, 252, 0.95)" : tone.accent}
                    fontSize={u.w_u >= 2.25 ? 12 : u.w_u >= 1.5 ? 11.5 : 11}
                    fontFamily="'Geist', system-ui, sans-serif"
                    fontWeight={500}
                    letterSpacing="-0.01em"
                    pointerEvents="none"
                  >
                    {element.label}
                  </text>
                  <text
                    className="layout-element-type-label"
                    x={x + 8}
                    y={y + 14}
                    fill="rgba(255,255,255,0.28)"
                    fontSize={9}
                    fontFamily="'Geist Mono', monospace"
                    pointerEvents="none"
                  >
                    {element.element_type}
                  </text>
                  {element.stabilizer !== "none" && (
                    <rect
                      x={x + 6}
                      y={y + h - 5}
                      width={w - 12}
                      height={1.5}
                      rx={0.75}
                      fill="rgba(251, 191, 36, 0.25)"
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {selectedElement && (
          <KeyProperties
            element={selectedElement}
            unitPitchMm={unitPitchMm}
            onUpdate={(updates) => updateElement(selectedElement.id, updates)}
            onDelete={() => removeElement(selectedElement.id)}
          />
        )}
      </div>
    </div>
  );
}
