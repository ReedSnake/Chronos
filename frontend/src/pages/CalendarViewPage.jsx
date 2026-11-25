import { MobileAgenda } from '../features/events/MobileAgenda';
import { useMediaQuery } from '../features/ui/useMediaQuery';
import { SkeletonRows, EmptyState } from '../features/ui/Feedback';
import '../styles/ux-final.css';
import { EventQuickMenu } from '../features/events/EventQuickMenu';
import { canMoveEvent, moveEventPatch, resizeEventPatch, overlappingMeetings, duplicateEventPayload, eventIdentity } from '../features/events/eventQuickModel';
import { useLocalPreference } from '../features/ui/useLocalPreference';
import { Notice, useNotice } from '../features/ui/useNotice';
import { Fragment } from 'react';
import { isCalendarDay, matchesEvent, weekRowNumber } from '../features/events/calendarInteractions';
import { BlobMascot } from '../components/auth/BlobMascot';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { YearPlanner } from '../features/events/YearPlanner';
import { yearRange, shiftYear } from '../features/events/yearModel';
import { CALENDAR_VIEWS, readCalendarView, saveCalendarView } from '../features/events/calendarViewPreference';
import { CalendarEventActionsProvider, CalendarEventButton, EventSymbol, EventStatus } from '../features/events/CalendarEventActions';
import { CalendarOverview } from '../features/events/CalendarOverview';
import { PlannerGrid, shiftDay, weekDays } from '../features/events/PlannerGrid';
import { TablerIcon as Icon } from '../components/layout/TablerIcon';
import '../styles/calendar-workspace.css';
import '../styles/calendar-fit.css';
import '../styles/calendar-polish.css';
import { EVENT_TYPES, eventDayKey, eventDateLabel, fromCalendarInput, toCalendarInput } from '../features/events/eventForm';

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

function viewRange(day, view, startsOn) {
  if (view === 'year') return yearRange(day);
  if (['month', 'agenda'].includes(view)) {
    return monthRange(new Date(Number(day.slice(0,4)), Number(day.slice(5,7))-1, 1));
  }
  const days = ['week', 'overview'].includes(view) ? weekDays(day, startsOn) : [day];
  return { from: days[0], to: days[days.length - 1] };
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
    const measure=()=>setCapacity(Math.max(1,Math.floor(el.clientHeight/56)));
    measure();
    if(typeof ResizeObserver==='undefined')return;
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
      {loading?<SkeletonRows count={3} label={t('common.loading')}/>:!entries.length&&<EmptyState title={t('calendarView.noEvents')}/>}
      {!loading&&entries.slice(current*capacity,(current+1)*capacity).map(({date,event:e})=><CalendarEventButton event={e} key={date+':'+e.calendarId+':'+(e.occurrenceId||e.id)} className="chrono-agenda-event" onClick={()=>onSelect(e)}><span className="agenda-clock"><strong>{e.type==='holiday'?(locale==='uk'?'День':'All day'):toCalendarInput(e.deadline||e.remindAt||e.startsAt,zone).slice(11,16)}</strong><small>{new Date(date+'T12:00:00Z').toLocaleDateString(locale,{day:'numeric',month:'short',timeZone:'UTC'})}</small></span><span className={'agenda-track '+e.type+(e.status==='done'?' done':'')}><i/></span><EventSymbol event={e}/><span className="agenda-description"><strong>{e.title}</strong><small>{e.calendarName} · {typeName(e.type)}</small></span><EventStatus event={e}/></CalendarEventButton>)}
    </div>
    <div className="fitted-agenda-pages"><button type="button" disabled={current===0} aria-label={locale==='uk'?'Попередня сторінка':'Previous page'} onClick={()=>setPage(current-1)}><Icon name="chevron-left" size={16}/></button><span>{current+1} / {pages}</span><button type="button" disabled={current+1>=pages} aria-label={locale==='uk'?'Наступна сторінка':'Next page'} onClick={()=>setPage(current+1)}><Icon name="chevron-right" size={16}/></button></div>
  </div>;
}

export function CalendarViewPage() {
  const { user } = useAuth();
  return <CalendarViewContent key={user?.id || 'anonymous'} />;
}

function CalendarViewContent() {
  const { calendarId } = useParams();
  const navigate = useNavigate();
  const { status, user } = useAuth();
  const { localizedPath, locale, t } = useLocale();
  const [calendars, setCalendars] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const narrow=useMediaQuery('(max-width: 700px)');
  const [mobileLayout,setMobileLayout]=useLocalPreference(user?.id?'mobile-calendar:'+user.id:null,'list');
  const [allEvents, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const events = useMemo(() => search.trim() ? allEvents.filter(e => matchesEvent(e, search)) : allEvents, [allEvents, search]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [partial, setPartial] = useState(false);
  const { search: locationSearch } = useLocation();
  const [day, setDay] = useState(()=>{const requested=new URLSearchParams(locationSearch).get('date');return isCalendarDay(requested)?requested:eventDayKey({startsAt:new Date()},user?.settings?.timeZone||'UTC');});
  const [eventView, setEventView] = useState(() => new URLSearchParams(locationSearch).has('event')?'day':readCalendarView(user?.id));
  const [month, setMonth] = useState(() => new Date(Number(day.slice(0,4)), Number(day.slice(5,7))-1, 1));
  const [savedFilters,setSavedFilters]=useLocalPreference(user?.id?'calendar-filters:'+user.id:null,{types:[],categories:[]});
  const [filters, setFilters] = useState(() => ({ ...viewRange(day,eventView,user?.settings?.weekStartsOn), types:Array.isArray(savedFilters?.types)?savedFilters.types:[], categories:Array.isArray(savedFilters?.categories)?savedFilters.categories:[] }));
  const [categoryInput,setCategoryInput]=useState(()=>filters.categories.join(', '));
  const consumedSearch=useRef(null);
  const [fullDay,setFullDay]=useLocalPreference(user?.id?'full-day:'+user.id:null,false);
  const [weekGrid,setWeekGrid]=useLocalPreference(user?.id?'week-grid:'+user.id:null,false);
  const [timelineCalendars,setTimelineCalendars]=useState([]);
  const [hiddenCalendars,setHiddenCalendars]=useLocalPreference(user?.id?'calendar-hidden:'+user.id:null,[]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [selection, setSelection] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [createSlot, setCreateSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [quickMenu,setQuickMenu]=useState(null);
  const [dragging,setDragging]=useState(null);
  const dragRef=useRef(null), clipboard=useRef(null), quickLock=useRef(false), swipe=useRef(null);
  const [hasCopy,setHasCopy]=useState(false);
  const [notice,notify,dismissNotice]=useNotice();
  useEffect(()=>{const timer=setTimeout(()=>{const categories=categoryInput.split(',').map(item=>item.trim().toLowerCase()).filter(Boolean);setFilters(old=>JSON.stringify(old.categories)===JSON.stringify(categories)?old:{...old,categories});},350);return()=>clearTimeout(timer);},[categoryInput]);
  useEffect(()=>{setSavedFilters({types:filters.types,categories:filters.categories});},[filters.types,filters.categories]);

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
    setCalendar(null); setSelection(null); setEditorOpen(false); setQuickMenu(null); dragRef.current=null;setDragging(null);
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
    const request=Promise.allSettled(sources.map(async c=>(await fetchAllEvents(c.id,filters,c.isHolidayCalendar?'UTC':calendar.timeZone||'UTC')).map(e=>({...e,calendarId:c.id,calendarName:c.name})))).then(groups=>{
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
  useEffect(()=>{
    const params=new URLSearchParams(locationSearch),date=params.get('date'),id=params.get('event');
    if(!calendar||calendar.id!==calendarId||!isCalendarDay(date))return;
    const key=calendarId+locationSearch;if(consumedSearch.current===key)return;
    if(date!==day||(id&&eventView!=='day')){
      if(id){setHiddenCalendars(old=>old.filter(x=>x!==calendarId));setCategoryInput('');setFilters(old=>({...old,types:[],categories:[]}));setSearch('');switchView('day',date);}
      else setPlannerDate(date);
      return;
    }
    if(id){
      const item=allEvents.find(e=>e.calendarId===calendarId&&(e.occurrenceId||e.id)===id);
      if(item){consumedSearch.current=key;selectEvent(item);}
      else if(hiddenCalendars.includes(calendarId)||filters.types.length||filters.categories.length){setHiddenCalendars(old=>old.filter(x=>x!==calendarId));setCategoryInput('');setFilters(old=>({...old,types:[],categories:[]}));setSearch('');}
    }else consumedSearch.current=key;
  },[calendar,calendarId,locationSearch,day,eventView,allEvents,hiddenCalendars,filters.types,filters.categories]);
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
    if(values.type==='arrangement'||editing?.type==='arrangement'){
      const candidate={...editing,...values,type:'arrangement',calendarId:editing?eventCalendar.id:calendarId};
      if(overlappingMeetings(candidate,allEvents).length&&!window.confirm(locale==='uk'?'Зустріч перетинається з подією у завантаженому розкладі. Зберегти?':'This overlaps a meeting in the loaded schedule. Save anyway?'))throw Error(locale==='uk'?'Збереження скасовано':'Save canceled');
    }
    setBusy(true); setEventsError('');
    try {
      if (editing) await applicationContainer.calendarService.updateEvent(eventCalendar.id, editing.id, values);
      else await applicationContainer.calendarService.createEvent(calendarId, values);
      setEditing(null); setEditorOpen(false); setSelection(null);
      notify(locale==='uk'?'Подію збережено':'Event saved');
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

  function canEditEvent(item) {
    const source=calendars.find(c=>c.id===(item.calendarId||calendarId));
    return !!source&&!source.isArchived&&!source.isHolidayCalendar&&['owner','admin','editor'].includes(source.role);
  }
  function confirmConflict(candidate){
    return !overlappingMeetings(candidate,allEvents).length||window.confirm(locale==='uk'?'Є перетин із зустріччю у завантаженому розкладі. Продовжити?':'Overlaps a meeting in the loaded schedule. Continue?');
  }
  async function patchEvent(item,patch,{undo=false}={}){
    if(busy||eventsLoading||quickLock.current||!canEditEvent(item)||item.isRecurring)return;
    const source=item.calendarId||calendarId;
    const previous=Object.fromEntries(Object.keys(patch).map(k=>[k,item[k]]));
    const candidate={...item,...patch};
    if(!undo&&!confirmConflict(candidate))return;
    quickLock.current=true;setBusy(true);setEventsError('');
    const identity=e=>e.id===item.id&&(e.calendarId||calendarId)===source;
    const update=e=>identity(e)?{...e,...patch,...(e.type==='task'&&patch.deadline?{startsAt:patch.deadline}:e.type==='reminder'&&patch.remindAt?{startsAt:patch.remindAt}:{})}:e;
    const rollback=e=>identity(e)?{...e,...previous,...(e.type==='task'&&previous.deadline?{startsAt:previous.deadline}:e.type==='reminder'&&previous.remindAt?{startsAt:previous.remindAt}:{})}:e;
    setEvents(old=>old.map(update));setSelection(old=>old?update(old):null);
    try{
      await applicationContainer.calendarService.updateEvent(source,item.id,patch);
      setQuickMenu(null);setRefresh(n=>n+1);
      notify(locale==='uk'?'Зміни збережено':'Changes saved',undo?null:async()=>{
        if(quickLock.current)return;
        try{
          const {event:latest}=await applicationContainer.calendarService.getEvent(source,item.id);
          if(Object.keys(patch).some(k=>String(latest[k])!==String(patch[k])))throw Error('Event changed');
          // Recheck permissions against the actual API. Do not recreate deleted events.
          await applicationContainer.calendarService.updateEvent(source,item.id,previous);
          setRefresh(n=>n+1);notify(locale==='uk'?'Зміни скасовано':'Change undone');
        }catch(err){notify(locale==='uk'?'Не вдалося скасувати зміни':'Could not undo change');}
      });
    }catch(err){setEvents(old=>old.map(rollback));setSelection(old=>old?rollback(old):null);setEventsError(getLocalizedApiError(err,t,'calendarView.event.saveError'));notify(locale==='uk'?'Зміни не збережено':'Changes not saved');}
    finally{quickLock.current=false;setBusy(false);}
  }
  function startDrag(item,mode,e){
    if(!canMoveEvent(item)||!canEditEvent(item)||busy){e.preventDefault();return;}
    const next={item,mode};dragRef.current=next;setDragging(next);
    e.dataTransfer.setData('application/x-chronos-event',eventIdentity(item));e.dataTransfer.effectAllowed='move';
  }
  function endDrag(){dragRef.current=null;setDragging(null);}
  function dropEvent(date,minute){
    const drag=dragRef.current;endDrag();if(!drag)return;
    try{const patch=drag.mode==='resize'?resizeEventPatch(drag.item,date,minute,calendar.timeZone):moveEventPatch(drag.item,date,minute,calendar.timeZone);void patchEvent(drag.item,patch);}
    catch(err){notify(locale==='uk'?'Неприпустимий час або тривалість':'Invalid time or duration');}
  }
  function quickEdit(item,{title,time,duration,status}){
    if(!title)return;
    try{
      const patch={title};
      if(item.type==='task'&&['todo','in_progress','done'].includes(status))patch.status=status;
      if(canMoveEvent(item)){
        const [date,clock]=time.split('T'),[h,m]=clock.split(':').map(Number);
        Object.assign(patch,moveEventPatch(item,date,h*60+m,calendar.timeZone));
        if(item.type==='arrangement')patch.endsAt=new Date(Date.parse(patch.startsAt)+duration*60000).toISOString();
      }
      void patchEvent(item,patch);
    }catch{notify(locale==='uk'?'Перевірте дату й час':'Check date and time');}
  }
  async function duplicate(item,date=null){
    if(busy||quickLock.current||!canEditEvent(item))return;
    const target=date?calendarId:item.calendarId||calendarId;
    if(date&&!canEdit)return;
    quickLock.current=true;setBusy(true);
    try{
      const values=duplicateEventPayload(item);
      if(date&&item.type!=='holiday')Object.assign(values,moveEventPatch({...item,isRecurring:false},date,null,calendar.timeZone));
      else if(date)values.date=date;
      if(!confirmConflict({...values,calendarId:target}))return;
      await applicationContainer.calendarService.createEvent(target,values);
      setQuickMenu(null);setRefresh(n=>n+1);notify(locale==='uk'?'Копію створено':'Copy created');
    }catch(err){notify(getLocalizedApiError(err,t,'calendarView.event.saveError'));}
    finally{quickLock.current=false;setBusy(false);}
  }
  async function quickDelete(item){
    if(busy||quickLock.current||!canEditEvent(item)||!window.confirm(t(item.isRecurring?'calendarView.event.confirmDeleteSeries':'calendarView.event.confirmDelete')))return;
    quickLock.current=true;setBusy(true);
    try{await applicationContainer.calendarService.deleteEvent(item.calendarId||calendarId,item.id);setQuickMenu(null);setRefresh(n=>n+1);notify(locale==='uk'?'Подію видалено':'Event deleted');}
    catch(err){notify(getLocalizedApiError(err,t,'calendarView.event.deleteError'));}
    finally{quickLock.current=false;setBusy(false);}
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
      const change=e=>e.id===item.id&&(e.calendarId||calendarId)===sourceId?{...e,status:nextStatus}:e;
      setEvents(old=>old.map(change));
      setSelection(old=>old?change(old):null);
      await applicationContainer.calendarService.updateEvent(sourceId,item.id,{status:nextStatus});
      notify(locale==='uk'?'Статус оновлено':'Status updated');
    }catch(err){const rollback=e=>e.id===item.id&&(e.calendarId||calendarId)===sourceId?{...e,status:item.status}:e;setEvents(old=>old.map(rollback));setSelection(old=>old?rollback(old):null);setEventsError(getLocalizedApiError(err,t,'calendarView.event.saveError'));}
    finally{taskMutation.current=false;setBusy(false);}
  }

  function cancelEdit() { setEditorOpen(false); setEditing(null); }
  function openCreate() { createOn(day); }
  function openCreatePage() { if(canEdit) navigate(localizedPath(`/calendars/view/${calendarId}/new`) + '?date=' + encodeURIComponent(day)); }
  function selectEvent(item) { setSelection(item); setEventsError(''); setEditorOpen(false); setEditing(null); }
  function setPlannerDate(key,view=eventView) {
    setDay(key);
    const date=new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,1);
    setMonth(date);
    setFilters(current=>{
      const range=viewRange(key,view,startsOn);
      return current.from===range.from&&current.to===range.to?current:{...current,...range};
    });
  }
  function switchView(view, selectedDate = day) {
    setEventView(view);
    saveCalendarView(user?.id, view);
    setPlannerDate(selectedDate, view);
  }
  const plannerDays=['week','overview'].includes(eventView)?weekDays(day,startsOn):[day];
  useEffect(()=>{if(calendar?.id)setPlannerDate(day,eventView);},[calendar?.id,startsOn]);
  const plannerLabel=plannerDays.map(d=>new Date(d+'T12:00:00Z').toLocaleDateString(locale,{month:'short',day:'numeric',timeZone:'UTC'}));
  const viewLabels={overview:locale==='uk'?'Огляд':'Overview',day:locale==='uk'?'День':'Day',week:locale==='uk'?'Тиждень':'Week',month:t('calendarView.view.month'),year:t('calendarView.view.year'),agenda:t('calendarView.view.agenda')};

  useEffect(()=>{
    if(!calendar||loading||status!=='authenticated')return;
    const key=e=>{
      if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey||e.repeat||e.target.closest?.('input,textarea,select,[contenteditable=true]')||document.querySelector('dialog[open]'))return;
      if(e.key.toLowerCase()==='n'&&canEdit){e.preventDefault();openCreate();}
      else if(e.key.toLowerCase()==='t'){e.preventDefault();setPlannerDate(eventDayKey({startsAt:new Date()},calendar.timeZone||'UTC'));}
      else if(['1','2','3','4','5','6'].includes(e.key)){e.preventDefault();switchView(CALENDAR_VIEWS[Number(e.key)-1]);}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[calendar,loading,status,day,eventView,canEdit,startsOn]);
  if (status === 'loading' || loading) return <PageTemplate><BlobMascot mood="loading" compact /><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (status !== 'authenticated') return <PageTemplate><p>{t('calendarView.signInBefore')}<Link to={localizedPath('/login')}>{t('common.signIn')}</Link>{t('calendarView.signInAfter')}</p></PageTemplate>;

  const uk=locale==='uk';
  const today=eventDayKey({startsAt:new Date()},calendar?.timeZone||'UTC');
  const title=eventView==='year'?day.slice(0,4):['week','overview'].includes(eventView)?plannerLabel[0]+' – '+plannerLabel[6]:eventView==='day'?new Date(day+'T12:00:00Z').toLocaleDateString(locale,{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}):new Date(day+'T12:00:00Z').toLocaleDateString(locale,{month:'long',year:'numeric',timeZone:'UTC'});
  const miniMonth=month.toLocaleDateString(locale,{month:'long',year:'numeric'});
  const eventKey=e=>(e.calendarId||calendarId)+':'+(e.occurrenceId||e.id);
  const typeName=type=>type==='arrangement'?(uk?'Зустрічі':'Meetings'):t('calendarView.type.'+type);
  const selectedEvents=(eventsByDay[day]||[]).slice().sort((a,b)=>String(a.startsAt||a.deadline||a.remindAt||a.date).localeCompare(String(b.startsAt||b.deadline||b.remindAt||b.date)));
  function navigatePeriod(direction){
    if(eventView==='year')setPlannerDate(shiftYear(day,direction));
    else if(eventView==='month'||eventView==='agenda')moveMonth(direction);
    else setPlannerDate(shiftDay(day,direction*(['week','overview'].includes(eventView)?7:1)));
  }
  function createOn(key, minute = null){if(!canEdit||!isCalendarDay(key))return;setSelection(null);setEditing(null);setEventsError('');setCreateSlot({day:key,minute});setPlannerDate(key);setEditorOpen(true);}
  const mobileList=narrow&&mobileLayout==='list'&&['overview','day','week'].includes(eventView);
  const horizontal=eventView==='day'||eventView==='week'&&!weekGrid;
  const rangeLabel = eventView==='week'||eventView==='overview' ? (uk?'Тиждень ':'Week ')+weekRowNumber(plannerDays[0],startsOn) : null;
  return <CalendarEventActionsProvider value={{canChange:canChangeTask,toggle:toggleTask,busy:busy||eventsLoading,zone:calendar?.timeZone||'UTC',canEditEvent,context:setQuickMenu,dragging,startDrag,endDrag,drop:dropEvent,resizeEnabled:horizontal||eventView==='week'}}><section className={'chrono-calendar chrono-mode-'+eventView+(horizontal?' chrono-mode-horizontal':'')+(dragging?' ux-dragging':'')+(narrow?' ux-narrow-calendar':'')}>
    <header className="chrono-heading">
      <div><h1>{uk?'Календар':'Calendar'}</h1><p>{calendar?.timeZone||user?.settings?.timeZone||'UTC'}</p></div>
      <div className="chrono-heading-actions">
        <div className="chrono-segments" role="group" aria-label={t('calendarView.event.viewSwitch')}>
          {CALENDAR_VIEWS.map(view=><button key={view} type="button" aria-pressed={eventView===view} onClick={()=>switchView(view)}>{viewLabels[view]}</button>)}
        </div>
        {narrow&&["overview","day","week"].includes(eventView)&&<button type="button" className="ux-mobile-layout-toggle" onClick={()=>setMobileLayout(v=>v==="list"?"grid":"list")} aria-label={mobileList?(uk?"Показати сітку":"Show grid"):(uk?"Показати список":"Show list")}>{mobileList?(uk?"Сітка":"Grid"):(uk?"Список":"List")}</button>}
        {hasCopy&&canEdit&&<button type="button" className="ux-paste" disabled={busy} onClick={()=>clipboard.current&&void duplicate(clipboard.current,day)}>{uk?"Вставити":"Paste event"}</button>}
        {canEdit&&<button className="chrono-primary" type="button" onClick={openCreatePage}><Icon name="plus" size={18}/>{t('calendarView.event.create')}</button>}
      </div>
    </header>
    {error&&<p className="chrono-notice" role="alert">{error}</p>}
    {!calendars.length?<div className="chrono-empty">{t('calendarView.empty')} <Link to={localizedPath('/calendars')}>{t('calendarView.manageCalendars')}</Link></div>:calendar&&<div className="chrono-layout">
      <aside className="chrono-rail">
        <section className="chrono-mini">
          <div className="chrono-mini-head"><strong>{miniMonth}</strong><div><button type="button" aria-label={t('calendarView.previousMonth')} onClick={()=>setMonth(old=>new Date(old.getFullYear(),old.getMonth()-1,1))}><Icon name="chevron-left" size={16}/></button><button type="button" aria-label={t('calendarView.nextMonth')} onClick={()=>setMonth(old=>new Date(old.getFullYear(),old.getMonth()+1,1))}><Icon name="chevron-right" size={16}/></button></div></div>
          <div className="chrono-mini-grid"><span className="chrono-week-number" title="ISO 8601">#</span>{weekdayKeys.map(k=><span key={k}>{t('calendarView.weekday.'+k).slice(0,2)}</span>)}{days.map((d,index)=><Fragment key={d?.key||'blank'+index}>{index%7===0&&<span className="chrono-week-number">{weekRowNumber(shiftDay(days.slice(index,index+7).find(Boolean).key,-days.slice(index,index+7).findIndex(Boolean)),startsOn)}</span>}{d?<button type="button" key={d.key} className={(d.key===day?'selected ':'')+(d.key===today?'today':'')} aria-pressed={d.key===day} onClick={()=>setPlannerDate(d.key)}>{d.day}</button>:<span/>}</Fragment>)}</div>
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
          <div className="chrono-period"><button type="button" aria-label={uk?'Назад':'Previous'} onClick={()=>navigatePeriod(-1)}><Icon name="chevron-left" size={19}/></button><h2>{title}</h2>{rangeLabel&&<span className="chrono-week-label">{rangeLabel}</span>}<button type="button" aria-label={uk?'Далі':'Next'} onClick={()=>navigatePeriod(1)}><Icon name="chevron-right" size={19}/></button><button className="chrono-today" type="button" onClick={()=>setPlannerDate(today)}>{uk?'Сьогодні':'Today'}</button></div>
          <div className="chrono-tools"><label className="chrono-search"><Icon name="search" size={16}/><input type="search" aria-label={uk?'Пошук подій':'Search events'} placeholder={uk?'Пошук подій':'Search events'} value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label={uk?'Очистити пошук':'Clear search'} onClick={()=>setSearch('')}><Icon name="x" size={14}/></button>}</label>{eventView==='week'&&<button type="button" className="chrono-hours" aria-pressed={weekGrid} onClick={()=>setWeekGrid(v=>!v)}>{weekGrid?(uk?'Сітка':'Grid'):(uk?'Горизонтально':'Horizontal')}</button>}{(narrow||['overview','month','year'].includes(eventView)||horizontal)&&<details className="chrono-filter chrono-overview-sources"><summary>{uk?'Календарі':'Calendars'}<Icon name="chevron-down" size={15}/></summary><div className="chrono-filter-pop"><label>{uk?'Дата':'Date'}<input type="date" value={day} onChange={e=>{if(e.target.value)setPlannerDate(e.target.value)}}/></label><label>{uk?'Нові події в':'New events in'}<select value={calendarId} onChange={e=>chooseCalendar(e.target.value)}>{visibleCalendars.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{visibleCalendars.map(item=><div className="chrono-source" key={item.id}><input type="checkbox" aria-label={item.name} checked={!hiddenCalendars.includes(item.id)} onChange={()=>setHiddenCalendars(old=>old.includes(item.id)?old.filter(id=>id!==item.id):[...old,item.id])}/><i style={{background:item.color||'var(--chronos-accent)'}}/><span>{item.name}</span></div>)}<Link to={localizedPath('/calendars')}>{t('calendarView.manageCalendars')}</Link></div></details>}{['week','day'].includes(eventView)&&<button type="button" className="chrono-hours" aria-pressed={fullDay} onClick={()=>setFullDay(v=>!v)}>{uk?'24 год':'24h'}</button>}<details className="chrono-filter"><summary>{uk?'Фільтри':'Filters'}{filters.types.length+filters.categories.length>0&&<span>{filters.types.length+filters.categories.length}</span>}<Icon name="chevron-down" size={15}/></summary><div className="chrono-filter-pop"><strong>{t('calendarView.types')}</strong>{EVENT_TYPES.map(type=><label key={type}><input type="checkbox" checked={filters.types.includes(type)} onChange={()=>toggleType(type)}/>{typeName(type)}</label>)}<label className="chrono-filter-categories">{t('calendarView.categories')}<input value={categoryInput} onChange={e=>updateCategories(e.target.value)} placeholder={t('calendarView.categoriesPlaceholder')}/></label><button type="button" onClick={()=>{setCategoryInput('');setFilters(old=>({...old,types:[],categories:[]}));}}>{uk?'Скинути':'Reset'}</button></div></details></div>
        </div>
        {horizontal&&<div className="chrono-day-strip">{weekDays(day,startsOn).map(key=><button type="button" key={key} aria-pressed={key===day} onClick={()=>setPlannerDate(key)}><small>{new Date(key+'T12:00:00Z').toLocaleDateString(locale,{weekday:'short',timeZone:'UTC'})}</small><strong>{Number(key.slice(-2))}</strong>{key===today&&<i/>}</button>)}</div>}
        {eventView==='agenda'&&<div className="chrono-range"><label>{t('calendarView.from')}<input type="date" value={filters.from} onChange={e=>{const value=e.target.value;if(isCalendarDay(value))setFilters(old=>({...old,from:value,to:old.to<value?value:old.to>shiftDay(value,365)?shiftDay(value,365):old.to}));}}/></label><label>{t('calendarView.to')}<input type="date" value={filters.to} onChange={e=>{const value=e.target.value;if(isCalendarDay(value))setFilters(old=>({...old,to:value,from:old.from>value?value:old.from<shiftDay(value,-365)?shiftDay(value,-365):old.from}));}}/></label></div>}
        {eventsError&&<p role="alert" className="chrono-notice">{eventsError}<button type="button" onClick={()=>setRefresh(n=>n+1)}>{t('common.retry')}</button></p>}
        {search.trim()&&!eventsLoading&&!eventsError&&!events.length&&<p className="chrono-search-empty" role="status">{uk?'Немає подій за цим запитом у вибраному періоді':'No matching events in the selected period'}</p>}
        {partial&&<p role="status" className="chrono-notice">{uk?'Деякі календарі не завантажилися':'Some calendars could not be loaded'}</p>}
        <div className="chrono-view" aria-busy={eventsLoading} onTouchStart={e=>{if(e.touches.length===1&&!e.target.closest("button,input,select,textarea"))swipe.current={x:e.touches[0].clientX,y:e.touches[0].clientY};else swipe.current=null;}} onTouchEnd={e=>{const start=swipe.current;swipe.current=null;if(!start||!["day","week","overview"].includes(eventView))return;const p=e.changedTouches[0];const dx=p.clientX-start.x,dy=p.clientY-start.y;if(Math.abs(dx)>85&&Math.abs(dx)>Math.abs(dy)*1.8)navigatePeriod(dx<0?1:-1);}}>
          {eventsLoading&&!mobileList&&<div className="chrono-loading" role="status">{t('common.loading')}</div>}
          {mobileList&&<MobileAgenda events={events} days={plannerDays} day={day} zone={calendar.timeZone||"UTC"} loading={eventsLoading} error={eventsError} partial={partial} canEdit={canEdit} onSelect={selectEvent} onCreate={createOn} onDaySelect={setPlannerDate} timeFormat={user?.settings?.timeFormat}/> }
          {!mobileList&&eventView==='overview'&&<CalendarOverview events={events} days={plannerDays} day={day} today={today} zone={calendar.timeZone||'UTC'} loading={eventsLoading} error={eventsError} partial={partial} onSelect={selectEvent} onDaySelect={setPlannerDate} onView={switchView} onCreate={openCreate} canEdit={canEdit}/>}
          {!mobileList&&horizontal&&<DayPlanner view={eventView} days={plannerDays} events={events} calendars={timelineCalendars} day={day} zone={calendar.timeZone||'UTC'} fullDay={fullDay} loading={eventsLoading} error={eventsError} partial={partial} onSelect={selectEvent} onCreate={openCreate} onCreateAt={createOn} canEdit={canEdit} onDaySelect={setPlannerDate}/>}
          {!mobileList&&eventView==='week'&&weekGrid&&<PlannerGrid key={eventView} view={eventView} days={plannerDays} events={events} calendars={timelineCalendars} zone={calendar.timeZone||'UTC'} onSelect={selectEvent} selectedDay={day} onDaySelect={setPlannerDate} fullDay={fullDay} canEdit={canEdit} onCreateAt={createOn}/>}
          {eventView==='month'&&<MonthPlanner day={day} today={today} startsOn={startsOn} events={events} zone={calendar.timeZone||'UTC'} calendarName={calendar.name} loading={eventsLoading} error={eventsError} partial={partial} canEdit={canEdit} onDaySelect={setPlannerDate} onSelect={selectEvent} onCreate={createOn}/>}
          {eventView==='year'&&<YearPlanner day={day} today={today} startsOn={startsOn} events={events} zone={calendar.timeZone||'UTC'} onDaySelect={key=>switchView('day',key)} onMonthSelect={key=>switchView('month',key)}/>}
          {eventView==='agenda'&&<FittedAgenda eventsByDay={eventsByDay} locale={locale} t={t} zone={calendar.timeZone} onSelect={selectEvent} typeName={typeName} loading={eventsLoading}/>} 
        </div>
        <footer className="chrono-footer"><span>{eventsLoading?'—':events.length} {uk?'подій':'events'}{partial?' · '+(uk?'неповні дані':'partial data'):''}</span><span>{uk?'Створення в':'New events in'} <strong>{calendar.name}</strong></span></footer>
      </div>
    </div>}
    {(selection||editorOpen)&&calendar&&<EventDialog busy={busy} label={t('calendarView.event.details')} onClose={()=>{setSelection(null);cancelEdit()}}>
      {eventsError&&<p role="alert" className="event-dialog-error">{eventsError}</p>}
      {selection&&!editorOpen&&eventCalendar&&<EventDetails key={eventKey(selection)} onInvite={sendInvitation} event={selection} calendar={eventCalendar} onClose={()=>setSelection(null)} onEdit={startEdit} onDelete={deleteEvent} onQuickActions={()=>{const item=selection;setSelection(null);setQuickMenu(item);}} canEdit={eventCanEdit} busy={busy}/>}
      {editorOpen&&<div className="calendar-editor-shell"><EventEditor key={editing?.id||'new'} event={editing} initialDay={editing?day:createSlot?.day||day} initialMinute={editing?null:createSlot?.minute} calendar={editing?eventCalendar:calendar} saving={busy} onSave={saveEvent} onCancel={cancelEdit}/></div>}
    </EventDialog>}
    {quickMenu&&<EventQuickMenu key={eventIdentity(quickMenu)} event={quickMenu} zone={calendar?.timeZone||'UTC'} busy={busy} onClose={()=>setQuickMenu(null)} onOpen={()=>{const item=quickMenu;setQuickMenu(null);selectEvent(item);}} onPatch={values=>quickEdit(quickMenu,values)} onCopy={()=>{clipboard.current=quickMenu;setHasCopy(true);setQuickMenu(null);notify(uk?'Подію скопійовано. Виберіть дату та натисніть «Вставити»':'Copied. Select a date and press Paste event');}} onDuplicate={()=>void duplicate(quickMenu)} onDelete={()=>void quickDelete(quickMenu)}/>}
    <Notice notice={notice} onDismiss={dismissNotice} undoLabel={uk?'Скасувати':'Undo'} closeLabel={uk?'Закрити':'Dismiss'}/>
  </section></CalendarEventActionsProvider>;
}
