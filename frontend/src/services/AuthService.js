export class AuthService {
  constructor(httpClient) {
    this.httpClient = httpClient;
  }

  register(data) {
    return this.httpClient.post('/auth/register', data, { timeoutMs: 30000 });
  }

  resendVerification(email) {
    return this.httpClient.post('/auth/resend-verification', { email }, { timeoutMs: 30000 });
  }

  verifyEmail(token) {
    return this.httpClient.post('/auth/verify-email', { token });
  }

  login(email, password) {
    return this.httpClient.post('/auth/login', { email, password });
  }

  getCurrentUser() {
    return this.httpClient.get('/users/me');
  }

  logout() {
    return this.httpClient.post('/auth/logout');
  }
}
