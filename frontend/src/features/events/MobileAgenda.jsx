import { useMemo } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import { CalendarEventButton, EventSymbol, EventStatus } from './CalendarEventActions';
import { dayBlocks } from './PlannerGrid';
import { eventDayKey } from './eventForm';
import { SkeletonRows, EmptyState } from '../ui/Feedback';

export function MobileAgenda({events,days,day,zone,loading,error,partial,canEdit,onSelect,onCreate,onDaySelect,timeFormat}){
  const {locale,t}=useLocale(),uk=locale==='uk';
  const blocks=useMemo(()=>dayBlocks(events,day,zone).blocks,[events,day,zone]);
  const holidays=events.filter(e=>e.type==='holiday'&&eventDayKey(e,zone)===day);
  const formatDate=(key,options)=>new Date(key+'T12:00:00Z').toLocaleDateString(locale,{...options,timeZone:'UTC'});
  const formatMinute=minute=>{
    if(minute===1440)return timeFormat==='12h'?'12:00 AM':'24:00';
    const stamp=new Date(Date.UTC(2000,0,1,Math.floor(minute/60),minute%60));
    return stamp.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',hour12:timeFormat==='12h',timeZone:'UTC'});
  };
  const keyOf=e=>e.calendarId+':'+(e.occurrenceId||e.id);
  return <section className="ux-mobile-agenda" aria-busy={loading}>
    {days.length>1&&<div className="ux-mobile-days" role="group" aria-label={uk?'Дні тижня':'Week days'}>{days.map(key=><button type="button" key={key} aria-pressed={day===key} aria-label={formatDate(key,{dateStyle:'full'})} onClick={()=>onDaySelect(key)}><small>{formatDate(key,{weekday:'short'})}</small><strong>{Number(key.slice(-2))}</strong></button>)}</div>}
    <header><div><h3>{formatDate(day,{weekday:'long',day:'numeric',month:'long'})}</h3><p>{loading||error||partial?'—':blocks.length+holidays.length} {uk?'подій':'events'}</p></div>{canEdit&&<button className="ux-primary" type="button" onClick={()=>onCreate(day)}><Icon name="plus" size={17}/>{uk?'Додати':'Add'}</button>}</header>
    {loading?<SkeletonRows count={4} label={t('common.loading')}/>:error?<p role="alert">{error}</p>:!blocks.length&&!holidays.length?<EmptyState title={uk?'На цей день немає подій':'Nothing planned for this day'} description={partial?(uk?'Не всі календарі завантажено':'Some calendars could not be loaded'):undefined} action={canEdit?(uk?'Створити подію':'Create event'):null} onAction={()=>onCreate(day)}/>:<div className="ux-mobile-events">
      {holidays.map(e=><CalendarEventButton key={keyOf(e)} event={e} className="ux-mobile-event" onClick={()=>onSelect(e)}><span className="ux-mobile-time">{uk?'День':'All day'}</span><EventSymbol event={e}/><span className="ux-mobile-event-name"><strong>{e.title}</strong><small>{e.calendarName}</small></span><EventStatus event={e}/></CalendarEventButton>)}
      {blocks.map(({event:e,start,end,point})=><CalendarEventButton key={keyOf(e)} event={e} className="ux-mobile-event" onClick={()=>onSelect(e)}><span className="ux-mobile-time">{formatMinute(start)}{!point&&<small>{formatMinute(end)}</small>}</span><EventSymbol event={e}/><span className="ux-mobile-event-name"><strong>{e.title}</strong><small>{e.calendarName} · {t('calendarView.type.'+e.type)}</small></span><EventStatus event={e}/></CalendarEventButton>)}
    </div>}
  </section>;
}
