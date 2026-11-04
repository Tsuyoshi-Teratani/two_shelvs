// ThoShelfsShop の寸法基準。
// 1M（1メートル）＝ Three.jsのワールド座標1単位として扱う。
// すべての3D座標・サイズはこのファイルの定数/関数を経由して算出すること。

export const UNIT_PER_METER = 1;

/** メートル値をそのままThree.js単位として返す（1M=1のため恒等関数だが、意図を明示するために使う） */
export const m = (meters: number): number => meters * UNIT_PER_METER;

/** センチメートル値をThree.js単位（メートル）に変換する */
export const cm = (centimeters: number): number => (centimeters / 100) * UNIT_PER_METER;

/**
 * 店舗の部屋。
 * X: -width/2 ～ width/2、Y: 0(床) ～ height、Z: 0(入口の扉側) ～ depth(奥の壁)
 * 来店者は入口(Z=0)から+Z方向（奥の壁）を向いて入る。
 */
export const ROOM = {
  width: m(2.0),
  depth: m(2.0),
  height: m(2.5),
} as const;

/** 正面の板。奥の壁から offsetFromWall だけ手前に、板の「中心」を置く */
export const FRONT_BOARD = {
  width: m(0.5),
  height: m(2.5),
  thickness: m(0.2),
  offsetFromWall: m(0.2),
} as const;

/** 背面（入口側）の扉 */
export const DOOR = {
  width: m(1),
  height: m(2),
  thickness: cm(4),
  /** 扉の中心のZ座標 */
  z: cm(4),
} as const;

const SHELF_HEIGHT = m(1.2);

/**
 * 本棚1台の寸法。
 * 上下2段 × 左右2列の4コンパートメント（中棚1枚＋縦仕切り）で、
 * 床から baseHeight の高さまでは土台（底）になっていて、その上に棚本体が載る。
 */
export const SHELF = {
  width: m(0.7),
  height: SHELF_HEIGHT,
  depth: m(0.25),
  /** 板厚 2cm */
  thickness: cm(2),
  /** 背板の厚み 5mm */
  backThickness: m(0.005),
  /** 土台の高さ（＝棚本体の下端の高さ） */
  baseHeight: SHELF_HEIGHT / 2,
} as const;

/** 商品/本オブジェクトの最大想定サイズ（UIの目安に使用） */
export const MAX_OBJECT_SIZE_CM = 30;
