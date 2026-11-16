import { parseHealthResponse } from '../schemas/healthSchema';

export class HealthService {
  constructor(httpClient) {
    this.httpClient = httpClient;
  }

  async getStatus() {
    const response = await this.httpClient.get('/health', { allowedStatusCodes: [503] });
    return parseHealthResponse(response);
  }
}
