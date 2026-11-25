import { slotMinute } from './calendarInteractions';
import { CalendarEventButton, useCalendarDrop } from './CalendarEventActions';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { eventDayKey, fromCalendarInput, toCalendarInput } from './eventForm';
import '../../styles/planner.css';

export function shiftDay(key,n){const date=new Date(key+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10)}
export function weekDays(key,start='monday'){const weekday=new Date(key+'T00:00:00Z').getUTCDay();const first=shiftDay(key,-((weekday+(start==='sunday'?0:6))%7));return Array.from({length:7},(_,i)=>shiftDay(first,i))}
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function minute(value,zone){const s=toCalendarInput(value,zone);return Number(s.slice(11,13))*60+Number(s.slice(14,16))}
export function dayBlocks(events,day,zone){
 const begin=Date.parse(fromCalendarInput(day+'T00:00',zone)),end=Date.parse(fromCalendarInput(shiftDay(day,1)+'T00:00',zone));
 const blocks=[];
 for(const e of events){
  if(e.type==='holiday')continue;
  const value=e.type==='task'?e.deadline:e.type==='reminder'?e.remindAt:e.startsAt;
  const start=Date.parse(value),finish=e.type==='arrangement'?Date.parse(e.endsAt):start;
  if(!Number.isFinite(start)||!Number.isFinite(finish))continue;
  if(e.type==='arrangement'&&finish>start){if(start>=end||finish<=begin)continue;}
  else if(start<begin||start>=end)continue;
  const a=start<=begin?0:minute(value,zone),b=finish>=end?1440:minute(new Date(finish),zone);
  const point=e.type!=='arrangement'||finish<=start;
  blocks.push({event:e,start:a,end:point?a:Math.max(a+1,b),point});
 }
 blocks.sort((a,b)=>a.start-b.start||b.end-a.end);
 // Reserve enough visual space for instantaneous markers and short events.
 const lanes=[];
 for(const item of blocks){const occupiedEnd=Math.min(1440,Math.max(item.end,item.start+35));let index=lanes.findIndex(last=>last<=item.start);if(index<0)index=lanes.length;lanes[index]=occupiedEnd;item.lane=index;}
 return {blocks,lanes:Math.max(1,lanes.length)};
}
const keyOf=e=>e.calendarId+':'+(e.occurrenceId||e.id);
const timeLabel=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
function useClock(){const [now,setNow]=useState(()=>new Date());useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer)},[]);return now}

export function visibleHours(blocks,fullDay=false){
 if(fullDay)return {first:0,last:24};
 const first=Math.min(8,...blocks.map(b=>Math.floor(b.start/60)));
 const last=Math.min(24,Math.max(20,...blocks.map(b=>Math.ceil(Math.max(b.end,b.start+35)/60))));
 return {first,last};
}
export function PlannerGrid({view,days,events,calendars,zone,onSelect,selectedDay,onDaySelect,fullDay=false,canEdit=false,onCreateAt}){
 const {locale}=useLocale(),now=useClock();
 const drop=useCalendarDrop();
 const viewport=useRef(null);
 const today=eventDayKey({startsAt:now},zone),nowMinute=minute(now,zone);
 const dateKey=days[0];
 const allBlocks=days.flatMap(day=>dayBlocks(events,day,zone).blocks);
 const {first,last}=visibleHours(allBlocks,fullDay);
 const span=(last-first)*60;
 const position=n=>(n-first*60)/span*100;
 const y=n=>position(n);
 const hours=Array.from({length:last-first},(_,i)=>first+i);
 const nowVisible=nowMinute>=first*60&&nowMinute<last*60;
 const isWeekend=d=>[0,6].includes(new Date(d+'T12:00:00Z').getUTCDay());
 useEffect(()=>{const el=viewport.current;if(el){el.scrollTop=0;el.scrollLeft=0;}},[view,dateKey,fullDay]);
 const label=b=>b.point?timeLabel(b.start):timeLabel(b.start)+' – '+timeLabel(b.end);
 function block(b,style){const e=b.event;return <CalendarEventButton event={e} placement="positioned" key={keyOf(e)} className={'planner-block'+(b.point?' point':'')+(e.status==='done'?' done':'')+(e.status==='canceled'?' canceled':'')} style={{...style,'--event-color':e.color||'var(--chronos-accent)'}} title={e.title+' · '+label(b)} onClick={()=>onSelect(e)}><strong>{e.title}</strong><small>{label(b)}</small></CalendarEventButton>}
 if(view==='timeline'){
  const day=days[0];
  return <div className="planner-viewport timeline-viewport" ref={viewport}><div className="planner-timeline" style={{'--hour-count':hours.length,'--timeline-width':(140+hours.length*58)+'px'}}>
   <div className="planner-lane-label planner-axis-label">{locale==='uk'?'Календар':'Calendar'}</div>
   <div className="planner-axis">{hours.map(h=><span key={h} style={{left:position(h*60)+'%'}}>{timeLabel(h*60)}</span>)}{day===today&&nowVisible&&<i className="planner-now-tag" style={{left:position(nowMinute)+'%'}}>{timeLabel(nowMinute)}</i>}</div>
   {calendars.map(cal=>{
    const own=events.filter(e=>e.calendarId===cal.id),{blocks,lanes}=dayBlocks(own,day,zone);
    const holidays=own.filter(e=>e.type==='holiday'&&eventDayKey(e,zone)===day);
    return <div className="planner-lane-pair" key={cal.id} style={{display:'contents'}}>
     <div className="planner-lane-label"><i style={{background:cal.color||'var(--chronos-accent)'}}/><div><strong>{cal.name}</strong><small>{blocks.length+holidays.length} {locale==='uk'?'подій':'events'}</small></div></div>
     <div className="planner-lane" style={{height:Math.max(68,lanes*46+16+holidays.length*28)}}>
      {holidays.map((e,i)=><button type="button" className="planner-block planner-holiday" key={keyOf(e)} style={{left:5,top:i*28+4,width:'calc(100% - 10px)',height:24}} onClick={()=>onSelect(e)}>{e.title}</button>)}
      {blocks.map(b=>block(b,{left:'min('+position(b.start)+'%, calc(100% - 28px))',top:holidays.length*28+b.lane*46+8,width:b.point?'min(105px, max(28px, '+(100-position(b.start))+'%))':'max(20px, '+(position(b.end)-position(b.start))+'%)',height:38}))}
      {day===today&&nowVisible&&<i className="planner-now" style={{left:position(nowMinute)+'%'}}/>}
     </div>
    </div>
   })}
  </div></div>
 }
 return <div className="planner-viewport week-viewport" ref={viewport}><div className="planner-week" style={{'--hour-height':100/(last-first)+'%'}}>
  <div className="planner-week-head planner-zone" title={zone}>{zone.split('/').pop().replaceAll('_',' ')}</div>
  {days.map(d=><div key={d} className={'planner-week-head'+(d===today?' today':'')+(d===selectedDay?' selected':'')}><button type="button" onClick={()=>onDaySelect?.(d)} aria-pressed={d===selectedDay}><small>{new Date(d+'T12:00:00Z').toLocaleDateString(locale,{weekday:'short',timeZone:'UTC'})}</small><strong>{Number(d.slice(-2))}</strong></button></div>)}
  <div className="planner-all-day">{locale==='uk'?'Увесь день':'All day'}</div>
  {days.map(d=><div className="planner-all-day" key={d}>{events.filter(e=>e.type==='holiday'&&eventDayKey(e,zone)===d).map(e=><button key={keyOf(e)} onClick={()=>onSelect(e)}>{e.title}</button>)}</div>)}
  <div className="planner-hour-labels">{hours.filter((h,i)=>!fullDay||i%2===0).map(h=><span key={h} style={{top:y(h*60)+'%'}}>{timeLabel(h*60)}</span>)}</div>
  {days.map(d=>{const {blocks,lanes}=dayBlocks(events,d,zone);return <div key={d} {...drop(d,e=>{const rect=e.currentTarget.getBoundingClientRect();return slotMinute((e.clientY-rect.top)/rect.height,first,last);})} className={'planner-day-lane'+(isWeekend(d)?' weekend':'')+(d===selectedDay?' selected':'')+(canEdit?' calendar-create-lane':'')} onClick={e=>{if(!canEdit||e.target.closest('button'))return;const rect=e.currentTarget.getBoundingClientRect();onCreateAt?.(d,slotMinute((e.clientY-rect.top)/rect.height,first,last));}}>
    {blocks.map(b=>block(b,{top:'min('+y(b.start)+'%, calc(100% - 12px))',height:b.point?'min(20px, '+(100-y(b.start))+'%)':'max(10px, calc('+(y(b.end)-y(b.start))+'% - 1px))',left:'calc('+b.lane/lanes*100+'% + 3px)',width:'calc('+100/lanes+'% - 6px)'}))}
    {d===today&&nowVisible&&<i className="planner-now" style={{top:y(nowMinute)+'%'}}><span>{timeLabel(nowMinute)}</span></i>}
   </div>})}
 </div></div>
}
