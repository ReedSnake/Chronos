import { useEffect, useState } from 'react';
import { applicationContainer } from '../../app/applicationContainer';
import { useLocale } from '../../i18n/LocaleProvider';
import { getLocalizedApiError } from '../../i18n/apiErrors';
import { DEFAULT_KEY_INPUT, KEY_SCOPE_OPTIONS, SCOPE_RESOURCES, scopeLabel, statusLabel } from './labels';

export function OwnedIntegrationsPanel() {
  const { t } = useLocale();
  const [integrations, setIntegrations] = useState([]);
  const [keys, setKeys] = useState({});
  const [editNames, setEditNames] = useState({});
  const [name, setName] = useState('');
  const [keyInputs, setKeyInputs] = useState({});
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    applicationContainer.integrationService.list()
      .then((result) => setIntegrations(result.integrations))
      .catch((error) => setError(getLocalizedApiError(error, t, 'integrations.loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  async function createIntegration(event) {
    event.preventDefault();
    try {
      const result = await applicationContainer.integrationService.create({ name: name.trim() });
      setIntegrations((current) => [result.integration, ...current]);
      setName('');
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'integrations.createError'));
    }
  }

  async function createKey(integrationId) {
    const values = keyInputs[integrationId] || DEFAULT_KEY_INPUT;
    try {
      const result = await applicationContainer.integrationService.createKey(integrationId, {
        label: values.label.trim(), scopes: [`${values.resource}:${values.level}`],
      });
      setNewKey(result.apiKey);
      setKeyInputs((current) => ({ ...current, [integrationId]: { ...DEFAULT_KEY_INPUT } }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'integrations.keyError'));
    }
  }

  async function updateIntegration(integration) {
    const nameValue = editNames[integration.id] ?? integration.name;
    try {
      const result = await applicationContainer.integrationService.update(integration.id, {
        name: nameValue.trim(),
        status: integration.status === 'active' ? 'disabled' : 'active',
      });
      setIntegrations((current) => current.map((item) => (item.id === integration.id ? result.integration : item)));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'integrations.updateError'));
    }
  }

  async function saveIntegrationName(integration) {
    try {
      const result = await applicationContainer.integrationService.update(integration.id, {
        name: (editNames[integration.id] ?? integration.name).trim(), status: integration.status,
      });
      setIntegrations((current) => current.map((item) => (item.id === integration.id ? result.integration : item)));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'integrations.updateError'));
    }
  }

  async function loadKeys(integrationId) {
    try {
      const result = await applicationContainer.integrationService.listKeys(integrationId);
      setKeys((current) => ({ ...current, [integrationId]: result.keys }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'integrations.keyError'));
    }
  }

  async function revokeKey(integrationId, keyId) {
    if (!window.confirm(t('integrations.confirmRevokeKey'))) return;
    try {
      await applicationContainer.integrationService.revokeKey(integrationId, keyId);
      setKeys((current) => ({
        ...current,
        [integrationId]: (current[integrationId] || []).map((key) =>
          key.id === keyId
            ? { ...key, status: 'revoked', revokedAt: new Date().toISOString() }
            : key
        ),
      }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'integrations.keyError'));
    }
  }

  if (loading) return <p role="status">{t('common.loading')}</p>;
  return (<>
      <form className="account-card account-form" onSubmit={createIntegration}>
        <h2>{t('integrations.createTitle')}</h2>
        <label htmlFor="integration-name">{t('integrations.name')}</label>
        <input id="integration-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
        <button type="submit">{t('integrations.create')}</button>
      </form>
      {newKey && <section className="account-card"><h2>{t('integrations.keyOnce')}</h2><input aria-label={t('integrations.keyOnce')} readOnly value={newKey} /></section>}
      {error && <p role="alert">{error}</p>}
      <h2>{t('integrations.owned')}</h2>
      {!integrations.length && <p>{t('integrations.emptyOwned')}</p>}
      {integrations.map((integration) => {
        const values = keyInputs[integration.id] || DEFAULT_KEY_INPUT;
        return (
          <section key={integration.id} className="account-card">
            <input aria-label={t('integrations.name')} value={editNames[integration.id] ?? integration.name}
              onChange={(event) => setEditNames((current) => ({ ...current, [integration.id]: event.target.value }))} maxLength={120} />
            <p>{statusLabel(t, integration.status)}</p>
            <div className="button-row"><button type="button" onClick={() => { void saveIntegrationName(integration); }}>{t('integrations.save')}</button><button type="button" onClick={() => { void updateIntegration(integration); }}>{integration.status === 'active' ? t('integrations.disable') : t('integrations.enable')}</button></div>
            <details className="account-form"><summary>{t('integrations.manageKeys')}</summary>
              <label htmlFor={`key-label-${integration.id}`}>{t('integrations.keyLabel')}</label>
              <input id={`key-label-${integration.id}`} value={values.label} maxLength={120}
                onChange={(event) => setKeyInputs((current) => ({ ...current, [integration.id]: { ...values, label: event.target.value } }))} />
              <label htmlFor={`key-resource-${integration.id}`}>{t('integrations.scopeResource')}</label>
              <select id={`key-resource-${integration.id}`} value={values.resource} onChange={(event) => setKeyInputs((current) => ({ ...current, [integration.id]: { ...values, resource: event.target.value } }))}>
                {SCOPE_RESOURCES.map((resource) => <option key={resource.value} value={resource.value}>{t(resource.labelKey)}</option>)}
              </select>
              <fieldset>
                <legend>{t('integrations.keyScope')}</legend>
                <p>{t('integrations.scopeHelp')}</p>
                {KEY_SCOPE_OPTIONS.map((option) => (
                  <label key={option.value} htmlFor={`key-scope-${integration.id}-${option.value}`}>
                    <input
                      id={`key-scope-${integration.id}-${option.value}`}
                      name={`key-scope-${integration.id}`}
                      type="radio"
                      value={option.value}
                      checked={values.level === option.value}
                      onChange={() => {
                        setKeyInputs((current) => ({
                          ...current,
                          [integration.id]: { ...values, level: option.value },
                        }));
                      }}
                    />
                    {t(option.labelKey)}
                  </label>
                ))}
              </fieldset>
              <button type="button" disabled={!values.label.trim()} onClick={() => { void createKey(integration.id); }}>{t('integrations.createKey')}</button>
              <button type="button" onClick={() => { void loadKeys(integration.id); }}>{t('integrations.showKeys')}</button>
              {(keys[integration.id] || []).map((key) => (
                <p key={key.id}>
                  {key.label} · {key.prefix} · {statusLabel(t, key.status)} · {t('integrations.keyAccess', { scope: scopeLabel(t, key.scopes) })}
                  {key.status !== 'revoked' && (
                    <button type="button" onClick={() => { void revokeKey(integration.id, key.id); }}>
                      {t('integrations.revokeKey')}
                    </button>
                  )}
                </p>
              ))}
            </details>
          </section>
        );
      })}
  </>);
}
