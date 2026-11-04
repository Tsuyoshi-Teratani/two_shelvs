import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

interface Props {
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

const CANVAS_SIZE = 320;

/** マウス/タッチでのフリーハンド描画でステッカーを作るための簡易お絵描きパッド */
export default function FreehandDrawPad({ onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [color, setColor] = useState('#2b2f38');
  const [lineWidth, setLineWidth] = useState(4);

  const getContext = () => canvasRef.current?.getContext('2d') ?? null;

  const toCanvasPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const ctx = getContext();
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const { x, y } = toCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const ctx = getContext();
    if (!ctx) return;
    const { x, y } = toCanvasPoint(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob);
    }, 'image/png');
  };

  return (
    <div className="crop-modal-backdrop">
      <div className="crop-modal">
        <h2>フリーハンドで描く</h2>
        <p className="crop-modal-hint">背景は透明なまま保存されます。壁や棚にPOPとして貼り付けられます。</p>
        <div className="draw-toolbar">
          <label>
            色
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <label>
            太さ
            <input
              type="range"
              min={1}
              max={16}
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
            />
          </label>
          <button type="button" className="secondary" onClick={handleClear}>
            クリア
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="draw-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
        <div className="crop-modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" onClick={handleConfirm}>
            この絵を使う
          </button>
        </div>
      </div>
    </div>
  );
}
