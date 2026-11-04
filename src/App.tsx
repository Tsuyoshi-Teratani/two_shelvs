import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { useAuthStore } from './store/useAuthStore';

export default function App() {
  const start = useAuthStore((s) => s.start);

  useEffect(() => {
    start();
  }, [start]);

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
