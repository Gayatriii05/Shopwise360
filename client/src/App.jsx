import { Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ProductDetail from './pages/ProductDetail';
import CustomerDashboard from './pages/CustomerDashboard';
import RetailerDashboard from './pages/RetailerDashboard';
import SupplierDashboard from './pages/SupplierDashboard';
import AdminDashboard from './pages/AdminDashboard';

function NotFound() {
  return (
    <div className="text-center py-20">
      <h1 className="text-5xl font-bold text-slate-300 mb-4">404</h1>
      <p className="text-slate-500 mb-6">That page doesn't exist on ShopWise 360.</p>
      <Link to="/" className="text-emerald-600 hover:underline">← Back to shop</Link>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto p-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route
            path="/dashboard/customer"
            element={<ProtectedRoute allowedRoles={['customer']}><CustomerDashboard /></ProtectedRoute>}
          />
          <Route
            path="/dashboard/retailer"
            element={<ProtectedRoute allowedRoles={['retailer']}><RetailerDashboard /></ProtectedRoute>}
          />
          <Route
            path="/dashboard/supplier"
            element={<ProtectedRoute allowedRoles={['supplier']}><SupplierDashboard /></ProtectedRoute>}
          />
          <Route
            path="/dashboard/admin"
            element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}