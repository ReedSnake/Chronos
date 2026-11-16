import { Link, useLocation } from 'react-router-dom';

export function NotFoundPage() {
  const location = useLocation();

  return (
    <section className="page-content">
      <article className="status-card not-found" aria-live="polite">
        <p className="status-code">404</p>
        <h1>Page not found</h1>
        <p>No content is available for <code>{location.pathname}</code>.</p>
        <Link className="back-link" to="/">Return to connection status</Link>
      </article>
    </section>
  );
}
