import { HttpClient } from '../api/HttpClient';
import { runtimeConfigValues } from '../config/runtimeConfig';
import { HealthService } from '../services/HealthService';

const httpClient = new HttpClient({
  baseUrl: runtimeConfigValues.apiBaseUrl,
  timeoutMs: runtimeConfigValues.requestTimeoutMs,
});

export const applicationContainer = Object.freeze({
  healthService: new HealthService(httpClient),
});
