import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Wobble Card — Aceternity UI (ui.aceternity.com/WobbleCard)
 * Pointer-tracked 3D tilt with a soft violet/pink/orange under-glow.
 */
export function WobbleCard({
  children,
  containerClassName = '',
  className,
  maxTilt = 8,
}) {
  const ref = useRef(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 280, damping: 22 });
  const springY = useSpring(rotateY, { stiffness: 280, damping: 22 });
  const styleX = useTransform(springX, (v) => `${v}deg`);
  const styleY = useTransform(springY, (v) => `${v}deg`);

  const onPointerMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * maxTilt * 2);
    rotateX.set((0.5 - py) * maxTilt * 2);
  };
  const onPointerOut = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerOut={onPointerOut}
      style={{ rotateX: styleX, rotateY: styleY, transformStyle: 'preserve-3d' }}
      className={cn('relative perspective-1000', containerClassName)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(236,72,153,0.3), rgba(249,115,22,0.28))',
          transform: 'translateY(6px) scale(0.96)',
        }}
      />
      <div style={{ transform: 'translateZ(30px)' }} className={cn('h-full', className)}>
        {children}
      </div>
    </motion.div>
  );
}