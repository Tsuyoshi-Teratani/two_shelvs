// Firestoreに保存するデータの型定義。
// shopId は「店舗オーナーのuid」をそのまま使う（1ユーザー=1店舗）。
//
// Firestore構成:
//   shops/{shopId}                               : ShopDoc
//   shops/{shopId}/objects/{objectId}             : StoreObjectDoc
//   shops/{shopId}/placements/{placementId}       : PlacementDoc
//   shops/{shopId}/stickers/{stickerId}           : StickerDoc
//   shops/{shopId}/stickerPlacements/{placementId}: StickerPlacementDoc

/** オブジェクト・ステッカーを置ける面: 正面の壁 / 左の棚 / 右の棚 */
export type Surface = 'wall' | 'left' | 'right';

export interface ShopDoc {
  id: string; // = ownerUid
  ownerUid: string;
  name: string;
  description: string;
  /** TOPページのランダム表示・直接アクセスを許可するか */
  isPublic: boolean;
  /** 未設定ならデフォルトのドアデザインを使う */
  doorImageUrl?: string;
  createdAt: number;
}

export interface SizeCm {
  w: number;
  h: number;
  d: number;
}

export type ObjectKind = 'gltf' | 'book';

/** 本オブジェクトの表紙・背表紙・裏表紙テクスチャ（矩形トリミング済み画像のURL） */
export interface BookTextures {
  coverUrl: string;
  spineUrl: string;
  backUrl: string;
}

export interface StoreObjectDoc {
  id: string;
  name: string;
  kind: ObjectKind;
  /** 一覧のスウォッチ表示・GLTF読み込み中のプレースホルダ色に使用 */
  color: string;
  sizeCm: SizeCm;
  category?: string;
  /** kind === 'gltf' のとき必須。Firebase StorageのダウンロードURL */
  gltfUrl?: string;
  /** kind === 'book' のとき必須 */
  bookTextures?: BookTextures;
  createdAt: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlacementDoc {
  id: string;
  objectId: string;
  surface: Surface;
  /** 棚(left/right)のときは段番号(0=最下段)。壁(wall)のときは常に0で未使用 */
  compartmentIndex: number;
  /**
   * 座標系はsurfaceによって異なる:
   * - left/right: その棚のローカル原点（床・幅中央・奥行き中央）からの相対座標(m)
   * - wall: 部屋のワールド座標そのもの(m)
   */
  position: Vec3;
}

export interface StickerDoc {
  id: string;
  name: string;
  /** アップロード画像 or 手描きをPNG化したもののURL */
  imageUrl: string;
  isFreehand: boolean;
  createdAt: number;
}

export interface StickerPlacementDoc {
  id: string;
  stickerId: string;
  surface: Surface;
  /** PlacementDoc.positionと同じ座標系のルール（surfaceにより意味が異なる） */
  position: Vec3;
  widthM: number;
  heightM: number;
}
