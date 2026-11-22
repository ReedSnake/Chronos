import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';

function calendarRoleLabel(t, role) {
  const key = `calendarRoles.${role}`;
  const translated = t(key);
  return translated === key ? role : translated;
}

const EVENT_TYPES = Object.freeze(['arrangement', 'task', 'reminder', 'holiday']);

function twoDigits(value) {
  return String(value).padStart(2, '0');
}

function monthRange(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    from: `${year}-${twoDigits(month + 1)}-01`,
    to: `${year}-${twoDigits(month + 1)}-${twoDigits(lastDay)}`,
  };
}

function eventDateValue(event) {
  return event.startsAt || event.deadline || event.remindAt || event.date || null;
}

function eventDayKey(event, timeZone) {
  const value = eventDateValue(event);
  if (!value) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const getPart = (type) => parts.find((item) => item.type === type)?.value;
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

function eventTimeLabel(event, locale, timeZone) {
  const value = eventDateValue(event);
  if (!value) return '';
  const date = new Date(value);
  if (event.type === 'holiday') return date.toLocaleDateString(locale, { timeZone });
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone });
}

function daysForMonth(month) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const days = Array.from({ length: firstWeekday }, () => null);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  for (let day = 1; day <= lastDay; day += 1) {
    days.push({
      day,
      key: `${year}-${twoDigits(monthIndex + 1)}-${twoDigits(day)}`,
    });
  }
  while (days.length % 7) days.push(null);
  return days;
}

export function CalendarViewPage() {
  const { calendarId } = useParams();
  const navigate = useNavigate();
  const { status } = useAuth();
  const { localizedPath, locale, t } = useLocale();
  const [calendars, setCalendars] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [activeTab, setActiveTab] = useState('events');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [filters, setFilters] = useState(() => ({ ...monthRange(new Date()), types: [], categories: [], page: 1, limit: 50 }));
  const [categoryInput, setCategoryInput] = useState('');
  const [eventView, setEventView] = useState('month');
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status !== 'authenticated') {
      if (status !== 'loading') setLoading(false);
      return;
    }
    setLoading(true);
    applicationContainer.calendarService.list()
      .then((result) => setCalendars(result.calendars))
      .catch((requestError) => setError(getLocalizedApiError(requestError, t, 'calendarView.loadError')))
      .finally(() => setLoading(false));
  }, [status, t]);

  useEffect(() => {
    if (status !== 'authenticated' || !calendarId) {
      setCalendar(null);
      return;
    }
    applicationContainer.calendarService.get(calendarId)
      .then((result) => {
        setCalendar(result.calendar);
        setEventView(result.calendar.defaultView === 'agenda' ? 'agenda' : 'month');
      })
      .catch((requestError) => setError(getLocalizedApiError(requestError, t, 'calendarView.loadError')));
  }, [calendarId, status, t]);

  useEffect(() => {
    if (status !== 'authenticated' || !calendarId || activeTab !== 'events') return;
    setEventsLoading(true);
    setEvents([]);
    applicationContainer.calendarService.listEvents(calendarId, filters)
      .then((result) => { setEvents(result.events); setPagination(result.pagination); })
      .catch((requestError) => setError(getLocalizedApiError(requestError, t, 'calendarView.eventsError')))
      .finally(() => setEventsLoading(false));
  }, [activeTab, calendarId, filters, status, t]);

  const eventsByDay = useMemo(() => events.reduce((result, event) => {
    const day = eventDayKey(event, calendar?.timeZone || 'UTC');
    if (day) result[day] = [...(result[day] || []), event];
    return result;
  }, {}), [calendar?.timeZone, events]);
  const days = useMemo(() => daysForMonth(month), [month]);

  function chooseCalendar(id) {
    navigate(localizedPath(`/calendars/view/${id}`));
  }

  function moveMonth(offset) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setFilters((current) => ({ ...current, ...monthRange(next), page: 1 }));
  }

  function toggleType(type) {
    setFilters((current) => ({
      ...current,
      page: 1,
      types: current.types.includes(type)
        ? current.types.filter((item) => item !== type)
        : [...current.types, type],
    }));
  }

  function updateCategories(value) {
    setCategoryInput(value);
    setFilters((current) => ({ ...current, page: 1, categories: value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean) }));
  }

  if (status === 'loading' || loading) return <PageTemplate><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (status !== 'authenticated') return <PageTemplate><p>{t('calendarView.signInBefore')}<Link to={localizedPath('/login')}>{t('common.signIn')}</Link>{t('calendarView.signInAfter')}</p></PageTemplate>;

  return (
    <section className="calendar-view-page">
      <header className="calendar-view-header">
        <div><h1>{calendar?.name || t('calendarView.title')}</h1>{calendar && <p>{t('calendars.role', { role: calendarRoleLabel(t, calendar.role) })}</p>}</div>
        <Link className="back-link" to={localizedPath('/calendars')}>{t('calendarView.manageCalendars')}</Link>
      </header>
      {error && <p role="alert">{error}</p>}
      {!calendars.length && <section className="account-card"><p>{t('calendarView.empty')}</p></section>}
      {calendars.length > 0 && <section className="calendar-picker" aria-label={t('calendarView.chooseCalendar')}>
        <h2>{t('calendarView.chooseCalendar')}</h2>
        <div className="button-row">{calendars.map((item) => <button key={item.id} type="button" className={item.id === calendarId ? 'active-calendar-button' : ''} onClick={() => chooseCalendar(item.id)}><span className="calendar-color" style={{ background: item.color }} />{item.name}</button>)}</div>
      </section>}
      {calendar && <>
        <div className="calendar-tabs" role="tablist" aria-label={t('calendarView.tabsLabel')}>
          <button type="button" role="tab" aria-selected={activeTab === 'events'} className={activeTab === 'events' ? 'active-calendar-tab' : ''} onClick={() => setActiveTab('events')}>{t('calendarView.eventsTab')}</button>
          <button type="button" role="tab" aria-selected={activeTab === 'info'} className={activeTab === 'info' ? 'active-calendar-tab' : ''} onClick={() => setActiveTab('info')}>{t('calendarView.infoTab')}</button>
        </div>
        {activeTab === 'events' && <section className="account-card calendar-events-panel" role="tabpanel">
          <div className="calendar-filter-grid">
            <label>{t('calendarView.from')}<input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value, page: 1 }))} /></label>
            <label>{t('calendarView.to')}<input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value, page: 1 }))} /></label>
          </div>
          <fieldset className="event-category-filters"><legend>{t('calendarView.types')}</legend>{EVENT_TYPES.map((type) => <label key={type}><input type="checkbox" checked={filters.types.includes(type)} onChange={() => toggleType(type)} />{t(`calendarView.type.${type}`)}</label>)}</fieldset>
          <label>{t('calendarView.categories')}<input value={categoryInput} onChange={(event) => updateCategories(event.target.value)} placeholder={t('calendarView.categoriesPlaceholder')} /></label>
          {eventView === 'month' && <><div className="calendar-month-navigation"><button type="button" onClick={() => moveMonth(-1)}>{t('calendarView.previousMonth')}</button><h2>{month.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: calendar.timeZone })}</h2><button type="button" onClick={() => moveMonth(1)}>{t('calendarView.nextMonth')}</button></div>
          <div className="calendar-weekdays">{['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((weekday) => <span key={weekday}>{t(`calendarView.weekday.${weekday}`)}</span>)}</div>
          <div className="calendar-grid">{days.map((day, index) => day ? <div className="calendar-day" key={day.key}><strong>{day.day}</strong>{(eventsByDay[day.key] || []).map((event) => <article className="calendar-event" style={{ borderColor: event.color }} key={event.id}><span>{t(`calendarView.type.${event.type}`)}</span><strong>{event.title}</strong></article>)}</div> : <div className="calendar-day calendar-day-empty" key={`empty-${index}`} />)}</div></>}
          {eventsLoading && <p role="status">{t('common.loading')}</p>}
          {!eventsLoading && !events.length && <p>{t('calendarView.noEvents')}</p>}
          {!eventsLoading && events.length > 0 && <div className="event-list"><h2>{t('calendarView.eventsTitle')}</h2>{events.map((event) => <article className="event-list-item" key={event.id} style={{ borderLeftColor: event.color }}><div><strong>{event.title}</strong><span>{t(`calendarView.type.${event.type}`)} · {eventTimeLabel(event, locale, calendar.timeZone)}</span>{event.categories?.length > 0 && <span>{event.categories.join(', ')}</span>}</div>{event.description && <p>{event.description}</p>}</article>)}</div>}
          {pagination?.totalPages > 1 && <div className="button-row"><button type="button" disabled={pagination.page === 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>{t('calendarView.previousPage')}</button><span>{t('calendarView.page', { page: pagination.page, total: pagination.totalPages })}</span><button type="button" disabled={pagination.page === pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>{t('calendarView.nextPage')}</button></div>}
        </section>}
        {activeTab === 'info' && <section className="account-card calendar-info-panel" role="tabpanel"><h2>{t('calendarView.infoTab')}</h2><p>{calendar.description || t('calendarShare.noDescription')}</p><dl><dt>{t('calendars.color')}</dt><dd><span className="calendar-color" style={{ background: calendar.color }} />{calendar.color}</dd><dt>{t('calendarView.country')}</dt><dd>{calendar.countryCode || t('calendarView.notSet')}</dd><dt>{t('calendarView.timeZone')}</dt><dd>{calendar.timeZone}</dd><dt>{t('calendarView.defaultView')}</dt><dd>{t(`calendarView.view.${calendar.defaultView}`)}</dd><dt>{t('calendarView.defaultDuration')}</dt><dd>{t('calendarView.durationMinutes', { minutes: calendar.defaultEventDurationMinutes })}</dd><dt>{t('calendarView.createdAt')}</dt><dd>{calendar.createdAt ? new Date(calendar.createdAt).toLocaleString(locale, { timeZone: calendar.timeZone }) : t('calendarView.notSet')}</dd></dl></section>}
      </>}
      {!calendar && calendars.length > 0 && <section className="account-card"><p>{t('calendarView.selectCalendar')}</p></section>}
    </section>
  );
}
