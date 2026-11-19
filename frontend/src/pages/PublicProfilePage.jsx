import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';

export function PublicProfilePage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    applicationContainer.userService.getById(id)
      .then(({ user: result }) => { if (alive) setUser(result); })
      .catch((requestError) => { if (alive) setError(requestError.message || 'Profile not found'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  return (
    <section className="account-section">
      <h1>User profile</h1>
      {loading && <p role="status">Loading...</p>}
      {error && <p role="alert">{error} <Link to="/login">Sign in</Link></p>}
      {user && <>
        {user.avatarUrl && <img className="profile-avatar" alt="Profile avatar"
          src={applicationContainer.userService.imageUrl(user.avatarUrl)} />}
        <p><strong>{user.name}</strong></p>
        <p>{user.bio || 'No biography yet.'}</p>
        {user.country && <p>Country: {user.country}</p>}
        {user.createdAt && <p>Member since: {new Date(user.createdAt).toLocaleDateString()}</p>}
      </>}
      <p><Link to="/">Back to home</Link></p>
    </section>
  );
}
