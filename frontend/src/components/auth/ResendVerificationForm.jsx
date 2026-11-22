import { useEffect, useState } from 'react';
import { applicationContainer } from '../../app/applicationContainer';
import { useLocale } from '../../i18n/LocaleProvider';
import { getLocalizedApiError } from '../../i18n/apiErrors';

export function ResendVerificationForm({ initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { t } = useLocale();

  useEffect(() => { setEmail(initialEmail); }, [initialEmail]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');
    setError('');
    try {
      const result = await applicationContainer.authService.resendVerification(email.trim());
      setStatus(t(`authMessages.${result.messageCode}`));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'resendVerification.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>{t('resendVerification.title')}</h2>
      <label htmlFor="resend-email">{t('common.email')}</label>
      <input id="resend-email" type="email" value={email} autoComplete="email" required
        onChange={(event) => setEmail(event.target.value)} />
      <button type="submit" disabled={submitting}>{submitting ? t('resendVerification.submitting') : t('resendVerification.submit')}</button>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
