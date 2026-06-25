import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getEditableElements } from "../../lib/projectCompat";
import { useProjectStore } from "../../stores/projectStore";
import type { ElementType, PlacedElementSpec } from "../../types/project";

const S = 0.1; // mm to scene units
const KEYCAP_HEIGHT = 8 * S;
const KEYCAP_TOP_INSET = 1.5 * S;
const KEYCAP_GAP = 1 * S;

function createTaperedRectGeometry(widthMm: number, heightMm: number): THREE.BufferGeometry {
  const w = widthMm * S;
  const h = heightMm * S;
  const bw = Math.max(0.2, w - KEYCAP_GAP);
  const bh = Math.max(0.2, h - KEYCAP_GAP);
  const tw = Math.max(0.2, bw - KEYCAP_TOP_INSET * 2);
  const th = Math.max(0.2, bh - KEYCAP_TOP_INSET * 2);
  const kh = KEYCAP_HEIGHT;

  const vertices = new Float32Array([
    -bw / 2, 0, -bh / 2,
    bw / 2, 0, -bh / 2,
    bw / 2, 0, bh / 2,
    -bw / 2, 0, bh / 2,
    -tw / 2, kh, -th / 2,
    tw / 2, kh, -th / 2,
    tw / 2, kh, th / 2,
    -tw / 2, kh, th / 2,
  ]);

  const indices = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
    1, 2, 6, 1, 6, 5,
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function materialColor(type: ElementType): string {
  switch (type) {
    case "button":
      return "#2e8c62";
    case "encoder":
      return "#d0a63d";
    case "pad":
      return "#d85a58";
    case "display":
      return "#4db7ff";
    case "joystick":
      return "#a255d8";
    case "speaker":
      return "#d364a1";
    case "microphone":
      return "#14b8a6";
    case "sensor":
      return "#2dd4bf";
    case "battery":
      return "#b79a2f";
    case "usb_port":
      return "#4f94cf";
    default:
      return "#5b5d65";
  }
}

function materialProps(type: ElementType) {
  switch (type) {
    case "display":
      return { metalness: 0.12, roughness: 0.2, emissive: "#11344f", emissiveIntensity: 0.65 };
    case "encoder":
      return { metalness: 0.7, roughness: 0.28, emissive: "#3b2807", emissiveIntensity: 0.18 };
    case "pad":
      return { metalness: 0.1, roughness: 0.58, emissive: "#3f1111", emissiveIntensity: 0.18 };
    case "button":
      return { metalness: 0.14, roughness: 0.36, emissive: "#0d2419", emissiveIntensity: 0.16 };
    case "joystick":
      return { metalness: 0.18, roughness: 0.34, emissive: "#2a1038", emissiveIntensity: 0.16 };
    case "speaker":
      return { metalness: 0.22, roughness: 0.38, emissive: "#2f1222", emissiveIntensity: 0.12 };
    case "microphone":
      return { metalness: 0.34, roughness: 0.3, emissive: "#06332f", emissiveIntensity: 0.12 };
    case "sensor":
      return { metalness: 0.2, roughness: 0.34, emissive: "#073331", emissiveIntensity: 0.14 };
    case "battery":
      return { metalness: 0.3, roughness: 0.42, emissive: "#33270a", emissiveIntensity: 0.1 };
    case "usb_port":
      return { metalness: 0.42, roughness: 0.32, emissive: "#14314a", emissiveIntensity: 0.1 };
    default:
      return { metalness: 0.18, roughness: 0.48, emissive: "#111216", emissiveIntensity: 0.08 };
  }
}

function elementKey(type: ElementType, widthMm: number, heightMm: number) {
  const roundWidth = Math.round(widthMm * 100) / 100;
  const roundHeight = Math.round(heightMm * 100) / 100;
  return `${type}:${roundWidth}x${roundHeight}`;
}

function ElementInstances({
  elements,
  selectedElementIds,
}: {
  elements: PlacedElementSpec[];
  selectedElementIds: string[];
}) {
  const sizeGroups = useMemo(() => {
    const groups = new Map<string, PlacedElementSpec[]>();
    for (const element of elements) {
      const key = elementKey(element.element_type, element.w_mm, element.h_mm);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(element);
    }
    return groups;
  }, [elements]);

  return (
    <>
      {Array.from(sizeGroups.entries()).map(([sizeKey, groupElements]) => (
        <ElementSizeGroup key={sizeKey} elements={groupElements} selectedElementIds={selectedElementIds} />
      ))}
    </>
  );
}

function ElementSizeGroup({
  elements,
  selectedElementIds,
}: {
  elements: PlacedElementSpec[];
  selectedElementIds: string[];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const first = elements[0];
  const material = useMemo(() => materialProps(first.element_type), [first.element_type]);
  const geometry = useMemo(() => {
    if (first.element_type === "encoder") {
      return new THREE.CylinderGeometry((first.w_mm * 0.32) * S, (first.w_mm * 0.38) * S, 10 * S, 24);
    }
    if (first.element_type === "display") {
      return new THREE.BoxGeometry(first.w_mm * S, 3 * S, first.h_mm * S);
    }
    if (first.element_type === "pad") {
      return new THREE.BoxGeometry(first.w_mm * S, 5 * S, first.h_mm * S);
    }
    if (first.element_type === "speaker") {
      return new THREE.CylinderGeometry((Math.min(first.w_mm, first.h_mm) * 0.46) * S, (Math.min(first.w_mm, first.h_mm) * 0.46) * S, 5 * S, 32);
    }
    if (first.element_type === "microphone") {
      return new THREE.CylinderGeometry((Math.min(first.w_mm, first.h_mm) * 0.42) * S, (Math.min(first.w_mm, first.h_mm) * 0.42) * S, 3 * S, 20);
    }
    if (first.element_type === "sensor") {
      return new THREE.BoxGeometry(first.w_mm * S, 4 * S, first.h_mm * S);
    }
    if (first.element_type === "battery") {
      return new THREE.BoxGeometry(first.w_mm * S, 8 * S, first.h_mm * S);
    }
    if (first.element_type === "usb_port") {
      return new THREE.BoxGeometry(first.w_mm * S, 4 * S, first.h_mm * S);
    }
    return createTaperedRectGeometry(first.w_mm, first.h_mm);
  }, [first.element_type, first.h_mm, first.w_mm]);

  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const scale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const colors = new Float32Array(elements.length * 3);

    elements.forEach((element, i) => {
      const x = (element.x_mm + element.w_mm / 2) * S;
      const z = (element.y_mm + element.h_mm / 2) * S;
      quaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        (-element.rotation_deg * Math.PI) / 180,
      );
      position.set(x, 0, z);
      matrix.compose(position, quaternion, scale);
      if (element.element_type === "encoder") {
        position.set(x, 5 * S, z);
        matrix.compose(position, quaternion, scale);
      }
      if (element.element_type === "display") {
        position.set(x, 1.5 * S, z);
        matrix.compose(position, quaternion, scale);
      }
      if (element.element_type === "pad") {
        position.set(x, 2.5 * S, z);
        matrix.compose(position, quaternion, scale);
      }
      if (element.element_type === "speaker") {
        position.set(x, 2.5 * S, z);
        matrix.compose(position, quaternion, scale);
      }
      if (element.element_type === "microphone") {
        position.set(x, 1.5 * S, z);
        matrix.compose(position, quaternion, scale);
      }
      if (element.element_type === "sensor") {
        position.set(x, 2 * S, z);
        matrix.compose(position, quaternion, scale);
      }
      if (element.element_type === "battery") {
        position.set(x, 4 * S, z);
        matrix.compose(position, quaternion, scale);
      }
      if (element.element_type === "usb_port") {
        position.set(x, 2 * S, z);
        matrix.compose(position, quaternion, scale);
      }
      mesh.setMatrixAt(i, matrix);

      if (selectedElementIds.includes(element.id)) {
        color.setRGB(0.35, 0.38, 0.92);
      } else {
        color.set(materialColor(element.element_type));
      }
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  }, [color, elements, matrix, position, quaternion, scale, selectedElementIds]);

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, elements.length]} castShadow receiveShadow>
      <meshStandardMaterial
        vertexColors
        metalness={material.metalness}
        roughness={material.roughness}
        emissive={material.emissive}
        emissiveIntensity={material.emissiveIntensity}
      />
    </instancedMesh>
  );
}

function Plate({ elements }: { elements: PlacedElementSpec[] }) {
  const bounds = useMemo(() => {
    if (elements.length === 0) return { w: 10, h: 4, cx: 5, cz: 2 };
    const minX = Math.min(...elements.map((element) => element.x_mm));
    const minY = Math.min(...elements.map((element) => element.y_mm));
    const maxX = Math.max(...elements.map((element) => element.x_mm + element.w_mm));
    const maxY = Math.max(...elements.map((element) => element.y_mm + element.h_mm));
    const margin = 9.525; // 0.5u
    const w = (maxX - minX + margin * 2) * S;
    const h = (maxY - minY + margin * 2) * S;
    const cx = ((minX + maxX) / 2) * S;
    const cz = ((minY + maxY) / 2) * S;
    return { w, h, cx, cz };
  }, [elements]);

  const plateThickness = 1.5 * S;

  return (
    <mesh position={[bounds.cx, -plateThickness / 2, bounds.cz]} receiveShadow>
      <boxGeometry args={[bounds.w, plateThickness, bounds.h]} />
      <meshStandardMaterial color="#24262d" metalness={0.42} roughness={0.34} />
    </mesh>
  );
}

export function KeyboardPreview() {
  const project = useProjectStore((s) => s.project);
  const selectedElementIds = useProjectStore((s) => s.selectedElementIds);
  const elements = useMemo(() => (project ? getEditableElements(project.layout) : []), [project]);

  return (
    <>
      <ElementInstances elements={elements} selectedElementIds={selectedElementIds} />
      <Plate elements={elements} />
    </>
  );
}
