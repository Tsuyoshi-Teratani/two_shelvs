// Firebase連携レイヤー。
// Auth: メール/パスワードでの店舗オーナー登録・ログイン
// Firestore構成:
//   shops/{shopId}                         : ShopDoc  (shopId = ownerUid)
//   shops/{shopId}/objects/{objectId}       : StoreObjectDoc
//   shops/{shopId}/placements/{placementId} : PlacementDoc
//
// 公開ページ(VRStore, "/")はshopIdだけで shops/{shopId}/objects, /placements を
// 読み取り専用で参照する。Firestoreセキュリティルールでは
//   - shops/{shopId} 以下の読み取りは全員許可
//   - 書き込みは request.auth.uid == shopId の場合のみ許可
// という設定を想定している（ルール自体は別途 firestore.rules で管理してください）。

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type {
  PlacementDoc,
  ShopDoc,
  StickerDoc,
  StickerPlacementDoc,
  StoreObjectDoc,
} from './types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const app = firebaseEnabled ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;

// --- Storage (GLTFファイル・本のテクスチャ・ステッカー画像のアップロード) ---

/** 任意のファイル/Blobをアップロードし、ダウンロードURLを返す */
export async function uploadAsset(path: string, data: Blob | File): Promise<string> {
  if (!storage) throw new Error('Firebaseが設定されていません（.envを確認してください）');
  const assetRef = ref(storage, path);
  await uploadBytes(assetRef, data);
  return getDownloadURL(assetRef);
}

// --- Auth ---

export function subscribeAuth(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function registerShop(email: string, password: string, shopName: string) {
  if (!auth || !db) throw new Error('Firebaseが設定されていません（.envを確認してください）');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: shopName });

  const shop: ShopDoc = {
    id: cred.user.uid,
    ownerUid: cred.user.uid,
    name: shopName,
    description: '',
    isPublic: true,
    createdAt: Date.now(),
  };
  await setDoc(doc(db, 'shops', cred.user.uid), { ...shop, createdAt: serverTimestamp() });
  return cred.user;
}

export async function loginShop(email: string, password: string) {
  if (!auth) throw new Error('Firebaseが設定されていません（.envを確認してください）');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  if (!auth) return;
  await signOut(auth);
}

// --- Shop ---

export async function getShop(shopId: string): Promise<ShopDoc | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'shops', shopId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ShopDoc) : null;
}

export async function saveShop(shop: ShopDoc) {
  if (!db) return;
  await setDoc(doc(db, 'shops', shop.id), shop, { merge: true });
}

/**
 * TOPページ用: 公開設定(isPublic)の店舗をまとめて取得する。
 * Firestoreは「ランダムな順序」のクエリを直接サポートしないため、
 * ある程度まとめて取得してからクライアント側でシャッフルする簡易実装にしている。
 * 店舗数が多くなった場合はランダムなフィールドを別途持たせてレンジクエリする等の
 * 対応に切り替えることを検討してください。
 */
export async function listPublicShops(fetchCount = 60): Promise<ShopDoc[]> {
  if (!db) return [];
  const q = query(collection(db, 'shops'), where('isPublic', '==', true), limit(fetchCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ShopDoc);
}

// --- Objects (商品/本のマスタ) ---

export async function saveObject(shopId: string, obj: StoreObjectDoc) {
  if (!db) return;
  await setDoc(doc(collection(db, 'shops', shopId, 'objects'), obj.id), obj);
}

export async function deleteObjectDoc(shopId: string, objectId: string) {
  if (!db) return;
  await deleteDoc(doc(collection(db, 'shops', shopId, 'objects'), objectId));
}

export function subscribeObjects(shopId: string, onChange: (objects: StoreObjectDoc[]) => void) {
  if (!db) {
    onChange([]);
    return () => {};
  }
  return onSnapshot(collection(db, 'shops', shopId, 'objects'), (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StoreObjectDoc));
  });
}

// --- Placements (棚への配置情報) ---

export async function savePlacement(shopId: string, placement: PlacementDoc) {
  if (!db) return;
  await setDoc(doc(collection(db, 'shops', shopId, 'placements'), placement.id), placement);
}

export async function deletePlacement(shopId: string, placementId: string) {
  if (!db) return;
  await deleteDoc(doc(collection(db, 'shops', shopId, 'placements'), placementId));
}

export function subscribePlacements(
  shopId: string,
  onChange: (placements: PlacementDoc[]) => void
) {
  if (!db) {
    onChange([]);
    return () => {};
  }
  return onSnapshot(collection(db, 'shops', shopId, 'placements'), (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlacementDoc));
  });
}

// --- Stickers (POP/ステッカーのマスタ) ---

export async function saveSticker(shopId: string, sticker: StickerDoc) {
  if (!db) return;
  await setDoc(doc(collection(db, 'shops', shopId, 'stickers'), sticker.id), sticker);
}

export async function deleteSticker(shopId: string, stickerId: string) {
  if (!db) return;
  await deleteDoc(doc(collection(db, 'shops', shopId, 'stickers'), stickerId));
}

export function subscribeStickers(shopId: string, onChange: (stickers: StickerDoc[]) => void) {
  if (!db) {
    onChange([]);
    return () => {};
  }
  return onSnapshot(collection(db, 'shops', shopId, 'stickers'), (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StickerDoc));
  });
}

// --- StickerPlacements (壁・棚へのステッカーの貼り付け情報) ---

export async function saveStickerPlacement(shopId: string, placement: StickerPlacementDoc) {
  if (!db) return;
  await setDoc(doc(collection(db, 'shops', shopId, 'stickerPlacements'), placement.id), placement);
}

export async function deleteStickerPlacement(shopId: string, placementId: string) {
  if (!db) return;
  await deleteDoc(doc(collection(db, 'shops', shopId, 'stickerPlacements'), placementId));
}

export function subscribeStickerPlacements(
  shopId: string,
  onChange: (placements: StickerPlacementDoc[]) => void
) {
  if (!db) {
    onChange([]);
    return () => {};
  }
  return onSnapshot(collection(db, 'shops', shopId, 'stickerPlacements'), (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StickerPlacementDoc));
  });
}
