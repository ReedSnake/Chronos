import { Link, useLocation } from 'react-router-dom';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useLocale } from '../i18n/LocaleProvider';

export function NotFoundPage() {
  const location = useLocation();
  const { localizedPath, t } = useLocale();

  return (
    <PageTemplate>
      <article className="not-found-card" aria-live="polite">
        <p className="not-found-code">404</p>
        <h1>{t('notFound.title')}</h1>
        <p>{t('notFound.description', { path: location.pathname })}</p>
        <Link className="back-link" to={localizedPath('/')}>{t('notFound.back')}</Link>
      </article>
    </PageTemplate>
  );
}
