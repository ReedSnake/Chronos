import { FlowSurface } from '../components/layout/FlowSurface';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';

function tokenFromHash() {
  return new URLSearchParams(window.location.hash.slice(1)).get('token');
}

export function CalendarInvitationPage() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const { locale, localizedPath, t } = useLocale();
  const token = useRef(tokenFromHash()).current;
  const remembered = useRef(false);
  const claimed = useRef(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    window.history.replaceState(window.history.state, '', localizedPath('/calendar-invite'));
    if (!token) {
      setError(t('calendarInvitation.invalid'));
      return;
    }
    if (remembered.current) return;
    remembered.current = true;
    applicationContainer.calendarService.rememberInvitation(token)
      .then(() => setReady(true))
      .catch((requestError) => setError(getLocalizedApiError(requestError, t, 'calendarInvitation.invalid')));
  }, [localizedPath, t, token]);

  useEffect(() => {
    if (status !== 'authenticated' || !ready || claimed.current) return;
    claimed.current = true;
    applicationContainer.calendarService.claimInvitation()
      .then((result) => {
        if (result?.calendar) navigate(localizedPath('/calendars'), { replace: true });
      })
      .catch((requestError) => setError(getLocalizedApiError(requestError, t, 'calendarInvitation.claimError')));
  }, [navigate, ready, status, t, localizedPath]);

  const title = locale === 'uk' ? 'Запрошення до календаря' : 'Calendar invitation';
  const returnTo = `${localizedPath('/calendar-invite')}#token=${encodeURIComponent(token || '')}`;
  if (status === 'loading' || (!ready && !error)) return <FlowSurface title={title} icon="calendar-event"><p role="status">{t('common.loading')}</p></FlowSurface>;
  if (error) return <FlowSurface title={title} icon="x" tone="error"><p role="alert">{error}</p></FlowSurface>;
  if (status !== 'authenticated') {
    return <FlowSurface title={title} icon="calendar-event"><p className="flow-muted">{locale === 'uk' ? 'Увійдіть або створіть обліковий запис, щоб приєднатися до календаря' : 'Sign in or create an account to join the calendar'}</p><div className="flow-actions"><Link className="flow-button flow-primary" to={localizedPath('/login')} state={{ returnTo }}>{t('common.signIn')}</Link><Link className="flow-button" to={localizedPath('/register')} state={{ returnTo }}>{t('calendarInvitation.register')}</Link></div></FlowSurface>;
  }
  return <FlowSurface title={title} icon="calendar-event"><p role="status">{t('calendarInvitation.claiming')}</p></FlowSurface>;
}
