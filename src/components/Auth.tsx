import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { loginShop, firebaseEnabled } from '../firebase';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginShop(email, password);
      // ログイン成功後はuseAuthStoreが自動更新され、ProtectedRouteが管理画面を表示する
    } catch (err) {
      setError('ログインに失敗しました。メールアドレスとパスワードを確認してください。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>店舗管理ログイン</h1>
        {!firebaseEnabled && (
          <p className="auth-warning">
            Firebaseが未設定です。.envを設定するまでログインできません。
          </p>
        )}
        <label>
          メールアドレス
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          パスワード
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={submitting || !firebaseEnabled}>
          {submitting ? 'ログイン中…' : 'ログイン'}
        </button>
        <p className="auth-footer">
          店舗アカウントをお持ちでない場合は <Link to="/regist">新規登録</Link>
        </p>
      </form>
    </div>
  );
}
