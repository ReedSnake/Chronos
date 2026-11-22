import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';

function calendarRoleLabel(t, role) {
  const key = `calendarRoles.${role}`;
  const translated = t(key);
  return translated === key ? role : translated;
}

function tokenFromHash() {
  return new URLSearchParams(window.location.hash.slice(1)).get('token');
}

export function CalendarSharePage() {
  const navigate = useNavigate();
  const { localizedPath, t } = useLocale();
  const token = useRef(tokenFromHash()).current;
  const [calendar, setCalendar] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.history.replaceState(window.history.state, '', localizedPath('/calendar-share'));
    if (!token) {
      setError(t('calendarShare.invalid'));
      setLoading(false);
      return;
    }
    applicationContainer.calendarService.getShared(token)
      .then((result) => {
        setCalendar(result.calendar);
        setName(result.calendar.name);
        setDescription(result.calendar.description);
        setColor(result.calendar.color);
      })
      .catch((requestError) => setError(getLocalizedApiError(requestError, t, 'calendarShare.invalid')))
      .finally(() => setLoading(false));
  }, [localizedPath, t, token]);

  async function save(event) {
    event.preventDefault();
    try {
      const result = await applicationContainer.calendarService.updateShared(token, { name: name.trim(), description, color });
      setCalendar(result.calendar);
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendarShare.saveError'));
    }
  }

  async function remove() {
    if (!window.confirm(t('calendarShare.confirmDelete'))) return;
    try {
      await applicationContainer.calendarService.deleteShared(token);
      navigate(localizedPath('/'), { replace: true });
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendarShare.deleteError'));
    }
  }

  if (loading) return <PageTemplate><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (error) return <PageTemplate><p role="alert">{error}</p></PageTemplate>;
  const canEdit = calendar.role === 'editor' || calendar.role === 'admin';

  return (
    <section className="account-section">
      <h1>{calendar.name}</h1>
      <p>{t('calendarShare.role', { role: calendarRoleLabel(t, calendar.role) })}</p>
      {canEdit ? (
        <form className="account-card account-form" onSubmit={save}>
          <label htmlFor="shared-calendar-name">{t('calendars.name')}</label>
          <input id="shared-calendar-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
          <label htmlFor="shared-calendar-description">{t('calendarShare.description')}</label>
          <textarea id="shared-calendar-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
          <label htmlFor="shared-calendar-color">{t('calendars.color')}</label>
          <input id="shared-calendar-color" type="color" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} />
          <button type="submit">{t('calendarShare.save')}</button>
        </form>
      ) : <p>{calendar.description || t('calendarShare.noDescription')}</p>}
      {calendar.role === 'admin' && <button type="button" className="danger-button" onClick={() => { void remove(); }}>{t('calendarShare.delete')}</button>}
    </section>
  );
}
