export function formatSharedEventDate(value, locale, timeZone = 'UTC') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium', timeStyle: 'short', timeZone,
  }).format(date);
}

export function updateSharedEventFilters(current, field, value) {
  if (field !== 'from' && field !== 'to' && field !== 'page') return current;
  return { ...current, [field]: value, ...(field === 'page' ? {} : { page: 1 }) };
}
