async function getStatus() {
  return {
    service: 'auth',
    status: 'not_implemented',
    message: 'Authentication endpoints are not implemented yet.',
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  getStatus,
};
