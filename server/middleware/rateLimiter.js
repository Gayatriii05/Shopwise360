const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const parseWindowMs = (raw, fallback) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const authLimiter = rateLimit({
  windowMs: parseWindowMs(process.env.AUTH_RATE_WINDOW_MS, 15 * 60 * 1000),
  max: parseInt(process.env.AUTH_RATE_MAX, 10) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  keyGenerator: (req) => {
    const email = (req.body && req.body.email) ? String(req.body.email).trim().toLowerCase() : '';
    return `${ipKeyGenerator(req.ip)}:${email}`;
  },
  handler: (req, res) => res.status(429).json({
    error: 'Too many login attempts. Please wait a minute and try again.'
  })
});

const registerLimiter = rateLimit({
  windowMs: parseWindowMs(process.env.REGISTER_RATE_WINDOW_MS, 60 * 60 * 1000),
  max: parseInt(process.env.REGISTER_RATE_MAX, 10) || 50,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  handler: (req, res) => res.status(429).json({
    error: 'Too many accounts created from this address. Please try again later.'
  })
});

module.exports = { authLimiter, registerLimiter };