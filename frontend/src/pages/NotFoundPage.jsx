import { Link, useLocation } from 'react-router-dom';
import { PageTemplate } from '../components/layout/PageTemplate';

export function NotFoundPage() {
  const location = useLocation();

  return (
    <PageTemplate>
      <article className="status-card not-found" aria-live="polite">
        <p className="status-code">404</p>
        <h1>Page not found</h1>
        <p>No content is available for <code>{location.pathname}</code>.</p>
        <Link className="back-link" to="/">Return to home</Link>
      </article>
    </PageTemplate>
  );
}
