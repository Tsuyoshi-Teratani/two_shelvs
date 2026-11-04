import { ROOM, SHELF, FRONT_BOARD } from '../Size';

type V3 = [number, number, number];

/** 正面の板の中心のZ座標 */
export const FRONT_BOARD_Z = ROOM.depth - FRONT_BOARD.offsetFromWall;

// --- 本棚の配置計算（正面の板の奥側の縁に接する計算。VRStoreの元の計算式のまま） ---
const BOARD_BACK_Z = FRONT_BOARD_Z + FRONT_BOARD.thickness / 2;
const SHELF_ROT = (Math.PI / 4) * 3; // 135度
const SHELF_EDGE_X = 0.75;
const cosR = Math.cos(SHELF_ROT);
const sinR = Math.sin(SHELF_ROT);

const SHELF_Z =
  BOARD_BACK_Z - FRONT_BOARD.thickness - (SHELF.width / 5) * sinR + (SHELF.depth / 2) * cosR;
const LEFT_X = -SHELF_EDGE_X - (SHELF.width / 2) * cosR - (SHELF.depth / 2) * sinR;
const RIGHT_X = SHELF_EDGE_X + (SHELF.width / 2) * cosR + (SHELF.depth / 2) * sinR;

/**
 * 左右の本棚の変換（位置・Y回転）。VRStore（公開画面）と管理画面の棚編集で共通利用する。
 * 棚ローカル座標の原点は「棚本体の下端・幅中央・奥行き中央」、開口部(正面)は+z側。
 * 注意: 名称は元のコードに合わせて「left = X<0」。入口から奥(+Z)を向いた来店者には
 * X<0 は画面の右側に見える。見た目の左右を入れ替えたい場合は、LEFT_X/RIGHT_X と回転の符号を
 * 入れ替えるだけでよい。
 */
export const LEFT_SHELF_TRANSFORM: { position: V3; rotationY: number } = {
  position: [LEFT_X, SHELF.baseHeight, SHELF_Z],
  rotationY: SHELF_ROT,
};
export const RIGHT_SHELF_TRANSFORM: { position: V3; rotationY: number } = {
  position: [RIGHT_X, SHELF.baseHeight, SHELF_Z],
  rotationY: -SHELF_ROT,
};

/** 奥の壁（来店者の正面にある壁）のZ座標。壁面の物は-Z方向（部屋の内側）を向く */
export const WALL_Z = ROOM.depth;
/** 壁面オブジェクト/ステッカーを壁からわずかに浮かせ、Z-fightingや埋まり込みを防ぐ */
export const WALL_PLACEMENT_EPS = 0.02;

function clamp(v: number, lo: number, hi: number) {
  if (lo > hi) return (lo + hi) / 2;
  return Math.min(Math.max(v, lo), hi);
}

/** 奥の壁にオブジェクトを置くときのワールド座標(x,y,z)。yはオブジェクトの中心の高さ */
export function clampToWall(sizeM: { w: number; h: number; d: number }, rawX: number, rawY: number) {
  const x = clamp(rawX, -ROOM.width / 2 + sizeM.w / 2, ROOM.width / 2 - sizeM.w / 2);
  const y = clamp(rawY, sizeM.h / 2, ROOM.height - sizeM.h / 2);
  const z = WALL_Z - WALL_PLACEMENT_EPS - sizeM.d / 2;
  return { x, y, z };
}

/** ステッカー（厚みのない平面）を奥の壁に貼るときのワールド座標(x,y,z) */
export function clampStickerToWall(widthM: number, heightM: number, rawX: number, rawY: number) {
  const x = clamp(rawX, -ROOM.width / 2 + widthM / 2, ROOM.width / 2 - widthM / 2);
  const y = clamp(rawY, heightM / 2, ROOM.height - heightM / 2);
  const z = WALL_Z - WALL_PLACEMENT_EPS;
  return { x, y, z };
}

/** ステッカーを棚の背板に貼るときの棚ローカル座標(x,y,z)。背板の前面の少し手前に置く */
export function clampStickerToShelfBack(widthM: number, heightM: number, rawX: number, rawY: number) {
  const t = SHELF.thickness;
  const halfInner = SHELF.width / 2 - t;
  const x = clamp(rawX, -halfInner + widthM / 2, halfInner - widthM / 2);
  const y = clamp(rawY, t + heightM / 2, SHELF.height - t - heightM / 2);
  const z = -SHELF.depth / 2 + SHELF.backThickness / 2 + 0.002;
  return { x, y, z };
}
