import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await login(email, password);
      navigate(`/dashboard/${user.role}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-8 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6 text-slate-800">Login</h2>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2" required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2" required />
        <button type="submit" className="w-full bg-slate-900 text-white py-2 rounded hover:bg-slate-800">
          Login
        </button>
      </form>
      <p className="text-sm text-slate-500 mt-4">
        No account? <Link to="/register" className="text-emerald-600">Register</Link>
      </p>
      <div className="mt-6 text-xs text-slate-400 border-t pt-3">
        Demo logins (password: Password123):<br />
        admin@shopwise.com · retailer@shopwise.com · supplier@shopwise.com · customer@shopwise.com
      </div>
    </div>
  );
}
