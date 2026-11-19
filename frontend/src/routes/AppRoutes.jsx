import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DEFAULT_LOCALE } from '../i18n/locales';
import { LocaleRoute } from '../i18n/LocaleProvider';
import { localizedPath } from './localePath';
import { ApplicationPage } from '../pages/ApplicationPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RegisterPage } from '../pages/RegisterPage';
import { LoginPage } from '../pages/LoginPage';
import { EmailVerificationPage } from '../pages/EmailVerificationPage';
import { AccountPage } from '../pages/AccountPage';
import { HomePage } from '../pages/HomePage';
import { PublicProfilePage } from '../pages/PublicProfilePage';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DefaultLocaleRedirect />} />
        <Route path="register" element={<LegacyRouteRedirect />} />
        <Route path="login" element={<LegacyRouteRedirect />} />
        <Route path="verify-email" element={<LegacyRouteRedirect />} />
        <Route path="account" element={<LegacyRouteRedirect />} />
        <Route path="users/*" element={<LegacyRouteRedirect />} />
        <Route path=":locale" element={<LocaleRoute />}>
          <Route element={<ApplicationPage />}>
            <Route index element={<HomePage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="verify-email" element={<EmailVerificationPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="users/:id" element={<PublicProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<DefaultLocaleRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

function redirectToDefaultLocale(location) {
  return {
    pathname: localizedPath(DEFAULT_LOCALE, location.pathname),
    search: location.search,
    hash: location.hash,
  };
}

function DefaultLocaleRedirect() {
  const location = useLocation();
  return <Navigate replace to={redirectToDefaultLocale(location)} />;
}

function LegacyRouteRedirect() {
  const location = useLocation();
  return <Navigate replace to={redirectToDefaultLocale(location)} />;
}
