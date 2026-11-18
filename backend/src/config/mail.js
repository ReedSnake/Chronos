const nodemailer = require('nodemailer');
const config = require('./config');
const AppError = require('../utils/AppError');

function ensureMailConfigured() {
  if (!config.mail.user || !config.mail.appPassword || !config.mail.frontendUrl) {
    throw new AppError('Email delivery is not configured', 503, 'EMAIL_NOT_CONFIGURED');
  }
}

let transporter;
function getTransporter() {
  ensureMailConfigured();
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: config.mail.user, pass: config.mail.appPassword },
      tls: { minVersion: 'TLSv1.2' },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
  return transporter;
}

async function sendVerificationEmail(email, token) {
  const url = new URL('/verify-email', config.mail.frontendUrl);
  // Fragment tokens never reach Nginx access logs or HTTP Referer headers.
  url.hash = `token=${encodeURIComponent(token)}`;
  await getTransporter().sendMail({
    from: config.mail.user,
    to: email,
    subject: 'Confirm your Chronos email',
    text: `Confirm your email by opening this link (valid for 30 minutes):\n\n${url.toString()}\n\nIf you did not register, ignore this email.`,
  });
}

module.exports = { ensureMailConfigured, sendVerificationEmail };
