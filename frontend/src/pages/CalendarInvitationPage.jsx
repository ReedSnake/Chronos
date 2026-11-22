import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';

function tokenFromHash() {
  return new URLSearchParams(window.location.hash.slice(1)).get('token');
}

export function CalendarInvitationPage() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const { localizedPath, t } = useLocale();
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

  const returnTo = `${localizedPath('/calendar-invite')}#token=${encodeURIComponent(token || '')}`;
  if (status === 'loading' || (!ready && !error)) return <PageTemplate><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (error) return <PageTemplate><p role="alert">{error}</p></PageTemplate>;
  if (status !== 'authenticated') {
    return <PageTemplate><p>{t('calendarInvitation.signInBefore')}<Link to={localizedPath('/login')} state={{ returnTo }}>{t('common.signIn')}</Link>{t('calendarInvitation.signInAfter')} <Link to={localizedPath('/register')} state={{ returnTo }}>{t('calendarInvitation.register')}</Link>.</p></PageTemplate>;
  }
  return <PageTemplate><p role="status">{t('calendarInvitation.claiming')}</p></PageTemplate>;
}
