import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { useAuth } from '../features/auth/AuthContext';

const users = applicationContainer.userService;
const countries = applicationContainer.countryService;
const timeZoneService = applicationContainer.timeZoneService;
const DEFAULT_SETTINGS = Object.freeze({
  language: 'en', timeZone: 'UTC', weekStartsOn: 'monday', timeFormat: '24h',
});

function normalizeSettings(values) {
  const settings = { ...DEFAULT_SETTINGS, ...values };
  return {
    ...settings,
    language: settings.language === 'uk' ? 'uk' : 'en',
    timeZone: typeof settings.timeZone === 'string' && settings.timeZone
      ? settings.timeZone
      : DEFAULT_SETTINGS.timeZone,
  };
}

function groupTimeZones(timeZones) {
  const groups = new Map();
  for (const timeZone of timeZones) {
    if (!timeZone.includes('/')) continue;
    const [region] = timeZone.split('/');
    const zones = groups.get(region) || [];
    zones.push(timeZone);
    groups.set(region, zones);
  }
  return [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([region, zones]) => ({ region, zones }));
}

export function AccountPage() {
  const navigate = useNavigate();
  const { setAuthenticated, setAnonymous } = useAuth();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ name: '', bio: '' });
  const [country, setCountry] = useState('');
  const [availableCountries, setAvailableCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countriesError, setCountriesError] = useState('');
  const [countryReload, setCountryReload] = useState(0);
  const [timeZones, setTimeZones] = useState([]);
  const [timeZonesLoading, setTimeZonesLoading] = useState(true);
  const [timeZonesError, setTimeZonesError] = useState('');
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
      .catch((requestError) => { if (alive) setError(requestError.message || 'Unable to load account.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setCountriesLoading(true);
    setCountriesError('');
    countries.getAvailableCountries()
      .then((result) => { if (alive) setAvailableCountries(result); })
      .catch((requestError) => {
        if (alive) setCountriesError(requestError.message || 'Unable to load countries. Please try again later or refresh the page.');
      })
      .finally(() => { if (alive) setCountriesLoading(false); });
    return () => { alive = false; };
  }, [countryReload]);

  useEffect(() => {
    let alive = true;
    setTimeZonesLoading(true);
    setTimeZonesError('');
    timeZoneService.getAvailableTimeZones()
      .then((result) => { if (alive) setTimeZones(result); })
      .catch((requestError) => {
        if (alive) setTimeZonesError(requestError.message || 'Unable to load time zones. Please try again later or refresh the page.');
      })
      .finally(() => { if (alive) setTimeZonesLoading(false); });
    return () => { alive = false; };
  }, [timeZoneReload]);

  async function submit(action, message) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const { user: result } = await action();
      updateState(result);
      setStatus(message);
    } catch (requestError) {
      setError(requestError.message || 'Unable to save changes.');
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
      navigate('/login', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign out.');
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!window.confirm('Delete your account and profile permanently? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    try {
      await users.deleteAccount();
      setAnonymous();
      navigate('/register', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete account.');
      setBusy(false);
    }
  }

  function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError('Choose a JPEG, PNG or WebP image up to 2 MB.');
      event.target.value = '';
      return;
    }
    void submit(() => users.uploadAvatar(file), 'Profile picture updated.');
    event.target.value = '';
  }

  function updateCountry(event) {
    event.preventDefault();
    if (!country || country === user.country) return;
    void submit(() => users.updateCountry(country), 'Country updated.');
  }

  function removeCountry() {
    void submit(() => users.updateCountry(null), 'Country removed.');
  }

  const timeZoneGroups = groupTimeZones(timeZones);
  const selectedTimeZoneIsAvailable = timeZones.includes(settings.timeZone);

  return (
    <section className="account-section">
      <h1>Account</h1>
      {loading && <p role="status">Loading account...</p>}
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      {!loading && !user && <p><Link to="/login">Sign in</Link></p>}
      {user && <>
        <p>Email: <strong>{user.email}</strong> {user.emailVerified ? '(verified)' : '(not verified)'}</p>
        <p>Your ID: <code>{user.id}</code></p>
        <div className="account-card">
          <h2>Profile picture</h2>
          {user.avatarUrl && <img alt="Your profile avatar" className="profile-avatar"
            src={users.imageUrl(user.avatarUrl)} />}
          <label htmlFor="avatar-file">Upload a picture (JPEG, PNG or WebP, up to 2 MB)</label>
          <input id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp"
            disabled={busy} onChange={upload} />
          {user.avatarUrl && <button type="button" disabled={busy}
            onClick={() => submit(() => users.removeAvatar(), 'Picture removed.')}>Remove picture</button>}
        </div>
        <form className="account-card account-form" onSubmit={(event) => {
          event.preventDefault();
          void submit(() => users.updateProfile(profile), 'Profile updated.');
        }}>
          <h2>Edit profile</h2>
          <label htmlFor="profile-name">Name</label>
          <input id="profile-name" value={profile.name} maxLength={120} required
            onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
          <label htmlFor="profile-bio">About me</label>
          <textarea id="profile-bio" value={profile.bio} maxLength={500} rows={4}
            onChange={(event) => setProfile({ ...profile, bio: event.target.value })} />
          <button type="submit" disabled={busy}>Save profile</button>
        </form>
        <form className="account-card account-form" onSubmit={updateCountry}>
          <h2>Country</h2>
          {countriesLoading && <p role="status">Loading countries...</p>}
          {countriesError && <>
            <p role="alert">{countriesError}</p>
            <button type="button" disabled={busy} onClick={() => setCountryReload((value) => value + 1)}>Try again</button>
          </>}
          {!countriesLoading && !countriesError && <>
            <label htmlFor="profile-country">Country</label>
            <select id="profile-country" value={country} disabled={busy}
              onChange={(event) => setCountry(event.target.value)}>
              <option value="">Select a country</option>
              {availableCountries.map((availableCountry) => (
                <option key={availableCountry.countryCode} value={availableCountry.countryCode}>
                  {availableCountry.name}
                </option>
              ))}
            </select>
            {country && country !== user.country && <button type="submit" disabled={busy}>Save country</button>}
          </>}
          {user.country && <button type="button" disabled={busy} onClick={removeCountry}>Remove country</button>}
        </form>
        <form className="account-card account-form" onSubmit={(event) => {
          event.preventDefault();
          void submit(() => users.updateSettings(settings), 'Preferences saved.');
        }}>
          <h2>Preferences</h2>
          <label htmlFor="profile-language">Language</label>
          <select id="profile-language" value={settings.language}
            onChange={(event) => setSettings({ ...settings, language: event.target.value })}>
            <option value="en">English</option><option value="uk">Українська</option>
          </select>
          <label htmlFor="profile-timezone">Time zone (IANA)</label>
          {timeZonesLoading && <p role="status">Loading time zones...</p>}
          {timeZonesError && <>
            <p role="alert">{timeZonesError}</p>
            <button type="button" disabled={busy} onClick={() => setTimeZoneReload((value) => value + 1)}>Try again</button>
          </>}
          {!timeZonesLoading && !timeZonesError && <select id="profile-timezone" value={settings.timeZone}
            disabled={busy} onChange={(event) => setSettings({ ...settings, timeZone: event.target.value })}>
            {!selectedTimeZoneIsAvailable && <option value={settings.timeZone}>{settings.timeZone} (saved value)</option>}
            <option value="UTC">UTC</option>
            {timeZoneGroups.map(({ region, zones }) => (
              <optgroup key={region} label={region}>
                {zones.map((timeZone) => <option key={timeZone} value={timeZone}>{timeZone}</option>)}
              </optgroup>
            ))}
          </select>}
          <label htmlFor="profile-week">Week starts on</label>
          <select id="profile-week" value={settings.weekStartsOn}
            onChange={(event) => setSettings({ ...settings, weekStartsOn: event.target.value })}>
            <option value="monday">Monday</option><option value="sunday">Sunday</option>
          </select>
          <label htmlFor="profile-format">Time format</label>
          <select id="profile-format" value={settings.timeFormat}
            onChange={(event) => setSettings({ ...settings, timeFormat: event.target.value })}>
            <option value="24h">24-hour</option><option value="12h">12-hour</option>
          </select>
          <button type="submit" disabled={busy}>Save preferences</button>
        </form>
        <div className="account-card">
          <h2>Account actions</h2>
          <button type="button" onClick={signOut} disabled={busy}>Sign out</button>
          <button type="button" className="danger-button" onClick={deleteAccount} disabled={busy}>Delete account permanently</button>
        </div>
      </>}
    </section>
  );
}
