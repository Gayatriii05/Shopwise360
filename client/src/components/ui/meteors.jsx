import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Meteors — Aceternity UI (ui.aceternity.com/Meteors)
 * Warm meteor streaks (violet → pink → orange) that fall diagonally.
 * Meant to be absolutely positioned inside a `relative overflow-hidden` parent.
 */
export function Meteors({ number = 20, className = '' }) {
  const meteors = new Array(number).fill(true);

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {meteors.map((_, idx) => {
        const left = (idx * 137) % 100;
        const delay = (idx * 0.37) % 6;
        const duration = `${4 + ((idx * 0.91) % 5)}s`;
        return (
          <span
            key={`meteor-${idx}`}
            className="animate-meteor absolute top-0"
            style={{ left: `${left}%`, animationDelay: `${delay}s`, animationDuration: duration }}
          >
            <span className="block h-[2px] w-20 rounded-full bg-gradient-to-r from-[#c4b5fd] via-[#a7d8b8] to-[#ffd6a5] opacity-90" />
          </span>
        );
      })}
    </div>
  );
}