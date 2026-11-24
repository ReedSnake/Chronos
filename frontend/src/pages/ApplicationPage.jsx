import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { TablerIcon } from '../components/layout/TablerIcon';
import { applicationContainer } from '../app/applicationContainer';
import '../styles/workspace.css';
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
  const { status, user } = useAuth();
  const { locale, t, localizedPath, locationForLocale } = useLocale();
  const signedIn = status === 'authenticated';
  const isPublicHome = status === 'anonymous' && pathname.replace(/\/$/, '') === localizedPath('/').replace(/\/$/, '');
  const authResolved = status !== 'loading';
  const workspaceRoute = pathname.replace(/^\/[^/]+/, '').replace(/\/$/, '');
  const inWorkspace = signedIn && (workspaceRoute === '' || /^\/(account|calendars|integrations|users)(\/|$)/.test(workspaceRoute)) && workspaceRoute !== '/integrations/approve';
  if (inWorkspace) {
    const items = [
      ['/', 'layout-dashboard', locale === 'uk' ? 'Огляд' : 'Dashboard'],
      ['/calendars/view', 'calendar-week', locale === 'uk' ? 'Розклад' : 'Schedule'],
      ['/calendars', 'calendar', t('navigation.calendars')],
      ['/integrations', 'plug', t('navigation.integrations')],
      ['/account', 'settings', locale === 'uk' ? 'Налаштування' : 'Settings'],
    ];
    const avatar = applicationContainer.userService.imageUrl(user?.avatarUrl);
    return <main className="workspace">
      <aside className="workspace-sidebar">
        <Link className="workspace-logo" to={localizedPath('/')}><span className="workspace-logo-icon"><TablerIcon name="clock" size={25}/></span><span>chronos<span>.</span></span></Link>
        <nav className="workspace-nav" aria-label={t('navigation.label')}>
          {items.map(([path, icon, label]) => <NavLink key={path} aria-label={label} title={label} end={path==='/'||path==='/calendars'} to={localizedPath(path)} className={({isActive})=>'workspace-nav-link'+(isActive?' active':'')}><TablerIcon name={icon} size={21}/><span>{label}</span></NavLink>)}
        </nav>
        <div className="workspace-side-bottom">
          <label className="workspace-language"><span className="visually-hidden">{t('languageSwitcher.label')}</span><select value={locale} aria-label={t('languageSwitcher.label')} onChange={event=>navigate(locationForLocale(event.target.value),{replace:true})}>{SUPPORTED_LOCALES.map(lang=><option key={lang} value={lang}>{t(`languageSwitcher.${lang}`)}</option>)}</select></label>
          <Link className="workspace-user" aria-label={t('navigation.account')} to={localizedPath('/account')}><span className="workspace-avatar">{avatar?<img src={avatar} alt=""/>:String(user?.name||'?').trim().slice(0,1).toUpperCase()}</span><span className="workspace-user-name"><strong>{user?.name}</strong><small>{t('navigation.account')}</small></span><TablerIcon name="chevron-right" size={16}/></Link>
        </div>
      </aside>
      <div className="workspace-main"><Outlet/></div>
    </main>;
  }
  return (
    <main className={isPublicHome ? "page public-home" : isAuthScreen ? "page auth-screen" : "page"}>
      <section className="application-shell">
        {!isPublicHome && <header className="application-header">
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
        </header>}
        <Outlet />
      </section>
    </main>
  );
}
