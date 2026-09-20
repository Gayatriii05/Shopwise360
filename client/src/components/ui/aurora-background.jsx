import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Aurora Background — Aceternity UI (ui.aceternity.com/AuroraBackground)
 * Light "Twilight Bloom" recast: layered blurred aurora blobs on the warm
 * off-white canvas, violet → pink → orange, with a faint warm grid.
 */
export function AuroraBackground({ className = '', children }) {
  return (
    <div className={cn('relative w-full overflow-hidden', className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 [filter:blur(70px)]">
          <div className="animate-aurora absolute -left-1/4 -top-[25%] h-[85%] w-[60%] rounded-full bg-violet-300/50" />
          <div className="animate-aurora absolute -right-[15%] top-[5%] h-[75%] w-[55%] rounded-full bg-pink-300/45 [animation-delay:2.5s]" />
          <div className="animate-aurora absolute bottom-[-30%] left-[22%] h-[80%] w-[60%] rounded-full bg-orange-200/55 [animation-delay:5s]" />
        </div>
        <div className="absolute inset-0 bg-grid-faint opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-transparent to-background/90" />
      </div>
      {children}
    </div>
  );
}