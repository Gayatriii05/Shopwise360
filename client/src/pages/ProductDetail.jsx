import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Stars, StarInput } from '../components/StarRating';
import EmptyState from '../components/EmptyState';

const imgFallback = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="400"%3E%3Crect width="100%25" height="100%25" fill="%23f1f5f9"/%3E%3Ctext x="50%25" y="50%25" fill="%2394a3b8" font-size="18" font-family="sans-serif" text-anchor="middle"%3ENo image%3C/text%3E%3C/svg%3E';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wishlisted, setWishlisted] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/products/${id}`);
      setProduct(data);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (user?.role !== 'customer') return;
    api.get('/wishlist/mine').then(({ data }) => {
      setWishlisted(data.some((w) => w.product_id === Number(id)));
    }).catch(() => {});
  }, [user, id]);

  const toggleWishlist = async () => {
    try {
      if (wishlisted) {
        await api.delete(`/wishlist/${id}`);
        setWishlisted(false);
      } else {
        await api.post('/wishlist', { product_id: Number(id) });
        setWishlisted(true);
      }
    } catch (err) {
      if (err.response?.status === 401) navigate('/login');
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    setReviewMsg('');
    try {
      await api.post(`/products/${id}/reviews`, { rating: reviewRating, comment: reviewComment });
      setReviewComment('');
      setReviewMsg('Review submitted. Thank you!');
      load();
    } catch (err) {
      setReviewMsg(err.response?.data?.error || 'Failed to submit review');
    }
  };

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-64 bg-slate-200 rounded" /><div className="h-6 bg-slate-200 rounded w-1/2" /><div className="h-4 bg-slate-200 rounded w-full" /></div>;
  if (loadError) return <div className="p-8 text-center text-slate-500">{loadError}</div>;
  if (!product) return null;

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-emerald-600 hover:underline">← Back to shop</Link>

      <div className="grid md:grid-cols-2 gap-6 bg-white border rounded p-6">
        <div>
          <img
            src={product.image_url || imgFallback}
            alt={product.name}
            className="w-full h-72 object-cover rounded-lg"
            onError={(e) => { e.currentTarget.src = imgFallback; }}
          />
        </div>
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-slate-800">{product.name}</h1>
          <p className="text-sm text-slate-400">{product.category} · Sold by {product.supplier || '—'}</p>
          <div className="flex items-center gap-2">
            <Stars rating={product.rating} />
            <span className="text-sm text-slate-500">({product.review_count} reviews)</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600">₹{product.sale_price}</p>
          <p className="text-sm text-slate-600">{product.description}</p>
          {user?.role === 'customer' && (
            <button
              onClick={toggleWishlist}
              className={`px-4 py-2 rounded border text-sm ${
                wishlisted ? 'bg-rose-50 text-rose-600 border-rose-200' : 'hover:bg-slate-100 border-slate-300'
              }`}
            >
              {wishlisted ? '♥ In wishlist' : '♡ Add to wishlist'}
            </button>
          )}
        </div>
      </div>

      <section className="bg-white border rounded p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Customer Reviews</h2>
        </div>

        {user?.role === 'customer' && (
          <form onSubmit={submitReview} className="mb-6 p-4 bg-slate-50 rounded border">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Rate this product</h3>
            <StarInput value={reviewRating} onChange={setReviewRating} />
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Share your experience (optional)"
              className="mt-3 w-full border rounded px-3 py-2 text-sm"
              rows={3}
            />
            <div className="mt-2 flex items-center gap-3">
              <button type="submit" className="bg-slate-900 text-white text-sm px-4 py-2 rounded hover:bg-slate-800">
                Submit review
              </button>
              {reviewMsg && <span className={`text-sm ${reviewMsg.startsWith('Review submitted') ? 'text-emerald-600' : 'text-red-500'}`}>{reviewMsg}</span>}
            </div>
          </form>
        )}

        {!product.reviews?.length ? (
          <EmptyState icon="💬" title="No reviews yet" message="Be the first to share your experience." />
        ) : (
          <ul className="space-y-4">
            {product.reviews.map((r) => (
              <li key={r.id} className="border-b last:border-0 pb-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-slate-700">{r.customer_name}</span>
                  <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <Stars rating={r.rating} size="text-sm" />
                {r.comment && <p className="text-sm text-slate-600 mt-1">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}