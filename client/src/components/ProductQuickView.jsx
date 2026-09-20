import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Stars } from './StarRating';

const imgFallback =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="100%25" height="100%25" fill="%23F3EFE7"/%3E%3Ctext x="50%25" y="50%25" fill="%23A89D8E" font-size="14" font-family="sans-serif" font-weight="600" text-anchor="middle"%3ENo image available%3C/text%3E%3C/svg%3E';

export default function ProductQuickView({ product, open, onOpenChange, onAddToCart }) {
  const navigate = useNavigate();

  if (!product) return null;

  const openDetail = () => {
    onOpenChange(false);
    navigate(`/product/${product.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-5 sm:py-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Image */}
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border/70">
            <img
              src={product.image_url || imgFallback}
              alt={product.name}
              onError={(e) => { e.currentTarget.src = imgFallback; }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>

          {/* Info */}
          <div>
            <DialogHeader className="gap-2">
              {product.category && (
                <Badge variant="outline" className="w-fit border-border/70 bg-muted/50 text-foreground">
                  {product.category}
                </Badge>
              )}
              <DialogTitle className="text-xl leading-snug text-foreground">{product.name}</DialogTitle>
              <DialogDescription className="text-[13px] leading-relaxed">
                {product.description || 'No description provided.'}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4">
              <Stars rating={product.rating || 0} size="text-xs" />
              {product.review_count > 0 && (
                <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                  {product.review_count} review{product.review_count > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-sm font-semibold text-primary">₹</span>
              <span className="text-3xl font-extrabold tracking-tight text-foreground">
                {Number(product.sale_price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <DialogFooter className="mt-6 gap-2 flex-col-reverse sm:flex-row sm:justify-end">
              {onAddToCart && (
                <Button variant="secondary" size="lg" className="flex-1" onClick={() => onAddToCart(product)}>
                  <ShoppingBag className="size-4" />
                  Add to cart
                </Button>
              )}
              <Button variant="outline" size="lg" className="flex-1" onClick={openDetail}>
                Full details
              </Button>
              <Button size="lg" className="flex-1" onClick={openDetail}>
                View &amp; Buy
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}