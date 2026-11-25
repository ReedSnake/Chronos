import { useEffect, useRef } from 'react';

// Avoid frequent reloads and never interrupt an open editor or pending write.
export function useRefreshOnFocus(refresh, enabled = true, minimumInterval = 60000) {
  const latest = useRef({ refresh, enabled });
  latest.current = { refresh, enabled };
  useEffect(() => {
    let last = Date.now();
    function update() {
      if (document.visibilityState !== 'visible' || !latest.current.enabled ||
          document.querySelector('dialog[open]') || Date.now() - last < minimumInterval) return;
      last = Date.now();
      latest.current.refresh();
    }
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, [minimumInterval]);
}
