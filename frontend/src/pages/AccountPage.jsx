import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { useAuth } from '../features/auth/AuthContext';
import { formatCountryName } from '../i18n/formatters';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';

const users = applicationContainer.userService;
const countries = applicationContainer.countryService;
const timeZoneService = applicationContainer.timeZoneService;
const DEFAULT_SETTINGS = Object.freeze({
  timeZone: 'UTC', weekStartsOn: 'monday', timeFormat: '24h',
});

function normalizeSettings(values) {
  const settings = values && typeof values === 'object' ? values : {};
  return {
    weekStartsOn: settings.weekStartsOn === 'sunday' ? 'sunday' : DEFAULT_SETTINGS.weekStartsOn,
    timeFormat: settings.timeFormat === '12h' ? '12h' : DEFAULT_SETTINGS.timeFormat,
    timeZone: typeof settings.timeZone === 'string' && settings.timeZone
      ? settings.timeZone
      : DEFAULT_SETTINGS.timeZone,
  };
}

function groupTimeZones(timeZones, locale) {
  const groups = new Map();
  for (const timeZone of timeZones) {
    if (!timeZone.includes('/')) continue;
    const [region] = timeZone.split('/');
    const zones = groups.get(region) || [];
    zones.push(timeZone);
    groups.set(region, zones);
  }
  return [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second, locale))
    .map(([region, zones]) => ({ region, zones }));
}

export function AccountPage() {
  const navigate = useNavigate();
  const { setAuthenticated, setAnonymous } = useAuth();
  const { locale, localizedPath, t } = useLocale();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ name: '', bio: '' });
  const [country, setCountry] = useState('');
  const [availableCountries, setAvailableCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countriesError, setCountriesError] = useState(false);
  const [countryReload, setCountryReload] = useState(0);
  const [timeZones, setTimeZones] = useState([]);
  const [timeZonesLoading, setTimeZonesLoading] = useState(true);
  const [timeZonesError, setTimeZonesError] = useState(false);
  const [timeZoneReload, setTimeZoneReload] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  function updateState(nextUser) {
    setUser(nextUser);
    setAuthenticated(nextUser);
    setProfile({ name: nextUser.name, bio: nextUser.bio || '' });
    setCountry(nextUser.country || '');
    setSettings(normalizeSettings(nextUser.settings));
  }

  useEffect(() => {
    let alive = true;
    users.getMe()
      .then(({ user: result }) => { if (alive) updateState(result); })
      .catch((requestError) => { if (alive) setError(getLocalizedApiError(requestError, t, 'account.loadError')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setCountriesLoading(true);
    setCountriesError(false);
    countries.getAvailableCountries()
      .then((result) => { if (alive) setAvailableCountries(result); })
      .catch(() => {
        if (alive) setCountriesError(true);
      })
      .finally(() => { if (alive) setCountriesLoading(false); });
    return () => { alive = false; };
  }, [countryReload]);

  useEffect(() => {
    let alive = true;
    setTimeZonesLoading(true);
    setTimeZonesError(false);
    timeZoneService.getAvailableTimeZones()
      .then((result) => { if (alive) setTimeZones(result); })
      .catch(() => {
        if (alive) setTimeZonesError(true);
      })
      .finally(() => { if (alive) setTimeZonesLoading(false); });
    return () => { alive = false; };
  }, [timeZoneReload]);

  async function submit(action, statusKey) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const { user: result } = await action();
      updateState(result);
      setStatus(statusKey);
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'account.saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await applicationContainer.authService.logout();
      setAnonymous();
      navigate(localizedPath('/login'), { replace: true });
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'account.signOutError'));
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!window.confirm(t('account.actions.confirmDelete'))) return;
    setBusy(true);
    setError('');
    try {
      await users.deleteAccount();
      setAnonymous();
      navigate(localizedPath('/register'), { replace: true });
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'account.deleteError'));
      setBusy(false);
    }
  }

  function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError(t('account.avatar.invalid'));
      event.target.value = '';
      return;
    }
    void submit(() => users.uploadAvatar(file), 'account.avatar.updated');
    event.target.value = '';
  }

  function updateCountry(event) {
    event.preventDefault();
    if (!country || country === user.country) return;
    void submit(() => users.updateCountry(country), 'account.country.updated');
  }

  function removeCountry() {
    void submit(() => users.updateCountry(null), 'account.country.removed');
  }

  const timeZoneGroups = groupTimeZones(timeZones, locale);
  const selectedTimeZoneIsAvailable = timeZones.includes(settings.timeZone);
  const localizedCountries = useMemo(() => availableCountries
    .map((availableCountry) => ({ ...availableCountry, displayName: formatCountryName(availableCountry.countryCode, locale, availableCountry.name) }))
    .sort((first, second) => first.displayName.localeCompare(second.displayName, locale)), [availableCountries, locale]);

  return (
    <section className="account-section">
      <h1>{t('account.title')}</h1>
      {loading && <p role="status">{t('account.loading')}</p>}
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{t(status)}</p>}
      {!loading && !user && <p><Link to={localizedPath('/login')}>{t('account.signIn')}</Link></p>}
      {user && <>
        <p>{t('common.email')}: <strong>{user.email}</strong> ({t(user.emailVerified ? 'account.emailStatus.verified' : 'account.emailStatus.notVerified')})</p>
        <p>{t('account.id')}: <code>{user.id}</code></p>
        <div className="account-card">
          <h2>{t('account.avatar.title')}</h2>
          {user.avatarUrl && <img alt={t('account.avatar.alt')} className="profile-avatar"
            src={users.imageUrl(user.avatarUrl)} />}
          <label htmlFor="avatar-file">{t('account.avatar.upload')}</label>
          <input id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp"
            disabled={busy} onChange={upload} />
          {user.avatarUrl && <button type="button" disabled={busy}
            onClick={() => submit(() => users.removeAvatar(), 'account.avatar.removed')}>{t('account.avatar.remove')}</button>}
        </div>
        <form className="account-card account-form" onSubmit={(event) => {
          event.preventDefault();
          void submit(() => users.updateProfile(profile), 'account.profile.updated');
        }}>
          <h2>{t('account.profile.title')}</h2>
          <label htmlFor="profile-name">{t('account.profile.name')}</label>
          <input id="profile-name" value={profile.name} maxLength={120} required
            onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
          <label htmlFor="profile-bio">{t('account.profile.bio')}</label>
          <textarea id="profile-bio" value={profile.bio} maxLength={500} rows={4}
            onChange={(event) => setProfile({ ...profile, bio: event.target.value })} />
          <button type="submit" disabled={busy}>{t('account.profile.save')}</button>
        </form>
        <form className="account-card account-form" onSubmit={updateCountry}>
          <h2>{t('account.country.title')}</h2>
          {countriesLoading && <p role="status">{t('account.country.loading')}</p>}
          {countriesError && <>
            <p role="alert">{t('account.country.unavailable')}</p>
            <button type="button" disabled={busy} onClick={() => setCountryReload((value) => value + 1)}>{t('common.retry')}</button>
          </>}
          {!countriesLoading && !countriesError && <>
            <label htmlFor="profile-country">{t('account.country.title')}</label>
            <select id="profile-country" value={country} disabled={busy}
              onChange={(event) => setCountry(event.target.value)}>
              <option value="">{t('account.country.select')}</option>
              {localizedCountries.map((availableCountry) => (
                <option key={availableCountry.countryCode} value={availableCountry.countryCode}>
                  {availableCountry.displayName}
                </option>
              ))}
            </select>
            {country && country !== user.country && <button type="submit" disabled={busy}>{t('account.country.save')}</button>}
          </>}
          {user.country && <button type="button" disabled={busy} onClick={removeCountry}>{t('account.country.remove')}</button>}
        </form>
        <form className="account-card account-form" onSubmit={(event) => {
          event.preventDefault();
          void submit(() => users.updateSettings(settings), 'account.preferences.updated');
        }}>
          <h2>{t('account.preferences.title')}</h2>
          <label htmlFor="profile-timezone">{t('account.preferences.timeZone')}</label>
          {timeZonesLoading && <p role="status">{t('account.preferences.timeZonesLoading')}</p>}
          {timeZonesError && <>
            <p role="alert">{t('account.preferences.timeZonesUnavailable')}</p>
            <button type="button" disabled={busy} onClick={() => setTimeZoneReload((value) => value + 1)}>{t('common.retry')}</button>
          </>}
          {!timeZonesLoading && !timeZonesError && <select id="profile-timezone" value={settings.timeZone}
            disabled={busy} onChange={(event) => setSettings({ ...settings, timeZone: event.target.value })}>
            {!selectedTimeZoneIsAvailable && <option value={settings.timeZone}>{t('account.preferences.savedTimeZone', { timeZone: settings.timeZone })}</option>}
            <option value="UTC">UTC</option>
            {timeZoneGroups.map(({ region, zones }) => (
              <optgroup key={region} label={region}>
                {zones.map((timeZone) => <option key={timeZone} value={timeZone}>{timeZone}</option>)}
              </optgroup>
            ))}
          </select>}
          <label htmlFor="profile-week">{t('account.preferences.weekStartsOn')}</label>
          <select id="profile-week" value={settings.weekStartsOn}
            onChange={(event) => setSettings({ ...settings, weekStartsOn: event.target.value })}>
            <option value="monday">{t('account.preferences.monday')}</option><option value="sunday">{t('account.preferences.sunday')}</option>
          </select>
          <label htmlFor="profile-format">{t('account.preferences.timeFormat')}</label>
          <select id="profile-format" value={settings.timeFormat}
            onChange={(event) => setSettings({ ...settings, timeFormat: event.target.value })}>
            <option value="24h">{t('account.preferences.format24')}</option><option value="12h">{t('account.preferences.format12')}</option>
          </select>
          <button type="submit" disabled={busy}>{t('account.preferences.save')}</button>
        </form>
        <div className="account-card">
          <h2>{t('account.actions.title')}</h2>
          <button type="button" onClick={signOut} disabled={busy}>{t('account.actions.signOut')}</button>
          <button type="button" className="danger-button" onClick={deleteAccount} disabled={busy}>{t('account.actions.delete')}</button>
        </div>
      </>}
    </section>
  );
}
