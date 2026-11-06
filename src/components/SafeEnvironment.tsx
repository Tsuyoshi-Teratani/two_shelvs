import { Suspense } from 'react';
import { Environment } from '@react-three/drei';
import ErrorBoundary from './ErrorBoundary';

/**
 * 環境マップ(preset)は外部のCDNから画像を取得するため、ネットワーク制限下では失敗する。
 * 失敗しても部屋の表示を止めず、代わりに半球ライトで明るさを補う。
 * 読み込み中も部屋は先に表示される（Suspenseを分離している）。
 */
export default function SafeEnvironment() {
  return (
    <ErrorBoundary fallback={<hemisphereLight args={['#ffffff', '#666666', 0.9]} />}>
      <Suspense fallback={null}>
        <Environment preset="apartment" />
      </Suspense>
    </ErrorBoundary>
  );
}
