import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';

export function AccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    applicationContainer.authService.getCurrentUser()
      .then((data) => { if (alive) setUser(data.user); })
      .catch((requestError) => { if (alive) setError(requestError.message || 'Unable to load account.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function handleLogout() {
    setError('');
    setSubmitting(true);
    try {
      await applicationContainer.authService.logout();
      navigate('/login', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign out.');
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Account</h1>
      {loading && <p role="status">Loading account...</p>}
      {user && <div>
        <p>Name: {user.name}</p>
        <p>Email: {user.email}</p>
        <p>Email verified: {user.emailVerified ? 'Yes' : 'No'}</p>
        <button type="button" onClick={handleLogout} disabled={submitting}>
          {submitting ? 'Signing out...' : 'Sign out'}
        </button>
      </div>}
      {error && <p role="alert">{error}</p>}
      {!loading && !user && <p><Link to="/login">Sign in</Link></p>}
    </main>
  );
}
