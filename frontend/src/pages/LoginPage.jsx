import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { ResendVerificationForm } from '../components/auth/ResendVerificationForm';
import { InteractiveAuth, PasswordField } from '../components/auth/InteractiveAuth';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { setAuthenticated } = useAuth();
  const { localizedPath, t } = useLocale();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await applicationContainer.authService.login(email.trim(), password);
      setAuthenticated(result.user);
      const returnTo = typeof location.state?.returnTo === 'string' && location.state.returnTo.startsWith('/')
        ? location.state.returnTo
        : localizedPath('/');
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'login.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <InteractiveAuth title={t('login.title')} error={error}>
      {({ visible, setVisible, setFocus }) => <>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">{t('common.email')}</label>
          <input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          <label htmlFor="login-password">{t('login.password')}</label>
          <PasswordField id="login-password" visible={visible} setVisible={setVisible} setFocus={setFocus} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          <button type="submit" disabled={submitting}>{submitting ? t('login.submitting') : t('login.submit')}</button>
        </form>
        {error && <p role="alert">{error}</p>}
        <details><summary>{t('resendVerification.title')}</summary><ResendVerificationForm initialEmail={email} /></details>
        <p><Link to={localizedPath('/register')}>{t('login.createAccount')}</Link></p>
    </>}
    </InteractiveAuth>
  );
}
