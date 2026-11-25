import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { PageTemplate } from '../components/layout/PageTemplate';
import { TablerIcon as Icon } from '../components/layout/TablerIcon';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';
import { CalendarCollaborationPanel } from '../features/calendars/CalendarCollaborationPanel';
import { EventDialog } from '../features/events/EventDialog';
import '../features/calendars/calendar-management.css';

const service = applicationContainer.calendarService;
const safeColor = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#F5BC5A';
const canManage = calendar => !calendar.isHolidayCalendar && ['owner', 'admin'].includes(calendar.role);
const canEdit = calendar => !calendar.isHolidayCalendar && ['owner', 'admin', 'editor'].includes(calendar.role);
const palette = ['#F5BC5A', '#303030', '#8EB1D7', '#65A982', '#D68B85', '#A69BC8'];
const defaultDraft = () => ({ name: '', description: '', color: '#F5BC5A', countryCode: '', timeZone: 'UTC', defaultView: 'month', defaultEventDurationMinutes: 60 });
const editDraft = calendar => ({ name: calendar.name, description: calendar.description || '', color: safeColor(calendar.color), countryCode: calendar.countryCode || '', timeZone: calendar.timeZone || 'UTC', defaultView: calendar.defaultView || 'month', defaultEventDurationMinutes: calendar.defaultEventDurationMinutes || 60, isArchived: !!calendar.isArchived });

function calendarRoleLabel(t, role) {
  const key = 'calendarRoles.' + role;
  const translated = t(key);
  return translated === key ? role : translated;
}

function CalendarForm({ draft, setDraft, calendar, busy, onSave, onClose }) {
  const { t, locale } = useLocale();
  const uk = locale === 'uk';
  const [countries, setCountries] = useState([]);
    useEffect(() => {
    let active = true;
    applicationContainer.countryService.getAvailableCountries().then(items => { if (active) setCountries(items); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const set = (field, value) => setDraft(old => ({ ...old, [field]: value }));
  const row = (icon, label, control) => <label className="cm-property"><span><Icon name={icon} size={17}/>{label}</span>{control}</label>;
  return <form className="cm-form cm-inspector" onSubmit={onSave}>
    <div className="cm-form-body">
      <div className="cm-identity" style={{ '--calendar-color': draft.color }}>
        <span className="cm-calendar-icon"><Icon name="calendar" size={28}/></span>
        <div className="cm-identity-fields">
          <input className="cm-name" aria-label={t('calendars.name')} autoFocus value={draft.name} onChange={e => set('name', e.target.value)} maxLength={120} required placeholder={uk ? 'Назва календаря' : 'Calendar name'}/>
          <textarea className="cm-description-input" aria-label={t('calendars.description')} value={draft.description} onChange={e => set('description', e.target.value)} maxLength={2000} rows={2} placeholder={uk ? 'Додати опис…' : 'Add a description…'}/>
        </div>
      </div>
      <div className="cm-color-options" role="group" aria-label={t('calendars.color')}>{palette.map(color => <button type="button" key={color} style={{ background: color }} aria-label={color} aria-pressed={draft.color.toUpperCase() === color} onClick={() => set('color', color)}>{draft.color.toUpperCase() === color && <Icon name="check" size={15}/>}</button>)}<input type="color" aria-label={t('calendars.color')} value={draft.color} onChange={e => set('color', e.target.value.toUpperCase())}/></div>
      <div className="cm-properties">
        {row('world', t('calendars.countryCode'), <input list="cm-country-list" value={draft.countryCode} maxLength={2} placeholder={uk ? 'Не вибрано' : 'Not set'} onChange={e => set('countryCode', e.target.value.toUpperCase())}/>)}
        <datalist id="cm-country-list">{countries.map(c => <option key={c.countryCode} value={c.countryCode}>{c.name}</option>)}</datalist>
        {row('layout-dashboard', t('calendars.defaultView'), <select value={draft.defaultView} onChange={e => set('defaultView', e.target.value)}><option value="month">{t('calendars.viewMonth')}</option><option value="agenda">{t('calendars.viewAgenda')}</option></select>)}
        {row('clock', t('calendars.defaultDuration'), <span className="cm-duration"><input type="number" min="5" max="1440" required value={draft.defaultEventDurationMinutes} onChange={e => set('defaultEventDurationMinutes', Number(e.target.value))}/><span>{uk ? 'хв' : 'min'}</span></span>)}
        {calendar && canManage(calendar) && !calendar.isMain && <label className="cm-archive-check"><input type="checkbox" checked={!!draft.isArchived} onChange={e => set('isArchived', e.target.checked)}/>{t('calendars.archived')}</label>}
      </div>
      {!calendar && <div className="cm-private-note"><Icon name="lock" size={17}/><div><strong>{uk ? 'Приватний календар' : 'Private calendar'}</strong><p>{uk ? 'Налаштуйте спільний доступ після створення' : 'Share access after creation'}</p></div></div>}
    </div>
    <footer className="cm-modal-footer"><button type="button" disabled={busy} onClick={onClose}>{t('calendarView.event.cancel')}</button><button className="cm-primary" type="submit" disabled={busy || !draft.name.trim()}>{busy ? t('common.loading') : t(calendar ? 'calendars.save' : 'calendars.create')}</button></footer>
  </form>;
}

export function CalendarsPage() {
  const { status } = useAuth();
  const { localizedPath, t, locale } = useLocale();
  const uk = locale === 'uk';
  const [calendars, setCalendars] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState(defaultDraft);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const selected = calendars.find(c => c.id === modal?.id);
  const createMode = modal?.section === 'create';

  async function loadCalendars() {
    setLoading(true); setError('');
    try { const result = await service.list(); setCalendars(result.calendars); }
    catch (err) { setError(getLocalizedApiError(err, t, 'calendars.loadError')); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (status === 'authenticated') void loadCalendars();
    else if (status !== 'loading') setLoading(false);
  }, [status]);

  function openCreate() {
    setModalError(''); setDraft(defaultDraft()); setModal({ section: 'create' });
  }
  function openManage(calendar, section) {
    if (lock.current || (section === 'settings' ? !canEdit(calendar)&&!(calendar.isHolidayCalendar&&calendar.role==='owner') : !canManage(calendar))) return;
    setModalError(''); setDraft(editDraft(calendar)); setModal({ id: calendar.id, section });
  }
  function close() { if (!lock.current) { setModal(null); setModalError(''); } }
  function switchSection(section) {
    if (lock.current || !selected || (section === 'settings' ? !canEdit(selected) : !canManage(selected))) return;
    setModalError(''); setModal(old => ({ ...old, section }));
  }
  async function save(event) {
    event.preventDefault();
    if (lock.current || (!createMode && (!selected || !canEdit(selected)))) return;
    lock.current = true; setBusy(true); setModalError('');
    const values = { ...draft, name: draft.name.trim(), countryCode: draft.countryCode.trim() || null };
    if (!values.name) { lock.current = false; setBusy(false); return; }
    if (createMode || selected.isMain) delete values.isArchived;
    if (!createMode) delete values.timeZone;
    if (!createMode && !canManage(selected)) delete values.isArchived;
    try {
      if (createMode) {
        const result = await service.create(values);
        setCalendars(old => [result.calendar, ...old]);
        setSearch(''); setFilter('all');
      } else {
        const result = await service.update(selected.id, values);
        setCalendars(old => old.map(c => c.id === selected.id ? result.calendar : c));
      }
      setModal(null);
    } catch (err) { setModalError(getLocalizedApiError(err, t, createMode ? 'calendars.createError' : 'calendars.updateError')); }
    finally { lock.current = false; setBusy(false); }
  }
  async function toggleHoliday(calendar) {
    if (lock.current || !calendar.isHolidayCalendar) return;
    lock.current = true; setBusy(true); setModalError('');
    try {
      const { calendar: updated } = await service.update(calendar.id, { isArchived: !calendar.isArchived });
      setCalendars(old => old.map(c => c.id === calendar.id ? updated : c));
      setModal(null);
    } catch (err) { setModalError(getLocalizedApiError(err, t, 'calendars.updateError')); }
    finally { lock.current = false; setBusy(false); }
  }
  async function removeCalendar(calendar) {
    if (lock.current || !canManage(calendar) || calendar.isMain || !window.confirm(t('calendars.confirmDelete', { name: calendar.name }))) return;
    lock.current = true; setBusy(true); setModalError('');
    try { await service.remove(calendar.id); setCalendars(old => old.filter(c => c.id !== calendar.id)); setModal(null); }
    catch (err) { setModalError(getLocalizedApiError(err, t, 'calendars.deleteError')); }
    finally { lock.current = false; setBusy(false); }
  }

  if (status === 'loading') return <PageTemplate><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (status !== 'authenticated') return <PageTemplate><p>{t('calendars.signInBefore')}<Link to={localizedPath('/login')}>{t('common.signIn')}</Link>{t('calendars.signInAfter')}</p></PageTemplate>;

  const nameOf = c => c.isHolidayCalendar ? t('calendarBasics.holidays') : c.name;
  const sorted = [...calendars].sort((a,b) => Number(!!b.isMain) - Number(!!a.isMain) || Number(!!a.isArchived) - Number(!!b.isArchived) || nameOf(a).localeCompare(nameOf(b), locale));
  const visible = sorted.filter(c => (filter === 'all' || (filter === 'archived' ? c.isArchived : !c.isArchived)) && [nameOf(c), c.description, c.timeZone, c.countryCode].some(v => String(v || '').toLowerCase().includes(search.trim().toLowerCase())));
  const tabs = selected ? [
    ...(canEdit(selected)||selected.isHolidayCalendar&&selected.role==='owner' ? [['settings', 'settings', uk ? 'Налаштування' : 'Settings']] : []),
    ...(canManage(selected) ? [['share', 'arrow-up-right', uk ? 'Посилання' : 'Share links'], ['invite', 'user', uk ? 'Запрошення' : 'Invitations'], ['members', 'users', uk ? 'Учасники' : 'Members']] : []),
  ] : [];

  return <section className="cm-page" aria-busy={loading}>
    <header className="cm-heading"><div><h1>{t('calendars.title')}</h1><p>{uk ? 'Керуйте календарями та доступом до них' : 'Manage your calendars and access'}</p></div><button type="button" className="cm-primary" disabled={busy} onClick={openCreate}><Icon name="plus" size={19}/>{t('calendars.createTitle')}</button></header>
    <div className="cm-toolbar">
      <div className="cm-filters" role="group" aria-label={uk ? 'Фільтр календарів' : 'Calendar filter'}>{[['all', uk ? 'Усі' : 'All', calendars.length], ['active', uk ? 'Активні' : 'Active', calendars.filter(c => !c.isArchived).length], ['archived', uk ? 'Архів' : 'Archived', calendars.filter(c => c.isArchived).length]].map(([id,label,count]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}<small>{loading ? '—' : count}</small></button>)}</div>
      <label className="cm-search"><Icon name="search" size={17}/><input aria-label={uk ? 'Пошук календарів' : 'Search calendars'} placeholder={uk ? 'Пошук календарів' : 'Search calendars'} value={search} onChange={e => setSearch(e.target.value)}/>{search && <button type="button" onClick={() => setSearch('')} aria-label={uk ? 'Очистити пошук' : 'Clear search'}><Icon name="x" size={15}/></button>}</label>
    </div>
    {error && <p className="cm-error" role="alert">{error} <button type="button" onClick={loadCalendars}>{uk ? 'Повторити' : 'Retry'}</button></p>}
    {loading ? <div className="cm-grid" role="status" aria-label={t('common.loading')}>{[0,1,2].map(i => <div className="cm-card cm-skeleton" key={i}><span/><i/><i/></div>)}</div> : <div className="cm-grid">
      {visible.map(calendar => <article className="cm-card" key={calendar.id} style={{ '--calendar-color': safeColor(calendar.color) }}>
        <div className="cm-card-head"><span className="cm-calendar-icon"><Icon name="calendar" size={24}/></span><div className="cm-badges">{calendar.isMain && <span className="cm-main-badge">{t('calendarBasics.main')}</span>}{calendar.isArchived && <span>{t('calendars.archived')}</span>}</div>{(canEdit(calendar)||calendar.isHolidayCalendar&&calendar.role==='owner') && <button type="button" className="cm-icon-button" onClick={() => openManage(calendar, 'settings')} aria-label={t('calendars.editTitle') + ': ' + nameOf(calendar)}><Icon name="settings" size={18}/></button>}</div>
        <div className="cm-card-title"><h2>{nameOf(calendar)}</h2><p>{calendarRoleLabel(t, calendar.role)}</p></div>
        {calendar.description && <p className="cm-description">{calendar.description}</p>}
        {calendar.isHolidayCalendar && <p className="cm-description">{t('calendarBasics.holidayNote')} · {calendar.countryCode}</p>}
        <div className="cm-card-meta">{calendar.countryCode && <span>{calendar.countryCode}</span>}</div>
        <div className="cm-card-actions"><Link className="cm-open" to={localizedPath('/calendars/view/' + calendar.id)}>{t('calendars.view')}<Icon name="arrow-up-right" size={16}/></Link>
          {canManage(calendar) && <button type="button" className="cm-secondary" onClick={() => openManage(calendar, 'members')}><Icon name="users" size={16}/>{uk ? 'Доступ' : 'Access'}</button>}
        </div>
      </article>)}
      {!visible.length && <div className="cm-empty"><span className="cm-calendar-icon"><Icon name="calendar" size={26}/></span><p>{calendars.length ? (uk ? 'Календарів за цим фільтром немає' : 'No calendars match these filters') : t('calendars.empty')}</p><button type="button" className="cm-secondary" onClick={calendars.length ? () => { setSearch(''); setFilter('all'); } : openCreate}>{calendars.length ? (uk ? 'Скинути фільтри' : 'Reset filters') : t('calendars.createTitle')}</button></div>}
    </div>}
    {modal && (createMode || selected) && <EventDialog label={createMode ? t('calendars.createTitle') : nameOf(selected)} onClose={close} busy={busy}>
      <div className="cm-dialog" style={{ '--calendar-color': safeColor(createMode ? draft.color : selected.color) }}>
        <header className="cm-modal-header"><div><h2>{createMode ? (uk ? 'Новий календар' : 'New calendar') : (uk ? 'Керування календарем' : 'Manage calendar')}</h2>{!createMode && <p>{calendarRoleLabel(t, selected.role)}</p>}</div><button type="button" className="cm-icon-button" disabled={busy} onClick={close} aria-label={t('calendarView.event.cancel')}><Icon name="x" size={20}/></button></header>
        {!createMode && <nav className="cm-tabs" aria-label={uk ? 'Керування календарем' : 'Calendar management'}>{tabs.map(([id,icon,label]) => <button key={id} type="button" aria-pressed={modal.section === id} disabled={busy} onClick={() => switchSection(id)}><Icon name={icon} size={15}/>{label}</button>)}</nav>}
        {modalError && <p className="cm-error" role="alert">{modalError}</p>}
        {!createMode&&selected.isHolidayCalendar&&modal.section==='settings'?<div className="cm-form-body"><p>{t('calendarBasics.holidayNote')}</p><button type="button" className="cm-secondary" disabled={busy} onClick={()=>void toggleHoliday(selected)}><Icon name={selected.isArchived?'eye':'eye-off'} size={16}/>{t(selected.isArchived?'calendarBasics.show':'calendarBasics.hide')}</button></div>:null}
        {(createMode || modal.section === 'settings'&&!selected.isHolidayCalendar) && <CalendarForm draft={draft} setDraft={setDraft} calendar={selected} busy={busy} onSave={save} onClose={close}/>}
        {!createMode && canManage(selected) && <div className="cm-collaboration" hidden={modal.section === 'settings'}><CalendarCollaborationPanel key={selected.id} calendar={selected} section={modal.section}/></div>}
        {!createMode && modal.section === 'settings' && canManage(selected) && !selected.isMain && <div className="cm-danger"><button type="button" disabled={busy} onClick={() => void removeCalendar(selected)}>{t('calendars.delete')}</button></div>}
      </div>
    </EventDialog>}
  </section>;
}
