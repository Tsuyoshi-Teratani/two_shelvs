import type { ReactNode } from 'react';
import { Box, Text } from '@react-three/drei';
import { SHELF } from '../Size';

export interface ShelfProps {
  position: [number, number, number];
  rotation: [number, number, number];
  name?: string;
  width?: number;
  height?: number;
  depth?: number;
  children?: ReactNode;
}

// --- 3Dの本棚（Bookshelf）コンポーネント ---
// ローカル原点は「棚本体の下端・幅中央・奥行き中央」。開口部(正面)は+z側。
// 土台（底）は原点より下（-height/2 〜 0）に入っている。
// 内部の区画の寸法計算は utils/shelfLayout.ts の getShelfLayout と一致させること。
export default function Shelf({
  position,
  rotation,
  name,
  width = SHELF.width,
  height = SHELF.height,
  depth = SHELF.depth,
  children,
}: ShelfProps) {
  const thickness = SHELF.thickness; // 板厚 2cm
  const materialColor = '#5d4037';
  const innerWidth = width - thickness * 2;
  const innerHeight = height - thickness * 2;

  return (
    <group position={position} rotation={rotation}>
      {/* 天板・底板 */}
      <Box args={[width, thickness, depth]} position={[0, (height / 2 - thickness / 2) + (height / 2), 0]} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} />
      </Box>
      <Box args={[width, thickness, depth]} position={[0, (-height / 2 + thickness / 2) + (height / 2), 0]} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} />
      </Box>

      {/* 左右側板 */}
      <Box args={[thickness, height, depth]} position={[-width / 2 + thickness / 2, height / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} />
      </Box>
      <Box args={[thickness, height, depth]} position={[width / 2 - thickness / 2, height / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} />
      </Box>

      {/* 中棚（1段） */}
      <Box args={[innerWidth, thickness, depth]} position={[0, height / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} />
      </Box>

      {/* 縦仕切り（上下2段） */}
      <Box args={[thickness, innerHeight / 2, depth]} position={[0, (innerHeight / 4) + (height / 2), 0]} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} />
      </Box>
      <Box args={[thickness, innerHeight / 2, depth]} position={[0, (-innerHeight / 4) + (height / 2), 0]} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} />
      </Box>

      {/* 背板 */}
      <Box args={[width, height, SHELF.backThickness]} position={[0, height / 2, -depth / 2]}>
        <meshStandardMaterial color="#3e2723" />
      </Box>

      {/* 底 */}
      <Box args={[width, height / 2, depth]} position={[0, -height / 4, 0]}>
        <meshStandardMaterial color="#3e2723" />
      </Box>

      {/* 棚の名前プレート（黒板風） */}
      {name && (
        <group position={[0, height + 0.09, 0.03]}>
          <Text position={[0, 0, 0.021]} fontSize={0.06} color="#ffffff" anchorX="center" anchorY="middle">
            {name}
          </Text>
          <mesh position={[0, 0, 0]}>
            {/* args={[横幅, 縦幅, 厚み]} */}
            <boxGeometry args={[0.6, 0.18, 0.04]} />
            <meshStandardMaterial
              color="#1e352f" /* 深みのある黒板のダークグリーン */
              roughness={1.0} /* つやを完全に消してマットにする */
              metalness={0.0} /* 金属感をゼロにしてチョークが馴染む質感に */
            />
          </mesh>
        </group>
      )}

      {/* 棚に配置されたアイテムたち */}
      {children}
    </group>
  );
}
