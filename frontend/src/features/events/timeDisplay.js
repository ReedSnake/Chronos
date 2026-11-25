export function formatEventTime(value, locale, zone, timeFormat = '24h') {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: zone, hourCycle: timeFormat === '12h' ? 'h12' : 'h23' });
}

export function formatMinute(minute, locale, timeFormat = '24h') {
  if (timeFormat !== '12h') return String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
  return formatEventTime(new Date(Date.UTC(2000, 0, 1, Math.floor(minute / 60), minute % 60)), locale, 'UTC', timeFormat);
}
