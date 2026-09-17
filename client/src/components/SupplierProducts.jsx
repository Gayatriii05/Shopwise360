import { useEffect, useState } from 'react';
import api from '../api/client';
import { SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { PlusIcon, TrashIcon, CheckCircleIcon, AlertCircleIcon } from '../components/Icons';

const imgFallback = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect width="100%25" height="100%25" fill="%23E1DDF0"/%3E%3Ctext x="50%25" y="50%25" fill="%23786F97" font-size="10" font-family="sans-serif" font-weight="600" text-anchor="middle"%3Eno img%3C/text%3E%3C/svg%3E';

const inputClass =
  'w-full bg-cream-50 hover:bg-cream-50 border border-cream-300 hover:border-cream-400 rounded-xl px-3.5 py-2.5 text-sm text-cream-800 placeholder-cream-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all';

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
    if (!window.confirm('Delete this product permanently from the catalog?')) return;
    try {
      await api.delete(`/products/${id}`);
      await loadProducts();
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Failed to delete product'}`);
    }
  };

  const margin = form && form.sale_price && form.cost_price ? (Number(form.sale_price) - Number(form.cost_price)).toFixed(2) : null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-cream-900 text-base sm:text-lg">Product Catalog</h2>
          <p className="text-xs text-cream-500">Add, configure, and maintain products offered to retailers</p>
        </div>

        <button
          type="button"
          onClick={() => (form ? setForm(null) : setForm({ name: '', description: '', category_id: '', cost_price: '', sale_price: '' }))}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-subtle ${
            form
              ? 'bg-cream-100 hover:bg-cream-200 text-cream-700 border border-cream-300/70'
              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-glow-brand hover:shadow-glow-brand hover:-translate-y-0.5'
          }`}
        >
          {form ? 'Cancel' : '+ Add Product'}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-center gap-2 ${
          message.includes('✅')
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-coral-50 text-coral-700 border border-coral-200'
        }`}>
          {message.includes('✅') ? (
            <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircleIcon className="w-4 h-4 text-coral-600 flex-shrink-0" />
          )}
          <span>{message}</span>
        </div>
      )}

      {form && (
        <form
          onSubmit={submit}
          className="glass-card rounded-2xl p-6 sm:p-8 space-y-6 animate-fadeIn"
        >
          <div className="border-b border-cream-300/70 pb-3">
            <h3 className="font-extrabold text-sm text-cream-900">New Product Details</h3>
            <p className="text-xs text-cream-500">Fill in the specifications for this new catalog item</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-cream-600 uppercase tracking-wider mb-1.5">
                Product Name *
              </label>
              <input
                required
                placeholder="e.g. Organic Arabica Coffee Beans"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-cream-600 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <select
                required
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="" disabled>Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-cream-600 uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Product highlights, specifications, or packaging info..."
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-cream-600 uppercase tracking-wider mb-1.5">
                Cost Price (₹) *
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-cream-600 uppercase tracking-wider mb-1.5">
                Sale Price (₹) *
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.sale_price}
                onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                className={inputClass}
              />
              {margin !== null && (
                <p className="text-[11px] font-semibold text-emerald-600 mt-1">
                  Estimated Unit Gross Margin: ₹{margin}
                </p>
              )}
            </div>

            <div className="md:col-span-2 pt-2 border-t border-cream-300/70">
              <label className="block text-xs font-bold text-cream-600 uppercase tracking-wider mb-2">
                Product Image
              </label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-2xl border border-cream-300/70 overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0">
                  {preview ? (
                    <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-cream-400">preview</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                    className="text-xs text-cream-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-cream-100 file:text-cream-700 file:font-semibold hover:file:bg-cream-200 cursor-pointer"
                  />
                  <p className="text-[10px] text-cream-400 mt-1">JPG, PNG, or WebP up to 2MB</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-cream-300/70">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-cream-500 hover:bg-cream-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-glow-brand hover:shadow-glow-brand hover:-translate-y-0.5 disabled:opacity-40"
            >
              {submitting ? 'Uploading Product…' : 'Create Product'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : products.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="No products listed yet"
          message="Click '+ Add Product' above to start stocking your supplier catalog."
        />
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-cream-100 border-b border-cream-300/70 text-cream-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5 sm:p-4">Image</th>
                  <th className="p-3.5 sm:p-4">Product Name</th>
                  <th className="p-3.5 sm:p-4">Category</th>
                  <th className="p-3.5 sm:p-4">Cost Price</th>
                  <th className="p-3.5 sm:p-4">Sale Price</th>
                  <th className="p-3.5 sm:p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-300/60 font-medium">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-cream-50 transition-colors">
                    <td className="p-3.5 sm:p-4">
                      <div className="w-12 h-12 rounded-xl bg-cream-200 overflow-hidden border border-cream-300/70">
                        <img
                          src={p.image_url || imgFallback}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.src = imgFallback; }}
                        />
                      </div>
                    </td>
                    <td className="p-3.5 sm:p-4">
                      <span className="font-bold text-cream-800 block">{p.name}</span>
                      {p.description && (
                        <span className="text-xs text-cream-500 line-clamp-1 max-w-xs">{p.description}</span>
                      )}
                    </td>
                    <td className="p-3.5 sm:p-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cream-100 text-cream-700 border border-cream-300/70">
                        {p.category || 'General'}
                      </span>
                    </td>
                    <td className="p-3.5 sm:p-4 font-mono font-bold text-cream-600">
                      ₹{p.cost_price}
                    </td>
                    <td className="p-3.5 sm:p-4 font-mono font-bold text-violet-700">
                      ₹{p.sale_price}
                    </td>
                    <td className="p-3.5 sm:p-4 text-right">
                      <button
                        type="button"
                        onClick={() => removeProduct(p.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-coral-700 hover:text-coral-600 bg-coral-50 hover:bg-coral-100 px-3 py-1.5 rounded-xl border border-coral-200 transition-all"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}