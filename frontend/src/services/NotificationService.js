export class NotificationService {
  constructor(http) { this.http = http; }
  list() { return this.http.get('/notifications'); }
  markRead(id) { return this.http.patch(`/notifications/${encodeURIComponent(id)}/read`, {}); }
  markAllRead() { return this.http.patch('/notifications/read-all', {}); }
}
