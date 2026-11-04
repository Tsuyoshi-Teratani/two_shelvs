import type { DragEvent } from 'react';
import { STICKER_DRAG_MIME } from './ShelfEditorScene';
import type { StickerDoc } from '../types';

interface Props {
  sticker: StickerDoc;
}

export default function StickerListItem({ sticker }: Props) {
  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(STICKER_DRAG_MIME, JSON.stringify({ stickerId: sticker.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="object-card" draggable onDragStart={handleDragStart}>
      <img className="sticker-thumb" src={sticker.imageUrl} alt={sticker.name} />
      <div className="object-meta">
        <div className="object-name">{sticker.name}</div>
        <div className="object-size">{sticker.isFreehand ? '手描き' : '画像'}</div>
      </div>
    </div>
  );
}
