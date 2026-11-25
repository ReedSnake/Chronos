import { eventDayKey, fromCalendarInput } from '../events/eventForm.js';

const keyOf = date => date.toISOString().slice(0, 10);
export function weekWindow(now, timeZone, startsOn = 'monday', weekOffset = 0) {
  const key = eventDayKey({ startsAt: now.toISOString() }, timeZone);
  const start = new Date(key + 'T00:00:00Z');
  const offset = (start.getUTCDay() + (startsOn === 'sunday' ? 0 : 6)) % 7;
  start.setUTCDate(start.getUTCDate() - offset + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start); date.setUTCDate(date.getUTCDate() + index); return keyOf(date);
  });
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7);
  return { days, today: key, from: fromCalendarInput(days[0] + 'T00:00', timeZone), to: new Date(new Date(fromCalendarInput(keyOf(end) + 'T00:00', timeZone)).getTime()-1).toISOString() };
}

export async function loadDashboard(service, range) {
  const { calendars = [] } = await service.list();
  const active = calendars.filter(calendar => !calendar.isArchived);
  async function read(calendar) {
    const events = [];
    for (let page = 1; page <= 100; page++) {
      const result = await service.listEvents(calendar.id, { from: range.from, to: range.to, types: range.types || [], page, limit: 100 });
      events.push(...(result.events || []).map(event => ({ ...event, calendarId: calendar.id, calendarName: calendar.name })));
      if (page >= (result.pagination?.totalPages || 1)) return events;
    }
    throw new Error('EVENT_RANGE_TOO_LARGE');
  }
  const events = [];
  let failed = 0;
  for (let i = 0; i < active.length; i += 4) {
    const batch = await Promise.allSettled(active.slice(i, i + 4).map(read));
    for (const result of batch) if (result.status === 'fulfilled') events.push(...result.value); else failed++;
  }
  return { calendars: active, events, failed };
}

export function summarizeDashboard(events, range, timeZone) {
  const days=range.days.map(key=>{
    const following=new Date(key+'T12:00:00Z');following.setUTCDate(following.getUTCDate()+1);
    return {key,events:[],minutes:0,start:Date.parse(fromCalendarInput(key+'T00:00',timeZone)),end:Date.parse(fromCalendarInput(keyOf(following)+'T00:00',timeZone))};
  });
  const byKey=new Map(days.map(day=>[day.key,day]));
  const visible=[];
  const seen=new Set();
  for(const event of events){
    if(event.status==='canceled')continue;
    const identity=event.id?String(event.calendarId)+':'+(event.occurrenceId||event.id):event;
    if(seen.has(identity))continue;
    seen.add(identity);
    let included=false;
    if(event.type==='arrangement'){
      const start=Date.parse(event.startsAt),end=Date.parse(event.endsAt);
      if(Number.isFinite(start)&&Number.isFinite(end)&&end>start){
        for(const day of days){
          const overlap=Math.min(end,day.end)-Math.max(start,day.start);
          if(overlap>0){day.events.push(event);day.minutes+=overlap/60000;included=true;}
        }
      }
    }else{
      const day=byKey.get(eventDayKey(event,timeZone));
      if(day){day.events.push(event);included=true;}
    }
    if(included)visible.push(event);
  }
  const tasks=visible.filter(e=>e.type==='task').sort((a,b)=>Number(a.status==='done')-Number(b.status==='done')||Date.parse(a.deadline)-Date.parse(b.deadline));
  const done=tasks.filter(e=>e.status==='done').length;
  const meetings=visible.filter(e=>e.type==='arrangement'),reminders=visible.filter(e=>e.type==='reminder');
  const cleanDays=days.map(({key,events,minutes})=>({key,events,minutes}));
  return {days:cleanDays,tasks,done,meetings,reminders,minutes:cleanDays.reduce((sum,day)=>sum+day.minutes,0),today:byKey.get(range.today)?.events||[]};
}
