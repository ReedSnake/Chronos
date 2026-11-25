import { useEffect, useState } from 'react';

function validPreference(value, fallback) {
  if (Array.isArray(fallback)) return Array.isArray(value) && value.every(item => typeof item === 'string');
  if (fallback === null) return value === null;
  if (fallback !== null && typeof fallback === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && Object.entries(fallback).every(([key, item]) => validPreference(value[key], item));
  }
  return typeof value === typeof fallback && value !== null;
}

export function readPreference(storage, key, fallback) {
  if (!key) return fallback;
  try {
    const raw = storage.getItem('chronos:' + key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return validPreference(value, fallback) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function useLocalPreference(key, fallback) {
  const read = () => {
    try { return readPreference(window.localStorage, key, fallback); }
    catch { return fallback; }
  };
  const [entry, setEntry] = useState(() => ({ key, value: read() }));
  const value = entry.key === key ? entry.value : read();

  function set(next) {
    setEntry(old => {
      const previous = old.key === key ? old.value : read();
      return { key, value: typeof next === 'function' ? next(previous) : next };
    });
  }

  useEffect(() => {
    if (!key || entry.key !== key) return;
    try { window.localStorage.setItem('chronos:' + key, JSON.stringify(entry.value)); }
    catch { /* Storage can be unavailable in private browsing. */ }
  }, [key, entry]);

  return [value, set];
}
