import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TablerIcon as Icon } from '../components/layout/TablerIcon';
import '../styles/account-settings.css';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
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
  const { setAccountExitState, signOutPending = false } = useOutletContext() || {};
  const { setAuthenticated, setAnonymous } = useAuth();
  const { locale, localizedPath, t } = useLocale();
  const uk = locale === 'uk';
  const fileRef = useRef(null);
  const lock = useRef(false);
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
  const [accountBusy, setBusy] = useState(false);
  const busy = accountBusy || signOutPending;
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  function updateState(nextUser, preserveDraft = false) {
    setUser(nextUser);
    setAuthenticated(nextUser);
    if (preserveDraft) return;
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

  async function run(action) {
    if (lock.current || signOutPending) return;
    lock.current = true;
    setBusy(true); setError(''); setStatus('');
    try { await action(); }
    catch (requestError) { setError(getLocalizedApiError(requestError, t, 'account.saveError')); }
    finally { lock.current = false; setBusy(false); }
  }

  const profileChanged = !!user && (profile.name !== user.name || profile.bio !== (user.bio || ''));
  const countryChanged = !!user && country !== (user.country || '');
  const preferencesChanged = !!user && JSON.stringify(settings) !== JSON.stringify(normalizeSettings(user.settings));
  const dirty = profileChanged || countryChanged || preferencesChanged;

  useLayoutEffect(() => {
    if (!setAccountExitState) return undefined;
    setAccountExitState({ dirty, busy: accountBusy || loading });
    return () => setAccountExitState({ dirty: false, busy: false });
  }, [setAccountExitState, dirty, accountBusy, loading]);

  function discard() {
    if (user && !lock.current) { updateState(user); setError(''); setStatus(''); }
  }

  function saveAll(event) {
    event.preventDefault();
    if (!dirty || !profile.name.trim() || lock.current) return;
    void run(async () => {
      // Each endpoint is independent. Preserve unsaved fields if a later request fails.
      if (profileChanged) {
        const { user: result } = await users.updateProfile(profile);
        updateState(result, true);
        setProfile({ name: result.name, bio: result.bio || '' });
      }
      if (countryChanged) {
        const { user: result } = await users.updateCountry(country || null);
        updateState(result, true);
        setCountry(result.country || '');
      }
      if (preferencesChanged) {
        const { user: result } = await users.updateSettings(settings);
        updateState(result, true);
        setSettings(normalizeSettings(result.settings));
      }
      setStatus('saved');
    });
  }

  function deleteAccount() {
    if (busy || lock.current || !window.confirm(t('account.actions.confirmDelete'))) return;
    void run(async () => {
      try {
        await users.deleteAccount();
        setAnonymous();
        navigate(localizedPath('/register'), { replace: true });
      } catch (requestError) { setError(getLocalizedApiError(requestError, t, 'account.deleteError')); }
    });
  }

  function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || lock.current) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError(t('account.avatar.invalid'));
      return;
    }
    void run(async () => {
      const { user: result } = await users.uploadAvatar(file);
      updateState(result, true);
      setStatus('account.avatar.updated');
    });
  }

  function removeAvatar() {
    void run(async () => {
      const { user: result } = await users.removeAvatar();
      updateState(result, true);
      setStatus('account.avatar.removed');
    });
  }

  const timeZoneGroups = groupTimeZones(timeZones, locale);
  const selectedTimeZoneIsAvailable = timeZones.includes(settings.timeZone);
  const localizedCountries = useMemo(() => availableCountries
    .map((availableCountry) => ({ ...availableCountry, displayName: formatCountryName(availableCountry.countryCode, locale, availableCountry.name) }))
    .sort((first, second) => first.displayName.localeCompare(second.displayName, locale)), [availableCountries, locale]);

  return (
    <section className="as-page" aria-busy={loading || busy}>
      <form className="as-content" onSubmit={saveAll} aria-label={uk ? 'Налаштування' : 'Settings'}>
        {error && <p className="as-message as-error" role="alert">{error}</p>}
        {status && <p className="as-message" role="status">{status === 'saved' ? (uk ? 'Зміни збережено' : 'Changes saved') : t(status)}</p>}
        <div className="as-cover" aria-hidden="true"/>
        {loading && <div className="as-loading" role="status">{t('account.loading')}</div>}
        {!loading && !user && <p className="as-loading"><Link to={localizedPath('/login')}>{t('account.signIn')}</Link></p>}
        {user && <div className="as-column">
          <div className="as-identity">
            <div className="as-avatar-wrap">
              <button className="as-avatar" type="button" disabled={busy} onClick={() => fileRef.current?.click()} aria-label={t('account.avatar.upload')} title={t('account.avatar.upload')}>{user.avatarUrl ? <img alt={t('account.avatar.alt')} src={users.imageUrl(user.avatarUrl)}/> : <span>{(user.name || user.email || '?').slice(0, 1).toUpperCase()}</span>}<span className="as-avatar-edit"><Icon name="user" size={14}/></span></button>
              <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={upload}/>
            </div>
            <h2>{user.name}</h2><p className="as-email">{user.email}</p>
            <p className="as-subtitle">{uk ? 'Керуйте профілем та налаштуваннями' : 'Manage your profile and preferences'}</p>
          </div>
          <fieldset disabled={busy} className="as-group">
            <legend><Icon name="user" size={17}/>{uk ? 'Профіль' : 'Profile'}</legend>
            <label className="as-row"><span>{t('account.profile.name')}</span><input value={profile.name} maxLength={120} required onChange={event => setProfile(old => ({ ...old, name: event.target.value }))}/></label>
            <label className="as-row"><span>{t('account.profile.bio')}</span><textarea value={profile.bio} maxLength={500} rows={2} placeholder={uk ? 'Додати опис…' : 'Add a bio…'} onChange={event => setProfile(old => ({ ...old, bio: event.target.value }))}/></label>
            <div className="as-row"><span>{t('account.avatar.title')}</span><div className="as-row-actions"><button type="button" onClick={() => fileRef.current?.click()}>{uk ? 'Змінити' : 'Change'}</button>{user.avatarUrl && <button type="button" onClick={removeAvatar}>{t('account.avatar.remove')}</button>}</div></div>
          </fieldset>
          <fieldset disabled={busy} className="as-group">
            <legend><Icon name="lock" size={17}/>{t('account.title')}</legend>
            <div className="as-row"><span>{t('common.email')}</span><span className="as-value">{user.email}</span></div>
            <div className="as-row"><span>{uk ? 'Підтвердження пошти' : 'Email verification'}</span><span className={'as-verification'+(user.emailVerified?' verified':'')}>{user.emailVerified && <Icon name="check" size={13}/>} {t(user.emailVerified ? 'account.emailStatus.verified' : 'account.emailStatus.notVerified')}</span></div>
            <label className="as-row"><span>{t('account.country.title')}</span>
              {countriesLoading ? <small role="status">{t('account.country.loading')}</small> : countriesError ? <span className="as-retry"><small role="alert">{t('account.country.unavailable')}</small><button type="button" onClick={() => setCountryReload(v => v + 1)}>{t('common.retry')}</button></span> : <select value={country} onChange={event => setCountry(event.target.value)}><option value="">{t('account.country.select')}</option>{country && !localizedCountries.some(c => c.countryCode === country) && <option value={country}>{country}</option>}{localizedCountries.map(c => <option key={c.countryCode} value={c.countryCode}>{c.displayName}</option>)}</select>}
            </label>
            <label className="as-row"><span>{t('account.preferences.timeZone')}</span>
              {timeZonesLoading ? <small role="status">{t('account.preferences.timeZonesLoading')}</small> : timeZonesError ? <span className="as-retry"><small role="alert">{t('account.preferences.timeZonesUnavailable')}</small><button type="button" onClick={() => setTimeZoneReload(v => v + 1)}>{t('common.retry')}</button></span> : <select value={settings.timeZone} onChange={event => setSettings(old => ({ ...old, timeZone: event.target.value }))}>{!selectedTimeZoneIsAvailable && settings.timeZone !== 'UTC' && <option value={settings.timeZone}>{settings.timeZone}</option>}<option value="UTC">UTC</option>{timeZoneGroups.map(({ region, zones }) => <optgroup key={region} label={region}>{zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}</optgroup>)}</select>}
            </label>
          </fieldset>
          <fieldset disabled={busy} className="as-group">
            <legend><Icon name="settings" size={17}/>{t('account.preferences.title')}</legend>
            <label className="as-row"><span>{t('account.preferences.weekStartsOn')}</span><select value={settings.weekStartsOn} onChange={event => setSettings(old => ({ ...old, weekStartsOn: event.target.value }))}><option value="monday">{t('account.preferences.monday')}</option><option value="sunday">{t('account.preferences.sunday')}</option></select></label>
            <label className="as-row"><span>{t('account.preferences.timeFormat')}</span><select value={settings.timeFormat} onChange={event => setSettings(old => ({ ...old, timeFormat: event.target.value }))}><option value="24h">{t('account.preferences.format24')}</option><option value="12h">{t('account.preferences.format12')}</option></select></label>
          </fieldset>
          <div className="as-save-row"><div className="as-actions"><button type="button" disabled={busy || !dirty} onClick={discard}>{uk ? 'Скасувати' : 'Discard'}</button><button type="submit" className="as-save" disabled={busy || !dirty || !profile.name.trim()}>{busy ? t('common.loading') : uk ? 'Зберегти зміни' : 'Save changes'}</button></div></div>
          <details className="as-security">
            <summary>{t('account.actions.title')}<Icon name="chevron-down" size={15}/></summary>
            <div className="as-row"><span>{t('account.id')}</span><code>{user.id}</code></div>
            <div className="as-row as-row-actions"><button type="button" className="as-danger" disabled={busy} onClick={deleteAccount}>{t('account.actions.delete')}</button></div>
          </details>
        </div>}
      </form>
    </section>
  );
}
