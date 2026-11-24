import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../../app/applicationContainer';
import { useLocale } from '../../i18n/LocaleProvider';
import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import { EventEditor } from '../events/EventEditor';
import { getLocalizedApiError } from '../../i18n/apiErrors';
import { weekWindow, loadDashboard, summarizeDashboard } from './dashboardData';

const words = {
 en: { welcome:'Welcome', overview:'Your week at a glance', today:'Today', meetings:'Meetings', tasks:'Tasks', reminders:'Reminders', profile:'My profile', editProfile:'Edit profile', planning:'Planning activity', planned:'Scheduled meeting time', focus:'Focus timer', focusNote:'Time for one thing at a time', start:'Start', pause:'Pause', reset:'Reset', complete:'Task progress', done:'completed', noTasks:'No tasks scheduled this week', noEvents:'Nothing planned yet', week:'Weekly schedule', view:'Open calendar', add:'New event', calendars:'My calendars', noCalendars:'No active calendars', manage:'Manage calendars', partial:'Some calendars could not be loaded. Figures may be incomplete.', error:'Could not load your weekly overview.', selectCalendar:'Calendar', lookup:'Find a profile', profileId:'User ID', find:'Find', close:'Close', local:'Current session', allDay:'All day', emptyToday:'A little space for yourself', eventsToday:'Events today', previous:'Previous week', next:'Next week', noMeetings:'No meetings scheduled', noEditable:'Create a calendar to add events.', currentWeek:'This week' },
 uk: { welcome:'Вітаємо', overview:'Твій тиждень одним поглядом', today:'Сьогодні', meetings:'Зустрічі', tasks:'Завдання', reminders:'Нагадування', profile:'Мій профіль', editProfile:'Редагувати профіль', planning:'Активність планування', planned:'Запланований час зустрічей', focus:'Таймер фокусу', focusNote:'Час для однієї справи', start:'Почати', pause:'Пауза', reset:'Скинути', complete:'Прогрес завдань', done:'виконано', noTasks:'На цей тиждень немає завдань', noEvents:'Поки нічого не заплановано', week:'Розклад тижня', view:'Відкрити календар', add:'Нова подія', calendars:'Мої календарі', noCalendars:'Немає активних календарів', manage:'Керувати календарями', partial:'Деякі календарі не завантажилися. Показники можуть бути неповними.', error:'Не вдалося завантажити огляд тижня.', selectCalendar:'Календар', lookup:'Знайти профіль', profileId:'ID користувача', find:'Знайти', close:'Закрити', local:'Поточна сесія', allDay:'Увесь день', emptyToday:'Трохи часу для себе', eventsToday:'Події сьогодні', previous:'Попередній тиждень', next:'Наступний тиждень', noMeetings:'Немає запланованих зустрічей', noEditable:'Створи календар, щоб додавати події.', currentWeek:'Цей тиждень' },
};
const typeIcon = { arrangement:'users', task:'checkbox', reminder:'bell', holiday:'calendar' };
const eventKey = e => e.calendarId+':'+(e.occurrenceId||e.id);
const dateOf = e => e.startsAt||e.deadline||e.remindAt;
function CardHead({ title, action }) { return <div className="dash-card-head"><h2>{title}</h2>{action}</div>; }
function ArrowLink({ to, label }) { return <Link className="dash-icon-link" to={to} aria-label={label} title={label}><Icon name="arrow-up-right" size={18}/></Link>; }
function FocusTimer({ c }) {
  const total = 25*60;
  const [remaining,setRemaining] = useState(total);
  const [until,setUntil] = useState(null);
  useEffect(()=>{
    if (until === null) return;
    const tick=()=>{const next=Math.max(0,Math.ceil((until-Date.now())/1000));setRemaining(next);if(!next)setUntil(null);};
    tick();const timer=window.setInterval(tick,250);return ()=>window.clearInterval(timer);
  },[until]);
  const time=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');
  function toggle(){if(until!==null){setRemaining(Math.max(0,Math.ceil((until-Date.now())/1000)));setUntil(null);}else{const next=remaining||total;setRemaining(next);setUntil(Date.now()+next*1000);}}
  return <section className="dash-card dash-timer"><CardHead title={c.focus}/><p className="dash-muted">{c.focusNote}</p><div className="dash-timer-ring" style={{'--timer-progress':remaining/total*100+'%'}}><span className="dash-timer-value">{time}<small>{c.local}</small></span></div><div className="dash-timer-controls"><button type="button" className="dash-round" onClick={toggle} aria-label={until===null?c.start:c.pause} title={until===null?c.start:c.pause}><Icon name={until===null?'player-play':'player-pause'} size={20}/></button><button type="button" className="dash-round dash-round-light" onClick={()=>{setUntil(null);setRemaining(total);}} aria-label={c.reset} title={c.reset}><Icon name="refresh" size={20}/></button></div></section>;
}
export function Dashboard({ user }) {
  const { locale,localizedPath,t }=useLocale();
  const c=words[locale]||words.en;
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
  const [selected,setSelected]=useState(null);
  const [editor,setEditor]=useState(false);
  useEffect(()=>{if(editor&&dialog.current&&!dialog.current.open)dialog.current.showModal();},[editor]);
  const [calendarId,setCalendarId]=useState('');
  const [saving,setSaving]=useState(false);
  const [lookup,setLookup]=useState('');
  useEffect(()=>{const interval=window.setInterval(()=>setNow(new Date()),60000);return ()=>window.clearInterval(interval);},[]);
  const currentRange=weekWindow(now,zone,starts);
  const range=weekWindow(now,zone,starts,offset);
  const weekKey=range.days[0];
  const actualToday=currentRange.today;
  useEffect(()=>{
    let alive=true;setLoading(true);setError(false);
    loadDashboard(applicationContainer.calendarService,{from:range.from,to:range.to})
      .then(result=>{if(alive)setData(result);})
      .catch(()=>{if(alive){setData({calendars:[],events:[],failed:0});setError(true);}})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[weekKey,zone,reload,user.id]);
  const model=useMemo(()=>summarizeDashboard(data.events,{...range,today:actualToday},zone),[data.events,weekKey,actualToday,zone]);
  const activeDay=range.days.includes(selected)?selected:range.days.includes(actualToday)?actualToday:range.days[0];
  const chosen=model.days.find(day=>day.key===activeDay);
  const editable=data.calendars.filter(cal=>!cal.isHolidayCalendar&&['owner','admin','editor'].includes(cal.role));
  const activeCalendar=editable.find(cal=>cal.id===calendarId)||editable.find(cal=>cal.isMain)||editable[0];
  const percent=model.tasks.length?Math.round(model.done/model.tasks.length*100):0;
  const maxMinutes=Math.max(60,...model.days.map(day=>day.minutes));
  const avatar=applicationContainer.userService.imageUrl(user.avatarUrl);
  const weekday=key=>new Date(key+'T12:00:00Z').toLocaleDateString(locale,{weekday:'short',timeZone:'UTC'});
  const fullDay=key=>new Date(key+'T12:00:00Z').toLocaleDateString(locale,{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'});
  const formatTime=e=>dateOf(e)?new Date(dateOf(e)).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:zone,hour12:user.settings?.timeFormat==='12h'}):c.allDay;
  const linkFor=e=>localizedPath('/calendars/view/'+encodeURIComponent(e.calendarId));
  const schedule=localizedPath('/calendars/view');
  const value=n=>loading||error?'—':n;
  async function save(values){setSaving(true);try{await applicationContainer.calendarService.createEvent(activeCalendar.id,values);setEditor(false);setReload(n=>n+1);}catch(err){throw new Error(getLocalizedApiError(err,t,'calendarView.event.saveError'));}finally{setSaving(false);}}
  const dateFormat=new Intl.DateTimeFormat(locale,{month:'short',day:'numeric',timeZone:'UTC'});
  const firstDate=new Date(range.days[0]+'T12:00:00Z'),lastDate=new Date(range.days[6]+'T12:00:00Z');
  const dateLabel=typeof dateFormat.formatRange==='function'?dateFormat.formatRange(firstDate,lastDate):dateFormat.format(firstDate)+' – '+dateFormat.format(lastDate);
  return <section className="dashboard">
    <header className="dash-header"><div><span className="dash-kicker">{fullDay(actualToday)}</span><h1>{c.welcome}, {user.name?.trim().split(/\s+/)[0]||''}!</h1><p>{c.overview}</p></div><div className="dash-header-actions"><Link className="dash-action dash-action-light" to={schedule}><Icon name="calendar" size={19}/>{c.view}</Link><button className="dash-action dash-action-accent" type="button" disabled={loading||!editable.length} onClick={()=>{setCalendarId(activeCalendar.id);setEditor(true);}}><Icon name="plus" size={20}/>{c.add}</button></div></header>
    {(error||data.failed>0)&&<div className="dash-error" role="alert">{error?c.error:c.partial}<button type="button" onClick={()=>setReload(n=>n+1)}>{t('common.retry')}</button></div>}
    <div className="dash-overview">
      <div className="dash-week-control"><span>{offset===0?c.currentWeek:c.week}</span><div><button className="dash-round dash-round-light" type="button" aria-label={c.previous} onClick={()=>setOffset(n=>n-1)}><Icon name="chevron-left" size={18}/></button><strong>{dateLabel}</strong><button className="dash-round dash-round-light" type="button" aria-label={c.next} onClick={()=>setOffset(n=>n+1)}><Icon name="chevron-right" size={18}/></button>{offset!==0&&<button type="button" className="dash-text-button" onClick={()=>setOffset(0)}>{c.today}</button>}</div></div>
      {[[c.meetings,model.meetings.length,'users'],[c.tasks,model.tasks.length,'checkbox'],[c.reminders,model.reminders.length,'bell']].map(([label,n,icon])=><article className="dash-stat" key={icon}><span className="dash-stat-label"><span className="dash-stat-icon"><Icon name={icon} size={19}/></span>{label}</span><strong>{value(n)}</strong></article>)}
    </div>
    <div className="dash-grid" aria-busy={loading}>
      <section className="dash-card dash-profile"><div className="dash-profile-top"><span>{c.profile}</span><ArrowLink to={localizedPath('/account')} label={c.editProfile}/></div><div className="dash-profile-avatar">{avatar?<img src={avatar} alt=""/>:<span>{String(user.name||'?').trim().slice(0,1).toUpperCase()}</span>}</div><div className="dash-profile-info"><h2>{user.name}</h2><Link to={localizedPath('/account')}>{c.editProfile}<Icon name="arrow-up-right" size={15}/></Link></div></section>
      <section className="dash-card dash-activity"><CardHead title={c.planning} action={<ArrowLink to={schedule} label={c.view}/>}/><div className="dash-activity-value">{loading||error?'—':(model.minutes/60).toLocaleString(locale,{maximumFractionDigits:1})}<small> h</small></div><p className="dash-muted">{c.planned}</p><div className="dash-bars">{model.days.map(day=><div key={day.key} className={day.key===actualToday?'is-today':''}><div className="dash-bar-track"><span style={{height:loading||error?'0%':Math.max(0,Math.min(100,day.minutes/maxMinutes*100))+'%'}} title={Math.round(day.minutes)+' min'}/></div><i/><small>{weekday(day.key)}</small></div>)}</div></section>
      <FocusTimer c={c}/>
      <section className="dash-card dash-tasks"><CardHead title={c.complete}/><div className="dash-task-top"><strong>{value(percent)}{!loading&&!error?'%':''}</strong><span>{value(model.done)}/{value(model.tasks.length)} {c.done}</span></div><div className="dash-task-progress"><span style={{width:loading||error?'0%':percent+'%'}}/></div><div className="dash-task-list"><div className="dash-dark-head"><h3>{c.tasks}</h3><span>{value(model.tasks.length)}</span></div>{loading?<p className="dash-dark-empty">{t('common.loading')}</p>:!model.tasks.length?<p className="dash-dark-empty">{error?c.error:c.noTasks}</p>:model.tasks.slice(0,8).map(event=><Link to={linkFor(event)} className="dash-task" key={eventKey(event)}><span className="dash-task-symbol"><Icon name={event.status==='done'?'check':'checkbox'} size={19}/></span><span><strong>{event.title}</strong><small>{formatTime(event)} · {event.calendarName}</small></span><i className={event.status==='done'?'done':''}>{event.status==='done'&&<Icon name="check" size={13}/>}</i></Link>)}<Link className="dash-dark-link" to={schedule}>{c.view}<Icon name="arrow-right" size={16}/></Link></div></section>
      <section className="dash-card dash-calendars"><CardHead title={c.calendars} action={<ArrowLink to={localizedPath('/calendars')} label={c.manage}/>}/><div className="dash-calendar-list">{loading?<p className="dash-muted">{t('common.loading')}</p>:!data.calendars.length?<p className="dash-muted">{error?c.error:c.noCalendars}</p>:data.calendars.slice(0,5).map(cal=><Link key={cal.id} to={localizedPath('/calendars/view/'+encodeURIComponent(cal.id))}><i style={{background:cal.color}}/><span>{cal.isHolidayCalendar?t('calendarBasics.holidays'):cal.name}</span><Icon name="chevron-right" size={15}/></Link>)}</div><details className="dash-lookup"><summary>{c.lookup}</summary><form onSubmit={e=>{e.preventDefault();if(lookup.trim())navigate(localizedPath('/users/'+encodeURIComponent(lookup.trim())));}}><input aria-label={c.profileId} placeholder={c.profileId} value={lookup} onChange={e=>setLookup(e.target.value)} required/><button type="submit">{c.find}</button></form></details></section>
      <section className="dash-card dash-week"><CardHead title={c.week} action={<ArrowLink to={schedule} label={c.view}/>}/><div className="dash-week-days">{model.days.map(day=><button type="button" key={day.key} className={day.key===activeDay?'active':''} onClick={()=>setSelected(day.key)} aria-pressed={day.key===activeDay}><small>{weekday(day.key)}</small><strong>{Number(day.key.slice(-2))}</strong><i className={!loading&&day.events.length?'has-events':''}/></button>)}</div><div className="dash-day-heading"><strong>{fullDay(activeDay)}</strong><small>{value(chosen?.events.length||0)} {c.eventsToday.toLowerCase().replace(/ today| сьогодні/,'')}</small></div><div className="dash-day-events">{loading?<p className="dash-muted">{t('common.loading')}</p>:!chosen?.events.length?<div className="dash-day-empty"><Icon name="calendar-event" size={30}/><span>{error?c.error:c.noEvents}</span></div>:chosen.events.slice().sort((a,b)=>String(dateOf(a)||'').localeCompare(String(dateOf(b)||''))).slice(0,5).map(event=><Link className="dash-day-event" to={linkFor(event)} key={eventKey(event)}><span className="dash-event-time">{formatTime(event)}</span><span className="dash-event-block"><Icon name={typeIcon[event.type]||'calendar'} size={19}/><span><strong>{event.title}</strong><small>{event.calendarName}</small></span><Icon name="chevron-right" size={16}/></span></Link>)}</div></section>
    </div>
    {editor&&activeCalendar&&<dialog ref={dialog} className="dash-modal" aria-label={c.add} onCancel={e=>{e.preventDefault();if(!saving)setEditor(false);}}><div className="dash-modal-top"><label>{c.selectCalendar}<select value={activeCalendar.id} disabled={saving} onChange={e=>setCalendarId(e.target.value)}>{editable.map(cal=><option value={cal.id} key={cal.id}>{cal.name}</option>)}</select></label><button type="button" className="dash-text-button" disabled={saving} onClick={()=>setEditor(false)}>{c.close}</button></div><EventEditor key={activeCalendar.id} calendar={activeCalendar} saving={saving} onSave={save} onCancel={()=>setEditor(false)}/></dialog>}
  </section>;
}
