import { WorkspaceErrorBoundary } from '../components/layout/WorkspaceErrorBoundary';
import { IconTooltips } from '../features/ui/IconTooltips';
import '../styles/ux-final.css';
import { ActivityCenter } from '../features/ui/ActivityCenter';
import { useNotifications } from '../features/ui/useNotifications';
import { NotificationToast } from '../features/ui/NotificationToast';
import '../styles/notifications.css';
import { useLocalPreference } from '../features/ui/useLocalPreference';
import '../styles/ux-polish.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { TablerIcon } from '../components/layout/TablerIcon';
import { applicationContainer } from '../app/applicationContainer';
import '../styles/workspace.css';
import '../styles/secondary-surfaces.css';
import '../styles/workspace-refine.css';
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
  const [activity,setActivity]=useState(false);
  useEffect(()=>{if(status!=='authenticated')setActivity(false);},[status]);
  const signedIn = status === 'authenticated';
  const notifications = useNotifications(signedIn ? user?.id : null);
  const isPublicHome = status === 'anonymous' && pathname.replace(/\/$/, '') === localizedPath('/').replace(/\/$/, '');
  const authResolved = status !== 'loading';
  const workspaceRoute = pathname.replace(/^\/[^/]+/, '').replace(/\/$/, '');
  const inWorkspace = signedIn && (workspaceRoute === '' || /^\/(account|calendars|integrations|users|tasks)(\/|$)/.test(workspaceRoute)) && workspaceRoute !== '/integrations/approve';
  const showTopbar=inWorkspace&&!/^\/account(?:\/|$)/.test(workspaceRoute);
  const mainRef=useRef(null);
  useLayoutEffect(()=>{
    if(!inWorkspace||!mainRef.current||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const element=Array.from(mainRef.current.children).find(node=>!node.matches('.workspace-topbar,.workspace-mobile-actions,.workspace-sign-out-error'));
    if(!element||typeof element.animate!=='function')return;
    const rootStyle = getComputedStyle(document.documentElement);
    const duration = parseFloat(rootStyle.getPropertyValue('--chronos-motion-page')) || 320;
    const easing = rootStyle.getPropertyValue('--chronos-motion-ease').trim() || 'ease-out';
    const animation = element.animate([{ opacity: .65 }, { opacity: 1 }], { duration, easing });
    return()=>animation.cancel();
  },[pathname,inWorkspace]);
  const isSharedScreen = workspaceRoute === '/calendar-share';
  const isSupportScreen = isSharedScreen || ['/verify-email','/calendar-invite','/event-invite','/integrations/approve'].includes(workspaceRoute) || (!inWorkspace && !isAuthScreen && !isPublicHome && workspaceRoute !== '');
  async function signOut() {
    if (signOutLock.current || accountExitState.busy) return;
    if ((accountExitState.dirty || document.querySelector('[data-unsaved="true"]')) && !window.confirm(locale === 'uk'
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
    const profileLabel = locale === 'uk' ? 'Профіль' : 'Profile';
    const items = [
      ['/', 'layout-dashboard', t('workspace.dashboard')],
      ['/calendars/view', 'calendar-week', t('workspace.schedule')],
      ['/tasks', 'checkbox', t('workspace.tasks')],
      ['/calendars', 'calendar', t('navigation.calendars')],
      ['/integrations', 'plug', t('navigation.integrations')],
    ];
    const avatar = applicationContainer.userService.imageUrl(user?.avatarUrl);
    return <main className={"workspace"+(collapsed?" ux-sidebar-collapsed":"")}>
      <aside className="workspace-sidebar" onClickCapture={e=>{if(e.target.closest("a")&&document.querySelector('[data-unsaved="true"]')&&!window.confirm(t('workspace.discard'))){e.preventDefault();e.stopPropagation();}}}>
        <Link className="workspace-logo" to={localizedPath('/')}><span className="workspace-logo-icon"><TablerIcon name="clock" size={25}/></span><span>chronos<span>.</span></span></Link>
        <div className="workspace-collapse-row"><button className="workspace-collapse" type="button" onClick={()=>setCollapsed(v=>!v)} aria-pressed={collapsed} title={t(collapsed?'workspace.expand':'workspace.collapse')} aria-label={t(collapsed?'workspace.expand':'workspace.collapse')}><TablerIcon name={collapsed?'chevron-right':'chevron-left'} size={18}/></button></div>
        <nav className="workspace-nav" aria-label={t('navigation.label')}>
          {items.map(([path, icon, label]) => <NavLink key={path} aria-label={label} title={label} end={path==='/'||path==='/calendars'} to={localizedPath(path)} className={({isActive})=>'workspace-nav-link'+(isActive?' active':'')}><TablerIcon name={icon} size={21}/><span>{label}</span></NavLink>)}
          <NavLink aria-label={profileLabel} title={profileLabel} to={localizedPath('/account')} className={({isActive})=>'workspace-nav-link workspace-mobile-profile'+(isActive?' active':'')}><TablerIcon name="user" size={21}/><span>{profileLabel}</span></NavLink>
        </nav>
        <div className="workspace-side-bottom">
          <label className="workspace-language"><span className="visually-hidden">{t('languageSwitcher.label')}</span><select value={locale} aria-label={t('languageSwitcher.label')} onChange={event=>navigate(locationForLocale(event.target.value),{replace:true})}>{SUPPORTED_LOCALES.map(lang=><option key={lang} value={lang}>{t(`languageSwitcher.${lang}`)}</option>)}</select></label>
          <Link className="workspace-user" aria-label={profileLabel} title={profileLabel} to={localizedPath('/account')}><span className="workspace-avatar">{avatar?<img src={avatar} alt=""/>:String(user?.name||'?').trim().slice(0,1).toUpperCase()}</span><span className="workspace-user-name"><strong>{user?.name}</strong><small>{profileLabel}</small></span><TablerIcon name="chevron-right" size={16}/></Link>
          {signOutButton}
        </div>
      </aside>
      <div ref={mainRef} className={'workspace-main'+(showTopbar?' has-topbar':'')}>
        {showTopbar&&<header className="workspace-topbar"><div className="workspace-topbar-actions"><button className="workspace-notifications" type="button" onClick={()=>{notifications.dismissToast();setActivity(true);}} title={t('workspace.activity')} aria-label={`${t('workspace.activity')}${notifications.unreadCount ? ` (${notifications.unreadCount})` : ''}`}><TablerIcon name="bell" size={21}/>{notifications.unreadCount>0&&<span className="notification-count" aria-hidden="true">{notifications.unreadCount>99?'99+':notifications.unreadCount}</span>}</button></div></header>}
        <div className="workspace-mobile-actions"><label className="workspace-language workspace-mobile-language"><span className="visually-hidden">{t('languageSwitcher.label')}</span><select value={locale} aria-label={t('languageSwitcher.label')} onChange={event=>navigate(locationForLocale(event.target.value),{replace:true})}>{SUPPORTED_LOCALES.map(lang=><option key={lang} value={lang}>{t(`languageSwitcher.${lang}`)}</option>)}</select></label>{signOutButton}</div>
        {signOutError && <p className="workspace-sign-out-error" role="alert">{signOutError}</p>}
        <WorkspaceErrorBoundary key={pathname} title={t('workspace.pageError')} description={t('workspace.pageErrorDescription')} retry={t('common.retry')}>
          <Outlet context={{ setAccountExitState, signOutPending }}/>
        </WorkspaceErrorBoundary>
      </div>
      {activity&&<ActivityCenter user={user} notifications={notifications} onClose={()=>setActivity(false)}/>}
      {!activity&&<NotificationToast notification={notifications.toast} onOpen={()=>{notifications.dismissToast();setActivity(true);}} onDismiss={notifications.dismissToast}/>}
      <IconTooltips/>
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
