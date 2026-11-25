import { useCallback, useEffect, useRef, useState } from 'react';
import { applicationContainer } from '../../app/applicationContainer';

const service = applicationContainer.notificationService;
const EMPTY = { notifications: [], unreadCount: 0, error: false, loading: true };

export function useNotifications(userId) {
  const [state, setState] = useState(EMPTY);
  const [loadedUser, setLoadedUser] = useState(null);
  const [toast, setToast] = useState(null);
  const sequence = useRef(0);
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const seen = useRef(new Set());
  const refresh = useCallback(async () => {
    if (!userId || currentUser.current !== userId) return;
    const version = ++sequence.current;
    try {
      const result = await service.list();
      if (currentUser.current !== userId || version !== sequence.current) return;
      setState({ ...result, error: false, loading: false });
      const fresh = result.notifications.filter(n => !n.readAt && !seen.current.has(n.id));
      if (fresh.length) {
        fresh.forEach(n => seen.current.add(n.id));
        // One preview per new batch; all notifications remain in the inbox.
        setToast(fresh.find(n => n.kind === 'welcome') || fresh[0]);
        try { localStorage.setItem(`chronos:notification-previews:${userId}`, JSON.stringify([...seen.current].slice(-200))); } catch { /* storage can be disabled */ }
      }
    } catch {
      if (currentUser.current === userId && version === sequence.current) setState(old => ({ ...old, loading: false, error: true }));
    }
  }, [userId]);
  useEffect(() => {
    sequence.current += 1;
    setState(EMPTY); setToast(null); seen.current = new Set(); setLoadedUser(userId);
    if (!userId) return undefined;
    try { const saved = JSON.parse(localStorage.getItem(`chronos:notification-previews:${userId}`) || '[]'); if (Array.isArray(saved)) seen.current = new Set(saved); } catch { /* optional */ }
    void refresh();
    const interval = setInterval(refresh, 15000);
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { sequence.current += 1; clearInterval(interval); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [userId, refresh]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(timer);
  }, [toast]);
  const markRead = async (id) => {
    if (!userId) return false;
    try {
      if (id) await service.markRead(id); else await service.markAllRead();
      if (currentUser.current !== userId) return false;
      await refresh();
      return true;
    } catch { if (currentUser.current === userId) setState(old => ({ ...old, error: true })); return false; }
  };
  return { ...(loadedUser === userId ? state : EMPTY), toast: loadedUser === userId ? toast : null, dismissToast: () => setToast(null), refresh, markRead };
}
