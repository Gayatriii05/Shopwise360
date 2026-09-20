import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { ShoppingBag } from 'lucide-react';
import { Stars } from './StarRating';
import { WobbleCard } from './ui/wobble-card';
import { Card, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

const imgFallback = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="100%25" height="100%25" fill="%23F5EFE6"/%3E%3Ctext x="50%25" y="50%25" fill="%239A8E80" font-size="14" font-family="sans-serif" font-weight="600" text-anchor="middle"%3ENo image available%3C/text%3E%3C/svg%3E';

export default function ProductCard({ product, footer, onQuickView }) {
  const navigate = useNavigate();
  const go = () => navigate(`/product/${product.id}`);

  return (
    <WobbleCard containerClassName="h-full group" maxTilt={7} className="h-full">
      <Card className="group relative h-full gap-0 overflow-hidden rounded-2xl border-border py-0 shadow-card ring-border transition-[box-shadow,ring-color] duration-300 hover:shadow-[0_22px_48px_-22px_rgba(139,92,246,0.35)] hover:ring-primary/45">
        {/* Clickable image with hover-zoom */}
        <div
          onClick={go}
          role="button"
          tabIndex={0}
          aria-label={`View details for ${product.name}`}
          onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
          className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden bg-muted"
        >
          <img
            src={product.image_url || imgFallback}
            alt={product.name}
            loading="lazy"
            onError={(e) => { e.currentTarget.src = imgFallback; }}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {product.category && (
            <Badge
              variant="outline"
              className="absolute left-3 top-3 border-border/80 bg-background/85 text-foreground backdrop-blur-sm"
            >
              {product.category}
            </Badge>
          )}

          {onQuickView && (
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); onQuickView(product); }}
              className="absolute right-3 top-3 translate-y-1 opacity-0 shadow-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
              aria-label={`Quick view ${product.name}`}
            >
              <Eye />
            </Button>
          )}
        </div>

        {/* Content */}
        <CardContent className="flex flex-1 flex-col gap-1 px-4 pb-4 pt-3">
          <button
            type="button"
            onClick={go}
            className="truncate text-left text-[13px] font-semibold leading-snug text-foreground transition-colors hover:text-primary"
          >
            {product.name}
          </button>

          <div className="flex items-center justify-between">
            <Stars rating={product.rating || 0} size="text-xs" />
            {product.review_count > 0 && (
              <span className="text-[11px] font-medium text-muted-foreground">
                ({product.review_count})
              </span>
            )}
          </div>

          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {product.description || 'No description provided.'}
          </p>

          {/* Price callout */}
          <div className="mt-auto flex items-baseline justify-between border-t border-border/60 pt-2.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-semibold text-primary">₹</span>
              <span className="text-lg font-extrabold tracking-tight text-foreground">
                {Number(product.sale_price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <ShoppingBag className="size-3" />
              Buy
            </span>
          </div>
        </CardContent>

        {/* Optional action / footer slot */}
        {footer && <CardFooter className="px-4">{footer}</CardFooter>}
      </Card>
    </WobbleCard>
  );
}