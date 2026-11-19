import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';

const users = applicationContainer.userService;

export function AccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ name: '', bio: '' });
  const [country, setCountry] = useState('');
  const [settings, setSettings] = useState({ language: 'en', timeZone: 'UTC', weekStartsOn: 'monday', timeFormat: '24h' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  function updateState(nextUser) {
    setUser(nextUser);
    setProfile({ name: nextUser.name, bio: nextUser.bio || '' });
    setCountry(nextUser.country || '');
    setSettings(nextUser.settings);
  }

  useEffect(() => {
    let alive = true;
    users.getMe()
      .then(({ user: result }) => { if (alive) updateState(result); })
      .catch((requestError) => { if (alive) setError(requestError.message || 'Unable to load account.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

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
        <form className="account-card account-form" onSubmit={(event) => {
          event.preventDefault();
          void submit(() => users.updateCountry(country.trim() || null), 'Country updated.');
        }}>
          <h2>Country</h2>
          <label htmlFor="profile-country">Two-letter country code (e.g. UA, DE)</label>
          <input id="profile-country" value={country} maxLength={2} placeholder="UA"
            onChange={(event) => setCountry(event.target.value.toUpperCase())} />
          <button type="submit" disabled={busy}>Save country</button>
        </form>
        <form className="account-card account-form" onSubmit={(event) => {
          event.preventDefault();
          void submit(() => users.updateSettings(settings), 'Preferences saved.');
        }}>
          <h2>Preferences</h2>
          <label htmlFor="profile-language">Language</label>
          <select id="profile-language" value={settings.language}
            onChange={(event) => setSettings({ ...settings, language: event.target.value })}>
            <option value="en">English</option><option value="uk">Українська</option><option value="ru">Русский</option>
          </select>
          <label htmlFor="profile-timezone">Time zone (IANA)</label>
          <input id="profile-timezone" value={settings.timeZone} maxLength={100}
            onChange={(event) => setSettings({ ...settings, timeZone: event.target.value })} />
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
