import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { ResendVerificationForm } from '../components/auth/ResendVerificationForm';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await applicationContainer.authService.login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form onSubmit={handleSubmit}>
        <div><label htmlFor="login-email">Email</label> <input id="login-email" type="email" value={email}
          onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></div>
        <div><label htmlFor="login-password">Password</label> <input id="login-password" type="password" value={password}
          onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></div>
        <button type="submit" disabled={submitting}>{submitting ? 'Signing in...' : 'Sign in'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <ResendVerificationForm initialEmail={email} />
      <p><Link to="/register">Create an account</Link></p>
    </main>
  );
}
