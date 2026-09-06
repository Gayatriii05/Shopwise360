import { useEffect, useState } from 'react';
import api from '../api/client';
import { SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const imgFallback = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect width="100%25" height="100%25" fill="%23f1f5f9"/%3E%3Ctext x="50%25" y="50%25" fill="%2394a3b8" font-size="10" font-family="sans-serif" text-anchor="middle"%3Eno img%3C/text%3E%3C/svg%3E';

export default function SupplierProducts({ supplierId }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/products', { params: { supplier_id: supplierId, limit: 100, sort: 'newest' } });
      setProducts(data.products);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supplierId) loadProducts();
  }, [supplierId]);

  useEffect(() => {
    api.get('/products/categories').then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  const resetForm = () => {
    setForm({ name: '', description: '', category_id: '', cost_price: '', sale_price: '' });
    setPreview('');
  };

  const handleFile = (file) => {
    if (!file) { setPreview(''); return; }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description);
      fd.append('category_id', form.category_id);
      fd.append('cost_price', form.cost_price);
      fd.append('sale_price', form.sale_price);
      fd.append('supplier_id', supplierId);
      const fileInput = e.target.querySelector('input[type=file]');
      if (fileInput?.files?.[0]) fd.append('image', fileInput.files[0]);
      await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMessage('✅ Product created successfully');
      resetForm();
      await loadProducts();
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Failed to create product'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const removeProduct = async (id) => {
    if (!window.confirm('Delete this product permanently?')) return;
    try {
      await api.delete(`/products/${id}`);
      await loadProducts();
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Failed to delete product'}`);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-700">Manage Products</h3>
        <button
          onClick={() => (form ? resetForm() : setForm({ name: '', description: '', category_id: '', cost_price: '', sale_price: '' }))}
          className="bg-slate-900 text-white text-xs px-3 py-2 rounded hover:bg-slate-800"
        >
          {form ? 'Cancel' : '+ Add product'}
        </button>
      </div>

      {message && <div className="mb-3 p-3 rounded text-sm bg-slate-50 border border-slate-200">{message}</div>}

      {form && (
        <form onSubmit={submit} className="bg-white border rounded-lg p-4 mb-6 grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Product name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Category *</label>
            <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full border rounded px-3 py-2 text-sm bg-white">
              <option value="" disabled>Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Cost price (₹) *</label>
            <input required type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Sale price (₹) *</label>
            <input required type="number" min="0" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Product image</label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                {preview ? <img src={preview} alt="Preview" className="h-full w-full object-cover" /> : <span className="text-[9px] text-slate-300">preview</span>}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="text-sm text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-slate-100 file:text-slate-700 file:text-xs"
              />
              <span className="text-[10px] text-slate-400">JPG/PNG/WebP, max 2MB</span>
            </div>
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={submitting} className="bg-emerald-600 text-white px-4 py-2 rounded text-sm hover:bg-emerald-700 disabled:opacity-50">
              {submitting ? 'Uploading...' : 'Create product'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : products.length === 0 ? (
        <EmptyState icon="🏷️" title="No products yet" message="Add your first product to start selling on ShopWise 360." />
      ) : (
        <table className="w-full text-sm bg-white border rounded">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Image</th>
              <th className="p-2 text-left">Product</th>
              <th className="p-2 text-left">Category</th>
              <th className="p-2 text-left">Cost</th>
              <th className="p-2 text-left">Price</th>
              <th className="p-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">
                  <img src={p.image_url || imgFallback} alt={p.name} className="h-10 w-10 object-cover rounded" onError={(e) => { e.currentTarget.src = imgFallback; }} />
                </td>
                <td className="p-2">{p.name}</td>
                <td className="p-2">{p.category || '—'}</td>
                <td className="p-2">₹{p.cost_price}</td>
                <td className="p-2">₹{p.sale_price}</td>
                <td className="p-2">
                  <button onClick={() => removeProduct(p.id)} className="text-red-500 text-xs hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}