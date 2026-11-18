const config = require('../config/config');
const AppError = require('../utils/AppError');

// SameSite cookies + a strict Origin check prevent cross-site form/fetch mutations.
function authOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin && !config.corsOrigins.includes(origin) && origin !== config.documentation.serverUrl) {
    return next(new AppError('Origin is not allowed', 403, 'ORIGIN_FORBIDDEN'));
  }
  return next();
}

module.exports = authOrigin;
