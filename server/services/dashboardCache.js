// Dashboard aggregate cache. Only the "heavy" endpoints (retailer summary,
// admin summary) are cached; per-request reads (inventory, orders lists) are
// not, to avoid staleness on fast-moving operational data.
const { getOrSet, bust, bustPattern } = require('../config/cache');

const TTL = parseInt(process.env.DASH_CACHE_TTL, 10) || 60;

const retailerKey = (id) => `dash:retailer:${id}`;
const adminKey = () => 'dash:admin';

// Additional slices produced alongside a summary share the same cache entry so
// a single getOrSet populates everything the dashboard reads back frequently.
const loadRetailer = (id, loader) =>
  getOrSet(retailerKey(id), TTL, loader);

const loadAdmin = (loader) =>
  getOrSet(adminKey(), TTL, loader);

function invalidateRetailer(id) {
  return bust(retailerKey(id), adminKey());
}

function invalidateAdmin() {
  return bust(adminKey());
}

// Product/category-level changes affect every retailer's dashboard share.
function invalidateAllRetailers() {
  return bustPattern('dash:retailer:*').then(() => bust(adminKey()));
}

module.exports = { loadRetailer, loadAdmin, invalidateRetailer, invalidateAdmin, invalidateAllRetailers, TTL };