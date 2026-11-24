import { useEffect, useRef, useState } from 'react';
import { applicationContainer } from '../../app/applicationContainer';
import { useLocale } from '../../i18n/LocaleProvider';
import { getLocalizedApiError } from '../../i18n/apiErrors';
import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import { scopesLabel, statusLabel } from './labels';

export function IntegrationConnectionsPanel() {
  const { t, locale } = useLocale();
  const uk = locale === 'uk';
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
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

  async function run(action) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); } finally { lock.current = false; setBusy(false); }
  }
  const empty = (icon, label) => <div className="ig-empty ig-empty-small"><span className="ig-symbol"><Icon name={icon} size={20}/></span><p>{label}</p></div>;
  return <aside className="ig-connections">
    {error && <p className="ig-error" role="alert">{error} <button type="button" disabled={busy} onClick={() => void run(load)}>{uk ? 'Повторити' : 'Retry'}</button></p>}
    <section className="ig-section">
      <header className="ig-section-heading"><h2>{t('integrations.requests')}</h2><span>{loading || error ? '—' : requests.length}</span><button type="button" className="ig-refresh" disabled={busy || loading} onClick={() => void run(load)} aria-label={uk ? 'Оновити' : 'Refresh'}><Icon name="refresh" size={16}/></button></header>
      {loading ? <div className="ig-empty ig-skeleton" role="status" aria-label={t('common.loading')}><span/><span/></div> : !requests.length ? (!error && empty('bell', t('integrations.emptyRequests'))) : <div className="ig-list">
        {requests.map(request => <article key={request.id} className="ig-connection"><div className="ig-connection-info"><span className="ig-symbol ig-request-symbol"><Icon name="plug" size={19}/></span><div><h3>{request.integration.name}</h3><p>{statusLabel(t, request.status)}</p><small>{scopesLabel(t, request.scopes)}</small></div></div><div className="ig-connection-actions"><button type="button" className="ig-primary" disabled={busy} onClick={() => void run(() => respondToRequest(request, true))}>{t('integrations.approve')}</button><button type="button" className="ig-danger" disabled={busy} onClick={() => void run(() => respondToRequest(request, false))}>{t('integrations.reject')}</button></div></article>)}
      </div>}
    </section>
    <section className="ig-section">
      <header className="ig-section-heading"><h2>{t('integrations.connected')}</h2><span>{loading || error ? '—' : grants.length}</span></header>
      {loading ? <div className="ig-empty ig-skeleton" role="status" aria-label={t('common.loading')}><span/><span/></div> : !grants.length ? (!error && empty('lock', t('integrations.emptyConnected'))) : <div className="ig-list">{grants.map(grant => <article key={grant.id} className="ig-connection"><div className="ig-connection-info"><span className="ig-symbol"><Icon name="plug" size={19}/></span><div><h3>{grant.integration.name || t('integrations.unknown')}</h3><p>{statusLabel(t, grant.status)}</p><small>{scopesLabel(t, grant.scopes)}</small></div></div><div className="ig-connection-actions"><button type="button" className="ig-danger" disabled={busy} onClick={() => void run(() => revokeGrant(grant.id))}>{t('integrations.revoke')}</button></div></article>)}</div>}
    </section>
  </aside>;
}
