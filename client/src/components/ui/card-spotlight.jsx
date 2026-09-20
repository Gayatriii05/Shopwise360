import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Card Spotlight — Aceternity UI (ui.aceternity.com/CardSpotlight)
 * A radial violet highlight that tracks the pointer across the card.
 */
export function CardSpotlight({
  children,
  className = '',
  spotlightColor = 'rgba(196, 181, 253, 0.14)',
}) {
  const divRef = useRef(null);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e) => {
    const rect = divRef.current.getBoundingClientRect();
    setPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn('group relative overflow-hidden', className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-0 transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(460px circle at ${point.x}px ${point.y}px, ${spotlightColor}, transparent 45%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}