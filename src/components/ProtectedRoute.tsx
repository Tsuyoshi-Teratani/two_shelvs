import type { ReactNode } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import Auth from './Auth';

interface Props {
  children: ReactNode;
}

/**
 * /admin 以下を保護する認証ガード。
 * 未ログインならAuth（ログイン画面）を表示し、ログイン済みならchildrenを描画する。
 */
export default function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return <div className="admin-loading">読み込み中…</div>;
  }

  if (!user) {
    return <Auth />;
  }

  return <>{children}</>;
}
