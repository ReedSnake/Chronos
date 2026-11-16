const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(new AppError('Endpoint not found', 404, 'ENDPOINT_NOT_FOUND'));
}

module.exports = notFound;
