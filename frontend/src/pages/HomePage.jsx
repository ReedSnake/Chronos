import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';

export function HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lookupId, setLookupId] = useState('');

  useEffect(() => {
    let alive = true;
    setChecking(true);
    setLoadError('');
    setNeedsSignIn(false);
    setUser(null);

    applicationContainer.userService.getMe()
      .then(({ user: result }) => {
        if (!alive) return;
        if (result) setUser(result);
        else setLoadError('Unable to load your profile. Please try again.');
      })
      .catch((error) => {
        if (!alive) return;
        if (error?.statusCode === 401) setNeedsSignIn(true);
        else setLoadError(error?.message || 'Unable to load your profile.');
      })
      .finally(() => { if (alive) setChecking(false); });

    return () => { alive = false; };
  }, [retryCount]);

  if (checking) return <p role="status">Loading...</p>;
  if (needsSignIn) return <p>Please <Link to="/login">sign in</Link> to access your workspace.</p>;
  if (loadError) return (
    <section className="account-section">
      <p role="alert">{loadError}</p>
      <button type="button" onClick={() => setRetryCount((value) => value + 1)}>Try again</button>
    </section>
  );

  function findUser(event) {
    event.preventDefault();
    if (lookupId.trim()) navigate(`/users/${encodeURIComponent(lookupId.trim())}`);
  }

  return (
    <section className="account-section">
      <h1>Welcome to Chronos, {user.name}!</h1>
      <p>Your workspace is ready. Planner features will appear here as they are implemented.</p>
      <p><Link to="/account">Manage your account</Link></p>
      <form onSubmit={findUser} className="account-form">
        <label htmlFor="lookup-user">View another user's profile by ID</label>
        <input id="lookup-user" value={lookupId} onChange={(event) => setLookupId(event.target.value)}
          placeholder="MongoDB user ID" required />
        <button type="submit">View profile</button>
      </form>
    </section>
  );
}
