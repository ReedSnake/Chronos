const AppError = require('../utils/AppError');

const AVAILABLE_COUNTRIES_URL = 'https://date.nager.at/api/v3/AvailableCountries';
const REQUEST_TIMEOUT_MS = 5000;

function unavailable() {
  return new AppError(
    'Country service is temporarily unavailable. Please try again later.',
    503,
    'COUNTRIES_SERVICE_UNAVAILABLE',
  );
}

async function getAvailableCountryCodes() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(AVAILABLE_COUNTRIES_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch {
    throw unavailable();
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw unavailable();

  let countries;
  try {
    countries = await response.json();
  } catch {
    throw unavailable();
  }

  if (!Array.isArray(countries)) throw unavailable();

  const codes = new Set(countries
    .map((country) => country?.countryCode)
    .filter((code) => typeof code === 'string' && /^[A-Z]{2}$/.test(code)));

  if (!codes.size) throw unavailable();
  return codes;
}

async function ensureCountryIsAvailable(country) {
  const availableCodes = await getAvailableCountryCodes();
  if (!availableCodes.has(country)) {
    throw new AppError('Country is not supported', 400, 'UNSUPPORTED_COUNTRY');
  }
}

module.exports = { ensureCountryIsAvailable };
