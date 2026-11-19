import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { ResendVerificationForm } from '../components/auth/ResendVerificationForm';
import { AuthPageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';

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
        setError(requestError.message || t('verification.failed'));
      });
  }, [localizedPath, navigate, setAuthenticated, t]);

  return (
    <AuthPageTemplate title={t('verification.title')}>
        {status && <p role="status">{t(status)}</p>}
        {error && <p role="alert">{error}</p>}
        {error && <ResendVerificationForm />}
        <p><Link to={localizedPath('/login')}>{t('verification.goToLogin')}</Link></p>
    </AuthPageTemplate>
  );
}
