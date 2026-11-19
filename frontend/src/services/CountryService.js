const AVAILABLE_COUNTRIES_URL = 'https://date.nager.at/api/v3/AvailableCountries';
const REQUEST_TIMEOUT_MS = 5000;
const UNAVAILABLE_MESSAGE = 'Unable to load countries. Please try again later or refresh the page.';

function normalizeCountries(values) {
  if (!Array.isArray(values)) throw new Error(UNAVAILABLE_MESSAGE);

  const seenCodes = new Set();
  const countries = values
    .filter((country) => typeof country?.countryCode === 'string'
      && /^[A-Z]{2}$/.test(country.countryCode)
      && typeof country.name === 'string'
      && country.name.trim())
    .filter((country) => {
      if (seenCodes.has(country.countryCode)) return false;
      seenCodes.add(country.countryCode);
      return true;
    })
    .map((country) => ({ countryCode: country.countryCode, name: country.name.trim() }));

  if (!countries.length) throw new Error(UNAVAILABLE_MESSAGE);
  return countries.sort((first, second) => first.name.localeCompare(second.name));
}

export class CountryService {
  async getAvailableCountries() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(AVAILABLE_COUNTRIES_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(UNAVAILABLE_MESSAGE);
      return normalizeCountries(await response.json());
    } catch {
      throw new Error(UNAVAILABLE_MESSAGE);
    } finally {
      clearTimeout(timeout);
    }
  }
}
