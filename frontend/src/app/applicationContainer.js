import { HttpClient } from '../api/HttpClient';
import { runtimeConfigValues } from '../config/runtimeConfig';
import { AuthService } from '../services/AuthService';
import { CountryService } from '../services/CountryService';
import { TimeZoneService } from '../services/TimeZoneService';
import { UserService } from '../services/UserService';
import { CalendarService } from '../services/CalendarService';
import { IntegrationService } from '../services/IntegrationService';

const httpClient = new HttpClient({
  baseUrl: runtimeConfigValues.apiBaseUrl,
  timeoutMs: runtimeConfigValues.requestTimeoutMs,
});

export const applicationContainer = Object.freeze({
  authService: new AuthService(httpClient),
  calendarService: new CalendarService(httpClient),
  countryService: new CountryService(),
  timeZoneService: new TimeZoneService(),
  integrationService: new IntegrationService(httpClient),
  userService: new UserService(httpClient),
});
