import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const dashboardPath = user ? `/dashboard/${user.role}` : '/login';

  return (
    <nav className="bg-slate-900 text-white px-6 py-3 flex justify-between items-center">
      <Link to="/" className="font-bold text-lg">ShopWise 360</Link>
      <div className="flex items-center gap-4 text-sm">
        {user ? (
          <>
            <span className="text-slate-300">Hi, {user.name} ({user.role})</span>
            <Link to={dashboardPath} className="hover:text-emerald-400">Dashboard</Link>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:text-emerald-400">Login</Link>
            <Link to="/register" className="hover:text-emerald-400">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
