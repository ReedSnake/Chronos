import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';

export function HomePage() {
  const navigate = useNavigate();
  const [lookupId, setLookupId] = useState('');
  const { status, user, error, refresh } = useAuth();

  if (status === 'loading') return <PageTemplate><p role="status">Loading...</p></PageTemplate>;
  if (status === 'anonymous') return <PageTemplate><p>Please <Link to="/login">sign in</Link> to access your workspace.</p></PageTemplate>;
  if (status === 'error') return (
    <PageTemplate>
      <p role="alert">{error || 'Unable to load your profile.'}</p>
      <button type="button" onClick={() => { void refresh(); }}>Try again</button>
    </PageTemplate>
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
