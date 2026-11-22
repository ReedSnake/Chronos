export class IntegrationService {
  constructor(httpClient) {
    this.httpClient = httpClient;
  }

  list() { return this.httpClient.get('/integrations'); }
  create(values) { return this.httpClient.post('/integrations', values); }
  update(id, values) { return this.httpClient.patch(`/integrations/${encodeURIComponent(id)}`, values); }
  createKey(integrationId, values) { return this.httpClient.post(`/integrations/${encodeURIComponent(integrationId)}/keys`, values); }
  listKeys(integrationId) { return this.httpClient.get(`/integrations/${encodeURIComponent(integrationId)}/keys`); }
  revokeKey(integrationId, keyId) { return this.httpClient.delete(`/integrations/${encodeURIComponent(integrationId)}/keys/${encodeURIComponent(keyId)}`); }
  listRequests() { return this.httpClient.get('/me/integration-requests'); }
  listGrants() { return this.httpClient.get('/me/integration-grants'); }
  revokeGrant(grantId) { return this.httpClient.delete(`/me/integration-grants/${encodeURIComponent(grantId)}`); }
  resolvePairing(token) { return this.httpClient.post('/me/integration-requests/resolve', { token }); }
  approvePairing(id) { return this.httpClient.post(`/me/integration-requests/${encodeURIComponent(id)}/approve`, {}); }
  rejectPairing(id) { return this.httpClient.post(`/me/integration-requests/${encodeURIComponent(id)}/reject`, {}); }
}
