import { useMemo, useState } from 'react';
import { TablerIcon } from '../../components/layout/TablerIcon';
import './event-surface.css';
import { useLocale } from '../../i18n/LocaleProvider';
import { buildEventPayload, defaultEventDraft, draftFromEvent, EVENT_TYPES, RECURRENCE_INTERVALS } from './eventForm';

export function EventEditor({ event = null, calendar, saving, onSave, onCancel, initialType = 'arrangement' }) {
  const { t, locale } = useLocale();
  const uk = locale === 'uk';
  const [tab, setTab] = useState('info');
  const timeZone = calendar.timeZone || 'UTC';
  const [draft, setDraft] = useState(() => event ? draftFromEvent(event, timeZone)
    : defaultEventDraft(initialType, timeZone, calendar.defaultEventDurationMinutes));
  const [formError, setFormError] = useState('');
  const isEditing = Boolean(event);
  const copy = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const typeOptions = useMemo(() => EVENT_TYPES.map((type) => ({ type, label: t(`calendarView.type.${type}`) })), [t]);

  function changeType(type) {
    setDraft((current) => ({ ...defaultEventDraft(type, timeZone, calendar.defaultEventDurationMinutes),
      title: current.title, description: current.description, color: current.color,
      attendeesText: current.attendeesText, categoriesText: current.categoriesText,
    }));
  }

  async function submit(action) {
    action.preventDefault();
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

  return <form className="account-card account-form event-editor" onSubmit={submit} onInvalidCapture={()=>setTab('info')} aria-label={t('calendarView.event.editorTitle')}>
    <header className="event-surface-header"><div className="event-surface-title"><span className="event-surface-symbol"><TablerIcon name={draft.type==='task'?'checkbox':draft.type==='reminder'?'bell':'calendar-event'} size={24}/></span><div><h2>{t(isEditing ? 'calendarView.event.edit' : 'calendarView.event.create')}</h2><p>{calendar.name} · {timeZone}</p></div></div><button type="button" className="event-close" onClick={onCancel} disabled={saving} aria-label={t('calendarView.event.close')}>×</button></header>
    <div className="event-surface-tabs" role="group" aria-label={uk?'Розділи події':'Event sections'}>{[['info',uk?'Інформація':'Info'],['notes',uk?'Нотатки':'Notes']].map(([key,label])=><button key={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</div>
    {isEditing && event.isRecurring && <p>{t('calendarView.event.editSeriesOnly')}</p>}
    {formError && <p role="alert">{formError}</p>}
    <div className="event-surface-body" hidden={tab!=='info'}><label>{t('calendarView.event.type')}
      <select value={draft.type} disabled={isEditing || saving || initialType==='task'} onChange={(e) => changeType(e.target.value)}>
        {typeOptions.map(({ type, label }) => <option value={type} key={type}>{label}</option>)}
      </select>
    </label>
    <label>{t('calendarView.event.title')}<input value={draft.title} onChange={(e) => copy('title', e.target.value)} maxLength={200} required /></label>
    <label>{t('calendarView.event.color')}<input type="color" value={draft.color} onChange={(e) => copy('color', e.target.value.toUpperCase())} /></label>
    {draft.type === 'arrangement' && <>
      <div className="event-field-pair"><label>{t('calendarView.event.startsAt')}<input type="datetime-local" value={draft.startsAt} onChange={(e) => copy('startsAt', e.target.value)} required /></label>
      <label>{t('calendarView.event.endsAt')}<input type="datetime-local" value={draft.endsAt} onChange={(e) => copy('endsAt', e.target.value)} required /></label></div>
      <label>{t('calendarView.event.locationUrl')}<input type="url" value={draft.locationUrl} onChange={(e) => copy('locationUrl', e.target.value)} maxLength={2000} placeholder="https://" /></label>
      <label>{t('calendarView.event.status')}<select value={draft.status} onChange={(e) => copy('status', e.target.value)}><option value="scheduled">{t('statuses.scheduled')}</option><option value="canceled">{t('statuses.canceled')}</option></select></label>
    </>}
    {draft.type === 'task' && <>
      <label>{t('calendarView.event.deadline')}<input type="datetime-local" value={draft.deadline} onChange={(e) => copy('deadline', e.target.value)} required /></label>
      <label>{t('calendarView.event.status')}<select value={draft.status} onChange={(e) => copy('status', e.target.value)}><option value="todo">{t('statuses.todo')}</option><option value="in_progress">{t('statuses.in_progress')}</option><option value="done">{t('statuses.done')}</option></select></label>
    </>}
    {draft.type === 'reminder' && <label>{t('calendarView.event.remindAt')}<input type="datetime-local" value={draft.remindAt} onChange={(e) => copy('remindAt', e.target.value)} required /></label>}
    {draft.type === 'holiday' && <>
      <label>{t('calendarView.event.date')}<input type="date" value={draft.date} onChange={(e) => copy('date', e.target.value)} required /></label>
      <label>{t('calendarView.event.internationalName')}<input value={draft.internationalName} onChange={(e) => copy('internationalName', e.target.value)} maxLength={200} required /></label>
    </>}
    <label>{t('calendarView.event.attendees')}<textarea value={draft.attendeesText} onChange={(e) => copy('attendeesText', e.target.value)} rows={2} placeholder={t('calendarView.event.attendeesHint')} /></label>
    <p className="field-note">{t('calendarView.event.attendeesNote')}</p>
    <details className="event-advanced" open={draft.isRecurring||undefined}><summary>{uk?'Додаткові налаштування':'More options'}</summary><label>{t('calendarView.categories')}<input value={draft.categoriesText} onChange={(e) => copy('categoriesText', e.target.value)} placeholder={t('calendarView.categoriesPlaceholder')} /></label>
    <label className="event-checkbox"><input type="checkbox" checked={draft.isRecurring} onChange={(e) => copy('isRecurring', e.target.checked)} />{t('calendarView.event.isRecurring')}</label>
    {draft.isRecurring && <>
      <label>{t('calendarView.event.recurrenceInterval')}<select value={draft.recurrenceInterval} onChange={(e) => copy('recurrenceInterval', e.target.value)}>{RECURRENCE_INTERVALS.map((interval) => <option key={interval} value={interval}>{t(`calendarView.event.repeat.${interval}`)}</option>)}</select></label>
      <label>{t('calendarView.event.recurrenceEndDate')}<input type="date" value={draft.recurrenceEndDate} onChange={(e) => copy('recurrenceEndDate', e.target.value)} /></label>
      <p className="field-note">{t('calendarView.event.seriesNote')}</p>
    </>}
    </details></div>
    <div className="event-surface-body" hidden={tab!=='notes'}><label>{t('calendarView.event.description')}<textarea value={draft.description} onChange={(e) => copy('description', e.target.value)} maxLength={4000} rows={7}/></label></div>
    <div className="button-row event-surface-footer"><button type="submit" disabled={saving}>{saving ? t('common.loading') : t('calendarView.event.save')}</button><button type="button" onClick={onCancel} disabled={saving}>{t('calendarView.event.cancel')}</button></div>
  </form>;
}
