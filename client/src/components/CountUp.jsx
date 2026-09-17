import { useEffect, useRef, useState } from 'react';
import { animate, useInView } from 'framer-motion';

export default function CountUp({
  value,
  decimals = 0,
  duration = 1.15,
  prefix = '',
  suffix = '',
  separator = true,
  locales = 'en-IN',
  className = '',
  delay = 0,
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, duration, delay]);

  const formatted = separator
    ? display.toLocaleString(locales, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : display.toFixed(decimals);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}