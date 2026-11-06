import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { GazeSwingDetector, type SwingDetectorOptions } from '../utils/gazeSwingDetector';

interface UseGazeGestureOptions {
  /** 縦方向の素早い1往復を検出したときに呼ばれる（決定） */
  onConfirm: (objectId: string) => void;
  /** 横方向の素早い1往復を検出したときに呼ばれる（キャンセル） */
  onCancel: (objectId: string) => void;
  /** 注視し続けてからジェスチャー判定を開始するまでの時間(ms)。短すぎると視線が通り過ぎただけで誤反応しやすい */
  dwellMs?: number;
  detectorOptions?: SwingDetectorOptions;
  /** 現在の注視対象が変わるたびに呼ばれる（レティクル表示の切り替えなどに使用、任意） */
  onGazeChange?: (objectId: string | null) => void;
  /** falseの間はレイキャスト・判定を行わない（パネル表示中は別の対象を注視させたくない場合などに使用） */
  enabled?: boolean;
}

/** 当たったメッシュから親を辿り、userData.objectId を持つ最初のオブジェクトのIDを返す（GLTFの子メッシュ対策） */
function findObjectId(start: THREE.Object3D): string | null {
  let o: THREE.Object3D | null = start;
  while (o) {
    const id = o.userData?.objectId as string | undefined;
    if (id) return id;
    o = o.parent;
  }
  return null;
}

/** 自分と祖先がすべて表示中か（visible=falseの物はRaycasterにも当たるため、注視対象から除く） */
function isVisibleInTree(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/**
 * Canvas内（R3Fツリーの中）で呼び出すこと。
 * 毎フレーム、画面中央（視線方向）のレイキャストと、カメラの向きの履歴からの
 * ジェスチャー判定を行う。レイは部屋全体に飛ばし、最も手前に当たった物が商品なら注視対象とする
 * （板や棚の裏にある商品は注視できない）。VRヘッドセット装着時は実際の頭の向きがcamera.quaternionに
 * 反映されるため同じロジックで動作する。デスクトップ/スマホでOrbitControlsを操作している場合も、
 * カメラは常に注視点を向くよう回転するためcamera.quaternionが変化し、同様に動作する。
 */
export function useGazeGesture({
  onConfirm,
  onCancel,
  dwellMs = 150,
  detectorOptions,
  onGazeChange,
  enabled = true,
}: UseGazeGestureOptions) {
  const { camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const euler = useRef(new THREE.Euler());
  const detector = useRef(new GazeSwingDetector(detectorOptions));

  const gazedIdRef = useRef<string | null>(null);
  const gazeStartRef = useRef(0);
  const dwellActiveRef = useRef(false);

  useFrame(() => {
    if (!enabled) {
      if (gazedIdRef.current !== null) {
        gazedIdRef.current = null;
        onGazeChange?.(null);
      }
      return;
    }

    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.current.intersectObjects(scene.children, true);
    const first = hits.find((h) => isVisibleInTree(h.object));
    const hitId = first ? findObjectId(first.object) : null;

    const now = performance.now();

    if (hitId !== gazedIdRef.current) {
      gazedIdRef.current = hitId;
      gazeStartRef.current = now;
      dwellActiveRef.current = false;
      detector.current.reset();
      onGazeChange?.(hitId);
    }

    if (!hitId) return;

    if (!dwellActiveRef.current) {
      if (now - gazeStartRef.current >= dwellMs) {
        dwellActiveRef.current = true;
        detector.current.reset(); // dwell確定時点の向きを基準角度にする
      }
      return;
    }

    euler.current.setFromQuaternion(camera.quaternion, 'YXZ');
    const result = detector.current.update(now, euler.current.x, euler.current.y);

    if (result === 'vertical') onConfirm(hitId);
    if (result === 'horizontal') onCancel(hitId);
  });
}
