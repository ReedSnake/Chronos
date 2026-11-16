import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ApplicationPage } from '../pages/ApplicationPage';
import { ConnectionPage } from '../pages/ConnectionPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ApplicationPage />}>
          <Route index element={<ConnectionPage title="Connection" />} />
          <Route path="status" element={<ConnectionPage title="System status" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
