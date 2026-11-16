import { useCallback, useState } from 'react';
import { runtimeConfigValues } from '../../config/runtimeConfig';
import { CONNECTION_STATUS } from '../../constants/connectionStatus';
import { usePolling } from '../../hooks/usePolling';
import { formatRequestError } from '../../utils/formatRequestError';

const initialState = {
  state: CONNECTION_STATUS.CHECKING,
  message: 'Checking server lifecycle...',
  databaseStatus: 'unknown',
};

export function useConnectionHealth(healthService) {
  const [connection, setConnection] = useState(initialState);

  const checkConnection = useCallback(async () => {
    try {
      const health = await healthService.getStatus();

      if (health.status === 'ok' && health.databaseStatus === 'connected') {
        setConnection({
          state: CONNECTION_STATUS.CONNECTED,
          message: 'Connection established',
          databaseStatus: health.databaseStatus,
        });
        return;
      }

      setConnection({
        state: CONNECTION_STATUS.WAITING,
        message: 'Server is running. Waiting for database connection...',
        databaseStatus: health.databaseStatus,
      });
    } catch (error) {
      setConnection({
        state: CONNECTION_STATUS.FAILED,
        message: formatRequestError(error),
        databaseStatus: 'unavailable',
      });
    }
  }, [healthService]);

  usePolling(checkConnection, runtimeConfigValues.healthPollIntervalMs);

  return connection;
}
