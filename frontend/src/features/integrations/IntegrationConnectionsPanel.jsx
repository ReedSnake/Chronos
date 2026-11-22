import { useEffect, useState } from 'react';
import { applicationContainer } from '../../app/applicationContainer';
import { useLocale } from '../../i18n/LocaleProvider';
import { getLocalizedApiError } from '../../i18n/apiErrors';
import { scopesLabel, statusLabel } from './labels';

export function IntegrationConnectionsPanel() {
  const { t } = useLocale();
  const [grants, setGrants] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [grantResult, requestResult] = await Promise.all([
        applicationContainer.integrationService.listGrants(),
        applicationContainer.integrationService.listRequests(),
      ]);
      setGrants(grantResult.grants);
      setRequests(requestResult.requests);
      setError('');
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'integrations.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [t]);

  async function revokeGrant(id) {
    try {
      await applicationContainer.integrationService.revokeGrant(id);
      setGrants((current) => current.filter((grant) => grant.id !== id));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'integrations.revokeError'));
    }
  }

  async function respondToRequest(request, accepted) {
    try {
      if (accepted) await applicationContainer.integrationService.approvePairing(request.id);
      else await applicationContainer.integrationService.rejectPairing(request.id);
      setRequests((current) => current.filter((item) => item.id !== request.id));
      if (accepted) await load();
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'integrations.requestError'));
    }
  }

  if (loading) return <p role="status">{t('common.loading')}</p>;
  return (<>
    {error && <p role="alert">{error}</p>}
      <h2>{t('integrations.requests')}</h2>
      {!requests.length && <p>{t('integrations.emptyRequests')}</p>}
      {requests.map((request) => <section key={request.id} className="account-card"><h3>{request.integration.name}</h3><p>{statusLabel(t, request.status)} · {scopesLabel(t, request.scopes)}</p><div className="button-row"><button type="button" onClick={() => { void respondToRequest(request, true); }}>{t('integrations.approve')}</button><button type="button" className="danger-button" onClick={() => { void respondToRequest(request, false); }}>{t('integrations.reject')}</button></div></section>)}
      <h2>{t('integrations.connected')}</h2>
      {!grants.length && <p>{t('integrations.emptyConnected')}</p>}
      {grants.map((grant) => (
        <section key={grant.id} className="account-card">
          <h3>{grant.integration.name || t('integrations.unknown')}</h3>
          <p>{statusLabel(t, grant.status)} · {scopesLabel(t, grant.scopes)}</p>
          <button type="button" className="danger-button" onClick={() => { void revokeGrant(grant.id); }}>{t('integrations.revoke')}</button>
        </section>
      ))}
  </>);
}
