function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const isMalformedJson = error.type === 'entity.parse.failed';
  const statusCode = isMalformedJson ? 400 : error.statusCode || error.status || 500;
  const message = statusCode >= 500 ? 'Internal server error' : error.message;

  if (statusCode >= 500) {
    req.log.error({ err: error, requestId: req.id }, 'Request failed with an unexpected error');
  } else {
    req.log.warn({ err: error, requestId: req.id }, 'Request failed with a client error');
  }

  res.status(statusCode).json({
    error: message,
    requestId: req.id,
  });
}

module.exports = errorHandler;
