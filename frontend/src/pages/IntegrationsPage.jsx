import { useState } from 'react';
import { TablerIcon as Icon } from '../components/layout/TablerIcon';
import '../features/integrations/integrations.css';
import { Link } from 'react-router-dom';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { OwnedIntegrationsPanel } from '../features/integrations/OwnedIntegrationsPanel';
import { IntegrationConnectionsPanel } from '../features/integrations/IntegrationConnectionsPanel';

export function IntegrationsPage() {
  const { status } = useAuth();
  const { localizedPath, t, locale } = useLocale();
  const uk = locale === 'uk';
  const [createOpen, setCreateOpen] = useState(false);
  if (status === 'loading') return <PageTemplate><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (status !== 'authenticated') return <PageTemplate><p>{t('integrations.signInBefore')}<Link to={localizedPath('/login')}>{t('common.signIn')}</Link>{t('integrations.signInAfter')}</p></PageTemplate>;
  return (
    <section className="ig-page">
      <header className="ig-heading"><div><h1>{t('integrations.title')}</h1><p>{uk ? 'Керуйте інтеграціями та доступом до календарів' : 'Manage integrations and calendar access'}</p></div><button type="button" className="ig-primary" onClick={() => setCreateOpen(true)}><Icon name="plus" size={19}/>{t('integrations.createTitle')}</button></header>
      <div className="ig-layout">
        <OwnedIntegrationsPanel createOpen={createOpen} onCreateOpen={() => setCreateOpen(true)} onCreateClose={() => setCreateOpen(false)}/>
        <IntegrationConnectionsPanel />
      </div>
    </section>
  );
}
