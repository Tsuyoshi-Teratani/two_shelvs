import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import {
  subscribeObjects,
  subscribePlacements,
  savePlacement,
  deletePlacement,
  subscribeStickers,
  subscribeStickerPlacements,
  saveStickerPlacement,
  deleteStickerPlacement,
} from '../firebase';
import ShelfEditorScene from './ShelfEditorScene';
import ObjectListItem from './ObjectListItem';
import StickerListItem from './StickerListItem';
import type {
  PlacementDoc,
  StickerDoc,
  StickerPlacementDoc,
  StoreObjectDoc,
  Surface,
  Vec3,
} from '../types';

type Palette = 'objects' | 'stickers';

const SURFACE_TABS: { surface: Surface; label: string }[] = [
  { surface: 'wall', label: '壁' },
  { surface: 'left', label: '左本棚' },
  { surface: 'right', label: '右本棚' },
];

export default function ShelvesManager() {
  const shopId = useAuthStore((s) => s.shopId);
  const [objects, setObjects] = useState<StoreObjectDoc[]>([]);
  const [placements, setPlacements] = useState<PlacementDoc[]>([]);
  const [stickers, setStickers] = useState<StickerDoc[]>([]);
  const [stickerPlacements, setStickerPlacements] = useState<StickerPlacementDoc[]>([]);
  const [palette, setPalette] = useState<Palette>('objects');
  const [activeSurface, setActiveSurface] = useState<Surface>('wall');

  useEffect(() => {
    if (!shopId) return;
    const unsub1 = subscribeObjects(shopId, setObjects);
    const unsub2 = subscribePlacements(shopId, setPlacements);
    const unsub3 = subscribeStickers(shopId, setStickers);
    const unsub4 = subscribeStickerPlacements(shopId, setStickerPlacements);
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [shopId]);

  const placedObjectIds = new Set(placements.map((p) => p.objectId));
  const availableObjects = objects.filter((o) => !placedObjectIds.has(o.id));

  const handlePlaceObject = async (
    objectId: string,
    surface: Surface,
    compartmentIndex: number,
    position: Vec3
  ) => {
    if (!shopId) return;
    const placement: PlacementDoc = {
      id: `placement-${objectId}`,
      objectId,
      surface,
      compartmentIndex,
      position,
    };
    setPlacements((prev) => [...prev.filter((p) => p.objectId !== objectId), placement]);
    await savePlacement(shopId, placement);
  };

  const handleRemoveObject = async (objectId: string) => {
    if (!shopId) return;
    const existing = placements.find((p) => p.objectId === objectId);
    setPlacements((prev) => prev.filter((p) => p.objectId !== objectId));
    if (existing) await deletePlacement(shopId, existing.id);
  };

  const handlePlaceSticker = async (
    stickerId: string,
    surface: Surface,
    position: Vec3,
    widthM: number,
    heightM: number
  ) => {
    if (!shopId) return;
    const placement: StickerPlacementDoc = {
      id: `sticker-placement-${Date.now()}`,
      stickerId,
      surface,
      position,
      widthM,
      heightM,
    };
    setStickerPlacements((prev) => [...prev, placement]);
    await saveStickerPlacement(shopId, placement);
  };

  const handleRemoveSticker = async (placementId: string) => {
    if (!shopId) return;
    setStickerPlacements((prev) => prev.filter((p) => p.id !== placementId));
    await deleteStickerPlacement(shopId, placementId);
  };

  return (
    <div className="manager-page shelves-manager">
      <h1>棚管理</h1>
      <p className="manager-lead">
        編集する面（壁・左本棚・右本棚）を切り替え、カードをドラッグ&ドロップして配置します。配置済みのものはダブルクリックで取り外せます（編集中の面のみ）。
      </p>
      <div className="surface-tabs">
        {SURFACE_TABS.map(({ surface, label }) => {
          const count =
            placements.filter((p) => p.surface === surface).length +
            stickerPlacements.filter((p) => p.surface === surface).length;
          return (
            <button
              key={surface}
              className={activeSurface === surface ? 'surface-tab active' : 'surface-tab'}
              onClick={() => setActiveSurface(surface)}
            >
              {label}
              <span className="surface-tab-count">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="shelves-manager-body">
        <aside className="object-list">
          <div className="palette-tabs">
            <button
              className={palette === 'objects' ? 'palette-tab active' : 'palette-tab'}
              onClick={() => setPalette('objects')}
            >
              商品
            </button>
            <button
              className={palette === 'stickers' ? 'palette-tab active' : 'palette-tab'}
              onClick={() => setPalette('stickers')}
            >
              ステッカー
            </button>
          </div>

          {palette === 'objects' ? (
            <div className="object-list-scroll">
              {availableObjects.map((obj) => (
                <ObjectListItem key={obj.id} object={obj} />
              ))}
              {availableObjects.length === 0 && (
                <p className="object-list-empty">
                  {objects.length === 0
                    ? '商品管理から商品を登録してください'
                    : 'すべて配置済みです'}
                </p>
              )}
            </div>
          ) : (
            <div className="object-list-scroll">
              {stickers.map((sticker) => (
                <StickerListItem key={sticker.id} sticker={sticker} />
              ))}
              {stickers.length === 0 && (
                <p className="object-list-empty">ステッカー管理から登録してください</p>
              )}
            </div>
          )}
        </aside>
        <div className="shelf-editor-canvas">
          <ShelfEditorScene
            activeSurface={activeSurface}
            objects={objects}
            placements={placements}
            stickers={stickers}
            stickerPlacements={stickerPlacements}
            onPlaceObject={handlePlaceObject}
            onRemoveObject={handleRemoveObject}
            onPlaceSticker={handlePlaceSticker}
            onRemoveSticker={handleRemoveSticker}
          />
        </div>
      </div>
    </div>
  );
}
