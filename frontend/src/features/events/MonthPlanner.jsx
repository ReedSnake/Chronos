import { weekRowNumber } from './calendarInteractions';
import { CalendarEventButton, EventSymbol, EventStatus } from './CalendarEventActions';
import { useMemo } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import { eventDayKey, toCalendarInput } from './eventForm';
import { shiftDay, weekDays } from './PlannerGrid';
import './month-planner.css';

const keyOf=e=>e.calendarId+':'+(e.occurrenceId||e.id);
const timeOf=e=>e.type==='task'?e.deadline:e.type==='reminder'?e.remindAt:e.startsAt;
const weekend=d=>[0,6].includes(new Date(d+'T12:00:00Z').getUTCDay());

export function monthModel(day,startsOn,events,zone){
 const month=day.slice(0,7),first=month+'-01';
 const next=new Date(first+'T00:00:00Z');
 next.setUTCMonth(next.getUTCMonth()+1);
 const last=shiftDay(next.toISOString().slice(0,10),-1);
 const gridStart=weekDays(first,startsOn)[0],gridEnd=weekDays(last,startsOn)[6];
 const dates=[];
 for(let d=gridStart;d<=gridEnd;d=shiftDay(d,1))dates.push(d);
 const records=events.flatMap(event=>{
  const start=event.type==='holiday'?eventDayKey(event,zone):toCalendarInput(timeOf(event),zone).slice(0,10);
  if(!start)return [];
  const finish=Date.parse(event.endsAt),begin=Date.parse(event.startsAt);
  const end=event.type==='arrangement'&&finish>begin?toCalendarInput(new Date(finish-1),zone).slice(0,10):start;
  return end<first||start>last?[]:[{event,start,end}];
 }).sort((a,b)=>a.start.localeCompare(b.start)||b.end.localeCompare(a.end)||String(timeOf(a.event)||'').localeCompare(String(timeOf(b.event)||''))||keyOf(a.event).localeCompare(keyOf(b.event)));
 const weeks=[];
 for(let i=0;i<dates.length;i+=7){
  const days=dates.slice(i,i+7),lanes=[],segments=[];
  for(const record of records){
   const start=record.start<first?first:record.start,end=record.end>last?last:record.end;
   if(end<days[0]||start>days[6])continue;
   const left=start<=days[0]?0:days.indexOf(start),right=end>=days[6]?6:days.indexOf(end);
   let lane=lanes.findIndex(occupied=>occupied<left);
   if(lane<0)lane=lanes.length;
   lanes[lane]=right;
   segments.push({...record,left,right,lane});
  }
  weeks.push({days,segments,hidden:days.map((_,j)=>segments.filter(s=>s.lane>=2&&s.left<=j&&s.right>=j).length)});
 }
 const active=records.filter(r=>r.event.status!=='canceled');
 const counts=['arrangement','task','reminder','holiday'].map(type=>active.filter(r=>r.event.type===type).length);
 return {weeks,records,counts,active:active.length,selected:records.filter(r=>r.start<=day&&r.end>=day)};
}

export function MonthPlanner({day,today,startsOn,events,zone,calendarName,loading,error,partial,canEdit,onDaySelect,onSelect,onCreate}){
 const {locale,t}=useLocale(),uk=locale==='uk';
 const model=useMemo(()=>monthModel(day,startsOn,events,zone),[day,startsOn,events,zone]);
 const unknown=loading||error||partial;
 const labels=uk?['Зустрічі','Завдання','Нагадування','Свята']:['Meetings','Tasks','Reminders','Holidays'];
 const types=['arrangement','task','reminder','holiday'];
 const format=(d,options)=>new Date(d+'T12:00:00Z').toLocaleDateString(locale,{...options,timeZone:'UTC'});
 const count=n=>unknown?'—':n;
 const time=e=>toCalendarInput(timeOf(e),zone).slice(11,16);
 const icon=e=>e.type==='task'?'checkbox':e.type==='reminder'?'bell':'calendar-event';
 const range=r=>format(r.start,{day:'numeric',month:'short'})+' – '+format(r.end,{day:'numeric',month:'short'});
 return <div className="month-planner">
  <section className="month-main">
   <div className="month-summary">
    <div className="month-total"><strong>{count(model.active)}</strong><span>{uk?'подій цього місяця':'events this month'}</span></div>
    <div className="month-distribution">
     <div className="month-distribution-labels">{labels.map((label,i)=><span key={label}><i className={types[i]}/>{label} <strong>{count(model.counts[i])}</strong></span>)}</div>
     <div className="month-distribution-track" aria-hidden="true">{!unknown&&model.active>0&&model.counts.map((n,i)=>n>0?<i key={types[i]} className={types[i]} style={{flex:n}}/>:null)}</div>
    </div>
   </div>
   <div className="month-grid-scroll"><div className="month-grid">
    <div className="month-weekdays"><span className="month-week-number" title="ISO 8601">#</span>{model.weeks[0].days.map(d=><span key={d} className={weekend(d)?'weekend':''}>{format(d,{weekday:'short'})}</span>)}</div>
    {model.weeks.map(week=><div className="month-week-row" key={week.days[0]}><span className="month-week-number" style={{gridColumn:1,gridRow:"1 / 5"}}>{weekRowNumber(week.days[0],startsOn)}</span>
     {week.days.map((d,i)=>{const outside=d.slice(0,7)!==day.slice(0,7);return <div key={d} className={'month-tile'+(outside?' outside':'')+(weekend(d)?' weekend':'')+(d===day?' selected':'')+(d===today?' today':'')} style={{gridColumn:i+2,gridRow:'1 / 5'}} onClick={e=>{if(canEdit&&!outside&&!e.target.closest('button'))onCreate(d);}}>
      <button className="month-tile-hit" type="button" aria-label={format(d,{dateStyle:'full'})} aria-pressed={d===day} onClick={()=>canEdit&&!outside?onCreate(d):onDaySelect(d)}><span>{Number(d.slice(-2))}</span></button>
      {canEdit&&!outside&&<button className="month-tile-add" type="button" aria-label={t('calendarView.event.create')+' '+d} onClick={()=>onCreate(d)}><Icon name="plus" size={14}/></button>}
     </div>})}
     {week.segments.filter(s=>s.lane<2).map(s=><CalendarEventButton event={s.event} placement="grid" className={'month-event '+s.event.type+(s.event.status==='done'?' done':'')+(s.event.status==='canceled'?' canceled':'')} key={keyOf(s.event)} style={{gridColumn:(s.left+2)+' / '+(s.right+3),gridRow:s.lane+2}} onClick={()=>onSelect(s.event)} title={s.event.title+' · '+(s.start!==s.end?range(s):time(s.event))}><i/><span>{s.event.title}</span>{s.left!==s.right&&<small>{range(s)}</small>}</CalendarEventButton>)}
     {week.hidden.map((n,i)=>n>0&&<button type="button" key={week.days[i]} className="month-more" style={{gridColumn:i+2,gridRow:4}} onClick={()=>onDaySelect(week.days[i])}>+{n} {uk?'ще':'more'}</button>)}
    </div>)}
   </div></div>
  </section>
  <aside className="month-side">
   <section className="month-day-card">
    <div className="month-day-cover"><span>{format(day,{weekday:'long'})}</span><strong>{Number(day.slice(-2))}</strong><span>{format(day,{month:'long',year:'numeric'})}</span></div>
    <div className="month-day-content"><div className="month-day-heading"><h3>{uk?'План дня':'Daily agenda'}</h3><span>{count(model.selected.length)}</span></div>
     {loading?<p>{t('common.loading')}</p>:error?<p>{error}</p>:!model.selected.length?<p>{uk?'На цей день нічого не заплановано':'Nothing planned for this day'}</p>:<div className="month-day-list">{model.selected.map(r=><CalendarEventButton event={r.event} key={keyOf(r.event)} onClick={()=>onSelect(r.event)}><EventSymbol event={r.event}/><span><strong>{r.event.title}</strong><small>{r.start!==r.end?range(r):r.event.type==='holiday'?(uk?'Увесь день':'All day'):time(r.event)} · {r.event.calendarName}</small></span><EventStatus event={r.event}/></CalendarEventButton>)}</div>}
     {canEdit&&<button type="button" className="month-create" onClick={()=>onCreate(day)}><Icon name="plus" size={16}/>{t('calendarView.event.create')}</button>}
    </div>
   </section>
   <section className="month-stat-card"><h3>{uk?'Статистика місяця':'Month in numbers'}</h3>{labels.map((label,i)=><div className="month-stat" key={label}><div><span>{label}</span><strong>{count(model.counts[i])}</strong></div><div className="month-stat-track"><i className={types[i]} style={{width:unknown||!model.active?'0%':model.counts[i]/model.active*100+'%'}}/></div></div>)}<small>{uk?'Нові події в':'New events in'} · {calendarName}</small></section>
  </aside>
 </div>;
}
