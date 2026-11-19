import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { ResendVerificationForm } from '../components/auth/ResendVerificationForm';
import { AuthPageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { setAuthenticated } = useAuth();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await applicationContainer.authService.login(email.trim(), password);
      setAuthenticated(result.user);
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageTemplate title="Sign in">
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          <button type="submit" disabled={submitting}>{submitting ? 'Signing in...' : 'Sign in'}</button>
        </form>
        {error && <p role="alert">{error}</p>}
        <ResendVerificationForm initialEmail={email} />
        <p><Link to="/register">Create an account</Link></p>
    </AuthPageTemplate>
  );
}
