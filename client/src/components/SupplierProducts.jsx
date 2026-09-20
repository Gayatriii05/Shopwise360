import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../api/client';
import { SkeletonTable } from './Skeleton';
import EmptyState from './EmptyState';
import DataTable from './DataTable';
import { PlusIcon, TrashIcon, CheckCircleIcon, AlertCircleIcon } from './Icons';
import { Button } from './ui/button';
import { EASE } from '../lib/motion';

const imgFallback = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect width="100%25" height="100%25" fill="%23F3EFE7"/%3E%3Ctext x="50%25" y="50%25" fill="%23A89D8E" font-size="10" font-family="sans-serif" font-weight="600" text-anchor="middle"%3Eno img%3C/text%3E%3C/svg%3E';

const fieldClass =
  'w-full rounded-xl border border-input bg-input/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all hover:border-primary/30 focus-visible:border-primary focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-primary/25';

const labelClass = 'label-micro mb-1.5';

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-foreground sm:text-lg">Product Catalog</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Add, configure, and maintain products offered to retailers</p>
        </div>

        <Button
          type="button"
          onClick={() => (form ? setForm(null) : resetForm())}
          variant={form ? 'outline' : 'default'}
          size="lg"
          className="gap-1.5 rounded-xl text-xs font-bold"
        >
          {form ? 'Cancel' : (
            <>
              <PlusIcon className="size-3.5" />
              Add Product
            </>
          )}
        </Button>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className={`flex items-center gap-2 rounded-2xl border p-4 text-xs font-medium sm:text-sm ${
            message.includes('✅')
              ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-700'
              : 'border-orange-400/40 bg-orange-500/12 text-orange-700'
          }`}
        >
          {message.includes('✅') ? (
            <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-emerald-500" />
          ) : (
            <AlertCircleIcon className="h-4 w-4 flex-shrink-0 text-orange-500" />
          )}
          <span>{message.replace(/^[✅❌]\s*/, '')}</span>
        </motion.div>
      )}

      {form && (
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          onSubmit={submit}
          className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8"
        >
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="border-b border-border pb-3">
            <h3 className="text-sm font-extrabold text-foreground">New Product Details</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Fill in the specifications for this new catalog item</p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className={labelClass}>Product Name *</label>
              <input
                required
                placeholder="e.g. Organic Arabica Coffee Beans"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass}>Category *</label>
              <select
                required
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className={`${fieldClass} cursor-pointer`}
              >
                <option value="" disabled>Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Product highlights, specifications, or packaging info..."
                className={`${fieldClass} resize-none`}
              />
            </div>

            <div>
              <label className={labelClass}>Cost Price (₹) *</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass}>Sale Price (₹) *</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.sale_price}
                onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                className={fieldClass}
              />
              {margin !== null && (
                <p className="mt-1 text-[11px] font-semibold text-emerald-400">
                  Estimated Unit Gross Margin: ₹{margin}
                </p>
              )}
            </div>

            <div className="pt-2 md:col-span-2">
              <label className={`${labelClass} mt-2`}>
                Product Image
                <span className="ml-1.5 font-normal normal-case text-muted-foreground">— JPG, PNG, or WebP up to 2MB</span>
              </label>
              <div className="flex items-center gap-4">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-muted/40">
                  {preview ? (
                    <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-muted-foreground">preview</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                    className="file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-primary/15 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-primary file:transition-colors hover:file:bg-primary/25 cursor-pointer text-xs text-muted-foreground"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setForm(null)}
              className="rounded-xl px-4 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              size="lg"
              className="gap-2 rounded-xl px-6 text-xs font-bold"
            >
              {submitting ? 'Uploading Product…' : 'Create Product'}
            </Button>
          </div>
        </motion.form>
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
        <DataTable
          rows={products}
          rowKey={(p) => p.id}
          searchable
          searchKeys={['name', 'category', 'description']}
          searchPlaceholder="Search catalog…"
          pageSize={8}
          columns={[
            {
              key: 'image',
              header: 'Product',
              render: (p) => (
                <div className="flex items-center gap-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/40">
                    <img
                      src={p.image_url || imgFallback}
                      alt={p.name}
                      className="h-full w-full object-cover"
                      onError={(e) => { e.currentTarget.src = imgFallback; }}
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate font-bold text-foreground">{p.name}</span>
                    {p.description && (
                      <span className="block max-w-xs truncate text-[11px] text-muted-foreground">{p.description}</span>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'category',
              header: 'Category',
              sortable: true,
              render: (p) => (
                <span className="inline-block rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {p.category || 'General'}
                </span>
              ),
            },
            {
              key: 'cost_price',
              header: 'Cost Price',
              align: 'right',
              sortable: true,
              sortValue: (p) => Number(p.cost_price) || 0,
              render: (p) => (
                <span className="mono-num text-xs font-bold tabular-nums text-muted-foreground">
                  ₹{p.cost_price}
                </span>
              ),
            },
            {
              key: 'sale_price',
              header: 'Sale Price',
              align: 'right',
              sortable: true,
              sortValue: (p) => Number(p.sale_price) || 0,
              render: (p) => (
                <span className="mono-num text-xs font-bold tabular-nums text-primary">
                  ₹{p.sale_price}
                </span>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (p) => (
                <button
                  type="button"
                  onClick={() => removeProduct(p.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-coral-400/40 bg-coral-500/12 px-3 py-1.5 text-xs font-bold text-coral-700 transition-all hover:bg-coral-500/20 hover:text-coral-800"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}