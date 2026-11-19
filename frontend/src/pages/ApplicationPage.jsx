import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';

function getNavigationClass({ isActive }) {
  return isActive ? 'navigation-link active' : 'navigation-link';
}

export function ApplicationPage() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    applicationContainer.userService.getMe()
      .then(() => { if (active) setSignedIn(true); })
      .catch(() => { if (active) setSignedIn(false); });
    return () => { active = false; };
  }, []);
  return (
    <main className="page">
      <section className="application-shell">
        <header className="application-header">
          <Link className="brand" to="/">Chronos</Link>
          <nav aria-label="Main navigation" className="navigation">
            <NavLink className={getNavigationClass} to="/" end>Home</NavLink>
            <NavLink className={getNavigationClass} to="/status">Status</NavLink>
            {!signedIn && <NavLink className={getNavigationClass} to="/register">Register</NavLink>}
            {!signedIn && <NavLink className={getNavigationClass} to="/login">Login</NavLink>}
            <NavLink className={getNavigationClass} to="/account">Account</NavLink>
          </nav>
        </header>
        <Outlet />
      </section>
    </main>
  );
}
