import { TaskCompletion, EventSymbol } from './CalendarEventActions';
import { useState } from 'react';
import { TablerIcon } from '../../components/layout/TablerIcon';
import './event-surface.css';
import { getLocalizedApiError } from '../../i18n/apiErrors';
import { useLocale } from '../../i18n/LocaleProvider';
import { eventDateLabel } from './eventForm';

export function EventDetails({ event, calendar, onClose, onEdit, onDelete, onQuickActions, canEdit, busy, onInvite }) {
  const { locale, t } = useLocale();
  const timeZone = calendar.timeZone || 'UTC';
  const [tab,setTab]=useState('info');
  const uk=locale==='uk';
  const stages=event.type==='task'?['todo','in_progress','done']:[];
  const [sending, setSending] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function invite(email) {
    setSending(email); setMessage(''); setError('');
    try { await onInvite(email); setMessage(t('eventInvitations.sent')); }
    catch (err) { setError(getLocalizedApiError(err, t, 'eventInvitations.sendError')); }
    finally { setSending(null); }
  }
  return <section className="account-card event-details" aria-label={t('calendarView.event.details')}>
    <header className="event-surface-header"><div className="event-surface-title"><EventSymbol event={event} size={20}/><div><h2>{event.title}</h2><p>{calendar.name} · {t('calendarView.type.'+event.type)}</p></div></div><button type="button" className="event-close" onClick={onClose} disabled={busy||Boolean(sending)} aria-label={t('calendarView.event.close')}><TablerIcon name="x" size={20}/></button></header>
    <div className="event-surface-tabs" role="group" aria-label={uk?'Розділи події':'Event sections'}>{[['info',uk?'Інформація':'Info'],['notes',uk?'Нотатки':'Notes']].map(([key,label])=><button key={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</div>
    <div className="event-surface-body" hidden={tab!=='info'}>
    {stages.length>0&&<div className="event-stage-track">{stages.map((status,i)=><span key={status} className={i<=stages.indexOf(event.status)?'reached':''} aria-current={event.status===status?'step':undefined}><i>{i<stages.indexOf(event.status)?<TablerIcon name="check" size={12}/>:i+1}</i>{t('statuses.'+status)}</span>)}</div>}
    <dl>
      <dt>{t('calendarView.event.type')}</dt><dd>{t(`calendarView.type.${event.type}`)}</dd>
      <dt>{t(`calendarView.event.${event.type === 'task' ? 'deadline' : event.type === 'reminder' ? 'remindAt' : event.type === 'holiday' ? 'date' : 'startsAt'}`)}</dt><dd>{eventDateLabel(event, locale, timeZone)}</dd>
      {event.endsAt && <><dt>{t('calendarView.event.endsAt')}</dt><dd>{new Date(event.endsAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone })}</dd></>}
      {event.status && <><dt>{t('calendarView.event.status')}</dt><dd>{t(`statuses.${event.status}`)}</dd></>}
      {event.isRecurring && <><dt>{t('calendarView.event.repeatLabel')}</dt><dd>{t(`calendarView.event.repeat.${event.recurrenceInterval}`)}{event.recurrenceEndDate ? ` · ${event.recurrenceEndDate.slice(0, 10)}` : ''}</dd></>}
      {event.locationUrl && <><dt>{t('calendarView.event.locationUrl')}</dt><dd><a href={event.locationUrl} target="_blank" rel="noopener noreferrer">{event.locationUrl}</a></dd></>}
      {event.internationalName && <><dt>{t('calendarView.event.internationalName')}</dt><dd>{event.internationalName}</dd></>}
      {event.categories?.length > 0 && <><dt>{t('calendarView.categories')}</dt><dd>{event.categories.join(', ')}</dd></>}
    </dl>

    <div><strong>{t('calendarView.event.attendees')}</strong>{event.attendees?.length ? <ul className="event-participants">{event.attendees.map((attendee) => <li key={attendee.email}><span className="event-participant-avatar" aria-hidden="true">{attendee.email.slice(0,1).toUpperCase()}</span><span className="event-participant-text">{attendee.email}<small>{t(`statuses.${attendee.inviteStatus || 'pending'}`)}</small></span>
      {canEdit && onInvite && attendee.inviteStatus !== 'accepted' && attendee.inviteStatus !== 'declined' && <button type="button" disabled={busy || Boolean(sending)} onClick={() => void invite(attendee.email)}>{t(sending === attendee.email ? 'eventInvitations.sending' : attendee.invitationSentAt ? 'eventInvitations.resend' : 'eventInvitations.send')}</button>}</li>)}</ul> : <p>{t('calendarView.event.noAttendees')}</p>}</div>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    </div><div className="event-surface-body" hidden={tab!=='notes'}><p className="event-notes">{event.description||(uk?'Нотаток поки немає':'No notes yet')}</p></div>
    {canEdit && <><div className="button-row event-surface-footer"><TaskCompletion event={event} large/>{onQuickActions&&<button type="button" disabled={busy||Boolean(sending)} onClick={onQuickActions}>{uk?'Дії':'Actions'}</button>}<button type="button" onClick={onEdit} disabled={busy}>{t('calendarView.event.edit')}</button><button type="button" className="danger-button" onClick={onDelete} disabled={busy}>{t('calendarView.event.delete')}</button></div>{event.isRecurring && <p className="field-note">{t('calendarView.event.editSeriesOnly')}</p>}</>}
  </section>;
}
