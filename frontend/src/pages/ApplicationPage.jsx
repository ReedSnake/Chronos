import { CommandMenu } from '../features/ui/CommandMenu';
import { useLocalPreference } from '../features/ui/useLocalPreference';
import '../styles/ux-polish.css';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { TablerIcon } from '../components/layout/TablerIcon';
import { applicationContainer } from '../app/applicationContainer';
import '../styles/workspace.css';
import '../styles/secondary-surfaces.css';
import { useAuth } from '../features/auth/AuthContext';
import { SUPPORTED_LOCALES } from '../i18n/locales';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';

function getNavigationClass({ isActive }) {
  return isActive ? 'navigation-link active' : 'navigation-link';
}

export function ApplicationPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAuthScreen = /\/(login|register)\/?$/.test(pathname);
  const { status, user, setAnonymous } = useAuth();
  const { locale, t, localizedPath, locationForLocale } = useLocale();
  const [signOutPending, setSignOutPending] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [accountExitState, setAccountExitState] = useState({ dirty: false, busy: false });
  const signOutLock = useRef(false);
  const [collapsed,setCollapsed]=useLocalPreference(user?.id?'sidebar:'+user.id:null,false);
  const [command,setCommand]=useState(false);
  useEffect(()=>{if(status!=='authenticated'){setCommand(false);return;}const listener=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'&&!document.querySelector('dialog[open]')){e.preventDefault();setCommand(true);}};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[status]);
  const signedIn = status === 'authenticated';
  const isPublicHome = status === 'anonymous' && pathname.replace(/\/$/, '') === localizedPath('/').replace(/\/$/, '');
  const authResolved = status !== 'loading';
  const workspaceRoute = pathname.replace(/^\/[^/]+/, '').replace(/\/$/, '');
  const inWorkspace = signedIn && (workspaceRoute === '' || /^\/(account|calendars|integrations|users|tasks)(\/|$)/.test(workspaceRoute)) && workspaceRoute !== '/integrations/approve';
  const isSharedScreen = workspaceRoute === '/calendar-share';
  const isSupportScreen = isSharedScreen || ['/verify-email','/calendar-invite','/event-invite','/integrations/approve'].includes(workspaceRoute) || (!inWorkspace && !isAuthScreen && !isPublicHome && workspaceRoute !== '');
  async function signOut() {
    if (signOutLock.current || accountExitState.busy) return;
    if (accountExitState.dirty && !window.confirm(locale === 'uk'
      ? 'Вийти без збереження змін?' : 'Sign out without saving changes?')) return;
    signOutLock.current = true;
    setSignOutPending(true);
    setSignOutError('');
    try {
      await applicationContainer.authService.logout();
      setAnonymous();
      navigate(localizedPath('/login'), { replace: true });
    } catch (error) {
      setSignOutError(getLocalizedApiError(error, t, 'account.signOutError'));
    } finally {
      signOutLock.current = false;
      setSignOutPending(false);
    }
  }

  if (inWorkspace) {
    const signOutLabel = t('account.actions.signOut');
    const signOutButton = (
      <button type="button" className="workspace-sign-out" onClick={signOut}
        disabled={signOutPending || accountExitState.busy}
        aria-label={signOutLabel} title={signOutLabel} aria-busy={signOutPending}>
        <TablerIcon name="logout" size={20}/><span>{signOutLabel}</span>
      </button>
    );
    const items = [
      ['/', 'layout-dashboard', locale === 'uk' ? 'Огляд' : 'Dashboard'],
      ['/calendars/view', 'calendar-week', locale === 'uk' ? 'Розклад' : 'Schedule'],
      ['/tasks', 'checkbox', locale === 'uk' ? 'Завдання' : 'Tasks'],
      ['/calendars', 'calendar', t('navigation.calendars')],
      ['/integrations', 'plug', t('navigation.integrations')],
      ['/account', 'settings', locale === 'uk' ? 'Налаштування' : 'Settings'],
    ];
    const avatar = applicationContainer.userService.imageUrl(user?.avatarUrl);
    return <main className={"workspace"+(collapsed?" ux-sidebar-collapsed":"")}>
      <aside className="workspace-sidebar">
        <Link className="workspace-logo" to={localizedPath('/')}><span className="workspace-logo-icon"><TablerIcon name="clock" size={25}/></span><span>chronos<span>.</span></span></Link>
        <div className="ux-sidebar-tools"><button type="button" onClick={()=>setCommand(true)} title={locale==='uk'?'Пошук (Ctrl/⌘ K)':'Search (Ctrl/⌘ K)'} aria-label={locale==='uk'?'Пошук':'Search'}><TablerIcon name="search" size={18}/><span>{locale==='uk'?'Пошук':'Search'}</span><kbd>⌘ K</kbd></button><button className="ux-collapse" type="button" onClick={()=>setCollapsed(v=>!v)} aria-pressed={collapsed} title={locale==='uk'?'Згорнути меню':'Toggle sidebar'} aria-label={locale==='uk'?'Згорнути меню':'Toggle sidebar'}><TablerIcon name={collapsed?'chevron-right':'chevron-left'} size={18}/></button></div>
        <nav className="workspace-nav" aria-label={t('navigation.label')}>
          {items.map(([path, icon, label]) => <NavLink key={path} aria-label={label} title={label} end={path==='/'||path==='/calendars'} to={localizedPath(path)} className={({isActive})=>'workspace-nav-link'+(isActive?' active':'')}><TablerIcon name={icon} size={21}/><span>{label}</span></NavLink>)}
        </nav>
        <div className="workspace-side-bottom">
          <label className="workspace-language"><span className="visually-hidden">{t('languageSwitcher.label')}</span><select value={locale} aria-label={t('languageSwitcher.label')} onChange={event=>navigate(locationForLocale(event.target.value),{replace:true})}>{SUPPORTED_LOCALES.map(lang=><option key={lang} value={lang}>{t(`languageSwitcher.${lang}`)}</option>)}</select></label>
          <Link className="workspace-user" aria-label={t('navigation.account')} to={localizedPath('/account')}><span className="workspace-avatar">{avatar?<img src={avatar} alt=""/>:String(user?.name||'?').trim().slice(0,1).toUpperCase()}</span><span className="workspace-user-name"><strong>{user?.name}</strong><small>{t('navigation.account')}</small></span><TablerIcon name="chevron-right" size={16}/></Link>
          {signOutButton}
        </div>
      </aside>
      <div className="workspace-main"><div className="workspace-mobile-actions"><button className="ux-mobile-command" type="button" onClick={()=>setCommand(true)} aria-label={locale==='uk'?'Пошук':'Search'}><TablerIcon name="search" size={20}/></button><label className="workspace-language workspace-mobile-language"><span className="visually-hidden">{t('languageSwitcher.label')}</span><select value={locale} aria-label={t('languageSwitcher.label')} onChange={event=>navigate(locationForLocale(event.target.value),{replace:true})}>{SUPPORTED_LOCALES.map(lang=><option key={lang} value={lang}>{t(`languageSwitcher.${lang}`)}</option>)}</select></label>{signOutButton}</div>
        {signOutError && <p className="workspace-sign-out-error" role="alert">{signOutError}</p>}
        <Outlet context={{ setAccountExitState, signOutPending }}/>
      </div>
      {command&&<CommandMenu user={user} items={items} onClose={()=>setCommand(false)}/>}
    </main>;
  }
  return (
    <main className={isPublicHome ? "page public-home" : isAuthScreen ? "page auth-screen" : isSupportScreen ? (isSharedScreen ? "page support-screen shared-screen" : "page support-screen") : "page"}>
      <section className="application-shell">
        {!isPublicHome && <header className="application-header">
          <Link className="brand" to={localizedPath('/')}>{isSupportScreen ? <><span className="brand-mark"><TablerIcon name="clock" size={21}/></span>chronos.</> : "Chronos"}</Link>
          {!isAuthScreen && !isSupportScreen && <nav aria-label={t('navigation.label')} className="navigation">
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
