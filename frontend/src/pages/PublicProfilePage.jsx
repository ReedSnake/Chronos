import { TablerIcon } from '../components/layout/TablerIcon';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { formatCountryName, formatDate } from '../i18n/formatters';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';

export function PublicProfilePage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { locale, localizedPath, t } = useLocale();

  useEffect(() => {
    let alive = true;
    applicationContainer.userService.getById(id)
      .then(({ user: result }) => { if (alive) setUser(result); })
      .catch((requestError) => { if (alive) setError(getLocalizedApiError(requestError, t, 'publicProfile.error')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  return (
    <section className="public-profile">
      <div className="profile-cover" aria-hidden="true"/>
      <div className="profile-content">
        {loading && <p role="status">{t('common.loading')}</p>}
        {error && <p className="profile-error" role="alert">{error} <Link to={localizedPath('/login')}>{t('common.signIn')}</Link></p>}
        {user && <>
          <div className="profile-identity">
            <div className="profile-photo">{user.avatarUrl ? <img alt={t('publicProfile.avatarAlt')} src={applicationContainer.userService.imageUrl(user.avatarUrl)}/> : <span aria-hidden="true">{String(user.name || '?').trim().slice(0,1).toUpperCase()}</span>}</div>
            <h1>{user.name}</h1>
          </div>
          <section><h2>{locale === 'uk' ? 'Про себе' : 'About'}</h2><p className="profile-bio">{user.bio || t('publicProfile.emptyBio')}</p></section>
          {(user.country || user.createdAt) && <div className="profile-meta">
            {user.country && <p><TablerIcon name="world" size={18}/>{t('publicProfile.country', { country: formatCountryName(user.country, locale) })}</p>}
            {user.createdAt && <p><TablerIcon name="calendar" size={18}/>{t('publicProfile.memberSince', { date: formatDate(user.createdAt, locale) })}</p>}
          </div>}
        </>}
        <Link className="profile-back" to={localizedPath('/')}><TablerIcon name="chevron-left" size={16}/>{t('publicProfile.back')}</Link>
      </div>
    </section>
  );
}
