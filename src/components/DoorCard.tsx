import { useNavigate } from 'react-router-dom';
import type { ShopDoc } from '../types';

interface Props {
  shop: ShopDoc;
}

export default function DoorCard({ shop }: Props) {
  const navigate = useNavigate();

  return (
    <button className="door-card" onClick={() => navigate(`/store/${shop.id}`)}>
      {shop.doorImageUrl ? (
        <img src={shop.doorImageUrl} alt={`${shop.name}の扉`} className="door-card-image" />
      ) : (
        <DefaultDoor />
      )}
      <span className="door-card-name">{shop.name}</span>
    </button>
  );
}

/** 扉デザインが未設定の店舗用のデフォルトのドア画像(SVG) */
function DefaultDoor() {
  return (
    <svg viewBox="0 0 120 180" className="door-card-image" role="img" aria-label="扉">
      <rect x="4" y="4" width="112" height="172" rx="4" fill="#8a5a33" stroke="#5c3a1f" strokeWidth="4" />
      <rect x="14" y="14" width="92" height="152" rx="2" fill="#a8703f" />
      <circle cx="96" cy="92" r="5" fill="#f1e3d0" />
    </svg>
  );
}
