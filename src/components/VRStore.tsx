import { useState, useEffect, Suspense, type CSSProperties } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { XR, createXRStore, useXR } from '@react-three/xr';
import StoreRoom from './StoreRoom';
import PlacedObjects from './PlacedObjects';
import StickerObjects from './StickerObjects';
import ManualPanel from './ManualPanel';
import { useGazeGesture } from '../hooks/useGazeGesture';
import {
  firebaseEnabled,
  getShop,
  subscribeObjects,
  subscribePlacements,
  subscribeStickers,
  subscribeStickerPlacements,
} from '../firebase';
import type { PlacementDoc, ShopDoc, StickerDoc, StickerPlacementDoc, StoreObjectDoc } from '../types';

const store = createXRStore();

interface GazeControllerProps {
  onConfirm: (objectId: string) => void;
  onCancel: (objectId: string) => void;
  onGazeChange: (objectId: string | null) => void;
  enabled: boolean;
}

/** useGazeGestureをCanvas内で呼び出すための薄いラッパー。見た目は何も描画しない */
function GazeController({ onConfirm, onCancel, onGazeChange, enabled }: GazeControllerProps) {
  useGazeGesture({ onConfirm, onCancel, onGazeChange, enabled });
  return null;
}

/**
 * PCでは右ドラッグで視点を回転させる（左ドラッグはパン）。
 * VRセッション中はヘッドセットの頭の動きと競合しないよう無効化する。
 */
function DesktopOrbitControls() {
  const isPresenting = useXR((state) => state.session != null);
  return (
    <OrbitControls
      enabled={!isPresenting}
      target={[0, 1.5, 0.8]} // 注視点（正面の板の方向）
      enableDamping={true} // 操作時のスムーズな減衰（慣性）
      dampingFactor={0.05}
      minDistance={0.1} // 拡大の限界（近づきすぎ防止）
      maxDistance={1.2} // 縮小の限界（部屋の外に出ないよう制限）
      mouseButtons={{
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      }}
    />
  );
}

// --- 画面下部のボタン類のスタイル ---
const buttonBaseStyle: CSSProperties = {
  padding: '12px 24px',
  borderRadius: '8px',
  border: 'none',
  color: '#fff',
  fontWeight: 'bold',
  cursor: 'pointer',
};

const vrButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  backgroundColor: '#0070f3',
};

const manualButtonStyle = (open: boolean): CSSProperties => ({
  ...buttonBaseStyle,
  backgroundColor: open ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
});

export default function VRStore() {
  const { shopId } = useParams<{ shopId: string }>();

  const [shop, setShop] = useState<ShopDoc | null>(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [objects, setObjects] = useState<StoreObjectDoc[]>([]);
  const [placements, setPlacements] = useState<PlacementDoc[]>([]);
  const [stickers, setStickers] = useState<StickerDoc[]>([]);
  const [stickerPlacements, setStickerPlacements] = useState<StickerPlacementDoc[]>([]);
  const [manualOpen, setManualOpen] = useState(false);

  // 視線ジェスチャーの状態: 今注視している対象(レティクル表示用)と、
  // 「決定」ジェスチャーで開いた詳細パネルの対象
  const [gazedObjectId, setGazedObjectId] = useState<string | null>(null);
  const [focusedObjectId, setFocusedObjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) {
      setShopLoading(false);
      return;
    }
    setShopLoading(true);
    getShop(shopId).then((s) => {
      setShop(s);
      setShopLoading(false);
    });
    const unsubObjects = subscribeObjects(shopId, setObjects);
    const unsubPlacements = subscribePlacements(shopId, setPlacements);
    const unsubStickers = subscribeStickers(shopId, setStickers);
    const unsubStickerPlacements = subscribeStickerPlacements(shopId, setStickerPlacements);
    return () => {
      unsubObjects();
      unsubPlacements();
      unsubStickers();
      unsubStickerPlacements();
    };
  }, [shopId]);

  if (!firebaseEnabled) {
    return (
      <div className="store-landing">
        <h1>Firebase未設定です</h1>
        <p>.envにFirebaseの設定値を入力してから再度お試しください。</p>
      </div>
    );
  }

  if (shopLoading) {
    return <div className="store-landing">読み込み中…</div>;
  }

  if (!shop) {
    return (
      <div className="store-landing">
        <h1>お店が見つかりませんでした</h1>
        <p>
          URLをご確認いただくか、<Link to="/">TOPページ</Link>からお探しください。
        </p>
      </div>
    );
  }

  // アカウント管理の「一般公開・直接URLアクセスを許可する」設定。
  // オフの場合はURLを直接知っていても閲覧できないようにする
  // （店舗オーナー自身によるプレビューの特別扱いは未実装）。
  if (!shop.isPublic) {
    return (
      <div className="store-landing">
        <h1>このお店は現在非公開です</h1>
        <p>
          店舗オーナーが一般公開を許可していません。<Link to="/">TOPページ</Link>へ戻る
        </p>
      </div>
    );
  }

  const focusedObject = objects.find((o) => o.id === focusedObjectId) ?? null;

  const shelfContent = (side: 'left' | 'right') => (
    <>
      <PlacedObjects placements={placements} objects={objects} surface={side} />
      <StickerObjects placements={stickerPlacements} stickers={stickers} surface={side} />
    </>
  );

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative' }}>
      {/* 画面上部 情報バー */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          padding: '8px 16px',
          borderRadius: '8px',
          color: '#fff',
          fontSize: '14px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <strong style={{ color: '#60a5fa' }}>{shop.name}</strong>
        <span style={{ color: '#6b7280' }}>|</span>
        <Link
          to="/"
          style={{ color: '#93c5fd', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}
        >
          ← TOPへ戻る
        </Link>
      </div>

      <Canvas
        shadows
        // 初期カメラ位置: X=0, Y=1.6m, Z=0.5m
        camera={{ position: [0, 1.6, 0.5], fov: 75, near: 0.01, far: 10 }}
      >
        <XR store={store}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.3} />

            {/* 部屋・正面の板・照明・棚を描画 */}
            <StoreRoom leftShelfChildren={shelfContent('left')} rightShelfChildren={shelfContent('right')}>
              {/* 奥の壁（ワールド座標） */}
              <PlacedObjects placements={placements} objects={objects} surface="wall" />
              <StickerObjects placements={stickerPlacements} stickers={stickers} surface="wall" />
            </StoreRoom>

            <Environment preset="apartment" />

            <GazeController
              enabled={!focusedObjectId}
              onGazeChange={setGazedObjectId}
              onConfirm={setFocusedObjectId}
              onCancel={() => setFocusedObjectId(null)}
            />

            {/* --- 非VR時のドラッグ回転・スクロール拡大操作 --- */}
            <DesktopOrbitControls />
          </Suspense>
        </XR>
      </Canvas>

      {/* レティクル: 何かを注視している間だけ強調表示するだけのシンプルな照準 */}
      <div className={`gaze-reticle ${gazedObjectId ? 'is-active' : ''}`} />

      {focusedObject && (
        <div className="gaze-detail-panel">
          <div className="color-dot" style={{ backgroundColor: focusedObject.color }} />
          <div>
            <div className="gaze-detail-name">{focusedObject.name}</div>
            <div className="gaze-detail-size">
              {focusedObject.sizeCm.w}×{focusedObject.sizeCm.h}×{focusedObject.sizeCm.d} cm
            </div>
          </div>
          <div className="gaze-detail-hint">横に素早く見ると閉じます</div>
        </div>
      )}

      {/* 画面下部: マニュアル（展開パネル）と入店ボタン */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 'min(560px, calc(100vw - 32px))',
        }}
      >
        <ManualPanel id="vr-manual-panel" open={manualOpen} onClose={() => setManualOpen(false)}>
          {/* TODO: マニュアルの内容が決まったらここに記述する */}
          <p style={{ margin: 0 }}>ここにマニュアルの内容が入ります。</p>
        </ManualPanel>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setManualOpen((v) => !v)}
            aria-expanded={manualOpen}
            aria-controls="vr-manual-panel"
            style={manualButtonStyle(manualOpen)}
          >
            マニュアル
          </button>
          <button onClick={() => store.enterVR()} style={vrButtonStyle}>
            VRで入店する
          </button>
        </div>
      </div>
    </div>
  );
}
