import { PublicHomePage } from './PublicHomePage';
import { BlobMascot } from '../components/auth/BlobMascot';
import { Dashboard } from '../features/dashboard/Dashboard';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';

export function HomePage() {
  const { status, user, error, refresh } = useAuth();
  const { t } = useLocale();

  if (status === 'loading') return <PageTemplate><BlobMascot mood="loading" compact /><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (status === 'anonymous') return <PublicHomePage />;
  if (status === 'error') return (
    <PageTemplate>
      <BlobMascot mood={navigator.onLine ? "error" : "offline"} compact />
      <p role="alert">{error || t('home.loadError')}</p>
      <button type="button" onClick={() => { void refresh(); }}>{t('common.retry')}</button>
    </PageTemplate>
  );

  return <Dashboard user={user} />;
}
