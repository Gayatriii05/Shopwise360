import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export default function TiltCard({ children, className = '', max = 8, glare = true, shadow = true }) {
  const ref = useRef(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 220, damping: 22 });
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 220, damping: 22 });
  const glareBg = useTransform([px, py], ([x, y]) =>
    `radial-gradient(180px circle at ${x * 100}% ${y * 100}%, rgba(99,102,241,0.18), rgba(255,255,255,0.05) 45%, transparent 70%)`
  );

  const onMouseMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    px.set(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
    py.set(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  };

  const onMouseLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <div ref={ref} className={`relative h-full ${className}`} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      <motion.div
        style={{ rotateX, rotateY, transformPerspective: 900, transformStyle: 'preserve-3d' }}
        className={`relative z-0 h-full will-change-transform transition-shadow duration-300 ${shadow ? 'shadow-[0_24px_54px_-26px_rgba(2,6,23,0.75)]' : ''}`}
      >
        {children}
      </motion.div>
      {glare && (
        <motion.div aria-hidden style={{ background: glareBg }} className="pointer-events-none absolute inset-0 z-10 rounded-[inherit]" />
      )}
    </div>
  );
}