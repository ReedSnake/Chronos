import { BlobMascot } from '../components/auth/BlobMascot';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';
import { EventEditor } from '../features/events/EventEditor';
import { EventDetails } from '../features/events/EventDetails';
import { EventDialog } from '../features/events/EventDialog';
import { DayPlanner } from '../features/events/DayPlanner';
import { MonthPlanner } from '../features/events/MonthPlanner';
import { CalendarEventActionsProvider, CalendarEventButton, EventSymbol } from '../features/events/CalendarEventActions';
import { CalendarOverview } from '../features/events/CalendarOverview';
import { PlannerGrid, shiftDay, weekDays } from '../features/events/PlannerGrid';
import { TablerIcon as Icon } from '../components/layout/TablerIcon';
import '../styles/calendar-workspace.css';
import '../styles/calendar-fit.css';
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

function daysForMonth(month, startsOn = 'monday') {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + (startsOn === 'sunday' ? 0 : 6)) % 7;
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

function FittedAgenda({eventsByDay,locale,t,zone,onSelect,typeName,loading}) {
  const listRef=useRef(null);
  const [capacity,setCapacity]=useState(8);
  const [page,setPage]=useState(0);
  useEffect(()=>{
    const el=listRef.current;
    if(!el)return;
    const measure=()=>setCapacity(Math.max(1,Math.floor(el.clientHeight/48)));
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(el);
    return()=>observer.disconnect();
  },[]);
  const entries=Object.entries(eventsByDay).sort(([a],[b])=>a.localeCompare(b)).flatMap(([date,items])=>items.slice().sort((a,b)=>String(a.startsAt||a.deadline||a.remindAt||a.date).localeCompare(String(b.startsAt||b.deadline||b.remindAt||b.date))).map(event=>({date,event})));
  const pages=Math.max(1,Math.ceil(entries.length/capacity));
  const current=Math.min(page,pages-1);
  useEffect(()=>setPage(0),[eventsByDay]);
  return <div className="fitted-agenda">
    <div className="fitted-agenda-list" ref={listRef}>
      {!loading&&!entries.length&&<p className="chrono-empty">{t('calendarView.noEvents')}</p>}
      {entries.slice(current*capacity,(current+1)*capacity).map(({date,event:e})=><CalendarEventButton event={e} key={e.calendarId+':'+(e.occurrenceId||e.id)} className="chrono-agenda-event" onClick={()=>onSelect(e)}><EventSymbol event={e}/><span><strong>{e.title}</strong><small>{e.calendarName} · {typeName(e.type)}</small></span><small>{eventDateLabel(e,locale,zone)||date}</small><Icon name="chevron-right" size={16}/></CalendarEventButton>)}
    </div>
    <div className="fitted-agenda-pages"><button type="button" disabled={current===0} aria-label={locale==='uk'?'Попередня сторінка':'Previous page'} onClick={()=>setPage(current-1)}><Icon name="chevron-left" size={16}/></button><span>{current+1} / {pages}</span><button type="button" disabled={current+1>=pages} aria-label={locale==='uk'?'Наступна сторінка':'Next page'} onClick={()=>setPage(current+1)}><Icon name="chevron-right" size={16}/></button></div>
  </div>;
}

export function CalendarViewPage() {
  const { calendarId } = useParams();
  const navigate = useNavigate();
  const { status, user } = useAuth();
  const { localizedPath, locale, t } = useLocale();
  const [calendars, setCalendars] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [events, setEvents] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [partial, setPartial] = useState(false);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [filters, setFilters] = useState(() => ({ ...monthRange(new Date()), types: [], categories: [] }));
  const [categoryInput, setCategoryInput] = useState('');
  const [eventView, setEventView] = useState('overview');
  const [fullDay,setFullDay]=useState(false);
  const [weekGrid,setWeekGrid]=useState(false);
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
      })
      .catch((err) => { if (active) setError(getLocalizedApiError(err, t, 'calendarView.loadError')); });
    return () => { active = false; };
  }, [calendarId, status, t]);

  useEffect(() => {
    if (status !== 'authenticated' || !calendarId || calendar?.id !== calendarId) return;
    let active = true;
    setEventsLoading(true); setEvents([]); setEventsError('');
    setPartial(false);
    const sources=calendars.filter(c=>(!c.isArchived||c.id===calendarId)&&!hiddenCalendars.includes(c.id));
    setTimelineCalendars(sources);
    const request=Promise.allSettled(sources.map(async c=>(await fetchAllEvents(c.id,filters,calendar.timeZone||'UTC')).map(e=>({...e,calendarId:c.id,calendarName:c.name})))).then(groups=>{
      if(!active)return [];
      const failed=groups.filter(g=>g.status==='rejected').length;
      if(failed&&failed===groups.length)throw groups.find(g=>g.status==='rejected').reason;
      setPartial(failed>0);
      return groups.flatMap(g=>g.status==='fulfilled'?g.value:[]);
    });
    request
      .then((items) => { if (active) setEvents(items); })
      .catch((err) => { if (active) setEventsError(getLocalizedApiError(err, t, 'calendarView.eventsError')); })
      .finally(() => { if (active) setEventsLoading(false); });
    return () => { active = false; };
  }, [calendarId, calendar?.id, calendar?.timeZone, filters, refresh, status, t, calendars, hiddenCalendars]);

  const eventsByDay = useMemo(() => events.reduce((grouped, item) => {
    const day = eventDayKey(item, calendar?.timeZone || 'UTC');
    if (day) (grouped[day] ||= []).push(item);
    return grouped;
  }, {}), [calendar?.timeZone, events]);
  const startsOn=user?.settings?.weekStartsOn||'monday';
  const days = useMemo(() => daysForMonth(month,startsOn), [month,startsOn]);
  const weekdayKeys=startsOn==='sunday'?['sun','mon','tue','wed','thu','fri','sat']:['mon','tue','wed','thu','fri','sat','sun'];
  const canEdit = !calendar?.isArchived && !calendar?.isHolidayCalendar && ['owner', 'admin', 'editor'].includes(calendar?.role);
  const eventCalendar=selection&&selection.calendarId&&selection.calendarId!==calendarId?calendars.find(c=>c.id===selection.calendarId):calendar;
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
    const next = new Date(Number(day.slice(0,4)), Number(day.slice(5,7))-1+offset, 1);
    setPlannerDate(monthRange(next).from);
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

  const taskMutation=useRef(false);
  function canChangeTask(item){
    const source=calendars.find(c=>c.id===(item.calendarId||calendarId));
    return item.type==='task'&&source&&!source.isArchived&&!source.isHolidayCalendar&&['owner','admin','editor'].includes(source.role);
  }
  async function toggleTask(item){
    if(busy||taskMutation.current||!canChangeTask(item))return;
    if(item.isRecurring&&!window.confirm(t('calendarView.event.editSeriesOnly')))return;
    taskMutation.current=true;
    setBusy(true);setEventsError('');
    const sourceId=item.calendarId||calendarId;
    const nextStatus=item.status==='done'?'todo':'done';
    try{
      await applicationContainer.calendarService.updateEvent(sourceId,item.id,{status:nextStatus});
      const change=e=>e.id===item.id&&(e.calendarId||calendarId)===sourceId?{...e,status:nextStatus}:e;
      setEvents(old=>old.map(change));
      setSelection(old=>old?change(old):null);
    }catch(err){setEventsError(getLocalizedApiError(err,t,'calendarView.event.saveError'));}
    finally{taskMutation.current=false;setBusy(false);}
  }

  function cancelEdit() { setEditorOpen(false); setEditing(null); }
  function openCreate() { setSelection(null); setEditing(null); setEventsError(''); setEditorOpen(true); }
  function selectEvent(item) { setSelection(item); setEventsError(''); setEditorOpen(false); setEditing(null); }
  function setPlannerDate(key,view=eventView) {
    setDay(key);
    const date=new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,1);
    setMonth(date);
    const keys=['week','overview'].includes(view)?weekDays(key,startsOn):[key];
    setFilters(current=>{
      const range=['month','agenda'].includes(view)?monthRange(date):{from:keys[0],to:keys[keys.length-1]};
      return current.from===range.from&&current.to===range.to?current:{...current,...range};
    });
  }
  function switchView(view) {
    setEventView(view);
    setPlannerDate(day,view);
  }
  const plannerDays=['week','overview'].includes(eventView)?weekDays(day,startsOn):[day];
  useEffect(()=>{if(calendar?.id)setPlannerDate(day,eventView);},[calendar?.id,startsOn]);
  const plannerLabel=plannerDays.map(d=>new Date(d+'T12:00:00Z').toLocaleDateString(locale,{month:'short',day:'numeric',timeZone:'UTC'}));
  const viewLabels={overview:locale==='uk'?'Огляд':'Overview',day:locale==='uk'?'День':'Day',week:locale==='uk'?'Тиждень':'Week',month:t('calendarView.view.month'),agenda:t('calendarView.view.agenda')};

  if (status === 'loading' || loading) return <PageTemplate><BlobMascot mood="loading" compact /><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (status !== 'authenticated') return <PageTemplate><p>{t('calendarView.signInBefore')}<Link to={localizedPath('/login')}>{t('common.signIn')}</Link>{t('calendarView.signInAfter')}</p></PageTemplate>;

  const uk=locale==='uk';
  const today=eventDayKey({startsAt:new Date()},calendar?.timeZone||'UTC');
  const title=['week','overview'].includes(eventView)?plannerLabel[0]+' – '+plannerLabel[6]:eventView==='day'?new Date(day+'T12:00:00Z').toLocaleDateString(locale,{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}):new Date(day+'T12:00:00Z').toLocaleDateString(locale,{month:'long',year:'numeric',timeZone:'UTC'});
  const miniMonth=month.toLocaleDateString(locale,{month:'long',year:'numeric'});
  const eventKey=e=>(e.calendarId||calendarId)+':'+(e.occurrenceId||e.id);
  const typeName=type=>type==='arrangement'?(uk?'Зустрічі':'Meetings'):t('calendarView.type.'+type);
  const selectedEvents=(eventsByDay[day]||[]).slice().sort((a,b)=>String(a.startsAt||a.deadline||a.remindAt||a.date).localeCompare(String(b.startsAt||b.deadline||b.remindAt||b.date)));
  function navigatePeriod(direction){
    if(eventView==='month'||eventView==='agenda')moveMonth(direction);
    else setPlannerDate(shiftDay(day,direction*(['week','overview'].includes(eventView)?7:1)));
  }
  function createOn(key){if(!canEdit)return;setPlannerDate(key);openCreate();}
  const horizontal=eventView==='day'||eventView==='week'&&!weekGrid;
  return <CalendarEventActionsProvider value={{canChange:canChangeTask,toggle:toggleTask,busy:busy||eventsLoading}}><section className={'chrono-calendar chrono-mode-'+eventView+(horizontal?' chrono-mode-horizontal':'')}>
    <header className="chrono-heading">
      <div><h1>{uk?'Календар':'Calendar'}</h1><p>{calendar?.timeZone||user?.settings?.timeZone||'UTC'}</p></div>
      <div className="chrono-heading-actions">
        <div className="chrono-segments" role="group" aria-label={t('calendarView.event.viewSwitch')}>
          {['overview','day','week','month','agenda'].map(view=><button key={view} type="button" aria-pressed={eventView===view} onClick={()=>switchView(view)}>{viewLabels[view]}</button>)}
        </div>
        {canEdit&&<button className="chrono-primary" type="button" onClick={openCreate}><Icon name="plus" size={18}/>{t('calendarView.event.create')}</button>}
      </div>
    </header>
    {error&&<p className="chrono-notice" role="alert">{error}</p>}
    {!calendars.length?<div className="chrono-empty">{t('calendarView.empty')} <Link to={localizedPath('/calendars')}>{t('calendarView.manageCalendars')}</Link></div>:calendar&&<div className="chrono-layout">
      <aside className="chrono-rail">
        <section className="chrono-mini">
          <div className="chrono-mini-head"><strong>{miniMonth}</strong><div><button type="button" aria-label={t('calendarView.previousMonth')} onClick={()=>setMonth(old=>new Date(old.getFullYear(),old.getMonth()-1,1))}><Icon name="chevron-left" size={16}/></button><button type="button" aria-label={t('calendarView.nextMonth')} onClick={()=>setMonth(old=>new Date(old.getFullYear(),old.getMonth()+1,1))}><Icon name="chevron-right" size={16}/></button></div></div>
          <div className="chrono-mini-grid">{weekdayKeys.map(k=><span key={k}>{t('calendarView.weekday.'+k).slice(0,2)}</span>)}{days.map((d,index)=>d?<button type="button" key={d.key} className={(d.key===day?'selected ':'')+(d.key===today?'today':'')} aria-pressed={d.key===day} onClick={()=>setPlannerDate(d.key)}>{d.day}</button>:<span key={'blank'+index}/>)}</div>
        </section>
        <section className="chrono-sources">
          <div className="chrono-rail-head"><h2>{uk?'Мої календарі':'My calendars'}</h2><Link title={t('calendarView.manageCalendars')} aria-label={t('calendarView.manageCalendars')} to={localizedPath('/calendars')}><Icon name="settings" size={17}/></Link></div>
          {visibleCalendars.map(item=><div className="chrono-source" key={item.id}><input type="checkbox" aria-label={item.name} checked={!hiddenCalendars.includes(item.id)} onChange={()=>setHiddenCalendars(old=>old.includes(item.id)?old.filter(id=>id!==item.id):[...old,item.id])}/><i style={{background:item.color||'var(--chronos-accent)'}}/><button type="button" aria-pressed={item.id===calendarId} onClick={()=>chooseCalendar(item.id)}>{item.isHolidayCalendar?t('calendarBasics.holidays'):item.name}</button></div>)}
          <details className="chrono-info" open={infoOpen} onToggle={e=>setInfoOpen(e.currentTarget.open)}><summary>{t('calendarView.infoTab')}</summary><p>{calendar.name} · {calendarRoleLabel(t,calendar.role)}</p><p>{calendar.description||t('calendarShare.noDescription')}</p><p>{calendar.countryCode||t('calendarView.notSet')} · {calendar.timeZone}</p><p>{t('calendarView.defaultDuration')}: {calendar.defaultEventDurationMinutes} min</p><p>{t('calendarView.defaultView')}: {t('calendarView.view.'+calendar.defaultView)}</p><p>{t('calendarView.createdAt')}: {calendar.createdAt?new Date(calendar.createdAt).toLocaleDateString(locale):t('calendarView.notSet')}</p></details>
        </section>
        <section className="chrono-day-preview">
          <div className="chrono-rail-head"><h2>{new Date(day+'T12:00:00Z').toLocaleDateString(locale,{month:'short',day:'numeric',timeZone:'UTC'})}</h2><span>{eventsLoading?'—':selectedEvents.length}</span></div>
          {eventsLoading?<p>{t('common.loading')}</p>:selectedEvents.length?selectedEvents.slice(0,6).map(e=><CalendarEventButton event={e} className="chrono-preview-event" key={eventKey(e)} onClick={()=>selectEvent(e)}><EventSymbol event={e} size={13}/><span><strong>{e.title}</strong><small>{eventDateLabel(e,locale,calendar.timeZone)}</small></span></CalendarEventButton>):<p>{t('calendarView.noEvents')}</p>}
        </section>
      </aside>
      <div className="chrono-board">
        <div className="chrono-toolbar">
          <div className="chrono-period"><button type="button" aria-label={uk?'Назад':'Previous'} onClick={()=>navigatePeriod(-1)}><Icon name="chevron-left" size={19}/></button><h2>{title}</h2><button type="button" aria-label={uk?'Далі':'Next'} onClick={()=>navigatePeriod(1)}><Icon name="chevron-right" size={19}/></button><button className="chrono-today" type="button" onClick={()=>setPlannerDate(today)}>{uk?'Сьогодні':'Today'}</button></div>
          <div className="chrono-tools">{eventView==='week'&&<button type="button" className="chrono-hours" aria-pressed={weekGrid} onClick={()=>setWeekGrid(v=>!v)}>{weekGrid?(uk?'Сітка':'Grid'):(uk?'Горизонтально':'Horizontal')}</button>}{(['overview','month'].includes(eventView)||horizontal)&&<details className="chrono-filter chrono-overview-sources"><summary>{uk?'Календарі':'Calendars'}<Icon name="chevron-down" size={15}/></summary><div className="chrono-filter-pop"><label>{uk?'Дата':'Date'}<input type="date" value={day} onChange={e=>{if(e.target.value)setPlannerDate(e.target.value)}}/></label><label>{uk?'Нові події в':'New events in'}<select value={calendarId} onChange={e=>chooseCalendar(e.target.value)}>{visibleCalendars.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{visibleCalendars.map(item=><div className="chrono-source" key={item.id}><input type="checkbox" aria-label={item.name} checked={!hiddenCalendars.includes(item.id)} onChange={()=>setHiddenCalendars(old=>old.includes(item.id)?old.filter(id=>id!==item.id):[...old,item.id])}/><i style={{background:item.color||'var(--chronos-accent)'}}/><span>{item.name}</span></div>)}<Link to={localizedPath('/calendars')}>{t('calendarView.manageCalendars')}</Link></div></details>}{['week','day'].includes(eventView)&&<button type="button" className="chrono-hours" aria-pressed={fullDay} onClick={()=>setFullDay(v=>!v)}>{uk?'24 год':'24h'}</button>}<details className="chrono-filter"><summary>{uk?'Фільтри':'Filters'}{filters.types.length+filters.categories.length>0&&<span>{filters.types.length+filters.categories.length}</span>}<Icon name="chevron-down" size={15}/></summary><div className="chrono-filter-pop"><strong>{t('calendarView.types')}</strong>{EVENT_TYPES.map(type=><label key={type}><input type="checkbox" checked={filters.types.includes(type)} onChange={()=>toggleType(type)}/>{typeName(type)}</label>)}<label className="chrono-filter-categories">{t('calendarView.categories')}<input value={categoryInput} onChange={e=>updateCategories(e.target.value)} placeholder={t('calendarView.categoriesPlaceholder')}/></label><button type="button" onClick={()=>{setCategoryInput('');setFilters(old=>({...old,types:[],categories:[]}));}}>{uk?'Скинути':'Reset'}</button></div></details></div>
        </div>
        {horizontal&&<div className="chrono-day-strip">{weekDays(day,startsOn).map(key=><button type="button" key={key} aria-pressed={key===day} onClick={()=>setPlannerDate(key)}><small>{new Date(key+'T12:00:00Z').toLocaleDateString(locale,{weekday:'short',timeZone:'UTC'})}</small><strong>{Number(key.slice(-2))}</strong>{key===today&&<i/>}</button>)}</div>}
        {eventView==='agenda'&&<div className="chrono-range"><label>{t('calendarView.from')}<input type="date" value={filters.from} onChange={e=>setFilters(old=>({...old,from:e.target.value}))}/></label><label>{t('calendarView.to')}<input type="date" value={filters.to} onChange={e=>setFilters(old=>({...old,to:e.target.value}))}/></label></div>}
        {eventsError&&<p role="alert" className="chrono-notice">{eventsError}<button type="button" onClick={()=>setRefresh(n=>n+1)}>{t('common.retry')}</button></p>}
        {partial&&<p role="status" className="chrono-notice">{uk?'Деякі календарі не завантажилися':'Some calendars could not be loaded'}</p>}
        <div className="chrono-view" aria-busy={eventsLoading}>
          {eventsLoading&&<div className="chrono-loading" role="status">{t('common.loading')}</div>}
          {eventView==='overview'&&<CalendarOverview events={events} days={plannerDays} day={day} today={today} zone={calendar.timeZone||'UTC'} loading={eventsLoading} error={eventsError} partial={partial} onSelect={selectEvent} onDaySelect={setPlannerDate} onView={switchView} onCreate={openCreate} canEdit={canEdit}/>}
          {horizontal&&<DayPlanner view={eventView} days={plannerDays} events={events} calendars={timelineCalendars} day={day} zone={calendar.timeZone||'UTC'} fullDay={fullDay} loading={eventsLoading} error={eventsError} partial={partial} onSelect={selectEvent} onCreate={openCreate} canEdit={canEdit} onDaySelect={setPlannerDate}/>}
          {eventView==='week'&&weekGrid&&<PlannerGrid key={eventView} view={eventView} days={plannerDays} events={events} calendars={timelineCalendars} zone={calendar.timeZone||'UTC'} onSelect={selectEvent} selectedDay={day} onDaySelect={setPlannerDate} fullDay={fullDay}/>}
          {eventView==='month'&&<MonthPlanner day={day} today={today} startsOn={startsOn} events={events} zone={calendar.timeZone||'UTC'} calendarName={calendar.name} loading={eventsLoading} error={eventsError} partial={partial} canEdit={canEdit} onDaySelect={setPlannerDate} onSelect={selectEvent} onCreate={createOn}/>}
          {eventView==='agenda'&&<FittedAgenda eventsByDay={eventsByDay} locale={locale} t={t} zone={calendar.timeZone} onSelect={selectEvent} typeName={typeName} loading={eventsLoading}/>} 
        </div>
        <footer className="chrono-footer"><span>{eventsLoading?'—':events.length} {uk?'подій':'events'}{partial?' · '+(uk?'неповні дані':'partial data'):''}</span><span>{uk?'Створення в':'New events in'} <strong>{calendar.name}</strong></span></footer>
      </div>
    </div>}
    {(selection||editorOpen)&&calendar&&<EventDialog busy={busy} label={t('calendarView.event.details')} onClose={()=>{setSelection(null);cancelEdit()}}>
      {eventsError&&<p role="alert" className="event-dialog-error">{eventsError}</p>}
      {selection&&!editorOpen&&eventCalendar&&<EventDetails key={eventKey(selection)} onInvite={sendInvitation} event={selection} calendar={eventCalendar} onClose={()=>setSelection(null)} onEdit={startEdit} onDelete={deleteEvent} canEdit={eventCanEdit} busy={busy}/>}
      {editorOpen&&<EventEditor key={editing?.id||'new'} event={editing} initialDay={day} calendar={editing?eventCalendar:calendar} saving={busy} onSave={saveEvent} onCancel={cancelEdit}/>}
    </EventDialog>}
  </section></CalendarEventActionsProvider>;
}
