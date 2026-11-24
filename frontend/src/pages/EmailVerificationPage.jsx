import { FlowSurface } from '../components/layout/FlowSurface';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { ResendVerificationForm } from '../components/auth/ResendVerificationForm';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';

export function EmailVerificationPage() {
  const navigate = useNavigate();
  const attempted = useRef(false);
  const [status, setStatus] = useState('verification.checking');
  const [error, setError] = useState('');
  const { setAuthenticated } = useAuth();
  const { localizedPath, t } = useLocale();

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    // Prevent the one-time URL token from remaining in browser history/referrers.
    window.history.replaceState(window.history.state, '', localizedPath('/verify-email'));
    if (!token) {
      setStatus('');
      setError(t('verification.missingLink'));
      return;
    }
    applicationContainer.authService.verifyEmail(token)
      .then((result) => {
        setAuthenticated(result.user);
        navigate(localizedPath('/'), { replace: true });
      })
      .catch((requestError) => {
        setStatus('');
        setError(getLocalizedApiError(requestError, t, 'verification.failed'));
      });
  }, [localizedPath, navigate, setAuthenticated, t]);

  return (
    <FlowSurface title={t('verification.title')} icon={error ? 'x' : 'clock'} tone={error ? 'error' : ''}>
        {status && <p role="status">{t(status)}</p>}
        {error && <p role="alert">{error}</p>}
        {error && <ResendVerificationForm />}
        <div className="flow-actions"><Link className="flow-button" to={localizedPath('/login')}>{t('verification.goToLogin')}</Link></div>
    </FlowSurface>
  );
}
