import { useEffect, useRef, useState } from 'react';
import { applicationContainer } from '../../app/applicationContainer';
import { useLocale } from '../../i18n/LocaleProvider';
import { getLocalizedApiError } from '../../i18n/apiErrors';
import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import { EventDialog } from '../events/EventDialog';
import { DEFAULT_KEY_INPUT, KEY_SCOPE_OPTIONS, SCOPE_RESOURCES, scopeLabel, statusLabel } from './labels';

export function OwnedIntegrationsPanel({ createOpen, onCreateClose, onCreateOpen }) {
  const { t, locale } = useLocale();
  const uk = locale === 'uk';
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [tab, setTab] = useState('settings');
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
      onCreateClose();
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
      await loadKeys(integrationId);
      setKeyInputs((current) => ({ ...current, [integrationId]: { ...DEFAULT_KEY_INPUT } }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'integrations.keyError'));
    }
  }

  async function updateIntegration(integration) {
    try {
      const result = await applicationContainer.integrationService.update(integration.id, {
        name: integration.name,
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

  async function run(action) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); } finally { lock.current = false; setBusy(false); }
  }
  function close() {
    if (lock.current) return;
    setSelectedId(null); setNewKey(''); setError('');
  }
  function open(integration) {
    setSelectedId(integration.id); setTab('settings'); setNewKey(''); setError('');
    setEditNames(current => ({ ...current, [integration.id]: integration.name }));
  }
  const selected = integrations.find(item => item.id === selectedId);
  const values = selected ? keyInputs[selected.id] || DEFAULT_KEY_INPUT : DEFAULT_KEY_INPUT;
  const changeKey = (field, value) => setKeyInputs(current => ({ ...current, [selected.id]: { ...values, [field]: value } }));
  const status = integration => <span className={'ig-status ' + (integration.status === 'active' ? 'active' : '')}><i/>{statusLabel(t, integration.status)}</span>;
  return <section className="ig-owned">
    <header className="ig-section-heading"><h2>{t('integrations.owned')}</h2><span>{loading ? '—' : integrations.length}</span></header>
    {error && !createOpen && !selected && <p className="ig-error" role="alert">{error}</p>}
    {loading ? <div className="ig-cards" role="status" aria-label={t('common.loading')}>{[0,1].map(i => <div key={i} className="ig-card ig-skeleton"><i/><span/><span/></div>)}</div> : integrations.length ? <div className="ig-cards">
      {integrations.map(integration => <article className="ig-card" key={integration.id}>
        <div className="ig-card-top"><span className="ig-symbol"><Icon name="plug" size={23}/></span>{status(integration)}</div>
        <h3>{integration.name}</h3>
        <div className="ig-card-bottom"><button type="button" onClick={() => open(integration)}><Icon name="settings" size={16}/>{uk ? 'Керування' : 'Manage'}</button></div>
      </article>)}
    </div> : <div className="ig-empty ig-empty-owned"><span className="ig-symbol"><Icon name="plug" size={26}/></span><h3>{t('integrations.emptyOwned')}</h3><p>{uk ? 'Створіть інтеграцію, щоб керувати доступом через API.' : 'Create an integration to manage access through the API.'}</p><button className="ig-primary" type="button" onClick={onCreateOpen}><Icon name="plus" size={16}/>{t('integrations.create')}</button></div>}
    {createOpen && <EventDialog label={t('integrations.createTitle')} busy={busy} onClose={() => { if (!lock.current) { setName(''); setError(''); onCreateClose(); } }}>
      <form className="ig-dialog" onSubmit={e => { e.preventDefault(); if (name.trim()) void run(() => createIntegration(e)); }}>
        <header className="ig-dialog-header"><h2>{t('integrations.createTitle')}</h2><button type="button" className="ig-close" disabled={busy} aria-label={t('calendarView.event.close')} onClick={() => { setName(''); setError(''); onCreateClose(); }}><Icon name="x" size={19}/></button></header>
        <div className="ig-identity"><span className="ig-symbol"><Icon name="plug" size={27}/></span><div><input className="ig-name" aria-label={t('integrations.name')} autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={t('integrations.name')} maxLength={120} required/><p>{uk ? 'Назва вашого застосунку або сервісу' : 'Name of your application or service'}</p></div></div>
        {error && <p className="ig-error" role="alert">{error}</p>}
        <div className="ig-note"><Icon name="lock" size={17}/><p>{uk ? 'Ключі API та дозволи можна налаштувати після створення.' : 'API keys and permissions can be configured after creation.'}</p></div>
        <footer className="ig-dialog-footer"><button type="button" disabled={busy} onClick={() => { setName(''); setError(''); onCreateClose(); }}>{t('calendarView.event.cancel')}</button><button className="ig-primary" type="submit" disabled={busy || !name.trim()}>{busy ? t('common.loading') : t('integrations.create')}</button></footer>
      </form>
    </EventDialog>}
    {selected && <EventDialog label={selected.name} onClose={close} busy={busy}>
      <div className="ig-dialog">
        <header className="ig-dialog-header"><h2>{uk ? 'Інтеграція' : 'Integration'}</h2><button type="button" className="ig-close" disabled={busy} aria-label={t('calendarView.event.close')} onClick={close}><Icon name="x" size={19}/></button></header>
        <div className="ig-identity"><span className="ig-symbol"><Icon name="plug" size={27}/></span><div><h3>{selected.name}</h3>{status(selected)}</div></div>
        <nav className="ig-tabs" aria-label={uk ? 'Керування інтеграцією' : 'Integration management'}><button type="button" aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>{uk ? 'Налаштування' : 'Settings'}</button><button type="button" aria-pressed={tab === 'keys'} disabled={busy} onClick={() => { setTab('keys'); void run(() => loadKeys(selected.id)); }}>{t('integrations.manageKeys')}</button></nav>
        {error && <p className="ig-error" role="alert">{error}</p>}
        {newKey && <div className="ig-secret"><strong>{t('integrations.keyOnce')}</strong><input aria-label={t('integrations.keyOnce')} readOnly value={newKey} onFocus={e => e.target.select()}/><button type="button" onClick={() => setNewKey('')}>{uk ? 'Приховати ключ' : 'Dismiss key'}</button></div>}
        {tab === 'settings' ? <div className="ig-dialog-body"><form onSubmit={e => { e.preventDefault(); void run(() => saveIntegrationName(selected)); }}><label className="ig-property"><span>{t('integrations.name')}</span><input value={editNames[selected.id] ?? selected.name} onChange={e => setEditNames(current => ({ ...current, [selected.id]: e.target.value }))} maxLength={120} required/></label><div className="ig-inline-actions"><button className="ig-primary" type="submit" disabled={busy || !(editNames[selected.id] ?? selected.name).trim()}>{t('integrations.save')}</button></div></form><div className="ig-property ig-status-row"><span>{uk ? 'Статус' : 'Status'}</span><button type="button" disabled={busy} onClick={() => void run(() => updateIntegration(selected))}>{selected.status === 'active' ? t('integrations.disable') : t('integrations.enable')}</button></div></div> : <div className="ig-dialog-body">
          <form onSubmit={e => { e.preventDefault(); if (values.label.trim()) void run(() => createKey(selected.id)); }}>
            <label className="ig-property"><span>{t('integrations.keyLabel')}</span><input value={values.label} onChange={e => changeKey('label', e.target.value)} maxLength={120} required/></label>
            <label className="ig-property"><span>{t('integrations.scopeResource')}</span><select value={values.resource} onChange={e => changeKey('resource', e.target.value)}>{SCOPE_RESOURCES.map(resource => <option key={resource.value} value={resource.value}>{t(resource.labelKey)}</option>)}</select></label>
            <fieldset className="ig-scopes"><legend>{t('integrations.keyScope')}</legend><p>{t('integrations.scopeHelp')}</p>{KEY_SCOPE_OPTIONS.map(option => <label key={option.value}><input type="radio" name="ig-scope" checked={values.level === option.value} onChange={() => changeKey('level', option.value)}/>{t(option.labelKey)}</label>)}</fieldset>
            <div className="ig-inline-actions"><button className="ig-primary" type="submit" disabled={busy || !values.label.trim() || !!newKey}>{t('integrations.createKey')}</button></div>
          </form>
          <div className="ig-key-heading"><h3>{uk ? 'Ключі API' : 'API keys'}</h3><button type="button" disabled={busy} onClick={() => void run(() => loadKeys(selected.id))} aria-label={t('integrations.showKeys')}><Icon name="refresh" size={16}/></button></div>
          {!(keys[selected.id] || []).length && <p className="ig-muted">{busy ? t('common.loading') : keys[selected.id] ? (uk ? 'Ключів немає' : 'No API keys') : '—'}</p>}
          {(keys[selected.id] || []).map(key => <div className="ig-key" key={key.id}><div><strong>{key.label}</strong><p>{key.prefix} · {statusLabel(t, key.status)}</p><small>{t('integrations.keyAccess', { scope: scopeLabel(t, key.scopes) })}</small></div>{key.status !== 'revoked' && <button type="button" className="ig-danger" disabled={busy} onClick={() => void run(() => revokeKey(selected.id, key.id))}>{t('integrations.revokeKey')}</button>}</div>)}
        </div>}
      </div>
    </EventDialog>}
  </section>;
}
