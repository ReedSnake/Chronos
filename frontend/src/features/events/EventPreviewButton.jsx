import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../../i18n/LocaleProvider';
import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import { eventDateLabel, toCalendarInput } from './eventForm';
import './event-preview.css';

// Preserve the original button and its grid positioning. A portal avoids clipping
// in fitted calendar grids, Kanban columns and independently scrolling panels.
export function EventPreviewButton({ event, zone = 'UTC', children, title, onClick, ...props }) {
  const { locale, t } = useLocale();
  const uk = locale === 'uk';
  const id = useId();
  const anchor = useRef(null);
  const card = useRef(null);
  const timer = useRef(null);
  const hovered = useRef(false);
  const focused = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);

  function clearTimer() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }
  function hide() {
    clearTimer();
    setOpen(false);
    setPosition(null);
  }
  function show() {
    clearTimer();
    timer.current = setTimeout(() => { timer.current = null; setOpen(true); }, 280);
  }
  function leave() {
    if (!focused.current) hide();
  }

  useEffect(() => () => clearTimer(), []);
  useLayoutEffect(() => {
    if (!open || !anchor.current || !card.current) return;
    const rect = anchor.current.getBoundingClientRect();
    const box = card.current.getBoundingClientRect();
    const margin = 10, gap = 8;
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const left = Math.max(margin, Math.min(rect.left, width - box.width - margin));
    const top = Math.max(margin, Math.min(rect.bottom + gap + box.height <= height - margin ? rect.bottom + gap : rect.top - box.height - gap, height - box.height - margin));
    setPosition({ left, top });
  }, [open, event, locale, zone]);

  useEffect(() => {
    if (!open) return;
    const dismiss = () => hide();
    const key = e => { if (e.key === 'Escape') hide(); };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  const task = event.type === 'task';
  const date = eventDateLabel(event, locale, zone);
  const end = event.type === 'arrangement' && event.endsAt ? toCalendarInput(event.endsAt, zone) : '';
  const start = event.type === 'arrangement' ? toCalendarInput(event.startsAt, zone) : '';
  const finish = end && start && end.slice(0,10) === start.slice(0,10) ? end.slice(11) : '';
  const type = t('calendarView.type.' + event.type);
  const status = event.status ? t('statuses.' + event.status) : '';
  const icon = task ? event.status === 'done' ? 'check' : 'checkbox' : event.type === 'reminder' ? 'bell' : 'calendar-event';
  return <>
    <button type="button" {...props} ref={anchor}
      aria-describedby={open ? [props['aria-describedby'], id].filter(Boolean).join(' ') : props['aria-describedby']}
      onPointerEnter={e=>{if(e.pointerType==='mouse'){hovered.current=true;show();}}}
      onPointerLeave={()=>{hovered.current=false;leave();}}
      onPointerDown={()=>{focused.current=false;hide();}}
      onFocus={e=>{if(e.currentTarget.matches(':focus-visible')){focused.current=true;show();}}}
      onBlur={()=>{focused.current=false;if(!hovered.current)hide();}}
      onClick={e=>{hide();onClick?.(e);}}>{children}</button>
    {open && createPortal(<div ref={card} id={id} role="tooltip" className="event-preview" style={position || {left:0,top:0,visibility:'hidden'}}>
      <div className="event-preview-heading"><span className={'event-preview-symbol '+event.type}><Icon name={icon} size={17}/></span><div><strong>{event.title}</strong><small>{type}{event.calendarName ? ' · '+event.calendarName : ''}</small></div></div>
      {date&&<div className="event-preview-meta"><Icon name="clock" size={15}/><span>{task?(uk?'Термін: ':'Due: '):''}{date}{finish?' – '+finish:''}</span></div>}
      {status&&<div className="event-preview-meta"><Icon name="checkbox" size={15}/><span>{status}</span></div>}
      {event.description&&<p>{event.description}</p>}
    </div>,document.body)}
  </>;
}
