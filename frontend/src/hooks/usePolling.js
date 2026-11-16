import { useEffect } from 'react';

export function usePolling(callback, intervalMs) {
  useEffect(() => {
    callback();
    const interval = setInterval(callback, intervalMs);

    return () => clearInterval(interval);
  }, [callback, intervalMs]);
}
