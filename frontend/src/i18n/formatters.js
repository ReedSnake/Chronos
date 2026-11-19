export function formatCountryName(countryCode, locale, fallback = countryCode) {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(countryCode) || fallback;
  } catch {
    return fallback;
  }
}

export function formatDate(value, locale) {
  try {
    return new Intl.DateTimeFormat(locale).format(new Date(value));
  } catch {
    return value;
  }
}
