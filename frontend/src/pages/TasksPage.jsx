import { SkeletonRows, EmptyState } from '../features/ui/Feedback';
import { useLocalPreference } from '../features/ui/useLocalPreference';
import { Notice,useNotice } from '../features/ui/useNotice';
import { fromCalendarInput } from '../features/events/eventForm';
import { moveEventPatch } from '../features/events/eventQuickModel';
import { EventPreviewButton } from '../features/events/EventPreviewButton';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { applicationContainer } from '../app/applicationContainer';
import { loadDashboard } from '../features/dashboard/dashboardData';
import { EventDialog } from '../features/events/EventDialog';
import { EventEditor } from '../features/events/EventEditor';
import { EventDetails } from '../features/events/EventDetails';
import { CalendarEventActionsProvider, TaskCompletion } from '../features/events/CalendarEventActions';
import { eventDayKey } from '../features/events/eventForm';
import { getLocalizedApiError } from '../i18n/apiErrors';
import { TablerIcon as Icon } from '../components/layout/TablerIcon';
import { TASK_STATES, taskKey, shiftDate, apiRange, filterTasks, taskTime, canWriteTask } from '../features/tasks/taskBoardModel';
import '../features/tasks/task-board.css';

const service = applicationContainer.calendarService;
const emptyData = { calendars: [], events: [], failed: 0 };
const safeColor = color => /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#F5BC5A';

function TaskCard({ task, calendar, zone, onOpen, onChange, busy, onDragStart, onDragEnd, bulk, picked, onPick }) {
  const { t, locale } = useLocale(), uk = locale === 'uk';
  const writable = canWriteTask(calendar);
  const participants = task.attendees || [];
  const category = task.categories?.[0];
  const date = eventDayKey(task, zone);
  const dateLabel = date ? new Date(date + 'T12:00:00Z').toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  const done = task.status === 'done';
  return <article className={'tb-card ' + task.status} style={{ '--task-color': done ? '#65a982' : safeColor(task.color || calendar?.color) }} draggable={writable && !busy} onDragStart={onDragStart} onDragEnd={onDragEnd}>
    <div className="tb-card-main">{bulk&&writable&&!task.isRecurring&&<input className="ux-task-select" type="checkbox" aria-label={(uk?"Вибрати ":"Select ")+task.title} checked={picked} onChange={onPick} disabled={busy}/> }
      <EventPreviewButton event={{...task,calendarName:task.calendarName||calendar?.name}} zone={zone} className="tb-card-open" onClick={() => onOpen(task)}>
        <span className="tb-card-icon"><Icon name={done ? 'check' : task.status === 'in_progress' ? 'clock' : 'checkbox'} size={19}/></span>
        <span className="tb-card-copy"><strong>{task.title}</strong>{task.description && <span className="tb-description">{task.description}</span>}{(category || task.calendarName || calendar?.name) && <small>{category || task.calendarName || calendar?.name}</small>}</span>
      </EventPreviewButton>
      <TaskCompletion event={task}/>
    </div>
    <div className="tb-card-bottom">
      <div className="tb-avatars" aria-label={uk ? 'Учасники' : 'Participants'}>{participants.slice(0, 4).map(a => <span key={a.email} title={a.email}>{a.email.slice(0, 2).toUpperCase()}</span>)}{participants.length > 4 && <span>+{participants.length - 4}</span>}</div>
      <span className={"tb-card-time"+(task.status!=="done"&&Date.parse(task.deadline)<Date.now()?" ux-overdue":"")} title={dateLabel + ' · ' + taskTime(task, zone)}>{task.isRecurring && <Icon name="refresh" size={13}/>}<Icon name="calendar" size={13}/>{dateLabel}</span>
      {writable && <label className="tb-status-control" title={t('calendarView.event.status')}><Icon name="chevron-down" size={14}/><select aria-label={t('calendarView.event.status') + ': ' + task.title} disabled={busy} value={task.status} onChange={e => onChange(task, e.target.value)}>{TASK_STATES.map(s => <option key={s} value={s}>{t('statuses.' + s)}</option>)}</select></label>}
    </div>
  </article>;
}

export function TasksPage() {
  const { status, user } = useAuth();
  const { locale, t, localizedPath } = useLocale();
  const uk = locale === 'uk', zone = user?.settings?.timeZone || 'UTC';
  const today = eventDayKey({ startsAt: new Date().toISOString() }, zone);
  const [boardRange, setBoardRange] = useState(() => ({ from: shiftDate(today, -30), to: shiftDate(today, 60) }));
  const [data, setData] = useState(emptyData), [loading, setLoading] = useState(true), [error, setError] = useState(''), [reload, setReload] = useState(0);
  const [search,setSearch]=useState('');
  const [hidden,setHidden]=useLocalPreference(user?.id?'task-calendars:'+user.id:null,[]);
  const [category,setCategory]=useLocalPreference(user?.id?'task-category:'+user.id:null,'');
  const [statusFilter,setStatusFilter]=useLocalPreference(user?.id?'task-status:'+user.id:null,'');
  const [sort,setSort]=useLocalPreference(user?.id?'task-sort:'+user.id:null,'due');
  const [overdue,setOverdue]=useState(false),[hideDone,setHideDone]=useLocalPreference(user?.id?'task-hide-done:'+user.id:null,false);
  const [bulk,setBulk]=useState(false),[picked,setPicked]=useState([]),[bulkStatus,setBulkStatus]=useState('done'),[bulkDate,setBulkDate]=useState('');
  const [quickTitle,setQuickTitle]=useState('');
  const [notice,notify,dismissNotice]=useNotice();
  const [mode, setMode] = useState(null), [selected, setSelected] = useState(null), [edit, setEdit] = useState(null), [calId, setCalId] = useState(''), [createStatus, setCreateStatus] = useState('todo');
  const [busy, setBusy] = useState(false), [drag, setDrag] = useState(null);
  const lock = useRef(false);
  const { from, to } = boardRange;
  useEffect(() => {
    if (status !== 'authenticated') return;
    let alive = true;
    setLoading(true); setError(''); setData(old => ({ ...old, events: [], failed: 0 }));
    Promise.resolve().then(() => loadDashboard(service, apiRange({ from, to }, zone))).then(result => {
      if (alive) setData(result);
    }).catch(err => {
      if (alive) { setData(emptyData); setError(getLocalizedApiError(err, t, 'calendarView.eventsError')); }
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [status, zone, from, to, reload, t]);
  const tasks = useMemo(() => {
    const items=filterTasks(data.events,{hidden,category,status:statusFilter,search}).filter(e=>(!overdue||(e.status!=='done'&&Date.parse(e.deadline)<Date.now()))&&(!hideDone||e.status!=='done'));
    return sort==='latest'?items.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))||String(a.title).localeCompare(String(b.title))):sort==='title'?items.sort((a,b)=>a.title.localeCompare(b.title,locale)):items;
  },[data.events,hidden,category,statusFilter,search,overdue,hideDone,sort,locale]);
  const categories = [...new Set(data.events.flatMap(e => e.categories || []))].sort();
  const editable = data.calendars.filter(canWriteTask);
  const calendar = data.calendars.find(c => c.id === (mode === 'create' ? calId : selected?.calendarId));
  const canChange = e => canWriteTask(data.calendars.find(c => c.id === e.calendarId));
  const done = tasks.filter(e => e.status === 'done').length;
  const unknown = loading || !!data.failed || !!error;
  const format = (d, options) => new Date(d + 'T12:00:00Z').toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
  const displayCount = n => unknown ? '—' : n;
  function close() { if (!lock.current) { setMode(null); setSelected(null); setEdit(null); } }
  function create(state = 'todo') {
    if (busy || loading) return;
    const visible = editable.filter(c => !hidden.includes(c.id));
    const c = visible.find(c => c.isMain) || visible[0] || editable.find(c => c.isMain) || editable[0];
    if (!c) return;
    setError(''); setCalId(c.id); setCreateStatus(state); setSelected(null); setEdit(null); setMode('create');
  }
  function open(e) { if (!lock.current) { setError(''); setSelected(e); setEdit(null); setMode('details'); } }
  async function mutate(action) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { return await action(); } finally { lock.current = false; setBusy(false); }
  }
  async function change(e, state) {
    if (!e || loading || lock.current || e.status === state || !TASK_STATES.includes(state) || !canChange(e)) return;
    if (e.isRecurring && !window.confirm(t('calendarView.event.editSeriesOnly'))) return;
    try {
      await mutate(async () => {
        const update = item => item.id === e.id && item.calendarId === e.calendarId ? { ...item, status: state } : item;
        setData(old => ({ ...old, events: old.events.map(update) }));
        setSelected(old => old ? update(old) : null);
        try{await service.updateEvent(e.calendarId,e.id,{status:state});notify(uk?'Статус оновлено':'Status updated');}catch(err){const rollback=item=>item.id===e.id&&item.calendarId===e.calendarId?{...item,status:e.status}:item;setData(old=>({...old,events:old.events.map(rollback)}));setSelected(old=>old?rollback(old):null);throw err;}
      });
    } catch (err) { setError(getLocalizedApiError(err, t, 'calendarView.event.saveError')); }
  }
  async function startEdit() {
    if (!selected || !canChange(selected)) return;
    try { await mutate(async () => { const { event } = await service.getEvent(selected.calendarId, selected.id); setEdit(event); setMode('edit'); }); }
    catch (err) { setError(getLocalizedApiError(err, t, 'calendarView.event.loadError')); }
  }
  async function save(values) {
    if (!canWriteTask(calendar) || lock.current) throw Error(t('calendarView.event.saveError'));
    try {
      await mutate(async () => {
        if (mode === 'edit') await service.updateEvent(calendar.id, selected.id, values);
        else await service.createEvent(calendar.id, values);
        const savedDay = eventDayKey({ type: 'task', deadline: values.deadline }, zone);
        if (savedDay && (savedDay < from || savedDay > to)) setBoardRange({ from: shiftDate(savedDay,-30), to: shiftDate(savedDay,60) });
        if (mode === 'create') { setHidden(old => old.filter(id => id !== calendar.id)); setSearch(''); setCategory(''); setStatusFilter(''); }
        setOverdue(false); if (mode === 'create') setHideDone(false);
        setMode(null); setSelected(null); setEdit(null); setReload(n => n + 1);notify(uk?'Завдання збережено':'Task saved');
      });
    } catch (err) { throw Error(getLocalizedApiError(err, t, 'calendarView.event.saveError')); }
  }
  async function remove() {
    if (!selected || !canChange(selected) || lock.current || !window.confirm(t(selected.isRecurring ? 'calendarView.event.confirmDeleteSeries' : 'calendarView.event.confirmDelete'))) return;
    try { await mutate(async () => { await service.deleteEvent(selected.calendarId, selected.id); setMode(null); setSelected(null); setReload(n => n + 1); }); }
    catch (err) { setError(getLocalizedApiError(err, t, 'calendarView.event.deleteError')); }
  }
  async function invite(email) {
    if (!selected || !canChange(selected) || lock.current) throw Error(t('eventInvitations.sendError'));
    await mutate(async () => {
      await service.sendEventInvitation(selected.calendarId, selected.id, email);
      setSelected(e => ({ ...e, attendees: e.attendees.map(a => a.email === email ? { ...a, invitationSentAt: new Date().toISOString() } : a) }));
    });
  }
  function toggleOverdue(){
    if(!overdue){setBoardRange({from:shiftDate(today,-365),to:today});setStatusFilter('');}
    else setBoardRange({from:shiftDate(today,-30),to:shiftDate(today,60)});
    setOverdue(v=>!v);
  }
  const quickCalendar=editable.find(c=>c.isMain&&!hidden.includes(c.id))||editable.find(c=>!hidden.includes(c.id));
  async function quickAdd(e){
    e.preventDefault();if(!quickTitle.trim()||!quickCalendar||lock.current||loading)return;
    try{await mutate(async()=>{await service.createEvent(quickCalendar.id,{type:'task',title:quickTitle.trim(),description:'',color:safeColor(quickCalendar.color),deadline:fromCalendarInput(today+'T23:59',zone),status:'todo',categories:[],attendees:[],isRecurring:false});setQuickTitle('');setOverdue(false);setStatusFilter('');setCategory('');setSearch('');setBoardRange({from:shiftDate(today,-30),to:shiftDate(today,60)});setReload(n=>n+1);notify(uk?'Завдання додано':'Task added');});}
    catch(err){setError(getLocalizedApiError(err,t,'calendarView.event.saveError'));}
  }
  const selectedTasks=tasks.filter(e=>picked.includes(taskKey(e))&&canChange(e)&&!e.isRecurring);
  async function applyBulk(kind){
    if(lock.current||loading||!selectedTasks.length||(kind==='date'&&!bulkDate))return;
    await mutate(async()=>{
      let count=0,failed=0;
      for(const task of selectedTasks){
        try{const patch=kind==='date'?moveEventPatch(task,bulkDate,null,zone):{status:bulkStatus};await service.updateEvent(task.calendarId,task.id,patch);count++;setData(old=>({...old,events:old.events.map(e=>taskKey(e)===taskKey(task)?{...e,...patch}:e)}));}
        catch{failed++;}
      }
      setPicked([]);setBulk(false);setReload(n=>n+1);
      notify((uk?'Оновлено: ':'Updated: ')+count+(failed?(uk?' · Помилки: ':' · Failed: ')+failed:''));
    });
  }
  if (status !== 'authenticated') return <p>{status === 'loading' ? t('common.loading') : <Link to={localizedPath('/login')}>{t('common.signIn')}</Link>}</p>;
  const card = e => <TaskCard bulk={bulk} picked={picked.includes(taskKey(e))} onPick={()=>setPicked(old=>old.includes(taskKey(e))?old.filter(k=>k!==taskKey(e)):[...old,taskKey(e)])} key={taskKey(e)} task={e} calendar={data.calendars.find(c => c.id === e.calendarId)} zone={zone} busy={busy || loading} onOpen={open} onChange={change} onDragStart={ev => { setDrag(e); ev.dataTransfer.setData('text/plain', taskKey(e)); ev.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDrag(null)}/>;
  const stateIcon = { todo: 'checkbox', in_progress: 'clock', done: 'check' };
  return <CalendarEventActionsProvider value={{ canChange, busy: busy || loading, toggle: e => change(e, e.status === 'done' ? 'todo' : 'done') }}>
    <section className="tb-page">
      <header className="tb-heading"><div><h1>{uk ? 'Завдання' : 'Tasks'}</h1><p>{displayCount(tasks.length)} {uk ? 'завдань' : 'tasks'} · {displayCount(done)} {uk ? 'виконано' : 'done'}</p></div><button type="button" className="tb-primary" disabled={!editable.length || loading || busy} onClick={() => create()}><Icon name="plus" size={17}/>{uk ? 'Нове завдання' : 'New task'}</button></header>
      <div className="tb-main" aria-busy={loading}>
        <div className="tb-toolbar">
          <label className="tb-search"><Icon name="search" size={17}/><input aria-label={uk ? 'Пошук завдань' : 'Search tasks'} placeholder={uk ? 'Пошук завдань' : 'Search tasks'} value={search} onChange={e => setSearch(e.target.value)}/>{search && <button type="button" aria-label={uk ? 'Очистити пошук' : 'Clear search'} onClick={() => setSearch('')}><Icon name="x" size={14}/></button>}</label>
          <details className="tb-filter"><summary>{uk ? 'Календарі' : 'Calendars'}<Icon name="chevron-down" size={15}/></summary><div className="tb-filter-pop">{data.calendars.map(c => <label className="tb-source" key={c.id}><input type="checkbox" checked={!hidden.includes(c.id)} onChange={() => setHidden(old => old.includes(c.id) ? old.filter(id => id !== c.id) : [...old, c.id])}/><i style={{ background: safeColor(c.color) }}/><span>{c.name}</span></label>)}<button type="button" onClick={() => setHidden([])}>{uk ? 'Усі календарі' : 'All calendars'}</button></div></details>
          <details className="tb-filter"><summary>{uk ? 'Фільтри' : 'Filters'}<Icon name="chevron-down" size={15}/></summary><div className="tb-filter-pop">
            <label>{uk ? 'Категорія' : 'Category'}<select value={category} onChange={e => setCategory(e.target.value)}><option value="">{uk ? 'Усі' : 'All'}</option>{[...new Set([...categories, ...(category ? [category] : [])])].map(c => <option key={c} value={c}>{c}</option>)}</select></label>
            <label>{t('calendarView.event.status')}<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">{uk ? 'Усі' : 'All'}</option>{TASK_STATES.map(s => <option key={s} value={s}>{t('statuses.' + s)}</option>)}</select></label>
            <label>{uk ? 'Від' : 'From'}<input type="date" value={from} max={to} onChange={e => { if (e.target.value && e.target.value <= to) setBoardRange(r => ({ ...r, from: e.target.value, to: r.to>shiftDate(e.target.value,365)?shiftDate(e.target.value,365):r.to })); }}/></label>
            <label>{uk ? 'До' : 'To'}<input type="date" value={to} min={from} onChange={e => { if (e.target.value && e.target.value >= from) setBoardRange(r => ({ ...r, to: e.target.value, from: r.from<shiftDate(e.target.value,-365)?shiftDate(e.target.value,-365):r.from })); }}/></label>
            <button type="button" onClick={() => { setSearch(''); setCategory(''); setHidden([]); setStatusFilter(''); setOverdue(false); setHideDone(false); setBoardRange({ from: shiftDate(today, -30), to: shiftDate(today, 60) }); }}>{uk ? 'Скинути фільтри' : 'Reset filters'}</button>
          </div></details>
          <div className="ux-task-tools"><button type="button" aria-pressed={overdue} onClick={toggleOverdue}>{uk?'Прострочені':'Overdue'}</button><button type="button" aria-pressed={hideDone} onClick={()=>setHideDone(v=>!v)}>{uk?'Приховати виконані':'Hide completed'}</button><select aria-label={uk?'Сортування':'Sort'} value={sort} onChange={e=>setSort(e.target.value)}><option value="due">{uk?'За дедлайном':'Due date'}</option><option value="latest">{uk?'За новизною':'Newest'}</option><option value="title">{uk?'За назвою':'Name'}</option></select><button type="button" aria-pressed={bulk} onClick={()=>{setBulk(v=>!v);setPicked([]);}}>{uk?'Вибрати':'Select'}</button></div>
          <span className="tb-period-label">{format(from, { day: 'numeric', month: 'short' })} – {format(to, { day: 'numeric', month: 'short' })}</span>
        </div>
        {bulk&&<div className="ux-bulk"><strong>{selectedTasks.length} {uk?'вибрано':'selected'}</strong><button type="button" onClick={()=>setPicked(tasks.filter(e=>canChange(e)&&!e.isRecurring).map(taskKey))}>{uk?'Вибрати всі':'Select all'}</button><select value={bulkStatus} aria-label={uk?'Новий статус':'New status'} onChange={e=>setBulkStatus(e.target.value)}>{TASK_STATES.map(s=><option key={s} value={s}>{t('statuses.'+s)}</option>)}</select><button type="button" disabled={busy||!selectedTasks.length} onClick={()=>void applyBulk('status')}>{uk?'Змінити статус':'Apply status'}</button><input type="date" aria-label={uk?'Нова дата':'New date'} value={bulkDate} onChange={e=>setBulkDate(e.target.value)}/><button type="button" disabled={busy||!bulkDate||!selectedTasks.length} onClick={()=>void applyBulk('date')}>{uk?'Перенести':'Move'}</button></div>}
        {(error || data.failed > 0) && <p className="tb-error" role="alert">{error || (uk ? 'Деякі календарі не завантажилися' : 'Some calendars could not be loaded')} <button type="button" onClick={() => setReload(n => n + 1)}>{t('common.retry')}</button></p>}
        <div className="tb-board">{TASK_STATES.map(s => {
          const items = tasks.filter(e => e.status === s);
          return <section key={s} className={'tb-column ' + s + (drag && drag.status !== s ? ' drop-ready' : '')} onDragOver={e => { if (drag && !busy && !loading) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }} onDrop={e => { e.preventDefault(); if (drag) void change(drag, s); setDrag(null); }}>
            <header><span className="tb-column-icon"><Icon name={stateIcon[s]} size={18}/></span><h2>{t('statuses.' + s)}</h2><span className="tb-column-count">{displayCount(items.length)}</span></header>
            <div className="tb-column-body">{loading?<SkeletonRows label={t('common.loading')} count={2}/>:items.length?items.map(card):<EmptyState icon={stateIcon[s]} title={uk?'Немає завдань':'No tasks'}/>}
              {s==='todo'&&quickCalendar&&!loading&&!overdue&&<form className="ux-quick-add" onSubmit={quickAdd}><input aria-label={uk?'Швидке завдання':'Quick task'} placeholder={uk?'Назва завдання…':'Task name…'} maxLength={200} value={quickTitle} onChange={e=>setQuickTitle(e.target.value)} disabled={busy}/><small>{quickCalendar.name} · {uk?'Сьогодні, 23:59':'Today, 23:59'}</small>{quickTitle.trim()&&<button className="ux-primary" type="submit" disabled={busy}>{uk?'Додати':'Add'}</button>}</form>}
              <button type="button" className="tb-add-task" disabled={!editable.length || loading || busy} onClick={() => create(s)}><Icon name="plus" size={16}/>{uk ? 'Додати завдання' : 'Add task'}</button>
            </div>
          </section>;
        })}</div>
      </div>
      <Notice notice={notice} onDismiss={dismissNotice} closeLabel={uk?"Закрити":"Dismiss"}/>
      {mode && calendar && <EventDialog label={t('calendarView.event.details')} onClose={close} busy={busy}><div className="tb-dialog">{error && <p className="event-dialog-error" role="alert">{error}</p>}{mode === 'details' ? <EventDetails event={selected} calendar={calendar} onClose={close} onEdit={startEdit} onDelete={remove} canEdit={canWriteTask(calendar)} busy={busy} onInvite={invite}/> : <>{mode === 'create' && <label className="tb-calendar-choice"><Icon name="calendar" size={17}/><span>{uk ? 'Календар' : 'Calendar'}</span><select value={calId} disabled={busy} onChange={e => setCalId(e.target.value)}>{editable.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}<EventEditor key={mode} initialType="task" initialDay={today} initialStatus={createStatus} event={edit} calendar={calendar} saving={busy} onSave={save} onCancel={close}/></>}</div></EventDialog>}
    </section>
  </CalendarEventActionsProvider>;
}
