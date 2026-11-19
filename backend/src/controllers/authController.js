const authService = require('../services/authService');
const {
  validateRegistration,
  validateLogin,
  validateResend,
  validateVerification,
} = require('../validators/authValidators');

async function getStatus(req, res) {
  const data = await authService.getStatus();
  res.status(200).json(data);
}

async function register(req, res) {
  const data = await authService.register(validateRegistration(req.body));
  res.status(201).json(data);
}

async function resendVerification(req, res) {
  const data = await authService.resendVerification(validateResend(req.body));
  res.status(200).json(data);
}

async function verifyEmail(req, res) {
  const data = await authService.verifyEmail(validateVerification(req.body), req, res);
  res.status(200).json(data);
}

async function login(req, res) {
  const data = await authService.login(validateLogin(req.body), req, res);
  res.status(200).json(data);
}

async function logout(req, res) {
  await authService.logout(req, res);
  res.status(204).end();
}

module.exports = { getStatus, register, resendVerification, verifyEmail, login, logout };
