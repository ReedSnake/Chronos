import { useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { ResendVerificationForm } from '../components/auth/ResendVerificationForm';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showResend, setShowResend] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()) ||
        password.length < 10 || new TextEncoder().encode(password).length > 72) {
      setError('Enter a name, a valid email, and a password of 10 characters to 72 bytes.');
      return;
    }
    setSubmitting(true);
    setError('');
    setStatus('');
    try {
      const result = await applicationContainer.authService.register({ name: name.trim(), email: email.trim(), password });
      setStatus(result.message);
      setShowResend(true);
      setPassword('');
    } catch (requestError) {
      setError(requestError.message || 'Registration failed.');
      if (requestError.statusCode === 409 || requestError.statusCode === 503) setShowResend(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
        <div><label htmlFor="register-name">Name</label> <input id="register-name" value={name}
          onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="name" /></div>
        <div><label htmlFor="register-email">Email</label> <input id="register-email" type="email" value={email}
          onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="email" /></div>
        <div><label htmlFor="register-password">Password</label> <input id="register-password" type="password" value={password}
          onChange={(event) => setPassword(event.target.value)} required minLength={10} autoComplete="new-password" /></div>
        <button type="submit" disabled={submitting}>{submitting ? 'Registering...' : 'Register'}</button>
      </form>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      {showResend && <ResendVerificationForm initialEmail={email} />}
      <p><Link to="/login">Already registered? Sign in</Link></p>
    </main>
  );
}
