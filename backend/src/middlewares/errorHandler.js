function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const isMalformedJson = error.type === 'entity.parse.failed';
  const statusCode = isMalformedJson ? 400 : error.statusCode || error.status || 500;
  const errorCode = isMalformedJson
    ? 'VALIDATION_ERROR'
    : statusCode >= 500 && !error.isOperational
      ? 'INTERNAL_ERROR'
      : error.code || 'REQUEST_FAILED';

  if (statusCode >= 500) {
    req.log.error({ err: error, requestId: req.id }, 'Request failed with an unexpected error');
  } else {
    // JSON parsing errors may contain the raw body, including a secret token.
    req.log.warn({ ...(isMalformedJson ? { errorCode } : { err: error }), requestId: req.id }, 'Request failed with a client error');
  }

  res.status(statusCode).json({
    errorCode,
    requestId: req.id,
  });
}

module.exports = errorHandler;
