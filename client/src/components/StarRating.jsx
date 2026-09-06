import { useState } from 'react';

// Display-only star rating
export function Stars({ rating = 0, size = 'text-sm' }) {
  const value = Math.round(rating * 2) / 2;
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const stars = [];
  for (let i = 0; i < 5; i++) {
    let cls = 'text-slate-300';
    if (i < full) cls = 'text-amber-400';
    else if (i === full && half) cls = 'text-amber-400';
    stars.push(
      <span key={i} className={cls}>
        {i < full ? '★' : i === full && half ? '★' : '☆'}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-0.5 ${size}`}>
      <span className="text-slate-700">{stars}</span>
      {rating > 0 && <span className="text-slate-400 ml-1">{Number(rating).toFixed(1)}</span>}
    </span>
  );
}

// Interactive star input (1-5)
export function StarInput({ value = 0, onChange }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className={`text-2xl transition-colors ${n <= active ? 'text-amber-400' : 'text-slate-300'}`}
          aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}