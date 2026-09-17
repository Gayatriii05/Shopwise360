import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Stars, StarInput } from '../components/StarRating';
import EmptyState from '../components/EmptyState';
import { FadeIn, Stagger, StaggerItem } from '../components/Reveal';
import { ArrowLeftIcon, HeartIcon, StoreIcon, ShieldIcon, CheckCircleIcon, AlertCircleIcon } from '../components/Icons';

const imgFallback = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="400"%3E%3Crect width="100%25" height="100%25" fill="%23F0EDFA"/%3E%3Ctext x="50%25" y="50%25" fill="%23786F97" font-size="16" font-family="sans-serif" font-weight="600" text-anchor="middle"%3ENo image available%3C/text%3E%3C/svg%3E';

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
  const [submittingReview, setSubmittingReview] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/products/${id}`);
      setProduct(data);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (user?.role !== 'customer') return;
    api.get('/wishlist/mine')
      .then(({ data }) => { setWishlisted(data.some((w) => w.product_id === Number(id))); })
      .catch(() => {});
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
    setSubmittingReview(true);
    try {
      await api.post(`/products/${id}/reviews`, { rating: reviewRating, comment: reviewComment });
      setReviewComment('');
      setReviewMsg('Review submitted. Thank you!');
      await load();
    } catch (err) {
      setReviewMsg(err.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-32 rounded shimmer-wave bg-cream-200" />
        <div className="grid md:grid-cols-2 gap-8 glass-card rounded-2xl p-6 sm:p-8">
          <div className="h-80 sm:h-96 rounded-2xl shimmer-wave bg-cream-200" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 rounded-xl shimmer-wave bg-cream-200" />
            <div className="h-4 w-1/3 rounded shimmer-wave bg-cream-200" />
            <div className="h-6 w-28 rounded-lg shimmer-wave bg-cream-200" />
            <div className="h-24 w-full rounded-xl shimmer-wave bg-cream-200" />
            <div className="h-10 w-40 rounded-xl shimmer-wave bg-cream-200" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-16 text-center">
        <EmptyState
          icon="⚠️"
          title="Product Unavailable"
          message={loadError}
          action={
            <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-glow-brand hover:shadow-glow-brand hover:-translate-y-0.5">
              <ArrowLeftIcon className="w-3.5 h-3.5" />
              Return to Catalog
            </Link>
          }
        />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="space-y-8">
      <FadeIn>
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-cream-500 hover:text-violet-700 transition-colors">
          <ArrowLeftIcon className="w-3.5 h-3.5" />
          <span>Back to Marketplace</span>
        </Link>
      </FadeIn>

      <FadeIn>
        <div className="grid md:grid-cols-2 gap-8 glass-card rounded-2xl border border-cream-300/70 p-6 sm:p-8 lg:p-10 shadow-elevated">
          {/* Image */}
          <div className="relative rounded-2xl overflow-hidden bg-cream-200 border border-cream-300/70 flex items-center justify-center min-h-[300px] sm:min-h-[400px]">
            <img
              src={product.image_url || imgFallback}
              alt={product.name}
              className="w-full h-full object-cover max-h-[460px]"
              onError={(e) => { e.currentTarget.src = imgFallback; }}
            />
            {product.category && (
              <span className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold bg-cream-50/80  text-cream-900 shadow-subtle border border-cream-300/70">
                {product.category}
              </span>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">
                  {product.category || 'General'}
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-cream-900 tracking-tight mt-1">
                  {product.name}
                </h1>
                {product.supplier && (
                  <p className="text-xs text-cream-500 mt-1 flex items-center gap-1.5">
                    <StoreIcon className="w-3.5 h-3.5 text-cream-400" />
                    <span>Supplied by <strong className="text-cream-800">{product.supplier}</strong></span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 py-2 border-y border-cream-300/70">
                <Stars rating={product.rating} size="text-sm" />
                <span className="text-xs font-medium text-cream-500">
                  ({product.review_count || 0} customer {product.review_count === 1 ? 'review' : 'reviews'})
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-violet-700">₹</span>
                <span className="text-3xl sm:text-4xl font-extrabold text-cream-900 tracking-tight">
                  {Number(product.sale_price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-cream-500 mb-1">
                  Description
                </h3>
                <p className="text-sm text-cream-600 leading-relaxed">
                  {product.description || 'No detailed description available for this product.'}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-cream-300/70 space-y-4">
              {user?.role === 'customer' && (
                <button
                  type="button"
                  onClick={toggleWishlist}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold transition-all shadow-subtle hover:-translate-y-0.5 ${
                    wishlisted
                      ? 'bg-coral-50 text-coral-700 border border-coral-200 hover:bg-coral-100'
                      : 'bg-cream-50 text-cream-700 border border-cream-300/70 hover:bg-cream-100'
                  }`}
                >
                  <HeartIcon filled={wishlisted} className={`w-4 h-4 ${wishlisted ? 'text-coral-600' : 'text-cream-400 hover:text-coral-500'}`} />
                  <span>{wishlisted ? 'Saved in your Wishlist' : 'Add to Wishlist'}</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-cream-600">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-violet-600 flex-shrink-0" />
                  <span>Verified Stock Checked</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Genuine Supplier Guaranteed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn>
        <section className="glass-card rounded-2xl border border-cream-300/70 p-6 sm:p-8 lg:p-10 space-y-6 shadow-elevated">
          <div className="flex items-center justify-between border-b border-cream-300/70 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-cream-900 tracking-tight">
                Customer Reviews & Ratings
              </h2>
              <p className="text-xs text-cream-500 mt-0.5">
                Feedback from verified buyers of this product
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-cream-900">{Number(product.rating || 0).toFixed(1)}</span>
              <span className="text-xs text-cream-400">/ 5.0</span>
            </div>
          </div>

          {user?.role === 'customer' && (
            <form onSubmit={submitReview} className="bg-cream-50 border border-cream-300/70 rounded-2xl p-5 sm:p-6 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-cream-800 mb-2">
                  Share Your Experience
                </h3>
                <p className="text-xs text-cream-500 mb-3">
                  Rate your purchase and help fellow shoppers make informed decisions.
                </p>
                <StarInput value={reviewRating} onChange={setReviewRating} />
              </div>

              <div>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Write your review here (optional)..."
                  rows={3}
                  className="w-full bg-cream-50 border border-cream-300 rounded-xl p-3 text-sm text-cream-800 placeholder-cream-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-glow-brand hover:shadow-glow-brand hover:-translate-y-0.5 transition-all disabled:opacity-50"
                >
                  {submittingReview ? 'Submitting…' : 'Submit Review'}
                </button>
                {reviewMsg && (
                  <div className={`text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                    reviewMsg.startsWith('Review submitted')
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-coral-50 text-coral-700 border border-coral-200'
                  }`}>
                    {reviewMsg.startsWith('Review submitted') ? (
                      <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircleIcon className="w-3.5 h-3.5 text-coral-600" />
                    )}
                    <span>{reviewMsg}</span>
                  </div>
                )}
              </div>
            </form>
          )}

          {!product.reviews?.length ? (
            <EmptyState
              icon="💬"
              title="No reviews yet"
              message="Be the first verified customer to share your thoughts on this item."
            />
          ) : (
            <Stagger className="space-y-4 divide-y divide-cream-300/60">
              {product.reviews.map((r) => (
                <StaggerItem key={r.id} className="pt-4 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-cream-100 border border-cream-300/70 flex items-center justify-center text-cream-600 font-bold text-xs">
                        {r.customer_name ? r.customer_name.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-cream-900 block">
                          {r.customer_name || 'Verified Customer'}
                        </span>
                        <Stars rating={r.rating} size="text-[11px]" />
                      </div>
                    </div>
                    <span className="text-[11px] text-cream-400 font-medium">
                      {new Date(r.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-xs sm:text-sm text-cream-600 pl-10 leading-relaxed">
                      {r.comment}
                    </p>
                  )}
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </section>
      </FadeIn>
    </div>
  );
}