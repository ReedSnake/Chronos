import { Link } from 'react-router-dom';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { OwnedIntegrationsPanel } from '../features/integrations/OwnedIntegrationsPanel';
import { IntegrationConnectionsPanel } from '../features/integrations/IntegrationConnectionsPanel';

export function IntegrationsPage() {
  const { status } = useAuth();
  const { localizedPath, t } = useLocale();
  if (status === 'loading') return <PageTemplate><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (status !== 'authenticated') return <PageTemplate><p>{t('integrations.signInBefore')}<Link to={localizedPath('/login')}>{t('common.signIn')}</Link>{t('integrations.signInAfter')}</p></PageTemplate>;
  return (
    <section className="account-section">
      <h1>{t('integrations.title')}</h1>
      <OwnedIntegrationsPanel />
      <IntegrationConnectionsPanel />
    </section>
  );
}
