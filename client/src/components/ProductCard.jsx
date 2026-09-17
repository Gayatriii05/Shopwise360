import { useNavigate } from 'react-router-dom';
import { Stars } from './StarRating';
import { ShoppingBagIcon } from './Icons';

const imgFallback = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="260"%3E%3Crect width="100%25" height="100%25" fill="%23E1DDF0"/%3E%3Ctext x="50%25" y="50%25" fill="%23786F97" font-size="14" font-family="sans-serif" font-weight="600" text-anchor="middle"%3ENo image available%3C/text%3E%3C/svg%3E';

export default function ProductCard({ product, footer }) {
  const navigate = useNavigate();

  return (
    <div className="group glass-card rounded-2xl hover:shadow-card-hover hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col h-full">
      {/* Clickable Image Container */}
      <div
        onClick={() => navigate(`/product/${product.id}`)}
        className="relative h-44 w-full bg-cream-200 overflow-hidden cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={`View details for ${product.name}`}
        onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/product/${product.id}`); }}
      >
        <img
          src={product.image_url || imgFallback}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-500 ease-out"
          loading="lazy"
          onError={(e) => { e.currentTarget.src = imgFallback; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {/* Category Pill Overlay */}
        {product.category && (
          <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cream-50/85  text-cream-700 shadow-subtle border border-cream-300/70">
            {product.category}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Title */}
        <button
          type="button"
          onClick={() => navigate(`/product/${product.id}`)}
          className="text-left font-bold text-cream-800 hover:text-violet-700 transition-colors text-sm line-clamp-1"
        >
          {product.name}
        </button>

        {/* Rating */}
        <div className="mt-1.5 flex items-center justify-between">
          <Stars rating={product.rating || 0} size="text-xs" />
          {product.review_count > 0 && (
            <span className="text-[11px] font-medium text-cream-400">
              ({product.review_count})
            </span>
          )}
        </div>

        {/* Description snippet */}
        <p className="text-xs text-cream-500 mt-2 line-clamp-2 leading-relaxed flex-1">
          {product.description || 'No description provided.'}
        </p>

        {/* Price callout */}
        <div className="mt-3 pt-3 border-t border-cream-300/70 flex items-baseline justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-semibold text-violet-600">₹</span>
            <span className="text-lg font-extrabold text-cream-900 tracking-tight">
              {Number(product.sale_price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
            <ShoppingBagIcon className="w-3 h-3" />
            Buy
          </span>
        </div>

        {/* Optional Action / Footer slot */}
        {footer && <div className="mt-3">{footer}</div>}
      </div>
    </div>
  );
}