import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const STAR_COLORS = ['#ff3d77', '#ff7a45', '#ffc145', '#7ed957', '#6c5ce7'];

/**
 * Glowing Stars — Aceternity UI (ui.aceternity.com/GlowingStarsBackgroundCard)
 * Light "Twilight Bloom" recast: a violet→pink→orange glow wash behind a
 * canvas starfield with twinkling stars and connecting constellations, plus a
 * pointer-following orange glow star.
 */
export function GlowingStarsBackgroundCard({ children, className = '' }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const resize = () => {
      if (wrapRef.current) {
        const r = wrapRef.current.getBoundingClientRect();
        setSize({ w: r.width, h: r.height });
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!size.w) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size.w * DPR;
    canvas.height = size.h * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const stars = Array.from({ length: 90 }, (_, i) => ({
      x: Math.random() * size.w,
      y: Math.random() * size.h,
      r: 1 + Math.random() * 1.8,
      color: STAR_COLORS[i % STAR_COLORS.length],
      twinkle: 0.35 + Math.random() * 0.65,
      phase: Math.random() * Math.PI * 2,
    }));

    const draw = (t) => {
      ctx.clearRect(0, 0, size.w, size.h);
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const a = stars[i];
          const b = stars[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 95) {
            ctx.strokeStyle = `rgba(255, 61, 119, ${0.16 * (1 - d / 95)})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const s of stars) {
        const alpha = 0.45 + 0.55 * Math.abs(Math.sin(s.phase + t / 1200));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 * alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    };

    let raf;
    const loop = (t) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        'relative h-full w-full overflow-hidden rounded-2xl border border-border',
        'bg-gradient-to-br from-pink-100 via-orange-100 to-amber-100',
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 85% 0%, rgba(255,61,119,0.22), transparent 55%), radial-gradient(120% 100% at 10% 100%, rgba(255,122,69,0.18), transparent 55%)' }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {children}
    </div>
  );
}

export function GlowingStarsTitle({ className, children }) {
  return <h3 className={cn('text-lg font-bold text-foreground', className)}>{children}</h3>;
}

export function GlowingStarsDescription({ className, children }) {
  return <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>;
}