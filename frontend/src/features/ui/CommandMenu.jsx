import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../../i18n/LocaleProvider';
import { applicationContainer } from '../../app/applicationContainer';
import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import { loadDashboard } from '../dashboard/dashboardData';
import { eventDayKey, eventDateLabel, fromCalendarInput } from '../events/eventForm';
import { matchesEvent } from '../events/calendarInteractions';
import { shiftDate } from '../tasks/taskBoardModel';
import { EventDialog } from '../events/EventDialog';

export function CommandMenu({user,items,onClose}) {
  const {locale,localizedPath,t}=useLocale(),uk=locale==='uk';
  const navigate=useNavigate(),zone=user.settings?.timeZone||'UTC';
  const today=eventDayKey({startsAt:new Date()},zone);
  const [query,setQuery]=useState('');
  const [from,setFrom]=useState(()=>shiftDate(today,-180)),[to,setTo]=useState(()=>shiftDate(today,180));
  const [data,setData]=useState({events:[],calendars:[],failed:0});
  const [loading,setLoading]=useState(true),[error,setError]=useState(false);
  const [active,setActive]=useState(0);
  const [searchEvents,setSearchEvents]=useState(false);
  const list=useRef(null);
  useEffect(()=>{
    let alive=true;
    if(!searchEvents){applicationContainer.calendarService.list().then(result=>{if(alive)setData(old=>({...old,calendars:result.calendars||[]}));}).catch(()=>{if(alive)setError(true);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};}
    setLoading(true);setError(false);
    const timer=setTimeout(async()=>{
      try{
        const begin=Date.parse(from+'T00:00:00Z'),end=Date.parse(to+'T00:00:00Z');
        if(!Number.isFinite(begin)||!Number.isFinite(end)||end<begin)throw Error('Invalid range');
        // Search in API-compatible yearly windows, not just the selected calendar.
        if((end-begin)/86400000>3650)throw Error('Range too large');
        const events=[],calendars=new Map();let failed=0;
        for(let start=from;start<=to;){
          const last=shiftDate(start,364),finish=last<to?last:to;
          const result=await loadDashboard(applicationContainer.calendarService,{from:fromCalendarInput(start+'T00:00',zone),to:new Date(Date.parse(fromCalendarInput(shiftDate(finish,1)+'T00:00',zone))-1).toISOString()});
          if(!alive)return;
          result.calendars.forEach(c=>calendars.set(c.id,c));events.push(...result.events);failed+=result.failed;start=shiftDate(finish,1);
        }
        const distinct=new Map(events.map(e=>[e.calendarId+':'+(e.occurrenceId||e.id),e]));
        if(alive)setData({events:[...distinct.values()],calendars:[...calendars.values()],failed});
      }catch{if(alive){setError(true);setData(old=>({...old,events:[]}));}}
      finally{if(alive)setLoading(false);}
    },250);
    return()=>{alive=false;clearTimeout(timer);};
  },[searchEvents,from,to,zone]);
  const writable=data.calendars.filter(c=>!c.isArchived&&!c.isHolidayCalendar&&['owner','admin','editor'].includes(c.role));
  const main=writable.find(c=>c.isMain)||writable[0];
  const options=useMemo(()=>{
    const match=s=>s.toLowerCase().includes(query.trim().toLowerCase());
    const rows=items.filter(([, ,label])=>match(label)).map(([path,icon,label])=>({key:path,icon,label,detail:uk?'Сторінка':'Page',path}));
    if(main){
      for(const [type,label] of [['arrangement',uk?'Нова подія':'New event'],['task',uk?'Нове завдання':'New task']])if(match(label))rows.push({key:type,icon:'plus',label,detail:main.name,path:'/calendars/view/'+encodeURIComponent(main.id)+'/new?type='+type});
    }
    for(const c of data.calendars.filter(c=>match(c.name)))rows.push({key:'cal:'+c.id,icon:'calendar',label:c.name,detail:uk?'Календар':'Calendar',path:'/calendars/view/'+encodeURIComponent(c.id)});
    if(searchEvents&&query.trim()&&!loading&&!error)for(const e of data.events.filter(e=>matchesEvent(e,query)).slice(0,80)){
      const calendar=data.calendars.find(c=>c.id===e.calendarId),eventZone=calendar?.timeZone||zone;
      const day=eventDayKey(e,eventZone);
      if(day)rows.push({key:e.calendarId+':'+(e.occurrenceId||e.id),icon:e.type==='task'?'checkbox':e.type==='reminder'?'bell':'calendar-event',label:e.title,detail:e.calendarName+' · '+eventDateLabel(e,locale,eventZone),path:'/calendars/view/'+encodeURIComponent(e.calendarId)+'?date='+encodeURIComponent(day)+'&event='+encodeURIComponent(e.occurrenceId||e.id)});
    }
    return rows;
  },[query,items,data,main,searchEvents,loading,error,locale,zone]);
  function choose(row){if(!row)return;onClose();const [path,params]=row.path.split('?');navigate(localizedPath(path)+(params?'?'+params:''));}
  useEffect(()=>{setActive(0);},[query,searchEvents,from,to]);
  useEffect(()=>{list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'});},[active]);
  return <EventDialog label={uk?'Швидкі команди':'Quick commands'} onClose={onClose} busy={false}>
    <div className="ux-command" onKeyDown={e=>{if(e.target.tagName==='INPUT'&&e.target.type==='date')return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setActive(old=>Math.max(0,Math.min(options.length-1,old+(e.key==='ArrowDown'?1:-1))));}else if(e.key==='Enter'&&e.target.tagName==='INPUT'&&e.target.type==='search'){e.preventDefault();choose(options[active]);}}}>
      <div className="ux-command-input"><Icon name="search" size={20}/><input type="search" autoFocus placeholder={uk?'Пошук або команда…':'Search or type a command…'} aria-label={uk?'Пошук':'Search'} value={query} onChange={e=>setQuery(e.target.value)}/><button type="button" onClick={onClose} aria-label={uk?'Закрити':'Close'}>Esc</button></div>
      <div className="ux-command-range"><label><input type="checkbox" checked={searchEvents} onChange={e=>setSearchEvents(e.target.checked)}/>{uk?'Шукати події у всіх активних календарях':'Search events across active calendars'}</label>{searchEvents&&<div><label>{uk?'Від':'From'} <input type="date" value={from} max={to} onChange={e=>{if(e.target.value&&e.target.value<=to)setFrom(e.target.value);}}/></label><label>{uk?'До':'To'} <input type="date" value={to} min={from} onChange={e=>{if(e.target.value&&e.target.value>=from)setTo(e.target.value);}}/></label></div>}</div>
      {error&&<p role="alert">{uk?'Не вдалося завантажити дані. Перевірте діапазон (до 10 років).':'Could not load data. Check the date range (up to 10 years).'}</p>}
      {data.failed>0&&searchEvents&&<p role="status">{uk?'Результати неповні':'Some calendars could not be searched'}</p>}
      {loading&&<p role="status">{t('common.loading')}</p>}
      <div className="ux-command-results" ref={list} role="listbox" aria-label={uk?'Результати':'Results'}>{options.map((row,i)=><button type="button" role="option" aria-selected={i===active} key={row.key} onPointerMove={()=>setActive(i)} onClick={()=>choose(row)}><Icon name={row.icon} size={18}/><span><strong>{row.label}</strong><small>{row.detail}</small></span><Icon name="chevron-right" size={14}/></button>)}{!options.length&&!loading&&<p>{uk?'Нічого не знайдено':'No results'}</p>}</div>
      <footer>↑ ↓ · Enter · Esc</footer>
    </div>
  </EventDialog>;
}
