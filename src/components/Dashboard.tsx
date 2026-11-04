import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../firebase';
import { useAuthStore } from '../store/useAuthStore';

const NAV_ITEMS = [
  { to: '/admin/shelves', label: '棚管理' },
  { to: '/admin/objects', label: 'オブジェクト管理' },
  { to: '/admin/stickers', label: 'ステッカー管理' },
  { to: '/admin/account', label: 'アカウント管理' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="dashboard-layout">
      <nav className="dashboard-nav">
        <div className="dashboard-brand">ThoShelfsShop</div>
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="dashboard-user">
          <span>{user?.displayName ?? user?.email}</span>
          <button onClick={handleLogout}>ログアウト</button>
        </div>
      </nav>
      <div className="dashboard-content">
        <Outlet />
      </div>
    </div>
  );
}
