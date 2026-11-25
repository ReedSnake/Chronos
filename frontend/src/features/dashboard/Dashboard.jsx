import { EventPreviewButton } from '../events/EventPreviewButton';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../../app/applicationContainer';
import { useLocale } from '../../i18n/LocaleProvider';
import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import { EventEditor } from '../events/EventEditor';
import { EventDetails } from '../events/EventDetails';
import { getLocalizedApiError } from '../../i18n/apiErrors';
import { weekWindow, loadDashboard, summarizeDashboard } from './dashboardData';
import { fromCalendarInput, eventDayKey } from '../events/eventForm';

const copy = {
  en: { welcome:'Welcome', week:'Weekly schedule', today:'Today', add:'New event', previous:'Previous week', next:'Next week', agenda:'Daily agenda', all:'All events', meetings:'Meetings', tasks:'Tasks', reminders:'Reminders', holidays:'Holidays', noEvents:'No events for this day', noTasks:'No tasks this week', calendars:'My calendars', noCalendars:'No active calendars', manage:'Manage', done:'completed', close:'Close', selectCalendar:'Calendar', allDay:'All day', partial:'Some calendars could not be loaded. The overview is incomplete.', error:'Could not load your overview.', noEditable:'Create an editable calendar to add events.', lookup:'Find a user', profileId:'User ID', find:'Find', weekTasks:'Tasks this week', weekMeetings:'Meetings this week', weekReminders:'Reminders this week', open:'Open' },
  uk: { welcome:'Вітаємо', week:'Розклад тижня', today:'Сьогодні', add:'Нова подія', previous:'Попередній тиждень', next:'Наступний тиждень', agenda:'План дня', all:'Усі події', meetings:'Зустрічі', tasks:'Завдання', reminders:'Нагадування', holidays:'Свята', noEvents:'На цей день немає подій', noTasks:'На цей тиждень немає завдань', calendars:'Мої календарі', noCalendars:'Немає активних календарів', manage:'Керувати', done:'виконано', close:'Закрити', selectCalendar:'Календар', allDay:'Увесь день', partial:'Деякі календарі не завантажилися. Огляд неповний.', error:'Не вдалося завантажити огляд.', noEditable:'Створи календар із правом редагування, щоб додавати події.', lookup:'Знайти користувача', profileId:'ID користувача', find:'Знайти', weekTasks:'Завдання за тиждень', weekMeetings:'Зустрічі за тиждень', weekReminders:'Нагадування за тиждень', open:'Відкрити' },
};
const service = applicationContainer.calendarService;
const eventKey = e => e.calendarId+':'+(e.occurrenceId||e.id);
const dateOf = e => e.startsAt||e.deadline||e.remindAt;
const canWrite = calendar => Boolean(calendar && !calendar.isHolidayCalendar && ['owner','admin','editor'].includes(calendar.role));
const byTime = (a,b) => String(dateOf(a)||'').localeCompare(String(dateOf(b)||''));

export function Dashboard({ user }) {
  const { locale,localizedPath,t } = useLocale();
  const c=copy[locale]||copy.en;
  const navigate=useNavigate();
  const dialog=useRef(null);
  const zone=user.settings?.timeZone||'UTC';
  const starts=user.settings?.weekStartsOn||'monday';
  const [now,setNow]=useState(()=>new Date());
  const [offset,setOffset]=useState(0);
  const [reload,setReload]=useState(0);
  const [data,setData]=useState({calendars:[],events:[],failed:0});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [actionError,setActionError]=useState('');
  const [selected,setSelected]=useState(null);
  const [filter,setFilter]=useState('all');
  const [mode,setMode]=useState(null);
  const [selection,setSelection]=useState(null);
  const [editing,setEditing]=useState(null);
  const [calendarId,setCalendarId]=useState('');
  const [busy,setBusy]=useState(false);
  const [lookup,setLookup]=useState('');
  const [hidden,setHidden]=useState([]);
  const [upcoming,setUpcoming]=useState({events:[],loading:true,error:false});
  const [quickError,setQuickError]=useState('');
  const [taskBusy,setTaskBusy]=useState(false);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),60000);return()=>window.clearInterval(timer);},[]);
  const currentRange=weekWindow(now,zone,starts);
  const range=weekWindow(now,zone,starts,offset);
  const weekKey=range.days[0];
  const actualToday=currentRange.today;
  useEffect(()=>{
    let alive=true;
    setLoading(true);setError(false);
    loadDashboard(service,{from:range.from,to:range.to})
      .then(result=>{if(alive)setData(result);})
      .catch(()=>{if(alive){setData({calendars:[],events:[],failed:0});setError(true);}})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[weekKey,zone,reload,user.id]);
  useEffect(()=>{let alive=true;setUpcoming({events:[],loading:true,error:false});const end=new Date(actualToday+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+7);loadDashboard(service,{from:fromCalendarInput(actualToday+'T00:00',zone),to:new Date(Date.parse(fromCalendarInput(end.toISOString().slice(0,10)+'T00:00',zone))-1).toISOString(),types:['arrangement','reminder']}).then(d=>{if(alive)setUpcoming({events:d.events,loading:false,error:!!d.failed})}).catch(()=>{if(alive)setUpcoming({events:[],loading:false,error:true})});return()=>{alive=false}},[actualToday,zone,reload,user.id]);
  useEffect(()=>{if(mode&&dialog.current&&!dialog.current.open)dialog.current.showModal();},[mode]);
  const model=useMemo(()=>summarizeDashboard(data.events.filter(e=>!hidden.includes(e.calendarId)),{...range,today:actualToday},zone),[data.events,weekKey,actualToday,zone,hidden]);
  const activeDay=range.days.includes(selected)?selected:range.days.includes(actualToday)?actualToday:range.days[0];
  const chosen=model.days.find(day=>day.key===activeDay);
  const dayEvents=(chosen?.events||[]).filter(e=>filter==='all'||e.type===filter).sort(byTime);
  const editable=data.calendars.filter(canWrite);
  const activeCalendar=mode==='create'?(editable.find(cal=>cal.id===calendarId)||editable.find(cal=>cal.isMain)||editable[0]):data.calendars.find(cal=>cal.id===selection?.calendarId);
  const percent=model.tasks.length?Math.round(model.done/model.tasks.length*100):0;
  const incomplete=loading||error||data.failed>0;
  const value=n=>incomplete?'—':n;
  const weekday=key=>new Date(key+'T12:00:00Z').toLocaleDateString(locale,{weekday:'short',timeZone:'UTC'});
  const fullDay=key=>new Date(key+'T12:00:00Z').toLocaleDateString(locale,{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'});
  const shortDay=key=>key?new Date(key+'T12:00:00Z').toLocaleDateString(locale,{month:'short',day:'numeric',timeZone:'UTC'}):'';
  const formatTime=e=>dateOf(e)?new Date(dateOf(e)).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:zone,hour12:user.settings?.timeFormat==='12h'}):c.allDay;
  const dateFormat=new Intl.DateTimeFormat(locale,{month:'short',day:'numeric',timeZone:'UTC'});
  const firstDate=new Date(range.days[0]+'T12:00:00Z'),lastDate=new Date(range.days[6]+'T12:00:00Z');
  const dateLabel=typeof dateFormat.formatRange==='function'?dateFormat.formatRange(firstDate,lastDate):dateFormat.format(firstDate)+' – '+dateFormat.format(lastDate);
  function close(){if(!busy){setMode(null);setSelection(null);setEditing(null);setActionError('');}}
  function openCreate(){setSelection(null);setEditing(null);setActionError('');setCalendarId((editable.find(cal=>cal.isMain)||editable[0])?.id||'');setMode('create');}
  function openEvent(event){setSelection(event);setEditing(null);setActionError('');setMode('details');}
  async function startEdit(){
    if(!canWrite(activeCalendar)||!selection||busy)return;
    setBusy(true);setActionError('');
    try{const {event}=await service.getEvent(selection.calendarId,selection.id);setEditing(event);setMode('edit');}
    catch(err){setActionError(getLocalizedApiError(err,t,'calendarView.event.loadError'));}
    finally{setBusy(false);}
  }
  async function save(values){
    if(!canWrite(activeCalendar))return;
    setBusy(true);setActionError('');
    try{
      if(mode==='edit')await service.updateEvent(activeCalendar.id,selection.id,values);
      else await service.createEvent(activeCalendar.id,values);
      setMode(null);setEditing(null);setSelection(null);setReload(n=>n+1);
    }catch(err){throw new Error(getLocalizedApiError(err,t,'calendarView.event.saveError'));}
    finally{setBusy(false);}
  }
  async function remove(){
    if(!selection||!canWrite(activeCalendar)||busy||!window.confirm(t(selection.isRecurring?'calendarView.event.confirmDeleteSeries':'calendarView.event.confirmDelete')))return;
    setBusy(true);setActionError('');
    try{await service.deleteEvent(selection.calendarId,selection.id);setMode(null);setSelection(null);setReload(n=>n+1);}
    catch(err){setActionError(getLocalizedApiError(err,t,'calendarView.event.deleteError'));}
    finally{setBusy(false);}
  }
  async function invite(email){
    if(!selection||!canWrite(activeCalendar))return;
    const {calendarId,id}=selection;
    await service.sendEventInvitation(calendarId,id,email);
    try{
      const {event}=await service.getEvent(calendarId,id);
      setSelection(previous=>previous?.id===id?{...previous,attendees:event.attendees}:previous);
    }catch{
      setSelection(previous=>previous?.id===id?{...previous,attendees:(previous.attendees||[]).map(item=>item.email===email?{...item,invitationSentAt:new Date().toISOString()}:item)}:previous);
    }
    setReload(n=>n+1);
  }
  async function toggleTask(e){if(taskBusy||!canWrite(data.calendars.find(c=>c.id===e.calendarId)))return;if(e.isRecurring&&!window.confirm(t('calendarView.event.editSeriesOnly')))return;setTaskBusy(true);setQuickError('');try{await service.updateEvent(e.calendarId,e.id,{status:e.status==='done'?'todo':'done'});setReload(n=>n+1)}catch(err){setQuickError(getLocalizedApiError(err,t,'calendarView.event.saveError'))}finally{setTaskBusy(false)}}
  const nextEvents=upcoming.events.filter(e=>e.status!=='canceled'&&!hidden.includes(e.calendarId)&&Date.parse(dateOf(e))>=now.getTime()).sort(byTime);
  const filters=[['all',c.all],['arrangement',c.meetings],['task',c.tasks],['reminder',c.reminders],['holiday',c.holidays]];
  return <section className="dashboard">
    <header className="dash-header">
      <div><span className="dash-kicker">{fullDay(actualToday)}</span><h1>{c.welcome}, {user.name?.trim().split(/\s+/)[0]||''}</h1></div>
      <button className="dash-action dash-action-accent" type="button" disabled={loading||!editable.length} onClick={openCreate}><Icon name="plus" size={18}/>{c.add}</button>
    </header>
    {(error||data.failed>0)&&<div className="dash-error" role="alert">{error?c.error:c.partial}<button type="button" onClick={()=>setReload(n=>n+1)}>{t('common.retry')}</button></div>}
    {!loading&&!error&&!editable.length&&<p className="dash-muted">{c.noEditable} <Link to={localizedPath('/calendars')}>{c.manage}</Link></p>}
    <section className="dash-card dash-week-top" aria-busy={loading}>
      <div className="dash-card-head"><h2>{c.week}</h2><div className="dash-week-controls">{offset!==0&&<button className="dash-text-button" type="button" onClick={()=>{setOffset(0);setSelected(null);}}>{c.today}</button>}<button type="button" className="dash-round" aria-label={c.previous} onClick={()=>setOffset(n=>n-1)}><Icon name="chevron-left" size={18}/></button><strong>{dateLabel}</strong><button type="button" className="dash-round" aria-label={c.next} onClick={()=>setOffset(n=>n+1)}><Icon name="chevron-right" size={18}/></button></div></div>
      <div className="dash-week-days">{model.days.map(day=><button type="button" key={day.key} className={day.key===activeDay?'active':''} onClick={()=>setSelected(day.key)} aria-pressed={day.key===activeDay} aria-label={fullDay(day.key)}><small>{weekday(day.key)}</small><strong>{Number(day.key.slice(-2))}</strong><span>{loading||error?'—':day.events.length?day.events.length:'·'}</span></button>)}</div>
    </section>
    <div className="dash-summary" aria-busy={loading}>{[[c.weekMeetings,model.meetings.length],[c.weekTasks,model.tasks.length],[c.weekReminders,model.reminders.length]].map(([label,n])=><div key={label}><span>{label}</span><strong>{value(n)}</strong></div>)}</div>
    {quickError&&<p role="alert" className="dash-error">{quickError}</p>}
    <div className="dash-grid">
      <section className="dash-card dash-agenda" aria-busy={loading}>
        <div className="dash-card-head"><h2>{c.agenda}</h2><span className="dash-muted">{fullDay(activeDay)}</span></div>
        <div className="dash-filters" role="group" aria-label={c.agenda}>{filters.map(([type,label])=><button type="button" key={type} aria-pressed={type===filter} className={type===filter?'active':''} onClick={()=>setFilter(type)}>{label}</button>)}</div>
        <div className="dash-event-list">{loading?<p className="dash-empty">{t('common.loading')}</p>:!dayEvents.length?<p className="dash-empty">{error?c.error:c.noEvents}</p>:dayEvents.map(event=><EventPreviewButton event={event} zone={zone} className="dash-event-row" key={eventKey(event)} onClick={()=>openEvent(event)}><span className="dash-event-time">{formatTime(event)}</span><span className="dash-event-body"><i style={{background:event.color||'var(--chronos-accent)'}}/><span><strong>{event.title}</strong><small>{event.calendarName} · {t('calendarView.type.'+event.type)}</small></span></span><Icon name="chevron-right" size={16}/></EventPreviewButton>)}</div>
      </section>
      <section className="dash-card dash-tasks" aria-busy={loading}>
        <div className="dash-card-head"><h2>{c.weekTasks}</h2><strong className="dash-task-count">{value(model.done)}/{value(model.tasks.length)}</strong></div>
        <div className="dash-task-progress" aria-hidden="true"><span style={{width:incomplete?'0%':percent+'%'}}/></div>
        <div className="dash-task-list">{loading?<p className="dash-empty">{t('common.loading')}</p>:!model.tasks.length?<p className="dash-empty">{error?c.error:c.noTasks}</p>:model.tasks.map(event=><div className="dash-task" key={eventKey(event)}><button type="button" className={'dash-task-state'+(event.status==='done'?' done':'')} aria-label={locale==='uk'?'Змінити статус':'Toggle completion'} aria-pressed={event.status==='done'} disabled={taskBusy||loading||!canWrite(data.calendars.find(c=>c.id===event.calendarId))} onClick={()=>void toggleTask(event)}>{event.status==='done'&&<Icon name="check" size={13}/>}</button><EventPreviewButton event={event} zone={zone} className="dash-task-open" onClick={()=>openEvent(event)}><strong>{event.title}</strong><small>{shortDay(eventDayKey(event,zone))} · {formatTime(event)} · {t('statuses.'+event.status)}</small></EventPreviewButton></div>)}</div>
      </section>
      {['arrangement','reminder'].map(type=><section className="dash-card dash-upcoming" key={type}><div className="dash-card-head"><h2>{type==='arrangement'?(locale==='uk'?'Найближчі зустрічі':'Upcoming meetings'):(locale==='uk'?'Найближчі нагадування':'Upcoming reminders')}</h2><span className="dash-muted">{locale==='uk'?'7 днів':'7 days'}</span></div>{upcoming.loading?<p className="dash-empty">{t('common.loading')}</p>:upcoming.error?<p className="dash-empty">{c.partial}</p>:!nextEvents.some(e=>e.type===type)?<p className="dash-empty">{locale==='uk'?'Нічого не заплановано':'Nothing upcoming'}</p>:nextEvents.filter(e=>e.type===type).slice(0,3).map(e=><EventPreviewButton event={e} zone={zone} key={eventKey(e)} className="dash-upcoming-row" onClick={()=>openEvent(e)}><span><strong>{e.title}</strong><small>{e.calendarName}</small></span><span>{shortDay(eventDayKey(e,zone))}<small>{formatTime(e)}</small></span></EventPreviewButton>)}</section>)}
      <section className="dash-card dash-calendars">
        <div className="dash-card-head"><h2>{c.calendars}</h2><Link className="dash-manage" to={localizedPath('/calendars')}>{c.manage}</Link></div>
        <div className="dash-calendar-list">{loading?<p className="dash-empty">{t('common.loading')}</p>:!data.calendars.length?<p className="dash-empty">{error?c.error:c.noCalendars}</p>:data.calendars.map(cal=><div className="dash-calendar-toggle" key={cal.id}><input type="checkbox" checked={!hidden.includes(cal.id)} aria-label={cal.name} onChange={()=>setHidden(old=>old.includes(cal.id)?old.filter(id=>id!==cal.id):[...old,cal.id])}/><Link to={localizedPath('/calendars/view/'+encodeURIComponent(cal.id))}><i style={{background:cal.color||'var(--chronos-accent)'}}/><span>{cal.isHolidayCalendar?t('calendarBasics.holidays'):cal.name}</span><Icon name="chevron-right" size={16}/></Link></div>)}</div>
      </section>
    </div>
    <details className="dash-lookup"><summary>{c.lookup}</summary><form onSubmit={e=>{e.preventDefault();if(lookup.trim())navigate(localizedPath('/users/'+encodeURIComponent(lookup.trim())));}}><input aria-label={c.profileId} placeholder={c.profileId} value={lookup} onChange={e=>setLookup(e.target.value)} required/><button type="submit">{c.find}</button></form></details>
    {mode&&activeCalendar&&<dialog ref={dialog} className="dash-modal" aria-label={mode==='create'?c.add:t('calendarView.event.details')} onCancel={e=>{e.preventDefault();close();}}>
      {actionError&&<p role="alert" className="dash-error">{actionError}</p>}
      {mode==='details'&&selection?<EventDetails key={eventKey(selection)} event={selection} calendar={activeCalendar} busy={busy} canEdit={canWrite(activeCalendar)} onClose={close} onEdit={startEdit} onDelete={remove} onInvite={invite}/>:<>
        <div className="dash-modal-top">{mode==='create'?<label>{c.selectCalendar}<select value={activeCalendar.id} disabled={busy} onChange={e=>setCalendarId(e.target.value)}>{editable.map(cal=><option value={cal.id} key={cal.id}>{cal.name}</option>)}</select></label>:<strong>{activeCalendar.name}</strong>}<button type="button" disabled={busy} onClick={close}>{c.close}</button></div>
        <EventEditor key={mode+':'+activeCalendar.id} calendar={activeCalendar} event={editing} initialDay={activeDay} saving={busy} onSave={save} onCancel={close}/>
      </>}
    </dialog>}
  </section>;
}
