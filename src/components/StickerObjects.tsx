import { useTexture } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { StickerDoc, StickerPlacementDoc, Surface } from '../types';

interface Props {
  placements: StickerPlacementDoc[];
  stickers: StickerDoc[];
  surface: Surface;
  onSelect?: (placementId: string) => void;
}

export default function StickerObjects({ placements, stickers, surface, onSelect }: Props) {
  const stickerMap = new Map(stickers.map((s) => [s.id, s]));
  // 奥の壁は-Z方向（部屋の内側）が表側のため、平面を180度回して表を向ける
  const rotationY = surface === 'wall' ? Math.PI : 0;

  return (
    <group name={`stickers-${surface}`}>
      {placements
        .filter((p) => p.surface === surface)
        .map((placement) => {
          const sticker = stickerMap.get(placement.stickerId);
          if (!sticker) return null;
          return (
            <StickerPlane
              key={placement.id}
              sticker={sticker}
              placement={placement}
              rotationY={rotationY}
              onSelect={onSelect}
            />
          );
        })}
    </group>
  );
}

function StickerPlane({
  sticker,
  placement,
  rotationY,
  onSelect,
}: {
  sticker: StickerDoc;
  placement: StickerPlacementDoc;
  rotationY: number;
  onSelect?: (placementId: string) => void;
}) {
  const texture = useTexture(sticker.imageUrl);

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect?.(placement.id);
  };

  return (
    <mesh
      position={[placement.position.x, placement.position.y, placement.position.z]}
      rotation={[0, rotationY, 0]}
      userData={{ stickerPlacementId: placement.id }}
      onDoubleClick={handleDoubleClick}
    >
      <planeGeometry args={[placement.widthM, placement.heightM]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}
