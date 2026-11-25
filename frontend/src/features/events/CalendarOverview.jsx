import { CalendarEventButton, EventStatus } from './CalendarEventActions';
import { EventPreviewButton } from './EventPreviewButton';
import { useLocale } from '../../i18n/LocaleProvider';
import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import { eventDayKey } from './eventForm';
import { dayBlocks } from './PlannerGrid';
import './calendar-overview.css';

const keyOf=e=>e.calendarId+':'+(e.occurrenceId||e.id);
const timeOf=e=>e.type==='task'?e.deadline:e.type==='reminder'?e.remindAt:e.startsAt;
const sortEvents=(a,b)=>String(timeOf(a)||a.date||'').localeCompare(String(timeOf(b)||b.date||''));

export function overviewModel(events,days,day,zone){
 const active=events.filter(e=>e.status!=='canceled');
 const week=active.filter(e=>days.includes(eventDayKey(e,zone))||e.type==='arrangement'&&days.some(d=>dayBlocks([e],d,zone).blocks.length));
 const tasks=week.filter(e=>e.type==='task').sort(sortEvents);
 const meetings=week.filter(e=>e.type==='arrangement').sort(sortEvents);
 const reminders=week.filter(e=>e.type==='reminder').sort(sortEvents);
 const done=tasks.filter(e=>e.status==='done').length;
 const daily=days.map(d=>{
  const blocks=dayBlocks(week,d,zone).blocks;
  return {day:d,count:blocks.length+week.filter(e=>e.type==='holiday'&&eventDayKey(e,zone)===d).length};
 });
 const schedule=dayBlocks(week,day,zone).blocks.map(b=>({...b.event,displayMinute:b.start,displayEnd:b.end,point:b.point}));
 const holidays=week.filter(e=>e.type==='holiday'&&eventDayKey(e,zone)===day);
 return {tasks,meetings,reminders,done,daily,schedule:[...holidays,...schedule]};
}


function useOverviewLabels(zone, timeFormat) {
  const {locale,t}=useLocale(),uk=locale==='uk';
  const timeLabel=n=>{
    if(timeFormat!=='12h')return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
    return new Date(Date.UTC(2000,0,1,Math.floor(n/60),n%60)).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'UTC'});
  };
  const dateTime=e=>timeOf(e)?new Date(timeOf(e)).toLocaleString(locale,{weekday:'short',hour:'2-digit',minute:'2-digit',timeZone:zone,...(timeFormat?{hour12:timeFormat==='12h'}:{})}):e.date;
  const typeName=e=>e.type==='arrangement'?(uk?'Зустріч':'Meeting'):t('calendarView.type.'+e.type);
  return {locale,t,uk,timeLabel,dateTime,typeName};
}

export function OverviewWeek({days,day,today,onDaySelect}) {
  const {locale}=useLocale();
  return <div className="overview-week">{days.map(d=><button key={d} type="button" aria-pressed={day===d} onClick={()=>onDaySelect(d)}><small>{new Date(d+'T12:00:00Z').toLocaleDateString(locale,{weekday:'short',timeZone:'UTC'})}</small><strong>{Number(d.slice(-2))}</strong>{d===today&&<i/>}</button>)}</div>;
}

export function OverviewScheduleList({schedule,onSelect,loading,error,timeFormat}) {
  const {t,uk,timeLabel,typeName}=useOverviewLabels('UTC',timeFormat);
  const empty=label=><p className="overview-empty">{loading?t('common.loading'):error||label}</p>;
  return <div className="overview-schedule-list">{loading||error?empty(''):schedule.length?schedule.map(e=><div className="overview-slot" key={keyOf(e)}><span>{e.displayMinute==null?(uk?'День':'All day'):timeLabel(e.displayMinute)}</span><CalendarEventButton event={e} onClick={()=>onSelect(e)} className={e.type==='arrangement'?'meeting':''}><strong>{e.title}</strong><small>{e.point||e.displayEnd==null?typeName(e):timeLabel(e.displayMinute)+' – '+timeLabel(e.displayEnd)}</small></CalendarEventButton></div>):empty(uk?'На цей день нічого не заплановано':'Nothing planned for this day')}</div>;
}

export function OverviewTasksTable({tasks,zone,onSelect,loading,error,timeFormat}) {
  const {t,uk,dateTime}=useOverviewLabels(zone,timeFormat);
  const empty=label=><p className="overview-empty">{loading?t('common.loading'):error||label}</p>;
  return <>{loading||error?empty(''):tasks.length?<div className="overview-table"><div className="overview-table-head"><span>{uk?'Назва':'Task'}</span><span>{uk?'Термін':'Deadline'}</span><span>{uk?'Статус':'Status'}</span></div>{tasks.map(e=><CalendarEventButton event={e} key={keyOf(e)} onClick={()=>onSelect(e)}><span><strong>{e.title}</strong><small>{e.calendarName}</small></span><small>{dateTime(e)}</small><EventStatus event={e}/></CalendarEventButton>)}</div>:empty(uk?'Немає завдань цього тижня':'No tasks this week')}</>;
}

export function OverviewUpcomingList({events,zone,onSelect,loading,error,timeFormat,emptyLabel}) {
  const {t,uk,dateTime,typeName}=useOverviewLabels(zone,timeFormat);
  const empty=label=><p className="overview-empty">{loading?t('common.loading'):error||emptyLabel||label}</p>;
  return <>{loading||error?empty(''):events.length?<div className="overview-meeting-list">{events.map(e=><EventPreviewButton event={e} zone={zone} key={keyOf(e)} onClick={()=>onSelect(e)}><i style={{background:e.type==='reminder'?'var(--chronos-accent)':'#ffffff85'}}/><span><strong>{e.title}</strong><small>{dateTime(e)} · {typeName(e)}</small></span></EventPreviewButton>)}</div>:empty(uk?'Немає подій цього тижня':'No events this week')}</>;
}

export function OverviewCompletion({tasks,unknown}) {
  const {locale}=useLocale(),uk=locale==='uk';
  const done=tasks.filter(e=>e.status==='done').length;
  const val=n=>unknown?'—':n;
  const percent=tasks.length?Math.round(done/tasks.length*100):0;
  return <><div className="overview-ring" style={{'--done':unknown?'0%':percent+'%'}}><div><strong>{unknown?'—':percent+'%'}</strong><small>{uk?'виконано':'completed'}</small></div></div><div className="overview-ring-labels"><span><i/>{val(done)} {uk?'готово':'done'}</span><span><i/>{val(tasks.length-done)} {uk?'залишилось':'left'}</span></div></>;
}

export function CalendarOverview({events,days,day,today,zone,loading,error,partial,onSelect,onDaySelect,onView,onCreate,canEdit}){
 const {locale,t}=useLocale(),uk=locale==='uk';
 const model=overviewModel(events,days,day,zone);
 const {tasks,meetings,reminders,done,daily,schedule}=model;
 const unknown=loading||error||partial;
 const val=n=>unknown?'—':n;
 const percent=tasks.length?Math.round(done/tasks.length*100):0;
 const dateLabel=d=>new Date(d+'T12:00:00Z').toLocaleDateString(locale,{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});
 const arrow=(view,label)=><button type="button" className="overview-arrow" title={label} aria-label={label} onClick={()=>onView(view)}><Icon name="arrow-up-right" size={18}/></button>;
 return <div className="calendar-overview" aria-busy={loading}>
  <div className="overview-top">
   <section className="overview-progress"><div><span>{uk?'Завдання за тиждень':'Weekly task progress'}</span><strong>{val(done)} / {val(tasks.length)}</strong></div><div className="overview-progress-track" role="img" aria-label={unknown?'—':percent+'%'}><i style={{width:unknown?0:percent+'%'}}/></div></section>
   <div className="overview-counts">{[[uk?'Зустрічі':'Meetings',meetings.length],[uk?'Завдання':'Tasks',tasks.length],[uk?'Нагадування':'Reminders',reminders.length]].map(([label,n])=><div key={label}><strong>{val(n)}</strong><span>{label}</span></div>)}</div>
  </div>
  <div className="overview-grid">
   <section className="overview-card overview-schedule">
    <header><h3>{uk?'Розклад':'Schedule'}</h3>{arrow('day',uk?'Відкрити день':'Open day')}</header>
    <OverviewWeek days={days} day={day} today={today} onDaySelect={onDaySelect}/>
    <p className="overview-date">{dateLabel(day)}</p>
    <OverviewScheduleList schedule={schedule} onSelect={onSelect} loading={loading} error={error}/>
    {canEdit&&<button className="overview-add" type="button" onClick={onCreate}><Icon name="plus" size={16}/>{t('calendarView.event.create')}</button>}
   </section>
   <section className="overview-card overview-tasks"><header><h3>{uk?'Завдання тижня':'Tasks this week'}</h3>{arrow('agenda',uk?'Список подій':'Open agenda')}</header>
    <OverviewTasksTable tasks={tasks} zone={zone} onSelect={onSelect} loading={loading} error={error}/>
   </section>
   <section className="overview-card overview-meetings"><header><h3>{uk?'Зустрічі та нагадування':'Meetings & reminders'}</h3>{arrow('day',uk?'Відкрити день':'Open day')}</header>
    <OverviewUpcomingList events={[...meetings,...reminders].sort(sortEvents)} zone={zone} onSelect={onSelect} loading={loading} error={error}/>
   </section>
   <section className="overview-card overview-activity"><header><h3>{uk?'Події за тиждень':'Weekly activity'}</h3>{arrow('week',uk?'Відкрити тиждень':'Open week')}</header><div className="overview-bars">{daily.map(d=><button type="button" key={d.day} onClick={()=>onDaySelect(d.day)} aria-pressed={d.day===day}><strong>{val(d.count)}</strong><span><i style={{height:unknown?'0%':d.count/Math.max(1,...daily.map(x=>x.count))*100+'%'}}/></span><small>{new Date(d.day+'T12:00:00Z').toLocaleDateString(locale,{weekday:'short',timeZone:'UTC'})}</small></button>)}</div></section>
   <section className="overview-card overview-completion"><header><h3>{uk?'Виконання завдань':'Task completion'}</h3></header><OverviewCompletion tasks={tasks} unknown={unknown}/></section>
  </div>
 </div>;
}
