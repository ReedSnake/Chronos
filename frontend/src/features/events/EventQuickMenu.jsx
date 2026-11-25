import { DateField } from '../../components/forms/DateField';
import { ClockField } from './ClockField';
import { useState } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import { toCalendarInput } from './eventForm';
import { canMoveEvent,eventTimeField } from './eventQuickModel';
import { EventDialog } from './EventDialog';

export function EventQuickMenu({event,zone,timeFormat,busy,onClose,onOpen,onPatch,onCopy,onDuplicate,onDelete}) {
  const {locale,t}=useLocale(),uk=locale==='uk';
  const [title,setTitle]=useState(event.title);
  const [time,setTime]=useState(canMoveEvent(event)?toCalendarInput(event[eventTimeField(event)],zone):'');
  const [duration,setDuration]=useState(event.type==='arrangement'?Math.round((Date.parse(event.endsAt)-Date.parse(event.startsAt))/60000):60);
  const [quick,setQuick]=useState(false);
  const [status,setStatus]=useState(event.status||'todo');
  return <EventDialog label={event.title} onClose={onClose} busy={busy}>
    <div className="ux-quick-menu">
      <header><strong>{event.title}</strong><button type="button" aria-label={uk?'Закрити':'Close'} onClick={onClose} disabled={busy}><Icon name="x" size={17}/></button></header>
      {quick?<form onSubmit={e=>{e.preventDefault();onPatch({title:title.trim(),time,duration:Number(duration),status});}}>
        <label>{uk?'Назва':'Title'}<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={200}/></label>
        {event.type==='task'&&<label>{t('calendarView.event.status')}<select value={status} onChange={e=>setStatus(e.target.value)}>{['todo','in_progress','done'].map(s=><option key={s} value={s}>{t('statuses.'+s)}</option>)}</select></label>}
        {canMoveEvent(event)&&<label>{uk?'Дата й час':'Date and time'}<DateField aria-label={uk?'Дата':'Date'} value={time.slice(0,10)} onChange={e=>setTime(e.target.value+'T'+time.slice(11,16))} required/><ClockField value={time.slice(11,16)} timeFormat={timeFormat} label={uk?'Час':'Time'} disabled={busy} onChange={value=>setTime(time.slice(0,10)+'T'+value)}/></label>}
        {canMoveEvent(event)&&event.type==='arrangement'&&<label>{uk?'Тривалість (хв)':'Duration (min)'}<input type="number" min="15" max="10080" value={duration} onChange={e=>setDuration(e.target.value)} required/></label>}
        <button className="ux-primary" type="submit" disabled={busy||!title.trim()}>{uk?'Зберегти':'Save'}</button>
      </form>:<div className="ux-menu-actions">
        <button type="button" onClick={()=>setQuick(true)} disabled={busy||event.isRecurring}>{uk?'Швидке редагування':'Quick edit'}</button>
        <button type="button" onClick={onOpen} disabled={busy}>{uk?'Відкрити деталі':'Open details'}</button>
        <button type="button" onClick={onCopy} disabled={busy}>{uk?'Копіювати':'Copy event'}</button>
        <button type="button" onClick={onDuplicate} disabled={busy}>{uk?'Дублювати':'Duplicate event'}</button>
        <button type="button" className="ux-danger" onClick={onDelete} disabled={busy}>{t('calendarView.event.delete')}</button>
      </div>}
    </div>
  </EventDialog>;
}
