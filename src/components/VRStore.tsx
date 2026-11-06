import { useState, useEffect, Suspense, type CSSProperties } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { XR, createXRStore, useXR } from '@react-three/xr';
import StoreRoom from './StoreRoom';
import PlacedObjects from './PlacedObjects';
import HeldObject from './HeldObject';
import StickerObjects from './StickerObjects';
import ManualPanel from './ManualPanel';
import SafeEnvironment from './SafeEnvironment';
import { useGazeGesture } from '../hooks/useGazeGesture';
import { describeFirebaseError } from '../utils/firebaseError';
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
 * ドラッグ（左・右どちらでも）で視点を回転、スクロール/ピンチで拡大縮小。
 * クリックで商品を手元に取る操作と両立するよう、ほぼ動かさないクリックはドラッグ扱いにしない。
 * VRセッション中、および商品を手元に持っている間（ドラッグは商品の回転に使う）は無効化する。
 */
function DesktopOrbitControls({ holding }: { holding: boolean }) {
  const isPresenting = useXR((state) => state.session != null);
  return (
    <OrbitControls
      enabled={!isPresenting && !holding}
      enablePan={false} // 平行移動を許すと部屋の外に出られてしまうため無効
      target={[0, 1.5, 0.8]} // 注視点（正面の板の方向）
      enableDamping={true} // 操作時のスムーズな減衰（慣性）
      dampingFactor={0.05}
      minDistance={0.1} // 拡大の限界（近づきすぎ防止）
      maxDistance={1.2} // 縮小の限界（部屋の外に出ないよう制限）
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
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

const backButtonStyle: CSSProperties = {
  position: 'absolute',
  top: 72,
  left: 16,
  zIndex: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 18px',
  borderRadius: 8,
  border: '1px solid rgba(255, 255, 255, 0.3)',
  background: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(8px)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 'bold',
  cursor: 'pointer',
};

export default function VRStore() {
  const { shopId } = useParams<{ shopId: string }>();

  const [shop, setShop] = useState<ShopDoc | null>(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [objects, setObjects] = useState<StoreObjectDoc[]>([]);
  const [placements, setPlacements] = useState<PlacementDoc[]>([]);
  const [stickers, setStickers] = useState<StickerDoc[]>([]);
  const [stickerPlacements, setStickerPlacements] = useState<StickerPlacementDoc[]>([]);
  const [manualOpen, setManualOpen] = useState(false);

  // 今注視している対象（レティクル表示用）
  const [gazedObjectId, setGazedObjectId] = useState<string | null>(null);
  // 手元に持って拡大表示している商品。returning=trueの間は棚へ戻るアニメーション中
  const [heldId, setHeldId] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);

  /** 商品を手元に取る（クリック、または視線ジェスチャーの「決定」）。すでに持っている間は何もしない */
  const pick = (objectId: string) => {
    if (heldId) return;
    setHeldId(objectId);
    setReturning(false);
  };
  /** 棚に戻す（戻るボタン、Escキー、または視線ジェスチャーの「キャンセル」） */
  const putBack = () => {
    if (heldId && !returning) setReturning(true);
  };
  /** 戻るアニメーションが終わったら手元表示を終了する */
  const handleReturned = () => {
    setHeldId(null);
    setReturning(false);
  };

  // Escキーでも棚に戻せる（PC）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') putBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    if (!shopId) {
      setShopLoading(false);
      return;
    }
    setShopLoading(true);
    setLoadError(null);
    getShop(shopId)
      .then((s) => {
        setShop(s);
        setShopLoading(false);
      })
      .catch((e) => {
        console.error('店舗情報の取得に失敗しました', e);
        setLoadError(describeFirebaseError(e));
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

  if (loadError) {
    return (
      <div className="store-landing">
        <h1>読み込みに失敗しました</h1>
        <p>{loadError}</p>
      </div>
    );
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

  const heldObject = objects.find((o) => o.id === heldId) ?? null;

  const shelfContent = (side: 'left' | 'right') => (
    <>
      <PlacedObjects
        placements={placements}
        objects={objects}
        surface={side}
        onPick={pick}
        hiddenObjectId={heldId}
      />
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
              <PlacedObjects
                placements={placements}
                objects={objects}
                surface="wall"
                onPick={pick}
                hiddenObjectId={heldId}
              />
              <StickerObjects placements={stickerPlacements} stickers={stickers} surface="wall" />
            </StoreRoom>

            <SafeEnvironment />

            {/* 手元に持って拡大表示している商品（ドラッグで回転） */}
            {heldObject && (
              <HeldObject key={heldObject.id} obj={heldObject} returning={returning} onReturned={handleReturned} />
            )}

            {/* 視線ジェスチャー: 縦に素早く1往復=手元に取る / 横に素早く1往復=棚に戻す */}
            <GazeController
              enabled={true}
              onGazeChange={setGazedObjectId}
              onConfirm={pick}
              onCancel={putBack}
            />

            {/* --- 視点のドラッグ回転・スクロール拡大操作（手元表示中は無効） --- */}
            <DesktopOrbitControls holding={heldId !== null} />
          </Suspense>
        </XR>
      </Canvas>

      {/* レティクル: 何かを注視している間だけ強調表示するだけのシンプルな照準 */}
      <div className={`gaze-reticle ${gazedObjectId ? 'is-active' : ''}`} />

      {heldObject && (
        <>
          {/* 戻るボタン: 押すと商品が棚の元の位置に戻る */}
          <button onClick={putBack} aria-label="棚に戻す" disabled={returning} style={backButtonStyle}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>←</span>
            <span>棚に戻す</span>
          </button>

          <div className="gaze-detail-panel">
            <div className="color-dot" style={{ backgroundColor: heldObject.color }} />
            <div>
              <div className="gaze-detail-name">{heldObject.name}</div>
              <div className="gaze-detail-size">
                {heldObject.sizeCm.w}×{heldObject.sizeCm.h}×{heldObject.sizeCm.d} cm
              </div>
            </div>
            <div className="gaze-detail-hint">ドラッグで回転 ／ ← で棚に戻す</div>
          </div>
        </>
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
