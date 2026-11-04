import { useEffect, useState, type FormEvent } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { subscribeStickers, saveSticker, deleteSticker, uploadAsset } from '../firebase';
import FreehandDrawPad from './FreehandDrawPad';
import type { StickerDoc } from '../types';

export default function StickerManager() {
  const shopId = useAuthStore((s) => s.shopId);
  const [stickers, setStickers] = useState<StickerDoc[]>([]);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    return subscribeStickers(shopId, setStickers);
  }, [shopId]);

  const createSticker = async (name: string, imageUrl: string, isFreehand: boolean) => {
    if (!shopId) return;
    const sticker: StickerDoc = {
      id: `sticker-${Date.now()}`,
      name: name.trim() || (isFreehand ? '手描きステッカー' : '画像ステッカー'),
      imageUrl,
      isFreehand,
      createdAt: Date.now(),
    };
    await saveSticker(shopId, sticker);
  };

  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!shopId || !file) {
      setError('画像ファイルを選択してください。');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const id = `sticker-${Date.now()}`;
      const url = await uploadAsset(`shops/${shopId}/stickers/${id}.png`, file);
      await createSticker(name, url, false);
      setName('');
      setFile(null);
    } catch {
      setError('アップロードに失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFreehandConfirm = async (blob: Blob) => {
    if (!shopId) return;
    setDrawing(false);
    setSubmitting(true);
    try {
      const id = `sticker-${Date.now()}`;
      const url = await uploadAsset(`shops/${shopId}/stickers/${id}.png`, blob);
      await createSticker(name, url, true);
      setName('');
    } catch {
      setError('保存に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (stickerId: string) => {
    if (!shopId) return;
    await deleteSticker(shopId, stickerId);
  };

  return (
    <div className="manager-page">
      <h1>ステッカー管理</h1>
      <p className="manager-lead">
        正面の壁や棚に貼れるPOP/ステッカーを登録します。画像をアップロードするか、フリーハンドで描けます。
      </p>

      <form className="object-form" onSubmit={handleUploadSubmit}>
        <label>
          名前（任意）
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例）セール中" />
        </label>
        <label>
          画像ファイル
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={submitting || !file}>
          {submitting ? 'アップロード中…' : '画像から追加'}
        </button>
        <button type="button" className="secondary" onClick={() => setDrawing(true)} disabled={submitting}>
          フリーハンドで描く
        </button>
      </form>

      {drawing && <FreehandDrawPad onConfirm={handleFreehandConfirm} onCancel={() => setDrawing(false)} />}

      <div className="sticker-grid">
        {stickers.map((sticker) => (
          <div key={sticker.id} className="sticker-card">
            <img src={sticker.imageUrl} alt={sticker.name} />
            <div className="sticker-card-name">{sticker.name}</div>
            <button className="link-button" onClick={() => handleDelete(sticker.id)}>
              削除
            </button>
          </div>
        ))}
        {stickers.length === 0 && <p className="manager-empty">まだステッカーが登録されていません</p>}
      </div>
    </div>
  );
}
