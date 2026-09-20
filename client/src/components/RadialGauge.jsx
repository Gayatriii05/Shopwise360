import { motion } from 'framer-motion';

export default function RadialGauge({
  id = 'rg',
  value = 0,
  size = 190,
  stroke = 14,
  from = '#FF3D77',
  to = '#FF7A45',
  track = '#FFE0C2',
  glow = true,
  children,
}) {
  const v = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gradId = `${id}-grad`;
  const glowId = `${id}-glow`;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
          {glow && (
            <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
              </feMerge>
            </filter>
          )}
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - v / 100) }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
          style={glow ? { filter: `url(#${glowId})` } : undefined}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}