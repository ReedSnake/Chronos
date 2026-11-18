import { useEffect, useState } from 'react';
import { applicationContainer } from '../../app/applicationContainer';

export function ResendVerificationForm({ initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setEmail(initialEmail); }, [initialEmail]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');
    setError('');
    try {
      const result = await applicationContainer.authService.resendVerification(email.trim());
      setStatus(result.message);
    } catch (requestError) {
      setError(requestError.message || 'Unable to resend the email.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Resend verification email</h2>
      <label htmlFor="resend-email">Email</label>{' '}
      <input id="resend-email" type="email" value={email} autoComplete="email" required
        onChange={(event) => setEmail(event.target.value)} />{' '}
      <button type="submit" disabled={submitting}>{submitting ? 'Sending...' : 'Resend'}</button>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
