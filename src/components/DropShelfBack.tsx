import { useMemo } from 'react';
import { DoubleSide } from 'three';
import { SHELF } from '../Size';
import { getShelfLayout } from '../utils/shelfLayout';
import type { Surface } from '../types';

interface Props {
  surface: Extract<Surface, 'left' | 'right'>;
}

/**
 * 棚の背板に対応する、見えない当たり判定用の平面（ステッカー貼り付け用）。
 * Shelfの子として置くこと（棚ローカル座標になる）。
 */
export default function DropShelfBack({ surface }: Props) {
  const layout = useMemo(() => getShelfLayout(), []);
  return (
    <mesh
      position={[0, SHELF.height / 2, layout.zMin + 0.001]}
      userData={{ accepts: ['sticker'], surface, compartmentIndex: 0 }}
      visible={false}
    >
      <planeGeometry args={[layout.innerWidth, layout.innerHeight]} />
      <meshBasicMaterial side={DoubleSide} />
    </mesh>
  );
}
