export function getLocalizedApiError(error, t, fallbackKey) {
  const code = error?.code || 'REQUEST_FAILED';
  const translated = t(`apiErrors.${code}`);
  return translated === `apiErrors.${code}` ? t(fallbackKey) : translated;
}
