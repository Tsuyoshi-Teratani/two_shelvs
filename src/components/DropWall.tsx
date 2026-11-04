import { DoubleSide } from 'three';
import { ROOM } from '../Size';
import { WALL_Z } from '../utils/roomLayout';

/**
 * 奥の壁に対応する、見えない当たり判定用の平面（オブジェクト・ステッカー共用）。
 * 部屋のルート(StoreRoomのchildren)に置くこと（座標はワールド座標になる）。
 */
export default function DropWall() {
  return (
    <mesh
      position={[0, ROOM.height / 2, WALL_Z - 0.001]}
      rotation={[0, Math.PI, 0]}
      userData={{ accepts: ['object', 'sticker'], surface: 'wall', compartmentIndex: 0 }}
      visible={false}
    >
      <planeGeometry args={[ROOM.width, ROOM.height]} />
      <meshBasicMaterial side={DoubleSide} />
    </mesh>
  );
}
