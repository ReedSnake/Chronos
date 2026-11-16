const { getDatabaseStatus } = require('../database/connection');

function getHealth(req, res) {
  const database = getDatabaseStatus();
  const isReady = database.status === 'connected';

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database,
  });
}

module.exports = {
  getHealth,
};
