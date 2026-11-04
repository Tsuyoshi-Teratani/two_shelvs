import { useEffect, useState } from 'react';
import Header from './Header';
import Footer from './Footer';
import DoorCard from './DoorCard';
import { firebaseEnabled, listPublicShops } from '../firebase';
import type { ShopDoc } from '../types';

const DISPLAY_COUNT = 12; // PCで横4列×縦3段

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Top() {
  const [shops, setShops] = useState<ShopDoc[] | null>(null);

  useEffect(() => {
    if (!firebaseEnabled) {
      setShops([]);
      return;
    }
    listPublicShops().then((all) => {
      setShops(shuffle(all).slice(0, DISPLAY_COUNT));
    });
  }, []);

  return (
    <div className="top-page">
      <Header />
      <main className="top-main">
        <h1 className="top-title">気になるお店の扉を開けてみましょう</h1>
        {!firebaseEnabled && (
          <p className="top-empty">Firebaseが未設定のため、店舗一覧を表示できません。</p>
        )}
        {firebaseEnabled && shops === null && <p className="top-empty">読み込み中…</p>}
        {firebaseEnabled && shops !== null && shops.length === 0 && (
          <p className="top-empty">公開されているお店がまだありません。</p>
        )}
        {shops && shops.length > 0 && (
          <div className="door-grid">
            {shops.map((shop) => (
              <DoorCard key={shop.id} shop={shop} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
