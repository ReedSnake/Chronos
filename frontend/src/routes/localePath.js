import { DEFAULT_LOCALE } from '../i18n/locales';

export function localizedPath(locale, path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return normalizedPath === '/' ? `/${locale}/` : `/${locale}${normalizedPath}`;
}

export function locationForLocale(locale, location) {
  const remainder = location.pathname.replace(/^\/[^/]+/, '') || '/';
  return {
    pathname: localizedPath(locale, remainder),
    search: location.search,
    hash: location.hash,
  };
}
