import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Stars, StarInput } from '../components/StarRating';
import ProductCard from '../components/ProductCard';
import EmptyState from '../components/EmptyState';
import { TextGenerateEffect } from '../components/ui/text-generate-effect';
import { FadeIn, Stagger, StaggerItem } from '../components/Reveal';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/Skeleton';
import { StoreIcon, ShieldIcon, CheckCircleIcon, AlertCircleIcon } from '../components/Icons';

const imgFallback = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="450"%3E%3Crect width="100%25" height="100%25" fill="%23F3EFE7"/%3E%3Ctext x="50%25" y="50%25" fill="%23A89D8E" font-size="16" font-family="sans-serif" font-weight="600" text-anchor="middle"%3ENo image available%3C/text%3E%3C/svg%3E';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wishlisted, setWishlisted] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [related, setRelated] = useState([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/products/${id}`);
      setProduct(data);
      setRelated([]);
      if (data.category_id) {
        api.get('/products', { params: { category_id: data.category_id, limit: 5 } })
          .then(({ data: list }) => setRelated((list.products || []).filter((p) => p.id !== Number(id))))
          .catch(() => {});
      }
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

  const ratingBreakdown = useMemo(() => {
    if (!product?.reviews?.length) return [];
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    product.reviews.forEach((r) => { counts[r.rating] = (counts[r.rating] || 0) + 1; });
    const total = product.reviews.length;
    return [5, 4, 3, 2, 1].map((star) => ({ star, count: counts[star] || 0, pct: total ? (counts[star] || 0) / total * 100 : 0 }));
  }, [product]);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-5 w-36 rounded-lg" />
        <Card className="gap-0 py-0">
          <CardContent className="grid gap-0 p-0 md:grid-cols-2 md:gap-8 md:p-8">
            <div className="aspect-[4/3] md:aspect-auto h-full w-full">
              <Skeleton className="h-full w-full rounded-none md:rounded-xl" />
            </div>
            <div className="space-y-4 p-6">
              <Skeleton className="h-8 w-3/4 rounded-xl" />
              <Skeleton className="h-4 w-1/3 rounded-lg" />
              <Skeleton className="h-7 w-28 rounded-lg" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-10 w-44 rounded-xl" />
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0 p-6">
          <Skeleton className="h-6 w-56 rounded-lg" />
          <div className="mt-4 grid gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        </Card>
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
            <Button asChild className="rounded-xl text-xs">
              <Link to="/">
                Return to Catalog
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="space-y-8">
      <FadeIn>
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-primary">
          <Link to="/">
            Back to Marketplace
          </Link>
        </Button>
      </FadeIn>

      {/* ══ Main product panel ══ */}
      <FadeIn>
        <Card className="gap-0 overflow-hidden py-0 shadow-card-hover ring-border/70 lg:grid lg:grid-cols-2">
          {/* Image */}
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted lg:aspect-auto lg:h-full lg:min-h-[460px]">
            <img
              src={product.image_url || imgFallback}
              alt={product.name}
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => { e.currentTarget.src = imgFallback; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            {product.category && (
              <Badge variant="secondary" className="absolute left-4 top-4 rounded-full bg-background/85 text-foreground backdrop-blur-sm">
                {product.category}
              </Badge>
            )}
          </div>

          {/* Details */}
          <CardContent className="flex flex-col gap-6 p-6 sm:p-8 lg:p-10">
            <div className="space-y-4">
              <div>
                <span className="label-micro text-primary">{product.category || 'General'}</span>
                <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                  {product.name}
                </h1>
                {product.supplier && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <StoreIcon className="size-3.5 text-muted-foreground" />
                    <span>Supplied by <strong className="text-foreground">{product.supplier}</strong></span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 border-y border-border py-2.5">
                <Stars rating={product.rating} size="text-sm" />
                <span className="text-xs font-medium text-muted-foreground">
                  ({product.review_count || 0} customer {product.review_count === 1 ? 'review' : 'reviews'})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="text-sm font-bold text-primary">₹</span>
                <span className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  {Number(product.sale_price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {product.cost_price > 0 && product.cost_price > product.sale_price && (
                  <span className="text-sm font-medium text-muted-foreground line-through ml-1">
                    ₹{Number(product.cost_price).toLocaleString('en-IN')}
                  </span>
                )}
                {product.cost_price > product.sale_price && (
                  <Badge variant="outline" className="ml-3 rounded-full border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    Save {Math.round((1 - product.sale_price / product.cost_price) * 100)}%
                  </Badge>
                )}
              </div>

              <div>
                <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Description
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {product.description || 'No detailed description available for this product.'}
                </p>
              </div>
            </div>

            <div className="mt-auto space-y-4 border-t border-border pt-5">
              {user?.role === 'customer' && (
                <Button
                  type="button"
                  onClick={toggleWishlist}
                  variant={wishlisted ? 'secondary' : 'outline'}
                  className={`h-10 rounded-xl px-5 text-xs font-bold ${wishlisted ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20' : ''}`}
                >
                  <Heart className={`size-4 ${wishlisted ? 'fill-emerald-600 text-emerald-600' : 'text-muted-foreground'}`} />
                  <span>{wishlisted ? 'Saved in your Wishlist' : 'Add to Wishlist'}</span>
                </Button>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="size-4 flex-shrink-0 text-primary" />
                  <span>Verified Stock Checked</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldIcon className="size-4 flex-shrink-0 text-emerald-600" />
                  <span>Genuine Supplier Guaranteed</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* ══ Reviews ══ */}
      <FadeIn>
        <Card className="gap-0 overflow-hidden py-0 ring-border/70">
          <CardContent className="p-6 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
                  <TextGenerateEffect words="Customer Reviews & Ratings" className="text-lg font-extrabold tracking-tight text-foreground sm:text-xl" />
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Feedback from verified buyers of this product
                </p>
              </div>
              <div className="flex items-end gap-1.5">
                <span className="mono-num text-3xl font-black leading-none text-foreground">
                  {Number(product.rating || 0).toFixed(1)}
                </span>
                <span className="pb-0.5 text-xs text-muted-foreground">/ 5.0</span>
              </div>
            </div>

            {user?.role === 'customer' && (
              <form onSubmit={submitReview} className="mt-5 space-y-4 rounded-2xl border border-border bg-muted/40 p-5 sm:p-6">
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-foreground">Share Your Experience</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rate your purchase and help fellow shoppers make informed decisions.
                  </p>
                  <div className="mt-3">
                    <StarInput value={reviewRating} onChange={setReviewRating} />
                  </div>
                </div>

                <Textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Write your review here (optional)..."
                  rows={3}
                  className="rounded-xl bg-card"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    disabled={submittingReview}
                    className="rounded-xl text-xs font-bold"
                  >
                    {submittingReview ? 'Submitting…' : 'Submit Review'}
                  </Button>
                  {reviewMsg && (
                    <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      reviewMsg.startsWith('Review submitted')
                        ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700'
                        : 'border-orange-400/40 bg-orange-500/10 text-orange-700'
                    }`}>
                      {reviewMsg.startsWith('Review submitted') ? (
                        <CheckCircleIcon className="size-3.5 text-emerald-600" />
                      ) : (
                        <AlertCircleIcon className="size-3.5 text-orange-600" />
                      )}
                      <span>{reviewMsg}</span>
                    </div>
                  )}
                </div>
              </form>
            )}

            {/* Rating breakdown */}
            {product.reviews?.length > 0 && (
              <div className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-[auto_1fr] sm:items-start">
                <div className="flex items-center gap-1.5 pt-0.5">
                  <Stars rating={product.rating} size="text-sm" />
                  <span className="ml-1 text-xs font-semibold text-foreground">{product.review_count}</span>
                </div>
                <div className="space-y-1.5">
                  {ratingBreakdown.map((b) => (
                    <div key={b.star} className="flex items-center gap-2.5 text-xs">
                      <span className="w-7 shrink-0 text-right font-semibold tabular-nums text-muted-foreground">{b.star}★</span>
                      <Progress value={b.pct} className="h-1.5 w-32 sm:w-44" />
                      <span className="w-6 shrink-0 tabular-nums text-[11px] text-muted-foreground">{b.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!product.reviews?.length ? (
              <div className="mt-5">
                <EmptyState
                  icon="💬"
                  title="No reviews yet"
                  message="Be the first verified customer to share your thoughts on this item."
                />
              </div>
            ) : (
              <Stagger className="mt-5 space-y-4 divide-y divide-border/70">
                {product.reviews.map((r) => (
                  <StaggerItem key={r.id} className="space-y-2 pt-4 first:pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-8 place-items-center rounded-full bg-primary/10 font-bold text-xs text-primary ring-1 ring-primary/15">
                          {r.customer_name ? r.customer_name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-foreground">
                            {r.customer_name || 'Verified Customer'}
                          </span>
                          <Stars rating={r.rating} size="text-[11px]" />
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="pl-10 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                        {r.comment}
                      </p>
                    )}
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* ══ Related products ══ */}
      {related.length > 0 && (
        <FadeIn>
          <section className="space-y-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="label-micro">Same category</div>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                  You might also like
                </h2>
              </div>
            </div>
            <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p) => (
                <StaggerItem key={p.id}>
                  <ProductCard product={p} />
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        </FadeIn>
      )}
    </div>
  );
}