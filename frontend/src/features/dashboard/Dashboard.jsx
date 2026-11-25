import { overdueTasks, overdueWindow, nextMeeting, countdownMinutes } from '../events/planningPreferences';
import { useRefreshOnFocus } from '../ui/useRefreshOnFocus';
import { SkeletonRows } from '../ui/Feedback';
import { useLocalPreference } from '../ui/useLocalPreference';
import { Notice,useNotice } from '../ui/useNotice';
import { CalendarEventActionsProvider } from '../events/CalendarEventActions';
import { overviewModel, OverviewWeek, OverviewScheduleList, OverviewTasksTable, OverviewUpcomingList, OverviewCompletion } from '../events/CalendarOverview';
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
  en: { welcome:'Welcome back', week:'Weekly schedule', today:'Today', add:'New event', previous:'Previous week', next:'Next week', agenda:'Schedule', all:'All events', meetings:'Meetings', tasks:'Tasks', reminders:'Reminders', holidays:'Holidays', noEvents:'No events for this day', noTasks:'No tasks this week', calendars:'My calendars', noCalendars:'No active calendars', manage:'Manage', done:'completed', close:'Close', selectCalendar:'Calendar', allDay:'All day', partial:'Some calendars could not be loaded. The overview is incomplete.', error:'Could not load your overview.', noEditable:'Create an editable calendar to add events.', lookup:'Find a user', profileId:'User ID', find:'Find', weekTasks:'Tasks this week', weekMeetings:'Meetings this week', weekReminders:'Reminders this week', open:'Open' },
  uk: { welcome:'Вітаємо', week:'Розклад тижня', today:'Сьогодні', add:'Нова подія', previous:'Попередній тиждень', next:'Наступний тиждень', agenda:'Розклад дня', all:'Усі події', meetings:'Зустрічі', tasks:'Завдання', reminders:'Нагадування', holidays:'Свята', noEvents:'На цей день немає подій', noTasks:'На цей тиждень немає завдань', calendars:'Мої календарі', noCalendars:'Немає активних календарів', manage:'Керувати', done:'виконано', close:'Закрити', selectCalendar:'Календар', allDay:'Увесь день', partial:'Деякі календарі не завантажилися. Огляд неповний.', error:'Не вдалося завантажити огляд.', noEditable:'Створи календар із правом редагування, щоб додавати події.', lookup:'Знайти користувача', profileId:'ID користувача', find:'Знайти', weekTasks:'Завдання за тиждень', weekMeetings:'Зустрічі за тиждень', weekReminders:'Нагадування за тиждень', open:'Відкрити' },
};
const service = applicationContainer.calendarService;
const eventKey = e => e.calendarId+':'+(e.occurrenceId||e.id);
const dateOf = e => e.type==='task'?e.deadline:e.type==='reminder'?e.remindAt:e.startsAt;
const canWrite = calendar => Boolean(calendar && !calendar.isArchived && !calendar.isHolidayCalendar && ['owner','admin','editor'].includes(calendar.role));
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
  const [taskScope,setTaskScope]=useState('day');
  const [overdueData,setOverdueData]=useState({events:[],loading:false,error:false,partial:false});
  const mutationLock=useRef(false);
  const [showCompleted,setShowCompleted]=useState(false);
  const [createType,setCreateType]=useState('arrangement');
  const [reload,setReload]=useState(0);
  const [data,setData]=useState({calendars:[],events:[],failed:0});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [actionError,setActionError]=useState('');
  const [selected,setSelected]=useState(null);
  const [mode,setMode]=useState(null);
  const [selection,setSelection]=useState(null);
  const [editing,setEditing]=useState(null);
  const [calendarId,setCalendarId]=useState('');
  const [busy,setBusy]=useState(false);
  const [lookup,setLookup]=useState('');
  const [hidden,setHidden]=useLocalPreference(user.id?'dashboard-hidden:'+user.id:null,[]);
  const [upcoming,setUpcoming]=useState({events:[],loading:true,error:false,partial:false});
  const [quickError,setQuickError]=useState('');
  const [taskBusy,setTaskBusy]=useState(false);
  const [notice,notify,dismissNotice]=useNotice();
  useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),60000);return()=>window.clearInterval(timer);},[]);
  const currentRange=weekWindow(now,zone,starts);
  const range=weekWindow(now,zone,starts,offset);
  const weekKey=range.days[0];
  const actualToday=currentRange.today;
  useRefreshOnFocus(()=>setReload(n=>n+1),!busy&&!taskBusy&&!mode);
  useEffect(()=>{
    if(taskScope!=='overdue')return;
    let alive=true;
    setOverdueData({events:[],loading:true,error:false,partial:false});
    Promise.resolve().then(()=>loadDashboard(service,overdueWindow(actualToday,zone))).then(result=>{
      if(alive)setOverdueData({events:result.events,loading:false,error:false,partial:!!result.failed});
    }).catch(()=>{if(alive)setOverdueData({events:[],loading:false,error:true,partial:false});});
    return()=>{alive=false};
  },[taskScope,actualToday,zone,reload,user.id]);
  useEffect(()=>{
    let alive=true;
    setLoading(true);setError(false);
    loadDashboard(service,{from:range.from,to:range.to})
      .then(result=>{if(alive)setData(result);})
      .catch(()=>{if(alive){setData({calendars:[],events:[],failed:0});setError(true);}})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[weekKey,zone,reload,user.id]);
  useEffect(()=>{let alive=true;setUpcoming({events:[],loading:true,error:false,partial:false});const end=new Date(actualToday+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+7);loadDashboard(service,{from:fromCalendarInput(actualToday+'T00:00',zone),to:new Date(Date.parse(fromCalendarInput(end.toISOString().slice(0,10)+'T00:00',zone))-1).toISOString(),types:['arrangement','reminder','task']}).then(d=>{if(alive)setUpcoming({events:d.events,loading:false,error:false,partial:!!d.failed})}).catch(()=>{if(alive)setUpcoming({events:[],loading:false,error:true,partial:false})});return()=>{alive=false}},[actualToday,zone,reload,user.id]);
  useEffect(()=>{if(mode&&dialog.current&&!dialog.current.open)dialog.current.showModal();},[mode]);
  const model=useMemo(()=>summarizeDashboard(data.events.filter(e=>!hidden.includes(e.calendarId)),{...range,today:actualToday},zone),[data.events,weekKey,actualToday,zone,hidden]);
  const activeDay=range.days.includes(selected)?selected:range.days.includes(actualToday)?actualToday:range.days[0];
  const {schedule}=useMemo(()=>overviewModel(data.events.filter(e=>!hidden.includes(e.calendarId)),range.days,activeDay,zone),[data.events,hidden,weekKey,activeDay,zone]);
  const scopedTasks=taskScope==='overdue'?overdueTasks(overdueData.events.filter(e=>!hidden.includes(e.calendarId)),now):taskScope==='week'?model.tasks:model.tasks.filter(e=>eventDayKey(e,zone)===activeDay);
  const taskLoading=taskScope==='overdue'?overdueData.loading:loading;
  const taskError=taskScope==='overdue'?overdueData.error:error;
  const taskIncomplete=taskLoading||taskError||(taskScope==='overdue'?overdueData.partial:data.failed>0);
  const scopedDone=scopedTasks.filter(e=>e.status==='done').length;
  const visibleTasks=scopedTasks.filter(e=>showCompleted||e.status!=='done');
  const editable=data.calendars.filter(canWrite);
  const activeCalendar=mode==='create'?(editable.find(cal=>cal.id===calendarId)||editable.find(cal=>cal.isMain)||editable[0]):data.calendars.find(cal=>cal.id===selection?.calendarId);
  const incomplete=loading||error||data.failed>0;
  const fullDay=key=>new Date(key+'T12:00:00Z').toLocaleDateString(locale,{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'});
  const dateFormat=new Intl.DateTimeFormat(locale,{month:'short',day:'numeric',timeZone:'UTC'});
  const firstDate=new Date(range.days[0]+'T12:00:00Z'),lastDate=new Date(range.days[6]+'T12:00:00Z');
  const dateLabel=typeof dateFormat.formatRange==='function'?dateFormat.formatRange(firstDate,lastDate):dateFormat.format(firstDate)+' – '+dateFormat.format(lastDate);
  function close(){if(!busy){setMode(null);setSelection(null);setEditing(null);setActionError('');}}
  function openCreate(type='arrangement'){setCreateType(type==='task'?'task':'arrangement');setSelection(null);setEditing(null);setActionError('');setCalendarId((editable.find(cal=>cal.isMain)||editable[0])?.id||'');setMode('create');}
  function openEvent(event){setSelection(event);setEditing(null);setActionError('');setMode('details');}
  async function startEdit(){
    if(!canWrite(activeCalendar)||!selection||busy)return;
    setBusy(true);setActionError('');
    try{const {event}=await service.getEvent(selection.calendarId,selection.id);setEditing(event);setMode('edit');}
    catch(err){setActionError(getLocalizedApiError(err,t,'calendarView.event.loadError'));}
    finally{setBusy(false);}
  }
  async function save(values){
    if(!canWrite(activeCalendar)||mutationLock.current)throw Error(t('calendarView.event.saveError'));
    mutationLock.current=true;setBusy(true);setActionError('');
    try{
      if(mode==='edit')await service.updateEvent(activeCalendar.id,selection.id,values);
      else {await service.createEvent(activeCalendar.id,values);setHidden(old=>old.filter(id=>id!==activeCalendar.id));}
      setMode(null);setEditing(null);setSelection(null);setReload(n=>n+1);notify(locale==='uk'?'Подію збережено':'Event saved');
    }catch(err){throw new Error(getLocalizedApiError(err,t,'calendarView.event.saveError'));}
    finally{mutationLock.current=false;setBusy(false);}
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
  async function toggleTask(e){if(taskBusy||busy||mutationLock.current||!canWrite(data.calendars.find(c=>c.id===e.calendarId)))return;if(e.isRecurring&&!window.confirm(t('calendarView.event.editSeriesOnly')))return;mutationLock.current=true;setTaskBusy(true);setQuickError('');const next=e.status==='done'?'todo':'done';const update=status=>item=>item.id===e.id&&item.calendarId===e.calendarId?{...item,status}:item;setData(old=>({...old,events:old.events.map(update(next))}));setSelection(old=>old?update(next)(old):null);setUpcoming(old=>({...old,events:old.events.map(update(next))}));setOverdueData(old=>({...old,events:old.events.map(update(next))}));try{await service.updateEvent(e.calendarId,e.id,{status:next});setReload(n=>n+1);notify(locale==='uk'?'Статус оновлено':'Status updated')}catch(err){setData(old=>({...old,events:old.events.map(update(e.status))}));setSelection(old=>old?update(e.status)(old):null);setUpcoming(old=>({...old,events:old.events.map(update(e.status))}));setOverdueData(old=>({...old,events:old.events.map(update(e.status))}));setQuickError(getLocalizedApiError(err,t,'calendarView.event.saveError'))}finally{mutationLock.current=false;setTaskBusy(false)}}
  const uk=locale==='uk';
  const timeFormat=user.settings?.timeFormat||'24h';
  const mainCalendar=data.calendars.find(c=>c.isMain&&!c.isArchived)||data.calendars[0];
  const schedulePath=mainCalendar?localizedPath('/calendars/view/'+encodeURIComponent(mainCalendar.id))+'?date='+encodeURIComponent(activeDay):localizedPath('/calendars/view');
  const upcomingItems=upcoming.events.filter(e=>!hidden.includes(e.calendarId)&&e.status!=='canceled'&&['arrangement','task','reminder'].includes(e.type)&&(e.type==='task'?e.status!=='done':Date.parse(dateOf(e))>=now.getTime())).sort(byTime);
  const upcomingMeeting=nextMeeting(upcomingItems,now);
  const minutesLeft=upcomingMeeting?countdownMinutes(upcomingMeeting,now):0;
  const countdown=minutesLeft>=1440?Math.floor(minutesLeft/1440)+(uk?' д ':'d ')+Math.floor(minutesLeft%1440/60)+(uk?' год':'h'):minutesLeft>=60?Math.floor(minutesLeft/60)+(uk?' год ':'h ')+minutesLeft%60+(uk?' хв':'m'):minutesLeft+(uk?' хв':' min');
  const openSchedule=()=>navigate(schedulePath);
  const arrow=(label,action)=><button type="button" className="overview-arrow" title={label} aria-label={label} onClick={action}><Icon name="arrow-up-right" size={18}/></button>;
  return <CalendarEventActionsProvider value={{canChange:e=>canWrite(data.calendars.find(c=>c.id===e.calendarId)),toggle:toggleTask,busy:busy||taskBusy||loading||taskLoading,zone}}>
  <section className="dashboard dashboard-home">
    <header className="dash-header">
      <div><span className="dash-kicker">{activeDay===actualToday?c.today:(uk?'Обраний день':'Selected day')}</span><h1>{fullDay(activeDay)}</h1></div>
    </header>
    {(error||data.failed>0)&&<div className="dash-error" role="alert">{error?c.error:c.partial}<button type="button" onClick={()=>setReload(n=>n+1)}>{t('common.retry')}</button></div>}
    {!loading&&!error&&!editable.length&&<p className="dash-muted">{c.noEditable} <Link to={localizedPath('/calendars')}>{c.manage}</Link></p>}
    <Notice notice={notice} onDismiss={dismissNotice} closeLabel={uk?'Закрити':'Dismiss'}/>
    {quickError&&<p role="alert" className="dash-error">{quickError}</p>}
    <div className="dashboard-overview">
      <section className="overview-card overview-schedule home-schedule" aria-busy={loading}>
        <header><h3>{uk?'Розклад дня':'Daily schedule'}</h3>{arrow(uk?'Відкрити календар':'Open schedule',openSchedule)}</header>
        <p className="overview-date">{fullDay(activeDay)} · {incomplete?'—':schedule.length} {uk?'подій':'events'}</p>
        <OverviewScheduleList schedule={schedule} onSelect={openEvent} loading={loading} error={error?c.error:''} timeFormat={timeFormat}/>
        {editable.length>0&&<button className="overview-add" type="button" disabled={busy||loading} onClick={()=>openCreate()}><Icon name="plus" size={16}/>{c.add}</button>}
      </section>
      <section className="overview-card overview-tasks home-tasks" aria-busy={taskLoading}>
        <header><h3>{taskScope==='overdue'?(uk?'Прострочені завдання':'Overdue tasks'):taskScope==='week'?c.weekTasks:(uk?'Завдання дня':'Tasks for the day')}</h3>{arrow(uk?'Усі завдання':'All tasks',()=>navigate(localizedPath('/tasks')))}</header>
        <div className="dash-task-controls"><div className="dash-filters" role="group" aria-label={uk?'Період завдань':'Task period'}><button type="button" aria-pressed={taskScope==='day'} className={taskScope==='day'?'active':''} onClick={()=>setTaskScope('day')}>{uk?'День':'Day'}</button><button type="button" aria-pressed={taskScope==='week'} className={taskScope==='week'?'active':''} onClick={()=>setTaskScope('week')}>{uk?'Тиждень':'Week'}</button><button type="button" aria-pressed={taskScope==='overdue'} className={taskScope==='overdue'?'active':''} onClick={()=>setTaskScope('overdue')}>{uk?'Прострочені':'Overdue'}</button></div><small className="dash-muted">{taskIncomplete?'—':taskScope==='overdue'?scopedTasks.length:scopedDone+' / '+scopedTasks.length}</small></div>
        {taskScope==='overdue'&&<p className="overview-date">{uk?'За останні 365 днів':'Past 365 days'}{overdueData.partial?' · '+c.partial:''}</p>}
        <OverviewTasksTable tasks={visibleTasks} zone={zone} onSelect={openEvent} loading={taskLoading} error={taskError?c.error:''} timeFormat={timeFormat} emptyLabel={scopedTasks.length&&!visibleTasks.length?(uk?'Усі завдання виконано':'All tasks completed'):(uk?'Немає завдань на обраний період':'No tasks in the selected period')}/>
        {scopedDone>0&&<button className="home-completed" type="button" aria-pressed={showCompleted} onClick={()=>setShowCompleted(v=>!v)}>{showCompleted?(uk?'Приховати виконані':'Hide completed'):(uk?'Показати виконані':'Show completed')} · {scopedDone}</button>}
      </section>
      <section className="overview-card home-week">
        <header><h3>{new Date(activeDay+'T12:00:00Z').toLocaleDateString(locale,{month:'long',year:'numeric',timeZone:'UTC'})}</h3><div className="home-week-arrows"><button className="overview-arrow" type="button" aria-label={c.previous} onClick={()=>setOffset(n=>n-1)}><Icon name="chevron-left" size={17}/></button><button className="overview-arrow" type="button" aria-label={c.next} onClick={()=>setOffset(n=>n+1)}><Icon name="chevron-right" size={17}/></button></div></header>
        <OverviewWeek days={range.days} day={activeDay} today={actualToday} onDaySelect={setSelected}/>
        <div className="home-week-footer"><small className="overview-date">{dateLabel}</small>{(offset!==0||activeDay!==actualToday)&&<button type="button" className="home-completed" onClick={()=>{setOffset(0);setSelected(null)}}>{c.today}</button>}</div>
      </section>
      <section className="overview-card home-actions">
        <header><h3>{uk?'Швидкі дії':'Quick actions'}</h3></header>
        <div className="home-action-buttons"><button type="button" className="overview-add" disabled={loading||busy||!editable.length} onClick={()=>openCreate()}><Icon name="calendar-event" size={16}/>{c.add}</button><button type="button" className="overview-add home-task-add" disabled={loading||busy||!editable.length} onClick={()=>openCreate('task')}><Icon name="checkbox" size={16}/>{uk?'Нове завдання':'New task'}</button></div>
      </section>
      <section className="overview-card overview-meetings home-upcoming" aria-busy={upcoming.loading}>
        <header><h3>{uk?'Найближчі справи':'Upcoming'}</h3>{arrow(uk?'Відкрити календар':'Open schedule',openSchedule)}</header>
        <p className="overview-date">{uk?'Наступні 7 днів':'Next 7 days'}</p>
        {!upcoming.loading&&!upcoming.error&&upcomingMeeting&&<button type="button" className="home-next-countdown" onClick={()=>openEvent(upcomingMeeting)}><small>{uk?'Наступна зустріч через':'Next meeting in'}</small><strong>{countdown}</strong><span>{upcomingMeeting.title}</span></button>}
        {upcoming.partial&&<p className="overview-empty" role="status">{c.partial}</p>}
        <OverviewUpcomingList events={upcomingItems} zone={zone} onSelect={openEvent} loading={upcoming.loading} error={upcoming.error?c.error:''} timeFormat={timeFormat} emptyLabel={uk?'Немає найближчих справ':'Nothing upcoming'}/>
      </section>
      <section className="overview-card overview-completion home-completion">
        <header><h3>{offset===0?(uk?'Цей тиждень':'This week'):(uk?'Обраний тиждень':'Selected week')}</h3></header>
        <OverviewCompletion tasks={model.tasks} unknown={incomplete}/>
        <p className="overview-date home-completion-meta">{incomplete?'—':model.meetings.length} {uk?'зустрічей':'meetings'} · {incomplete?'—':model.reminders.length} {uk?'нагадувань':'reminders'}</p>
      </section>
    </div>
      <details className="dash-card dash-calendars dash-calendar-disclosure"><summary>{c.calendars}<Icon name="chevron-down" size={16}/></summary><div className="dash-card-head"><Link className="dash-manage" to={localizedPath('/calendars')}>{c.manage}</Link></div>
        <div className="dash-calendar-list">{loading?<SkeletonRows count={2} label={t('common.loading')}/>:!data.calendars.length?<p className="dash-empty">{error?c.error:c.noCalendars}</p>:data.calendars.map(cal=><div className="dash-calendar-toggle" key={cal.id}><input type="checkbox" checked={!hidden.includes(cal.id)} aria-label={cal.name} onChange={()=>setHidden(old=>old.includes(cal.id)?old.filter(id=>id!==cal.id):[...old,cal.id])}/><Link to={localizedPath('/calendars/view/'+encodeURIComponent(cal.id))}><i style={{background:cal.color||'var(--chronos-accent)'}}/><span>{cal.isHolidayCalendar?t('calendarBasics.holidays'):cal.name}</span><Icon name="chevron-right" size={16}/></Link></div>)}</div>
      </details>
    <details className="dash-lookup"><summary>{c.lookup}</summary><form onSubmit={e=>{e.preventDefault();if(lookup.trim())navigate(localizedPath('/users/'+encodeURIComponent(lookup.trim())));}}><input aria-label={c.profileId} placeholder={c.profileId} value={lookup} onChange={e=>setLookup(e.target.value)} required/><button type="submit">{c.find}</button></form></details>
    {mode&&activeCalendar&&<dialog ref={dialog} className="dash-modal dashboard-event-modal" aria-label={mode==='create'?c.add:t('calendarView.event.details')} onCancel={e=>{e.preventDefault();if(!e.currentTarget.querySelector('[data-unsaved="true"]')||window.confirm(locale==='uk'?'Закрити без збереження?':'Discard unsaved changes?'))close();}}>
      {actionError&&<p role="alert" className="dash-error">{actionError}</p>}
      {mode==='details'&&selection?<EventDetails key={eventKey(selection)} event={selection} calendar={activeCalendar} displayZone={zone} timeFormat={timeFormat} busy={busy} canEdit={canWrite(activeCalendar)} onClose={close} onEdit={startEdit} onDelete={remove} onInvite={invite}/>:<>
        <div className="dash-modal-top">{mode==='create'?<label>{c.selectCalendar}<select value={activeCalendar.id} disabled={busy} onChange={e=>setCalendarId(e.target.value)}>{editable.map(cal=><option value={cal.id} key={cal.id}>{cal.name}</option>)}</select></label>:<strong>{activeCalendar.name}</strong>}<button type="button" disabled={busy} onClick={()=>{if(!dialog.current?.querySelector('[data-unsaved="true"]')||window.confirm(locale==='uk'?'Закрити без збереження?':'Discard unsaved changes?'))close();}}>{c.close}</button></div>
        <EventEditor key={mode+':'+activeCalendar.id} calendar={activeCalendar} displayZone={zone} timeFormat={timeFormat} event={editing} initialType={createType} initialDay={activeDay} saving={busy} onSave={save} onCancel={close}/>
      </>}
    </dialog>}
  </section></CalendarEventActionsProvider>;
}
