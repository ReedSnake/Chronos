function requestLocale(req) {
  const language = typeof req.get === 'function'
    ? req.get('accept-language') || ''
    : req.headers?.['accept-language'] || '';
  return language.toLowerCase().startsWith('uk') ? 'uk' : 'en';
}

module.exports = { requestLocale };
