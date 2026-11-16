export function parseHealthResponse(payload) {
  if (!payload || typeof payload !== 'object' || typeof payload.status !== 'string') {
    throw new Error('Server returned an invalid health response');
  }

  return {
    status: payload.status,
    databaseStatus: payload.database?.status || 'unknown',
    timestamp: payload.timestamp,
  };
}
