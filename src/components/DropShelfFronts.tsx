import { useMemo } from 'react';
import { DoubleSide } from 'three';
import { getShelfLayout } from '../utils/shelfLayout';
import type { Surface } from '../types';

interface Props {
  surface: Extract<Surface, 'left' | 'right'>;
}

/**
 * 棚の各区画（上下2段×左右2列）の開口部に置く、見えない当たり判定用の垂直な平面。
 * 床面の平面ではなく開口部の平面を使うことで、カメラの高さが置き面と同じ・下になっても
 * ドロップ位置を取りこぼさない。Shelfの子として置くこと（棚ローカル座標になる）。
 */
export default function DropShelfFronts({ surface }: Props) {
  const layout = useMemo(() => getShelfLayout(), []);

  return (
    <>
      {layout.compartments.map((c) => (
        <mesh
          key={c.index}
          position={[(c.xMin + c.xMax) / 2, (c.floorY + c.ceilingY) / 2, layout.zMax]}
          userData={{ accepts: ['object'], surface, compartmentIndex: c.index }}
          visible={false}
        >
          <planeGeometry args={[c.xMax - c.xMin, c.ceilingY - c.floorY]} />
          <meshBasicMaterial side={DoubleSide} />
        </mesh>
      ))}
    </>
  );
}
