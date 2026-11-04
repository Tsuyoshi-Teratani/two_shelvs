import type { DragEvent } from 'react';
import { OBJECT_DRAG_MIME } from './ShelfEditorScene';
import type { StoreObjectDoc } from '../types';

interface Props {
  object: StoreObjectDoc;
}

export default function ObjectListItem({ object }: Props) {
  const { id, name, color, sizeCm } = object;

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(OBJECT_DRAG_MIME, JSON.stringify({ objectId: id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="object-card" draggable onDragStart={handleDragStart}>
      <div className="object-swatch" style={{ backgroundColor: color }} />
      <div className="object-meta">
        <div className="object-name">{name}</div>
        <div className="object-size">
          {sizeCm.w}×{sizeCm.h}×{sizeCm.d} cm
        </div>
      </div>
    </div>
  );
}
