import { Box } from '@react-three/drei';
import { FRONT_BOARD } from '../Size';

interface FrontBoardProps {
  /** 板の中心のZ座標（部屋の奥の壁から手前に配置する位置） */
  z: number;
  width?: number;
  height?: number;
  thickness?: number;
  color?: string;
}

// --- 正面の板 ---
export default function FrontBoard({
  z,
  width = FRONT_BOARD.width,
  height = FRONT_BOARD.height,
  thickness = FRONT_BOARD.thickness,
  color = '#424242',
}: FrontBoardProps) {
  return (
    <Box args={[width, height, thickness]} position={[0, height / 2, z]} castShadow receiveShadow>
      <meshStandardMaterial color={color} />
    </Box>
  );
}
