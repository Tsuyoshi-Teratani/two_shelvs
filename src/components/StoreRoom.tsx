import type { ReactNode } from 'react';
import { Box } from '@react-three/drei';
import Shelf from '../object/Shelf';
import FrontBoard from '../object/FrontBoard';
import { ROOM, DOOR } from '../Size';
import { FRONT_BOARD_Z, LEFT_SHELF_TRANSFORM, RIGHT_SHELF_TRANSFORM } from '../utils/roomLayout';

interface StoreRoomProps {
  /** 部屋のルートに置く物（奥の壁の物など。座標はワールド座標） */
  children?: ReactNode;
  /** 左棚の中に置く物（座標は棚ローカル座標） */
  leftShelfChildren?: ReactNode;
  /** 右棚の中に置く物（座標は棚ローカル座標） */
  rightShelfChildren?: ReactNode;
}

/**
 * 店内の部屋（壁・床・天井・照明・正面の板・入口の扉・左右の本棚）。
 * 公開画面(VRStore)と管理画面の棚編集(ShelfEditorScene)で共通利用する。
 */
export default function StoreRoom({ children, leftShelfChildren, rightShelfChildren }: StoreRoomProps) {
  const { width: roomWidth, depth: roomDepth, height: roomHeight } = ROOM;

  return (
    <group>
      {/* 床 */}
      <mesh position={[0, 0, roomDepth / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshStandardMaterial color="#6B8E7A" />
      </mesh>
      {/* 天井 */}
      <mesh position={[0, roomHeight, roomDepth / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* 奥の壁 */}
      <mesh position={[0, roomHeight / 2, roomDepth]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[roomWidth, roomHeight]} />
        <meshStandardMaterial color="#666666" />
      </mesh>
      {/* 後ろの壁 */}
      <mesh position={[0, roomHeight / 2, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[roomWidth, roomHeight]} />
        <meshStandardMaterial color="#666666" />
      </mesh>
      {/* 左の壁 */}
      <mesh position={[-roomWidth / 2, roomHeight / 2, roomDepth / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[roomDepth, roomHeight]} />
        <meshStandardMaterial color="#666666" />
      </mesh>
      {/* 右の壁 */}
      <mesh position={[roomWidth / 2, roomHeight / 2, roomDepth / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[roomDepth, roomHeight]} />
        <meshStandardMaterial color="#666666" />
      </mesh>

      {/* 天井照明 (20cm四方のボックス + 光源) */}
      <group position={[0, roomHeight - 0.025, roomDepth / 2]}>
        <Box args={[0.2, 0.05, 0.2]}>
          <meshBasicMaterial color="#ffffff" />
        </Box>
        <pointLight position={[0, -0.05, 0]} intensity={2.5} distance={4} decay={2} castShadow />
      </group>

      {/* 正面の板 */}
      <FrontBoard z={FRONT_BOARD_Z} />

      {/* 背面（入口側）の扉 */}
      <Box
        args={[DOOR.width, DOOR.height, DOOR.thickness]}
        position={[0, DOOR.height / 2, DOOR.z]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#1a241f" /* 黒と緑が混ざった重厚感のあるダークオリーブ */
          metalness={0.8} /* 鉄の金属感を出す */
          roughness={0.55} /* わずかにツヤを残しつつ、鈍く光を反射させる */
        />
      </Box>

      {/* 左右の本棚 */}
      <Shelf
        position={LEFT_SHELF_TRANSFORM.position}
        rotation={[0, LEFT_SHELF_TRANSFORM.rotationY, 0]}
        name="Shelf Left"
      >
        {leftShelfChildren}
      </Shelf>
      <Shelf
        position={RIGHT_SHELF_TRANSFORM.position}
        rotation={[0, RIGHT_SHELF_TRANSFORM.rotationY, 0]}
        name="Shelf Right"
      >
        {rightShelfChildren}
      </Shelf>

      {children}
    </group>
  );
}
