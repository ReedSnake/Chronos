const TIME_ZONE_DATA_URL = 'https://raw.githubusercontent.com/eggert/tz/main/zone1970.tab';
const REQUEST_TIMEOUT_MS = 5000;
const UNAVAILABLE_MESSAGE = 'Unable to load time zones. Please try again later or refresh the page.';

function parseTimeZones(data) {
  if (typeof data !== 'string') throw new Error(UNAVAILABLE_MESSAGE);

  const zones = new Set(['UTC']);
  for (const line of data.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const [, , timeZone] = line.split('\t');
    if (typeof timeZone === 'string' && timeZone.includes('/')) zones.add(timeZone);
  }

  if (zones.size === 1) throw new Error(UNAVAILABLE_MESSAGE);
  return ['UTC', ...[...zones].filter((timeZone) => timeZone !== 'UTC').sort()];
}

export class TimeZoneService {
  async getAvailableTimeZones() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(TIME_ZONE_DATA_URL, {
        method: 'GET',
        headers: { Accept: 'text/plain' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(UNAVAILABLE_MESSAGE);
      return parseTimeZones(await response.text());
    } catch {
      throw new Error(UNAVAILABLE_MESSAGE);
    } finally {
      clearTimeout(timeout);
    }
  }
}
