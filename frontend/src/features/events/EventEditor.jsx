import { useMemo, useState } from 'react';
import { TablerIcon } from '../../components/layout/TablerIcon';
import './event-surface.css';
import { useLocale } from '../../i18n/LocaleProvider';
import { buildEventPayload, defaultEventDraft, draftFromEvent, EVENT_TYPES, RECURRENCE_INTERVALS } from './eventForm';

export function EventEditor({ event = null, calendar, saving, onSave, onCancel, initialType = 'arrangement', initialDay = null, initialStatus = 'todo' }) {
  const { t, locale } = useLocale();
  const uk = locale === 'uk';
  const [tab, setTab] = useState('info');
  const timeZone = calendar.timeZone || 'UTC';
  function makeDraft(type) {
    const value=defaultEventDraft(type,timeZone,calendar.defaultEventDurationMinutes);
    if(type==='task'&&['todo','in_progress','done'].includes(initialStatus))value.status=initialStatus;
    value.color=/^#[0-9a-f]{6}$/i.test(calendar.color||'')?calendar.color.toUpperCase():'#F5BC5A';
    if(initialDay){
      const delta=Math.round((Date.parse(initialDay+'T00:00:00Z')-Date.parse(value.date+'T00:00:00Z'))/86400000);
      for(const field of ['startsAt','endsAt','deadline','remindAt']){
        const date=new Date(value[field].slice(0,10)+'T00:00:00Z');
        date.setUTCDate(date.getUTCDate()+delta);
        value[field]=date.toISOString().slice(0,10)+value[field].slice(10);
      }
      value.date=initialDay;
    }
    return value;
  }
  const [draft, setDraft] = useState(() => event ? draftFromEvent(event, timeZone) : makeDraft(initialType));
  const [formError, setFormError] = useState('');
  const isEditing = Boolean(event);
  const copy = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const typeOptions = useMemo(() => EVENT_TYPES.map((type) => ({ type, label: t(`calendarView.type.${type}`) })), [t]);

  function changeType(type) {
    setDraft((current) => ({ ...makeDraft(type),
      title: current.title, description: current.description, color: current.color,
      attendeesText: current.attendeesText, categoriesText: current.categoriesText,
    }));
  }

  async function submit(action) {
    action.preventDefault();
    if(saving)return;
    setFormError('');
    try {
      const payload = buildEventPayload(draft, timeZone);
      if (isEditing) delete payload.type; // An event keeps its type and series ID.
      await onSave(payload);
    } catch (error) {
      const key = `calendarView.event.${error.message}`;
      setTab('info');
      setFormError(t(key) === key ? (error.message || t('calendarView.event.saveError')) : t(key));
    }
  }

  const task=draft.type==='task';
  const title=task?(isEditing?(uk?'Редагувати завдання':'Edit task'):(uk?'Нове завдання':'New task')):t(isEditing?'calendarView.event.edit':'calendarView.event.create');
  const emails=[...new Set(draft.attendeesText.split(/[\s,;]+/).filter(Boolean))];
  function datePart(field,part,value){
    const [date='',time='']=draft[field].split('T');
    copy(field,part==='date'?value+'T'+time:date+'T'+value);
  }
  function dateTimeField(field,label){
    const [date='',time='']=draft[field].split('T');
    return <div className="event-date-group"><span className="event-field-label">{label}</span><label className="event-icon-field"><TablerIcon name="calendar" size={19}/><input type="date" aria-label={label+' '+(uk?'дата':'date')} value={date} onChange={e=>datePart(field,'date',e.target.value)} required/></label><label className="event-icon-field"><TablerIcon name="clock" size={19}/><input type="time" aria-label={label+' '+(uk?'час':'time')} value={time} onChange={e=>datePart(field,'time',e.target.value)} required/></label></div>;
  }
  return <form className="account-card account-form event-editor event-editor-refined" onSubmit={submit} onInvalidCapture={()=>setTab('info')} aria-label={t('calendarView.event.editorTitle')}>
    <header className="event-surface-header"><div className="event-surface-title"><span className="event-surface-symbol"><TablerIcon name={draft.type==='task'?'checkbox':draft.type==='reminder'?'bell':'calendar-event'} size={24}/></span><div><h2>{title}</h2><p>{calendar.name} · {timeZone}</p></div></div><button type="button" className="event-close" onClick={onCancel} disabled={saving} aria-label={t('calendarView.event.close')}><TablerIcon name="x" size={20}/></button></header>
    <div className="event-surface-tabs" role="group" aria-label={uk?'Розділи події':'Event sections'}>{[['info',uk?'Інформація':'Info'],['notes',uk?'Нотатки':'Notes']].map(([key,label])=><button key={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</div>
    {isEditing && event.isRecurring && <p>{t('calendarView.event.editSeriesOnly')}</p>}
    {formError && <p role="alert">{formError}</p>}
    <div className="event-surface-body" hidden={tab!=='info'}>{!isEditing&&initialType!=='task'&&<label>{t('calendarView.event.type')}
      <select value={draft.type} disabled={isEditing || saving || initialType==='task'} onChange={(e) => changeType(e.target.value)}>
        {typeOptions.map(({ type, label }) => <option value={type} key={type}>{label}</option>)}
      </select>
    </label>}
    <label>{t('calendarView.event.title')}<input className="event-title-input" value={draft.title} onChange={(e) => copy('title', e.target.value)} placeholder={task?(uk?'Назва завдання':'Task name'):(uk?'Назва події':'Event name')} maxLength={200} required /></label>
    {draft.type === 'arrangement' && <>
      {dateTimeField('startsAt',t('calendarView.event.startsAt'))}
      {dateTimeField('endsAt',t('calendarView.event.endsAt'))}
      <label>{t('calendarView.event.locationUrl')}<input type="url" value={draft.locationUrl} onChange={(e) => copy('locationUrl', e.target.value)} maxLength={2000} placeholder="https://" /></label>
      <label>{t('calendarView.event.status')}<select value={draft.status} onChange={(e) => copy('status', e.target.value)}><option value="scheduled">{t('statuses.scheduled')}</option><option value="canceled">{t('statuses.canceled')}</option></select></label>
    </>}
    {draft.type === 'task' && <>
      {dateTimeField('deadline',t('calendarView.event.deadline'))}
      <label>{t('calendarView.event.status')}<select value={draft.status} onChange={(e) => copy('status', e.target.value)}><option value="todo">{t('statuses.todo')}</option><option value="in_progress">{t('statuses.in_progress')}</option><option value="done">{t('statuses.done')}</option></select></label>
    </>}
    {draft.type === 'reminder' && dateTimeField('remindAt',t('calendarView.event.remindAt'))}
    {draft.type === 'holiday' && <>
      <label>{t('calendarView.event.date')}<input type="date" value={draft.date} onChange={(e) => copy('date', e.target.value)} required /></label>
      <label>{t('calendarView.event.internationalName')}<input value={draft.internationalName} onChange={(e) => copy('internationalName', e.target.value)} maxLength={200} required /></label>
    </>}
    <div className="event-attendee-group"><label className="event-field-label" htmlFor="event-attendee-input">{t('calendarView.event.attendees')}</label><div className="event-attendee-box"><div className="event-attendee-input"><TablerIcon name="users" size={19}/><textarea id="event-attendee-input" value={draft.attendeesText} onChange={e=>copy('attendeesText',e.target.value)} rows={2} placeholder={t('calendarView.event.attendeesHint')}/></div>{emails.length>0&&<div className="event-attendee-chips">{emails.map(email=><span className="event-email-chip" key={email}><i>{email.slice(0,1).toUpperCase()}</i><span>{email}</span><button type="button" aria-label={(uk?'Видалити ':'Remove ')+email} onClick={()=>copy('attendeesText',emails.filter(item=>item!==email).join(', '))}><TablerIcon name="x" size={13}/></button></span>)}</div>}</div></div>
    <p className="field-note">{t('calendarView.event.attendeesNote')}</p>
    <details className="event-advanced" open={draft.isRecurring||undefined}><summary>{uk?'Додаткові налаштування':'More options'}</summary><label className="event-color-field">{t('calendarView.event.color')}<input type="color" value={draft.color} onChange={e=>copy('color',e.target.value.toUpperCase())}/></label><label>{t('calendarView.categories')}<input value={draft.categoriesText} onChange={(e) => copy('categoriesText', e.target.value)} placeholder={t('calendarView.categoriesPlaceholder')} /></label>
    <label className="event-checkbox"><input type="checkbox" checked={draft.isRecurring} onChange={(e) => copy('isRecurring', e.target.checked)} />{t('calendarView.event.isRecurring')}</label>
    {draft.isRecurring && <>
      <label>{t('calendarView.event.recurrenceInterval')}<select value={draft.recurrenceInterval} onChange={(e) => copy('recurrenceInterval', e.target.value)}>{RECURRENCE_INTERVALS.map((interval) => <option key={interval} value={interval}>{t(`calendarView.event.repeat.${interval}`)}</option>)}</select></label>
      <label>{t('calendarView.event.recurrenceEndDate')}<input type="date" value={draft.recurrenceEndDate} onChange={(e) => copy('recurrenceEndDate', e.target.value)} /></label>
      <p className="field-note">{t('calendarView.event.seriesNote')}</p>
    </>}
    </details></div>
    <div className="event-surface-body" hidden={tab!=='notes'}><label>{t('calendarView.event.description')}<textarea value={draft.description} onChange={(e) => copy('description', e.target.value)} maxLength={4000} rows={7} placeholder={uk?'Додати деталі…':'Add details…'}/></label></div>
    <div className="button-row event-surface-footer"><button type="button" onClick={onCancel} disabled={saving}>{t('calendarView.event.cancel')}</button><button type="submit" disabled={saving}>{saving?t('common.loading'):isEditing?t('calendarView.event.save'):task?(uk?'Створити завдання':'Create task'):(uk?'Створити подію':'Create event')}</button></div>
  </form>;
}
