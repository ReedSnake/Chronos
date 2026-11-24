import { useLocale } from '../../i18n/LocaleProvider';
import { eventDateLabel } from './eventForm';

export function EventDetails({ event, calendar, onClose, onEdit, onDelete, canEdit, busy }) {
  const { locale, t } = useLocale();
  const timeZone = calendar.timeZone || 'UTC';
  return <section className="account-card event-details" aria-label={t('calendarView.event.details')}>
    <div className="event-details-heading"><h2>{event.title}</h2><button type="button" onClick={onClose}>{t('calendarView.event.close')}</button></div>
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
    {event.description && <p>{event.description}</p>}
    <div><strong>{t('calendarView.event.attendees')}</strong>{event.attendees?.length ? <ul>{event.attendees.map((attendee) => <li key={attendee.email}>{attendee.email}</li>)}</ul> : <p>{t('calendarView.event.noAttendees')}</p>}</div>
    {canEdit && <><div className="button-row"><button type="button" onClick={onEdit} disabled={busy}>{t('calendarView.event.edit')}</button><button type="button" className="danger-button" onClick={onDelete} disabled={busy}>{t('calendarView.event.delete')}</button></div>{event.isRecurring && <p className="field-note">{t('calendarView.event.editSeriesOnly')}</p>}</>}
  </section>;
}
