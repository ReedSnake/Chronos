import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { ResendVerificationForm } from '../components/auth/ResendVerificationForm';

export function EmailVerificationPage() {
  const navigate = useNavigate();
  const attempted = useRef(false);
  const [status, setStatus] = useState('Verifying your email...');
  const [error, setError] = useState('');

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    // Prevent the one-time URL token from remaining in browser history/referrers.
    window.history.replaceState(window.history.state, '', '/verify-email');
    if (!token) {
      setStatus('');
      setError('Verification link is missing.');
      return;
    }
    applicationContainer.authService.verifyEmail(token)
      .then(() => navigate('/', { replace: true }))
      .catch((requestError) => {
        setStatus('');
        setError(requestError.message || 'Email verification failed.');
      });
  }, [navigate]);

  return (
    <main>
      <h1>Email verification</h1>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      {error && <ResendVerificationForm />}
      <p><Link to="/login">Go to sign in</Link></p>
    </main>
  );
}
