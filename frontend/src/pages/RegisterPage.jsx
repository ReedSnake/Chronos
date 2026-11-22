import { useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { ResendVerificationForm } from '../components/auth/ResendVerificationForm';
import { AuthPageTemplate } from '../components/layout/PageTemplate';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const { localizedPath, t } = useLocale();

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()) ||
        password.length < 10 || new TextEncoder().encode(password).length > 72) {
      setError(t('register.validationError'));
      return;
    }
    setSubmitting(true);
    setError('');
    setStatus('');
    try {
      const result = await applicationContainer.authService.register({ name: name.trim(), email: email.trim(), password });
      setStatus(t(`authMessages.${result.messageCode}`));
      setShowResend(true);
      setPassword('');
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'register.error'));
      if (requestError.statusCode === 409 || requestError.statusCode === 503) setShowResend(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageTemplate title={t('register.title')}>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="register-name">{t('register.name')}</label>
          <input id="register-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="name" />
          <label htmlFor="register-email">{t('common.email')}</label>
          <input id="register-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="email" />
          <label htmlFor="register-password">{t('register.password')}</label>
          <input id="register-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} autoComplete="new-password" />
          <button type="submit" disabled={submitting}>{submitting ? t('register.submitting') : t('register.submit')}</button>
        </form>
        {status && <p role="status">{status}</p>}
        {error && <p role="alert">{error}</p>}
        {showResend && <ResendVerificationForm initialEmail={email} />}
        <p><Link to={localizedPath('/login')}>{t('register.signIn')}</Link></p>
    </AuthPageTemplate>
  );
}
