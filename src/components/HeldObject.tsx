import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { PlacedObjectMesh } from './PlacedObjects';
import type { StoreObjectDoc } from '../types';

/** カメラから手元の位置までの距離(m) */
const HOLD_DISTANCE = 0.45;
/** 手元で見るときの最大辺の目安(m)。小さい物ほど大きく拡大される */
const HOLD_TARGET_SIZE = 0.28;
const MAX_HOLD_SCALE = 3.5;
const ANIMATION_SECONDS = 0.35;
/** ドラッグ1pxあたりの回転量(rad) */
const ROTATE_SPEED = 0.01;

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// 毎フレームの計算用の使い回し（手元に持てるのは常に1つだけ）
const tmpScale = new THREE.Vector3();
const tmpCamPos = new THREE.Vector3();
const tmpCamDir = new THREE.Vector3();
const tmpHeldQuat = new THREE.Quaternion();

/** sceneの中から、指定IDのオブジェクト（棚の上の本体）を探す。exclude配下（手元のコピー）は除く */
function findSource(scene: THREE.Object3D, id: string, exclude: THREE.Object3D): THREE.Object3D | null {
  const result: { found: THREE.Object3D | null } = { found: null };
  scene.traverse((o) => {
    if (result.found || o.userData?.objectId !== id) return;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === exclude) return;
    result.found = o;
  });
  return result.found;
}

interface Props {
  obj: StoreObjectDoc;
  /** trueにすると棚へ戻るアニメーションを始め、終わったら onReturned を呼ぶ */
  returning: boolean;
  onReturned: () => void;
}

/**
 * 棚から取り出したオブジェクトを手元（視点の正面）に拡大して表示する。
 * - 棚の位置から手元へ、戻すときは手元から棚の元の位置へアニメーションで移動する
 * - 手元にある間はドラッグで回転できる（視点操作 OrbitControls は呼び出し側で無効化する）
 * - 手元の位置は取り出した瞬間の視点に固定（ワールド座標）。VRで頭を動かしても物は動かない
 */
export default function HeldObject({ obj, returning, onReturned }: Props) {
  const { scene, camera, gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const anim = useRef({
    ready: false,
    notified: false,
    t: 0,
    dir: 1 as 1 | -1,
    originPos: new THREE.Vector3(),
    originQuat: new THREE.Quaternion(),
    originScale: 1,
    holdPos: new THREE.Vector3(),
    holdQuat: new THREE.Quaternion(),
    holdScale: 1,
    spin: new THREE.Quaternion(), // ユーザーのドラッグによる回転
  });

  useEffect(() => {
    anim.current.dir = returning ? -1 : 1;
  }, [returning]);

  // ドラッグで回転（マウス・タッチ共通）
  useEffect(() => {
    const el = gl.domElement;
    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* 取得できなくても回転自体は動く */
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging || anim.current.dir === -1) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      // 回転軸は画面基準（横ドラッグ=縦軸まわり、縦ドラッグ=横軸まわり）
      qa.setFromAxisAngle(AXIS_Y, dx * ROTATE_SPEED);
      qb.setFromAxisAngle(AXIS_X, dy * ROTATE_SPEED);
      anim.current.spin.premultiply(qa).premultiply(qb).normalize();
    };
    const onUp = () => {
      dragging = false;
    };

    const prevTouchAction = el.style.touchAction;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.style.touchAction = prevTouchAction;
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const a = anim.current;

    if (!a.ready) {
      // 取り出した瞬間の「棚の上の姿勢」と「手元の姿勢（視点の正面）」を記録する
      const src = findSource(scene, obj.id, g);
      camera.getWorldPosition(tmpCamPos);
      camera.getWorldDirection(tmpCamDir);
      camera.getWorldQuaternion(a.holdQuat); // 物の正面(+z)が視点の方を向く
      a.holdPos.copy(tmpCamPos).addScaledVector(tmpCamDir, HOLD_DISTANCE);

      if (src) {
        src.updateWorldMatrix(true, false);
        src.matrixWorld.decompose(a.originPos, a.originQuat, tmpScale);
        a.originScale = tmpScale.x;
      } else {
        a.originPos.copy(a.holdPos);
        a.originQuat.copy(a.holdQuat);
        a.originScale = 1;
      }

      const maxDim = Math.max(obj.sizeCm.w, obj.sizeCm.h, obj.sizeCm.d) / 100;
      a.holdScale = THREE.MathUtils.clamp(HOLD_TARGET_SIZE / maxDim, 1, MAX_HOLD_SCALE);
      a.ready = true;
      g.visible = true; // 姿勢が決まるまでの1フレームは隠して、原点にちらつくのを防ぐ
    }

    a.t = THREE.MathUtils.clamp(a.t + (a.dir * delta) / ANIMATION_SECONDS, 0, 1);
    const e = easeInOut(a.t);

    tmpHeldQuat.copy(a.holdQuat).multiply(a.spin); // 手元の姿勢 = 基準の向き × ユーザーの回転
    g.position.lerpVectors(a.originPos, a.holdPos, e);
    g.quaternion.copy(a.originQuat).slerp(tmpHeldQuat, e);
    g.scale.setScalar(THREE.MathUtils.lerp(a.originScale, a.holdScale, e));

    if (a.dir === -1 && a.t === 0 && !a.notified) {
      a.notified = true;
      onReturned();
    }
  });

  return (
    <group ref={groupRef} visible={false} userData={{ held: true }}>
      <PlacedObjectMesh obj={obj} position={[0, 0, 0]} surfaceYaw={0} />
    </group>
  );
}
