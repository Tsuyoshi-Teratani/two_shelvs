import { useEffect, useState, type FormEvent } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { getShop, saveShop, uploadAsset } from '../firebase';
import type { ShopDoc } from '../types';

export default function AccountManager() {
  const shopId = useAuthStore((s) => s.shopId);
  const [shop, setShop] = useState<ShopDoc | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [doorFile, setDoorFile] = useState<File | null>(null);
  const [doorPreviewUrl, setDoorPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    getShop(shopId).then((s) => {
      if (s) {
        setShop(s);
        setName(s.name);
        setDescription(s.description);
        setIsPublic(s.isPublic);
      }
    });
  }, [shopId]);

  const handleDoorFileChange = (file: File | undefined) => {
    if (!file) return;
    setDoorFile(file);
    setDoorPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    setSaving(true);
    try {
      let doorImageUrl = shop?.doorImageUrl;
      if (doorFile) {
        doorImageUrl = await uploadAsset(`shops/${shopId}/door.png`, doorFile);
      }

      const updated: ShopDoc = {
        id: shopId,
        ownerUid: shopId,
        name,
        description,
        isPublic,
        createdAt: shop?.createdAt ?? Date.now(),
        ...(doorImageUrl ? { doorImageUrl } : {}),
      };
      await saveShop(updated);
      setShop(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = shopId ? `${window.location.origin}/store/${shopId}` : '';

  return (
    <div className="manager-page">
      <h1>アカウント管理</h1>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          店舗名
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          紹介文
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="お店のこだわりや取り扱う商品について書いてください"
          />
        </label>

        <label className="checkbox-field">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          TOPページでの一般公開・直接URLアクセスを許可する
        </label>

        <label className="file-field">
          扉（ドア）デザイン
          <input type="file" accept="image/*" onChange={(e) => handleDoorFileChange(e.target.files?.[0])} />
        </label>
        {(doorPreviewUrl || shop?.doorImageUrl) && (
          <img
            src={doorPreviewUrl ?? shop?.doorImageUrl}
            alt="扉デザインのプレビュー"
            className="door-preview"
          />
        )}

        <button type="submit" disabled={saving}>
          {saving ? '保存中…' : '保存する'}
        </button>
        {saved && <span className="settings-saved">保存しました</span>}
      </form>

      <div className="settings-public-url">
        <h2>公開URL</h2>
        <p>お客様にはこのURLを共有してください。スマートフォンのブラウザからそのままVR表示できます。</p>
        <code>{publicUrl}</code>
      </div>
    </div>
  );
}
