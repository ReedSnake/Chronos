import { runtimeConfigValues } from '../config/runtimeConfig';

export class UserService {
  constructor(httpClient) {
    this.httpClient = httpClient;
  }

  getMe() { return this.httpClient.get('/users/me'); }
  getById(id) { return this.httpClient.get(`/users/${encodeURIComponent(id)}`); }
  updateProfile(values) { return this.httpClient.patch('/users/me', values); }
  updateCountry(country) { return this.httpClient.patch('/users/me/country', { country }); }
  updateSettings(values) { return this.httpClient.patch('/users/me/settings', values); }
  uploadAvatar(file) { return this.httpClient.putImage('/users/me/avatar', file); }
  removeAvatar() { return this.httpClient.delete('/users/me/avatar'); }
  deleteAccount() { return this.httpClient.delete('/users/me'); }

  imageUrl(relativePath) {
    return relativePath ? new URL(relativePath, `${runtimeConfigValues.apiBaseUrl}/`).toString() : null;
  }
}
