import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ApplicationPage } from '../pages/ApplicationPage';
import { ConnectionPage } from '../pages/ConnectionPage';
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
        <Route element={<ApplicationPage />}>
          <Route index element={<HomePage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="verify-email" element={<EmailVerificationPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="users/:id" element={<PublicProfilePage />} />
          <Route path="status" element={<ConnectionPage title="System status" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
