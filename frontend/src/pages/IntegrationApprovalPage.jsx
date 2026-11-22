import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';

function tokenFromHash() {
  return new URLSearchParams(window.location.hash.slice(1)).get('token');
}

function scopeLabel(t, scope) {
  const [resource, level] = scope.split(':');
  const resourceLabel = resource === 'calendar' ? t('integrations.resourceCalendar') : resource;
  const levelKey = { read: 'integrations.scopeRead', write: 'integrations.scopeWrite', delete: 'integrations.scopeDelete' }[level];
  return levelKey ? `${resourceLabel}: ${t(levelKey)}` : scope;
}

export function IntegrationApprovalPage() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const { localizedPath, t } = useLocale();
  const token = useRef(tokenFromHash()).current;
  const [request, setRequest] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    window.history.replaceState(window.history.state, '', localizedPath('/integrations/approve'));
  }, [localizedPath]);

  useEffect(() => {
    if (status !== 'authenticated' || !token || request || error) return;
    applicationContainer.integrationService.resolvePairing(token)
      .then((result) => setRequest(result.request))
      .catch((requestError) => setError(getLocalizedApiError(requestError, t, 'integrationApproval.invalid')));
  }, [error, request, status, t, token]);

  async function approve() {
    try {
      await applicationContainer.integrationService.approvePairing(request.id);
      navigate(localizedPath('/integrations'), { replace: true });
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'integrationApproval.approveError'));
    }
  }

  async function reject() {
    try {
      await applicationContainer.integrationService.rejectPairing(request.id);
      navigate(localizedPath('/'), { replace: true });
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'integrationApproval.rejectError'));
    }
  }

  const returnTo = `${localizedPath('/integrations/approve')}#token=${encodeURIComponent(token || '')}`;
  if (!token) return <PageTemplate><p role="alert">{t('integrationApproval.invalid')}</p></PageTemplate>;
  if (status === 'loading') return <PageTemplate><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (status !== 'authenticated') return <PageTemplate><p>{t('integrationApproval.signInBefore')}<Link to={localizedPath('/login')} state={{ returnTo }}>{t('common.signIn')}</Link>{t('integrationApproval.signInAfter')}</p></PageTemplate>;
  if (error) return <PageTemplate><p role="alert">{error}</p></PageTemplate>;
  if (!request) return <PageTemplate><p role="status">{t('common.loading')}</p></PageTemplate>;

  return (
    <section className="account-section">
      <h1>{t('integrationApproval.title')}</h1>
      <section className="account-card">
        <h2>{request.integration.name}</h2>
        <p>{request.scopes.map((scope) => scopeLabel(t, scope)).join(', ')}</p>
        <div className="button-row">
          <button type="button" onClick={() => { void approve(); }}>{t('integrationApproval.approve')}</button>
          <button type="button" className="danger-button" onClick={() => { void reject(); }}>{t('integrationApproval.reject')}</button>
        </div>
      </section>
    </section>
  );
}
