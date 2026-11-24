import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { SUPPORTED_LOCALES } from '../i18n/locales';
import { useLocale } from '../i18n/LocaleProvider';

function getNavigationClass({ isActive }) {
  return isActive ? 'navigation-link active' : 'navigation-link';
}

export function ApplicationPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAuthScreen = /\/(login|register)\/?$/.test(pathname);
  const { status } = useAuth();
  const { locale, t, localizedPath, locationForLocale } = useLocale();
  const signedIn = status === 'authenticated';
  const authResolved = status !== 'loading';
  return (
    <main className={isAuthScreen ? "page auth-screen" : "page"}>
      <section className="application-shell">
        <header className="application-header">
          <Link className="brand" to={localizedPath('/')}>Chronos</Link>
          {!isAuthScreen && <nav aria-label={t('navigation.label')} className="navigation">
            <NavLink className={getNavigationClass} to={localizedPath('/')} end>{t('navigation.home')}</NavLink>
            {signedIn && <NavLink className={getNavigationClass} to={localizedPath('/calendars')}>{t('navigation.calendars')}</NavLink>}
            {signedIn && <NavLink className={getNavigationClass} to={localizedPath('/integrations')}>{t('navigation.integrations')}</NavLink>}
            {authResolved && !signedIn && <NavLink className={getNavigationClass} to={localizedPath('/register')}>{t('navigation.register')}</NavLink>}
            {authResolved && !signedIn && <NavLink className={getNavigationClass} to={localizedPath('/login')}>{t('navigation.login')}</NavLink>}
            <NavLink className={getNavigationClass} to={localizedPath('/account')}>{t('navigation.account')}</NavLink>
          </nav>}
          <label className="locale-switcher">
            <span className="visually-hidden">{t('languageSwitcher.label')}</span>
            <select value={locale} aria-label={t('languageSwitcher.label')}
              onChange={(event) => navigate(locationForLocale(event.target.value), { replace: true })}>
              {SUPPORTED_LOCALES.map((supportedLocale) => (
                <option key={supportedLocale} value={supportedLocale}>{t(`languageSwitcher.${supportedLocale}`)}</option>
              ))}
            </select>
          </label>
        </header>
        <Outlet />
      </section>
    </main>
  );
}
