import { TablerIcon } from '../components/layout/TablerIcon';
import { FlowSurface } from '../components/layout/FlowSurface';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
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
  if (!token) return <FlowSurface title={t('integrationApproval.title')} icon="plug"><p role="alert">{t('integrationApproval.invalid')}</p></FlowSurface>;
  if (status === 'loading') return <FlowSurface title={t('integrationApproval.title')} icon="plug"><p role="status">{t('common.loading')}</p></FlowSurface>;
  if (status !== 'authenticated') return <FlowSurface title={t('integrationApproval.title')} icon="plug"><p>{t('integrationApproval.signInBefore')}<Link to={localizedPath('/login')} state={{ returnTo }}>{t('common.signIn')}</Link>{t('integrationApproval.signInAfter')}</p></FlowSurface>;
  if (error) return <FlowSurface title={t('integrationApproval.title')} icon="plug"><p role="alert">{error}</p></FlowSurface>;
  if (!request) return <FlowSurface title={t('integrationApproval.title')} icon="plug"><p role="status">{t('common.loading')}</p></FlowSurface>;

  return (
    <FlowSurface title={t('integrationApproval.title')} icon="plug">
      <div className="flow-summary"><h2>{request.integration.name}</h2><ul className="flow-permissions">{request.scopes.map(scope => <li key={scope}><TablerIcon name="lock" size={16}/>{scopeLabel(t, scope)}</li>)}</ul></div>
        <div className="button-row">
          <button type="button" className="flow-primary" onClick={() => { void approve(); }}>{t('integrationApproval.approve')}</button>
          <button type="button" className="flow-danger" onClick={() => { void reject(); }}>{t('integrationApproval.reject')}</button>
        </div>
    </FlowSurface>
  );
}
