import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import StoreRoom from './StoreRoom';
import SafeEnvironment from './SafeEnvironment';
import DropShelfFronts from './DropShelfFronts';
import DropShelfBack from './DropShelfBack';
import DropWall from './DropWall';
import PlacedObjects from './PlacedObjects';
import StickerObjects from './StickerObjects';
import { ROOM, SHELF } from '../Size';
import { getShelfLayout, clampToCompartment, sizeCmToMeters } from '../utils/shelfLayout';
import {
  LEFT_SHELF_TRANSFORM,
  RIGHT_SHELF_TRANSFORM,
  WALL_Z,
  clampToWall,
  clampStickerToWall,
  clampStickerToShelfBack,
} from '../utils/roomLayout';
import { DEFAULT_ORIENTATION, orientedSize } from '../utils/orientation';
import type {
  BookOrientation,
  PlacementDoc,
  StickerDoc,
  StickerPlacementDoc,
  StoreObjectDoc,
  Surface,
  Vec3,
} from '../types';

export const OBJECT_DRAG_MIME = 'application/x-thoshelfsshop-object';
export const STICKER_DRAG_MIME = 'application/x-thoshelfsshop-sticker';

interface Props {
  /** 現在編集対象の面。この面の当たり判定だけが有効になり、カメラもこの面を正面から映す */
  activeSurface: Surface;
  /** 次にドロップする本の向き（雑貨には影響しない） */
  bookOrientation: BookOrientation;
  objects: StoreObjectDoc[];
  placements: PlacementDoc[];
  stickers: StickerDoc[];
  stickerPlacements: StickerPlacementDoc[];
  onPlaceObject: (
    objectId: string,
    surface: Surface,
    compartmentIndex: number,
    position: Vec3,
    orientation: BookOrientation
  ) => void;
  onRemoveObject: (objectId: string) => void;
  onPlaceSticker: (stickerId: string, surface: Surface, position: Vec3, widthM: number, heightM: number) => void;
  onRemoveSticker: (placementId: string) => void;
}

/** ステッカーの既定サイズ(m)。将来的にサイズ調整UIを追加する余地あり */
const DEFAULT_STICKER_SIZE = { width: 0.25, height: 0.25 };

type V3 = [number, number, number];

// --- 面ごとの「正面から見る」カメラ位置と注視点 ---
const SHELF_VIEW_DISTANCE = 1.4;
const WALL_VIEW_DISTANCE = 1.85;

function shelfView(t: { position: V3; rotationY: number }): { position: V3; target: V3 } {
  // 棚の正面（開口部）は棚ローカルの+z。Y回転後の向きは (sinθ, 0, cosθ)
  const nx = Math.sin(t.rotationY);
  const nz = Math.cos(t.rotationY);
  const target: V3 = [t.position[0], t.position[1] + SHELF.height / 2, t.position[2]];
  return {
    target,
    position: [target[0] + nx * SHELF_VIEW_DISTANCE, target[1], target[2] + nz * SHELF_VIEW_DISTANCE],
  };
}

const EDIT_VIEWS: Record<Surface, { position: V3; target: V3 }> = {
  wall: {
    position: [0, ROOM.height / 2 + 0.15, WALL_Z - WALL_VIEW_DISTANCE],
    target: [0, ROOM.height / 2, WALL_Z],
  },
  left: shelfView(LEFT_SHELF_TRANSFORM),
  right: shelfView(RIGHT_SHELF_TRANSFORM),
};

/** 編集対象の面が切り替わったら、その面を正面から映すようカメラを移動する */
function CameraRig({ surface }: { surface: Surface }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as
    | { target: THREE.Vector3; update: () => void }
    | null;

  useEffect(() => {
    const view = EDIT_VIEWS[surface];
    camera.position.set(...view.position);
    if (controls) {
      controls.target.set(...view.target);
      controls.update();
    } else {
      camera.lookAt(...view.target);
    }
  }, [surface, camera, controls]);

  return null;
}

type DropKind = 'object' | 'sticker';

function DropController({
  objects,
  stickers,
  bookOrientation,
  onPlaceObject,
  onPlaceSticker,
}: Pick<Props, 'objects' | 'stickers' | 'bookOrientation' | 'onPlaceObject' | 'onPlaceSticker'>) {
  const { camera, gl, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());

  useEffect(() => {
    const canvasEl = gl.domElement;
    const layout = getShelfLayout();

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    };

    /**
     * ドロップ位置のレイを飛ばし、userData.accepts に kind を含む当たり判定用の平面のうち
     * 最も手前のものを返す。壁や板などの見えるメッシュは判定に含めない（板の裏の壁にも置ける）。
     */
    const findDropHit = (e: DragEvent, kind: DropKind) => {
      const rect = canvasEl.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hits = raycaster.current.intersectObjects(scene.children, true);
      return hits.find((h) => (h.object.userData.accepts as DropKind[] | undefined)?.includes(kind));
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const types = e.dataTransfer?.types ?? [];
      const isObject = types.includes(OBJECT_DRAG_MIME);
      const isSticker = types.includes(STICKER_DRAG_MIME);

      if (isObject) {
        const { objectId } = JSON.parse(e.dataTransfer!.getData(OBJECT_DRAG_MIME)) as { objectId: string };
        const obj = objects.find((o) => o.id === objectId);
        const hit = findDropHit(e, 'object');
        if (!obj || !hit) return;

        const { surface, compartmentIndex } = hit.object.userData as {
          surface: Surface;
          compartmentIndex: number;
        };
        // 本は選択中の向き、雑貨は標準の向き。置ける範囲・接地・奥行きは「向きを反映した後の寸法」で計算する
        const orientation = obj.kind === 'book' ? bookOrientation : DEFAULT_ORIENTATION;
        const extents = orientedSize(sizeCmToMeters(obj.sizeCm), orientation);

        if (surface === 'wall') {
          onPlaceObject(objectId, 'wall', 0, clampToWall(extents, hit.point.x, hit.point.y), orientation);
        } else {
          // 平面は棚(Shelf)の子なので、親の変換でワールド→棚ローカル座標へ戻す
          const local = hit.object.parent!.worldToLocal(hit.point.clone());
          onPlaceObject(
            objectId,
            surface,
            compartmentIndex,
            clampToCompartment(layout, compartmentIndex, extents, local.x),
            orientation
          );
        }
        return;
      }

      if (isSticker) {
        const { stickerId } = JSON.parse(e.dataTransfer!.getData(STICKER_DRAG_MIME)) as { stickerId: string };
        const sticker = stickers.find((s) => s.id === stickerId);
        const hit = findDropHit(e, 'sticker');
        if (!sticker || !hit) return;

        const { surface } = hit.object.userData as { surface: Surface };
        const { width, height } = DEFAULT_STICKER_SIZE;

        if (surface === 'wall') {
          onPlaceSticker(stickerId, 'wall', clampStickerToWall(width, height, hit.point.x, hit.point.y), width, height);
        } else {
          const local = hit.object.parent!.worldToLocal(hit.point.clone());
          onPlaceSticker(stickerId, surface, clampStickerToShelfBack(width, height, local.x, local.y), width, height);
        }
      }
    };

    canvasEl.addEventListener('dragover', handleDragOver);
    canvasEl.addEventListener('drop', handleDrop);
    return () => {
      canvasEl.removeEventListener('dragover', handleDragOver);
      canvasEl.removeEventListener('drop', handleDrop);
    };
  }, [camera, gl, scene, objects, stickers, bookOrientation, onPlaceObject, onPlaceSticker]);

  return null;
}

export default function ShelfEditorScene({
  activeSurface,
  bookOrientation,
  objects,
  placements,
  stickers,
  stickerPlacements,
  onPlaceObject,
  onRemoveObject,
  onPlaceSticker,
  onRemoveSticker,
}: Props) {
  const isActive = (s: Surface) => activeSurface === s;

  // 棚の中身（配置済みの物・ステッカー・編集中ならドロップ判定面）。棚ローカル座標で描画される
  const shelfContent = (side: 'left' | 'right') => (
    <>
      <PlacedObjects
        placements={placements}
        objects={objects}
        surface={side}
        onSelect={isActive(side) ? onRemoveObject : undefined}
      />
      <StickerObjects
        placements={stickerPlacements}
        stickers={stickers}
        surface={side}
        onSelect={isActive(side) ? onRemoveSticker : undefined}
      />
      {isActive(side) && (
        <>
          <DropShelfFronts surface={side} />
          <DropShelfBack surface={side} />
        </>
      )}
    </>
  );

  return (
    <Canvas
      shadows
      camera={{ position: EDIT_VIEWS.wall.position, fov: 55, near: 0.01, far: 20 }}
      style={{ background: '#20242b' }}
    >
      <ambientLight intensity={0.3} />
      <SafeEnvironment />
      <Suspense fallback={null}>
        <StoreRoom leftShelfChildren={shelfContent('left')} rightShelfChildren={shelfContent('right')}>
          {/* 奥の壁（ワールド座標） */}
          <PlacedObjects
            placements={placements}
            objects={objects}
            surface="wall"
            onSelect={isActive('wall') ? onRemoveObject : undefined}
          />
          <StickerObjects
            placements={stickerPlacements}
            stickers={stickers}
            surface="wall"
            onSelect={isActive('wall') ? onRemoveSticker : undefined}
          />
          {isActive('wall') && <DropWall />}
        </StoreRoom>
      </Suspense>

      <DropController
        objects={objects}
        stickers={stickers}
        bookOrientation={bookOrientation}
        onPlaceObject={onPlaceObject}
        onPlaceSticker={onPlaceSticker}
      />

      <OrbitControls makeDefault minDistance={0.4} maxDistance={3} maxPolarAngle={Math.PI / 2 - 0.02} />
      <CameraRig surface={activeSurface} />
    </Canvas>
  );
}
