import { DateField } from '../components/forms/DateField';
import { FlowSurface } from '../components/layout/FlowSurface';
import { useEffect, useRef, useState } from 'react';
import { applicationContainer } from '../app/applicationContainer';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';
import { formatSharedEventDate, updateSharedEventFilters } from '../features/calendars/sharedEvents';

function calendarRoleLabel(t, role) {
  const key = `calendarRoles.${role}`;
  const translated = t(key);
  return translated === key ? role : translated;
}

function tokenFromHash() {
  return new URLSearchParams(window.location.hash.slice(1)).get('token');
}

export function CalendarSharePage() {
  const { localizedPath, locale, t } = useLocale();
  const token = useRef(tokenFromHash()).current;
  const [calendar, setCalendar] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({ from: '', to: '', page: 1, limit: 20 });
  const [eventsLoading, setEventsLoading] = useState(false);
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

  useEffect(() => {
    if (!token || !calendar) return undefined;
    let active = true;
    setEventsLoading(true);
    setEventsError('');
    applicationContainer.calendarService.listSharedEvents(token, filters)
      .then((result) => {
        if (!active) return;
        setEvents(result.events);
        setPagination(result.pagination);
      })
      .catch((requestError) => {
        if (active) setEventsError(getLocalizedApiError(requestError, t, 'calendarShare.eventsError'));
      })
      .finally(() => { if (active) setEventsLoading(false); });
    return () => { active = false; };
  }, [token, calendar?.id, filters, t]);

  async function save(event) {
    event.preventDefault();
    setSaveError('');
    try {
      const result = await applicationContainer.calendarService.updateShared(token, { name: name.trim(), description, color });
      setCalendar(result.calendar);
    } catch (requestError) {
      setSaveError(getLocalizedApiError(requestError, t, 'calendarShare.saveError'));
    }
  }

  const title = locale === 'uk' ? 'Спільний календар' : 'Shared calendar';
  if (loading) return <FlowSurface title={title}><p role="status">{t('common.loading')}</p></FlowSurface>;
  if (error) return <FlowSurface title={title} icon="x" tone="error"><p role="alert">{error}</p></FlowSurface>;
  const canEdit = calendar.role === 'editor' || calendar.role === 'admin';

  return (
    <FlowSurface title={calendar.name} icon="calendar-week">
      <p className="flow-muted">{t('calendarShare.role', { role: calendarRoleLabel(t, calendar.role) })}</p>
      {saveError && <p role="alert">{saveError}</p>}
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
      <section className="account-card calendar-events-panel" aria-label={t('calendarShare.eventsTitle')}>
        <h2>{t('calendarShare.eventsTitle')}</h2>
        <div className="calendar-filter-grid">
          <label>{t('calendarView.from')}
            <DateField value={filters.from} onChange={(event) => setFilters((current) => updateSharedEventFilters(current, 'from', event.target.value))} />
          </label>
          <label>{t('calendarView.to')}
            <DateField value={filters.to} onChange={(event) => setFilters((current) => updateSharedEventFilters(current, 'to', event.target.value))} />
          </label>
        </div>
        {eventsLoading && <p role="status">{t('common.loading')}</p>}
        {eventsError && <p role="alert">{eventsError}</p>}
        {!eventsLoading && !eventsError && !events.length && <p>{t('calendarShare.noEvents')}</p>}
        {!eventsLoading && !eventsError && events.map((item) => (
          <article className="event-list-item" key={item.occurrenceId || item.id} style={{ borderLeftColor: item.color }}>
            <div>
              <strong>{item.title}</strong>
              <span>{t(`calendarView.type.${item.type}`)} · {formatSharedEventDate(item.startsAt, locale, calendar.timeZone)}</span>
              {item.endsAt && <span>{t('calendarShare.endsAt', { date: formatSharedEventDate(item.endsAt, locale, calendar.timeZone) })}</span>}
            </div>
            {item.description && <p>{item.description}</p>}
          </article>
        ))}
        {!eventsError && pagination?.totalPages > 1 && <div className="button-row">
          <button type="button" disabled={eventsLoading || pagination.page <= 1} onClick={() => setFilters((current) => updateSharedEventFilters(current, 'page', current.page - 1))}>{t('calendarView.previousPage')}</button>
          <span>{t('calendarView.page', { page: pagination.page, total: pagination.totalPages })}</span>
          <button type="button" disabled={eventsLoading || pagination.page >= pagination.totalPages} onClick={() => setFilters((current) => updateSharedEventFilters(current, 'page', current.page + 1))}>{t('calendarView.nextPage')}</button>
        </div>}
      </section>
    </FlowSurface>
  );
}
