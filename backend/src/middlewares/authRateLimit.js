const AppError = require('../utils/AppError');

// Fixed-window, per-process limits. IP keys are not written to logs or persisted.
const buckets = new Map();

function authRateLimit({ limit, windowMs = 15 * 60 * 1000 }) {
  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size > 5000) {
      for (const [key, record] of buckets) {
        if (record.resetAt <= now) buckets.delete(key);
      }
    }
    const key = `${req.path}:${req.ip}`;
    if (!buckets.has(key) && buckets.size >= 5000) {
      return next(new AppError('Too many requests. Try again later.', 429, 'RATE_LIMITED'));
    }
    const previous = buckets.get(key);
    const record = !previous || previous.resetAt <= now
      ? { count: 0, resetAt: now + windowMs } : previous;
    record.count += 1;
    buckets.set(key, record);
    if (record.count > limit) {
      res.setHeader('Retry-After', String(Math.ceil((record.resetAt - now) / 1000)));
      return next(new AppError('Too many requests. Try again later.', 429, 'RATE_LIMITED'));
    }
    return next();
  };
}

module.exports = authRateLimit;
