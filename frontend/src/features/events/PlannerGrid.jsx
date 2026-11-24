import { useEffect, useState } from 'react';
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
const timeLabel=(n)=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
function useClock(){const [now,setNow]=useState(()=>new Date());useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer)},[]);return now}
export function PlannerGrid({view,days,events,calendars,zone,onSelect}){
 const {locale,t}=useLocale(),now=useClock();
 const today=eventDayKey({startsAt:now},zone),nowMinute=minute(now,zone);
 const formatDay=key=>new Date(key+'T12:00:00Z').toLocaleDateString(locale,{weekday:'short',day:'numeric',timeZone:'UTC'});
 const hours=Array.from({length:24},(_,i)=>i);
 const label=b=>b.point?timeLabel(b.start):timeLabel(b.start)+' – '+timeLabel(b.end);
 function block(b,style){const e=b.event;return <button type="button" key={keyOf(e)} className={'planner-block'+(b.point?' point':'')} style={{...style,'--event-color':e.color||'var(--chronos-accent)'}} title={e.title+' · '+label(b)} onClick={()=>onSelect(e)}><strong>{e.title}</strong>{!b.point&&<small>{label(b)}</small>}</button>}
 if(view==='timeline'){
 const day=days[0];return <div className="planner-viewport"><div className="planner-timeline">
 <div className="planner-lane-label">{locale==='uk'?'Календарі':'Calendars'}</div><div className="planner-axis">{hours.filter(h=>h%2===0).map(h=><span key={h} style={{left:h/24*100+'%'}}>{timeLabel(h*60)}</span>)}</div>
 {calendars.map(cal=>{const own=events.filter(e=>e.calendarId===cal.id),{blocks,lanes}=dayBlocks(own,day,zone);const holidays=own.filter(e=>e.type==='holiday'&&eventDayKey(e,zone)===day);return <div className="planner-lane-pair" key={cal.id} style={{display:'contents'}}><div className="planner-lane-label"><i style={{background:cal.color||'var(--chronos-accent)'}}/>{cal.name}</div><div className="planner-lane" style={{height:Math.max(54,lanes*44+12+holidays.length*27)}}>{holidays.map((e,i)=><button type="button" className="planner-block" key={keyOf(e)} style={{left:5,top:i*27+4,width:'calc(100% - 10px)',height:24}} onClick={()=>onSelect(e)}>{e.title}</button>)}{blocks.map(b=>block(b,{left:'min('+b.start/1440*100+'%, calc(100% - 24px))',top:holidays.length*27+b.lane*44+6,width:b.point?'max(24px, min(100px, '+(1440-b.start)/1440*100+'%))':'max(18px, '+(b.end-b.start)/1440*100+'%)',height:b.point?28:37}))}{day===today&&<i className="planner-now" style={{left:nowMinute/1440*100+'%'}}/>}</div></div>})}
 </div></div>
 }
 return <div className="planner-viewport"><div className="planner-week"><div className="planner-week-head">{zone}</div>{days.map(d=><div key={d} className={'planner-week-head'+(d===today?' today':'')}>{formatDay(d)}</div>)}<div className="planner-all-day">{locale==='uk'?'Увесь день':'All day'}</div>{days.map(d=><div className="planner-all-day" key={d}>{events.filter(e=>e.type==='holiday'&&eventDayKey(e,zone)===d).map(e=><button key={keyOf(e)} onClick={()=>onSelect(e)}>{e.title}</button>)}</div>)}<div className="planner-hour-labels" style={{height:1152}}>{hours.map(h=><span key={h} style={{top:h*48}}>{timeLabel(h*60)}</span>)}</div>{days.map(d=>{const {blocks,lanes}=dayBlocks(events,d,zone);return <div key={d} className="planner-day-lane" style={{height:1152}}>{blocks.map(b=>block(b,{top:clamp(b.start*.8,0,1130),height:b.point?23:Math.max(23,Math.min((b.end-b.start)*.8,1152-b.start*.8)),left:b.lane/lanes*100+'%',width:'calc('+100/lanes+'% - 2px)'}))}{d===today&&<i className="planner-now" style={{top:nowMinute*.8}}/>}</div>})}</div></div>
}
