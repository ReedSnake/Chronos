import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';
import { CalendarCollaborationPanel } from '../features/calendars/CalendarCollaborationPanel';

function calendarRoleLabel(t, role) {
  const key = `calendarRoles.${role}`;
  const translated = t(key);
  return translated === key ? role : translated;
}

export function CalendarsPage() {
  const { status } = useAuth();
  const { localizedPath, t } = useLocale();
  const [calendars, setCalendars] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [countryCode, setCountryCode] = useState('');
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [defaultView, setDefaultView] = useState('month');
  const [defaultEventDurationMinutes, setDefaultEventDurationMinutes] = useState(60);
  const [isMain, setIsMain] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadCalendars() {
    setLoading(true);
    setError('');
    try {
      const result = await applicationContainer.calendarService.list();
      setCalendars(result.calendars);
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === 'authenticated') void loadCalendars();
    else if (status !== 'loading') setLoading(false);
  }, [status]);

  async function createCalendar(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await applicationContainer.calendarService.create({
        name: name.trim(), description, color, countryCode: countryCode.trim() || null,
        timeZone, defaultView, defaultEventDurationMinutes, isMain,
      });
      setCalendars((current) => [result.calendar, ...current]);
      setName('');
      setDescription('');
      setCountryCode('');
      setIsMain(false);
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveCalendar(calendar) {
    const values = { ...(editValues[calendar.id] || {
      name: calendar.name, description: calendar.description, color: calendar.color,
      countryCode: calendar.countryCode || '', timeZone: calendar.timeZone, defaultView: calendar.defaultView,
      defaultEventDurationMinutes: calendar.defaultEventDurationMinutes, isMain: calendar.isMain, isArchived: calendar.isArchived,
    }) };
    if (!calendar.isOwner) delete values.isMain;
    try {
      const result = await applicationContainer.calendarService.update(calendar.id, values);
      setCalendars((current) => current.map((item) => (item.id === calendar.id ? result.calendar : item)));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.updateError'));
    }
  }

  async function removeCalendar(calendar) {
    if (!window.confirm(t('calendars.confirmDelete', { name: calendar.name }))) return;
    try {
      await applicationContainer.calendarService.remove(calendar.id);
      setCalendars((current) => current.filter((item) => item.id !== calendar.id));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.deleteError'));
    }
  }

  if (status === 'loading' || loading) return <PageTemplate><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (status !== 'authenticated') return <PageTemplate><p>{t('calendars.signInBefore')}<Link to={localizedPath('/login')}>{t('common.signIn')}</Link>{t('calendars.signInAfter')}</p></PageTemplate>;

  return (
    <section className="account-section">
      <h1>{t('calendars.title')}</h1>
      <details className="account-card"><summary>{t('calendars.createTitle')}</summary>
      <form className="account-form" onSubmit={createCalendar}>
        <label htmlFor="calendar-name">{t('calendars.name')}</label>
        <input id="calendar-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
        <label htmlFor="calendar-color">{t('calendars.color')}</label>
        <input id="calendar-color" type="color" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} />
        <label htmlFor="calendar-description">{t('calendars.description')}</label>
        <textarea id="calendar-description" value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} />
        <label htmlFor="calendar-country">{t('calendars.countryCode')}</label>
        <input id="calendar-country" value={countryCode} maxLength={2} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} />
        <label htmlFor="calendar-time-zone">{t('calendars.timeZone')}</label>
        <input id="calendar-time-zone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} maxLength={100} required />
        <label htmlFor="calendar-default-view">{t('calendars.defaultView')}</label>
        <select id="calendar-default-view" value={defaultView} onChange={(event) => setDefaultView(event.target.value)}><option value="month">{t('calendars.viewMonth')}</option><option value="agenda">{t('calendars.viewAgenda')}</option></select>
        <label htmlFor="calendar-default-duration">{t('calendars.defaultDuration')}</label>
        <input id="calendar-default-duration" type="number" min="5" max="1440" value={defaultEventDurationMinutes} onChange={(event) => setDefaultEventDurationMinutes(Number(event.target.value))} required />
        <label><input type="checkbox" checked={isMain} onChange={(event) => setIsMain(event.target.checked)} />{t('calendars.isMain')}</label>
        <button type="submit" disabled={submitting}>{submitting ? t('calendars.creating') : t('calendars.create')}</button>
      </form>
      </details>
      {error && <p role="alert">{error}</p>}
      {!calendars.length && <p>{t('calendars.empty')}</p>}
      {calendars.map((calendar) => {
        const canManage = calendar.role === 'owner' || calendar.role === 'admin';
        const canEdit = calendar.role !== 'viewer';
        const edit = editValues[calendar.id] || {
          name: calendar.name, description: calendar.description, color: calendar.color,
          countryCode: calendar.countryCode || '', timeZone: calendar.timeZone, defaultView: calendar.defaultView,
          defaultEventDurationMinutes: calendar.defaultEventDurationMinutes, isMain: calendar.isMain, isArchived: calendar.isArchived,
        };
        return (
          <section key={calendar.id} className="account-card">
            <h2><span className="calendar-color" style={{ background: calendar.color }} />{calendar.name}</h2>
            <p>{t('calendars.role', { role: calendarRoleLabel(t, calendar.role) })}</p>
            <Link className="back-link" to={localizedPath(`/calendars/view/${calendar.id}`)}>{t('calendars.view')}</Link>
            {canEdit && <details className="account-form">
              <summary>{t('calendars.editTitle')}</summary>
              <label htmlFor={`edit-name-${calendar.id}`}>{t('calendars.name')}</label>
              <input id={`edit-name-${calendar.id}`} value={edit.name} maxLength={120} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, name: event.target.value } }))} />
              <label htmlFor={`edit-description-${calendar.id}`}>{t('calendars.description')}</label>
              <textarea id={`edit-description-${calendar.id}`} value={edit.description} maxLength={2000} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, description: event.target.value } }))} />
              <label htmlFor={`edit-color-${calendar.id}`}>{t('calendars.color')}</label>
              <input id={`edit-color-${calendar.id}`} type="color" value={edit.color} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, color: event.target.value.toUpperCase() } }))} />
              <label htmlFor={`edit-country-${calendar.id}`}>{t('calendars.countryCode')}</label>
              <input id={`edit-country-${calendar.id}`} value={edit.countryCode} maxLength={2} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, countryCode: event.target.value.toUpperCase() || null } }))} />
              <label htmlFor={`edit-time-zone-${calendar.id}`}>{t('calendars.timeZone')}</label>
              <input id={`edit-time-zone-${calendar.id}`} value={edit.timeZone} maxLength={100} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, timeZone: event.target.value } }))} />
              <label htmlFor={`edit-default-view-${calendar.id}`}>{t('calendars.defaultView')}</label>
              <select id={`edit-default-view-${calendar.id}`} value={edit.defaultView} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, defaultView: event.target.value } }))}><option value="month">{t('calendars.viewMonth')}</option><option value="agenda">{t('calendars.viewAgenda')}</option></select>
              <label htmlFor={`edit-default-duration-${calendar.id}`}>{t('calendars.defaultDuration')}</label>
              <input id={`edit-default-duration-${calendar.id}`} type="number" min="5" max="1440" value={edit.defaultEventDurationMinutes} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, defaultEventDurationMinutes: Number(event.target.value) } }))} />
              <label><input type="checkbox" checked={Boolean(edit.isArchived)} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, isArchived: event.target.checked } }))} />{t('calendars.archived')}</label>
              {calendar.isOwner && <label><input type="checkbox" checked={Boolean(edit.isMain)} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, isMain: event.target.checked } }))} />{t('calendars.isMain')}</label>}
              <button type="button" onClick={() => { void saveCalendar(calendar); }}>{t('calendars.save')}</button>
            </details>}
            {canManage && <button type="button" className="danger-button" onClick={() => { void removeCalendar(calendar); }}>{t('calendars.delete')}</button>}
            {canManage && <CalendarCollaborationPanel calendar={calendar} />}
          </section>
        );
      })}
    </section>
  );
}
