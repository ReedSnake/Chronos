import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';

export function HomePage() {
  const navigate = useNavigate();
  const [lookupId, setLookupId] = useState('');
  const { status, user, error, refresh } = useAuth();
  const { localizedPath, t } = useLocale();

  if (status === 'loading') return <PageTemplate><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (status === 'anonymous') return <PageTemplate><p>{t('home.signInBefore')}<Link to={localizedPath('/login')}>{t('common.signIn')}</Link>{t('home.signInAfter')}</p></PageTemplate>;
  if (status === 'error') return (
    <PageTemplate>
      <p role="alert">{error || t('home.loadError')}</p>
      <button type="button" onClick={() => { void refresh(); }}>{t('common.retry')}</button>
    </PageTemplate>
  );

  function findUser(event) {
    event.preventDefault();
    if (lookupId.trim()) navigate(localizedPath(`/users/${encodeURIComponent(lookupId.trim())}`));
  }

  return (
    <section className="account-section">
      <h1>{t('home.welcome', { name: user.name })}</h1>
      <p>{t('home.description')}</p>
      <p><Link to={localizedPath('/account')}>{t('home.manageAccount')}</Link></p>
      <form onSubmit={findUser} className="account-form">
        <label htmlFor="lookup-user">{t('home.lookupLabel')}</label>
        <input id="lookup-user" value={lookupId} onChange={(event) => setLookupId(event.target.value)}
          placeholder={t('home.lookupPlaceholder')} required />
        <button type="submit">{t('home.viewProfile')}</button>
      </form>
    </section>
  );
}
