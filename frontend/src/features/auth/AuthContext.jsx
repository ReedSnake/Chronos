import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applicationContainer } from '../../app/applicationContainer';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ status: 'loading', user: null, error: '' });
  const requestVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const { user } = await applicationContainer.userService.getMe();
      if (version === requestVersion.current) {
        setAuth({ status: 'authenticated', user, error: '' });
      }
      return user;
    } catch (error) {
      if (version === requestVersion.current) {
        const status = error?.statusCode === 401 ? 'anonymous' : 'error';
        setAuth({ status, user: null, error: error?.message || '' });
      }
      return null;
    }
  }, []);

  const setAuthenticated = useCallback((user) => {
    requestVersion.current += 1;
    setAuth({ status: 'authenticated', user, error: '' });
  }, []);

  const setAnonymous = useCallback(() => {
    requestVersion.current += 1;
    setAuth({ status: 'anonymous', user: null, error: '' });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({
    ...auth,
    refresh,
    setAuthenticated,
    setAnonymous,
  }), [auth, refresh, setAuthenticated, setAnonymous]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
