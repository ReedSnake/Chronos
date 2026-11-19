import { AppRoutes } from '../routes/AppRoutes';
import { AuthProvider } from '../features/auth/AuthContext';

export function Application() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}
