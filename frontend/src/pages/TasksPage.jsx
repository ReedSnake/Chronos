import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { applicationContainer } from '../app/applicationContainer';
import { loadDashboard } from '../features/dashboard/dashboardData';
import { EventDialog } from '../features/events/EventDialog';
import { EventEditor } from '../features/events/EventEditor';
import { EventDetails } from '../features/events/EventDetails';
import { CalendarEventActionsProvider, TaskCompletion, EventStatus } from '../features/events/CalendarEventActions';
import { eventDayKey } from '../features/events/eventForm';
import { getLocalizedApiError } from '../i18n/apiErrors';
import { TablerIcon as Icon } from '../components/layout/TablerIcon';
import { TASK_STATES, taskKey, shiftDate, monthShift, weekDates, monthDates, taskRange, apiRange, filterTasks, groupTasks, taskTime, canWriteTask } from '../features/tasks/taskBoardModel';
import '../features/tasks/task-board.css';

const service = applicationContainer.calendarService;
const emptyData = { calendars: [], events: [], failed: 0 };
const safeColor = color => /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#F5BC5A';

function TaskCard({ task, calendar, zone, onOpen, onChange, busy, onDragStart, onDragEnd, compact = false }) {
  const { t, locale } = useLocale(), uk = locale === 'uk';
  const writable = canWriteTask(calendar);
  const participants = task.attendees || [];
  const category = task.categories?.[0];
  const date = eventDayKey(task, zone);
  const dateLabel = date ? new Date(date + 'T12:00:00Z').toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  return <article className={'tb-card ' + task.status + (compact ? ' compact' : '')} style={{ '--task-color': safeColor(task.color || calendar?.color) }} draggable={!!onDragStart && writable && !busy} onDragStart={onDragStart} onDragEnd={onDragEnd}>
    <div className="tb-card-top"><span className="tb-card-tag"><i/>{category || task.calendarName || calendar?.name}</span><TaskCompletion event={task}/></div>
    <button type="button" className="tb-card-open" onClick={() => onOpen(task)}><strong>{task.title}</strong>{!compact && task.description && <p>{task.description}</p>}</button>
    <div className="tb-card-time"><Icon name="clock" size={13}/><span>{dateLabel} · {taskTime(task, zone)}</span>{task.isRecurring && <Icon name="refresh" size={13} title={t('calendarView.event.repeatLabel')}/>}</div>
    <div className="tb-card-bottom">
      <EventStatus event={task}/>
      {participants.length > 0 && <div className="tb-avatars" aria-label={uk ? 'Учасники' : 'Participants'}>{participants.slice(0, compact ? 2 : 4).map(a => <span key={a.email} title={a.email}>{a.email.slice(0, 1).toUpperCase()}</span>)}{participants.length > (compact ? 2 : 4) && <span>+{participants.length - (compact ? 2 : 4)}</span>}</div>}
    </div>
    {writable && !compact && <select className="tb-status-select" aria-label={t('calendarView.event.status') + ': ' + task.title} disabled={busy} value={task.status} onChange={e => onChange(task, e.target.value)}>{TASK_STATES.map(s => <option key={s} value={s}>{t('statuses.' + s)}</option>)}</select>}
  </article>;
}

export function TasksPage() {
  const { status, user } = useAuth();
  const { locale, t, localizedPath } = useLocale();
  const uk = locale === 'uk', zone = user?.settings?.timeZone || 'UTC', startsOn = user?.settings?.weekStartsOn || 'monday';
  const today = eventDayKey({ startsAt: new Date().toISOString() }, zone);
  const [day, setDay] = useState(today), [mini, setMini] = useState(today);
  const [view, setView] = useState('board');
  const [boardRange, setBoardRange] = useState(() => ({ from: shiftDate(today, -30), to: shiftDate(today, 60) }));
  const [data, setData] = useState(emptyData), [loading, setLoading] = useState(true), [error, setError] = useState(''), [reload, setReload] = useState(0);
  const [search, setSearch] = useState(''), [hidden, setHidden] = useState([]), [category, setCategory] = useState(''), [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState(null), [selected, setSelected] = useState(null), [edit, setEdit] = useState(null), [calId, setCalId] = useState(''), [createDay, setCreateDay] = useState(today);
  const [busy, setBusy] = useState(false), [drag, setDrag] = useState(null);
  const lock = useRef(false);
  const range = taskRange(view, day, boardRange, startsOn);
  const from = range.from, to = range.to;
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
  const tasks = useMemo(() => filterTasks(data.events, { hidden, category, status: statusFilter, search }), [data.events, hidden, category, statusFilter, search]);
  const groups = useMemo(() => groupTasks(tasks, zone), [tasks, zone]);
  const categories = [...new Set(data.events.flatMap(e => e.categories || []))].sort();
  const editable = data.calendars.filter(canWriteTask);
  const calendar = data.calendars.find(c => c.id === (mode === 'create' ? calId : selected?.calendarId));
  const canChange = e => canWriteTask(data.calendars.find(c => c.id === e.calendarId));
  const done = tasks.filter(e => e.status === 'done').length;
  const unknown = loading || !!data.failed || !!error;
  const format = (d, options) => new Date(d + 'T12:00:00Z').toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
  const displayCount = n => unknown ? '—' : n;
  const chooseDay = d => { setDay(d); setMini(d); if (view === 'board') setView('day'); };
  function switchView(v) { setView(v); setMini(day); }
  function movePeriod(n) { chooseDay(view === 'month' ? monthShift(day, n) : shiftDate(day, n * (view === 'week' ? 7 : 1))); }
  function close() { if (!lock.current) { setMode(null); setSelected(null); setEdit(null); } }
  function create(date = day) {
    if (busy || loading) return;
    const visible = editable.filter(c => !hidden.includes(c.id));
    const c = visible.find(c => c.isMain) || visible[0] || editable.find(c => c.isMain) || editable[0];
    if (!c) return;
    setError(''); setCalId(c.id); setCreateDay(date); setSelected(null); setEdit(null); setMode('create');
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
        await service.updateEvent(e.calendarId, e.id, { status: state });
        const update = item => item.id === e.id && item.calendarId === e.calendarId ? { ...item, status: state } : item;
        setData(old => ({ ...old, events: old.events.map(update) }));
        setSelected(old => old ? update(old) : null);
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
        if (savedDay && (savedDay < from || savedDay > to)) { setDay(savedDay); setMini(savedDay); setView('day'); }
        if (mode === 'create') { setHidden(old => old.filter(id => id !== calendar.id)); setSearch(''); setCategory(''); setStatusFilter(''); }
        setMode(null); setSelected(null); setEdit(null); setReload(n => n + 1);
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
  if (status !== 'authenticated') return <p>{status === 'loading' ? t('common.loading') : <Link to={localizedPath('/login')}>{t('common.signIn')}</Link>}</p>;
  const card = (e, compact = false, draggable = false) => <TaskCard key={taskKey(e)} task={e} calendar={data.calendars.find(c => c.id === e.calendarId)} zone={zone} compact={compact} busy={busy || loading} onOpen={open} onChange={change} onDragStart={draggable ? ev => { setDrag(e); ev.dataTransfer.setData('text/plain', taskKey(e)); ev.dataTransfer.effectAllowed = 'move'; } : undefined} onDragEnd={() => setDrag(null)}/>;
  const add = date => <button type="button" className="tb-column-add" aria-label={(uk ? 'Нове завдання' : 'New task') + ' ' + date} disabled={!editable.length || busy || loading} onClick={() => create(date)}><Icon name="plus" size={16}/></button>;
  const empty = <p className="tb-empty">{loading ? t('common.loading') : uk ? 'Немає завдань' : 'No tasks'}</p>;
  const dayTasks = groups.get(day) || [];
  const miniDates = monthDates(mini, startsOn);
  return <CalendarEventActionsProvider value={{ canChange, busy: busy || loading, toggle: e => change(e, e.status === 'done' ? 'todo' : 'done') }}>
    <section className="tb-page">
      <header className="tb-heading"><div><h1>{uk ? 'Завдання' : 'Tasks'}</h1><p>{zone}</p></div><div className="tb-heading-actions"><div className="tb-views" role="group" aria-label={uk ? 'Вигляд' : 'View'}>{[['board', uk ? 'Дошка' : 'Board'], ['day', uk ? 'День' : 'Day'], ['week', uk ? 'Тиждень' : 'Week'], ['month', uk ? 'Місяць' : 'Month']].map(([id, label]) => <button type="button" key={id} aria-pressed={view === id} onClick={() => switchView(id)}>{label}</button>)}</div><button type="button" className="tb-primary" disabled={!editable.length || loading || busy} onClick={() => create()}><Icon name="plus" size={17}/>{uk ? 'Нове завдання' : 'New task'}</button></div></header>
      <div className="tb-layout">
        <aside className="tb-rail">
          <section className="tb-mini"><div className="tb-mini-head"><button type="button" aria-label={t('calendarView.previousMonth')} onClick={() => setMini(monthShift(mini, -1))}><Icon name="chevron-left" size={16}/></button><strong>{format(mini, { month: 'long', year: 'numeric' })}</strong><button type="button" aria-label={t('calendarView.nextMonth')} onClick={() => setMini(monthShift(mini, 1))}><Icon name="chevron-right" size={16}/></button></div><div className="tb-mini-grid">{miniDates.slice(0, 7).map(d => <span key={d}>{format(d, { weekday: 'short' }).slice(0, 2)}</span>)}{miniDates.map(d => <button type="button" key={d} className={(d.slice(0, 7) !== mini.slice(0, 7) ? 'outside ' : '') + (d === today ? 'today' : '')} aria-pressed={d === day} aria-label={format(d, { dateStyle: 'full' })} onClick={() => chooseDay(d)}>{Number(d.slice(-2))}</button>)}</div></section>
          <section className="tb-sources"><header><h2>{uk ? 'Мої календарі' : 'My calendars'}</h2><Link to={localizedPath('/calendars')} title={t('calendarView.manageCalendars')} aria-label={t('calendarView.manageCalendars')}><Icon name="settings" size={16}/></Link></header>{data.calendars.map(c => <label key={c.id}><input type="checkbox" checked={!hidden.includes(c.id)} onChange={() => setHidden(old => old.includes(c.id) ? old.filter(id => id !== c.id) : [...old, c.id])}/><i style={{ background: safeColor(c.color) }}/><span>{c.name}</span></label>)}{!loading && !data.calendars.length && empty}</section>
          <section className="tb-sources"><header><h2>{uk ? 'Категорії' : 'Categories'}</h2></header><button type="button" className="tb-category" aria-pressed={!category} onClick={() => setCategory('')}>{uk ? 'Усі категорії' : 'All categories'}</button>{[...new Set([...categories, ...(category ? [category] : [])])].map(c => <button type="button" key={c} className="tb-category" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</section>
          <section className="tb-progress"><header><h2>{uk ? 'Виконано' : 'Completed'}</h2><strong>{displayCount(done)} / {displayCount(tasks.length)}</strong></header><div className="tb-progress-track"><i style={{ width: unknown || !tasks.length ? '0%' : done / tasks.length * 100 + '%' }}/></div></section>
        </aside>
        <main className="tb-main" aria-busy={loading}>
          <div className="tb-toolbar"><div className="tb-period">{view === 'board' ? <span>{uk ? 'Дошка завдань' : 'Task board'}</span> : <><button type="button" aria-label={uk ? 'Назад' : 'Previous'} onClick={() => movePeriod(-1)}><Icon name="chevron-left" size={18}/></button><strong>{view === 'week' ? format(from, { day: 'numeric', month: 'short' }) + ' – ' + format(to, { day: 'numeric', month: 'short' }) : format(day, view === 'month' ? { month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' })}</strong><button type="button" aria-label={uk ? 'Далі' : 'Next'} onClick={() => movePeriod(1)}><Icon name="chevron-right" size={18}/></button><button type="button" className="tb-today" onClick={() => chooseDay(today)}>{uk ? 'Сьогодні' : 'Today'}</button></>}</div>
            <label className="tb-search"><Icon name="search" size={16}/><input aria-label={uk ? 'Пошук завдань' : 'Search tasks'} placeholder={uk ? 'Пошук завдань' : 'Search tasks'} value={search} onChange={e => setSearch(e.target.value)}/>{search && <button type="button" aria-label={uk ? 'Очистити пошук' : 'Clear search'} onClick={() => setSearch('')}><Icon name="x" size={14}/></button>}</label>
            <details className="tb-filter"><summary>{uk ? 'Фільтри' : 'Filters'}<Icon name="chevron-down" size={15}/></summary><div className="tb-filter-pop"><label>{t('calendarView.event.status')}<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">{uk ? 'Усі' : 'All'}</option>{TASK_STATES.map(s => <option key={s} value={s}>{t('statuses.' + s)}</option>)}</select></label>{view === 'board' && <><label>{uk ? 'Від' : 'From'}<input type="date" value={boardRange.from} max={boardRange.to} onChange={e => { if (e.target.value && e.target.value <= boardRange.to) setBoardRange(r => ({ ...r, from: e.target.value })); }}/></label><label>{uk ? 'До' : 'To'}<input type="date" value={boardRange.to} min={boardRange.from} onChange={e => { if (e.target.value && e.target.value >= boardRange.from) setBoardRange(r => ({ ...r, to: e.target.value })); }}/></label></>}<button type="button" onClick={() => { setSearch(''); setCategory(''); setHidden([]); setStatusFilter(''); }}>{uk ? 'Скинути фільтри' : 'Reset filters'}</button></div></details></div>
          {(error || data.failed > 0) && <p className="tb-error" role="alert">{error || (uk ? 'Деякі календарі не завантажилися' : 'Some calendars could not be loaded')} <button type="button" onClick={() => setReload(n => n + 1)}>{t('common.retry')}</button></p>}
          {view === 'board' && <div className="tb-board">{TASK_STATES.map(s => { const items = tasks.filter(e => e.status === s); return <section key={s} className={'tb-column ' + s} onDragOver={e => { if (drag && !busy) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (drag) void change(drag, s); setDrag(null); }}><header><h2><i/>{t('statuses.' + s)} <small>{displayCount(items.length)}</small></h2>{s === 'todo' && add(day)}</header><div className="tb-column-body">{items.length ? items.map(e => card(e, false, true)) : empty}</div></section>; })}</div>}
          {view === 'week' && <div className="tb-week">{weekDates(day, startsOn).map(d => <section className={'tb-column tb-week-column' + (d === today ? ' today' : '')} key={d}><header><button type="button" className="tb-day-label" onClick={() => { chooseDay(d); setView('day'); }}><small>{format(d, { weekday: 'short' })}</small><strong>{Number(d.slice(-2))}</strong></button>{add(d)}</header><div className="tb-column-body">{(groups.get(d) || []).length ? groups.get(d).map(e => card(e, true)) : empty}</div></section>)}</div>}
          {view === 'day' && <div className="tb-day"><div className="tb-day-list">{dayTasks.length ? dayTasks.map(e => <div key={taskKey(e)} className="tb-day-row"><time>{taskTime(e, zone)}</time><div className="tb-day-dot"><i/></div>{card(e)}</div>) : empty}</div><div className="tb-day-summary"><h2>{uk ? 'План дня' : 'Day plan'}</h2>{TASK_STATES.map(s => <div key={s}><span>{t('statuses.' + s)}</span><strong>{displayCount(dayTasks.filter(e => e.status === s).length)}</strong></div>)}<button type="button" className="tb-primary" onClick={() => create(day)} disabled={!editable.length || loading || busy}><Icon name="plus" size={16}/>{uk ? 'Нове завдання' : 'New task'}</button></div></div>}
          {view === 'month' && <div className="tb-month"><div className="tb-month-calendar"><div className="tb-month-weekdays">{monthDates(day, startsOn).slice(0, 7).map(d => <span key={d}>{format(d, { weekday: 'short' })}</span>)}</div><div className="tb-month-grid" style={{ '--weeks': monthDates(day, startsOn).length / 7 }}>{monthDates(day, startsOn).map(d => { const items = groups.get(d) || []; return <div key={d} className={'tb-month-cell' + (d === day ? ' selected' : '') + (d.slice(0, 7) !== day.slice(0, 7) ? ' outside' : '')}><div><button type="button" aria-pressed={day === d} onClick={() => chooseDay(d)}>{Number(d.slice(-2))}</button>{add(d)}</div>{items.slice(0, 2).map(e => <button key={taskKey(e)} type="button" className={'tb-month-task ' + e.status} onClick={() => open(e)} title={e.title}>{e.title}</button>)}{items.length > 2 && <button type="button" className="tb-more" onClick={() => chooseDay(d)}>+{items.length - 2}</button>}</div>; })}</div></div><aside className="tb-month-detail"><header><h2>{format(day, { day: 'numeric', month: 'long' })}</h2>{add(day)}</header><div className="tb-column-body">{dayTasks.length ? dayTasks.map(e => card(e, true)) : empty}</div></aside></div>}
          <footer className="tb-footer"><span>{displayCount(tasks.length)} {uk ? 'завдань' : 'tasks'} · {displayCount(done)} {uk ? 'виконано' : 'done'}</span>{view === 'board' && <span>{format(from, { day: 'numeric', month: 'short' })} – {format(to, { day: 'numeric', month: 'short' })}</span>}</footer>
        </main>
      </div>
      {mode && calendar && <EventDialog label={t('calendarView.event.details')} onClose={close} busy={busy}><div className="tb-dialog">{error && <p className="event-dialog-error" role="alert">{error}</p>}{mode === 'details' ? <EventDetails event={selected} calendar={calendar} onClose={close} onEdit={startEdit} onDelete={remove} canEdit={canWriteTask(calendar)} busy={busy} onInvite={invite}/> : <>{mode === 'create' && <label className="tb-calendar-choice"><Icon name="calendar" size={17}/><span>{uk ? 'Календар' : 'Calendar'}</span><select value={calId} disabled={busy} onChange={e => setCalId(e.target.value)}>{editable.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}<EventEditor key={mode} initialType="task" initialDay={createDay} event={edit} calendar={calendar} saving={busy} onSave={save} onCancel={close}/></>}</div></EventDialog>}
    </section>
  </CalendarEventActionsProvider>;
}
