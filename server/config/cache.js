// Redis cache with strict fail-open semantics: any Redis problem (down,
// misconfigured, auth error) downgrades to DB-only reads. No cache path may
// ever take the app down or add latency beyond the DB loader itself.
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client = null;
let enabled = false;

try {
  client = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    retryStrategy: () => null
  });
  client.on('error', () => {
    // Swallow connection errors; the next command attempt reports them into
    // the fail-open paths. Without a listener, ioredis would throw unhandled.
  });
  client.connect().then(() => {
    enabled = true;
    console.log('[cache] redis connected and enabled');
  }).catch(() => {
    enabled = false;
    console.warn('[cache] redis unreachable — running DB-only (fail-open)');
  });
} catch (err) {
  enabled = false;
  console.warn('[cache] redis init failed — running DB-only (fail-open)');
}

const cacheable = () => enabled && client;

// Returns { value, cached } so callers can surface X-Cache: HIT/MISS.
async function getOrSet(key, ttlSeconds, loader) {
  if (!cacheable()) return { value: await loader(), cached: false };
  try {
    const raw = await client.get(key);
    if (raw != null) return { value: JSON.parse(raw), cached: true };
  } catch {
    /* corrupted/errored read → recompute */
  }
  const value = await loader();
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    /* write failure is non-fatal */
  }
  return { value, cached: false };
}

async function bust(...keys) {
  if (!cacheable() || !keys.length) return;
  try {
    await client.del(...keys);
  } catch {
    /* non-fatal */
  }
}

// Keys created by known patterns (used when we want to bust a family).
async function bustPattern(pattern) {
  if (!cacheable()) return;
  try {
    let cursor = '0';
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      if (keys.length) await client.del(...keys);
      cursor = next;
    } while (cursor !== '0');
  } catch {
    /* non-fatal */
  }
}

module.exports = { getOrSet, bust, bustPattern };