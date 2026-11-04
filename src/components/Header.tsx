import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="site-header">
      <Link to="/" className="site-logo">
        ThoShelfsShop
      </Link>
      <nav className="site-header-nav">
        <Link to="/admin" className="header-button secondary">
          ログイン
        </Link>
        <Link to="/regist" className="header-button">
          新規登録
        </Link>
      </nav>
    </header>
  );
}
