import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useProjectStore } from "../../stores/projectStore";
import type { KeySpec } from "../../types/project";

const UNIT_MM = 19.05;
const SCALE = 0.1; // mm to scene units (1u = 1.905 scene units)

// Cherry-profile keycap dimensions (approximate, in mm)
const KEYCAP_HEIGHT = 8;
const KEYCAP_TOP_INSET = 1.5; // top face is smaller than bottom

function createKeycapGeometry(widthU: number, heightU: number): THREE.BufferGeometry {
  const w = widthU * UNIT_MM;
  const h = heightU * UNIT_MM;
  const gap = 1; // 1mm gap between keycaps
  const bw = w - gap; // bottom width
  const bh = h - gap;
  const tw = bw - KEYCAP_TOP_INSET * 2; // top width (inset on each side)
  const th = bh - KEYCAP_TOP_INSET * 2;
  const kh = KEYCAP_HEIGHT;

  // 8 vertices: bottom rect + top rect (tapered)
  const vertices = new Float32Array([
    // Bottom face (y=0)
    -bw / 2, 0, -bh / 2,
    bw / 2, 0, -bh / 2,
    bw / 2, 0, bh / 2,
    -bw / 2, 0, bh / 2,
    // Top face (y=kh, inset)
    -tw / 2, kh, -th / 2,
    tw / 2, kh, -th / 2,
    tw / 2, kh, th / 2,
    -tw / 2, kh, th / 2,
  ]);

  const indices = [
    // Bottom
    0, 2, 1, 0, 3, 2,
    // Top
    4, 5, 6, 4, 6, 7,
    // Front
    0, 1, 5, 0, 5, 4,
    // Back
    2, 3, 7, 2, 7, 6,
    // Left
    3, 0, 4, 3, 4, 7,
    // Right
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
  // Group keys by size for instancing
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
  const colorRef = useRef<THREE.InstancedBufferAttribute | null>(null);

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
      // Position: center of key in scene coordinates
      const x = (key.x_u + key.w_u / 2) * UNIT_MM * SCALE;
      const z = (key.y_u + (key.h_u ?? 1) / 2) * UNIT_MM * SCALE;
      const y = 0;

      matrix.identity();

      if (key.rotation_deg) {
        const rad = (key.rotation_deg * Math.PI) / 180;
        matrix.makeRotationY(-rad);
      }

      matrix.setPosition(x, y, z);
      mesh.setMatrixAt(i, matrix);

      // Color: highlight selected keys
      const isSelected = selectedKeyIds.includes(key.id);
      if (isSelected) {
        color.setRGB(0.4, 0.4, 0.95);
      } else {
        color.setRGB(0.22, 0.22, 0.24);
      }
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    });

    mesh.instanceMatrix.needsUpdate = true;

    // Set instance colors
    const attr = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.instanceColor = attr;
    colorRef.current = attr;
  }, [keys, selectedKeyIds]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, keys.length]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        vertexColors
        metalness={0.1}
        roughness={0.7}
      />
    </instancedMesh>
  );
}

// Plate underneath the keycaps
function Plate({ keys }: { keys: KeySpec[] }) {
  const bounds = useMemo(() => {
    if (keys.length === 0) return { w: 10, h: 4 };
    const maxX = Math.max(...keys.map((k) => k.x_u + k.w_u));
    const maxY = Math.max(...keys.map((k) => k.y_u + (k.h_u ?? 1)));
    const margin = 0.5; // 0.5u margin
    return {
      w: (maxX + margin * 2) * UNIT_MM * SCALE,
      h: (maxY + margin * 2) * UNIT_MM * SCALE,
      offsetX: (maxX / 2 + margin) * UNIT_MM * SCALE - margin * UNIT_MM * SCALE,
      offsetZ: (maxY / 2 + margin) * UNIT_MM * SCALE - margin * UNIT_MM * SCALE,
    };
  }, [keys]);

  return (
    <mesh
      position={[
        bounds.offsetX ?? bounds.w / 2,
        -0.3,
        bounds.offsetZ ?? bounds.h / 2,
      ]}
      receiveShadow
    >
      <boxGeometry args={[bounds.w, 0.3, bounds.h]} />
      <meshStandardMaterial color="#1a1a1c" metalness={0.4} roughness={0.6} />
    </mesh>
  );
}

export function KeyboardPreview() {
  const keys = useProjectStore((s) => s.project?.layout.keys ?? []);
  const selectedKeyIds = useProjectStore((s) => s.selectedKeyIds);

  // Scale all geometry
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <KeycapInstances keys={keys} selectedKeyIds={selectedKeyIds} />
    </group>
  );
}

export function KeyboardPlate() {
  const keys = useProjectStore((s) => s.project?.layout.keys ?? []);
  return <Plate keys={keys} />;
}
