import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useProjectStore } from "../../stores/projectStore";
import type { KeySpec } from "../../types/project";

const UNIT_MM = 19.05;
const S = 0.1; // mm to scene units — all geometry uses this consistently

// Cherry-profile keycap dimensions in scene units
const KEYCAP_HEIGHT = 8 * S;
const KEYCAP_TOP_INSET = 1.5 * S;
const KEYCAP_GAP = 1 * S; // 1mm gap between keycaps

function createKeycapGeometry(widthU: number, heightU: number): THREE.BufferGeometry {
  const w = widthU * UNIT_MM * S;
  const h = heightU * UNIT_MM * S;
  const bw = w - KEYCAP_GAP;
  const bh = h - KEYCAP_GAP;
  const tw = bw - KEYCAP_TOP_INSET * 2;
  const th = bh - KEYCAP_TOP_INSET * 2;
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

function KeycapInstances({
  keys,
  selectedKeyIds,
}: {
  keys: KeySpec[];
  selectedKeyIds: string[];
}) {
  const sizeGroups = useMemo(() => {
    const groups = new Map<string, KeySpec[]>();
    for (const key of keys) {
      const sizeKey = `${key.w_u}x${key.h_u}`;
      if (!groups.has(sizeKey)) groups.set(sizeKey, []);
      groups.get(sizeKey)!.push(key);
    }
    return groups;
  }, [keys]);

  return (
    <>
      {Array.from(sizeGroups.entries()).map(([sizeKey, groupKeys]) => (
        <KeycapSizeGroup
          key={sizeKey}
          keys={groupKeys}
          selectedKeyIds={selectedKeyIds}
        />
      ))}
    </>
  );
}

function KeycapSizeGroup({
  keys,
  selectedKeyIds,
}: {
  keys: KeySpec[];
  selectedKeyIds: string[];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(
    () => createKeycapGeometry(keys[0].w_u, keys[0].h_u),
    [keys[0]?.w_u, keys[0]?.h_u]
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const colors = new Float32Array(keys.length * 3);

    keys.forEach((key, i) => {
      // Position: center of key in scene units (mm * S)
      const x = (key.x_u + key.w_u / 2) * UNIT_MM * S;
      const z = (key.y_u + (key.h_u ?? 1) / 2) * UNIT_MM * S;

      matrix.identity();
      if (key.rotation_deg) {
        const rad = (key.rotation_deg * Math.PI) / 180;
        matrix.makeRotationY(-rad);
      }
      matrix.setPosition(x, 0, z);
      mesh.setMatrixAt(i, matrix);

      const isSelected = selectedKeyIds.includes(key.id);
      color.setRGB(isSelected ? 0.4 : 0.22, isSelected ? 0.4 : 0.22, isSelected ? 0.95 : 0.24);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  }, [keys, selectedKeyIds]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, keys.length]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial vertexColors metalness={0.1} roughness={0.7} />
    </instancedMesh>
  );
}

function Plate({ keys }: { keys: KeySpec[] }) {
  const bounds = useMemo(() => {
    if (keys.length === 0) return { w: 10, h: 4, cx: 5, cz: 2 };
    // Use min AND max to handle negative coordinates
    const minX = Math.min(...keys.map((k) => k.x_u));
    const minY = Math.min(...keys.map((k) => k.y_u));
    const maxX = Math.max(...keys.map((k) => k.x_u + k.w_u));
    const maxY = Math.max(...keys.map((k) => k.y_u + (k.h_u ?? 1)));
    const margin = 0.5; // 0.5u margin
    const w = (maxX - minX + margin * 2) * UNIT_MM * S;
    const h = (maxY - minY + margin * 2) * UNIT_MM * S;
    const cx = ((minX + maxX) / 2) * UNIT_MM * S;
    const cz = ((minY + maxY) / 2) * UNIT_MM * S;
    return { w, h, cx, cz };
  }, [keys]);

  const plateThickness = 1.5 * S; // 1.5mm plate

  return (
    <mesh position={[bounds.cx, -plateThickness / 2, bounds.cz]} receiveShadow>
      <boxGeometry args={[bounds.w, plateThickness, bounds.h]} />
      <meshStandardMaterial color="#1a1a1c" metalness={0.4} roughness={0.6} />
    </mesh>
  );
}

export function KeyboardPreview() {
  const keys = useProjectStore((s) => s.project?.layout.keys ?? []);
  const selectedKeyIds = useProjectStore((s) => s.selectedKeyIds);

  // No wrapper group scaling — all geometry is already in scene units
  return (
    <>
      <KeycapInstances keys={keys} selectedKeyIds={selectedKeyIds} />
      <Plate keys={keys} />
    </>
  );
}
