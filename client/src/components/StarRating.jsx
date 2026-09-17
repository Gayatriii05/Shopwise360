import { useState } from 'react';

// Display-only star rating with SVG stars
export function Stars({ rating = 0, size = 'text-sm' }) {
  const value = Math.max(0, Math.min(5, Math.round(Number(rating || 0) * 2) / 2));
  const full = Math.floor(value);
  const half = value - full >= 0.5;

  return (
    <div className={`inline-flex items-center gap-1 ${size}`}>
      <div className="flex items-center text-amber-400">
        {[0, 1, 2, 3, 4].map((i) => {
          const isFull = i < full;
          const isHalf = i === full && half;
          return (
            <svg
              key={i}
              className="w-3.5 h-3.5 fill-current transition-colors"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              {isFull ? (
                <path fill="#DDB24F" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              ) : isHalf ? (
                <g>
                  <path fill="#D0CAE4" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  <path fill="#DDB24F" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0V2.927z" />
                </g>
              ) : (
                <path fill="#D0CAE4" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              )}
            </svg>
          );
        })}
      </div>
      {rating > 0 && (
        <span className="text-xs font-semibold text-cream-600 ml-0.5 tracking-tight">
          {Number(rating).toFixed(1)}
        </span>
      )}
    </div>
  );
}

// Interactive star rating input for forms
export function StarInput({ value = 0, onChange }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="inline-flex items-center gap-1 bg-cream-100 p-1.5 rounded-xl border border-cream-300/70">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="p-1 rounded-lg hover:bg-cream-50 transition-all transform hover:scale-110 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400/80"
          aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
        >
          <svg
            className={`w-6 h-6 transition-colors ${
              n <= active ? 'text-amber-400 fill-amber-400' : 'text-cream-300 fill-cream-300'
            }`}
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
      <span className="text-xs font-semibold text-cream-500 ml-2 mr-1">
        {active > 0 ? `${active} of 5` : 'Select rating'}
      </span>
    </div>
  );
}