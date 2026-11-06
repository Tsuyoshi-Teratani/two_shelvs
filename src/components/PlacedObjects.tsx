import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF, useTexture } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import ErrorBoundary from './ErrorBoundary';
import { DEFAULT_ORIENTATION, orientationAngles } from '../utils/orientation';
import type { BookOrientation, PlacementDoc, StoreObjectDoc, Surface } from '../types';

interface Props {
  placements: PlacementDoc[];
  objects: StoreObjectDoc[];
  surface: Surface;
  /** ダブルクリック時のコールバック（編集画面: 棚から取り外す） */
  onSelect?: (objectId: string) => void;
  /** クリック時のコールバック（公開画面: 手元に持って拡大表示する）。ドラッグ操作はクリックとみなさない */
  onPick?: (objectId: string) => void;
  /** 手元に持っている間、棚の上のこのオブジェクトを非表示にする */
  hiddenObjectId?: string | null;
}

export default function PlacedObjects({ placements, objects, surface, onSelect, onPick, hiddenObjectId }: Props) {
  const objectMap = new Map(objects.map((o) => [o.id, o]));
  // 奥の壁は-Z方向（部屋の内側）が表側。物の正面(+z)を来店者側へ向けるため180度回す
  const surfaceYaw = surface === 'wall' ? Math.PI : 0;

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
              surfaceYaw={surfaceYaw}
              orientation={placement.orientation}
              hidden={obj.id === hiddenObjectId}
              onSelect={onSelect}
              onPick={onPick}
            />
          );
        })}
    </group>
  );
}

type ObjectEvents = {
  onDoubleClick?: (e: ThreeEvent<MouseEvent>) => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
};

export interface PlacedObjectMeshProps {
  obj: StoreObjectDoc;
  position: [number, number, number];
  /** 面ごとの基準の向き（奥の壁だけ180度）。棚は0 */
  surfaceYaw: number;
  /** 本の向き（本のみ有効。未指定なら表紙を向けて立てる） */
  orientation?: BookOrientation;
  hidden?: boolean;
  onSelect?: (objectId: string) => void;
  onPick?: (objectId: string) => void;
}

interface InnerMeshProps {
  obj: StoreObjectDoc;
  position: [number, number, number];
  quaternion: THREE.Quaternion;
  visible: boolean;
  events: ObjectEvents;
}

/** 1つのオブジェクトの表示（種類ごとの描画・読み込み失敗時の代替表示・クリック操作）。手元表示(HeldObject)からも使う */
export function PlacedObjectMesh({
  obj,
  position,
  surfaceYaw,
  orientation,
  hidden,
  onSelect,
  onPick,
}: PlacedObjectMeshProps) {
  const visible = !hidden;
  // 本だけ向きを反映する（雑貨は常に標準の向き）。Y回転→X回転の順 = Euler 'YXZ'
  const effective = obj.kind === 'book' ? orientation ?? DEFAULT_ORIENTATION : DEFAULT_ORIENTATION;
  const quaternion = useMemo(() => {
    const { pitchX, yawY } = orientationAngles(effective);
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchX, surfaceYaw + yawY, 0, 'YXZ'));
  }, [effective, surfaceYaw]);

  const events: ObjectEvents = {
    ...(onSelect
      ? {
          onDoubleClick: (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            onSelect(obj.id);
          },
        }
      : {}),
    ...(onPick
      ? {
          onClick: (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if (e.delta > 5) return; // 視点を動かすドラッグはクリックとして扱わない
            document.body.style.cursor = '';
            onPick(obj.id);
          },
          onPointerOver: (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          },
          onPointerOut: () => {
            document.body.style.cursor = '';
          },
        }
      : {}),
  };

  // 読み込み中、または読み込みに失敗した場合は、単色の箱で代用する（部屋全体は表示し続ける）
  const box = <ColorBox obj={obj} position={position} quaternion={quaternion} visible={visible} events={events} />;

  if (obj.kind === 'gltf' && obj.gltfUrl) {
    return (
      <ErrorBoundary key={obj.gltfUrl} fallback={box}>
        <Suspense fallback={box}>
          <GltfObject obj={obj} position={position} quaternion={quaternion} visible={visible} events={events} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (obj.kind === 'book' && obj.bookTextures) {
    return (
      <ErrorBoundary key={obj.bookTextures.coverUrl} fallback={box}>
        <Suspense fallback={box}>
          <BookObject obj={obj} position={position} quaternion={quaternion} visible={visible} events={events} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return box;
}

/** 単色の箱（モデル/テクスチャが未設定・読み込み中・読み込み失敗のときの表示） */
function ColorBox({ obj, position, quaternion, visible, events }: InnerMeshProps) {
  const { w, h, d } = obj.sizeCm;
  return (
    <mesh
      position={position}
      quaternion={quaternion}
      visible={visible}
      userData={{ objectId: obj.id }}
      castShadow
      {...events}
    >
      <boxGeometry args={[w / 100, h / 100, d / 100]} />
      <meshStandardMaterial color={obj.color} />
    </mesh>
  );
}

/**
 * GLTFモデルを読み込み、バウンディングボックスの中心をposition(=オブジェクトの中心)に、
 * 高さがsizeCm.hになるよう自動スケーリングして表示する。
 * 棚の上と手元で同時に表示できるよう、キャッシュされたモデルは複製して使う。
 * モデルの形状によっては台座に少し埋まる/浮くことがある簡易実装。
 */
function GltfObject({ obj, position, quaternion, visible, events }: InnerMeshProps) {
  const gltf = useGLTF(obj.gltfUrl!);

  const { scene, scale, offset } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.updateMatrixWorld(true); // 親に取り付ける前の、モデル自身の座標系でサイズを測る
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = size.y > 1e-5 ? obj.sizeCm.h / 100 / size.y : 1;
    return {
      scene: clone,
      scale: s,
      offset: [-center.x * s, -center.y * s, -center.z * s] as [number, number, number],
    };
  }, [gltf, obj.sizeCm.h]);

  return (
    <group
      position={position}
      quaternion={quaternion}
      visible={visible}
      userData={{ objectId: obj.id }}
      {...events}
    >
      <primitive object={scene} scale={scale} position={offset} />
    </group>
  );
}

/**
 * 本オブジェクト: 直方体の各面に表紙・背表紙・裏表紙テクスチャを貼る。
 * 面の割り当て(簡易実装。回転配置には未対応のため固定):
 *   +z(正面, 部屋側) = 表紙 / -z(背面) = 裏表紙 / +x(右側面) = 背表紙
 *   -x・+y・-y(左側面・上面・底面) = 表紙を流用（厚みが薄いためほぼ見えない想定）
 */
function BookObject({ obj, position, quaternion, visible, events }: InnerMeshProps) {
  const { coverUrl, spineUrl, backUrl } = obj.bookTextures!;
  const [cover, spine, back] = useTexture([coverUrl, spineUrl, backUrl]);

  const materials = useMemo(() => {
    [cover, spine, back].forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace; // 色が白っぽく/暗くならないようsRGBとして扱う
      t.needsUpdate = true;
    });
    return [
      new THREE.MeshStandardMaterial({ map: spine }), // +x 右側面（背表紙）
      new THREE.MeshStandardMaterial({ map: cover }), // -x 左側面
      new THREE.MeshStandardMaterial({ map: cover }), // +y 上面
      new THREE.MeshStandardMaterial({ map: cover }), // -y 底面
      new THREE.MeshStandardMaterial({ map: cover }), // +z 正面（表紙）
      new THREE.MeshStandardMaterial({ map: back }), // -z 背面（裏表紙）
    ];
  }, [cover, spine, back]);

  const { w, h, d } = obj.sizeCm;

  return (
    <mesh
      position={position}
      quaternion={quaternion}
      visible={visible}
      material={materials}
      userData={{ objectId: obj.id }}
      castShadow
      {...events}
    >
      <boxGeometry args={[w / 100, h / 100, d / 100]} />
    </mesh>
  );
}
