function normalizeApiUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) {
    return undefined;
  }

  return value.replace(/\/+$/, '');
}

const runtimeConfig = globalThis.__CHRONOS_CONFIG__ || {};

export const runtimeConfigValues = Object.freeze({
  apiBaseUrl: normalizeApiUrl(runtimeConfig.apiUrl)
    || normalizeApiUrl(import.meta.env.VITE_API_URL)
    || 'http://localhost:3000/api',
  requestTimeoutMs: 4000,
});
