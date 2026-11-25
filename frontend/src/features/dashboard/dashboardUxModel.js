import { fromCalendarInput } from '../events/eventForm.js';
export function unbookedMinutes(events,day,zone,startHour=9,endHour=18){
  const label=h=>String(h).padStart(2,'0')+':00';
  const start=Date.parse(fromCalendarInput(day+'T'+label(startHour),zone));
  const end=Date.parse(fromCalendarInput(day+'T'+label(endHour),zone));
  const intervals=events.filter(e=>e.type==='arrangement'&&e.status!=='canceled').map(e=>[Math.max(start,Date.parse(e.startsAt)),Math.min(end,Date.parse(e.endsAt))]).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>a).sort((a,b)=>a[0]-b[0]);
  let cursor=start,booked=0;
  for(const [a,b] of intervals){booked+=Math.max(0,b-Math.max(cursor,a));cursor=Math.max(cursor,b);}
  return Math.max(0,Math.round((end-start-booked)/60000));
}
export function moveWidget(order,key,offset){
  const copy=[...order],index=copy.indexOf(key),target=index+offset;
  if(index<0||target<0||target>=copy.length)return copy;
  [copy[index],copy[target]]=[copy[target],copy[index]];
  return copy;
}
