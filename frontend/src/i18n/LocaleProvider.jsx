import { createContext, useContext, useEffect, useMemo } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { DEFAULT_LOCALE, getMessages, isSupportedLocale } from './locales';
import { locationForLocale, localizedPath } from '../routes/localePath';

const LocaleContext = createContext(null);

function readMessage(messages, key) {
  return key.split('.').reduce((value, segment) => value?.[segment], messages);
}

function createTranslator(messages) {
  return (key, values = {}) => {
    const template = readMessage(messages, key);
    if (typeof template !== 'string') return key;
    return template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`);
  };
}

function LocaleContextProvider({ locale, children }) {
  const location = useLocation();
  const messages = getMessages(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    t: createTranslator(messages),
    localizedPath: (path) => localizedPath(locale, path),
    locationForLocale: (nextLocale) => locationForLocale(nextLocale, location),
  }), [locale, location, messages]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function LocaleRoute() {
  const { locale } = useParams();
  const location = useLocation();

  if (!isSupportedLocale(locale)) {
    return <Navigate replace to={locationForLocale(DEFAULT_LOCALE, location)} />;
  }

  return <LocaleContextProvider locale={locale}><Outlet /></LocaleContextProvider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleRoute');
  return value;
}
