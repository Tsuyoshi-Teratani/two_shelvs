import { SHELF } from '../Size';

export interface ShelfSpec {
  width: number;
  height: number;
  depth: number;
  thickness: number;
  backThickness: number;
}

/** 棚の1区画（上下2段×左右2列のうちの1つ） */
export interface Compartment {
  /** row * 2 + col。0=下段左、1=下段右、2=上段左、3=上段右（棚の正面から見て） */
  index: number;
  row: number;
  col: number;
  /** 区画の置き面（板の上面）のY座標 */
  floorY: number;
  /** 区画の天井（上の板の下面）のY座標 */
  ceilingY: number;
  xMin: number;
  xMax: number;
}

export interface ShelfLayout extends ShelfSpec {
  innerWidth: number;
  innerHeight: number;
  compartments: Compartment[];
  /** 背板の前面のZ座標（奥側の限界） */
  zMin: number;
  /** 開口部のZ座標（手前側の限界） */
  zMax: number;
}

/**
 * 棚1台分の内部レイアウトを計算する。Shelf.tsx のジオメトリと一致させること。
 * 原点(0,0,0)は「棚本体の下端・幅方向の中央・奥行き方向の中央」。
 * x: 左右（正面から見て右+）、y: 上下（棚本体の下端=0）、z: 奥行き（開口部側が+、背板側が-）
 */
export function getShelfLayout(shelf: ShelfSpec = SHELF): ShelfLayout {
  const { width: W, height: H, depth: D, thickness: t, backThickness } = shelf;

  const innerWidth = W - 2 * t;
  const innerHeight = H - 2 * t;
  const half = innerWidth / 2;

  // 中棚は高さの中央(H/2)に厚みtで入っている
  const rows = [
    { floorY: t, ceilingY: H / 2 - t / 2 },
    { floorY: H / 2 + t / 2, ceilingY: H - t },
  ];
  // 縦仕切りは幅の中央(x=0)に厚みtで入っている
  const cols = [
    { xMin: -half, xMax: -t / 2 },
    { xMin: t / 2, xMax: half },
  ];

  const compartments: Compartment[] = [];
  rows.forEach((r, row) => {
    cols.forEach((c, col) => {
      compartments.push({ index: row * 2 + col, row, col, ...r, ...c });
    });
  });

  return {
    ...shelf,
    innerWidth,
    innerHeight,
    compartments,
    zMin: -D / 2 + backThickness / 2,
    zMax: D / 2,
  };
}

/** cm単位のサイズをメートルに変換する */
export function sizeCmToMeters(sizeCm: { w: number; h: number; d: number }) {
  return { w: sizeCm.w / 100, h: sizeCm.h / 100, d: sizeCm.d / 100 };
}

function clampRange(v: number, lo: number, hi: number) {
  // 区画より大きいオブジェクトは中央に置く
  if (lo > hi) return (lo + hi) / 2;
  return Math.min(Math.max(v, lo), hi);
}

/**
 * オブジェクトを指定の区画に置くときの棚ローカル座標(x,y,z)を返す。
 * xは区画からはみ出さないようクランプ、yは置き面に接地、zは背板に寄せる。
 */
export function clampToCompartment(
  layout: ShelfLayout,
  compartmentIndex: number,
  sizeM: { w: number; h: number; d: number },
  rawX: number
) {
  const c = layout.compartments[compartmentIndex];
  const x = clampRange(rawX, c.xMin + sizeM.w / 2, c.xMax - sizeM.w / 2);
  const y = c.floorY + sizeM.h / 2;
  const z = layout.zMin + sizeM.d / 2 + 0.002;
  return { x, y, z };
}
