import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerShop, firebaseEnabled } from '../firebase';

export default function Regist() {
  const navigate = useNavigate();
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください。');
      return;
    }

    setSubmitting(true);
    try {
      await registerShop(email, password, shopName);
      navigate('/admin');
    } catch (err) {
      setError('登録に失敗しました。メールアドレスの形式やパスワードを確認してください。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>店舗登録</h1>
        <p className="auth-lead">
          登録すると、自分のお店専用の左右2つの棚を編集できるようになります。
        </p>
        {!firebaseEnabled && (
          <p className="auth-warning">
            Firebaseが未設定です。.envを設定するまで登録できません。
          </p>
        )}
        <label>
          店舗名
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="例）ふしぎ雑貨店"
            required
          />
        </label>
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
          パスワード（6文字以上）
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={submitting || !firebaseEnabled}>
          {submitting ? '登録中…' : '登録する'}
        </button>
        <p className="auth-footer">
          すでにアカウントをお持ちの場合は <Link to="/admin">管理画面へ</Link>
        </p>
      </form>
    </div>
  );
}
