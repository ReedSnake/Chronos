function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const isMalformedJson = error.type === 'entity.parse.failed';
  const statusCode = isMalformedJson ? 400 : error.statusCode || error.status || 500;
  const errorCode = isMalformedJson
    ? 'VALIDATION_ERROR'
    : statusCode >= 500
      ? 'INTERNAL_ERROR'
      : error.code || 'REQUEST_FAILED';

  if (statusCode >= 500) {
    req.log.error({ err: error, requestId: req.id }, 'Request failed with an unexpected error');
  } else {
    req.log.warn({ err: error, requestId: req.id }, 'Request failed with a client error');
  }

  res.status(statusCode).json({
    errorCode,
    requestId: req.id,
  });
}

module.exports = errorHandler;
