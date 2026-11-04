import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

interface Props {
  file: File;
  /** 出力画像の幅/高さ比（例: 表紙=0.7, 背表紙=0.12） */
  aspect: number;
  outputWidth: number;
  outputHeight: number;
  title: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_PREVIEW_WIDTH = 420;
const MAX_PREVIEW_HEIGHT = 420;

/**
 * アップロードされた画像から矩形を選択し、その範囲を出力サイズいっぱいに
 * 拡大縮小して書き出すシンプルなトリミングツール。
 * 矩形はドラッグで移動、右下のハンドルでリサイズできる（縦横比は固定）。
 */
export default function ImageCropModal({
  file,
  aspect,
  outputWidth,
  outputHeight,
  title,
  onCancel,
  onConfirm,
}: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [displayScale, setDisplayScale] = useState(1);
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, width: 100, height: 100 });
  const imgRef = useRef<HTMLImageElement>(null);
  const dragState = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; rect: Rect } | null>(
    null
  );

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const scale = Math.min(MAX_PREVIEW_WIDTH / nw, MAX_PREVIEW_HEIGHT / nh, 1);
    setNaturalSize({ width: nw, height: nh });
    setDisplayScale(scale);

    const dispW = nw * scale;
    const dispH = nh * scale;
    // 表示範囲に収まる最大サイズで、指定の縦横比を保った初期矩形を中央に置く
    let w = dispW;
    let h = w / aspect;
    if (h > dispH) {
      h = dispH;
      w = h * aspect;
    }
    setRect({ x: (dispW - w) / 2, y: (dispH - h) / 2, width: w, height: h });
  };

  const dispW = naturalSize.width * displayScale;
  const dispH = naturalSize.height * displayScale;

  const clampRect = (r: Rect): Rect => {
    const width = Math.min(Math.max(r.width, 20), dispW);
    const height = width / aspect;
    const x = Math.min(Math.max(r.x, 0), Math.max(0, dispW - width));
    const y = Math.min(Math.max(r.y, 0), Math.max(0, dispH - height));
    return { x, y, width, height };
  };

  const handlePointerDown = (mode: 'move' | 'resize') => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { mode, startX: e.clientX, startY: e.clientY, rect };
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    const drag = dragState.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (drag.mode === 'move') {
      setRect(clampRect({ ...drag.rect, x: drag.rect.x + dx, y: drag.rect.y + dy }));
    } else {
      const newWidth = drag.rect.width + dx;
      setRect(clampRect({ ...drag.rect, width: newWidth }));
    }
  };

  const handlePointerUp = () => {
    dragState.current = null;
  };

  const handleConfirm = () => {
    if (!imgRef.current) return;
    const sx = rect.x / displayScale;
    const sy = rect.y / displayScale;
    const sw = rect.width / displayScale;
    const sh = rect.height / displayScale;

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob);
    }, 'image/png');
  };

  return (
    <div className="crop-modal-backdrop">
      <div className="crop-modal">
        <h2>{title}</h2>
        <p className="crop-modal-hint">
          枠をドラッグして位置を調整、右下の丸いハンドルでサイズを調整してください。選択した範囲が表示枠いっぱいに拡大縮小されます。
        </p>
        {imageUrl && (
          <div
            className="crop-stage"
            style={{ width: dispW || MAX_PREVIEW_WIDTH, height: dispH || MAX_PREVIEW_HEIGHT }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img ref={imgRef} src={imageUrl} onLoad={handleImgLoad} className="crop-stage-image" draggable={false} />
            {dispW > 0 && (
              <div
                className="crop-rect"
                style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
                onPointerDown={handlePointerDown('move')}
              >
                <div className="crop-handle" onPointerDown={handlePointerDown('resize')} />
              </div>
            )}
          </div>
        )}
        <div className="crop-modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" onClick={handleConfirm} disabled={!imageUrl}>
            この範囲を使う
          </button>
        </div>
      </div>
    </div>
  );
}
