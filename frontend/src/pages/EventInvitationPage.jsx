import { useEffect, useState } from 'react';
import { applicationContainer } from '../app/applicationContainer';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';

export function EventInvitationPage() {
  const { t, locale } = useLocale();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token'));
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  useEffect(() => {
    let active = true;
    if (!token) { setError('EVENT_INVITATION_INVALID'); return undefined; }
    applicationContainer.calendarService.previewEventInvitation(token)
      .then((result) => { if (active) setEvent(result.event); })
      .catch((err) => { if (active) setError(err.code || 'REQUEST_FAILED'); });
    return () => { active = false; };
  }, [token]);
  async function respond(response) {
    setBusy(true); setError('');
    try {
      const result = await applicationContainer.calendarService.respondEventInvitation(token, response);
      setAnswer(result.status);
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    } catch (err) { setError(err.code || 'REQUEST_FAILED'); }
    finally { setBusy(false); }
  }
  return <PageTemplate><section className="account-card">
    <h1>{t('eventInvitations.title')}</h1>
    {error && <p role="alert">{getLocalizedApiError({ code: error }, t, 'eventInvitations.invalid')}</p>}
    {answer ? <p role="status">{t(`eventInvitations.${answer}`)}</p> : event ? <>
      <h2>{event.title}</h2>
      <p>{t(`calendarView.type.${event.type}`)} · {event.type === 'holiday' ? event.startsAt.slice(0, 10) : new Date(event.startsAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</p>
      {event.isRecurring && <p>{t('eventInvitations.series')}</p>}
      <div className="button-row"><button type="button" disabled={busy} onClick={() => void respond('accepted')}>{t('eventInvitations.accept')}</button><button type="button" disabled={busy} onClick={() => void respond('declined')}>{t('eventInvitations.decline')}</button></div>
    </> : !error && <p role="status">{t('common.loading')}</p>}
  </section></PageTemplate>;
}
