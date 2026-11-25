import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';
import { EventEditor } from '../features/events/EventEditor';
import { eventDayKey } from '../features/events/eventForm';
import { isCalendarDay } from '../features/events/calendarInteractions';
import { TablerIcon as Icon } from '../components/layout/TablerIcon';

export function CreateEventPage() {
  const { calendarId } = useParams();
  const { status } = useAuth();
  const { localizedPath, locale, t } = useLocale();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const back = localizedPath('/calendars/view/' + calendarId);
  const uk = locale === 'uk';
  useEffect(() => {
    if (status !== 'authenticated') return;
    let active = true;
    setCalendar(null); setLoading(true); setError('');
    applicationContainer.calendarService.get(calendarId)
      .then(({calendar: item}) => { if(active) setCalendar(item); })
      .catch(err => { if(active) setError(getLocalizedApiError(err,t,'calendarView.loadError')); })
      .finally(() => { if(active) setLoading(false); });
    return () => { active = false; };
  }, [calendarId,status,t]);
  const canEdit = calendar && !calendar.isArchived && !calendar.isHolidayCalendar && ['owner','admin','editor'].includes(calendar.role);
  const requested = new URLSearchParams(search).get('date');
  const initialDay = isCalendarDay(requested) ? requested : eventDayKey({startsAt:new Date()},calendar?.timeZone || 'UTC');
  function close() { if (!lock.current) navigate(back + '?date=' + encodeURIComponent(initialDay)); }
  async function save(values) {
    if (!canEdit || lock.current) return;
    lock.current=true;setSaving(true);
    try {
      await applicationContainer.calendarService.createEvent(calendarId,values);
      const savedDay=eventDayKey(values,calendar.timeZone||'UTC') || initialDay;
      navigate(back + '?date=' + encodeURIComponent(savedDay),{replace:true});
    } catch(err) {
      throw new Error(getLocalizedApiError(err,t,'calendarView.event.saveError'));
    } finally { lock.current=false;setSaving(false); }
  }
  return <section className="create-event-page">
    <Link className="create-event-back" to={back+'?date='+encodeURIComponent(initialDay)} onClick={e=>{if(saving)e.preventDefault();}}><Icon name="chevron-left" size={18}/>{uk?'До календаря':'Back to calendar'}</Link>
    {status==='loading'||status==='authenticated'&&loading ? <p role="status">{t('common.loading')}</p> : status!=='authenticated' ? <p><Link to={localizedPath('/login')} state={{returnTo:localizedPath('/calendars/view/'+calendarId+'/new')+search}}>{t('common.signIn')}</Link></p> : error ? <p role="alert">{error}</p> : !canEdit ? <p role="alert">{uk?'Немає дозволу на створення подій':'You do not have permission to create events'}</p> : <div className="calendar-editor-shell create-event-surface"><EventEditor key={calendar.id+initialDay} calendar={calendar} initialDay={initialDay} saving={saving} onSave={save} onCancel={close}/></div>}
  </section>;
}
