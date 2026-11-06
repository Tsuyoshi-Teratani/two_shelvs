import type { BookOrientation } from '../types';

export const BOOK_ORIENTATIONS: BookOrientation[] = [
  'standing-cover',
  'standing-spine',
  'lying-cover',
  'lying-spine',
];

export const DEFAULT_ORIENTATION: BookOrientation = 'standing-cover';

export const ORIENTATION_LABELS: Record<BookOrientation, string> = {
  'standing-cover': '立てる（表紙を向ける）',
  'standing-spine': '立てる（背表紙を向ける）',
  'lying-cover': '寝かせる（表紙が上）',
  'lying-spine': '寝かせる（背表紙が手前）',
};

/**
 * 向きごとの回転角。回転は「X軸まわりにpitchX → Y軸まわりにyawY」の順（Three.jsのEuler順序 'YXZ'）。
 * 本のローカル軸: +z=表紙、-z=裏表紙、+x=背表紙、+y=本の上端。
 * 面の外向き（開口部側）は+z。
 *  - standing-spine: Yを-90°回して、背表紙(+x)を+zへ
 *  - lying-cover:    Xを-90°回して、表紙(+z)を上(+y)へ
 *  - lying-spine:    寝かせたうえで、Yを-90°回して背表紙(+x)を+zへ
 */
export function orientationAngles(o: BookOrientation): { pitchX: number; yawY: number } {
  switch (o) {
    case 'standing-spine':
      return { pitchX: 0, yawY: -Math.PI / 2 };
    case 'lying-cover':
      return { pitchX: -Math.PI / 2, yawY: 0 };
    case 'lying-spine':
      return { pitchX: -Math.PI / 2, yawY: -Math.PI / 2 };
    default:
      return { pitchX: 0, yawY: 0 };
  }
}

/**
 * 向きを反映した後の、X・Y・Z方向それぞれの大きさ（w=X, h=Y, d=Z）。
 * 置ける範囲のクランプ、接地の高さ、奥行きの計算には、元の寸法ではなくこれを使う。
 */
export function orientedSize(
  size: { w: number; h: number; d: number },
  o: BookOrientation
): { w: number; h: number; d: number } {
  switch (o) {
    case 'standing-spine':
      return { w: size.d, h: size.h, d: size.w };
    case 'lying-cover':
      return { w: size.w, h: size.d, d: size.h };
    case 'lying-spine':
      return { w: size.h, h: size.d, d: size.w };
    default:
      return { w: size.w, h: size.h, d: size.d };
  }
}
