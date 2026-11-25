import { formatMinute } from './timeDisplay';
import { slotMinute } from './calendarInteractions';
import { CalendarEventButton, EventSymbol, EventStatus, useCalendarDrop } from './CalendarEventActions';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import { eventDayKey, fromCalendarInput, toCalendarInput } from './eventForm';
import { dayBlocks, shiftDay, visibleHours } from './PlannerGrid';
import './day-planner.css';

const keyOf=e=>e.calendarId+':'+(e.occurrenceId||e.id);
const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');

export function dailyPlannerModel(events,calendars,day,zone){
 const rows=calendars.map(cal=>{
  const own=events.filter(e=>e.calendarId===cal.id);
  const {blocks,lanes}=dayBlocks(own,day,zone);
  return {cal,blocks,lanes,holidays:own.filter(e=>e.type==='holiday'&&eventDayKey(e,zone)===day)};
 });
 const blocks=rows.flatMap(row=>row.blocks);
 const active=blocks.filter(b=>b.event.status!=='canceled');
 const meetings=active.filter(b=>b.event.type==='arrangement');
 const tasks=active.filter(b=>b.event.type==='task');
 const reminders=active.filter(b=>b.event.type==='reminder');
 const begin=Date.parse(fromCalendarInput(day+'T00:00',zone));
 const end=Date.parse(fromCalendarInput(shiftDay(day,1)+'T00:00',zone));
 const intervals=meetings.map(b=>[Math.max(begin,Date.parse(b.event.startsAt)),Math.min(end,Date.parse(b.event.endsAt))]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
 let booked=0,last=begin;
 for(const [a,b] of intervals){booked+=Math.max(0,b-Math.max(a,last));last=Math.max(last,b);}
 return {rows,blocks,meetings,tasks,reminders,booked:Math.round(booked/60000),done:tasks.filter(b=>b.event.status==='done').length,holidays:rows.flatMap(row=>row.holidays)};
}

export function plannerRows(events,calendars,day,zone,view,days=[day]){
 if(view==='week')return days.map(date=>{
  const model=dailyPlannerModel(events,calendars,date,zone);
  const own=calendars.flatMap(cal=>events.filter(e=>e.calendarId===cal.id));
  return {id:date,date,...dayBlocks(own,date,zone),holidays:model.holidays};
 });
 const {rows}=dailyPlannerModel(events,calendars,day,zone);
 if(rows.length!==1)return rows.map(row=>({...row,id:row.cal.id,date:day,name:row.cal.name,color:row.cal.color}));
 const {cal,holidays}=rows[0];
 const own=events.filter(e=>e.calendarId===cal.id);
 return ['arrangement','task','reminder',...(holidays.length?['holiday']:[])].map(type=>({
  id:cal.id+':'+type,date:day,type,color:cal.color,
  ...dayBlocks(own.filter(e=>e.type===type),day,zone),holidays:type==='holiday'?holidays:[]
 }));
}

export function DayPlanner({events,calendars,day,zone,timeFormat,fullDay,loading,error,partial,onSelect,onCreate,onCreateAt,canEdit,view='day',days=[day],onDaySelect}){
 const {locale,t}=useLocale(),uk=locale==='uk';
 const clock=n=>formatMinute(n,locale,timeFormat);
 const drop=useCalendarDrop();
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer)},[]);
 const model=dailyPlannerModel(events,calendars,day,zone);
 const rows=plannerRows(events,calendars,day,zone,view,days);
 const {first,last}=visibleHours(rows.flatMap(r=>r.blocks),fullDay);
 const gridRef=useRef(null);
 const [gridWidth,setGridWidth]=useState(700);
 useEffect(()=>{const el=gridRef.current;if(!el)return;const measure=()=>setGridWidth(el.clientWidth);measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();},[]);
 const todayKey=toCalendarInput(now,zone).slice(0,10);
 const span=(last-first)*60;
 const pos=n=>(n-first*60)/span*100;
 const hours=Array.from({length:last-first},(_,i)=>first+i);
 const nowText=toCalendarInput(now,zone);
 const minute=Number(nowText.slice(11,13))*60+Number(nowText.slice(14,16));
 const showNow=(view==='week'?days.includes(todayKey):todayKey===day)&&minute>=first*60&&minute<last*60;
 const labelWidth=Math.min(145,Math.max(65,gridWidth*.16));
 const laneWidth=Math.max(1,gridWidth-labelWidth);
 const labelStep=Math.max(1,Math.ceil(43*hours.length/laneWidth));
 const fittedRows=rows.map(row=>{
  const occupied=[];
  const blocks=row.blocks.map(b=>{
   const start=pos(b.start);
   const width=Math.min(100-start,Math.max(b.point?Math.min(100,6500/laneWidth):0,b.point?0:pos(b.end)-start,Math.min(100,1600/laneWidth)));
   const left=Math.min(start,Math.max(0,100-1600/laneWidth));
   const right=Math.min(100,left+Math.max(width,Math.min(100,1600/laneWidth)));
   let lane=occupied.findIndex(end=>end<=left);
   if(lane<0)lane=occupied.length;
   occupied[lane]=right;
   return {...b,left,width:right-left,lane};
  });
  return {...row,blocks,lanes:Math.max(1,occupied.length)};
 });
 const rowName=row=>view==='week'?new Date(row.date+'T12:00:00Z').toLocaleDateString(locale,{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}):row.name||({arrangement:uk?'Зустрічі':'Meetings',task:uk?'Завдання':'Tasks',reminder:uk?'Нагадування':'Reminders',holiday:uk?'Свята':'Holidays'}[row.type]);
 const unknown=loading||error||partial;
 const count=n=>unknown?'—':n;
 const duration=n=>Math.floor(n/60)+(uk?' год':'h')+(n%60?' '+n%60+(uk?' хв':'m'):'');
 const typeIcon=e=>e.type==='task'?(e.status==='done'?'check':'checkbox'):e.type==='reminder'?'bell':'calendar-event';
 const typeLabel=e=>e.type==='arrangement'?(uk?'Зустріч':'Meeting'):t('calendarView.type.'+e.type);
 const ordered=model.blocks.slice().sort((a,b)=>a.start-b.start);
 return <div className={"day-planner day-planner-"+view} aria-busy={loading}>
  <section className="day-planner-board">
   <div className="day-planner-scroll">
    <div className="day-planner-grid" ref={gridRef} style={{'--hours':hours.length,'--label-width':labelWidth+'px',gridTemplateRows:'32px '+fittedRows.map(r=>'minmax(0,'+Math.max(1,r.lanes+r.holidays.length)+'fr)').join(' ')}}>
     <div className="day-axis-name">{view==='week'?(uk?'День':'Day'):(uk?'Календарі':'Calendars')}</div>
     <div className="day-axis">{hours.filter((h,i)=>i%labelStep===0).map(h=><span key={h} style={{left:pos(h*60)+'%'}}>{clock(h*60)}</span>)}{showNow&&<strong className="day-now-tag" style={{left:pos(minute)+'%'}}>{clock(minute)}</strong>}</div>
     {fittedRows.map(row=>{const {blocks,lanes,holidays}=row;const slots=lanes+holidays.length;return <div className="day-row" key={row.id}>
      <div className={'day-row-name'+(view==='week'&&row.date===day?' selected':'')}>{view==='week'?<button className="day-row-select" type="button" onClick={()=>onDaySelect?.(row.date)}><strong>{rowName(row)}</strong><small>{count(blocks.length+holidays.length)} {uk?'подій':'events'}</small></button>:<div><strong>{rowName(row)}</strong><small>{count(blocks.length+holidays.length)} {uk?'подій':'events'}</small></div>}</div>
      <div {...drop(row.date||day,e=>{const rect=e.currentTarget.getBoundingClientRect();return slotMinute((e.clientX-rect.left)/rect.width,first,last);})} className={'day-row-lane'+(canEdit?' calendar-create-lane':'')} onClick={e=>{if(!canEdit||e.target.closest('button'))return;const rect=e.currentTarget.getBoundingClientRect();onCreateAt?.(row.date||day,slotMinute((e.clientX-rect.left)/rect.width,first,last));}} style={{"--slot-height":100/slots+"%"}}>
       {holidays.map((e,i)=><button type="button" key={keyOf(e)} className="day-holiday" style={{top:(i+.5)/slots*100+'%'}} onClick={()=>onSelect(e)}>{e.title}</button>)}
       {blocks.map(b=>{const e=b.event;return <CalendarEventButton event={e} placement="positioned" key={keyOf(e)} className={'day-event '+(b.point?'instant ':'meeting ')+(e.status==='done'?'done ':e.status==='canceled'?'canceled ':'')+e.type} title={e.title+' · '+clock(b.start)+(b.point?'':'–'+clock(b.end))} style={{left:b.left+'%',top:(holidays.length+b.lane+.5)/slots*100+'%',width:b.width+'%'}} onClick={()=>onSelect(e)}><span className="day-event-text"><strong>{e.title}</strong><small>{clock(b.start)}{!b.point?'–'+clock(b.end):''}</small></span></CalendarEventButton>})}
       {showNow&&row.date===todayKey&&<i className="day-now-line" style={{left:pos(minute)+'%'}}/>}
      </div>
     </div>})}
     {!rows.length&&<div className="day-no-calendars">{uk?'Оберіть календарі у фільтрі':'Choose calendars to display'}</div>}
    </div>
   </div>
   <div className="day-board-bottom"><div className="day-legend"><span><i/>{uk?'Зустріч':'Meeting'}</span><span><i/>{uk?'Завдання':'Task'}</span><span><i/>{uk?'Нагадування':'Reminder'}</span><span><i/>{uk?'Виконано':'Done'}</span></div>{canEdit&&<button type="button" onClick={onCreate}><Icon name="plus" size={15}/>{t('calendarView.event.create')}</button>}</div>
  </section>
  {view!=='timeline'&&<aside className="day-planner-side">
   <section className="day-side-card"><h3>{uk?'День у цифрах':'Day in numbers'}</h3><p>{new Date(day+'T12:00:00Z').toLocaleDateString(locale,{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'})}</p><div className="day-metrics"><div className="day-booked"><span>{uk?'Час зустрічей':'Meeting time'}</span><strong>{unknown?'—':duration(model.booked)}</strong></div>{[[uk?'Зустрічі':'Meetings',model.meetings.length],[uk?'Завдання':'Tasks',model.tasks.length],[uk?'Нагадування':'Reminders',model.reminders.length],[uk?'Виконано':'Done',model.done]].map(([label,n])=><div key={label}><span>{label}</span><strong>{count(n)}</strong></div>)}</div></section>
   <section className="day-side-card day-event-list"><h3>{uk?'План дня':'Daily agenda'}</h3>{loading?<p>{t('common.loading')}</p>:error?<p>{error}</p>:!ordered.length&&!model.holidays.length?<p>{uk?'На цей день немає подій':'Nothing planned for this day'}</p>:<div>{model.holidays.map(e=><button key={keyOf(e)} type="button" onClick={()=>onSelect(e)}><EventSymbol event={e}/><span><strong>{e.title}</strong><small>{uk?'Увесь день':'All day'}</small></span></button>)}{ordered.map(b=><CalendarEventButton event={b.event} key={keyOf(b.event)} onClick={()=>onSelect(b.event)}><EventSymbol event={b.event}/><span><strong>{b.event.title}</strong><small>{clock(b.start)} · {typeLabel(b.event)}</small></span><EventStatus event={b.event}/></CalendarEventButton>)}</div>}</section>
  </aside>}
 </div>;
}
