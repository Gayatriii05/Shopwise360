const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const ttlMs = (raw) => {
  if (!raw) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  const m = /^(\d+)\s*(m|h|d)$/i.exec(String(raw).trim());
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const mult = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 }[m[2].toLowerCase()];
  return Number(m[1]) * mult;
};

const accessTokenTtl = () => process.env.ACCESS_TOKEN_TTL || '15m';

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: accessTokenTtl() }
  );
}

async function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + ttlMs(process.env.REFRESH_TOKEN_TTL));
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, sha256(raw), expiresAt]
  );
  return raw;
}

// Rotating refresh tokens. If the presented token is unknown or already
// revoked/expired, every token for that user is revoked (reuse detection).
async function rotateRefreshToken(raw) {
  const hash = sha256(raw);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT rt.*, u.role, u.name AS user_name, u.email AS user_email FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ? FOR UPDATE',
      [hash]
    );
    if (!rows.length) {
      await conn.rollback();
      return null;
    }
    const { user_id: userId, revoked, expires_at: expiresAt } = rows[0];
    if (revoked || new Date(expiresAt).getTime() <= Date.now()) {
      await conn.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [userId]);
      await conn.commit();
      return null;
    }

    const user = { id: userId, role: rows[0].role, email: rows[0].user_email };
    const newRaw = crypto.randomBytes(64).toString('hex');
    const newExpiresAt = new Date(Date.now() + ttlMs(process.env.REFRESH_TOKEN_TTL));
    await conn.query(
      'UPDATE refresh_tokens SET revoked = 1 WHERE id = ?',
      [rows[0].id]
    );
    await conn.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [userId, sha256(newRaw), newExpiresAt]
    );
    await conn.commit();
    return { accessToken: signAccessToken(user), refreshToken: newRaw };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

async function revokeRefreshToken(raw) {
  if (!raw) return;
  await pool.query('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?', [sha256(raw)]);
}

async function revokeAllForUser(userId) {
  await pool.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [userId]);
}

module.exports = { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken, revokeAllForUser, ttlMs };