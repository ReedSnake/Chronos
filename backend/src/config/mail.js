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

function localizedScopeList(scopes, locale) {
  const labels = {
    en: { 'calendar:read': 'read calendars', 'calendar:write': 'edit calendars', 'calendar:delete': 'delete calendars' },
    uk: { 'calendar:read': 'читання календарів', 'calendar:write': 'редагування календарів', 'calendar:delete': 'видалення календарів' },
  };
  return scopes.map((scope) => labels[locale]?.[scope] || scope).join(', ');
}

function emailLocale(locale) {
  return locale === 'uk' ? 'uk' : 'en';
}

async function sendVerificationEmail(email, token, locale = 'en') {
  const url = new URL('/verify-email', config.mail.frontendUrl);
  // Fragment tokens never reach Nginx access logs or HTTP Referer headers.
  url.hash = `token=${encodeURIComponent(token)}`;
  const selectedLocale = emailLocale(locale);
  const content = selectedLocale === 'uk'
    ? {
      subject: 'Підтвердьте email у Chronos',
      text: `Підтвердьте email за цим посиланням (воно дійсне 30 хвилин):\n\n${url.toString()}\n\nЯкщо ви не реєструвалися, проігноруйте цей лист.`,
    }
    : {
      subject: 'Confirm your Chronos email',
      text: `Confirm your email by opening this link (valid for 30 minutes):\n\n${url.toString()}\n\nIf you did not register, ignore this email.`,
    };
  await getTransporter().sendMail({
    from: config.mail.user,
    to: email,
    ...content,
  });
}

async function sendIntegrationPairingEmail(email, { token, integrationName, scopes }, locale = 'en') {
  const url = new URL('/integrations/approve', config.mail.frontendUrl);
  // The browser reads the fragment and sends it only over HTTPS after authentication.
  url.hash = `token=${encodeURIComponent(token)}`;
  const selectedLocale = emailLocale(locale);
  const scopeList = localizedScopeList(scopes, selectedLocale);
  const content = selectedLocale === 'uk'
    ? {
      subject: `Підтвердьте доступ ${integrationName} до календарів Chronos`,
      text: `${integrationName} запитує такі права: ${scopeList}.\n\nПерегляньте запит протягом 30 хвилин:\n\n${url.toString()}\n\nЯкщо ви не очікували на цей запит, проігноруйте цей лист.`,
    }
    : {
      subject: `Approve ${integrationName} access to your Chronos calendars`,
      text: `${integrationName} requested these permissions: ${scopeList}.\n\nReview the request within 30 minutes:\n\n${url.toString()}\n\nIf you did not expect this request, ignore this email.`,
    };
  await getTransporter().sendMail({
    from: config.mail.user,
    to: email,
    ...content,
  });
}

async function sendCalendarInvitationEmail(email, { token, calendarName, role }, locale = 'en') {
  const url = new URL('/calendar-invite', config.mail.frontendUrl);
  url.hash = `token=${encodeURIComponent(token)}`;
  const selectedLocale = emailLocale(locale);
  const roleLabel = selectedLocale === 'uk'
    ? ({ viewer: 'перегляд', editor: 'редагування', admin: 'адміністрування' }[role] || role)
    : role;
  const content = selectedLocale === 'uk'
    ? {
      subject: `Запрошення до календаря ${calendarName} у Chronos`,
      text: `Вас запрошено до календаря ${calendarName} з правом ${roleLabel}.\n\nВідкрийте запрошення до завершення строку дії:\n\n${url.toString()}\n\nЯкщо ви не очікували на це запрошення, проігноруйте цей лист.`,
    }
    : {
      subject: `Invitation to ${calendarName} in Chronos`,
      text: `You were invited to ${calendarName} with ${roleLabel} access.\n\nOpen this invitation before it expires:\n\n${url.toString()}\n\nIf you did not expect this invitation, ignore this email.`,
    };
  await getTransporter().sendMail({
    from: config.mail.user,
    to: email,
    ...content,
  });
}

async function sendEventInvitationEmail(email, { token, title, startsAt, type, isRecurring, timeZone }, locale = 'en') {
  const uk = emailLocale(locale) === 'uk';
  const url = new URL(`/${uk ? 'uk' : 'en'}/event-invite`, config.mail.frontendUrl);
  url.hash = `token=${encodeURIComponent(token)}`;
  const date = new Intl.DateTimeFormat(uk ? 'uk-UA' : 'en-US', {
    dateStyle: 'long', ...(type === 'holiday' ? {} : { timeStyle: 'short' }), timeZone: timeZone || 'UTC',
  }).format(new Date(startsAt));
  const series = isRecurring ? (uk ? '\nЗапрошення стосується всієї серії. Вказано дату початку серії.' : '\nThis invitation covers the entire series. The date shown is the first occurrence.') : '';
  const text = uk
    ? `Вас запрошено на подію Chronos: ${title}\n${date} (${timeZone || 'UTC'})${series}\n\nПрийняти або відхилити запрошення (7 днів):\n${url}\n\nЯкщо ви не очікували цього листа, проігноруйте його.`
    : `You are invited to a Chronos event: ${title}\n${date} (${timeZone || 'UTC'})${series}\n\nAccept or decline within 7 days:\n${url}\n\nIf you did not expect this email, ignore it.`;
  await getTransporter().sendMail({ from: config.mail.user, to: email,
    subject: uk ? 'Запрошення на подію Chronos' : 'Chronos event invitation', text });
}

module.exports = { sendEventInvitationEmail, ensureMailConfigured, sendVerificationEmail, sendIntegrationPairingEmail, sendCalendarInvitationEmail };
