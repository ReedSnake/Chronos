import { HttpClient } from '../api/HttpClient';
import { runtimeConfigValues } from '../config/runtimeConfig';
import { HealthService } from '../services/HealthService';
import { AuthService } from '../services/AuthService';
import { CountryService } from '../services/CountryService';
import { TimeZoneService } from '../services/TimeZoneService';
import { UserService } from '../services/UserService';

const httpClient = new HttpClient({
  baseUrl: runtimeConfigValues.apiBaseUrl,
  timeoutMs: runtimeConfigValues.requestTimeoutMs,
});

export const applicationContainer = Object.freeze({
  healthService: new HealthService(httpClient),
  authService: new AuthService(httpClient),
  countryService: new CountryService(),
  timeZoneService: new TimeZoneService(),
  userService: new UserService(httpClient),
});
