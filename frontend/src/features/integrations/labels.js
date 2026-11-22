export const KEY_SCOPE_OPTIONS = Object.freeze([
  { value: 'read', labelKey: 'integrations.scopeRead' },
  { value: 'write', labelKey: 'integrations.scopeWrite' },
  { value: 'delete', labelKey: 'integrations.scopeDelete' },
]);

export const SCOPE_RESOURCES = Object.freeze([{ value: 'calendar', labelKey: 'integrations.resourceCalendar' }]);
export const DEFAULT_KEY_INPUT = Object.freeze({ label: '', resource: 'calendar', level: 'write' });

export function scopeLabel(t, scopes) {
  const levels = scopes.map((scope) => scope.split(':').at(-1));
  const selected = [...KEY_SCOPE_OPTIONS].reverse().find((option) => levels.includes(option.value));
  const resource = scopes.some((scope) => scope.startsWith('calendar:'))
    ? t('integrations.resourceCalendar')
    : null;
  return selected
    ? resource ? `${resource}: ${t(selected.labelKey)}` : t(selected.labelKey)
    : scopes.join(', ');
}

export function statusLabel(t, status) {
  const key = `statuses.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

export function scopesLabel(t, scopes) {
  return scopes.map((scope) => scopeLabel(t, [scope])).join(', ');
}

