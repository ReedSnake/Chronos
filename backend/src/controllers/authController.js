const authService = require('../services/authService');

async function getStatus(req, res) {
  const data = await authService.getStatus();
  res.status(200).json(data);
}

module.exports = {
  getStatus,
};
