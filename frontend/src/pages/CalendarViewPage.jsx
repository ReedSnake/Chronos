import { BlobMascot } from '../components/auth/BlobMascot';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';
import { EventEditor } from '../features/events/EventEditor';
import { EventDetails } from '../features/events/EventDetails';
import { EventDialog } from '../features/events/EventDialog';
import { PlannerGrid, shiftDay, weekDays } from '../features/events/PlannerGrid';
import { TablerIcon as Icon } from '../components/layout/TablerIcon';
import { EVENT_TYPES, eventDayKey, eventDateLabel, fromCalendarInput } from '../features/events/eventForm';

function calendarRoleLabel(t, role) {
  const key = `calendarRoles.${role}`;
  return t(key) === key ? role : t(key);
}

const pad = (value) => String(value).padStart(2, '0');
function monthRange(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`,
  };
}

function daysForMonth(month) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const days = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= new Date(year, monthIndex + 1, 0).getDate(); day += 1) {
    days.push({ day, key: `${year}-${pad(monthIndex + 1)}-${pad(day)}` });
  }
  while (days.length % 7) days.push(null);
  return days;
}

async function fetchAllEvents(calendarId, filters, timeZone) {
  const from = filters.from ? fromCalendarInput(`${filters.from}T00:00`, timeZone) : undefined;
  let to;
  if (filters.to) {
    const following = new Date(`${filters.to}T00:00:00.000Z`);
    following.setUTCDate(following.getUTCDate() + 1);
    const next = fromCalendarInput(`${following.toISOString().slice(0, 10)}T00:00`, timeZone);
    to = new Date(new Date(next).getTime() - 1).toISOString();
  }
  // All pages are loaded for both month cells and agenda, not just page one.
  const events = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await applicationContainer.calendarService.listEvents(calendarId, { ...filters, from, to, page, limit: 100 });
    events.push(...(result.events || []));
    if (page >= result.pagination.totalPages) return events;
  }
  throw new Error('EVENT_RANGE_TOO_LARGE');
}

export function CalendarViewPage() {
  const { calendarId } = useParams();
  const navigate = useNavigate();
  const { status, user } = useAuth();
  const { localizedPath, locale, t } = useLocale();
  const [calendars, setCalendars] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [events, setEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('events');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [filters, setFilters] = useState(() => ({ ...monthRange(new Date()), types: [], categories: [] }));
  const [categoryInput, setCategoryInput] = useState('');
  const [eventView, setEventView] = useState('month');
  const [day, setDay] = useState(()=>eventDayKey({startsAt:new Date()},user?.settings?.timeZone||'UTC'));
  const [timelineCalendars,setTimelineCalendars]=useState([]);
  const [hiddenCalendars,setHiddenCalendars]=useState([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [selection, setSelection] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (status !== 'authenticated') { if (status !== 'loading') setLoading(false); return; }
    let active = true;
    setLoading(true);
    applicationContainer.calendarService.list()
      .then((result) => { if (active) setCalendars(result.calendars); })
      .catch((err) => { if (active) setError(getLocalizedApiError(err, t, 'calendarView.loadError')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status, t]);

  useEffect(() => {
    if (status !== 'authenticated' || !calendarId) { setCalendar(null); return; }
    let active = true;
    setCalendar(null); setSelection(null); setEditorOpen(false);
    applicationContainer.calendarService.get(calendarId)
      .then(({ calendar: item }) => {
        if (!active) return;
        setCalendar(item);
        setEventView(item.defaultView === 'agenda' ? 'agenda' : 'month');
      })
      .catch((err) => { if (active) setError(getLocalizedApiError(err, t, 'calendarView.loadError')); });
    return () => { active = false; };
  }, [calendarId, status, t]);

  useEffect(() => {
    if (status !== 'authenticated' || !calendarId || activeTab !== 'events' || calendar?.id !== calendarId) return;
    let active = true;
    setEventsLoading(true); setEvents([]); setEventsError('');
    const timeline=eventView==='timeline';
    const sources=timeline?calendars.filter(c=>!c.isArchived&&!hiddenCalendars.includes(c.id)):[calendar];
    setTimelineCalendars(sources);
    const request=timeline?Promise.all(sources.map(async c=>(await fetchAllEvents(c.id,filters,calendar.timeZone||'UTC')).map(e=>({...e,calendarId:c.id})))).then(groups=>groups.flat()):fetchAllEvents(calendarId, filters, calendar.timeZone || 'UTC');
    request
      .then((items) => { if (active) setEvents(items); })
      .catch((err) => { if (active) setEventsError(getLocalizedApiError(err, t, 'calendarView.eventsError')); })
      .finally(() => { if (active) setEventsLoading(false); });
    return () => { active = false; };
  }, [activeTab, calendarId, calendar?.id, filters, refresh, status, t, eventView, calendars, hiddenCalendars]);

  const eventsByDay = useMemo(() => events.reduce((grouped, item) => {
    const day = eventDayKey(item, calendar?.timeZone || 'UTC');
    if (day) (grouped[day] ||= []).push(item);
    return grouped;
  }, {}), [calendar?.timeZone, events]);
  const days = useMemo(() => daysForMonth(month), [month]);
  const canEdit = !calendar?.isHolidayCalendar && ['owner', 'admin', 'editor'].includes(calendar?.role);
  const eventCalendar=selection?calendars.find(c=>c.id===selection.calendarId)||calendar:calendar;
  const eventCanEdit=!!eventCalendar&&!eventCalendar.isHolidayCalendar&&!eventCalendar.isArchived&&['owner','admin','editor'].includes(eventCalendar.role);
  const visibleCalendars = calendars.filter((item) => !item.isArchived || item.id === calendarId);
  useEffect(() => {
    if (!calendarId && !loading && visibleCalendars.length) {
      const item = visibleCalendars.find((entry) => entry.isMain && entry.isOwner) || visibleCalendars[0];
      navigate(localizedPath(`/calendars/view/${item.id}`), { replace: true });
    }
  }, [calendarId, loading, calendars, navigate, localizedPath]);

  function chooseCalendar(id) { navigate(localizedPath(`/calendars/view/${id}`)); }
  function moveMonth(offset) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setFilters((current) => ({ ...current, ...monthRange(next) }));
  }
  function toggleType(type) {
    setFilters((current) => ({ ...current, types: current.types.includes(type)
      ? current.types.filter((item) => item !== type) : [...current.types, type] }));
  }
  function updateCategories(value) {
    setCategoryInput(value);
    setFilters((current) => ({ ...current, categories: value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean) }));
  }

  async function startEdit() {
    if (!selection || !eventCanEdit) return;
    setBusy(true); setEventsError('');
    try {
      const { event } = await applicationContainer.calendarService.getEvent(eventCalendar.id, selection.id);
      setEditing(event); setEditorOpen(true);
    } catch (err) { setEventsError(getLocalizedApiError(err, t, 'calendarView.event.loadError')); }
    finally { setBusy(false); }
  }

  async function saveEvent(values) {
    setBusy(true); setEventsError('');
    try {
      if (editing) await applicationContainer.calendarService.updateEvent(eventCalendar.id, editing.id, values);
      else await applicationContainer.calendarService.createEvent(calendarId, values);
      setEditing(null); setEditorOpen(false); setSelection(null);
      setRefresh((current) => current + 1);
    } catch (err) {
      throw new Error(getLocalizedApiError(err, t, 'calendarView.event.saveError'));
    } finally { setBusy(false); }
  }

  async function deleteEvent() {
    if (!selection || !eventCanEdit || !window.confirm(t(selection.isRecurring ? 'calendarView.event.confirmDeleteSeries' : 'calendarView.event.confirmDelete'))) return;
    setBusy(true); setEventsError('');
    try {
      await applicationContainer.calendarService.deleteEvent(eventCalendar.id, selection.id);
      setSelection(null); setRefresh((current) => current + 1);
    } catch (err) { setEventsError(getLocalizedApiError(err, t, 'calendarView.event.deleteError')); }
    finally { setBusy(false); }
  }

  async function sendInvitation(email) {
    if (!selection || !eventCanEdit) return;
    const id = selection.id;
    await applicationContainer.calendarService.sendEventInvitation(eventCalendar.id, id, email);
    // Delivery has succeeded; a subsequent read failure must not suggest that
    // the email was never sent. Refresh the full state when possible.
    try {
      const { event } = await applicationContainer.calendarService.getEvent(eventCalendar.id, id);
      setSelection((current) => current?.id === id ? { ...current, attendees: event.attendees } : current);
    } catch {
      setSelection((current) => current?.id === id ? { ...current, attendees: current.attendees.map((attendee) => attendee.email === email ? { ...attendee, invitationSentAt: new Date().toISOString() } : attendee) } : current);
    }
    setRefresh((current) => current + 1);
  }

  function cancelEdit() { setEditorOpen(false); setEditing(null); }
  function openCreate() { setSelection(null); setEditing(null); setEditorOpen(true); }
  function selectEvent(item) { setSelection(item); setEditorOpen(false); setEditing(null); }
  function setPlannerDate(key,view=eventView) {
    setDay(key);
    const keys=view==='week'?weekDays(key,user?.settings?.weekStartsOn):[key];
    setFilters(current=>({...current,from:keys[0],to:keys[keys.length-1]}));
  }
  function switchView(view) {
    setEventView(view);
    if (view === 'month' || view==='agenda') setFilters((current) => ({ ...current, ...monthRange(month) }));
    else setPlannerDate(day,view);
  }
  const plannerDays=eventView==='week'?weekDays(day,user?.settings?.weekStartsOn):[day];
  const plannerLabel=plannerDays.map(d=>new Date(d+'T12:00:00Z').toLocaleDateString(locale,{month:'short',day:'numeric',timeZone:'UTC'}));
  const viewLabels={timeline:locale==='uk'?'Шкала часу':'Timeline',week:locale==='uk'?'Тиждень':'Week',month:t('calendarView.view.month'),agenda:t('calendarView.view.agenda')};

  if (status === 'loading' || loading) return <PageTemplate><BlobMascot mood="loading" compact /><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (status !== 'authenticated') return <PageTemplate><p>{t('calendarView.signInBefore')}<Link to={localizedPath('/login')}>{t('common.signIn')}</Link>{t('calendarView.signInAfter')}</p></PageTemplate>;

  return <section className="calendar-view-page">
    <header className="calendar-view-header">
      <div><h1>{calendar?.isHolidayCalendar ? t('calendarBasics.holidays') : (calendar?.name || t('calendarView.title'))}</h1>{calendar && <p>{t('calendars.role', { role: calendarRoleLabel(t, calendar.role) })}</p>}</div>
      <Link className="back-link" to={localizedPath('/calendars')}>{t('calendarView.manageCalendars')}</Link>
    </header>
    {error && <p role="alert">{error}</p>}
    {!calendars.length && <section className="account-card"><p>{t('calendarView.empty')}</p></section>}
    {calendars.length > 0 && <section className="calendar-picker" aria-label={t('calendarView.chooseCalendar')}>
      <h2>{t('calendarView.chooseCalendar')}</h2>
      <div className="button-row">{visibleCalendars.map((item) => <button key={item.id} type="button" className={item.id === calendarId ? 'active-calendar-button' : ''} onClick={() => chooseCalendar(item.id)}><span className="calendar-color" style={{ background: item.color }} />{item.isHolidayCalendar ? t('calendarBasics.holidays') : item.name}</button>)}</div>
    </section>}
    {calendar && <>
      <div className="calendar-tabs" role="tablist" aria-label={t('calendarView.tabsLabel')}>
        <button type="button" role="tab" aria-selected={activeTab === 'events'} className={activeTab === 'events' ? 'active-calendar-tab' : ''} onClick={() => setActiveTab('events')}>{t('calendarView.eventsTab')}</button>
        <button type="button" role="tab" aria-selected={activeTab === 'info'} className={activeTab === 'info' ? 'active-calendar-tab' : ''} onClick={() => setActiveTab('info')}>{t('calendarView.infoTab')}</button>
      </div>
      {activeTab === 'events' && <>
        <section className="account-card calendar-events-panel" role="tabpanel">
          <div className="calendar-toolbar">
            <div className="button-row planner-view-controls" role="group" aria-label={t('calendarView.event.viewSwitch')}>
              {['timeline','week','month', 'agenda'].map((view) => <button key={view} type="button" aria-pressed={eventView === view} className={eventView === view ? 'active-calendar-button' : ''} onClick={() => switchView(view)}>{viewLabels[view]}</button>)}
            </div>
            {canEdit && <button type="button" onClick={openCreate}>{t('calendarView.event.create')}</button>}
          </div>
          {eventView === 'agenda' && <div className="calendar-filter-grid">
            <label>{t('calendarView.from')}<input type="date" value={filters.from} onChange={(e) => setFilters((current) => ({ ...current, from: e.target.value }))} /></label>
            <label>{t('calendarView.to')}<input type="date" value={filters.to} onChange={(e) => setFilters((current) => ({ ...current, to: e.target.value }))} /></label>
          </div>}
          <fieldset className="event-category-filters"><legend>{t('calendarView.types')}</legend>{EVENT_TYPES.map((type) => <label key={type}><input type="checkbox" checked={filters.types.includes(type)} onChange={() => toggleType(type)} />{t(`calendarView.type.${type}`)}</label>)}</fieldset>
          <label>{t('calendarView.categories')}<input value={categoryInput} onChange={(e) => updateCategories(e.target.value)} placeholder={t('calendarView.categoriesPlaceholder')} /></label>
          {['week','timeline'].includes(eventView)&&<>
            <div className="planner-date-nav"><button type="button" aria-label={locale==='uk'?'Назад':'Previous'} onClick={()=>setPlannerDate(shiftDay(day,eventView==='week'?-7:-1))}><Icon name="chevron-left" size={18}/></button><strong>{eventView==='week'?plannerLabel[0]+' – '+plannerLabel[6]:plannerLabel[0]}</strong><button type="button" aria-label={locale==='uk'?'Далі':'Next'} onClick={()=>setPlannerDate(shiftDay(day,eventView==='week'?7:1))}><Icon name="chevron-right" size={18}/></button><button type="button" onClick={()=>setPlannerDate(eventDayKey({startsAt:new Date()},calendar.timeZone||'UTC'))}>{locale==='uk'?'Сьогодні':'Today'}</button><input type="date" aria-label={locale==='uk'?'Дата':'Date'} value={day} onChange={e=>{if(e.target.value)setPlannerDate(e.target.value)}}/></div>
            {eventView==='timeline'&&<fieldset className="event-category-filters"><legend>{t('calendarView.chooseCalendar')}</legend>{calendars.filter(c=>!c.isArchived).map(c=><label key={c.id}><input type="checkbox" checked={!hiddenCalendars.includes(c.id)} onChange={()=>setHiddenCalendars(old=>old.includes(c.id)?old.filter(id=>id!==c.id):[...old,c.id])}/>{c.name}</label>)}</fieldset>}
            {!eventsLoading&&!eventsError&&<PlannerGrid view={eventView} days={plannerDays} events={events} calendars={timelineCalendars} zone={calendar.timeZone||'UTC'} onSelect={selectEvent}/>}
          </>}
          {eventView === 'month' && <>
            <div className="calendar-month-navigation"><button type="button" onClick={() => moveMonth(-1)}>{t('calendarView.previousMonth')}</button><h2>{month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</h2><button type="button" onClick={() => moveMonth(1)}>{t('calendarView.nextMonth')}</button></div>
            <div className="calendar-weekdays">{['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((weekday) => <span key={weekday}>{t(`calendarView.weekday.${weekday}`)}</span>)}</div>
            <div className="calendar-grid">{days.map((day, index) => day ? <div className="calendar-day" key={day.key}><strong>{day.day}</strong>{(eventsByDay[day.key] || []).map((item) => <button className="calendar-event" type="button" onClick={() => selectEvent(item)} style={{ borderLeftColor: item.color }} key={item.occurrenceId || item.id}><span>{t(`calendarView.type.${item.type}`)}</span><strong>{item.title}</strong></button>)}</div> : <div className="calendar-day calendar-day-empty" key={`empty-${index}`} />)}</div>
          </>}
          {eventsLoading && <><BlobMascot mood="loading" compact /><p role="status">{t('common.loading')}</p></>}
          {eventsError && <><BlobMascot mood={navigator.onLine ? "error" : "offline"} compact /><p role="alert">{eventsError}</p></>}
          {!eventsLoading && !eventsError && !events.length && <><BlobMascot mood="empty" compact /><p>{t('calendarView.noEvents')}</p></>}
          {eventView === 'agenda' && !eventsLoading && <div className="event-list"><h2>{t('calendarView.eventsTitle')}</h2>{events.map((item) => <button type="button" className="event-list-item event-list-button" onClick={() => selectEvent(item)} key={item.occurrenceId || item.id} style={{ borderLeftColor: item.color }}><strong>{item.title}</strong><span>{t(`calendarView.type.${item.type}`)} · {eventDateLabel(item, locale, calendar.timeZone)}</span>{item.description && <span>{item.description}</span>}</button>)}</div>}
        </section>
        {(selection||editorOpen)&&<EventDialog busy={busy} label={t('calendarView.event.details')} onClose={()=>{setSelection(null);cancelEdit()}}>
          {selection&&!editorOpen&&<EventDetails key={selection.id} onInvite={sendInvitation} event={selection} calendar={eventCalendar} onClose={()=>setSelection(null)} onEdit={startEdit} onDelete={deleteEvent} canEdit={eventCanEdit} busy={busy}/>}
          {editorOpen&&<EventEditor key={editing?.id||'new'} event={editing} calendar={editing?eventCalendar:calendar} saving={busy} onSave={saveEvent} onCancel={cancelEdit}/>}
        </EventDialog>}
      </>}
      {activeTab === 'info' && <section className="account-card calendar-info-panel" role="tabpanel"><h2>{t('calendarView.infoTab')}</h2><p>{calendar.description || t('calendarShare.noDescription')}</p><dl><dt>{t('calendars.color')}</dt><dd><span className="calendar-color" style={{ background: calendar.color }} />{calendar.color}</dd><dt>{t('calendarView.country')}</dt><dd>{calendar.countryCode || t('calendarView.notSet')}</dd><dt>{t('calendarView.timeZone')}</dt><dd>{calendar.timeZone}</dd><dt>{t('calendarView.defaultView')}</dt><dd>{t(`calendarView.view.${calendar.defaultView}`)}</dd><dt>{t('calendarView.defaultDuration')}</dt><dd>{t('calendarView.durationMinutes', { minutes: calendar.defaultEventDurationMinutes })}</dd><dt>{t('calendarView.createdAt')}</dt><dd>{calendar.createdAt ? new Date(calendar.createdAt).toLocaleString(locale, { timeZone: calendar.timeZone }) : t('calendarView.notSet')}</dd></dl></section>}
    </>}
    {!calendar && calendars.length > 0 && <section className="account-card"><p>{t('calendarView.selectCalendar')}</p></section>}
  </section>;
}
