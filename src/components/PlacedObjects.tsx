import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGLTF, useTexture } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { PlacementDoc, StoreObjectDoc, Surface } from '../types';

interface Props {
  placements: PlacementDoc[];
  objects: StoreObjectDoc[];
  surface: Surface;
  /** 配置済みオブジェクトのダブルクリック時のコールバック（編集画面でのみ使用） */
  onSelect?: (objectId: string) => void;
}

export default function PlacedObjects({ placements, objects, surface, onSelect }: Props) {
  const objectMap = new Map(objects.map((o) => [o.id, o]));
  // 奥の壁は-Z方向（部屋の内側）が表側。物の正面(+z)を来店者側へ向けるため180度回す
  const rotationY = surface === 'wall' ? Math.PI : 0;

  return (
    <group name={`placed-objects-${surface}`}>
      {placements
        .filter((p) => p.surface === surface)
        .map((placement) => {
          const obj = objectMap.get(placement.objectId);
          if (!obj) return null;
          return (
            <PlacedObjectMesh
              key={placement.id}
              obj={obj}
              position={[placement.position.x, placement.position.y, placement.position.z]}
              rotationY={rotationY}
              onSelect={onSelect}
            />
          );
        })}
    </group>
  );
}

interface MeshProps {
  obj: StoreObjectDoc;
  position: [number, number, number];
  rotationY: number;
  onSelect?: (objectId: string) => void;
}

interface InnerMeshProps {
  obj: StoreObjectDoc;
  position: [number, number, number];
  rotationY: number;
  onDoubleClick: (e: ThreeEvent<MouseEvent>) => void;
}

function PlacedObjectMesh({ obj, position, rotationY, onSelect }: MeshProps) {
  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect?.(obj.id);
  };

  if (obj.kind === 'gltf' && obj.gltfUrl) {
    return (
      <GltfObject obj={obj} position={position} rotationY={rotationY} onDoubleClick={handleDoubleClick} />
    );
  }

  if (obj.kind === 'book' && obj.bookTextures) {
    return <BookObject obj={obj} position={position} rotationY={rotationY} onDoubleClick={handleDoubleClick} />;
  }

  // フォールバック: モデル/テクスチャ未設定の場合は単色の箱で表示する
  const { w, h, d } = obj.sizeCm;
  return (
    <mesh
      position={position}
      rotation={[0, rotationY, 0]}
      userData={{ objectId: obj.id }}
      castShadow
      onDoubleClick={handleDoubleClick}
    >
      <boxGeometry args={[w / 100, h / 100, d / 100]} />
      <meshStandardMaterial color={obj.color} />
    </mesh>
  );
}

/**
 * GLTFモデルを読み込み、バウンディングボックスの中心をposition(=オブジェクトの中心)に、
 * 高さがsizeCm.hになるよう自動スケーリングして表示する。
 * モデルの形状によっては台座に少し埋まる/浮くことがある簡易実装。
 */
function GltfObject({ obj, position, rotationY, onDoubleClick }: InnerMeshProps) {
  const gltf = useGLTF(obj.gltfUrl!);
  const groupRef = useRef<THREE.Group>(null);
  const [transform, setTransform] = useState<{ scale: number; offset: [number, number, number] }>({
    scale: 1,
    offset: [0, 0, 0],
  });

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const targetHeight = obj.sizeCm.h / 100;
    const scale = size.y > 1e-5 ? targetHeight / size.y : 1;
    setTransform({ scale, offset: [-center.x * scale, -center.y * scale, -center.z * scale] });
  }, [gltf, obj.sizeCm.h]);

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, rotationY, 0]}
      userData={{ objectId: obj.id }}
      onDoubleClick={onDoubleClick}
    >
      <primitive object={gltf.scene} scale={transform.scale} position={transform.offset} />
    </group>
  );
}

/**
 * 本オブジェクト: 直方体の各面に表紙・背表紙・裏表紙テクスチャを貼る。
 * 面の割り当て(簡易実装。回転配置には未対応のため固定):
 *   +z(正面, 部屋側) = 表紙 / -z(背面) = 裏表紙 / +x(右側面) = 背表紙
 *   -x・+y・-y(左側面・上面・底面) = 表紙を流用（厚みが薄いためほぼ見えない想定）
 */
function BookObject({ obj, position, rotationY, onDoubleClick }: InnerMeshProps) {
  const { coverUrl, spineUrl, backUrl } = obj.bookTextures!;
  const [cover, spine, back] = useTexture([coverUrl, spineUrl, backUrl]);

  const materials = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ map: spine }), // +x 右側面（背表紙）
      new THREE.MeshStandardMaterial({ map: cover }), // -x 左側面
      new THREE.MeshStandardMaterial({ map: cover }), // +y 上面
      new THREE.MeshStandardMaterial({ map: cover }), // -y 底面
      new THREE.MeshStandardMaterial({ map: cover }), // +z 正面（表紙）
      new THREE.MeshStandardMaterial({ map: back }), // -z 背面（裏表紙）
    ],
    [cover, spine, back]
  );

  const { w, h, d } = obj.sizeCm;

  return (
    <mesh
      position={position}
      rotation={[0, rotationY, 0]}
      material={materials}
      userData={{ objectId: obj.id }}
      castShadow
      onDoubleClick={onDoubleClick}
    >
      <boxGeometry args={[w / 100, h / 100, d / 100]} />
    </mesh>
  );
}
