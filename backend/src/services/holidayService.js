const { createHash } = require('node:crypto');
const AppError = require('../utils/AppError');

const cache = new Map();
const TTL = 12 * 60 * 60 * 1000;
const MAX_CACHE = 256;
const BASE = 'https://date.nager.at/api/v3/PublicHolidays';

function unavailable() {
  return new AppError('National holidays are temporarily unavailable', 503, 'HOLIDAYS_UNAVAILABLE');
}

function normalizeHolidays(payload, country, year) {
  if (!Array.isArray(payload) || payload.length > 1000) throw unavailable();
  const result = new Map();
  for (const item of payload) {
    if (!item || item.countryCode !== country || item.global !== true || !item.types?.includes('Public')) continue;
    if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !item.date.startsWith(`${year}-`)) continue;
    const date = new Date(`${item.date}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== item.date) continue;
    if (typeof item.localName !== 'string' || typeof item.name !== 'string' || !item.localName.trim() || !item.name.trim()) continue;
    const id = item.date.replaceAll('-', '') + createHash('sha256').update(JSON.stringify([country, item.date, item.name, item.localName])).digest('hex').slice(0, 16);
    result.set(id, { _id: id, type: 'holiday', title: item.localName.slice(0, 200), internationalName: item.name.slice(0, 200), startsAt: date, date, categories: ['holiday'] });
  }
  return [...result.values()];
}

async function fetchHolidays(country, year) {
  if (!/^[A-Z]{2}$/.test(country || '') || !Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new AppError('Holiday year or country is not supported', 400, 'HOLIDAYS_RANGE_UNSUPPORTED');
  }
  const key = `${country}:${year}`;
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.promise;
  const promise = (async () => {
    try {
      const response = await fetch(`${BASE}/${year}/${country}`, {
        headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw unavailable();
      return normalizeHolidays(await response.json(), country, year);
    } catch { throw unavailable(); }
  })();
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, { promise, expiresAt: Date.now() + TTL });
  try { return await promise; } catch (error) {
    if (cache.get(key)?.promise === promise) cache.delete(key);
    throw error;
  }
}

function withCalendar(event, calendar) {
  return { ...event, calendarId: calendar._id, color: calendar.color };
}

async function listHolidays(calendar, filters, from, to) {
  if (!calendar.countryCode || (filters.types.length && !filters.types.includes('holiday')) ||
      (filters.categories.length && !filters.categories.includes('holiday'))) return [];
  const years = [];
  for (let year = from.getUTCFullYear(); year <= to.getUTCFullYear(); year += 1) years.push(year);
  const result = (await Promise.all(years.map((year) => fetchHolidays(calendar.countryCode, year)))).flat();
  return result.filter((event) => event.date >= from && event.date <= to).map((event) => withCalendar(event, calendar));
}

async function getHoliday(calendar, id) {
  if (!calendar.countryCode || !/^\d{8}[a-f0-9]{16}$/.test(id)) return null;
  const year = Number(id.slice(0, 4));
  if (year < 1900 || year > 2100) return null;
  const event = (await fetchHolidays(calendar.countryCode, year)).find((item) => item._id === id);
  return event ? withCalendar(event, calendar) : null;
}

module.exports = { listHolidays, getHoliday, normalizeHolidays };
