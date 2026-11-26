import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../../i18n/LocaleProvider';
import { useAuth } from '../../features/auth/AuthContext';
import { dayKey, parseDay, makeDay, todayKey, shiftMonth, monthDays, allowedDay, monthAvailable } from './datePickerModel.js';

export function DateField({ value = '', onChange, onValueChange, min, max, required, disabled, readOnly, className = '', onClick, onKeyDown, ...props }) {
  const { locale } = useLocale();
  const { user } = useAuth();
  const uk = locale === 'uk';
  const sunday = user?.settings?.weekStartsOn === 'sunday';
  const today = todayKey(user?.settings?.timeZone);
  const id = useId();
  const input = useRef(null);
  const panel = useRef(null);
  const [host, setHost] = useState(null);
  const [month, setMonth] = useState(() => parseDay(value) || parseDay(today));
  const [position, setPosition] = useState({ top: 0, left: 0, visibility: 'hidden' });
  const label = uk ? 'Вибрати дату' : 'Choose date';
  const monthFormat = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const fullFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' });
  const weekFormat = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  function close(restore = false) {
    setHost(null);
    if (restore) input.current?.focus();
  }
  function open() {
    if (disabled || readOnly || input.current?.matches(':disabled')) return;
    if (host) { close(); return; }
    let initial = allowedDay(value, min, max) ? value : today;
    if (parseDay(min) && initial < min) initial = min;
    if (parseDay(max) && initial > max) initial = max;
    setMonth(parseDay(initial) || parseDay(today));
    setHost(input.current.closest('dialog[open]') || document.body);
  }
  useLayoutEffect(() => {
    if (!host || !panel.current) return;
    const popup = panel.current;
    if (typeof popup.showPopover === 'function') popup.showPopover();
    function place() {
      const anchor = input.current?.getBoundingClientRect();
      if (!anchor || !anchor.width || !anchor.height) { setHost(null); return; }
      const width = popup.offsetWidth, height = popup.offsetHeight;
      const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
      const top = anchor.bottom + 6 + height <= window.innerHeight - 8 ? anchor.bottom + 6 : Math.max(8, anchor.top - height - 6);
      setPosition({ left, top, visibility: 'visible' });
      popup.style.visibility = 'visible';
    }
    place();
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    const first = popup.querySelector('[aria-pressed="true"]:not(:disabled)') || popup.querySelector('.chronos-date-day:not(:disabled)');
    first?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
      if (typeof popup.hidePopover === 'function' && popup.matches(':popover-open')) popup.hidePopover();
    };
  }, [host]);
  useEffect(() => {
    if (!host) return;
    function outside(event) {
      if (!panel.current?.contains(event.target) && event.target !== input.current) close();
    }
    function escape(event) {
      if (event.key !== 'Escape') return; 
      event.preventDefault(); event.stopImmediatePropagation(); close(true);
    }
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true); };
  }, [host]);
  useEffect(() => { if (disabled || readOnly) setHost(null); }, [disabled, readOnly]);
  function choose(key) {
    if (key && !allowedDay(key, min, max)) return;
    if (onValueChange) onValueChange(key);
    else onChange?.({ target: { value: key, name: props.name }, currentTarget: { value: key, name: props.name } });
    close(true);
  }
  function keyboard(event) {
    onKeyDown?.(event);
    if (!event.defaultPrevented && (event.key === 'F4' || (event.altKey && event.key === 'ArrowDown') || event.key === ' ')) {
      event.preventDefault(); open();
    }
  }
  function navigateDays(event) {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!delta) return;
    const buttons = [...panel.current.querySelectorAll('.chronos-date-day')];
    const index = buttons.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next = buttons[index + delta];
    if (next && !next.disabled) next.focus();
  }
  const previous = shiftMonth(month, -1), next = shiftMonth(month, 1);
  const year = month.getUTCFullYear(), monthIndex = month.getUTCMonth();
  const yearStart = Math.min(year, parseDay(min)?.getUTCFullYear() ?? 1900);
  const yearEnd = Math.max(year, parseDay(max)?.getUTCFullYear() ?? 2100);
  const start = Math.max(1, parseDay(min)?.getUTCFullYear() ?? Math.min(yearStart, year - 100));
  const end = Math.min(9999, parseDay(max)?.getUTCFullYear() ?? Math.max(yearEnd, year + 100));
  function jumpYear(nextYear) {
    const candidate = makeDay(nextYear, monthIndex);
    if (monthAvailable(candidate, min, max)) setMonth(candidate);
    else {
      const limit = parseDay(min)?.getUTCFullYear() === nextYear ? parseDay(min) : parseDay(max);
      if (limit) setMonth(limit);
    }
  }
  return <>
    <input {...props} ref={input} type="date" value={value} onChange={event => { if (onValueChange) onValueChange(event.currentTarget.value); else onChange?.(event); }} min={min} max={max} required={required} disabled={disabled} readOnly={readOnly} className={`chronos-date-field ${className}`} aria-haspopup="dialog" aria-expanded={!!host} aria-controls={host ? id : undefined} onKeyDown={keyboard} onClick={event => { onClick?.(event); if (!event.defaultPrevented) { event.preventDefault(); open(); } }}/>
    {host && createPortal(<div ref={panel} id={id} className="chronos-date-popup" popover="manual" role="dialog" aria-label={label} style={position} onClick={event => event.stopPropagation()} onKeyDown={event => { event.stopPropagation(); navigateDays(event); }}>
      <div className="chronos-date-heading">
        <button type="button" aria-label={uk ? 'Попередній місяць' : 'Previous month'} disabled={!monthAvailable(previous, min, max)} onClick={() => setMonth(previous)}>‹</button>
        <div className="chronos-date-month">
          <select aria-label={uk ? 'Місяць' : 'Month'} value={monthIndex} onChange={event => setMonth(makeDay(year, Number(event.target.value)))}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index} disabled={!monthAvailable(makeDay(year, index), min, max)}>{new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(makeDay(year, index))}</option>)}</select>
          <select aria-label={uk ? 'Рік' : 'Year'} value={year} onChange={event => jumpYear(Number(event.target.value))}>{Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index).map(item => <option key={item} value={item}>{item}</option>)}</select>
        </div>
        <button type="button" aria-label={uk ? 'Наступний місяць' : 'Next month'} disabled={!monthAvailable(next, min, max)} onClick={() => setMonth(next)}>›</button>
      </div>
      <div className="chronos-date-grid" aria-label={monthFormat.format(month)}>
        {Array.from({ length: 7 }, (_, index) => <span key={index} className="chronos-date-weekday">{weekFormat.format(makeDay(2024, 0, index + (sunday ? 0 : 1)))}</span>)}
        {monthDays(month, sunday).map(date => {
          const key = dayKey(date);
          return <button type="button" key={key} className={'chronos-date-day' + (date.getUTCMonth() !== monthIndex ? ' outside' : '') + (key === today ? ' today' : '')} aria-label={fullFormat.format(date)} aria-pressed={key === value} aria-current={key === today ? 'date' : undefined} disabled={!allowedDay(key, min, max)} onClick={() => choose(key)}>{date.getUTCDate()}</button>;
        })}
      </div>
      <div className="chronos-date-footer"><button type="button" disabled={!allowedDay(today, min, max)} onClick={() => choose(today)}>{uk ? 'Сьогодні' : 'Today'}</button>{!required && <button type="button" onClick={() => choose('')}>{uk ? 'Очистити' : 'Clear'}</button>}<button type="button" onClick={() => close(true)}>{uk ? 'Закрити' : 'Close'}</button></div>
    </div>, host)}
  </>;
}
