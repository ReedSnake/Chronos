import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { formatCountryName, formatDate } from '../i18n/formatters';
import { useLocale } from '../i18n/LocaleProvider';

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
      .catch((requestError) => { if (alive) setError(requestError.message || t('publicProfile.error')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  return (
    <section className="account-section">
      <h1>{t('publicProfile.title')}</h1>
      {loading && <p role="status">{t('common.loading')}</p>}
      {error && <p role="alert">{error} <Link to={localizedPath('/login')}>{t('common.signIn')}</Link></p>}
      {user && <>
        {user.avatarUrl && <img className="profile-avatar" alt={t('publicProfile.avatarAlt')}
          src={applicationContainer.userService.imageUrl(user.avatarUrl)} />}
        <p><strong>{user.name}</strong></p>
        <p>{user.bio || t('publicProfile.emptyBio')}</p>
        {user.country && <p>{t('publicProfile.country', { country: formatCountryName(user.country, locale) })}</p>}
        {user.createdAt && <p>{t('publicProfile.memberSince', { date: formatDate(user.createdAt, locale) })}</p>}
      </>}
      <p><Link to={localizedPath('/')}>{t('publicProfile.back')}</Link></p>
    </section>
  );
}
