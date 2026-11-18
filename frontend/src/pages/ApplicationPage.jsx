import { Link, NavLink, Outlet } from 'react-router-dom';

function getNavigationClass({ isActive }) {
  return isActive ? 'navigation-link active' : 'navigation-link';
}

export function ApplicationPage() {
  return (
    <main className="page">
      <section className="application-shell">
        <header className="application-header">
          <Link className="brand" to="/">Chronos</Link>
          <nav aria-label="Main navigation" className="navigation">
            <NavLink className={getNavigationClass} to="/" end>Connection</NavLink>
            <NavLink className={getNavigationClass} to="/status">Status</NavLink>
            <NavLink className={getNavigationClass} to="/register">Register</NavLink>
            <NavLink className={getNavigationClass} to="/login">Login</NavLink>
            <NavLink className={getNavigationClass} to="/account">Account</NavLink>
          </nav>
        </header>
        <Outlet />
      </section>
    </main>
  );
}
