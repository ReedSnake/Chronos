import en from './en.json';
import uk from './uk.json';

export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = Object.freeze(['en', 'uk']);

const messagesByLocale = Object.freeze({ en, uk });

export function isSupportedLocale(value) {
  return SUPPORTED_LOCALES.includes(value);
}

export function getMessages(locale) {
  return messagesByLocale[locale] || messagesByLocale[DEFAULT_LOCALE];
}
