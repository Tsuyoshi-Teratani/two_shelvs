import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Top from './components/Top';
import VRStore from './components/VRStore';
import Regist from './components/Regist';
import ErrorPage from './components/ErrorPage';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import ShelvesManager from './components/ShelvesManager';
import ObjectsManager from './components/ObjectsManager';
import StickerManager from './components/StickerManager';
import AccountManager from './components/AccountManager';
import ErrorBoundary, { errorMessage } from './components/ErrorBoundary';
import { useAuthStore } from './store/useAuthStore';

function AppRoutes() {
  const location = useLocation();

  return (
    // ページを移動したらエラー表示をリセットする（key=パス）
    <ErrorBoundary
      key={location.pathname}
      fallback={(error) => (
        <div className="store-landing">
          <h1>表示中にエラーが発生しました</h1>
          <p className="auth-error">{errorMessage(error)}</p>
          <p>ブラウザのコンソール(F12)に詳細が出ています。</p>
          <p>
            <a href="/">TOPへ戻る</a>
          </p>
        </div>
      )}
    >
      <Routes>
        <Route path="/" element={<Top />} />
        <Route path="/store/:shopId" element={<VRStore />} />
        <Route path="/regist" element={<Regist />} />
        <Route path="/error" element={<ErrorPage />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="shelves" replace />} />
          <Route path="shelves" element={<ShelvesManager />} />
          <Route path="objects" element={<ObjectsManager />} />
          <Route path="stickers" element={<StickerManager />} />
          <Route path="account" element={<AccountManager />} />
        </Route>

        <Route path="*" element={<Navigate to="/error" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  const start = useAuthStore((s) => s.start);

  useEffect(() => {
    start();
  }, [start]);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
