const cache = new Map();

function setCache(key, value, ttlSeconds = 300) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function clearCache(key) {
  if (key) cache.delete(key);
  else cache.clear();
}

module.exports = { setCache, getCache, clearCache };