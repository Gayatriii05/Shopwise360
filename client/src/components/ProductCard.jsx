import { useNavigate } from 'react-router-dom';
import { Stars } from './StarRating';

const imgFallback = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="260"%3E%3Crect width="100%25" height="100%25" fill="%23f1f5f9"/%3E%3Ctext x="50%25" y="50%25" fill="%2394a3b8" font-size="16" font-family="sans-serif" text-anchor="middle"%3ENo image%3C/text%3E%3C/svg%3E';

export default function ProductCard({ product, footer }) {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-lg shadow border border-slate-100 overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={() => navigate(`/product/${product.id}`)}
        className="block w-full"
        aria-label={`View ${product.name}`}
      >
        <div className="relative h-32 bg-slate-100">
          <img
            src={product.image_url || imgFallback}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.currentTarget.src = imgFallback; }}
          />
        </div>
      </button>
      <div className="p-4 flex-1 flex flex-col">
        <button
          type="button"
          onClick={() => navigate(`/product/${product.id}`)}
          className="text-left font-semibold text-slate-800 hover:text-emerald-600"
        >
          {product.name}
        </button>
        <p className="text-xs text-slate-400">{product.category}</p>
        <div className="mt-1">
          <Stars rating={product.rating || 0} size="text-xs" />
          {product.review_count > 0 && (
            <span className="text-xs text-slate-400 ml-1">({product.review_count})</span>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-1 line-clamp-2 flex-1">{product.description}</p>
        <p className="mt-2 font-bold text-emerald-600">₹{product.sale_price}</p>
        {footer}
      </div>
    </div>
  );
}