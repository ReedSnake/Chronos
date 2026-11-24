export class CalendarService {
  constructor(httpClient) {
    this.httpClient = httpClient;
  }

  list() { return this.httpClient.get('/calendars'); }
  get(id) { return this.httpClient.get(`/calendars/${encodeURIComponent(id)}`); }
  listEvents(id, { from, to, types = [], categories = [], page, limit } = {}) {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    if (types.length) query.set('types', types.join(','));
    if (categories.length) query.set('categories', categories.join(','));
    if (page) query.set('page', String(page));
    if (limit) query.set('limit', String(limit));
    const suffix = query.size ? `?${query.toString()}` : '';
    return this.httpClient.get(`/calendars/${encodeURIComponent(id)}/events${suffix}`);
  }
  getEvent(id, eventId) { return this.httpClient.get(`/calendars/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`); }
  createEvent(id, values) { return this.httpClient.post(`/calendars/${encodeURIComponent(id)}/events`, values); }
  updateEvent(id, eventId, values) { return this.httpClient.patch(`/calendars/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`, values); }
  deleteEvent(id, eventId) { return this.httpClient.delete(`/calendars/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`); }
  create(values) { return this.httpClient.post('/calendars', values); }
  update(id, values) { return this.httpClient.patch(`/calendars/${encodeURIComponent(id)}`, values); }
  remove(id) { return this.httpClient.delete(`/calendars/${encodeURIComponent(id)}`); }
  createShareLink(id, values) { return this.httpClient.post(`/calendars/${encodeURIComponent(id)}/share-links`, values); }
  listShareLinks(id) { return this.httpClient.get(`/calendars/${encodeURIComponent(id)}/share-links`); }
  revokeShareLink(id, linkId) { return this.httpClient.delete(`/calendars/${encodeURIComponent(id)}/share-links/${encodeURIComponent(linkId)}`); }
  createInvitation(id, values) { return this.httpClient.post(`/calendars/${encodeURIComponent(id)}/invitations`, values); }
  createBulkInvitations(id, values) { return this.httpClient.post(`/calendars/${encodeURIComponent(id)}/invitations/bulk`, values, { timeoutMs: 30000 }); }
  listInvitations(id) { return this.httpClient.get(`/calendars/${encodeURIComponent(id)}/invitations`); }
  revokeInvitation(id, invitationId) { return this.httpClient.delete(`/calendars/${encodeURIComponent(id)}/invitations/${encodeURIComponent(invitationId)}`); }
  listMembers(id) { return this.httpClient.get(`/calendars/${encodeURIComponent(id)}/members`); }
  createMember(id, values) { return this.httpClient.post(`/calendars/${encodeURIComponent(id)}/members`, values); }
  updateMember(id, memberId, values) { return this.httpClient.patch(`/calendars/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`, values); }
  removeMember(id, memberId) { return this.httpClient.delete(`/calendars/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`); }
  rememberInvitation(token) { return this.httpClient.post('/calendar-invitations/remember', { token }); }
  claimInvitation() { return this.httpClient.post('/calendar-invitations/claim', {}); }

  getShared(token) { return this.httpClient.get('/calendar-share', { headers: { Authorization: `CalendarLink ${token}` } }); }
  listSharedEvents(token, filters = {}) {
    const query = new URLSearchParams();
    if (filters?.from) query.set('from', filters.from);
    if (filters?.to) query.set('to', filters.to);
    if (filters.types?.length) query.set('types', filters.types.join(','));
    if (filters.categories?.length) query.set('categories', filters.categories.join(','));
    if (filters.page) query.set('page', String(filters.page));
    if (filters.limit) query.set('limit', String(filters.limit));
    const suffix = query.size ? `?${query.toString()}` : '';
    return this.httpClient.get(`/calendar-share/events${suffix}`, { headers: { Authorization: `CalendarLink ${token}` } });
  }
  updateShared(token, values) { return this.httpClient.patch('/calendar-share', values, { headers: { Authorization: `CalendarLink ${token}` } }); }
}
