import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { subscribeObjects, saveObject, deleteObjectDoc, uploadAsset } from '../firebase';
import ImageCropModal from './ImageCropModal';
import type { BookTextures, ObjectKind, StoreObjectDoc } from '../types';
import { MAX_OBJECT_SIZE_CM } from '../Size';

function randomColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 65%, 55%)`;
}

// 本のテクスチャのトリミング設定（縦横比・出力ピクセルサイズ）
const BOOK_SLOTS = {
  cover: { label: '表紙', aspect: 0.7, outputWidth: 420, outputHeight: 600 },
  spine: { label: '背表紙', aspect: 0.18, outputWidth: 120, outputHeight: 600 },
  back: { label: '裏表紙', aspect: 0.7, outputWidth: 420, outputHeight: 600 },
} as const;
type BookSlot = keyof typeof BOOK_SLOTS;

export default function ObjectsManager() {
  const shopId = useAuthStore((s) => s.shopId);
  const [objects, setObjects] = useState<StoreObjectDoc[]>([]);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<ObjectKind>('book');
  const [color, setColor] = useState(randomColor());
  const [w, setW] = useState(15);
  const [h, setH] = useState(20);
  const [d, setD] = useState(4);
  const [category, setCategory] = useState('');

  const [gltfFile, setGltfFile] = useState<File | null>(null);
  const [bookBlobs, setBookBlobs] = useState<Partial<Record<BookSlot, Blob>>>({});
  const [bookPreviewUrls, setBookPreviewUrls] = useState<Partial<Record<BookSlot, string>>>({});
  const [cropTarget, setCropTarget] = useState<{ slot: BookSlot; file: File } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRefs = useRef<Partial<Record<BookSlot, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (!shopId) return;
    return subscribeObjects(shopId, setObjects);
  }, [shopId]);

  const resetForm = () => {
    setName('');
    setColor(randomColor());
    setW(15);
    setH(20);
    setD(4);
    setCategory('');
    setGltfFile(null);
    setBookBlobs({});
    setBookPreviewUrls((prev) => {
      Object.values(prev).forEach((url) => url && URL.revokeObjectURL(url));
      return {};
    });
  };

  const handleBookFileSelected = (slot: BookSlot, file: File | undefined) => {
    if (!file) return;
    setCropTarget({ slot, file });
  };

  const handleCropConfirm = (blob: Blob) => {
    if (!cropTarget) return;
    const { slot } = cropTarget;
    setBookBlobs((prev) => ({ ...prev, [slot]: blob }));
    setBookPreviewUrls((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot]!);
      return { ...prev, [slot]: URL.createObjectURL(blob) };
    });
    setCropTarget(null);
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!shopId || !name.trim()) return;
    setError(null);

    if (kind === 'gltf' && !gltfFile) {
      setError('雑貨として登録するにはGLTF/GLBファイルを選択してください。');
      return;
    }
    if (kind === 'book' && (!bookBlobs.cover || !bookBlobs.spine || !bookBlobs.back)) {
      setError('本として登録するには表紙・背表紙・裏表紙の3枚すべてを選択してください。');
      return;
    }

    setSubmitting(true);
    try {
      const id = `obj-${Date.now()}`;
      let gltfUrl: string | undefined;
      let bookTextures: BookTextures | undefined;

      if (kind === 'gltf' && gltfFile) {
        const ext = gltfFile.name.toLowerCase().endsWith('.gltf') ? 'gltf' : 'glb';
        gltfUrl = await uploadAsset(`shops/${shopId}/objects/${id}/model.${ext}`, gltfFile);
      }

      if (kind === 'book' && bookBlobs.cover && bookBlobs.spine && bookBlobs.back) {
        const [coverUrl, spineUrl, backUrl] = await Promise.all([
          uploadAsset(`shops/${shopId}/objects/${id}/cover.png`, bookBlobs.cover),
          uploadAsset(`shops/${shopId}/objects/${id}/spine.png`, bookBlobs.spine),
          uploadAsset(`shops/${shopId}/objects/${id}/back.png`, bookBlobs.back),
        ]);
        bookTextures = { coverUrl, spineUrl, backUrl };
      }

      // Firestoreはフィールドにundefinedをセットできないため、
      // 値がある項目だけをスプレッドでマージする
      const obj: StoreObjectDoc = {
        id,
        name: name.trim(),
        kind,
        color,
        sizeCm: { w, h, d },
        createdAt: Date.now(),
        ...(category.trim() ? { category: category.trim() } : {}),
        ...(gltfUrl ? { gltfUrl } : {}),
        ...(bookTextures ? { bookTextures } : {}),
      };
      await saveObject(shopId, obj);
      resetForm();
    } catch (err) {
      setError('登録に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (objectId: string) => {
    if (!shopId) return;
    await deleteObjectDoc(shopId, objectId);
  };

  return (
    <div className="manager-page">
      <h1>商品管理</h1>
      <p className="manager-lead">
        棚に置ける商品を登録します。雑貨はGLTFモデル、本は表紙・背表紙・裏表紙の画像を使います（サイズは
        {MAX_OBJECT_SIZE_CM}cm以下を目安にしてください）。
      </p>

      <form className="object-form object-form-grid" onSubmit={handleAdd}>
        <label>
          名前
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <div className="kind-switch">
          <label>
            <input
              type="radio"
              name="kind"
              checked={kind === 'book'}
              onChange={() => setKind('book')}
            />
            本（画像テクスチャ）
          </label>
          <label>
            <input
              type="radio"
              name="kind"
              checked={kind === 'gltf'}
              onChange={() => setKind('gltf')}
            />
            雑貨（GLTFモデル）
          </label>
        </div>

        <label>
          カテゴリ（任意）
          <input value={category} onChange={(e) => setCategory(e.target.value)} />
        </label>
        <label>
          一覧用の色
          <input type="color" value={colorToHex(color)} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label>
          幅(cm)
          <input type="number" min={1} max={MAX_OBJECT_SIZE_CM} value={w} onChange={(e) => setW(Number(e.target.value))} />
        </label>
        <label>
          高さ(cm)
          <input type="number" min={1} max={MAX_OBJECT_SIZE_CM} value={h} onChange={(e) => setH(Number(e.target.value))} />
        </label>
        <label>
          奥行き(cm)
          <input type="number" min={1} max={MAX_OBJECT_SIZE_CM} value={d} onChange={(e) => setD(Number(e.target.value))} />
        </label>

        {kind === 'gltf' ? (
          <label className="file-field">
            GLTF/GLBファイル
            <input
              type="file"
              accept=".gltf,.glb"
              onChange={(e) => setGltfFile(e.target.files?.[0] ?? null)}
            />
            {gltfFile && <span className="file-field-name">{gltfFile.name}</span>}
          </label>
        ) : (
          <div className="book-texture-fields">
            {(Object.keys(BOOK_SLOTS) as BookSlot[]).map((slot) => (
              <div key={slot} className="book-texture-field">
                <span>{BOOK_SLOTS[slot].label}</span>
                {bookPreviewUrls[slot] ? (
                  <img src={bookPreviewUrls[slot]} alt={BOOK_SLOTS[slot].label} className="book-texture-preview" />
                ) : (
                  <div className="book-texture-placeholder">未選択</div>
                )}
                <input
                  ref={(el) => {
                    fileInputRefs.current[slot] = el;
                  }}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    handleBookFileSelected(slot, e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <button type="button" className="secondary" onClick={() => fileInputRefs.current[slot]?.click()}>
                  画像を選択
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'アップロード中…' : '追加'}
        </button>
      </form>

      {cropTarget && (
        <ImageCropModal
          file={cropTarget.file}
          title={`${BOOK_SLOTS[cropTarget.slot].label}をトリミング`}
          aspect={BOOK_SLOTS[cropTarget.slot].aspect}
          outputWidth={BOOK_SLOTS[cropTarget.slot].outputWidth}
          outputHeight={BOOK_SLOTS[cropTarget.slot].outputHeight}
          onCancel={() => setCropTarget(null)}
          onConfirm={handleCropConfirm}
        />
      )}

      <table className="object-table">
        <thead>
          <tr>
            <th></th>
            <th>名前</th>
            <th>種別</th>
            <th>カテゴリ</th>
            <th>サイズ(cm)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {objects.map((obj) => (
            <tr key={obj.id}>
              <td>
                <span className="color-dot" style={{ backgroundColor: obj.color }} />
              </td>
              <td>{obj.name}</td>
              <td>{obj.kind === 'gltf' ? '雑貨' : '本'}</td>
              <td>{obj.category ?? '-'}</td>
              <td>
                {obj.sizeCm.w}×{obj.sizeCm.h}×{obj.sizeCm.d}
              </td>
              <td>
                <button className="link-button" onClick={() => handleDelete(obj.id)}>
                  削除
                </button>
              </td>
            </tr>
          ))}
          {objects.length === 0 && (
            <tr>
              <td colSpan={6} className="manager-empty">
                まだ商品が登録されていません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// <input type="color">はhex値しか受け付けないため、hsl()文字列から簡易変換する
function colorToHex(color: string): string {
  if (color.startsWith('#')) return color;
  const el = document.createElement('div');
  el.style.color = color;
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color;
  document.body.removeChild(el);
  const match = rgb.match(/\d+/g);
  if (!match) return '#999999';
  const [r, g, b] = match.map(Number);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
